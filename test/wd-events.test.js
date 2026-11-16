// Ejecutar desde la raíz del repo con: node --test "test/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../assets/wd-events.js');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ── Lógica pura ────────────────────────────────────────────

test('buildPayload: solo parámetros de la lista blanca y limpia los de otros eventos', () => {
  const p = E.buildPayload('click_checkout', { cta_location: 'hero', page_code: 'guia', email: 'x@y.z', faq_id: 'pago' });
  assert.equal(p.event, 'click_checkout');
  assert.equal(p.cta_location, 'hero');
  assert.equal(p.page_code, 'guia');
  assert.ok(!('email' in p));
  assert.ok('faq_id' in p && p.faq_id === undefined); // se resetea para que GTM no lo arrastre
});

test('buildPayload: los eventos del test y de gracias no admiten ningún parámetro', () => {
  for (const name of ['test_start', 'test_complete', 'test_to_guide', 'thankyou_view']) {
    assert.deepEqual(E.EVENT_PARAMS[name], []);
    const p = E.buildPayload(name, { profile: 'hiperalerta', score: 22, value: 17, cta_name: 'x' });
    const defined = Object.keys(p).filter(k => p[k] !== undefined);
    assert.deepEqual(defined, ['event'], name);
  }
});

test('buildPayload: evento desconocido → null', () => {
  assert.equal(E.buildPayload('TestStarted'), null);
  assert.equal(E.buildPayload('purchase', { value: 17 }), null);
});

test('pageCode', () => {
  assert.equal(E.pageCode('/'), 'guia');
  assert.equal(E.pageCode('/index.html'), 'guia');
  assert.equal(E.pageCode('/test/'), 'test');
  assert.equal(E.pageCode('/test/index.html'), 'test');
  assert.equal(E.pageCode('/gracias.html'), 'gracias');
  assert.equal(E.pageCode('/gracias'), 'gracias');
  assert.equal(E.pageCode('/privacidad.html'), 'privacidad');
  assert.equal(E.pageCode('/blog/respiracion-lenta/'), 'respiracion-lenta');
});

test('linkKind y linkDomain', () => {
  const h = 'wire-down.com';
  assert.equal(E.linkKind('https://pay.hotmart.com/K105460326C?checkoutMode=2', h), 'checkout');
  assert.equal(E.linkKind('https://static.hotmart.com/x.js', h), 'hotmart');
  assert.equal(E.linkKind('https://hotmart.com/es', h), 'hotmart');
  assert.equal(E.linkKind('/test/', h), 'internal');
  assert.equal(E.linkKind('test/', h), 'internal');
  assert.equal(E.linkKind('https://www.wire-down.com/', h), 'internal');
  assert.equal(E.linkKind('https://pubmed.ncbi.nlm.nih.gov/123/', h), 'outbound');
  assert.equal(E.linkKind('https://hotmart.com.evil.example/', h), 'outbound');
  assert.equal(E.linkKind('mailto:soporte@wire-down.com', h), null);
  assert.equal(E.linkKind('#', h), 'internal');
  assert.equal(E.linkDomain('https://www.example.org/ruta?q=secreto'), 'example.org');
});

test('scroll: porcentaje y umbrales sin repetir', () => {
  assert.equal(E.scrollPercent(0, 800, 3200), 25);
  assert.equal(E.scrollPercent(5000, 800, 3200), 100);
  assert.equal(E.scrollPercent(0, 800, 0), 0);
  assert.deepEqual(E.thresholdsToFire(60, []), [25, 50]);
  assert.deepEqual(E.thresholdsToFire(95, [25, 50]), [75, 90]);
  assert.deepEqual(E.thresholdsToFire(95, [25, 50, 75, 90]), []);
});

test('visibleEnough: 50 % de la sección, o de la ventana si la sección es más alta', () => {
  assert.equal(E.visibleEnough(200, 400, 800), true);
  assert.equal(E.visibleEnough(199, 400, 800), false);
  assert.equal(E.visibleEnough(400, 3000, 800), true);  // sección alta: basta media pantalla
  assert.equal(E.visibleEnough(399, 3000, 800), false);
  assert.equal(E.visibleEnough(0, 0, 800), false);      // sección oculta (hidden)
});

