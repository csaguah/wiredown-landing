// Ejecutar desde la raíz del repo con: npm test (hace `astro build` antes, en pretest).
// Atribución de ventas (public/assets/wd-attribution.js): fuente, página de entrada, sck, UTM y
// click ID en los enlaces a pay.hotmart.com, consentimiento de Marketing y parámetros de GA4.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../public/assets/wd-attribution.js');
const E = require('../public/assets/wd-events.js');
const G = require('../public/assets/wd-hotmart-guard.js');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(DIST, f), 'utf8');
const CHECKOUT = 'https://pay.hotmart.com/K105460326C?checkoutMode=2';
const HOST = 'wire-down.com';
const SCK_RE = /^[a-z0-9-]{1,30}$/;

// ── Fuente ─────────────────────────────────────────────────

test('fuente por referrer', () => {
  const r = ref => A.sourceFromReferrer(ref, HOST);
  assert.equal(r(''), 'dr');
  assert.equal(r('https://www.google.com/'), 'go');
  assert.equal(r('https://www.google.cl/'), 'go');
  assert.equal(r('android-app://com.google.android.googlequicksearchbox/'), 'go');
  assert.equal(r('https://www.bing.com/search?q=x'), 'bi');
  assert.equal(r('https://duckduckgo.com/'), 'bi');
  assert.equal(r('https://l.instagram.com/'), 'ig');
  assert.equal(r('https://www.instagram.com/'), 'ig');
  assert.equal(r('https://l.facebook.com/'), 'fb');
  assert.equal(r('https://m.facebook.com/'), 'fb');
  assert.equal(r('https://quiropractica.cl/blog/x/'), 'qc');
  assert.equal(r('https://www.quiropractica.cl/'), 'qc');
  for (const ai of ['https://chatgpt.com/', 'https://www.perplexity.ai/', 'https://copilot.microsoft.com/', 'https://claude.ai/'])
    assert.equal(r(ai), 'ai', ai);
  assert.equal(r('https://ejemplo.org/x'), 'rf');
});

test('gemini.google.com es asistente de IA, no Google orgánico', () => {
  assert.equal(A.sourceFromReferrer('https://gemini.google.com/app', HOST), 'ai');
  assert.equal(A.sourceFromReferrer('https://www.google.com/', HOST), 'go');
  assert.equal(A.sourceFromParams({ utm_source: 'gemini.google.com' }), 'ai');
  assert.equal(A.sourceFromParams({ utm_source: 'google' }), 'go');
});

test('referrer interno (wire-down.com, www, Hotmart) no es una fuente', () => {
  assert.equal(A.sourceFromReferrer('https://wire-down.com/test/', HOST), 'internal');
  assert.equal(A.sourceFromReferrer('https://www.wire-down.com/', HOST), 'internal');
  assert.equal(A.sourceFromReferrer('http://localhost:4321/', 'localhost'), 'internal');
  assert.equal(A.sourceFromReferrer('https://pay.hotmart.com/K105460326C', HOST), 'internal');
});

test('fuente por parámetros', () => {
  assert.equal(A.sourceFromParams({}), null);
  assert.equal(A.sourceFromParams({ gclid: 'x' }), 'ga');
  assert.equal(A.sourceFromParams({ fbclid: 'x' }), 'ma');
  assert.equal(A.sourceFromParams({ gclid: 'x', fbclid: 'y' }), 'ga');
  for (const s of ['meta', 'facebook', 'instagram']) for (const m of ['paid', 'cpc'])
    assert.equal(A.sourceFromParams({ utm_source: s, utm_medium: m }), 'ma', `${s}/${m}`);
  assert.equal(A.sourceFromParams({ utm_source: 'instagram', utm_medium: 'social' }), 'ig');
  assert.equal(A.sourceFromParams({ utm_source: 'facebook', utm_medium: 'social' }), 'fb');
  assert.equal(A.sourceFromParams({ utm_source: 'brevo', utm_medium: 'email' }), 'em');
  assert.equal(A.sourceFromParams({ utm_source: 'quiropractica', utm_medium: 'referral' }), 'qc');
  assert.equal(A.sourceFromParams({ utm_source: 'chatgpt.com' }), 'ai');
  assert.equal(A.sourceFromParams({ utm_source: 'prueba', utm_medium: 'cpc' }), 'ut');
  assert.equal(A.sourceFromParams({ utm_medium: 'email' }), 'em');
});

