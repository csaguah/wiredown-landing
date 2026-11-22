# CLAUDE.md — wire-down.com (repo `csaguah/wiredown-landing`)

Reglas de trabajo para Claude Code en este repositorio. Si una regla resulta equivocada, se corrige aquí en el mismo PR.

## Qué es este sitio

- Wire Down es un **producto educativo digital** sobre regulación del sistema nervioso para personas con dolor y tensión asociados al estrés. **No es un servicio clínico ni de salud mental.** Todo el copy respeta ese alcance.
- Objetivo primario del sitio: **posicionamiento orgánico** mediante artículos calendarizados, y **medición** suficiente para ajustar ese objetivo.
- Embudo: artículo → `/test/` (test orientativo, no validado) → página de la guía (`/`) → checkout de Hotmart. El tráfico frío va al test o a un artículo, **no directo al checkout**.
- Idioma: español neutro latinoamericano, tuteo. Sin voseo ni modismos argentinos o españoles.

## Estética: no se rediseña

- La estética de la landing actual **se mantiene tal cual**: paleta (`--verde #2D5A3D`, `--dorado #C8A84B`, sage, tierra, beige), tipografía Lora + DM Sans, botones, espaciados y tono.
- De quiropractica.cl se replican la **estructura técnica, la medición y el formato editorial**, nunca su diseño (navy, cobre, Cormorant).
- Cualquier página nueva (blog, artículo, 404) reutiliza las variables de `public/assets/wd-tokens.css` y las clases que ya existen en `src/pages/index.astro`. Nada de colores sueltos.
- Una migración o refactor se considera correcto solo si la página se ve **idéntica** antes y después (comparar capturas en móvil y escritorio).

## Aislamiento respecto de quiropractica.cl

Wire Down y quiropractica.cl son negocios separados a propósito. Se replica el **formato**, nunca los identificadores.

- GTM de Wire Down: `GTM-T47WBMN9`. **Nunca** `GTM-T9TJMDP3` (es de quiropractica.cl).
- Meta Pixel de Wire Down: `4406846419603179`.
- No copiar teléfonos, Place ID, schema `MedicalBusiness`, códigos de atribución ni textos de quiropractica.cl.
- Enlazar desde quiropractica.cl hacia aquí está bien (con UTM); compartir infraestructura, no.

## Repositorio público

Este repo es **público**. Por eso:

- Nada de secretos, tokens, correos personales ni datos de clientes en archivos versionados.
- Los archivos de planificación (`*_YYYYMMDD.md`, briefs, notas) viven **fuera del repo** o en rutas ignoradas por `.gitignore`.
- `git add` siempre con rutas explícitas. Nunca `git add -A` ni `git add .`.

## URLs que no se pueden romper

- `/` (página de la guía), `/test/`, `/gracias.html` (página de agradecimiento configurada en Hotmart) y `/privacidad.html` deben seguir respondiendo en la misma URL tras cualquier migración.
- `/gracias.html` y `/privacidad.html` mantienen `noindex` y quedan fuera del sitemap.
- Los enlaces de checkout `https://pay.hotmart.com/K105460326C?checkoutMode=2` y el widget de Hotmart deben seguir funcionando igual.
- El dominio personalizado (`wire-down.com`) está en Settings → Pages → Custom domain, con «Enforce HTTPS». `public/CNAME` se mantiene por compatibilidad, pero con el deploy por GitHub Actions manda lo que diga Settings. El DNS está en Squarespace: no se delega a otro proveedor ni se tocan los registros MX ni los A/CNAME del sitio. Agregar un registro TXT de verificación (Search Console) sí está permitido; lo hace Carlos a mano.
- Correo de contacto único en todo el sitio: `soporte@wire-down.com`.

## Privacidad y consentimiento (Ley 21.719 y GDPR)

- Nada que mida o rastree se carga sin consentimiento. Consent Mode v2 con todo en `denied` por defecto.
- La clave de consentimiento actual es `wd_consent` en `localStorage`. Si se cambia el formato, migrar el valor antiguo en vez de volver a preguntar a quien ya decidió.
- **Las respuestas y el perfil del test nunca salen del navegador hacia GA4, GTM ni Meta.** Solo se envían eventos sin parámetros. Esta regla ya está en `src/pages/test/index.astro` y se mantiene.
  - En Meta: `TestStarted` y `TestCompleted` (`trackCustom`). Se mantienen con esos nombres; no se renombran.
  - En dataLayer/GA4: `test_start` y `test_complete`. Conviven con los de Meta.