// ── Consentimiento y espera de GTM ─────────────────────────

function fakeRoot({ analytics = true, gtm = false } = {}) {
  const timers = [];
  const root = {
    dataLayer: [],
    WD_GTM_ID: 'GTM-T47WBMN9',
    consent: { analytics, marketing: false, ts: 1 },
    wdGetConsent() { return root.consent; },
    setTimeout(fn) { timers.push(fn); },
    runTimers() { while (timers.length) timers.shift()(); }
  };
  if (gtm) root.google_tag_manager = { 'GTM-T47WBMN9': {} };
  return root;
}

test('sin consentimiento de Analítica no se empuja nada', () => {
  const root = fakeRoot({ analytics: false, gtm: true });
  const t = E.createTracker(root);
  assert.equal(t.track('cta_click', { cta_name: 'checkout', cta_location: 'hero' }), false);
  assert.equal(root.dataLayer.length, 0);
});

test('sin decisión guardada (wdGetConsent → null) no se empuja nada', () => {
  const root = fakeRoot({ gtm: true });
  root.consent = null;
  E.createTracker(root).track('scroll_depth', { percent: 25 });
  assert.equal(root.dataLayer.length, 0);
});

test('nada se empuja antes de que GTM cargue; luego se vacía la cola', () => {
  const root = fakeRoot({ gtm: false });
  const t = E.createTracker(root, { maxPolls: 5 });
  t.track('scroll_depth', { percent: 25 });
  assert.equal(root.dataLayer.length, 0);
  assert.equal(t.pending(), 1);
  root.google_tag_manager = { 'GTM-T47WBMN9': {} };
  root.runTimers();
  assert.equal(root.dataLayer.length, 1);
  assert.equal(root.dataLayer[0].event, 'scroll_depth');
  assert.equal(root.dataLayer[0].percent, 25);
});

test('si se revoca mientras espera GTM, la cola se descarta', () => {
  const root = fakeRoot({ gtm: false });
  const t = E.createTracker(root);
  t.track('faq_open', { faq_id: 'pago' });
  root.consent = { analytics: false, marketing: false, ts: 1 };
  root.google_tag_manager = { 'GTM-T47WBMN9': {} };
  root.runTimers();
  assert.equal(root.dataLayer.length, 0);
});

test('si GTM nunca carga (bloqueador), la cola se descarta y no crece', () => {
  const root = fakeRoot({ gtm: false });
  const t = E.createTracker(root, { maxPolls: 3 });
  t.track('scroll_depth', { percent: 25 });
  root.runTimers();
  assert.equal(t.pending(), 0);
  assert.equal(t.track('scroll_depth', { percent: 50 }), false);
  assert.equal(root.dataLayer.length, 0);
});

test('el contenedor equivocado no cuenta como GTM cargado', () => {
  const root = fakeRoot({ gtm: false });
  root.google_tag_manager = { 'GTM-T9TJMDP3': {} };
  E.createTracker(root, { maxPolls: 2 }).track('thankyou_view');
  root.runTimers();
  assert.equal(root.dataLayer.length, 0);
});

// ── Marcado de las páginas ────────────────────────────────

const PAGES = ['index.html', 'test/index.html', 'gracias.html', 'privacidad.html', '404.html'];

test('todas las páginas cargan wd-events.js con defer después de wd-gtm.js', () => {
  for (const f of PAGES) {
    const html = read(f);
    const gtm = html.indexOf('<script src="/assets/wd-gtm.js"></script>');
    const ev = html.indexOf('<script src="/assets/wd-events.js" defer></script>');
    assert.ok(gtm >= 0 && ev > gtm, f);
  }
});

