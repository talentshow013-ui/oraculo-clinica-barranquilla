# Prompt para el agente de frontend — modo «Orgánico» y desplegable Pauta / Orgánico

Copia desde aquí hasta el final y pásaselo al agente. **Todo ya existe y funciona**: la pantalla
`/organico` (`app/(panel)/organico/page.tsx`), el desplegable bajo ORÁCULO
(`components/cliente/selector-modo.tsx`, usado en `components/sidebar.tsx`) y la entrada «Orgánico»
en el menú móvil. Su trabajo es solo pulir lo visual. Lo funcional está probado (392 tests): no lo rehagas.

---

Eres el agente de frontend del panel **Oráculo** (Next 15 App Router, React 19, Tailwind 4, tema
CLARO, sin librerías de UI). El motor (`lib/`) **no se toca**. Tampoco `config/**`, `scripts/**`,
`deploy/**`, `middleware.ts`. Componentes en `components/ui.tsx` (`Panel`, `Kpi`, `Tabla`, `Th`,
`Celda`, `Etiqueta`, `Aviso`, `Barra`, `Grid`, `Titulo`, `Vacio`); reutilízalos. Cero jerga técnica
en texto visible. Dato ausente = «—» (nunca 0). Al terminar: `npm run typecheck && npm test && npm run
build` deben pasar; no cambies tests. Haz commit tú mismo (solo `app/` y `components/`).

## Qué hay (léelo antes de tocar)

`const r = await motor()` entrega `r.organico` (`ResultadoOrganico`, tipo en `@/lib/tipos`):

- `sinDatos` (true = todavía no se conectó), `desde`, `hasta`, `capturadoEn`, `avisos[]` (frases de
  «Meta no entregó …»).
- `redes[]` (`ResumenRed`): `red` instagram|facebook, `alias` (@usuario o nombre de la página),
  `seguidores`, `seguidoresGanados`, `publicaciones`, `alcance`, `vistas`, `interacciones`,
  `tasaInteraccion` (0–1).
- `publicaciones[]` (`PublicacionEvaluada`, la más reciente primero): `id`, `red`, `formato`
  (reel|video|imagen|carrusel|historia|texto|enlace), `publicadoEn`, `fecha`, `hora`, `diaSemana`
  (0 = domingo), `franja`, `texto`, `enlace` (a Instagram/Facebook), `urlMiniatura` (puede ser
  null; es una URL externa de Meta: NO la pintes con `<img>` sin `referrerPolicy="no-referrer"` y
  un respaldo cuando falle), `alcance`, `vistas`, `meGusta`, `comentarios`, `guardados`,
  `compartidos`, `interacciones`, `visitasPerfil`, `seguidoresGanados`, `clics`, `segundosPromedio`,
  `respuestas`, `tasaInteraccion`.
- `mejores.porAlcance[]`, `mejores.porTasa[]` (10 cada una), `porFormato[]`, `porDia[]` (7 filas
  siempre), `porFranja[]` (`GrupoOrganico`: `clave`, `etiqueta`, `publicaciones`, `alcanceMedio`,
  `interaccionesMedias`, `tasa`, `mejor`), `paraPauta[]` (`{ publicacion, porQue }`),
  `seguidores.serie[]` (`{ fecha, instagramNuevos, facebookTotal }`) y `seguidores.ganados`,
  `lecturas[]` (frases calculadas), `fuente` (`FuenteHallazgo`, se pinta con `FuenteDelHallazgo`).
- Nombres para pintar: `NOMBRE_RED`, `NOMBRE_FORMATO`, `NOMBRE_FRANJA`, `NOMBRE_DIA` de `@/lib/organico`.

Anclas que el riel usa (no las cambies): `#resumen`, `#para-pauta`, `#mejores`, `#formatos`,
`#horario`, `#dias`, `#seguidores`, `#todas`, `#fuente`.

## Pule estas 7 cosas

1. **Desplegable Pauta / Orgánico** (`selector-modo.tsx`): hoy es un botón pastilla bajo ORÁCULO.
   Hazlo parte del bloque del logo: «ORÁCULO» arriba y debajo el modo actual con un caret, como un
   solo control; el menú abierto con los dos modos, el activo marcado con el punto de acento y su
   frase corta («Anuncios que se pagan» / «Instagram y Facebook sin pagar»). En móvil, el mismo
   selector dentro del menú (`menu-movil.tsx`), arriba de las secciones.
2. **Riel en modo Orgánico**: al entrar a `/organico` el riel cambia a su propio grupo (ya lo hace).
   Que se note el cambio de mundo: un matiz en el fondo del riel o una franja de color en el logo, y
   que las anclas (`/organico#…`) se marquen como activas al hacer scroll (IntersectionObserver en
   un client component pequeño), no solo la ruta.
3. **Tarjetas de red**: los dos `Grid` de KPI (Instagram y Facebook) deben leerse como dos tarjetas
   de cuenta con su ícono de red y el alias grande, seguidores como cifra principal y las cuatro
   métricas debajo. Si `fb` no existe, solo Instagram, sin hueco.
4. **«Qué merece pauta»**: cada candidata como tarjeta con miniatura (si `urlMiniatura`; si no, un
   marco con el formato), texto, el `porQue` y dos acciones: «Ver la publicación ↗» (enlace externo)
   y «Ver en la tabla» (`#tasa-<id>`). Es el bloque más importante para el cliente: arriba de todo,
   después de las tarjetas de red.
5. **Tablas de publicaciones**: la columna «Publicación» con miniatura pequeña a la izquierda del
   texto (mismo cuidado con `<img>` externo), el formato como chip de color (reel = acento, historia
   = marino, resto gris), la tasa con barra fina bajo el número (como en Públicos). Mantén los `id`
   por fila (`alcance-<id>`, `tasa-<id>`, `pub-<id>`).
6. **Grupos (formato · franja · día)**: tres columnas a la misma altura; la fila «mejor» en negrita
   con el punto verde; en «día de la semana» pinta las 7 aunque tengan 0 publicaciones (ya vienen).
7. **Vacíos**: `sinDatos` muestra un `Vacio` que debe verse como invitación, no como error: ícono de
   red y una frase de dueño («Conecta Instagram y Facebook una vez y esto se llena solo cada
   mañana»). Los `avisos[]` van como `Aviso` neutro arriba, plegados en un solo renglón si hay más de uno.

No agregues pestañas nuevas ni muevas nada a otras pantallas. Todo lo orgánico vive en `/organico`.