test('prioridad: gclid manda; después las UTM; fbclid sin UTM → ma', () => {
  assert.equal(A.sourceFromParams({ utm_source: 'instagram', utm_medium: 'bio', fbclid: 'x' }), 'ig');
  assert.equal(A.sourceFromParams({ utm_source: 'meta', utm_medium: 'paid', fbclid: 'x' }), 'ma');
  assert.equal(A.sourceFromParams({ fbclid: 'x' }), 'ma');
  assert.equal(A.sourceFromParams({ utm_source: 'facebook', utm_medium: 'social', fbclid: 'x' }), 'fb');
  assert.equal(A.sourceFromParams({ utm_source: 'quiropractica', fbclid: 'x' }), 'qc');
  assert.equal(A.sourceFromParams({ utm_source: 'brevo', utm_medium: 'email', fbclid: 'x' }), 'em');
  assert.equal(A.sourceFromParams({ utm_source: 'prueba', fbclid: 'x' }), 'ut');
  assert.equal(A.sourceFromParams({ utm_source: 'instagram', utm_medium: 'bio', gclid: 'g' }), 'ga');
  // Con referrer: la bio de Instagram con fbclid sigue siendo ig.
  const s = A.nextState(null, { search: '?utm_source=instagram&utm_medium=bio&fbclid=x', referrer: 'https://l.instagram.com/', host: HOST, entry: 'hm' });
  assert.equal(s.src, 'ig');
});

test('las UTM mandan sobre el referrer', () => {
  const s = A.nextState(null, { search: '?utm_source=brevo&utm_medium=email', referrer: 'https://www.google.com/', host: HOST, entry: 'hm' });
  assert.equal(s.src, 'em');
  const g = A.nextState(null, { search: '?gclid=abc', referrer: 'https://l.instagram.com/', host: HOST, entry: 'hm' });
  assert.equal(g.src, 'ga');
  const r = A.nextState(null, { search: '', referrer: 'https://www.google.com/', host: HOST, entry: 'a003' });
  assert.deepEqual(r, { src: 'go', entry: 'a003', p: {} });
});

test('readParams: solo las 7 claves conocidas y con valor', () => {
  assert.deepEqual(A.readParams('?utm_source=x&utm_medium=&foo=1&gclid=g&email=a@b.c'), { utm_source: 'x', gclid: 'g' });
  assert.equal(A.readParams('?utm_campaign=' + 'a'.repeat(500)).utm_campaign.length, 100);
});

// ── Página de entrada ──────────────────────────────────────

test('códigos de página de entrada', () => {
  assert.equal(A.entryCode('/'), 'hm');
  assert.equal(A.entryCode('/index.html'), 'hm');
  assert.equal(A.entryCode('/test/'), 'ts');
  assert.equal(A.entryCode('/test/index.html'), 'ts');
  assert.equal(A.entryCode('/blog/donde-guarda-tu-cuerpo-el-estres/', 'a003'), 'a003');
  assert.equal(A.entryCode('/blog/'), 'bl');
  assert.equal(A.entryCode('/blog/categoria/regulacion-nerviosa/'), 'bl');
  assert.equal(A.entryCode('/privacidad.html'), 'pv');
  assert.equal(A.entryCode('/no-existe', null, '404'), 'nf');
  assert.equal(A.entryCode('/otra.html'), 'ot');
});

test('la página de entrada sobrevive al paso por /test/ (aunque GTM agregue gclid al enlace interno)', () => {
  let s = A.nextState(null, { search: '?utm_source=prueba&utm_medium=cpc&gclid=abc123', referrer: '', host: HOST, entry: 'hm' });
  assert.deepEqual(s, { src: 'ga', entry: 'hm', p: { utm_source: 'prueba', utm_medium: 'cpc', gclid: 'abc123' } });
  const first = s;
  // /test/ con referrer interno y el gclid que agrega url_passthrough
  s = A.nextState(s, { search: '?gclid=abc123', referrer: 'https://wire-down.com/?utm_source=prueba', host: HOST, entry: 'ts' });
  assert.equal(s, first);
  // vuelta a la home desde el resultado del test
  s = A.nextState(s, { search: '', referrer: 'https://wire-down.com/test/', host: HOST, entry: 'hm' });
  assert.equal(s, first);
  // recarga o atrás hasta la página de entrada (mismo referrer y mismos parámetros): nada cambia
  s = A.nextState(s, { search: '?utm_source=prueba&utm_medium=cpc&gclid=abc123', referrer: '', host: HOST, entry: 'hm' });
  assert.equal(s, first);
  // escribir la URL a mano (sin referrer ni parámetros) tampoco cambia la fuente
  assert.equal(A.nextState(s, { search: '', referrer: '', host: HOST, entry: 'ts' }), first);
});

