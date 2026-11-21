/*
 * Autotracking de eventos al dataLayer — Wire Down. GTM los reenvía a GA4 (ver docs/medicion.md).
 * Se incluye con `defer` en el <head>, después de wd-gtm.js (usa wdGetConsent y WD_GTM_ID).
 *
 * Reglas:
 * - Solo se empuja algo si hay consentimiento de Analítica, revisado en el momento de cada evento.
 * - Nada se empuja antes de que GTM haya cargado: mientras tanto los eventos esperan en una cola.
 *   Si GTM no carga (bloqueador), la cola se descarta.
 * - Cada evento lleva solo los parámetros de su lista blanca (EVENT_PARAMS). Nunca se lee el texto
 *   de la página: los nombres salen de atributos data-* fijos. Del test no sale ni respuesta ni perfil.
 * - Los eventos de Meta (TestStarted, TestCompleted, InitiateCheckout) van por wd-pixel.js y no se tocan.
 * - click_checkout lleva además attr_fuente, attr_entrada y attr_boton (wd-attribution.js): solo
 *   códigos cortos, nunca UTM, fbclid ni gclid.
 *
 * API pública: window.wdTrack(nombre, params). Lo usa test/index.html para test_start,
 * test_complete y test_to_guide (sin parámetros).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root && root.document) api.init(root);
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // Lista blanca: evento → parámetros permitidos. Lo que no esté aquí no sale.
  var EVENT_PARAMS = {
    click_checkout: ['cta_location', 'page_code', 'attr_fuente', 'attr_entrada', 'attr_boton'],
    cta_click: ['cta_name', 'cta_location'],
    test_start: [],
    test_complete: [],
    test_to_guide: [],
    section_view: ['section_name'],
    faq_open: ['faq_id'],
    scroll_depth: ['percent'],
    outbound_click: ['link_domain'],
    thankyou_view: []
  };

  var ALL_PARAMS = [];
  Object.keys(EVENT_PARAMS).forEach(function (name) {
    EVENT_PARAMS[name].forEach(function (p) { if (ALL_PARAMS.indexOf(p) < 0) ALL_PARAMS.push(p); });
  });

  var SCROLL_THRESHOLDS = [25, 50, 75, 90];
  var NO_LOCATION = 'sin_definir';

  // Arma el objeto para dataLayer. Los parámetros de otros eventos se ponen en undefined para que
  // el modelo de datos de GTM (que recuerda valores entre push) no los arrastre a este evento.
  function buildPayload(name, params) {
    if (!Object.prototype.hasOwnProperty.call(EVENT_PARAMS, name)) return null;
    var payload = { event: name };
    ALL_PARAMS.forEach(function (k) { payload[k] = undefined; });
    EVENT_PARAMS[name].forEach(function (k) {
      if (params && params[k] !== undefined && params[k] !== null && params[k] !== '') payload[k] = params[k];
    });
    return payload;
  }

  // Código corto de la página: '/' → 'guia', '/test/' → 'test', '/gracias.html' → 'gracias',
  // '/blog/mi-articulo/' → 'mi-articulo'. Un data-page-code en <body> tiene prioridad.
  function pageCode(pathname) {
    var segs = String(pathname || '/')
      .replace(/index\.html$/, '')
      .replace(/\.html$/, '')
      .split('/')
      .filter(Boolean);
    return segs.length ? segs[segs.length - 1] : 'guia';
  }

  function bareHost(host) { return String(host || '').toLowerCase().replace(/^www\./, ''); }

  // Clasifica un enlace: 'checkout' (pay.hotmart.com), 'hotmart' (otro subdominio de Hotmart, se
  // ignora), 'internal', 'outbound' o null (mailto:, tel:, javascript:, href inválido).
  function linkKind(href, currentHost) {
    var u;
    try { u = new URL(href, 'https://' + (currentHost || 'wire-down.com') + '/'); } catch (e) { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    var host = u.hostname.toLowerCase();
    if (host === 'pay.hotmart.com') return 'checkout';
    if (host === 'hotmart.com' || /\.hotmart\.com$/.test(host)) return 'hotmart';
    if (bareHost(host) === bareHost(currentHost)) return 'internal';
    return 'outbound';
  }

  // Solo el dominio (sin ruta ni query), sin www.
  function linkDomain(href) {
    try { return bareHost(new URL(href).hostname); } catch (e) { return ''; }
  }

  // Porcentaje de la página que ya se recorrió (borde inferior de la ventana).
  function scrollPercent(scrollY, viewportHeight, pageHeight) {
    if (!(pageHeight > 0)) return 0;
    return Math.min(100, ((scrollY + viewportHeight) / pageHeight) * 100);
  }

  // Umbrales nuevos alcanzados con este porcentaje, sin repetir los ya enviados.
  function thresholdsToFire(percent, alreadyFired) {
    return SCROLL_THRESHOLDS.filter(function (t) {
      return percent >= t && alreadyFired.indexOf(t) < 0;
    });
  }

  // "Visible al 50 %": la mitad de la sección, o la mitad de la ventana si la sección es más alta
  // que ella (una sección más alta que dos pantallas nunca llegaría al 50 % de sí misma).
  function visibleEnough(visibleHeight, sectionHeight, viewportHeight) {
    if (!(sectionHeight > 0) || !(visibleHeight > 0)) return false;
    return visibleHeight >= 0.5 * Math.min(sectionHeight, viewportHeight || sectionHeight);
  }

  // Qué eventos produce un clic. En los botones de checkout solo va click_checkout (nunca cta_click,
  // aunque tengan data-cta). Devuelve [[nombre, params], ...].
  function clickEvents(c) {
    var out = [];
    var kind = !c.link ? null : c.link.checkoutClass ? 'checkout' : linkKind(c.link.href, c.host);
    if (c.cta && kind !== 'checkout') out.push(['cta_click', { cta_name: c.cta.name, cta_location: c.cta.location }]);
    if (kind === 'checkout') {
      var params = { cta_location: c.link.location, page_code: c.pageCode };
      if (c.attr) ['attr_fuente', 'attr_entrada', 'attr_boton'].forEach(function (k) { params[k] = c.attr[k]; });
      out.push(['click_checkout', params]);
    }
    else if (kind === 'outbound') out.push(['outbound_click', { link_domain: linkDomain(c.link.href) }]);
    return out;
  }

  // Cola + consentimiento + espera de GTM. Separado del DOM para poder probarlo con node --test.
  function createTracker(root, opts) {
    opts = opts || {};
    var gtmId = opts.gtmId || root.WD_GTM_ID || 'GTM-T47WBMN9';
    var pollMs = opts.pollMs || 250;
    var maxPolls = opts.maxPolls || 40; // ~10 s
    var queue = [], polls = 0, polling = false, gtmFailed = false;

    function hasAnalytics() {
      if (typeof root.wdGetConsent !== 'function') return false;
      var c = root.wdGetConsent();
      return !!(c && c.analytics === true);
    }

    function gtmReady() {
      return !!(root.google_tag_manager && root.google_tag_manager[gtmId] && root.dataLayer);
    }

    function flush() {
      var pending = queue;
      queue = [];
      if (!hasAnalytics()) return; // se revocó mientras esperaba
      pending.forEach(function (p) { root.dataLayer.push(p); });
    }

    function poll() {
      if (gtmReady()) { polling = false; flush(); return; }
      if (++polls >= maxPolls) { polling = false; gtmFailed = true; queue = []; return; }
      root.setTimeout(poll, pollMs);
    }

    function track(name, params) {
      var payload = buildPayload(name, params);
      if (!payload || !hasAnalytics()) return false;
      if (gtmReady()) { root.dataLayer.push(payload); return true; }
      if (gtmFailed) return false;
      queue.push(payload);
      if (!polling) { polling = true; root.setTimeout(poll, pollMs); }
      return true;
    }

    return { track: track, pending: function () { return queue.length; } };
  }

  function init(win) {
    if (win.wdTrack) return; // una sola vez por página
    var doc = win.document;
    var tracker = createTracker(win);
    var track = tracker.track;
    win.wdTrack = track;

    var code = (doc.body && doc.body.getAttribute('data-page-code')) || pageCode(win.location.pathname);

    function ctaLocation(el) {
      var holder = el.closest('[data-cta-location]');
      return (holder && holder.getAttribute('data-cta-location')) || NO_LOCATION;
    }

    // Clics: CTA, checkout y enlaces externos. En captura, para que un stopPropagation del widget
    // de Hotmart no los oculte. Solo lee atributos; no cambia el comportamiento del clic.
    doc.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      var cta = t.closest('[data-cta]');
      var link = t.closest('a[href], .hotmart__button-checkout');
      clickEvents({
        cta: cta ? { name: cta.getAttribute('data-cta'), location: ctaLocation(cta) } : null,
        link: link ? {
          href: link.href || link.getAttribute('href') || '',
          checkoutClass: link.classList.contains('hotmart__button-checkout'),
          location: ctaLocation(link)
        } : null,
        host: win.location.hostname,
        pageCode: code,
        // Códigos de atribución (wd-attribution.js): fuente, entrada y botón. Nada de UTM ni click ID.
        attr: link && win.wdAttribution && win.wdAttribution.linkParams ? win.wdAttribution.linkParams(link) : null
      }).forEach(function (ev) { track(ev[0], ev[1]); });
    }, true);

    // FAQ: una vez por pregunta y por carga de página. En burbujeo, para leer el estado después
    // de que el acordeón de la página lo cambió (clase .open o aria-expanded).
    var faqSent = {};
    function sendFaq(id) {
      if (!id || faqSent[id]) return;
      faqSent[id] = true;
      track('faq_open', { faq_id: id });
    }
    doc.addEventListener('click', function (e) {
      var q = e.target && e.target.closest && e.target.closest('[data-faq]');
      if (!q || q.tagName === 'DETAILS' || q.tagName === 'SUMMARY') return;
      if (q.classList.contains('open') || q.getAttribute('aria-expanded') === 'true') sendFaq(q.getAttribute('data-faq'));
    });
    // <details data-faq> o <details><summary data-faq> (formato previsto para el blog).
    doc.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d || d.tagName !== 'DETAILS' || !d.open) return;
      var s = d.querySelector('summary');
      sendFaq(d.getAttribute('data-faq') || (s && s.getAttribute('data-faq')));
    }, true);

    // Secciones visibles al 50 %: una vez por sección y por carga de página.
    if ('IntersectionObserver' in win) {
      var steps = [];
      for (var i = 0; i <= 20; i++) steps.push(i / 20);
      var io = new win.IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var vh = (en.rootBounds && en.rootBounds.height) || win.innerHeight;
          if (en.isIntersecting && visibleEnough(en.intersectionRect.height, en.boundingClientRect.height, vh)) {
            io.unobserve(en.target);
            track('section_view', { section_name: en.target.getAttribute('data-track-section') });
          }
        });
      }, { threshold: steps });
      Array.prototype.forEach.call(doc.querySelectorAll('[data-track-section]'), function (s) { io.observe(s); });
    }

    // Profundidad de scroll: 25, 50, 75 y 90 %, cada uno una vez. Solo con scroll real
    // (una página más corta que la pantalla no envía nada).
    var fired = [], ticking = false;
    win.addEventListener('scroll', function () {
      if (ticking || fired.length === SCROLL_THRESHOLDS.length) return;
      ticking = true;
      win.requestAnimationFrame(function () {
        ticking = false;
        var pct = scrollPercent(win.scrollY || win.pageYOffset || 0, win.innerHeight, doc.documentElement.scrollHeight);
        thresholdsToFire(pct, fired).forEach(function (t) {
          fired.push(t);
          track('scroll_depth', { percent: t });
        });
      });
    }, { passive: true });

    // Página de agradecimiento: sin montos ni datos del comprador.
    if (code === 'gracias') track('thankyou_view');
  }

  return {
    EVENT_PARAMS: EVENT_PARAMS,
    SCROLL_THRESHOLDS: SCROLL_THRESHOLDS,
    buildPayload: buildPayload,
    pageCode: pageCode,
    linkKind: linkKind,
    linkDomain: linkDomain,
    scrollPercent: scrollPercent,
    thresholdsToFire: thresholdsToFire,
    visibleEnough: visibleEnough,
    clickEvents: clickEvents,
    createTracker: createTracker,
    init: init
  };
});
