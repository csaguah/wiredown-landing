// Ejecutar desde la raíz del repo con: npm test (hace `astro build` antes, en pretest).
// Blog: esquema, filtro de publicación, rutas, SEO, JSON-LD, CTA, aviso fijo, enlaces y sitemap.
//
// - dist/ (el build real): con los artículos actuales, en borrador, no se genera nada del blog.
// - .dist-fixtures/ok: build con los artículos de prueba de test/fixtures/blog/ok (publicados, en
//   borrador, sin citas verificadas y con fecha futura), para revisar el HTML que se generaría.
// - Casos inválidos: copias de un artículo de prueba con un error cada una; el build debe fallar.
// Los builds de prueba usan WD_BLOG_DIR y WD_OUT_DIR (src/content.config.ts, astro.config.mjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const R = require('../src/lib/blog-rules.mjs');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const FIX = path.join(ROOT, '.dist-fixtures');
const OK_SRC = path.join(__dirname, 'fixtures', 'blog', 'ok');
const OK_OUT = path.join(FIX, 'ok');
const SITE = 'https://wire-down.com';
const ASTRO = path.join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');

function build(blogDir, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  return spawnSync(process.execPath, [ASTRO, 'build'], {
    cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, WD_BLOG_DIR: blogDir, WD_OUT_DIR: outDir, ASTRO_TELEMETRY_DISABLED: '1' },
  });
}

const all = (html, re) => [...html.matchAll(re)].map(m => m[1]);
const meta = (html, attr, name) => all(html, new RegExp(`<meta ${attr}="${name}" content="([^"]*)">`, 'g'));
const jsonLd = html => all(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g).map(s => JSON.parse(s));
const sitemapUrls = dir => {
  const index = fs.readFileSync(path.join(dir, 'sitemap-index.xml'), 'utf8');
  return all(index, /<loc>([^<]*)<\/loc>/g)
    .flatMap(loc => all(fs.readFileSync(path.join(dir, loc.slice(SITE.length + 1)), 'utf8'), /<loc>([^<]*)<\/loc>/g));
};

// ── Build de prueba (una vez para todo el archivo) ─────────

let ok;
test.before(() => {
  const r = build(OK_SRC, OK_OUT);
  assert.equal(r.status, 0, `el build con artículos de prueba falló:\n${r.stdout}\n${r.stderr}`);
  ok = f => fs.readFileSync(path.join(OK_OUT, f), 'utf8');
});

// ── Reglas puras ───────────────────────────────────────────

test('fecha del build en America/Santiago, no en UTC', () => {
  // 02:30 UTC del 24/11 = 23:30 del 23/11 en Chile (UTC−3 en verano).
  assert.equal(R.todayInSantiago(new Date('2026-11-24T02:30:00Z')), '2026-11-23');
  assert.equal(R.todayInSantiago(new Date('2026-11-24T03:30:00Z')), '2026-11-24');
  // Invierno (UTC−4).
  assert.equal(R.todayInSantiago(new Date('2026-06-10T03:30:00Z')), '2026-06-09');
});

test('isPublished: draft false + citationsVerified true + publishDate ≤ hoy', () => {
  const base = { draft: false, citationsVerified: true, publishDate: new Date('2026-11-24') };
  assert.equal(R.isPublished(base, '2026-11-24'), true, 'el mismo día se publica');
  assert.equal(R.isPublished(base, '2026-11-23'), false, 'el día anterior no');
  assert.equal(R.isPublished({ ...base, draft: true }, '2026-12-01'), false);
  assert.equal(R.isPublished({ ...base, citationsVerified: false }, '2026-12-01'), false);
  assert.deepEqual(R.unpublishedReasons({ draft: true, citationsVerified: false, publishDate: new Date('2026-11-26') }, '2026-11-19'),
    ['draft: true', 'citationsVerified: false', 'publishDate 2026-11-26 (futura)']);
});

