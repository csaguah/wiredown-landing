# Medición — wire-down.com

Cómo se mide el sitio, dónde vive cada cosa y cómo está configurado GTM/GA4. Este archivo va en un repo público: aquí solo hay identificadores públicos (los mismos que cualquiera ve en el código de la página), nunca contraseñas, tokens ni datos de clientes.

## Dónde vive cada cosa

| Herramienta | Dónde | Notas |
|---|---|---|
| **GA4** | Cuenta "Wire Down" (`416399075`) · Propiedad "Wire Down" (`564422517`) · ID de medición `G-Y44EHP0168` | Conservación de datos: 14 meses. Medición mejorada **sin** desplazamientos, clics de salida ni interacciones con formularios (los mide `wd-events.js`). |
| **GTM** | Cuenta "Wire-Down" · Contenedor `GTM-T47WBMN9` | Se carga desde `/assets/wd-gtm.js` con Consent Mode v2 (todo denegado por defecto). Nunca usar el contenedor de quiropractica.cl. |
| **Search Console** | Propiedad de dominio `wire-down.com` | Verificada por DNS. **No borrar los registros TXT en Squarespace.** |
| **Meta Pixel** | `4406846419603179` · Porfolio `quiropractico.carlos.sagua` · Cuenta publicitaria "Wire Down Method" | Script propio (`/assets/wd-pixel.js`), no pasa por GTM. Solo con consentimiento de Marketing. |
| **Purchase** | Lo envía Hotmart (Pixel de rastreo: web + API de Conversiones) | El sitio no dispara `Purchase`. GA4 no recibe compras; `thankyou_view` es solo una señal aproximada (ver abajo). |

## Cómo funciona

```
página ──► /assets/wd-events.js ──► dataLayer ──► GTM (GTM-T47WBMN9) ──► GA4 (G-Y44EHP0168)
página ──► /assets/wd-pixel.js  ──► Meta Pixel (TestStarted, TestCompleted, InitiateCheckout)
```

- `wd-events.js` se incluye con `defer` en el `<head>` de todas las páginas, después de `wd-gtm.js`.
- **Consentimiento:** solo empuja eventos si la decisión guardada (`wd_consent_v2`) tiene Analítica aceptada. Se revisa en el momento de cada evento, así respeta un «Aceptar» o «Rechazar» hecho en la misma visita. Consent Mode sigue controlando GA4 por su lado; esto es una segunda barrera.
- **GTM primero:** nada se empuja antes de que GTM haya cargado (`window.google_tag_manager['GTM-T47WBMN9']`). Mientras tanto los eventos esperan en una cola; si GTM no carga en ~10 s (bloqueador), la cola se descarta.
- **Lista blanca de parámetros:** cada evento solo puede llevar los parámetros de su fila en la tabla de abajo. Cualquier otro se descarta. Los parámetros de otros eventos se envían como `undefined` para que el modelo de datos de GTM no arrastre valores de un evento al siguiente.
- **Nada de texto de la página:** los nombres salen de atributos `data-*` fijos. `faq_id` es un identificador corto, no el texto de la pregunta; `link_domain` es solo el dominio, sin ruta ni query.
- **Test:** las respuestas y el perfil nunca salen del navegador, ni a GA4 ni a Meta. `src/pages/test/index.astro` (`/test/`) llama a `wdTrack('test_start')`, `wdTrack('test_complete')` y `wdTrack('test_to_guide')` sin parámetros. Los eventos de Meta `TestStarted` (al pulsar «Comenzar») y `TestCompleted` (resultado) siguen igual.
- **Una vez por página:** `section_view` (por sección), `faq_open` (por pregunta) y `scroll_depth` (por umbral) se envían como máximo una vez por carga de página.

## Eventos