- Sin email capture hasta que exista el formulario con casilla de consentimiento separada y sin marcar (pendiente, fuera de esta etapa).

## Contenido del blog (YMYL)

### Regla editorial

- Los artículos NO entregan material del libro. El blog entrega: conceptos y mecanismos con fuentes publicadas; cómo reconocer el patrón, en palabras propias; las vías de regulación en principio (qué y por qué); señales de alarma y cuándo consultar. El libro se reserva: ejercicios, protocolos y sus pasos; tests y autoevaluaciones; secuencia, progresión y ruta por perfil; casos clínicos y bitácora.
- Si un artículo incluye una acción concreta, debe ser una que no esté en el libro y que tenga evidencia publicada (ejemplo: el suspiro cíclico, Balban et al., 2023).
- Enfoque: estrés crónico y su expresión en el cuerpo (tensión, dolor, fatiga). La ansiedad aparece solo como derivación, no como eje.
- El CTA por defecto de un artículo es el test orientativo (`primaryCta: "hacer_test"`): el tráfico frío va al test, no al checkout.
- Se mantienen: niveles epistémicos separados, relaciones observacionales como asociación y no causa, sin promesas de curación, señales de alarma en cada artículo, citas verificadas antes de publicar (`citationsVerified: true` solo tras revisión humana de Carlos).
- El ángulo cortisol–metabolismo–peso en mujeres 40+ no se usa como gancho de artículos.
- 2 o 3 enlaces internos por artículo, con slugs confirmados.
- Sin metacomentarios sobre la honestidad del texto.
- Referencias en formato APA (el que ya usan los artículos), verificadas contra PubMed o PMC.
- Los artículos se escriben en neutro por construcción: sin adjetivos ni participios con marca de género referidos al lector («agotada», «cansado», «preocupada»). Se reformula la frase («cuando el cansancio no se va», «si llevas meses con tensión»), sin «/a», «@», «x» ni «todos y todas».
- Las situaciones frecuentes en mujeres (carga mental, cuidar a otros, doble jornada) se mantienen como ejemplos, sin decir que el lector es mujer.
- El femenino se permite solo en `targetAudience`, `socialHook`, anuncios y redes, nunca en el cuerpo del artículo ni en `title`, `description`, `seoTitle` o `seoDescription`.

### Esquema de los artículos (tres capas)

Cada artículo es `src/content/blog/<slug>.md`, validado por el schema Zod de `src/content.config.ts`. Si un campo no cumple, o sobra un campo desconocido, **el build falla** (y con él `npm test` y el deploy).

1. **Núcleo:** `title`, `slug` (igual al nombre del archivo), `description`, `seoTitle` (máx. 60), `seoDescription` (máx. 160), `publishDate`, `updatedDate` (opcional, no anterior a `publishDate`), `draft`, `author`, `category` (enum), `tags`, `heroImage` y `ogImage` (deben existir en `public/`; `ogImage` en PNG o JPG de 1200×630, nunca SVG), `heroImageAlt` (obligatorio), `codigo` (`a001`…, único; página de entrada de la atribución: va en `<body data-codigo>`, en el `sck` y en `attr_entrada` de `click_checkout`; ver `docs/medicion.md`).
2. **Marketing:** `socialHook`, `linkedinSummary`, `targetAudience`, `primaryCta` (`"hacer_test"` | `"comprar_hotmart"`).
3. **Salud:** `citationsVerified` (compuerta YMYL).

Reglas sobre toda la colección (`src/lib/blog.ts`, también hacen fallar el build): `slug` = nombre del archivo, `codigo` único, y todo enlace `/blog/<slug>/` dentro de un artículo apunta a un slug que existe en `src/content/blog/` (un slug mal escrito es un error).

### Cómo se publica un artículo

