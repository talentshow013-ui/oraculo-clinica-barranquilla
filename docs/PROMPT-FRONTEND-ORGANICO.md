# Prompt para el agente de frontend — modos «Orgánico» y «Google» y el desplegable Pauta / Orgánico / Google

Copia desde aquí hasta el final y pásaselo al agente. **Todo ya existe y funciona**: las pantallas
`/organico` (`app/(panel)/organico/page.tsx`) y `/web` (`app/(panel)/web/page.tsx`), el desplegable
de TRES modos bajo ORÁCULO (`components/cliente/selector-modo.tsx`: Pauta / Orgánico / Google, usado
en `components/sidebar.tsx` con un riel distinto por modo) y las entradas en el menú móvil. Su trabajo
es solo pulir lo visual. Lo funcional está probado (424 tests): no lo rehagas.

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

## Orgánico ahora también tiene TikTok

`r.organico.redes` puede traer una tercera red `tiktok` (viene de una exportación manual, no de API):
un tercer bloque de KPI ya está en la página (`tt`), y la tabla de seguidores tiene la columna
«TikTok · nuevos». En las tablas de publicaciones, las de TikTok llevan el chip «TikTok» (tono ojo).
Trátalo como tercera tarjeta de red, misma jerarquía que Instagram y Facebook; si `tt` no existe, no
dejes hueco. Los avisos incluyen uno fijo («viene de la exportación manual…»): píntalo como nota
discreta, no como alerta.

## Pantalla `/web` (modo Google) — pule estas 5 cosas

`r.web` (`ResultadoWeb`, tipo en `@/lib/tipos`): `sinDatos`, `resumen` (sesiones, usuarios,
usuariosNuevos, sesionesComprometidas, tasaCompromiso, eventosClave, tasaConversion, duracionMedia),
`porCanal[]` (`canal, sesiones, eventosClave, tasaConversion, participacion, mejor`), `porFuente[]`,
`pautaMeta` ({ sesiones, eventosClave, participacionSesiones, participacionEventos } | null),
`paginas[]`, `eventosClave[]` ({ evento, veces }), `ciudades[]` ({ ciudad, sesiones, eventosClave,
participacion }), `fueraDeCiudad`, `serie[]` ({ fecha, sesiones, eventosClave }), `lecturas[]`,
`fuente`. Anclas del riel (no cambiar): `#resumen #lectura #canales #fuentes #paginas #eventos
#ciudades #serie #fuente`.

1. **Los dos KPI de «pauta de Meta»** («Visitas que trae la pauta de Meta» y «Contactos que trae la
   pauta de Meta») son el puente con la pestaña Pauta: agrúpalos en una tarjeta con el logo/color de
   Meta y un enlace «Ver la pauta →» a `/panel`. Si `pautaMeta` es null, la tarjeta dice «Google no
   ve visitas desde la pauta: revisa que los anuncios lleven parámetros de seguimiento (utm)».
2. **Por canal**: barras con la participación y, a la derecha, la tasa de conversión como chip;
   el canal `mejor` con punto verde. Los nombres de canal de Google están en inglés («Paid Social»,
   «Organic Search», «Direct»…): tradúcelos en la vista con un diccionario pequeño (Paid Social →
   Redes pagadas, Organic Social → Redes orgánicas, Organic Search → Búsqueda orgánica, Paid Search
   → Búsqueda pagada, Direct → Directo, Referral → Referidos, Email → Correo, Unassigned → Sin
   asignar). El dato no se toca; solo la etiqueta.
3. **Páginas de entrada**: la ruta en monoespaciado, la fila con mejor tasa en negrita; tasa con
   barra fina bajo el número.
4. **Eventos clave vacíos** es el aviso más importante de esta pantalla (sin eventos clave no hay
   contactos): que se vea como tarjeta destacada con el paso a seguir, no como aviso pequeño.
5. **Serie diaria**: mismo estilo de tabla compacta que en Orgánico; si hay más de 14 días, los
   últimos 14 y un «ver todos».

No agregues pestañas nuevas ni muevas nada a otras pantallas. Lo orgánico vive en `/organico`, el
sitio web en `/web`. No toques `lib/`, `scripts/`, `deploy/`, `config/`, `.claude/`.
