// @ts-check
import { defineConfig } from 'astro/config';

// Salida estática para GitHub Pages. Objetivo de la migración: el HTML generado en dist/ es el
// mismo que antes de Astro, así que:
// - build.format 'preserve': src/pages/gracias.astro → /gracias.html, test/index.astro → /test/index.html.
// - compressHTML false: no quitar espacios entre etiquetas (cambiaría el espaciado de elementos inline).
// - Todo <script> y <style> de las páginas va con is:inline: Astro no los agrupa, no los minifica,
//   no los hace scoped ni los cambia de lugar (el orden de carga del widget de Hotmart importa).
export default defineConfig({
  site: 'https://wire-down.com',
  output: 'static',
  compressHTML: false,
  build: { format: 'preserve' },
  devToolbar: { enabled: false },
});
