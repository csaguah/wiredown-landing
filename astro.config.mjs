// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';

// Salida estática para GitHub Pages. Objetivo de la migración: el HTML generado en dist/ es el
// mismo que antes de Astro, así que:
// - build.format 'preserve': src/pages/gracias.astro → /gracias.html, test/index.astro → /test/index.html.
// - compressHTML false: no quitar espacios entre etiquetas (cambiaría el espaciado de elementos inline).
// - Todo <script> y <style> de las páginas va con is:inline: Astro no los agrupa, no los minifica,
//   no los hace scoped ni los cambia de lugar (el orden de carga del widget de Hotmart importa).

// Sitemap (sitemap-index.xml → sitemap-0.xml). Con format 'preserve' la integración entrega URLs
// sin barra final y sin .html ('/test', '/gracias'), así que cada URL se resuelve contra el HTML ya
// escrito en dist/ (el sitemap se genera al final del build):
// - carpeta con index.html → URL con barra final ('/test/'), la misma del canonical;
// - cualquier página cuyo HTML lleve <meta name="robots" content="noindex…"> queda fuera
//   (gracias, privacidad, 404 y toda página nueva con <SEOHead noIndex>).
const DIST = new URL('./dist/', import.meta.url);
const resolvePage = (/** @type {string} */ page) => {
  const u = new URL(page);
  const p = u.pathname.replace(/^\/+|\/+$/g, ''); // '' para la portada, 'test', 'gracias'…
  const candidates = p ? [[`${p}/index.html`, `/${p}/`], [`${p}.html`, `/${p}.html`]] : [['index.html', '/']];
  for (const [file, pathname] of candidates) {
    const f = new URL(file, DIST);
    if (fs.existsSync(f)) return { html: fs.readFileSync(f, 'utf8'), url: new URL(pathname, u).href };
  }
  return null;
};
const isNoIndex = (/** @type {string} */ html) => /<meta name="robots" content="[^"]*noindex/.test(html);

export default defineConfig({
  site: 'https://wire-down.com',
  output: 'static',
  compressHTML: false,
  build: { format: 'preserve' },
  devToolbar: { enabled: false },
  integrations: [
    sitemap({
      filter: page => {
        const r = resolvePage(page);
        return !!r && !isNoIndex(r.html);
      },
      serialize: item => {
        const r = resolvePage(item.url);
        return r ? { ...item, url: r.url } : undefined;
      },
    }),
  ],
});