- Los artículos del blog se publican **los domingos**: `publishDate` siempre es un domingo.
- En producción solo se genera un artículo con **`draft: false` + `citationsVerified: true` + `publishDate` ≤ fecha del build en America/Santiago**. Lo demás no se genera: no tiene URL ni entra al sitemap.
- Un artículo con fecha futura **sale solo ese día**: el workflow de deploy corre también a diario a las 09:17 UTC (06:17 de Chile en horario de verano) sobre `main`. Basta con mergear el artículo listo (`draft: false`, `citationsVerified: true`) antes de su fecha.
- Un enlace a `/blog/<slug>/` cuyo artículo todavía no se publica se muestra como texto normal y se convierte en enlace solo en el primer build después de que el destino se publique. Lo mismo para `/blog/` y `/blog/categoria/<categoria>/`.
- Mientras no haya artículos publicados, `/blog/` no se genera y ningún enlace apunta al blog. `/blog/categoria/<categoria>/` existe solo si esa categoría tiene artículos publicados.
- En `npm run dev` se ven también los borradores, con una franja «BORRADOR» que dice por qué no se publicarían (y con `noindex`).
- Imagen OG: `public/images/blog/<slug>.png` a 1200×630, generada desde la SVG con Chrome headless.

### Cómo agregar una categoría

Tocar a la vez, en el mismo cambio: el arreglo `CATEGORIES` de `src/content.config.ts` (valor en minúsculas con guiones; es también el segmento de `/blog/categoria/<categoria>/`) y `src/data/categories.ts` (etiqueta visible). Si no coinciden, el build falla y también `test/blog.test.js`.

### Qué pone el layout (los artículos no lo traen)

`src/layouts/BlogPostLayout.astro`: hero, categoría, título, firma discreta «Carlos Sagua H. · Kinesiólogo y quiropráctico» (texto fijo; el campo `author` solo se valida) y fecha; CTA según `primaryCta` antes de «Para seguir»/«Fuentes» (o al final del cuerpo); aviso fijo «Este contenido es educativo y no reemplaza la evaluación ni el tratamiento de un profesional de salud. Si tienes síntomas que te preocupan, consulta en forma presencial.»; bio breve (`src/components/AuthorBio.astro`). JSON-LD `BlogPosting` + `BreadcrumbList`, con el autor como `Person`, nunca `Physician`. Los enlaces a `/test/` dentro del cuerpo reciben `data-cta="hacer_test" data-cta-location="articulo_texto"` al procesar el HTML (no se escriben a mano en los `.md`).

### Pendientes del blog

- Enlace al blog desde la home: cuando se publique el primer artículo (mientras no haya publicados, ninguna página enlaza al blog).

## Flujo de trabajo

1. Antes de planificar, **leer el código real**. No asumir nombres de campos ni rutas.
2. Rama corta (≤ 28 caracteres): `art/<tema>`, `feat/<tema>`, `fix/<tema>`.
3. Tests sin errores antes de cada commit: `npm test` (ver «Build, tests y deploy»).
4. Detenerse y pedir confirmación antes de cada commit, push, PR y merge.
5. Commit con `Co-Authored-By: Claude <noreply@anthropic.com>`.
6. Un PR por tema, squash merge. Nunca hacer merge sin que Carlos lo apruebe.
7. Tras el merge: verificar en producción (iPhone y pestaña privada), pedir indexación en Search Console con la URL con barra final, borrar la rama local y remota.

## Build, tests y deploy (Astro)

El sitio es Astro 6 con salida estática (`astro.config.mjs`: `build.format: 'preserve'`, `compressHTML: false`). Node ≥ 22.12 (se usa 24).