test('rewriteBlogLinks: publicado → enlace; existe sin publicar → texto; inexistente → error', () => {
  const ctx = {
    from: 'x.md', exists: new Set(['a', 'b']), published: new Set(['a']),
    categories: new Set(['regulacion-nerviosa']), allCategories: new Set(['regulacion-nerviosa', 'cuerpo-y-estres']),
  };
  const html = '<p><a href="/blog/a/">A</a>, <a href="/blog/b/">la <em>B</em></a>, <a href="/test/">test</a>, ' +
    '<a href="/blog/categoria/regulacion-nerviosa/">RN</a>, <a href="/blog/categoria/cuerpo-y-estres/">CE</a>, <a href="/blog/">Blog</a></p>';
  assert.equal(R.rewriteBlogLinks(html, ctx),
    '<p><a href="/blog/a/">A</a>, la <em>B</em>, <a href="/test/">test</a>, ' +
    '<a href="/blog/categoria/regulacion-nerviosa/">RN</a>, CE, <a href="/blog/">Blog</a></p>');
  assert.equal(R.rewriteBlogLinks('<a href="/blog/">Blog</a>', { ...ctx, published: new Set() }), 'Blog', 'sin publicados, /blog/ no existe');
  assert.equal(R.rewriteBlogLinks('<a href="https://wire-down.com/blog/b/#x">B</a>', ctx), 'B');
  assert.throws(() => R.rewriteBlogLinks('<a href="/blog/c/">C</a>', ctx), /no existe en src\/content\/blog/);
  assert.throws(() => R.rewriteBlogLinks('<a href="/blog/a">A</a>', ctx), /barra final/);
  assert.throws(() => R.rewriteBlogLinks('<a href="/blog/categoria/otra/">X</a>', ctx), /categoría que no existe/);
});

test('tagTestLinks: enlaces a /test/ del texto con data-cta hacer_test / articulo_texto; los demás intactos', () => {
  assert.equal(R.tagTestLinks('<a href="/test/">test</a>'), '<a href="/test/" data-cta="hacer_test" data-cta-location="articulo_texto">test</a>');
  assert.equal(R.tagTestLinks('<a href="https://wire-down.com/test/#x">t</a>'),
    '<a href="https://wire-down.com/test/#x" data-cta="hacer_test" data-cta-location="articulo_texto">t</a>');
  const untouched = '<a href="/test/" data-cta="x">t</a> <a href="/testimonios/">t</a> <a href="/blog/test/">t</a> <a href="https://otro.cl/test/">t</a>';
  assert.equal(R.tagTestLinks(untouched), untouched);
});

test('pruneParaSeguir: quita el ítem cuyo único enlace va a un no publicado; sin ítems, sin sección', () => {
  const ctx = { exists: new Set(['a', 'b', 'c']), published: new Set(['a']) };
  const html = '<p>Texto con <a href="/blog/b/">B</a>.</p>\n<h2 id="para-seguir">Para seguir</h2>\n<ul>\n' +
    '<li><a href="/blog/a/">A</a>: publicado.</li>\n<li><a href="/blog/b/">B</a>: borrador.</li>\n' +
    '<li><a href="/test/">Test</a>: siempre.</li>\n<li><a href="/blog/c/">C</a> y <a href="/test/">test</a>: dos enlaces.</li>\n' +
    '</ul>\n<p>Cierre.</p>\n<hr>\n<h3 id="fuentes">Fuentes</h3>\n<ul>\n<li><a href="/blog/b/">B</a></li>\n</ul>';
  const out = R.pruneParaSeguir(html, ctx);
  assert.ok(out.includes('<li><a href="/blog/a/">A</a>: publicado.</li>'));
  assert.ok(!out.includes('B</a>: borrador.'), 'se quita el <li> completo');
  assert.ok(out.includes('<li><a href="/test/">Test</a>: siempre.</li>'));
  assert.ok(out.includes('<a href="/blog/c/">C</a> y <a href="/test/">test</a>'), 'con más de un enlace se deja (rewriteBlogLinks lo pasa a texto)');
  assert.ok(out.startsWith('<p>Texto con <a href="/blog/b/">B</a>.</p>'), 'fuera de «Para seguir» no se toca');
  assert.ok(out.includes('<h3 id="fuentes">Fuentes</h3>\n<ul>\n<li><a href="/blog/b/">B</a></li>'), 'Fuentes no se toca');

  // Todos los ítems llevan a no publicados → sin título ni lista; el cierre se mantiene.
  const solo = '<p>x</p>\n<h2 id="para-seguir">Para seguir</h2>\n<ul>\n<li><a href="/blog/b/">B</a>: uno.</li>\n' +
    '<li><a href="https://wire-down.com/blog/c/">C</a>: dos.</li>\n</ul>\n<p>Cierre.</p>\n<hr>\n<h3 id="fuentes">F</h3>';
  assert.equal(R.pruneParaSeguir(solo, ctx), '<p>x</p>\n<p>Cierre.</p>\n<hr>\n<h3 id="fuentes">F</h3>');
  // Sin cambios si todo está publicado o no hay «Para seguir».
  const all = { exists: ctx.exists, published: ctx.exists };
  assert.equal(R.pruneParaSeguir(solo, all), solo);
  assert.equal(R.pruneParaSeguir('<p>sin sección</p>', ctx), '<p>sin sección</p>');
  // Un slug inexistente no se quita aquí: rewriteBlogLinks hace fallar el build.
  const typo = '<h2 id="para-seguir">P</h2>\n<ul>\n<li><a href="/blog/zz/">Z</a></li>\n</ul>\n';
  assert.equal(R.pruneParaSeguir(typo, ctx), typo);
});

