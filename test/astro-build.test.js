// Ejecutar desde la raíz del repo con: npm test (hace `astro build` antes, en pretest).
// Comprueba que el build de Astro publique lo mismo que el sitio estático anterior.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(DIST, f), 'utf8');
// Las páginas del blog solo existen cuando hay artículos publicados: test/blog.test.js las revisa
// sobre un build con artículos de prueba (.dist-fixtures/ok).
const PAGES = ['index.html', 'test/index.html', 'gracias.html', 'privacidad.html', '404.html'];

test('las URLs de siempre existen en dist/ con el mismo nombre', () => {
  const files = [...PAGES, 'robots.txt', 'CNAME', 'favicon.svg', 'favicon.ico', 'apple-touch-icon.png',
    'test/scoring.js', 'test/test-data.js', 'assets/wd-gtm.js', 'assets/wd-events.js', 'assets/wd-pixel.js',
    'assets/wd-consent.js', 'assets/wd-hotmart-guard.js', 'assets/wd-tokens.css', 'assets/wd-base.css', 'assets/wd-consent.css'];
  for (const f of files) assert.ok(fs.existsSync(path.join(DIST, f)), f);
  assert.equal(read('CNAME').trim(), 'wire-down.com');
});

test('Astro no procesa scripts ni estilos: nada scoped, agrupado ni movido a /_astro/', () => {
  for (const f of PAGES) {
    const html = read(f);
    assert.ok(!html.includes('data-astro-'), `${f}: atributos de Astro (¿<style> sin is:inline?)`);
    assert.ok(!html.includes('/_astro/'), `${f}: archivos agrupados por Astro`);
    assert.ok(!/<script[^>]*type="module"/.test(html), `${f}: script procesado (¿<script> sin is:inline?)`);
    assert.ok(!html.includes('is:inline'), f);
  }
  assert.ok(!fs.existsSync(path.join(DIST, '_astro')), 'dist/_astro no debería existir');
});

test('los estilos de Hotmart quedan globales e intactos en la página de la guía', () => {
  const html = read('index.html');
  for (const rule of ['.hotmart-fb img { display: none !important; }', '.hotmart-fb.btn-primary {', '.hotmart-fb.btn-cta-final {',
    '.sticky-cta .hotmart-fb {', '.hotmart-fb.hotmart__button-checkout {']) assert.ok(html.includes(rule), rule);
});

test('el aviso de cookies es el mismo marcado en todas las páginas que lo llevan', () => {
  const block = f => (read(f).match(/<div class="wd-consent" id="wd-consent"[\s\S]*?\n<\/div>/) || [])[0];
  const ref = block('index.html');
  assert.ok(ref && ref.includes('id="wd-accept"') && ref.includes('id="wd-reject"') && ref.includes('id="wd-save"'));
  for (const f of ['test/index.html', 'privacidad.html', '404.html']) assert.equal(block(f), ref, f);
  // Va antes de wd-consent.js, que lo busca al cargar.
  for (const f of ['index.html', 'test/index.html', 'privacidad.html', '404.html']) {
    const html = read(f);
    assert.ok(html.indexOf('id="wd-consent"') < html.indexOf('<script src="/assets/wd-consent.js"></script>'), f);
  }
  // /gracias.html no muestra aviso (ver docs/medicion.md).
  assert.ok(!read('gracias.html').includes('id="wd-consent"'));
});

test('/gracias.html y /privacidad.html siguen con noindex', () => {
  assert.match(read('gracias.html'), /<meta name="robots" content="noindex, nofollow">/);
  assert.match(read('privacidad.html'), /<meta name="robots" content="noindex">/);
});