| Evento | Disparador | Parámetros |
|---|---|---|
| `click_checkout` | Clic en cualquier enlace a `pay.hotmart.com` (o con clase `hotmart__button-checkout`) | `cta_location`, `page_code` |
| `cta_click` | Clic en un elemento con `data-cta`, salvo enlaces de checkout | `cta_name`, `cta_location` |
| `test_start` | Primera respuesta de cada intento del test | — |
| `test_complete` | Se muestra la pantalla de resultado | — |
| `test_to_guide` | Clic en «Conocer la guía Wire Down» del resultado | — |
| `section_view` | Elemento con `data-track-section` visible al 50 % (o media pantalla si la sección es más alta que la pantalla) | `section_name` |
| `faq_open` | Se abre una pregunta con `data-faq` | `faq_id` |
| `scroll_depth` | Se alcanza el 25, 50, 75 o 90 % de la página (solo con scroll real) | `percent` |
| `outbound_click` | Clic en un enlace a otro dominio que no sea Hotmart (`mailto:` y `tel:` no cuentan) | `link_domain` |
| `thankyou_view` | Carga de `/gracias.html` | — (sin montos ni datos del comprador) |

Un clic en un botón de checkout envía **solo** `click_checkout`, nunca `cta_click`, aunque el botón tenga `data-cta`. Así cada clic cuenta una vez: `cta_click` mide los demás CTA (test, guía, repetir) y `click_checkout` el paso a Hotmart. Los botones de checkout conservan `data-cta-location`, que es de donde `click_checkout` toma `cta_location`.

### Valores de los parámetros

**`page_code`** — se deduce de la URL: `/` → `guia`, `/test/` → `test`, `/gracias.html` → `gracias`, `/privacidad.html` → `privacidad`, `/blog/<slug>/` → `<slug>` (el slug del artículo; el campo `codigo` del frontmatter, `a001`…, queda reservado para la atribución de la fase 3 y no se envía). Un `data-page-code` en `<body>` tiene prioridad: `404.html` usa `data-page-code="404"`, porque GitHub Pages la sirve en cualquier ruta inexistente.

**`cta_location`** — atributo `data-cta-location` del elemento o de un ancestro. Si falta: `sin_definir` (revisar el marcado).

| Página | Elemento | `cta_name` | `cta_location` |
|---|---|---|---|
| `/` | Botón del hero (`#cta-hero`) | — (solo `click_checkout`) | `hero` |
| `/` | Botón del CTA final (`#cta-final`) | — (solo `click_checkout`) | `final` |
| `/` | Botón fijo en móvil (`.sticky-cta`) | — (solo `click_checkout`) | `sticky` |
| `/` | Enlace «Haz el test orientativo» (bajo la línea de confianza del hero) | `hacer_test` | `hero` |
| `/` | Botón «Haz el test orientativo →» | `hacer_test` | `bonos` |
| `/test/` | «Comenzar» | `comenzar_test` | `intro` |
| `/test/` | «Conocer la guía Wire Down» | `ver_guia` | `resultado` |
| `/test/` | «Volver a hacer el test» | `repetir_test` | `resultado` |
| 404 | «Hacer el test orientativo» | `hacer_test` | `404` |
| 404 | «Conocer la guía Wire Down» | `ver_guia` | `404` |
| artículos | Botón «Haz el test orientativo →» del CTA del artículo (`primaryCta: "hacer_test"`) | `hacer_test` | `articulo` |
| artículos | Enlace a `/test/` dentro del texto del artículo (se marca al generar la página, no en el `.md`) | `hacer_test` | `articulo_texto` |
| artículos | Botón de checkout del CTA del artículo (`primaryCta: "comprar_hotmart"`) | — (solo `click_checkout`) | `articulo` |

**`section_name`**

- `/`: `hero`, `dolor`, `cita`, `producto`, `bonos`, `autor`, `cta_final`, `faq`
- `/test/`: `test_intro`, `test_preguntas`, `test_resultado`
- 404: `no_encontrada`
- artículos (`/blog/<slug>/`): `articulo_cabecera`, `articulo_cuerpo`, `articulo_cta`, `articulo_cierre` (solo si el artículo tiene «Para seguir» o «Fuentes»), `articulo_autor`
- `/blog/`: `blog_indice` · `/blog/categoria/<categoria>/`: `blog_categoria`

