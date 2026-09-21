# Prompt para el agente de frontend — Orgánico como red social, cabecera por modo, Google

Copia desde aquí hasta el final y pásaselo al agente. **Todo lo funcional ya existe y está probado
(431 tests)**: tarjetas de publicación con imagen, veredicto y «qué hacer», filtro por red, cabecera
que cambia según el modo, íconos de red, pantalla Google. Su trabajo es SOLO pulir lo visual y
la experiencia. No rehacer lógica, no tocar `lib/`, `scripts/`, `deploy/`, `config/`, `.claude/`.

---

Eres el agente de frontend del panel **Oráculo** (Next 15 App Router, React 19, Tailwind 4, tema
CLARO, sin librerías de UI). Componentes base en `components/ui.tsx` (`Panel`, `Kpi`, `Etiqueta`,
`Aviso`, `Barra`, `Grid`, `Titulo`, `Vacio`, `Miniatura`). Cero jerga técnica en texto visible. Dato
ausente = «—» (nunca 0). Al terminar: `npm run typecheck && npm test && npm run build` deben pasar;
no cambies tests. Commit tú mismo, solo `app/` y `components/`.

## Qué hay ahora (léelo antes de tocar)

- **Desplegable de modo** bajo ORÁCULO: `components/cliente/selector-modo.tsx` (Pauta / Orgánico /
  Google). El riel (`components/sidebar.tsx`) cambia de grupo según el modo; en Orgánico tiene
  entradas **Instagram / Facebook / TikTok** con ícono (`components/iconos-redes.tsx`, `IconoRed`)
  que llevan a `/organico?red=<red>#todas`.
- **Cabecera por modo**: `components/cabecera.tsx` + `components/cliente/cabecera-modo.tsx`. En
  Pauta: cuenta publicitaria, campaña, periodo, plata en riesgo. En Orgánico: pastilla marino con
  las redes conectadas (ícono + @usuario), periodo, «Traído …», botón «De dónde sale». En Google:
  igual con el sitio web.
- **Tarjeta de publicación**: `components/tarjeta-publicacion.tsx` (`TarjetaPublicacion`,
  `RejillaPublicaciones`). Cada publicación orgánica se pinta como en la red: imagen local
  (`p.urlMiniatura`, ruta `/organico/<red>-<id>.jpg`, formato 4:5) con el botón de play si es
  reel/video, chip de red arriba a la derecha, texto sobre degradado abajo; debajo fecha·hora·formato,
  chip de **veredicto** (`p.veredicto`: estrella|gusta|lejos|normal|floja|sin_dato, nombres en
  `NOMBRE_VEREDICTO` de `@/lib/organico`), seis métricas con iconito (alcance 👁, vistas ▶, me gusta ♥,
  comentarios 💬, guardados 🔖, compartidos ↗), línea «Interacción x % · N s promedio viendo»,
  caja «**Qué hacer:** …» (`p.queHacer`, calculado por el motor) y botón «Ver en Instagram ↗».
- **Pantalla `/organico`** (`app/(panel)/organico/page.tsx`): KPI por red (Instagram, Facebook, y
  TikTok si existe), «Lectura del periodo», **Qué merece pauta** (tarjetas), **Mejores
  publicaciones** (por alcance y por tasa, 5 y 5), grupos por formato/franja/día, seguidores,
  **Todas las publicaciones** con chips de filtro Todas / Instagram / Facebook / TikTok (query
  `?red=`), y la fuente. Datos: `r.organico` (`ResultadoOrganico` en `@/lib/tipos`).
- **Pantalla `/web`** (`app/(panel)/web/page.tsx`): visitas, contactos (eventos clave), por canal,
  por fuente, páginas, eventos, ciudades, serie, fuente. Datos: `r.web` (`ResultadoWeb`).

Anclas que usa el riel (no cambiar): Orgánico `#resumen #para-pauta #mejores #formatos #horario
#dias #seguidores #todas #fuente`; Google `#resumen #lectura #canales #fuentes #paginas #eventos
#ciudades #serie #fuente`.

## Pule esto (en orden de importancia)

1. **Que Orgánico y Google se sientan otro mundo, no una landing.** Al cambiar de modo debe cambiar
   el color del riel (Orgánico: un marino con matiz violeta/rosa; Google: matiz azul-verde), el
   fondo de la cabecera y el rótulo del logo. Los KPI de arriba deben ser **tarjetas de cuenta**: una
   por red con su ícono grande, el @usuario, seguidores como cifra principal y las 3 métricas
   debajo, todas a la misma altura. Nada de filas de KPI genéricas.
