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
- Cualquier página nueva (blog, artículo, 404) reutiliza las variables y clases que ya existen en `index.html`. Nada de colores sueltos.
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
- El dominio se publica con el archivo `CNAME` (`wire-down.com`). El DNS está en Squarespace: no se delega a otro proveedor ni se tocan los registros MX ni los A/CNAME del sitio. Agregar un registro TXT de verificación (Search Console) sí está permitido; lo hace Carlos a mano.
- Correo de contacto único en todo el sitio: `soporte@wire-down.com`.

## Privacidad y consentimiento (Ley 21.719 y GDPR)

- Nada que mida o rastree se carga sin consentimiento. Consent Mode v2 con todo en `denied` por defecto.
- La clave de consentimiento actual es `wd_consent` en `localStorage`. Si se cambia el formato, migrar el valor antiguo en vez de volver a preguntar a quien ya decidió.
- **Las respuestas y el perfil del test nunca salen del navegador hacia GA4, GTM ni Meta.** Solo se envían eventos sin parámetros. Esta regla ya está en `test/index.html` y se mantiene.
  - En Meta: `TestStarted` y `TestCompleted` (`trackCustom`). Se mantienen con esos nombres; no se renombran.
  - En dataLayer/GA4 (fase 2): `test_start` y `test_complete`. Conviven con los de Meta.
- Sin email capture hasta que exista el formulario con casilla de consentimiento separada y sin marcar (pendiente, fuera de esta etapa).

## Contenido del blog (YMYL)

- Cada artículo es un `.md` validado por schema Zod. Si no cumple, el build falla.
- Se publica solo si `draft: false`, `reviewed: true` **y** `publishDate` ≤ fecha del build. La revisión humana de Carlos es obligatoria (política de contenido a escala de Google).
- Tres niveles epistémicos siempre separados: (1) evidencia con cita verificada, (2) modelos de otros autores atribuidos por nombre, (3) lectura propia rotulada como tal.
- Referencias en formato Vancouver, verificadas contra PubMed o PMC. Cualquier `VERIFICAR` se resuelve antes del merge.
- Relaciones observacionales se describen como asociación, no causa. Sin promesas de curación. Sin metacomentarios sobre la honestidad.
- Aviso fijo del layout: contenido educativo que no reemplaza la atención de un profesional de salud.
- El autor se modela en schema como `Person` ("Kinesiólogo y quiropráctico"), nunca `Physician`. El protagonismo es de las herramientas, no del autor: byline discreto, bio breve.
- El ángulo cortisol–metabolismo–peso en mujeres 40+ no se usa como gancho de artículos.
- 2 o 3 enlaces internos por artículo, con slugs confirmados.

## Flujo de trabajo

1. Antes de planificar, **leer el código real**. No asumir nombres de campos ni rutas.
2. Rama corta (≤ 28 caracteres): `art/<tema>`, `feat/<tema>`, `fix/<tema>`.
3. Tests sin errores antes de cada commit. Hoy no hay `package.json`: se corren con `node --test test/scoring.test.js` desde la raíz. Desde la fase 5a (Astro), `npm run build` y `npm test`, que ejecutará esos mismos tests.
4. Detenerse y pedir confirmación antes de cada commit, push, PR y merge.
5. Commit con `Co-Authored-By: Claude <noreply@anthropic.com>`.
6. Un PR por tema, squash merge. Nunca hacer merge sin que Carlos lo apruebe.
7. Tras el merge: verificar en producción (iPhone y pestaña privada), pedir indexación en Search Console con la URL con barra final, borrar la rama local y remota.

## Trampas conocidas (heredadas de quiropractica.cl)

- Verificar que una clase CSS exista antes de usarla.
- Un respaldo estático puede ocultar fallas: comprobar en producción que los datos reales cambian.
- Revisar límites de longitud en toda la cadena cuando se agregan códigos de atribución a una URL o mensaje.
- En Hotmart, el parámetro `sck` no admite guion bajo (`_`); usar guiones.
- Reemplazos con tildes: editar el archivo directamente en vez de usar `sed`.