- `npm install` una vez. `npm run dev` para trabajar (http://localhost:4321), `npm run build` genera `dist/`, `npm run preview` sirve `dist/`.
- `npm test` corre `astro build` (en `pretest`) y luego `node --test "test/*.test.js"`. Los tests de marcado leen `dist/`, lo que se publica; los de lógica leen `public/assets/` y `public/test/`. Las comillas importan: en Node 24, `node --test test/` falla porque toma la carpeta como módulo.
- Deploy: `.github/workflows/deploy.yml` (workflow oficial de Astro). Cada push a `main` corre `npm test` y, si pasa, publica `dist/` en GitHub Pages. Además corre a diario a las 09:17 UTC (`schedule`) para publicar los artículos que llegan a su fecha. Settings → Pages → Source: **GitHub Actions**. Solo `main` puede publicar (regla del entorno `github-pages`).
- `.nojekyll` ya no hace falta: con Actions no corre Jekyll.

Estructura:

- `src/pages/` → páginas. Con `format: 'preserve'`, `src/pages/gracias.astro` → `/gracias.html`, `src/pages/test/index.astro` → `/test/` y `src/pages/404.astro` → `/404.html`.
- Blog: `src/content/blog/*.md` (artículos), `src/content.config.ts` (schema), `src/data/categories.ts` (etiquetas), `src/lib/blog.ts` y `src/lib/blog-rules.mjs` (publicación y enlaces), `src/layouts/BlogBase.astro` y `BlogPostLayout.astro`, y las rutas `src/pages/blog/[slug]/index.astro` → `/blog/<slug>/`, `src/pages/blog/[...indice]/index.astro` → `/blog/` (ruta opcional para no generarla sin artículos) y `src/pages/blog/categoria/[categoria]/index.astro`. Imágenes en `public/images/blog/`.
- `test/blog.test.js` construye además el sitio con los artículos de `test/fixtures/blog/ok` en `.dist-fixtures/` (ignorada) usando `WD_BLOG_DIR` y `WD_OUT_DIR`; esas variables son solo para tests.
- `src/components/ConsentBanner.astro` → marcado del aviso de cookies (`#wd-consent`). Se usa como `<ConsentBanner />` justo antes de `<script is:inline src="/assets/wd-consent.js"></script>`.
- `public/` → se copia tal cual: `assets/` (CSS y JS compartidos, en `/assets/`), `test/scoring.js` y `test/test-data.js` (los carga `/test/`), `CNAME`, `robots.txt` y favicons.
- `test/` en la raíz → solo tests de Node (`*.test.js`). No se publica.

Cómo agregar una página:

1. Crear `src/pages/<nombre>.astro` (→ `/<nombre>.html`) o `src/pages/<carpeta>/index.astro` (→ `/<carpeta>/`). Partir de una página existente con el mismo `<head>` (GTM, atribución (`wd-attribution.js`, sin `defer`) y eventos primero, `<SEOHead>`, favicons, fuentes, `wd-tokens.css`, `wd-base.css`, `wd-consent.css`, `wd-pixel.js`) y `data-track-section`/`data-cta` según `docs/medicion.md`.
   - `<SEOHead title description path />` (`src/components/SEOHead.astro`) pone title, description, canonical, Open Graph, Twitter card y JSON-LD opcional (`jsonLd`). `path` con barra final para carpetas (`/test/`), nunca `/index.html`. Con `noIndex` la página emite `noindex`, no declara canonical y queda fuera del sitemap automáticamente (`astro.config.mjs` lee el HTML generado). `test/seo.test.js` lo comprueba.
2. **Todo `<script>` y `<style>` lleva `is:inline`**. Sin él, Astro hace scoped el CSS, agrupa y mueve los scripts a `/_astro/` y cambia el orden de carga, lo que rompe los overrides de Hotmart (`.hotmart-fb…`, con `!important`) y la regla de cargar `wd-hotmart-guard.js` antes del widget. `test/astro-build.test.js` falla si eso pasa.
3. Si la página mide o tiene enlaces internos: aviso con `import ConsentBanner from '../components/ConsentBanner.astro';` en el frontmatter y `<ConsentBanner />` + `wd-consent.js` al final del `<body>`.
4. Llaves `{ }` fuera de `<script>`/`<style>`: en Astro son expresiones. Si un texto las necesita, escribir `{'{'}`.
5. Agregar la página a `PAGES` en `test/wd-events.test.js` y `test/astro-build.test.js`. `npm test`.
6. Verificar que se ve igual en 390 y 1280 px (`npm run preview`).

## Trampas conocidas (heredadas de quiropractica.cl)

- Verificar que una clase CSS exista antes de usarla.
- Un respaldo estático puede ocultar fallas: comprobar en producción que los datos reales cambian.
- Revisar límites de longitud en toda la cadena cuando se agregan códigos de atribución a una URL o mensaje.
- En Hotmart, el parámetro `sck` no admite guion bajo (`_`); usar guiones.
- Reemplazos con tildes: editar el archivo directamente en vez de usar `sed`.
- El widget de Hotmart borra todos los `a[href*="hotmart.com"]` si falla su health check (`api-checkout-vue.hotmart.com`, que dejó de existir en DNS). `/assets/wd-hotmart-guard.js` los repone; va antes del widget en toda página con botones de checkout. Probar los botones con Hotmart **sin bloquear** (bloquear solo GTM y Meta).