test('una entrada externa nueva en la misma sesión reemplaza el last-touch', () => {
  const s0 = A.nextState(null, { search: '', referrer: 'https://www.google.com/', host: HOST, entry: 'a003' });
  const s1 = A.nextState(s0, { search: '?utm_source=instagram&utm_medium=paid&utm_campaign=Otoño 2026', referrer: '', host: HOST, entry: 'hm' });
  assert.equal(s1.src, 'ma');
  assert.equal(s1.entry, 'hm');
  assert.equal(s1.p.utm_campaign, 'Otoño 2026');
});

// ── sck ────────────────────────────────────────────────────

test('sck: fuente-entrada-boton[-campaña]', () => {
  assert.equal(A.buildSck('go', 'a003', 'ct'), 'go-a003-ct');
  assert.equal(A.buildSck('ga', 'hm', 'he', 'Lanzamiento_Nov'), 'ga-hm-he-lanzamiento-nov');
  assert.equal(A.buildSck('ma', 'ts', 'st', 'Otoño Ñandú!!'), 'ma-ts-st-otono-nandu');
  assert.equal(A.buildSck('dr', 'hm', 'fi', '___'), 'dr-hm-fi');
});

test('sck: máximo 30 caracteres, la campaña se recorta sin dejar guion final', () => {
  const sck = A.buildSck('ma', 'a003', 'ct', 'campana_de_invierno_para_dolor_de_espalda_2026');
  assert.ok(sck.length <= 30, sck);
  assert.equal(sck, 'ma-a003-ct-campana-de-invierno');
  const cut = A.buildSck('go', 'hm', 'he', 'abcdefghijklmnopqrstu-wxyz'); // corte justo en el guion
  assert.ok(cut.length <= 30 && !cut.endsWith('-'), cut);
  for (const c of ['x'.repeat(200), 'Á É Í Ó Ú '.repeat(10), 'a_b_c_d_e_f_g_h_i_j_k_l_m_n_o_p']) {
    const s = A.buildSck('ga', 'a123', 'xx', c);
    assert.match(s, SCK_RE, s);
  }
});

test('sck: sin guion bajo, solo minúsculas, números y guiones', () => {
  const s = A.buildSck('GA', 'A_01', 'h_e', 'Mi_Campaña_2026');
  assert.ok(!s.includes('_'), s);
  assert.match(s, SCK_RE);
});

test('código de botón por data-cta-location', () => {
  assert.equal(A.buttonCode('hero'), 'he');
  assert.equal(A.buttonCode('final'), 'fi');
  assert.equal(A.buttonCode('sticky'), 'st');
  assert.equal(A.buttonCode('articulo'), 'ct');
  assert.equal(A.buttonCode('resultado'), 'rs');
  assert.equal(A.buttonCode('sin_definir'), 'xx');
  assert.equal(A.buttonCode(''), 'xx');
  const codes = Object.values(A.BUTTON_CODES);
  assert.equal(new Set(codes).size, codes.length, 'códigos de botón repetidos');
  codes.forEach(c => assert.match(c, /^[a-z]{2}$/));
});

// ── URL del checkout ───────────────────────────────────────

const STATE = { src: 'ga', entry: 'hm', p: { utm_source: 'prueba', utm_medium: 'cpc', utm_campaign: 'Nov 2026', gclid: 'abc123', fbclid: 'fb1' } };

test('checkout: conserva checkoutMode=2, agrega sck y las UTM siempre', () => {
  const u = new URL(A.checkoutUrl(CHECKOUT, STATE, 'hero', false));
  assert.equal(u.origin + u.pathname, 'https://pay.hotmart.com/K105460326C');
  assert.equal(u.searchParams.get('checkoutMode'), '2');
  assert.equal(u.searchParams.get('sck'), 'ga-hm-he-nov-2026');
  assert.equal(u.searchParams.get('utm_source'), 'prueba');
  assert.equal(u.searchParams.get('utm_medium'), 'cpc');
  assert.equal(u.searchParams.get('utm_campaign'), 'Nov 2026');
});