test('splitForCta: antes de «Para seguir»; si no, antes de la línea de «Fuentes»; si no, al final', () => {
  assert.deepEqual(R.splitForCta('<p>a</p><h2 id="para-seguir">P</h2><hr>\n<h3 id="fuentes">F</h3>'),
    ['<p>a</p>', '<h2 id="para-seguir">P</h2><hr>\n<h3 id="fuentes">F</h3>']);
  assert.deepEqual(R.splitForCta('<p>a</p>\n<hr>\n<h3 id="fuentes">F</h3>'), ['<p>a</p>\n', '<hr>\n<h3 id="fuentes">F</h3>']);
  assert.deepEqual(R.splitForCta('<p>a</p>'), ['<p>a</p>', '']);
});

// ── Esquema: un campo inválido hace fallar el build ────────

const BAD_CASES = {
  'seoTitle de más de 60 caracteres': s => s.replace(/^seoTitle: .*$/m, `seoTitle: "${'x'.repeat(61)}"`),
  'seoDescription de más de 160 caracteres': s => s.replace(/^seoDescription: .*$/m, `seoDescription: "${'x'.repeat(161)}"`),
  'categoría fuera del enum': s => s.replace(/^category: .*$/m, 'category: "ansiedad"'),
  'primaryCta fuera del enum': s => s.replace(/^primaryCta: .*$/m, 'primaryCta: "whatsapp"'),
  'codigo con formato inválido': s => s.replace(/^codigo: .*$/m, 'codigo: "A1"'),
  'sin heroImageAlt': s => s.replace(/^heroImageAlt: .*\n/m, ''),
  'citationsVerified como texto': s => s.replace(/^citationsVerified: .*$/m, 'citationsVerified: "sí"'),
  'campo desconocido (typo)': s => s.replace(/^draft: .*$/m, '$&\ndraf: false'),
  'ogImage en SVG': s => s.replace(/^ogImage: .*$/m, 'ogImage: "/images/blog/sistema-nervioso-modo-supervivencia.svg"'),
  'imagen que no existe': s => s.replace(/^heroImage: .*$/m, 'heroImage: "/images/blog/no-existe.svg"'),
  'slug distinto del nombre del archivo': s => s.replace(/^slug: .*$/m, 'slug: "otro-slug"'),
  'enlace a un slug inexistente': s => s.replace('/blog/borrador-test/', '/blog/borrador-tets/'),
};

test('esquema y reglas de colección: cada caso inválido hace fallar el build', () => {
  const src = fs.readFileSync(path.join(OK_SRC, 'publicado-test.md'), 'utf8');
  const others = fs.readdirSync(OK_SRC).filter(f => f !== 'publicado-test.md');
  for (const [name, mutate] of Object.entries(BAD_CASES)) {
    const dir = path.join(FIX, 'src-invalido');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const f of others) fs.copyFileSync(path.join(OK_SRC, f), path.join(dir, f));
    const bad = mutate(src);
    assert.notEqual(bad, src, `${name}: la mutación no cambió nada`);
    fs.writeFileSync(path.join(dir, 'publicado-test.md'), bad);
    const r = build(dir, path.join(FIX, 'invalido'));
    assert.notEqual(r.status, 0, `${name}: el build debió fallar`);
    assert.match(r.stdout + r.stderr, /publicado-test/, `${name}: el error debe señalar el artículo`);
  }
});