**`faq_id`** (`/`): `formato`, `conocimientos`, `tiempo`, `dolor_cronico`, `test_diagnostico`, `pago`

**`percent`**: `25`, `50`, `75`, `90`

**`link_domain`**: dominio sin `www.` (p. ej. `pubmed.ncbi.nlm.nih.gov`).

### Marcado en páginas nuevas (artículos, 404)

- `data-track-section="<nombre_snake_case>"` en cada `<section>`, sin repetir nombres en la misma página.
- `data-cta="<nombre>"` y `data-cta-location="<ubicación>"` en cada botón o enlace de llamado a la acción. En artículos, los enlaces a checkout llevan `data-cta="checkout" data-cta-location="articulo"`.
- `data-faq="<id_corto>"` en cada pregunta. Funciona con el acordeón actual (clase `.open` o `aria-expanded="true"`) y con `<details data-faq>` / `<summary data-faq>`.
- Solo atributos: ningún cambio visual.
- `test/wd-events.test.js` comprueba el marcado de `/` y `/test/`; agregar las páginas nuevas a esos tests. Las páginas del blog las comprueba `test/blog.test.js` sobre un build con artículos de prueba (solo existen cuando hay artículos publicados).

## GA4: configuración

### Dimensiones personalizadas

*Administrar → Visualización de datos → Definiciones personalizadas → Crear dimensión personalizada.* Ámbito: **Evento** en todas.

| Nombre de la dimensión | Parámetro de evento | Descripción |
|---|---|---|
| CTA ubicación | `cta_location` | Dónde está el botón (hero, final, sticky, articulo, resultado…) |
| Código de página | `page_code` | Página desde donde se hizo clic al checkout |
| CTA nombre | `cta_name` | Qué CTA se pulsó |
| Sección | `section_name` | Sección vista al 50 % |
| Pregunta frecuente | `faq_id` | Pregunta abierta (identificador, no el texto) |
| Profundidad de scroll | `percent` | Umbral alcanzado (25, 50, 75, 90) |
| Dominio de salida | `link_domain` | Dominio del enlace externo |

Los parámetros que no se registren no aparecen en los informes (sí en DebugView).

### Eventos clave sugeridos

*Administrar → Visualización de datos → Eventos clave:* `click_checkout` y `test_complete`. Se pueden marcar después de que cada evento aparezca por primera vez en *Eventos*.

### Medición mejorada

*Administrar → Flujos de datos → (flujo web) → Medición mejorada:* dejar **desactivados** Desplazamientos, Clics de salida e Interacciones con formularios (los duplicaría `wd-events.js`).

## GTM: configuración exacta

Requisito previo: la etiqueta de Google con `G-Y44EHP0168` disparando en **Initialization – All Pages**. Si no existe, crearla antes.

### 1. Variables de capa de datos

*Variables → Variables definidas por el usuario → Nueva → Variable de capa de datos.* Versión de la capa de datos: **Versión 2**. Sin valor predeterminado.

| Nombre de la variable en GTM | Nombre de la variable de capa de datos |
|---|---|
| `DLV - cta_location` | `cta_location` |
| `DLV - page_code` | `page_code` |
| `DLV - cta_name` | `cta_name` |
| `DLV - section_name` | `section_name` |
| `DLV - faq_id` | `faq_id` |
| `DLV - percent` | `percent` |
| `DLV - link_domain` | `link_domain` |

La variable integrada `{{Event}}` ya existe en todos los contenedores; no hay que crearla.

### 2. Activador

*Activadores → Nuevo → Evento personalizado.*

- Nombre: `CE - wd-events`
- Nombre del evento: `^(click_checkout|cta_click|test_start|test_complete|test_to_guide|section_view|faq_open|scroll_depth|outbound_click|thankyou_view)$`
- ☑ Usar coincidencia de expresiones regulares
- Este activador se activa en: **Todos los eventos personalizados**