test('checkout: fbclid y gclid solo con consentimiento de Marketing', () => {
  const no = new URL(A.checkoutUrl(CHECKOUT, STATE, 'hero', false));
  assert.equal(no.searchParams.get('gclid'), null);
  assert.equal(no.searchParams.get('fbclid'), null);
  const yes = new URL(A.checkoutUrl(CHECKOUT, STATE, 'hero', true));
  assert.equal(yes.searchParams.get('gclid'), 'abc123');
  assert.equal(yes.searchParams.get('fbclid'), 'fb1');
  // Revocar después de haber reescrito con Marketing quita los identificadores.
  const revoked = new URL(A.checkoutUrl(yes.toString(), STATE, 'hero', false));
  assert.equal(revoked.searchParams.get('gclid'), null);
  assert.equal(revoked.searchParams.get('fbclid'), null);
});

test('checkout: reescribir dos veces da lo mismo (sin parámetros duplicados)', () => {
  const once = A.checkoutUrl(CHECKOUT, STATE, 'final', true);
  assert.equal(A.checkoutUrl(once, STATE, 'final', true), once);
  assert.equal(new URL(once).searchParams.getAll('sck').length, 1);
});

test('checkout: sin datos de sesión, sck igual queda válido', () => {
  const u = new URL(A.checkoutUrl(CHECKOUT, null, 'sticky', true));
  assert.equal(u.searchParams.get('sck'), 'dr-ot-st');
  assert.equal(u.searchParams.get('checkoutMode'), '2');
});

test('checkout: no toca enlaces que no son de pay.hotmart.com', () => {
  assert.equal(A.checkoutUrl('https://hotmart.com/es', STATE, 'hero', true), 'https://hotmart.com/es');
  assert.equal(A.checkoutUrl('/test/', STATE, 'hero', true), '/test/');
});

// ── GA4 ────────────────────────────────────────────────────

test('GA4: click_checkout lleva attr_fuente, attr_entrada y attr_boton, nunca UTM ni click ID', () => {
  assert.deepEqual(A.gaParams(STATE, 'hero'), { attr_fuente: 'ga', attr_entrada: 'hm', attr_boton: 'he' });
  const evs = E.clickEvents({
    cta: { name: 'checkout', location: 'hero' },
    link: { href: A.checkoutUrl(CHECKOUT, STATE, 'hero', true), checkoutClass: true, location: 'hero' },
    host: HOST, pageCode: 'guia',
    attr: { ...A.gaParams(STATE, 'hero'), gclid: 'abc123', utm_source: 'prueba' }
  });
  assert.equal(evs.length, 1);
  const p = E.buildPayload(evs[0][0], evs[0][1]);
  assert.equal(p.event, 'click_checkout');
  assert.equal(p.attr_fuente, 'ga');
  assert.equal(p.attr_entrada, 'hm');
  assert.equal(p.attr_boton, 'he');
  for (const k of ['gclid', 'fbclid', 'utm_source', 'utm_campaign', 'sck']) assert.ok(!(k in p), k);
  // Los attr_* solo existen en click_checkout.
  for (const [name, params] of Object.entries(E.EVENT_PARAMS)) {
    if (name !== 'click_checkout') assert.ok(!params.some(x => x.startsWith('attr_')), name);
  }
  // Y se limpian en los demás eventos para que GTM no los arrastre.
  const other = E.buildPayload('cta_click', { cta_name: 'hacer_test', attr_fuente: 'ga' });
  assert.ok('attr_fuente' in other && other.attr_fuente === undefined);
});

// ── Navegador (DOM mínimo) ─────────────────────────────────

function storage(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    has: k => m.has(k)
  };
}