test('codigo repetido hace fallar el build', () => {
  const dir = path.join(FIX, 'src-codigo');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(OK_SRC)) {
    const s = fs.readFileSync(path.join(OK_SRC, f), 'utf8');
    fs.writeFileSync(path.join(dir, f), f === 'checkout-test.md' ? s.replace(/^codigo: .*$/m, 'codigo: "a901"') : s);
  }
  const r = build(dir, path.join(FIX, 'invalido'));
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /codigo a901 repetido/);
});

test('los artículos reales cumplen el esquema (el build de dist/ pasó) y sus enlaces internos existen', () => {
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')));
  const dir = path.join(ROOT, 'src', 'content', 'blog');
  const slugs = fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
  for (const s of slugs) {
    const md = fs.readFileSync(path.join(dir, `${s}.md`), 'utf8');
    for (const [, slug] of md.matchAll(/\]\(\/blog\/([a-z0-9-]+)\/\)/g)) assert.ok(slugs.includes(slug), `${s}: /blog/${slug}/`);
  }
});

test('categorías: el enum del esquema y src/data/categories.ts tienen las mismas claves', () => {
  const config = fs.readFileSync(path.join(ROOT, 'src', 'content.config.ts'), 'utf8');
  const cats = fs.readFileSync(path.join(ROOT, 'src', 'data', 'categories.ts'), 'utf8');
  const enumKeys = all(config.match(/CATEGORIES = \[([^\]]*)\]/)[1], /'([^']+)'/g);
  const labelKeys = all(cats.match(/CATEGORY_LABELS = \{([\s\S]*?)\}/)[1], /'([^']+)':/g);
  assert.deepEqual(enumKeys.sort(), labelKeys.sort());
  assert.match(cats, /'regulacion-nerviosa': 'Regulación nerviosa'/);
  assert.match(cats, /'cuerpo-y-estres': 'Cuerpo y estrés'/);
});

// ── Filtro de publicación ──────────────────────────────────

// Estado real de src/content/blog/ según las reglas de publicación de hoy (America/Santiago).
function realArticles() {
  const dir = path.join(ROOT, 'src', 'content', 'blog');
  const today = R.todayInSantiago();
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const fm = fs.readFileSync(path.join(dir, f), 'utf8').split(/^---$/m)[1];
    const get = k => ((fm.match(new RegExp(`^${k}:\\s*"?([^"\\n]*)"?\\s*$`, 'm')) || [])[1] || '').trim();
    const data = { draft: get('draft') === 'false' ? false : true, citationsVerified: get('citationsVerified') === 'true', publishDate: new Date(get('publishDate') + 'T00:00:00Z') };
    return { slug: f.replace(/\.md$/, ''), category: get('category'), published: R.isPublished(data, today) };
  });
}

test('producción (dist/): solo se generan los artículos publicados hoy; la home enlaza al blog solo si hay publicados', () => {
  const arts = realArticles();
  const pub = arts.filter(a => a.published);
  const urls = sitemapUrls(DIST).filter(u => u.includes('/blog'));
  if (!pub.length) {
    assert.ok(!fs.existsSync(path.join(DIST, 'blog')), 'dist/blog no debería existir');
    assert.deepEqual(urls, []);
  } else {
    const cats = [...new Set(pub.map(a => a.category))];
    const expected = [`${SITE}/blog/`, ...pub.map(a => `${SITE}/blog/${a.slug}/`), ...cats.map(c => `${SITE}/blog/categoria/${c}/`)];
    assert.deepEqual([...urls].sort(), expected.sort());
    for (const u of expected) assert.ok(fs.existsSync(path.join(DIST, u.slice(SITE.length + 1), 'index.html')), u);
  }
  for (const a of arts.filter(x => !x.published)) assert.ok(!fs.existsSync(path.join(DIST, 'blog', a.slug)), `${a.slug} no debería generarse`);
  // La home enlaza al blog desde el pie, solo si /blog/ existe. Las demás páginas de siempre, nunca.
  const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const homeLinks = home.match(/<a\b[^>]*href="[^"]*\/blog[^"]*"[^>]*>/g) || [];
  if (pub.length) {
    assert.deepEqual(homeLinks, ['<a href="/blog/" style="color:inherit" data-cta="ver_blog" data-cta-location="footer">']);
    const footer = home.match(/<footer>[\s\S]*?<\/footer>/)[0];
    assert.ok(footer.includes(homeLinks[0]), 'el enlace va en el pie');
  } else {
    assert.deepEqual(homeLinks, []);
  }
  for (const f of ['test/index.html', 'gracias.html', 'privacidad.html', '404.html']) {
    assert.ok(!/href="[^"]*\/blog/.test(fs.readFileSync(path.join(DIST, f), 'utf8')), `${f}: enlace al blog`);
  }
});

