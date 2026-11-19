// Ejecutar desde la raíz del repo con: npm test (hace `astro build` antes, en pretest).
// Metadatos SEO (SEOHead), JSON-LD, sitemap y robots.txt, leídos de dist/ (lo que se publica).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist');
const read = f => fs.readFileSync(path.join(DIST, f), 'utf8');
const SITE = 'https://wire-down.com';

const INDEXABLE = { 'index.html': `${SITE}/`, 'test/index.html': `${SITE}/test/` };
const NOINDEX = { 'gracias.html': 'noindex, nofollow', 'privacidad.html': 'noindex', '404.html': 'noindex' };
const PAGES = [...Object.keys(INDEXABLE), ...Object.keys(NOINDEX)];

const all = (html, re) => [...html.matchAll(re)].map(m => m[1]);
const meta = (html, attr, name) => all(html, new RegExp(`<meta ${attr}="${name}" content="([^"]*)">`, 'g'));
const canonicals = html => all(html, /<link rel="canonical" href="([^"]*)">/g);
const jsonLd = html => all(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g).map(s => JSON.parse(s));
const htmlFiles = (dir = DIST) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? htmlFiles(p) : e.name.endsWith('.html') ? [path.relative(DIST, p)] : [];
});

// ── Canonical y robots ─────────────────────────────────────

test('canonical absoluto con barra final en las páginas indexables, nunca /index.html', () => {
  for (const [f, url] of Object.entries(INDEXABLE)) {
    const html = read(f);
    assert.deepEqual(canonicals(html), [url], f);
    assert.deepEqual(meta(html, 'property', 'og:url'), [url], `${f}: og:url = canonical`);
    assert.ok(!html.includes('index.html"'), `${f}: no debe apuntar a index.html`);
    assert.deepEqual(meta(html, 'name', 'robots'), [], `${f}: sin meta robots`);
  }
});

test('gracias, privacidad y 404 conservan su noindex y no declaran canonical ni og:url', () => {
  for (const [f, robots] of Object.entries(NOINDEX)) {
    const html = read(f);
    assert.deepEqual(meta(html, 'name', 'robots'), [robots], f);
    assert.deepEqual(canonicals(html), [], f);
    assert.deepEqual(meta(html, 'property', 'og:url'), [], f);
  }
});

test('title y description aprobados', () => {
  const titles = {
    'index.html': 'Dolor y tensión asociados al estrés: guía práctica | Wire Down',
    'test/index.html': 'Test de estrés y tensión en el cuerpo (orientativo) | Wire Down',
    'gracias.html': '¡Gracias! — Wire Down',
    'privacidad.html': 'Política de privacidad — Wire Down',
    '404.html': 'Página no encontrada — Wire Down',
  };
  for (const [f, t] of Object.entries(titles)) assert.deepEqual(all(read(f), /<title>([^<]*)<\/title>/g), [t], f);
  assert.deepEqual(meta(read('index.html'), 'name', 'description'),
    ['Herramientas simples para regular tu sistema nervioso cuando el estrés se instala en el cuerpo como dolor o tensión. Ebook, Bitácora y test orientativo.']);
  assert.deepEqual(meta(read('test/index.html'), 'name', 'description'),
    ['10 preguntas para reconocer cómo se expresa el estrés en tu cuerpo y por dónde empezar a regularte. Gratis. Orientativo, no es un diagnóstico.']);
});

// ── Open Graph y Twitter ───────────────────────────────────

test('Open Graph y Twitter card en todas las páginas, con imagen 1200×630 publicada', () => {
  for (const f of PAGES) {
    const html = read(f);
    const title = all(html, /<title>([^<]*)<\/title>/g)[0];
    assert.deepEqual(meta(html, 'property', 'og:title'), [title], f);
    assert.deepEqual(meta(html, 'property', 'og:locale'), ['es_CL'], f);
    assert.deepEqual(meta(html, 'property', 'og:type'), ['website'], f);
    assert.deepEqual(meta(html, 'property', 'og:image'), [`${SITE}/og/wire-down-og.png`], f);
    assert.deepEqual(meta(html, 'name', 'twitter:card'), ['summary_large_image'], f);
    const desc = meta(html, 'name', 'description');
    assert.deepEqual(meta(html, 'property', 'og:description'), desc, `${f}: og:description = description`);
  }
  const png = fs.readFileSync(path.join(DIST, 'og/wire-down-og.png'));
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
});

// ── JSON-LD ────────────────────────────────────────────────

