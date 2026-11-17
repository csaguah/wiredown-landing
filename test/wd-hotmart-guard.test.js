// Ejecutar desde la raíz del repo con: node --test "test/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../public/assets/wd-hotmart-guard.js');

// Página del build (dist/); `npm test` corre `astro build` antes (pretest).
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
const CHECKOUT = 'https://pay.hotmart.com/K105460326C?checkoutMode=2';

// DOM mínimo: lo justo para insertBefore/appendChild/remove e isConnected.
function el(tag, attrs = {}, classes = []) {
  const n = {
    nodeType: 1, tagName: tag, parentNode: null, children: [], attrs,
    classList: { contains: c => classes.includes(c) },
    getAttribute: k => (k in attrs ? attrs[k] : null),
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
// Simula node.remove() y devuelve el registro que entregaría un MutationObserver.
function removeWithRecord(node) {
  const rec = { target: node.parentNode, previousSibling: node.previousSibling, nextSibling: node.nextSibling, removedNodes: [node] };
  node.remove();
  return rec;
}
function page() {
  const root = el('HTML'); root.isRoot = true;
  const container = root.appendChild(el('DIV'));
  const price = container.appendChild(el('DIV'));
  const btn = container.appendChild(el('A', { href: CHECKOUT, id: 'cta-hero', 'data-cta-location': 'hero' }, ['hotmart-fb', 'hotmart__button-checkout']));
  const guarantee = container.appendChild(el('P'));
  return { root, container, price, btn, guarantee };
}

test('isCheckoutLink: solo enlaces .hotmart-fb hacia pay.hotmart.com', () => {
  assert.equal(G.isCheckoutLink(el('A', { href: CHECKOUT }, ['hotmart-fb'])), true);
  assert.equal(G.isCheckoutLink(el('A', { href: CHECKOUT }, [])), false);
  assert.equal(G.isCheckoutLink(el('A', { href: 'https://static.hotmart.com/x' }, ['hotmart-fb'])), false);
  assert.equal(G.isCheckoutLink(el('A', { href: 'https://pay.hotmart.com.evil.example/' }, ['hotmart-fb'])), false);
  assert.equal(G.isCheckoutLink(el('DIV', { href: CHECKOUT }, ['hotmart-fb'])), false);
  assert.equal(G.isCheckoutLink({ nodeType: 3 }), false);
});

test('el botón borrado vuelve al mismo lugar y es el mismo nodo', () => {
  const p = page();
  const rec = removeWithRecord(p.btn);
  assert.equal(p.btn.isConnected, false);
  assert.equal(G.handle([rec]), 1);
  assert.deepEqual(p.container.children, [p.price, p.btn, p.guarantee]);
  assert.equal(p.btn.getAttribute('data-cta-location'), 'hero');
});

test('vuelve aunque el hermano siguiente ya no esté (usa el anterior)', () => {
  const p = page();
  const rec = removeWithRecord(p.btn);
  p.guarantee.remove();
  G.handle([rec]);
  assert.deepEqual(p.container.children, [p.price, p.btn]);
});

test('vuelve al final si no queda ningún hermano (botón único, como en .sticky-cta)', () => {
  const root = el('HTML'); root.isRoot = true;
  const sticky = root.appendChild(el('DIV'));
  const btn = sticky.appendChild(el('A', { href: CHECKOUT }, ['hotmart-fb']));
  G.handle([removeWithRecord(btn)]);
  assert.deepEqual(sticky.children, [btn]);
});

test('no toca otros nodos ni un botón que se movió a otra parte', () => {
  const p = page();
  const recP = removeWithRecord(p.guarantee);
  assert.equal(G.handle([recP]), 0);
  assert.equal(p.guarantee.isConnected, false);

  const q = page();
  const rec = removeWithRecord(q.btn);
  q.root.appendChild(q.btn); // movido a propósito
  assert.equal(G.handle([rec]), 0);
  assert.equal(q.btn.parentNode, q.root);
});

test('index.html carga la protección antes del widget de Hotmart y sin defer', () => {
  const guard = html.indexOf('<script src="/assets/wd-hotmart-guard.js"></script>');
  const widget = html.indexOf('importHotmart()');
  assert.ok(guard > 0 && widget > guard);
});

test('los tres botones de checkout siguen igual: clase del widget, checkoutMode=2 y ubicación', () => {
  const links = html.match(/<a\b[^>]*pay\.hotmart\.com[^>]*>/g) || [];
  assert.equal(links.length, 3);
  links.forEach(a => {
    assert.match(a, /class="hotmart-fb hotmart__button-checkout/);
    assert.match(a, /href="https:\/\/pay\.hotmart\.com\/K105460326C\?checkoutMode=2"/);
    assert.match(a, /data-cta-location="(hero|final|sticky)"/);
  });
});

test('los overrides anulan borde, sombras y line-height de hotmart-fb.min.css', () => {
  const rule = (html.match(/\.hotmart-fb\.hotmart__button-checkout\s*\{([^}]*)\}/) || [])[1] || '';
  for (const decl of ['border: none !important', 'box-shadow: none !important', 'text-shadow: none !important', 'line-height: 1.6 !important']) {
    assert.ok(rule.includes(decl), decl);
  }
});