test('solo se generan los publicados: draft, citationsVerified false y fecha futura quedan fuera', () => {
  for (const s of ['publicado-test', 'checkout-test']) assert.ok(fs.existsSync(path.join(OK_OUT, 'blog', s, 'index.html')), s);
  for (const s of ['borrador-test', 'sin-citas-test', 'futuro-test']) assert.ok(!fs.existsSync(path.join(OK_OUT, 'blog', s)), s);
  assert.ok(!ok('blog/publicado-test/index.html').includes('BORRADOR'), 'sin franja en producción');
});

test('rutas con barra final: /blog/, /blog/<slug>/ y /blog/categoria/<c>/ solo si tiene publicados', () => {
  assert.ok(fs.existsSync(path.join(OK_OUT, 'blog', 'index.html')));
  assert.ok(!fs.existsSync(path.join(OK_OUT, 'blog.html')));
  assert.ok(fs.existsSync(path.join(OK_OUT, 'blog', 'categoria', 'regulacion-nerviosa', 'index.html')));
  assert.ok(!fs.existsSync(path.join(OK_OUT, 'blog', 'categoria', 'cuerpo-y-estres')), 'categoría sin publicados');
  assert.deepEqual(meta(ok('blog/index.html'), 'property', 'og:url'), [`${SITE}/blog/`]);
  const index = ok('blog/index.html');
  assert.ok(index.includes('href="/blog/publicado-test/"') && index.includes('href="/blog/checkout-test/"'));
  assert.ok(!index.includes('borrador-test') && !index.includes('futuro-test'));
});

test('sitemap: artículos publicados con barra final, sin borradores', () => {
  const urls = sitemapUrls(OK_OUT);
  for (const u of ['/blog/', '/blog/publicado-test/', '/blog/checkout-test/', '/blog/categoria/regulacion-nerviosa/']) {
    assert.ok(urls.includes(`${SITE}${u}`), u);
  }
  assert.ok(!urls.some(u => /borrador|sin-citas|futuro|cuerpo-y-estres/.test(u)), urls.join('\n'));
  assert.ok(urls.every(u => u.endsWith('/')), 'todas con barra final');
});

// ── SEO y JSON-LD ──────────────────────────────────────────

test('SEOHead del artículo: seoTitle, seoDescription, canonical, og:type article y ogImage propio', () => {
  const html = ok('blog/publicado-test/index.html');
  assert.deepEqual(all(html, /<title>([^<]*)<\/title>/g), ['Artículo publicado de prueba']);
  assert.deepEqual(meta(html, 'name', 'description'), ['Descripción SEO del artículo publicado de prueba.']);
  assert.deepEqual(all(html, /<link rel="canonical" href="([^"]*)">/g), [`${SITE}/blog/publicado-test/`]);
  assert.deepEqual(meta(html, 'property', 'og:type'), ['article']);
  const img = `${SITE}/images/blog/sistema-nervioso-modo-supervivencia.png`;
  assert.deepEqual(meta(html, 'property', 'og:image'), [img]);
  assert.deepEqual(meta(html, 'name', 'twitter:image'), [img]);
  assert.deepEqual(meta(html, 'property', 'og:image:type'), ['image/png']);
  assert.deepEqual(meta(html, 'property', 'og:image:alt'), ['Portada de prueba']);
  assert.deepEqual(meta(html, 'name', 'robots'), []);
  // Sin ogImage, SEOHead mantiene la imagen de la guía.
  assert.deepEqual(meta(ok('blog/index.html'), 'property', 'og:image'), [`${SITE}/og/wire-down-og.png`]);
});

test('imágenes OG de los artículos reales: PNG de 1200×630 junto a cada SVG', () => {
  const dir = path.join(ROOT, 'src', 'content', 'blog');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const md = fs.readFileSync(path.join(dir, f), 'utf8');
    const og = md.match(/^ogImage: "([^"]+)"/m)[1];
    const png = fs.readFileSync(path.join(ROOT, 'public', og));
    assert.equal(png.toString('ascii', 1, 4), 'PNG', og);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], og);
  }
});

