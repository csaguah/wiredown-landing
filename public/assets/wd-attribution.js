/*
 * Atribución de ventas — Wire Down. Ver docs/medicion.md («Atribución de ventas»).
 * Se incluye sin `defer` en el <head>, justo después de wd-gtm.js (usa wdGetConsent). No va en
 * /gracias.html: la visita viene de Hotmart y no es una entrada nueva.
 *
 * Qué hace:
 * 1. Lee de la URL utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid y gclid.
 *    Last-touch de la sesión en sessionStorage (siempre). First-touch en localStorage solo con
 *    consentimiento de Marketing; si se revoca, se borra.
 * 2. Deduce la fuente de la sesión (código de 2 letras). Las UTM y los click ID mandan sobre el
 *    referrer. Una navegación interna (referrer wire-down.com o Hotmart) nunca cambia lo guardado,
 *    aunque traiga parámetros (GTM con url_passthrough agrega gclid a los enlaces internos).
 * 3. Guarda la página de entrada (primera página de la sesión): hm, ts, el `codigo` del artículo…
 * 4. Reescribe cada enlace a pay.hotmart.com: conserva checkoutMode=2 y agrega
 *    sck=fuente-entrada-boton[-campaña], las UTM y, solo con Marketing, fbclid y gclid.
 *
 * Cuándo se reescribe: el widget de Hotmart lee el href recién al hacer clic (en escritorio
 * fancybox hace $(a).attr('href'); en móvil el clic navega al href). Aun así se reescribe apenas el
 * enlace entra al DOM (MutationObserver desde el <head>, antes del primer pintado), otra vez en
 * DOMContentLoaded, al cambiar el consentimiento y en el clic (fase de captura, antes que el
 * widget). wd-hotmart-guard.js reinserta el mismo nodo, así que vuelve ya reescrito.
 *
 * Nada de esto sale hacia GA4 salvo los tres códigos (attr_fuente, attr_entrada, attr_boton), que
 * wd-events.js agrega a click_checkout. Ni fbclid ni gclid van a GA4. Del test no se lee nada.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root && root.document) { root.wdAttribution = api; api.init(root); }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var AD_KEYS = ['fbclid', 'gclid']; // identificadores de anuncios: solo con Marketing
  var KEYS = UTM_KEYS.concat(AD_KEYS);
  var SESSION_KEY = 'wd_attr';        // sessionStorage: last-touch de la sesión
  var FIRST_KEY = 'wd_attr_first';    // localStorage: first-touch, solo con Marketing
  var SCK_MAX = 30;
  var MAX_VALUE = 100;                // tope por parámetro, para no inflar la URL del checkout
  var OWN_HOSTS = ['wire-down.com'];

  // Código de botón según data-cta-location. Hoy hay checkout en hero, final, sticky y articulo;
  // el resto queda reservado por si algún día llevan un botón de compra.
  var BUTTON_CODES = {
    hero: 'he',
    final: 'fi',
    sticky: 'st',
    articulo: 'ct',
    resultado: 'rs',
    bonos: 'bo',
    intro: 'in',
    articulo_texto: 'tx',
    '404': 'nf'
  };
  var UNKNOWN_BUTTON = 'xx';

  function clean(v) {
    return String(v == null ? '' : v).trim().slice(0, MAX_VALUE);
  }

  // Solo las claves conocidas y con valor.
  function readParams(search) {
    var out = {}, sp;
    try { sp = new URLSearchParams(search || ''); } catch (e) { return out; }
    KEYS.forEach(function (k) {
      var v = clean(sp.get(k));
      if (v) out[k] = v;
    });
    return out;
  }

  function hasAny(p) { return Object.keys(p || {}).length > 0; }

  function bareHost(h) { return String(h || '').toLowerCase().replace(/^www\./, ''); }

  function hostMatches(host, domain) { return host === domain || host.slice(-(domain.length + 1)) === '.' + domain; }

  // Código de un referrer o de un utm_source con forma de dominio o nombre. null si no se reconoce.
  // gemini.google.com va antes que google.
  function classifyName(name) {
    var h = bareHost(name);
    if (!h) return null;
    if (/(^|\.)gemini\.google\.com$|^gemini$/.test(h)) return 'ai';
    if (/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com|perplexity\.ai|copilot\.microsoft\.com|claude\.ai)$/.test(h) ||
        /^(chatgpt|perplexity|copilot|claude)$/.test(h)) return 'ai';
    if (/(^|\.)google\.[a-z.]+$|^google$|googlequicksearchbox/.test(h)) return 'go';
    if (/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|yandex\.[a-z.]+|baidu\.com|search\.brave\.com|qwant\.com)$/.test(h) ||
        /^(bing|duckduckgo|yahoo|ecosia|yandex|baidu|brave|qwant)$/.test(h)) return 'bi';
    if (/(^|\.)instagram\.com$|^(instagram|ig)$/.test(h)) return 'ig';
    if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$|^(facebook|fb)$/.test(h)) return 'fb';
    if (/(^|\.)quiropractica\.cl$|^quiropractica(\.cl)?$/.test(h)) return 'qc';
    return null;
  }

  function isOwnHost(host, ownHost) {
    var h = bareHost(host);
    if (!h) return false;
    if (ownHost && h === bareHost(ownHost)) return true;
    if (OWN_HOSTS.some(function (d) { return hostMatches(h, d); })) return true;
    return hostMatches(h, 'hotmart.com'); // volver desde el checkout no es una entrada nueva
  }

  // Fuente según el referrer: 'internal' (no cambia lo guardado), 'dr' (sin referrer) o un código.
  function sourceFromReferrer(referrer, ownHost) {
    if (!referrer) return 'dr';
    var u;
    try { u = new URL(referrer); } catch (e) { return 'rf'; }
    var host = u.hostname || '';
    if (u.protocol === 'android-app:') {
      if (/googlequicksearchbox/.test(host)) return 'go';
      if (/com\.google\.android\.gm/.test(host)) return 'em';
      return classifyName(host) || 'rf';
    }
    if (isOwnHost(host, ownHost)) return 'internal';
    return classifyName(host) || 'rf';
  }

  // Fuente según los parámetros (null si no hay ninguno). Prioridad:
  // 1. gclid → ga (siempre manda).
  // 2. Con utm_source o utm_medium deciden las UTM: pago en Meta → ma; pago en Google → ga;
  //    utm_source como nombre (instagram → ig, facebook → fb, quiropractica → qc, chatgpt.com → ai…);
  //    utm_medium email → em; fuente desconocida → ut (el nombre de la campaña va en la cola del sck).
  //    Así la bio de Instagram (?utm_source=instagram&utm_medium=bio) queda ig aunque traiga fbclid.
  // 3. fbclid sin UTM → ma.
  function sourceFromParams(p) {
    if (!hasAny(p)) return null;
    var src = String(p.utm_source || '').toLowerCase();
    var med = String(p.utm_medium || '').toLowerCase();
    var paid = /^(cpc|ppc|paid([_-]?(social|search|media|ads?))?)$/.test(med);
    if (p.gclid) return 'ga';
    if (src || med) {
      if (paid && /^(meta|facebook|fb|instagram|ig)$/.test(src)) return 'ma';
      if (paid && /^(google|adwords|google[_-]?ads)$/.test(src)) return 'ga';
      var named = src ? classifyName(src) : null;
      if (named) return named;
      if (med === 'email' || med === 'e-mail' || med === 'newsletter') return 'em';
      return 'ut';
    }
    if (p.fbclid) return 'ma';
    return 'ut'; // solo utm_campaign, utm_content o utm_term
  }

  function same(a, b) {
    var ka = Object.keys(a || {}).sort(), kb = Object.keys(b || {}).sort();
    if (ka.join() !== kb.join()) return false;
    return ka.every(function (k) { return a[k] === b[k]; });
  }

  // Estado nuevo de la sesión a partir del anterior (o null) y de esta carga de página.
  // ctx = { search, referrer, host, entry }. Devuelve { src, entry, p }.
  function nextState(prev, ctx) {
    var p = readParams(ctx.search);
    var ref = sourceFromReferrer(ctx.referrer, ctx.host);
    var touch = null;
    if (ref === 'internal') {
      // Navegación interna: lo guardado se mantiene. Sin nada guardado (pestaña nueva sin
      // sessionStorage), se arma con lo que haya en la URL.
      if (!prev) touch = { src: sourceFromParams(p) || 'dr', p: p };
    } else if (hasAny(p)) {
      touch = { src: sourceFromParams(p), p: p };
    } else if (ref !== 'dr') {
      touch = { src: ref, p: {} };
    } else if (!prev) {
      touch = { src: 'dr', p: {} };
    }
    if (!touch) return prev;
    // Recargar o volver atrás a la página de entrada no es una entrada nueva.
    if (prev && prev.src === touch.src && same(prev.p, touch.p)) return prev;
    return { src: touch.src, entry: ctx.entry, p: touch.p };
  }

  // Página de entrada: hm (home), ts (test), el `codigo` del artículo (a001…), bl (índice o
  // categoría del blog), pv (privacidad), nf (404), gr (gracias), ot (otra).
  function entryCode(pathname, codigo, pageCodeAttr) {
    if (codigo && /^[a-z0-9]{1,8}$/.test(codigo)) return codigo;
    if (pageCodeAttr === '404') return 'nf';
    var p = String(pathname || '/').replace(/index\.html$/, '');
    if (p === '/') return 'hm';
    if (p === '/test/' || p === '/test') return 'ts';
    if (/^\/blog(\/|$)/.test(p)) return 'bl';
    if (/^\/privacidad(\.html)?$/.test(p)) return 'pv';
    if (/^\/gracias(\.html)?$/.test(p)) return 'gr';
    return 'ot';
  }

  function buttonCode(location) {
    return Object.prototype.hasOwnProperty.call(BUTTON_CODES, location) ? BUTTON_CODES[location] : UNKNOWN_BUTTON;
  }

  // Minúsculas, sin tildes; todo lo que no sea letra o número pasa a guion (Hotmart no admite «_»).
  function slugify(s) {
    var t = String(s || '').toLowerCase();
    if (t.normalize) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // sck = fuente-entrada-boton[-campaña], máximo 30 caracteres. La campaña se recorta para caber.
  function buildSck(src, entry, button, campaign) {
    var base = [slugify(src) || 'dr', slugify(entry) || 'ot', slugify(button) || UNKNOWN_BUTTON].join('-').slice(0, SCK_MAX);
    var room = SCK_MAX - base.length - 1;
    var camp = slugify(campaign);
    if (camp && room > 0) {
      camp = camp.slice(0, room).replace(/-+$/, '');
      if (camp) return base + '-' + camp;
    }
    return base;
  }

  function isCheckoutHref(href) {
    return /^https:\/\/pay\.hotmart\.com\//i.test(String(href || ''));
  }

  // URL final del checkout. Parte del href actual: conserva ruta y parámetros propios (checkoutMode)
  // y reemplaza los que maneja este script, así reescribir dos veces da lo mismo.
  function checkoutUrl(href, state, button, marketing) {
    var u;
    try { u = new URL(href); } catch (e) { return href; }
    if (u.hostname.toLowerCase() !== 'pay.hotmart.com') return href;
    var st = state || { src: 'dr', entry: 'ot', p: {} };
    var p = st.p || {};
    ['sck'].concat(KEYS).forEach(function (k) { u.searchParams.delete(k); });
    u.searchParams.set('sck', buildSck(st.src, st.entry, buttonCode(button), p.utm_campaign));
    UTM_KEYS.forEach(function (k) { if (p[k]) u.searchParams.set(k, p[k]); });
    if (marketing) AD_KEYS.forEach(function (k) { if (p[k]) u.searchParams.set(k, p[k]); });
    return u.toString();
  }

  // Lo que wd-events.js agrega a click_checkout. Solo códigos: nada de UTM ni click ID.
  function gaParams(state, button) {
    var st = state || {};
    return { attr_fuente: st.src || 'dr', attr_entrada: st.entry || 'ot', attr_boton: buttonCode(button) };
  }

  // ── Navegador ───────────────────────────────────────────

  function readJSON(storage, key) {
    try { var v = storage && storage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function writeJSON(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function validState(s) {
    return s && typeof s.src === 'string' && typeof s.entry === 'string' && s.p && typeof s.p === 'object' ? s : null;
  }

  function init(win) {
    var doc = win.document;
    var state = null;

    function marketing() {
      if (typeof win.wdGetConsent !== 'function') return false;
      var c = win.wdGetConsent();
      return !!(c && c.marketing === true);
    }

    function session() { try { return win.sessionStorage; } catch (e) { return null; } }
    function local() { try { return win.localStorage; } catch (e) { return null; } }

    // First-touch: se guarda una sola vez y solo con Marketing; sin Marketing se borra.
    function syncFirstTouch() {
      var ls = local();
      if (!ls) return;
      if (!marketing()) { try { ls.removeItem(FIRST_KEY); } catch (e) {} return; }
      if (state && !readJSON(ls, FIRST_KEY)) writeJSON(ls, FIRST_KEY, { src: state.src, entry: state.entry, p: state.p, ts: Date.now() });
    }

    // Se calcula cuando ya existe <body> (data-codigo y data-page-code están ahí).
    function getState() {
      if (state) return state;
      var body = doc.body;
      if (!body) return null;
      var prev = validState(readJSON(session(), SESSION_KEY));
      state = nextState(prev, {
        search: win.location.search,
        referrer: doc.referrer,
        host: win.location.hostname,
        entry: entryCode(win.location.pathname, body.getAttribute('data-codigo'), body.getAttribute('data-page-code'))
      });
      if (state !== prev) writeJSON(session(), SESSION_KEY, state);
      syncFirstTouch();
      return state;
    }

    function ctaLoc(a) {
      var holder = a.closest ? a.closest('[data-cta-location]') : null;
      return holder ? holder.getAttribute('data-cta-location') : '';
    }

    function rewrite(a) {
      if (!a || a.tagName !== 'A' || !isCheckoutHref(a.getAttribute('href'))) return;
      var st = getState();
      if (!st) return;
      var next = checkoutUrl(a.getAttribute('href'), st, ctaLoc(a), marketing());
      if (next !== a.getAttribute('href')) a.setAttribute('href', next);
    }

    function rewriteAll() {
      Array.prototype.forEach.call(doc.querySelectorAll('a[href^="https://pay.hotmart.com/"]'), rewrite);
    }

    // Enlaces nuevos (el parser, el guard que los reinserta o cualquier otro script).
    if ('MutationObserver' in win) {
      new win.MutationObserver(function (records) {
        records.forEach(function (r) {
          Array.prototype.forEach.call(r.addedNodes || [], function (n) {
            if (n.nodeType !== 1) return;
            if (n.tagName === 'A') rewrite(n);
            else if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll('a[href^="https://pay.hotmart.com/"]'), rewrite);
          });
        });
      }).observe(doc.documentElement, { childList: true, subtree: true });
    }

    function ready() { getState(); rewriteAll(); }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready);
    else ready();

    // En el clic, antes que el widget (captura): refleja un cambio de consentimiento reciente.
    doc.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (a) rewrite(a);
    }, true);

    return {
      state: getState,
      // wd-consent.js la llama al guardar una decisión.
      consentChanged: function () { syncFirstTouch(); rewriteAll(); },
      // wd-events.js la llama en click_checkout.
      gaParams: function (el) { return gaParams(getState(), el ? ctaLoc(el) : ''); }
    };
  }

  var api = {
    KEYS: KEYS,
    BUTTON_CODES: BUTTON_CODES,
    SCK_MAX: SCK_MAX,
    SESSION_KEY: SESSION_KEY,
    FIRST_KEY: FIRST_KEY,
    readParams: readParams,
    sourceFromReferrer: sourceFromReferrer,
    sourceFromParams: sourceFromParams,
    nextState: nextState,
    entryCode: entryCode,
    buttonCode: buttonCode,
    slugify: slugify,
    buildSck: buildSck,
    checkoutUrl: checkoutUrl,
    gaParams: gaParams,
    init: function (win) {
      var live = init(win);
      api.state = live.state;
      api.consentChanged = live.consentChanged;
      api.linkParams = live.gaParams;
      return live;
    }
  };
  return api;
});
