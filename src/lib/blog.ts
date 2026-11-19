// Acceso único a la colección del blog desde las páginas. Valida lo que el esquema Zod no puede ver
// (reglas sobre toda la colección) y decide qué se genera en este build. Cualquier error aquí hace
// fallar el build: las páginas del blog llaman a getBlog() desde getStaticPaths, que siempre corre.
import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORY_LABELS, type Category } from '../data/categories';
import { isPublished, rewriteBlogLinks, tagTestLinks, todayInSantiago, unpublishedReasons } from './blog-rules.mjs';

export type Post = CollectionEntry<'blog'>;

// En `npm run dev` se ven también los borradores (con la franja BORRADOR). En el build, nunca.
const SHOW_DRAFTS = import.meta.env.DEV;

// Valores del enum `category` del esquema (src/content.config.ts).
import { CATEGORIES } from '../content.config';
const SCHEMA_CATEGORIES: string[] = [...CATEGORIES];

function checkCategories() {
  const labels = Object.keys(CATEGORY_LABELS);
  const missing = SCHEMA_CATEGORIES.filter(c => !labels.includes(c));
  const extra = labels.filter(c => !SCHEMA_CATEGORIES.includes(c));
  if (missing.length || extra.length) {
    throw new Error(`Categorías del blog desalineadas: sin etiqueta en src/data/categories.ts [${missing}], ` +
      `sobran en categories.ts [${extra}]. Agregar o quitar una categoría exige tocar el enum y ese archivo a la vez.`);
  }
}

function checkCollection(all: Post[]) {
  const codigos = new Map<string, string>();
  for (const p of all) {
    if (p.data.slug !== p.id) throw new Error(`blog/${p.id}.md: slug "${p.data.slug}" debe ser igual al nombre del archivo ("${p.id}")`);
    const prev = codigos.get(p.data.codigo);
    if (prev) throw new Error(`blog: codigo ${p.data.codigo} repetido en ${prev}.md y ${p.id}.md`);
    codigos.set(p.data.codigo, p.id);
  }
}

export interface Blog {
  /** Artículos que se generan en este build, del más nuevo al más antiguo. */
  posts: Post[];
  /** Categorías con al menos un artículo generado. */
  categories: Category[];
  /** Motivos por los que un artículo no se publicaría en producción (vacío = publicado). */
  reasons: (p: Post) => string[];
  /** HTML del cuerpo: enlaces a artículos no publicados convertidos en texto y enlaces a /test/ marcados como CTA. */
  html: (p: Post) => string;
}

let cached: Promise<Blog> | undefined;

export function getBlog(): Promise<Blog> {
  return (cached ??= load());
}

async function load(): Promise<Blog> {
  checkCategories();
  const all = await getCollection('blog');
  checkCollection(all);

  const today = todayInSantiago();
  const posts = all
    .filter(p => SHOW_DRAFTS || isPublished(p.data, today))
    .sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime() || a.id.localeCompare(b.id));

  const exists = new Set(all.map(p => p.id));
  const published = new Set(posts.map(p => p.id));
  const categories = SCHEMA_CATEGORIES.filter(c => posts.some(p => p.data.category === c)) as Category[];
  const ctx = { exists, published, categories: new Set<string>(categories), allCategories: new Set(SCHEMA_CATEGORIES) };

  // Se revisan los enlaces de TODOS los artículos, también los no publicados: un slug mal escrito
  // falla hoy y no el día en que el artículo sale.
  const htmlById = new Map<string, string>();
  for (const p of all) {
    htmlById.set(p.id, tagTestLinks(rewriteBlogLinks(p.rendered?.html ?? '', { ...ctx, from: `blog/${p.id}.md` })));
  }

  return {
    posts,
    categories,
    reasons: p => unpublishedReasons(p.data, today),
    html: p => htmlById.get(p.id) ?? '',
  };
}