test('JSON-LD del artículo: autor Organization Wire Down, WebPage revisada por Person Carlos + BreadcrumbList', () => {
  const blocks = jsonLd(ok('blog/publicado-test/index.html'));
  assert.equal(blocks.length, 1);
  const [org, page, post, crumbs] = blocks[0]['@graph'];
  const url = `${SITE}/blog/publicado-test/`;
  assert.deepEqual(org, { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'Wire Down', url: `${SITE}/`, logo: `${SITE}/apple-touch-icon.png` });
  assert.equal(page['@type'], 'WebPage');
  assert.equal(page['@id'], url);
  assert.deepEqual(page.reviewedBy, { '@type': 'Person', name: 'Carlos Sagua H.', jobTitle: 'Kinesiólogo y quiropráctico' });
  assert.equal(page.lastReviewed, '2020-02-01', 'lastReviewed = updatedDate');
  assert.deepEqual(page.breadcrumb, { '@id': `${url}#migas` });
  assert.equal(post['@type'], 'BlogPosting');
  assert.equal(post.headline, 'Artículo publicado de prueba');
  assert.equal(post.description, 'Descripción del artículo publicado de prueba.');
  assert.equal(post.image, `${SITE}/images/blog/sistema-nervioso-modo-supervivencia.png`);
  assert.equal(post.datePublished, '2020-01-15');
  assert.equal(post.dateModified, '2020-02-01');
  assert.equal(post.inLanguage, 'es');
  assert.deepEqual(post.mainEntityOfPage, { '@id': url });
  assert.deepEqual(post.author, { '@id': `${SITE}/#organization` }, 'autor: la Organization de la home');
  assert.deepEqual(post.publisher, { '@id': `${SITE}/#organization` });
  assert.equal(crumbs['@type'], 'BreadcrumbList');
  assert.equal(crumbs['@id'], `${url}#migas`);
  assert.deepEqual(crumbs.itemListElement.map(i => [i.position, i.name, i.item]),
    [[1, 'Inicio', `${SITE}/`], [2, 'Blog', `${SITE}/blog/`], [3, 'Artículo publicado de prueba', url]]);
  // Sin updatedDate, dateModified = datePublished.
  const [, page2, p2] = jsonLd(ok('blog/checkout-test/index.html'))[0]['@graph'];
  assert.equal(p2.dateModified, p2.datePublished);
  assert.equal(page2.lastReviewed, p2.datePublished, 'sin updatedDate, lastReviewed = publishDate');
  const raw = JSON.stringify(blocks);
  for (const banned of ['Physician', 'Medical', 'aggregateRating', '"review":', '"Review"']) assert.ok(!raw.includes(banned), banned);
});

// ── Página del artículo ────────────────────────────────────

test('cabecera: hero con alt, título, firma discreta, fecha y categoría', () => {
  const html = ok('blog/publicado-test/index.html');
  assert.match(html, /<img src="\/images\/blog\/sistema-nervioso-modo-supervivencia\.svg" alt="Portada de prueba"/);
  assert.match(html, /<h1>Artículo publicado de prueba<\/h1>/);
  assert.ok(html.includes('<p class="meta">Wire Down · Revisado por Carlos Sagua H., kinesiólogo y quiropráctico</p>'));
  assert.ok(html.includes('<time datetime="2020-01-15">15 de enero de 2020</time>'));
  assert.ok(html.includes('<a href="/blog/categoria/regulacion-nerviosa/">Regulación nerviosa</a>'));
  assert.ok(html.includes('data-track-section="articulo_autor"'), 'bio al final');
  const bio = html.match(/<section class="author-bio"[\s\S]*?<\/section>/)[0];
  assert.ok(bio.includes('>Sobre la revisión</p>'));
  assert.ok(bio.includes('<p class="author-sign">Revisado por Carlos Sagua H. · Kinesiólogo y quiropráctico</p>'));
  assert.ok(bio.includes('Más de 25 años de experiencia clínica'));
  assert.ok(html.includes('.author-bio .author-label {'), 'la clase de la etiqueta existe');
});

test('«Para seguir»: el ítem que solo lleva a un borrador no se muestra; se activa cuando se publica', () => {
  const html = ok('blog/publicado-test/index.html');
  const seguir = html.match(/<h2 id="para-seguir">[\s\S]*?<\/ul>/)[0];
  assert.ok(!seguir.includes('Un borrador en la lista'), 'el <li> completo se quita');
  assert.ok(seguir.includes('Test orientativo'));
});

