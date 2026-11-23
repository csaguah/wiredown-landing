// Colección "blog": un artículo por archivo src/content/blog/<slug>.md. Si un artículo no cumple
// el esquema, el build falla (y con él `npm test` y el deploy).
//
// Tres capas, en el mismo orden que el frontmatter de los artículos:
//   1. Núcleo: lo que se publica (título, SEO, fechas, categoría, imágenes, código de atribución).
//   2. Marketing: textos para redes y el CTA del artículo. No se muestran en la página salvo primaryCta.
//   3. Salud: citationsVerified, la compuerta YMYL. Solo Carlos lo pasa a true tras revisar las citas.
//
// Publicación (src/lib/blog-rules.mjs): draft: false + citationsVerified: true + publishDate ≤ fecha
// del build en America/Santiago. Lo que no cumple no se genera en producción.
//
// Reglas que miran toda la colección (slug = nombre del archivo, codigo único, enlaces internos a
// artículos que existen) viven en src/lib/blog.ts y también hacen fallar el build.
//
// WD_BLOG_DIR solo lo usan los tests (test/blog.test.js) para construir el sitio con artículos de
// prueba (test/fixtures/blog/…). En el deploy no se define.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import fs from 'node:fs';
import path from 'node:path';

const BLOG_DIR = process.env.WD_BLOG_DIR || './src/content/blog';

// Categorías del blog. Al agregar una, agregar también su etiqueta en src/data/categories.ts
// (si no coinciden, el build falla).
export const CATEGORIES = ['regulacion-nerviosa', 'cuerpo-y-estres'] as const;

// Archivo publicado en public/ (heroImage, ogImage): ruta absoluta del sitio que debe existir.
const publicFile = (re: RegExp, hint: string) =>
  z.string()
    .regex(re, hint)
    .refine(p => fs.existsSync(path.join(process.cwd(), 'public', p)), p => ({ message: `no existe public${p}` }));

const blog = defineCollection({
  // id = nombre del archivo sin .md (no el campo slug): así src/lib/blog.ts puede exigir que coincidan.
  loader: glob({ pattern: '*.md', base: BLOG_DIR, generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z.strictObject({
    // ── Capa 1 · Núcleo ──
    title: z.string().trim().min(1),
    slug: z.string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'solo minúsculas, números y guiones')
      .refine(s => s !== 'categoria', '"categoria" está reservado para /blog/categoria/'),
    description: z.string().trim().min(1),
    seoTitle: z.string().trim().min(1).max(60),
    seoDescription: z.string().trim().min(1).max(160),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean(),
    // El autor de los artículos es siempre Wire Down; Carlos figura como revisor (lo pone el layout).
    author: z.literal('Wire Down'),
    category: z.enum(CATEGORIES),
    tags: z.array(z.string().trim().min(1)),
    heroImage: publicFile(/^\/images\/blog\/[a-z0-9-]+\.(svg|png|jpe?g|webp)$/, 'ruta /images/blog/<archivo>'),
    heroImageAlt: z.string().trim().min(1),
    // Las redes no muestran SVG en las vistas previas: PNG o JPG de 1200×630.
    ogImage: publicFile(/^\/images\/blog\/[a-z0-9-]+\.(png|jpe?g)$/, 'PNG o JPG en /images/blog/ (no SVG)'),
    codigo: z.string().regex(/^a\d{3}$/, 'formato a001'),

    // ── Capa 2 · Marketing ──
    socialHook: z.string().trim().min(1),
    linkedinSummary: z.string().trim().min(1),
    targetAudience: z.string().trim().min(1),
    primaryCta: z.enum(['hacer_test', 'comprar_hotmart']),

    // ── Capa 3 · Salud (compuerta YMYL) ──
    citationsVerified: z.boolean(),
  }).refine(d => !d.updatedDate || d.updatedDate >= d.publishDate, {
    message: 'updatedDate no puede ser anterior a publishDate',
    path: ['updatedDate'],
  }),
});

export const collections = { blog };