2. **Tarjeta de publicación como en Instagram.** Mantén la estructura de
   `components/tarjeta-publicacion.tsx` y hazla bonita: imagen con esquinas suaves y sombra corta,
   play centrado y grande en reels, hover que levanta la tarjeta; métricas en una fila de iconitos
   con el número debajo (como el contador de la app), veredicto como cinta de color en la esquina de
   la imagen (estrella = verde, gusta = acento, llega lejos = ámbar, floja = rojo, normal = gris);
   la caja «Qué hacer» con ícono de bombillo y texto legible (mín. 13 px). Toda la tarjeta clicable
   abre la publicación en pestaña nueva (el `<a>` ya existe).
3. **Filtro por red en «Todas las publicaciones»**: los chips Todas / Instagram / Facebook / TikTok
   deben ir pegados arriba de la rejilla y verse como pestañas; al elegir una, el título del panel
   muestra el ícono de esa red (ya lo hace). Si una red no tiene publicaciones, el vacío dice
   «Todavía no hay publicaciones de X en el periodo» dentro de un `Vacio` con el ícono de la red.
4. **«Qué merece pauta»** es lo más valioso: primera sección después de las tarjetas de cuenta, con
   fondo hielo y un título de dueño («Estas 4 ya demostraron que gustan: ponles pauta»). En cada
   tarjeta de esa sección el «Qué hacer» viene con el porqué numérico (`c.porQue`); píntalo destacado.
5. **Mejores publicaciones**: dos carriles horizontales con scroll («Por alcance», «Por tasa de
   interacción»), 5 tarjetas cada uno, en vez de dos rejillas apiladas.
6. **Cabecera en Orgánico/Google**: la pastilla de redes debe verse como el selector de cuenta de
   Pauta (misma altura y radio), con los íconos en color de marca (Instagram degradado, Facebook
   azul, TikTok negro, Google multicolor) — solo en esa pastilla; en el resto del panel los íconos van
   en el color del texto.
7. **Móvil**: rejilla de 2 columnas, métricas en dos filas de tres, «Qué hacer» plegado con «ver
   más». El menú móvil (`components/cliente/menu-movil.tsx`) debe incluir el selector de modo arriba.
8. **Google (`/web`)**: los dos KPI «Visitas / Contactos que trae la pauta de Meta» en una tarjeta
   con el logo de Meta y enlace «Ver la pauta →» a `/panel`; canales traducidos en la vista (Paid
   Social → Redes pagadas, Organic Social → Redes orgánicas, Organic Search → Búsqueda orgánica,
   Paid Search → Búsqueda pagada, Direct → Directo, Referral → Referidos, Email → Correo, Unassigned
   → Sin asignar); «Eventos clave» vacío como tarjeta destacada con el paso a seguir.

No agregues pestañas nuevas. Lo orgánico vive en `/organico`, el sitio web en `/web`.

## Dos modos nuevos (2026-09-20): «Google» con la pauta adentro, y «Pacientes» (Kommo)

Ya funcionan; pule solo lo visual.

- **Google**: el desplegable ahora entra por `/panel?plataforma=google`. En ese mundo el riel tiene
  dos grupos: «Pauta de Google Ads» (Centro de mando, Diagnóstico, Campañas, Anuncios, Rendimiento:
  son las MISMAS pantallas de Pauta, con el selector de cuenta limitado a Google Ads) y «Sitio web
  (Analytics)» (`/web`). La cookie `modo` decide qué cuentas ve el selector; el riel la fija al
  hacer clic. Pule: que el riel de Google se vea como un solo mundo (color azul-verde ya definido:
  `bg-marino-goo`, `text-menta`), con el logo de Google Ads en el grupo de pauta y el de Analytics
  en el de sitio web; en las pantallas de pauta dentro de Google, un rótulo arriba «Pauta de Google
  Ads» para que nadie crea que está en Meta.
- **Pacientes** (`app/(panel)/pacientes/page.tsx`, datos en `r.pacientes: ResultadoPacientes`):
  KPI (leads, citas, asistieron, ventas; tasas lead→cita, cita→asistencia, lead→venta; valor),
  lectura, embudo de 4 barras, por fuente, semana a semana, etapas de Kommo, fuente. Paleta ámbar
  (`bg-marino-pac`, `text-ambar`, `bg-hielo-pac`). Pule: el embudo de 4 pasos como embudo de
  verdad (barras decrecientes centradas, con el % de caída entre pasos escrito entre barra y barra);
  las tasas como tarjetas grandes con un semáforo (lead→cita < 5 % rojo, 5–10 ámbar, > 10 verde;
  cita→asistencia < 60 % rojo); la tabla «por fuente» con la fila «Sin fuente» en ámbar y su nota;
  «Etapas de Kommo» como chips agrupados por paso (Lead / Cita / Asistió / Venta).
- Anclas del riel de Pacientes (no cambiar): `#resumen #lectura #embudo #fuentes #semanas #etapas #fuente`.