test('CTA hacer_test: botón a /test/ con ubicación articulo, antes de «Para seguir», sin Hotmart', () => {
  const html = ok('blog/publicado-test/index.html');
  const ctas = (html.match(/<a\b[^>]*data-cta=[^>]*>/g) || []).filter(a => a.includes('data-cta-location="articulo"'));
  assert.deepEqual(ctas, ['<a href="/test/" class="btn btn-primary" data-cta="hacer_test" data-cta-location="articulo">']);
  const cta = html.indexOf('data-track-section="articulo_cta"');
  assert.ok(html.indexOf('id="cuerpo"') < cta && cta < html.indexOf('id="para-seguir"') && cta < html.indexOf('id="fuentes"'));
  assert.ok(!/hotmart/i.test(html), 'sin checkout no se carga Hotmart');
});

test('CTA comprar_hotmart: checkout con ubicación articulo y wd-hotmart-guard.js antes del widget', () => {
  const html = ok('blog/checkout-test/index.html');
  const links = html.match(/<a\b[^>]*pay\.hotmart\.com[^>]*>/g) || [];
  assert.equal(links.length, 1);
  assert.match(links[0], /href="https:\/\/pay\.hotmart\.com\/K105460326C\?checkoutMode=2"/);
  assert.match(links[0], /data-cta="checkout" data-cta-location="articulo"/);
  assert.match(links[0], /class="hotmart-fb hotmart__button-checkout btn-primary"/);
  const guard = html.indexOf('<script src="/assets/wd-hotmart-guard.js"></script>');
  const widget = html.indexOf('static.hotmart.com/checkout/widget.min.js');
  assert.ok(guard > 0 && widget > guard, 'guard antes del widget');
  assert.ok(html.includes('.hotmart-fb.btn-primary {') && html.includes('.hotmart-fb img { display: none !important; }'));
  assert.ok(html.includes("fbq('track', 'InitiateCheckout'"));
  assert.ok(!html.includes('data-cta="hacer_test"'));
  // Sin «Para seguir» ni «Fuentes», el CTA va justo después del cuerpo.
  assert.ok(html.indexOf('data-track-section="articulo_cuerpo"') < html.indexOf('data-track-section="articulo_cta"'));
  assert.ok(!html.includes('data-track-section="articulo_cierre"'));
});

test('atribución: <body data-codigo> con el codigo del artículo y wd-attribution.js después de wd-gtm.js', () => {
  const pages = { 'blog/checkout-test/index.html': 'a902', 'blog/publicado-test/index.html': null };
  for (const [f, codigo] of Object.entries(pages)) {
    const html = ok(f);
    const gtm = html.indexOf('<script src="/assets/wd-gtm.js"></script>');
    const attr = html.indexOf('<script src="/assets/wd-attribution.js"></script>');
    assert.ok(gtm >= 0 && attr > gtm, f);
    const m = html.match(/<body data-codigo="(a\d{3})">/);
    assert.ok(m, `${f}: falta <body data-codigo>`);
    if (codigo) assert.equal(m[1], codigo);
  }
  const ck = ok('blog/checkout-test/index.html');
  assert.ok(ck.indexOf('wd-attribution.js') < ck.indexOf('static.hotmart.com/checkout/widget.min.js'), 'antes del widget');
  // El índice y las categorías no son artículos: sin data-codigo (entrada «bl»).
  assert.match(ok('blog/index.html'), /<body>/);
});

test('aviso fijo del layout en cada artículo, después del CTA', () => {
  const aviso = 'Este contenido es educativo y no reemplaza la evaluación ni el tratamiento de un profesional de salud. Si tienes síntomas que te preocupan, consulta en forma presencial.';
  for (const s of ['publicado-test', 'checkout-test']) {
    const html = ok(`blog/${s}/index.html`);
    assert.equal(html.split(aviso).length - 1, 1, s);
    assert.ok(html.indexOf(aviso) > html.indexOf('data-track-section="articulo_cta"'), s);
  }
});