test('todas las páginas enlazan el favicon (ICO, SVG y apple-touch-icon) y los archivos existen', () => {
  const links = ['<link rel="icon" href="/favicon.ico" sizes="32x32">', '<link rel="icon" href="/favicon.svg" type="image/svg+xml">', '<link rel="apple-touch-icon" href="/apple-touch-icon.png">'];
  for (const f of PAGES) for (const l of links) assert.ok(read(f).includes(l), `${f}: ${l}`);
  for (const f of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png']) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
});

test('cada <section> tiene data-track-section, sin nombres repetidos', () => {
  for (const f of ['index.html', 'test/index.html', '404.html']) {
    const tags = read(f).match(/<section\b[^>]*>/g) || [];
    assert.ok(tags.length > 0, f);
    const names = tags.map(t => (t.match(/data-track-section="([a-z0-9_]+)"/) || [])[1]);
    assert.ok(names.every(Boolean), `${f}: sección sin data-track-section`);
    assert.equal(new Set(names).size, names.length, `${f}: nombres repetidos`);
  }
});

test('404.html: noindex, aviso de cookies y CTA con ubicación, sin checkout ni rutas relativas', () => {
  const html = read('404.html');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<body data-page-code="404">/);
  for (const s of ['/assets/wd-pixel.js', '/assets/wd-consent.js']) assert.ok(html.includes(`<script src="${s}"></script>`), s);
  assert.ok(html.includes('id="wd-consent"'));
  assert.ok(!/hotmart/i.test(html), 'la 404 no lleva checkout');
  // GitHub Pages la sirve en cualquier ruta: src y href internos deben ser absolutos.
  const refs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  assert.ok(refs.every(r => /^(\/|#|https:)/.test(r)), refs.filter(r => !/^(\/|#|https:)/.test(r)).join(', '));
  const ctas = html.match(/<a\b[^>]*data-cta=[^>]*>/g) || [];
  assert.equal(ctas.length, 2);
  assert.ok(ctas.every(a => /data-cta-location="404"/.test(a)));
});

test('cada enlace a pay.hotmart.com tiene data-cta y una ubicación válida', () => {
  const valid = ['hero', 'final', 'sticky', 'articulo', 'resultado'];
  const links = read('index.html').match(/<a\b[^>]*pay\.hotmart\.com[^>]*>/g) || [];
  assert.equal(links.length, 3);
  const locs = links.map(a => {
    assert.match(a, /data-cta="checkout"/);
    return (a.match(/data-cta-location="([a-z_]+)"/) || [])[1];
  });
  locs.forEach(l => assert.ok(valid.includes(l), l));
  assert.deepEqual(locs.sort(), ['final', 'hero', 'sticky']);
});

test('cada pregunta frecuente tiene un data-faq único (no el texto)', () => {
  const qs = read('index.html').match(/<div class="faq-q"[^>]*>/g) || [];
  assert.equal(qs.length, 6);
  const ids = qs.map(q => (q.match(/data-faq="([a-z0-9_]+)"/) || [])[1]);
  assert.ok(ids.every(Boolean));
  assert.equal(new Set(ids).size, ids.length);
});

test('el test solo llama a wdTrack/trackGA con un nombre fijo y sin parámetros', () => {
  const html = read('test/index.html');
  const calls = html.match(/trackGA\([^)]*\)/g) || [];
  const used = calls.filter(c => c !== 'trackGA(eventName)').sort();
  assert.deepEqual(used, ["trackGA('test_complete')", "trackGA('test_start')", "trackGA('test_to_guide')"]);
  assert.deepEqual(html.match(/wdTrack\([^)]*\)/g), ['wdTrack(eventName)']);
  const code = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/dataLayer|gtag\(/.test(code), 'el test no debe tocar dataLayer directamente');
  // Los eventos de Meta se mantienen con el mismo nombre.
  assert.match(html, /track\('TestStarted'\)/);
  assert.match(html, /track\('TestCompleted'\)/);
});

test('wd-events.js no usa los identificadores de quiropractica.cl ni lee texto de la página', () => {
  const js = read('assets/wd-events.js');
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!code.includes('GTM-T9TJMDP3'));
  assert.ok(!/textContent|innerText|innerHTML|\.value\b/.test(code));
});

// ── Clics: checkout solo con click_checkout ───────────────

