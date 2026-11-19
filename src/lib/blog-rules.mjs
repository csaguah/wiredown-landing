// Reglas del blog como funciones puras: las usan las páginas (vía src/lib/blog.ts) y los tests de
// Node (test/blog.test.js) sin pasar por Astro. JavaScript plano a propósito: Node lo carga con require().

const TZ = 'America/Santiago';

/** Fecha de hoy en Chile como 'YYYY-MM-DD' (la fecha del build que decide qué se publica). */
export function todayInSantiago(now = new Date()) {
  // en-CA formatea como 2026-11-24.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** 'YYYY-MM-DD' de una fecha del frontmatter. YAML lee `2026-11-24` como medianoche UTC. */
export function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

/** Motivos por los que un artículo no se publica (lista vacía = se publica). */
export function unpublishedReasons(data, today) {
  const reasons = [];
  if (data.draft !== false) reasons.push('draft: true');
  if (data.citationsVerified !== true) reasons.push('citationsVerified: false');
  if (dateKey(data.publishDate) > today) reasons.push(`publishDate ${dateKey(data.publishDate)} (futura)`);
  return reasons;
}

/** draft: false + citationsVerified: true + publishDate ≤ hoy en Chile. */
export function isPublished(data, today) {
  return unpublishedReasons(data, today).length === 0;
}

const BLOG_LINK = /<a\s+href="(?:https:\/\/wire-down\.com)?(\/blog\/[^"#]*)(#[^"]*)?"([^>]*)>([\s\S]*?)<\/a>/g;

/**
 * Enlaces internos al blog dentro del HTML de un artículo.
 * - /blog/<slug>/ de un artículo publicado → se deja igual.
 * - /blog/<slug>/ de un artículo que existe pero no está publicado → solo el texto, sin enlace.
 *   Se activa solo en el primer build después de que el destino se publique.
 * - /blog/ y /blog/categoria/<c>/ → enlace solo si esa página existe (hay artículos publicados).
 * - Cualquier otra ruta /blog/… (slug inexistente, sin barra final) → error: el build falla.
 *
 * @param {string} html
 * @param {{ from: string, exists: Set<string>, published: Set<string>, categories: Set<string>, allCategories: Set<string> }} ctx
 *   exists: todos los slugs de src/content/blog/; published: los que se generan en este build;
 *   categories: categorías con al menos un artículo generado; allCategories: las del esquema.
 */
export function rewriteBlogLinks(html, { from, exists, published, categories, allCategories }) {
  return html.replace(BLOG_LINK, (whole, route, _hash, _attrs, text) => {
    let live;
    let m;
    if (route === '/blog/') live = published.size > 0;
    else if ((m = route.match(/^\/blog\/categoria\/([a-z0-9-]+)\/$/))) {
      if (!allCategories.has(m[1])) throw new Error(`${from}: enlace a una categoría que no existe: ${route}`);
      live = categories.has(m[1]);
    } else if ((m = route.match(/^\/blog\/([a-z0-9-]+)\/$/))) {
      if (!exists.has(m[1])) throw new Error(`${from}: enlace a un artículo que no existe en src/content/blog/: ${route}`);
      live = published.has(m[1]);
    } else {
      throw new Error(`${from}: ruta de blog inválida ${route} (¿falta la barra final?)`);
    }
    return live ? whole : text;
  });
}

/**
 * Enlaces a /test/ escritos dentro del texto del artículo (Markdown): se marcan como CTA para que
 * wd-events.js envíe cta_click { cta_name: hacer_test, cta_location: articulo_texto }. Se hace aquí
 * y no a mano en los .md. Un enlace que ya trae data-cta no se toca.
 */
export function tagTestLinks(html) {
  return html.replace(/<a href="((?:https:\/\/wire-down\.com)?\/test\/(?:[?#][^"]*)?)"(?![^>]*data-cta)([^>]*)>/g,
    '<a href="$1"$2 data-cta="hacer_test" data-cta-location="articulo_texto">');
}

/**
 * Divide el HTML del artículo donde va el CTA: antes de «Para seguir»; si no hay, antes de
 * «Fuentes» (incluida la línea horizontal que la precede); si tampoco, al final.
 * @returns {[string, string]}
 */
export function splitForCta(html) {
  const candidates = [
    /<h2 id="para-seguir">/,
    /<hr>\s*<h[23] id="fuentes">/,
    /<h[23] id="fuentes">/,
  ];
  for (const re of candidates) {
    const m = re.exec(html);
    if (m) return [html.slice(0, m.index), html.slice(m.index)];
  }
  return [html, ''];
}

/** '24 de noviembre de 2026' */
export function formatDate(d) {
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