test('enlaces a /test/ en el texto del artículo llevan data-cta articulo_texto; el botón del CTA conserva articulo', () => {
  const html = ok('blog/publicado-test/index.html');
  const links = html.match(/<a\b[^>]*href="\/test\/"[^>]*>/g) || [];
  assert.deepEqual(links.sort(), [
    '<a href="/test/" class="btn btn-primary" data-cta="hacer_test" data-cta-location="articulo">',
    '<a href="/test/" data-cta="hacer_test" data-cta-location="articulo_texto">',
  ]);
  // Los .md no traen el atributo: lo pone la plantilla.
  for (const f of fs.readdirSync(path.join(ROOT, 'src', 'content', 'blog'))) {
    assert.ok(!fs.readFileSync(path.join(ROOT, 'src', 'content', 'blog', f), 'utf8').includes('data-cta'), f);
  }
});

test('enlaces a artículos no publicados se muestran como texto; a publicados, como enlace', () => {
  const html = ok('blog/publicado-test/index.html');
  assert.ok(html.includes('<a href="/blog/checkout-test/">otro publicado</a>'));
  assert.ok(html.includes(' y a un borrador.'));
  assert.ok(!html.includes('href="/blog/borrador-test/"'));
  assert.ok(html.includes('enlace a la categoría sin artículos.'), 'categoría sin publicados → texto');
  assert.ok(!html.includes('href="/blog/categoria/cuerpo-y-estres/"'));
  assert.ok(ok('blog/checkout-test/index.html').includes('<a href="/blog/publicado-test/">publicado</a>'));
});

test('el enlace se activa solo cuando el destino se publica', () => {
  const dir = path.join(FIX, 'src-activado');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(OK_SRC)) {
    const s = fs.readFileSync(path.join(OK_SRC, f), 'utf8');
    fs.writeFileSync(path.join(dir, f), f === 'borrador-test.md' ? s.replace(/^draft: true$/m, 'draft: false') : s);
  }
  const out = path.join(FIX, 'activado');
  const r = build(dir, out);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const html = fs.readFileSync(path.join(out, 'blog', 'publicado-test', 'index.html'), 'utf8');
  assert.ok(html.includes('<a href="/blog/borrador-test/">un borrador</a>'));
  assert.ok(html.includes('<li><a href="/blog/borrador-test/">Un borrador en la lista</a>'), '«Para seguir» vuelve a mostrar el ítem');
  assert.ok(fs.existsSync(path.join(out, 'blog', 'categoria', 'cuerpo-y-estres', 'index.html')));
  assert.ok(html.includes('<a href="/blog/categoria/cuerpo-y-estres/">la categoría sin artículos</a>'));
});

test('medición: cada <section> con data-track-section único y página con GTM, eventos, Pixel y aviso de cookies', () => {
  for (const f of ['blog/publicado-test/index.html', 'blog/checkout-test/index.html', 'blog/index.html', 'blog/categoria/regulacion-nerviosa/index.html']) {
    const html = ok(f);
    const tags = html.match(/<section\b[^>]*>/g) || [];
    assert.ok(tags.length > 0, f);
    const names = tags.map(t => (t.match(/data-track-section="([a-z0-9_]+)"/) || [])[1]);
    assert.ok(names.every(Boolean), `${f}: sección sin data-track-section`);
    assert.equal(new Set(names).size, names.length, `${f}: nombres repetidos`);
    const gtm = html.indexOf('<script src="/assets/wd-gtm.js"></script>');
    const ev = html.indexOf('<script src="/assets/wd-events.js" defer></script>');
    assert.ok(gtm >= 0 && ev > gtm && gtm < html.indexOf('<title>'), `${f}: GTM y eventos primero`);
    assert.ok(html.includes('<script src="/assets/wd-pixel.js"></script>'), f);
    assert.ok(html.indexOf('id="wd-consent"') < html.indexOf('<script src="/assets/wd-consent.js"></script>'), f);
    for (const l of ['<link rel="icon" href="/favicon.ico" sizes="32x32">', '<link rel="stylesheet" href="/assets/wd-tokens.css">',
      '<link rel="stylesheet" href="/assets/wd-base.css">', '<link rel="stylesheet" href="/assets/wd-consent.css">']) assert.ok(html.includes(l), `${f}: ${l}`);
    // Astro no procesa scripts ni estilos (is:inline) y no hay <style> dentro del <body>.
    assert.ok(!html.includes('data-astro-') && !html.includes('/_astro/') && !/<script[^>]*type="module"/.test(html), f);
    assert.ok(!/<style/.test(html.slice(html.indexOf('<body'))), `${f}: <style> en el <body>`);
  }
});