test('JSON-LD de /: Organization, WebSite y la guía (Product + Book) con oferta real, sin valoraciones', () => {
  const html = read('index.html');
  const blocks = jsonLd(html);
  assert.equal(blocks.length, 1);
  const graph = blocks[0]['@graph'];
  const byType = t => graph.find(n => [].concat(n['@type']).includes(t));
  assert.deepEqual(graph.map(n => n['@type']), ['Organization', 'WebSite', ['Product', 'Book']]);
  assert.equal(byType('Organization').email, 'soporte@wire-down.com');
  assert.equal(byType('Organization').url, `${SITE}/`);
  const book = byType('Product');
  assert.equal(book.category, 'Ebook');
  assert.deepEqual(book.brand, { '@type': 'Brand', name: 'Wire Down' });
  assert.equal(book.author.name, 'Carlos Sagua H.');
  assert.equal(book.offers.price, '17.00');
  assert.equal(book.offers.priceCurrency, 'USD');
  assert.equal(book.offers.url, 'https://pay.hotmart.com/K105460326C?checkoutMode=2');
  assert.equal(book.offers.availability, 'https://schema.org/InStock');
  assert.equal(book.author['@type'], 'Person');
  assert.equal(book.author.jobTitle, 'Kinesiólogo y quiropráctico');
  const raw = JSON.stringify(blocks);
  for (const banned of ['aggregateRating', 'review', 'Physician', 'MedicalBusiness', 'Medical']) assert.ok(!raw.includes(banned), banned);
});

test('el nombre del autor aparece en / solo en la firma de «Palabras del autor» y en el JSON-LD', () => {
  const html = read('index.html');
  const ld = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/)[0];
  const rest = html.replace(ld, '');
  assert.equal(rest.split('Sagua').length - 1, 1, 'una sola mención fuera del JSON-LD');
  assert.ok(rest.includes('<p class="author-role author-sign">Carlos Sagua H. · Kinesiólogo y quiropráctico</p>'));
  const author = rest.match(/<section class="author"[\s\S]*?<\/section>/)[0];
  assert.ok(author.includes('Carlos Sagua H.'), 'la firma va dentro de la sección del autor');
  // /gracias.html (pie) y /privacidad.html (responsable del tratamiento, Ley 21.719) ya lo tenían.
  for (const f of ['test/index.html', '404.html']) assert.ok(!read(f).includes('Sagua'), f);
});

test('JSON-LD de /test/: WebPage orientativa, no diagnóstica; las demás páginas no llevan JSON-LD', () => {
  const [page, ...rest] = jsonLd(read('test/index.html'));
  assert.equal(rest.length, 0);
  assert.equal(page['@type'], 'WebPage');
  assert.equal(page.url, `${SITE}/test/`);
  assert.match(page.description, /orientativ/);
  assert.match(page.description, /no es un diagnóstico/);
  for (const f of Object.keys(NOINDEX)) assert.deepEqual(jsonLd(read(f)), [], f);
});

// ── Sitemap y robots.txt ───────────────────────────────────

const sitemapUrls = () => {
  const index = read('sitemap-index.xml');
  return all(index, /<loc>([^<]*)<\/loc>/g).flatMap(loc => {
    assert.ok(loc.startsWith(`${SITE}/`), loc);
    return all(read(loc.slice(SITE.length + 1)), /<loc>([^<]*)<\/loc>/g);
  });
};

test('sitemap: / y /test/ (más las páginas del blog publicadas), con barra final', () => {
  // Las URLs del blog aparecen solas cuando se publica un artículo (test/blog.test.js las revisa).
  const urls = sitemapUrls();
  assert.deepEqual(urls.filter(u => !u.startsWith(`${SITE}/blog/`)).sort(), [`${SITE}/`, `${SITE}/test/`]);
  for (const u of urls) assert.ok(u.endsWith('/'), u);
});

test('sitemap: ninguna página con noindex y cada URL coincide con el canonical de su página', () => {
  const urls = new Set(sitemapUrls());
  for (const f of htmlFiles()) {
    const html = read(f);
    const noindex = meta(html, 'name', 'robots').some(r => r.includes('noindex'));
    const url = `${SITE}/${f.replace(/(^|\/)index\.html$/, '$1')}`;
    if (noindex) assert.ok(!urls.has(url), `${f} tiene noindex y está en el sitemap`);
    else assert.ok(urls.has(url), `${f} es indexable y falta en el sitemap`);
  }
  for (const url of urls) {
    const f = url.slice(SITE.length + 1) + 'index.html';
    assert.deepEqual(canonicals(read(f)), [url], f);
  }
});

test('robots.txt apunta al sitemap que existe y sin pendientes', () => {
  const robots = read('robots.txt');
  assert.deepEqual(all(robots, /^Sitemap: (.*)$/gm), [`${SITE}/sitemap-index.xml`]);
  assert.ok(fs.existsSync(path.join(DIST, 'sitemap-index.xml')));
  assert.ok(!robots.includes('PENDIENTE'));
});