test('clickEvents: en un checkout solo va click_checkout, aunque tenga data-cta', () => {
  const evs = E.clickEvents({
    cta: { name: 'checkout', location: 'hero' },
    link: { href: 'https://pay.hotmart.com/K105460326C?checkoutMode=2', checkoutClass: true, location: 'hero' },
    host: 'wire-down.com', pageCode: 'guia'
  });
  assert.deepEqual(evs, [['click_checkout', { cta_location: 'hero', page_code: 'guia' }]]);
});

test('clickEvents: enlace a pay.hotmart.com sin la clase del widget también es solo click_checkout', () => {
  const evs = E.clickEvents({
    cta: { name: 'checkout', location: 'articulo' },
    link: { href: 'https://pay.hotmart.com/K105460326C', checkoutClass: false, location: 'articulo' },
    host: 'wire-down.com', pageCode: 'respiracion-lenta'
  });
  assert.deepEqual(evs.map(e => e[0]), ['click_checkout']);
  assert.equal(evs[0][1].cta_location, 'articulo');
});

test('clickEvents: CTA interno → cta_click; enlace externo → outbound_click; sin enlace ni CTA → nada', () => {
  assert.deepEqual(E.clickEvents({
    cta: { name: 'hacer_test', location: 'bonos' },
    link: { href: 'https://wire-down.com/test/', checkoutClass: false, location: 'bonos' },
    host: 'wire-down.com', pageCode: 'guia'
  }), [['cta_click', { cta_name: 'hacer_test', cta_location: 'bonos' }]]);
  assert.deepEqual(E.clickEvents({
    cta: null, link: { href: 'https://www.example.org/a?b=c', checkoutClass: false, location: 'sin_definir' },
    host: 'wire-down.com', pageCode: 'guia'
  }), [['outbound_click', { link_domain: 'example.org' }]]);
  assert.deepEqual(E.clickEvents({ cta: { name: 'comenzar_test', location: 'intro' }, link: null, host: 'wire-down.com', pageCode: 'test' }),
    [['cta_click', { cta_name: 'comenzar_test', cta_location: 'intro' }]]);
  assert.deepEqual(E.clickEvents({ cta: null, link: null, host: 'wire-down.com', pageCode: 'guia' }), []);
});

// ── wd-gtm.js: URL limpia en /gracias antes de cargar GTM ──

const vm = require('node:vm');

function runGtm(pathname, search = '', hash = '') {
  const log = [];
  const loc = { pathname, search, hash, hostname: 'wire-down.com' };
  const ctx = {
    location: loc,
    history: {
      replaceState(state, title, url) {
        log.push(['replaceState', url]);
        loc.search = ''; loc.hash = '';
      }
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {
      cookie: '',
      createElement: () => ({}),
      getElementsByTagName: () => [{ parentNode: { insertBefore: (el) => log.push(['gtm', el.src, loc.search]) } }]
    }
  };
  ctx.window = ctx;
  vm.runInNewContext(read('assets/wd-gtm.js'), ctx);
  return log;
}

test('wd-gtm.js: en /gracias.html y /gracias quita query y hash antes de cargar GTM', () => {
  for (const p of ['/gracias.html', '/gracias']) {
    const log = runGtm(p, '?transaction=HP123&name=Ana&email=a%40b.c', '#x');
    assert.deepEqual(log[0], ['replaceState', p], p);
    assert.equal(log[1][0], 'gtm');
    assert.match(log[1][1], /GTM-T47WBMN9/);
    assert.equal(log[1][2], '', 'GTM se carga con la URL ya limpia');
  }
});

test('wd-gtm.js: ninguna otra página se toca (las UTM se conservan)', () => {
  for (const p of ['/', '/index.html', '/test/', '/privacidad.html', '/blog/gracias/', '/gracias.html/otra']) {
    const log = runGtm(p, '?utm_source=quiropractica&utm_medium=referral');
    assert.ok(!log.some(e => e[0] === 'replaceState'), p);
    assert.equal(log[0][0], 'gtm', p);
  }
});

test('wd-gtm.js: /gracias.html sin query no llama a replaceState', () => {
  const log = runGtm('/gracias.html');
  assert.deepEqual(log.map(e => e[0]), ['gtm']);
});