function el(tag, attrs = {}, classes = []) {
  const n = {
    nodeType: 1, tagName: tag, parentNode: null, children: [], attrs,
    classList: { contains: c => classes.includes(c) },
    getAttribute: k => (k in attrs ? attrs[k] : null),
    setAttribute: (k, v) => { attrs[k] = String(v); },
    closest(sel) {
      let p = this;
      const m = sel.match(/^\[([a-z-]+)\]$/) || [];
      while (p) {
        if (m[1] && p.getAttribute && p.getAttribute(m[1]) !== null) return p;
        if (sel === 'a[href]' && p.tagName === 'A' && p.getAttribute('href') !== null) return p;
        p = p.parentNode;
      }
      return null;
    },
    querySelectorAll() {
      const out = [];
      (function walk(x) { x.children.forEach(c => { if (c.tagName === 'A' && /^https:\/\/pay\.hotmart\.com\//.test(c.getAttribute('href') || '')) out.push(c); walk(c); }); })(this);
      return out;
    },
    get isConnected() { let p = this; while (p.parentNode) p = p.parentNode; return p.isRoot === true; },
    get nextSibling() { const s = this.parentNode && this.parentNode.children; return s ? s[s.indexOf(this) + 1] || null : null; },
    get previousSibling() { const s = this.parentNode && this.parentNode.children; return s ? s[s.indexOf(this) - 1] || null : null; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c, ref) {
      if (!ref) return this.appendChild(c);
      c.parentNode = this; this.children.splice(this.children.indexOf(ref), 0, c); return c;
    },
    remove() { const s = this.parentNode.children; s.splice(s.indexOf(this), 1); this.parentNode = null; }
  };
  return n;
}

// Una carga de página: { win, doc, links, observer(records), click(target) }.
function load({ path: pathname = '/', search = '', referrer = '', marketing = false, ss = storage(), ls = storage(), codigo = null, locs = ['hero', 'final', 'sticky'] } = {}) {
  const html = el('HTML'); html.isRoot = true;
  const body = html.appendChild(el('BODY', codigo ? { 'data-codigo': codigo } : {}));
  const links = locs.map(loc => {
    const wrap = body.appendChild(el('DIV', { 'data-cta-location': loc }));
    return wrap.appendChild(el('A', { href: CHECKOUT, 'data-cta-location': loc }, ['hotmart-fb', 'hotmart__button-checkout']));
  });
  let observer = null;
  const listeners = {};
  const doc = {
    readyState: 'complete', referrer, body, documentElement: html,
    querySelectorAll: () => html.querySelectorAll(),
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); }
  };
  const consent = { analytics: true, marketing, ts: Date.now() };
  const win = {
    document: doc,
    location: { pathname, search, hostname: HOST },
    sessionStorage: ss, localStorage: ls,
    wdGetConsent: () => consent,
    MutationObserver: function (cb) { observer = cb; this.observe = () => {}; }
  };
  const api = A.init(win);
  return {
    win, doc, html, body, links, api, consent, ss, ls,
    observer: recs => observer(recs),
    click: target => (listeners.click || []).forEach(fn => fn({ target }))
  };
}
const q = a => new URL(a.getAttribute('href')).searchParams;

test('navegador: los enlaces de la página quedan reescritos al cargar', () => {
  const p = load({ search: '?utm_source=prueba&utm_medium=cpc&gclid=abc123', marketing: true });
  const [hero, final, sticky] = p.links.map(q);
  assert.equal(hero.get('sck'), 'ga-hm-he');
  assert.equal(final.get('sck'), 'ga-hm-fi');
  assert.equal(sticky.get('sck'), 'ga-hm-st');
  assert.equal(hero.get('checkoutMode'), '2');
  assert.equal(hero.get('gclid'), 'abc123');
  assert.equal(hero.get('utm_source'), 'prueba');
});

test('navegador: con Marketing rechazado no aparece el gclid; al aceptar después, sí', () => {
  const p = load({ search: '?utm_source=prueba&utm_medium=cpc&gclid=abc123', marketing: false });
  assert.equal(q(p.links[0]).get('gclid'), null);
  assert.equal(q(p.links[0]).get('utm_medium'), 'cpc');
  p.consent.marketing = true;
  p.api.consentChanged();
  assert.equal(q(p.links[0]).get('gclid'), 'abc123');
  // Cambio sin pasar por el aviso: el clic (fase de captura) vuelve a reescribir antes que el widget.
  p.consent.marketing = false;
  p.click(p.links[1]);
  assert.equal(q(p.links[1]).get('gclid'), null);
});

test('navegador: entrada en un artículo, paso por /test/ y compra en la home → go-a003-…', () => {
  const ss = storage(), ls = storage();
  load({ path: '/blog/donde-guarda-tu-cuerpo-el-estres/', referrer: 'https://www.google.com/', codigo: 'a003', ss, ls, locs: ['articulo'] });
  load({ path: '/test/', search: '?gclid=xyz', referrer: 'https://wire-down.com/blog/donde-guarda-tu-cuerpo-el-estres/', ss, ls, locs: [] });
  const home = load({ path: '/', referrer: 'https://wire-down.com/test/', ss, ls });
  assert.equal(q(home.links[0]).get('sck'), 'go-a003-he');
  assert.equal(q(home.links[0]).get('gclid'), null);
  assert.deepEqual(home.api.gaParams(home.links[2]), { attr_fuente: 'go', attr_entrada: 'a003', attr_boton: 'st' });
});

test('navegador: el enlace que reinserta wd-hotmart-guard.js vuelve ya reescrito', () => {
  const p = load({ search: '?utm_source=prueba&utm_medium=cpc&gclid=abc123', marketing: true });
  const btn = p.links[0];
  const rewritten = btn.getAttribute('href');
  // El widget borra el botón; el guard lo reinserta (mismo nodo, mismos atributos).
  const rec = { target: btn.parentNode, previousSibling: btn.previousSibling, nextSibling: btn.nextSibling, removedNodes: [btn] };
  btn.remove();
  assert.equal(G.handle([rec]), 1);
  assert.ok(btn.isConnected);
  assert.equal(btn.getAttribute('href'), rewritten);
  assert.equal(q(btn).get('sck'), 'ga-hm-he');
  // Un enlace nuevo con el href original (p. ej. un clon) se reescribe al entrar al DOM.
  const clone = el('A', { href: CHECKOUT }, ['hotmart-fb']);
  btn.parentNode.appendChild(clone);
  p.observer([{ addedNodes: [clone] }]);
  assert.equal(q(clone).get('sck'), 'ga-hm-he');
  assert.equal(q(clone).get('gclid'), 'abc123');
});

test('navegador: first-touch en localStorage solo con Marketing; se borra al revocar', () => {
  const ls = storage();
  load({ search: '?utm_source=prueba&utm_medium=cpc&gclid=abc123', marketing: false, ls });
  assert.equal(ls.getItem(A.FIRST_KEY), null);
  const ss = storage();
  const p = load({ search: '?utm_source=brevo&utm_medium=email', marketing: true, ls, ss });
  const first = JSON.parse(ls.getItem(A.FIRST_KEY));
  assert.equal(first.src, 'em');
  assert.equal(first.entry, 'hm');
  // Una visita posterior no lo pisa.
  load({ referrer: 'https://www.google.com/', marketing: true, ls });
  assert.equal(JSON.parse(ls.getItem(A.FIRST_KEY)).src, 'em');
  // Revocar Marketing lo borra; el last-touch de la sesión sigue.
  p.consent.marketing = false;
  p.api.consentChanged();
  assert.equal(ls.getItem(A.FIRST_KEY), null);
  assert.equal(JSON.parse(ss.getItem(A.SESSION_KEY)).src, 'em');
});

test('navegador: last-touch en sessionStorage siempre, aun sin consentimiento', () => {
  const ss = storage();
  load({ search: '?utm_source=prueba&gclid=abc123', marketing: false, ss });
  const s = JSON.parse(ss.getItem(A.SESSION_KEY));
  assert.equal(s.src, 'ga');
  assert.equal(s.p.gclid, 'abc123');
});

// ── Marcado (dist/) ────────────────────────────────────────

const WITH_ATTR = ['index.html', 'test/index.html', 'privacidad.html', '404.html'];

test('las páginas cargan wd-attribution.js sin defer, después de wd-gtm.js y antes del widget', () => {
  for (const f of WITH_ATTR) {
    const html = read(f);
    const gtm = html.indexOf('<script src="/assets/wd-gtm.js"></script>');
    const attr = html.indexOf('<script src="/assets/wd-attribution.js"></script>');
    assert.ok(gtm >= 0 && attr > gtm, f);
    const widget = html.indexOf('static.hotmart.com/checkout/widget.min.js');
    if (widget >= 0) assert.ok(attr < widget, `${f}: antes del widget`);
  }
  assert.ok(!read('gracias.html').includes('wd-attribution.js'), '/gracias.html no es una entrada');
  assert.ok(fs.existsSync(path.join(DIST, 'assets', 'wd-attribution.js')));
});

test('la home ya no copia el query string completo a los enlaces de Hotmart', () => {
  const html = read('index.html');
  assert.ok(!/location\.search/.test(html));
  assert.ok(!/a\[href\*="hotmart"\]/.test(html));
});

test('wd-consent.js avisa a la atribución cuando cambia el consentimiento', () => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'assets', 'wd-consent.js'), 'utf8');
  assert.match(code, /wdAttribution\.consentChanged\(\)/);
});

test('wd-attribution.js no lee texto de la página ni datos del test, ni empuja a dataLayer o Meta', () => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'assets', 'wd-attribution.js'), 'utf8');
  assert.ok(!/textContent|innerText|innerHTML|\.value\b/.test(code));
  assert.ok(!/dataLayer\.push|gtag\(|fbq\(/.test(code));
  assert.ok(!/wd_test|scoring|perfil|profile/i.test(code));
  assert.ok(!/GTM-T9TJMDP3/.test(code));
});