Si se agrega un evento a `wd-events.js`, agregarlo también a esta expresión regular.

### 3. Etiqueta

*Etiquetas → Nueva → Google Analytics → Evento de Google Analytics.*

- Nombre: `GA4 - Evento - wd-events`
- ID de medición: `G-Y44EHP0168`
- Nombre del evento: `{{Event}}`
- Parámetros del evento:

| Nombre del parámetro | Valor |
|---|---|
| `cta_location` | `{{DLV - cta_location}}` |
| `page_code` | `{{DLV - page_code}}` |
| `cta_name` | `{{DLV - cta_name}}` |
| `section_name` | `{{DLV - section_name}}` |
| `faq_id` | `{{DLV - faq_id}}` |
| `percent` | `{{DLV - percent}}` |
| `link_domain` | `{{DLV - link_domain}}` |

  Los que vienen vacíos (`undefined`) no se envían a GA4, así que una sola etiqueta sirve para los diez eventos.
- Configuración avanzada → Configuración de consentimiento: **No se requiere consentimiento adicional** (las etiquetas de GA4 ya revisan `analytics_storage`, y `wd-events.js` no empuja nada sin Analítica).
- Activación: `CE - wd-events`.

### 4. Verificar antes de publicar

1. GTM → **Vista previa** con `https://wire-down.com/` y aceptar Analítica en el aviso.
2. Hacer clic en el botón del hero (en Vista previa el widget de Hotmart se abre; no completar la compra), abrir una pregunta frecuente, bajar hasta el final, ir al test y responder la primera pregunta.
3. En Tag Assistant: cada evento muestra `GA4 - Evento - wd-events` como *disparada* y la pestaña *Capa de datos* muestra solo los parámetros de su fila.
4. GA4 → *Administrar → DebugView*: los eventos llegan con sus parámetros. En `test_start`, `test_complete` y `test_to_guide` no debe haber ningún parámetro propio.
5. Repetir con «Rechazar todo»: no debe aparecer ningún evento de la tabla.
6. Publicar la versión de GTM con un nombre descriptivo (p. ej. «wd-events: 10 eventos GA4»).

## `thankyou_view` y `/gracias.html`

- `/gracias.html` no muestra aviso de cookies: `thankyou_view` solo se envía si la persona ya había aceptado Analítica antes en el sitio. No todos los compradores vuelven a esa página, así que **no sirve para contar ventas**; las ventas se cuentan en Hotmart y Meta.
- Hotmart puede agregar a la URL de agradecimiento parámetros con datos de la compra (transacción, nombre, email). Para que no lleguen a GA4 ni a Meta, `wd-gtm.js` (primer script del `<head>`) hace `history.replaceState(null, '', location.pathname)` **antes de cargar GTM y el Pixel**, solo cuando la ruta es exactamente `/gracias.html` o `/gracias` y hay query o hash. GA4 y Meta ven `https://wire-down.com/gracias.html` sin nada más. Ninguna otra página se toca: las UTM de la home y del test se conservan. Lo comprueba `test/wd-events.test.js`.

## Tests

`npm test` desde la raíz (hace `astro build` y luego `node --test "test/*.test.js"`; ver CLAUDE.md). Los archivos de `/assets/` están en `public/assets/` y las páginas en `src/pages/`. `test/wd-events.test.js` cubre la lista blanca de parámetros, la espera de GTM y el consentimiento, que un checkout envíe solo `click_checkout`, la limpieza de la URL de `/gracias.html` en `wd-gtm.js` (y que no toque otras páginas), y el marcado de las páginas (cada `<section>` con `data-track-section`, cada checkout con su ubicación, cada pregunta con `data-faq`, y que el test solo envíe nombres de evento sin parámetros). El marcado se comprueba sobre el HTML generado en `dist/`.
