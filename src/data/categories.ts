// Etiquetas visibles de las categorías del blog (eyebrow del artículo, índice y página de categoría).
//
// Agregar una categoría exige tocar, en el mismo cambio:
//   1. el enum `category` de src/content.config.ts (el valor que va en el frontmatter, en minúsculas y
//      con guiones: es también el segmento de /blog/categoria/<categoria>/);
//   2. este archivo, con su etiqueta visible.
// Si las dos listas no coinciden, el build falla (src/lib/blog.ts) y también test/blog.test.js.
export const CATEGORY_LABELS = {
  'regulacion-nerviosa': 'Regulación nerviosa',
  'cuerpo-y-estres': 'Cuerpo y estrés',
} as const;

export type Category = keyof typeof CATEGORY_LABELS;
