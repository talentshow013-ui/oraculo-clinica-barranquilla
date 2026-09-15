# Prompt para el agente de frontend — ajustes tras la primera revisión con datos reales

Copia desde aquí hasta el final y pásaselo al agente.

---

Eres el agente de frontend del panel **Oráculo** (Next 15 App Router, React 19, Tailwind 4, tema
CLARO, sin librerías de UI). Repositorio en la raíz del proyecto. El motor (`lib/`) **no se toca**:
ya entrega todos los datos que necesitas; tu trabajo es solo lo visual en `app/` y `components/`.

Reglas fijas del proyecto:
- Cero jerga técnica en texto visible (nada de "MCP", "API", "CTR", "CPM" sueltos; los nombres
  bonitos ya vienen en `lib/format/etiquetas.ts` y en el catálogo).
- Todo dato ausente se muestra como «—» con `num()/cop()/pct()` de `@/lib/format`. Nunca un cero inventado.
- Componentes de UI existentes en `components/ui.tsx` (`Panel`, `Kpi`, `Tabla`, `Th`, `Celda`,
  `Etiqueta`, `Aviso`, `Barra`, `Grid`, `Titulo`). Reutilízalos; no crees un sistema paralelo.
- Los datos entran por `const r = await motor()` (`@/lib/datos`). Tipos en `@/lib/tipos`.
- Al terminar: `npm run typecheck && npm test && npm run build` deben pasar. No cambies tests.
- No toques: `lib/**`, `config/**`, `scripts/**`, `middleware.ts`, `app/(panel)/campanas/acciones.ts`.

Haz estos 7 cambios, en este orden. Cada uno es pequeño.

## 1. Cabecera: periodo con calendario (`components/cabecera.tsx` + nuevo `components/cliente/selector-periodo.tsx`)

Hoy la cabecera muestra «PERIODO 15 de jun – 13 de sept» como texto fijo. Conviértelo en un
selector con calendario:
- Al tocarlo se despliega un panel con dos campos `<input type="date">` («Desde», «Hasta»), con
  `min`/`max` = `r.periodo.minimo` / `r.periodo.maximo`, un botón «Aplicar» y otro «Todo el periodo».
- «Aplicar» guarda dos cookies `desde` y `hasta` (formato `YYYY-MM-DD`, `path=/`, 1 año) y llama
  `router.refresh()`; «Todo el periodo» borra las dos cookies y refresca. Copia el patrón de
  `components/cliente/selector-cuenta.tsx` (es un client component que escribe la cookie y refresca).
- El texto del botón muestra el periodo activo (`r.periodo.desde` – `r.periodo.hasta`, en español
  corto como hoy) y, si `r.periodo.elegido` es true, una etiqueta «personalizado».
- El motor ya lee esas cookies: `r.periodo = { desde, hasta, elegido, minimo, maximo }`. Todo el
  panel (cifras, hallazgos, embudo, campañas, creativos) se recalcula solo con ese periodo.
- Audiencias no cambia con el periodo (sus desgloses son siempre los últimos 28 días): en esa
  pantalla, si `r.periodo.elegido`, muestra un `Aviso` neutro: «Las audiencias muestran siempre los
  últimos 28 días; el periodo elegido no las cambia.»

## 2. Cabecera: la lista de campañas debe poder bajar (`components/cliente/selector-campana.tsx`)

Con 40 campañas la lista se sale de la pantalla y no se puede llegar a las de abajo. Al contenedor
desplegable ponle `max-h-[70vh] overflow-y-auto` (y lo mismo al selector de cuenta por si acaso).
Deja «Todas las campañas» fijo arriba (sticky) dentro del desplegable.

## 3. Centro de mando: solo las cifras que importan (`app/(panel)/panel/page.tsx`)

`r.maestras` ya viene **ordenada por importancia y sin las que no tienen dato** (Inversión,
Conversaciones iniciadas, Costo por conversación, Costo por clic de enlace, Costo por resultado,
Personas alcanzadas, Tasa de clics, Costo por mil, Frecuencia, Gancho, Retención, Fuga en pesos,
Plata en riesgo…). Las de citas, ventas y retorno aparecen solas cuando la clínica anote
resultados y se calibren los precios.
- Cambia el título «Las 18 cifras que mandan» por «Las {r.maestras.length} cifras que mandan».
- Debajo de la cuadrícula agrega una línea pequeña (`text-texto-3`): «Costo por cita, costo por
  paciente y retorno aparecen aquí cuando se anotan resultados en Campañas.»
- Nada más cambia en esa pantalla.

## 4. Audiencias: la tabla de horas como un reloj (`app/(panel)/audiencias/page.tsx`)

La tabla «¿A qué hora escriben y quién contesta?» hoy se ordena por inversión y muestra «10», «9»,
«11»… Cámbiala así:
- Orden fijo de **12 a. m. a 11 p. m.** (ordena por `Number(x.valor)`, 0 → 23), no por inversión.
- La primera columna muestra la hora con `etiquetaHora(x.valor)` de `@/lib/format/etiquetas`
  («12 a. m.», «1 a. m.», …, «2 p. m.»).
- Añade una columna con una barra horizontal (`Barra` de `components/ui`) proporcional a la
  inversión de esa hora frente a la hora máxima, para que se vea de un vistazo dónde se concentra.
- Sombrea con fondo suave (`bg-superficie-2`) las filas dentro del horario de atención
  (`r.cliente.horarioAtencion.inicio` ≤ hora < `fin`); las de fuera conservan la etiqueta «fuera de
  horario» que ya existe.
- Las otras dos tablas (zona y edad) quedan como están.

## 5. Radar de mercado: que se entienda y no sea infinito (`app/(panel)/competencia/page.tsx`)

Hoy la página mide 38.000 px porque lista los 290 «espacios vacíos» uno por uno, muchos iguales, y
deja media pantalla en blanco. Ahora hay datos reales: 53 competidores de Barranquilla y 91 anuncios.
- Si `r.radar.sinDatos` es true: muestra un solo `Aviso` («Todavía no se ha capturado la
  competencia. Se hace en la sincronización semanal.») y nada más.
- Con datos, orden de la pantalla (una columna a lo ancho, sin columna vacía a la izquierda):
  1. Cuatro cifras arriba: Ganadores probados (60+ días) · Competidores activos · Espacios vacíos
     (el número, `r.radar.espaciosVacios.length`) · Cadencia (competencia `r.radar.cadencia` vs
     propia `r.radar.cadenciaPropia`, como «16 vs 21 anuncios nuevos por semana»).
  2. **Ganadores probados**: `r.radar.ganadores` (anuncios con 60+ días al aire). Tarjetas con la
     imagen (`urlMedia`: viene de `/radar/<id>.jpg`; si es null, sin imagen), nombre del anunciante,
     días al aire, ángulo (`ANGULOS[a.anguloDetectado]` de `@/lib/format/etiquetas`) y las
     primeras 2 líneas del copy. Máximo 12, ordenados por `diasCorriendo` descendente; si hay más,
     un botón «Ver los N» que despliega el resto (client component sencillo o `<details>`).
  3. **Quién pauta**: tabla de `r.radar.perfiles` (nombre, anuncios activos, anuncios de 60+ días,
     ángulo principal, usa precio sí/no). Máximo 15 filas, con «Ver todos» igual que arriba.
  4. **Mapa de ángulos × nivel de consciencia**: la matriz que ya existe, tal cual.
  5. **Dónde no hay nadie**: usa `r.radar.espaciosDestacados` (ya vienen priorizados y son máximo
     8), NO `espaciosVacios`. Tarjetas cortas: servicio (nombre bonito: busca el id en
     `r.cliente.servicios` y muestra `nombre`), ángulo y nivel, y el texto `porQue`.
  6. **Movimientos por semana**: `r.radar.movimientosSemanales` como está hoy si ya existe.
- Quita cualquier lista que repita lo mismo por cada combinación. La página debe caber en ~3 pantallas.

## 6. «Banco de mensajes» pasa a llamarse «Copys exitosos» (`components/sidebar.tsx`, `components/cliente/menu-movil.tsx`, `app/(panel)/biblioteca/page.tsx`)

La ruta `/biblioteca` se queda; cambia el nombre en el menú lateral y en la pantalla:
- Menú: «Copys exitosos». Título de la pantalla: «Los copys que más te funcionaron». Subtítulo:
  «Los textos de anuncio propios con más resultados y menor costo, para escribir la próxima pieza».
- Tarjetas propias: usa `etiquetaCreativo(c.creativo)` de `@/lib/format/etiquetas` como título
  (nunca «»), el copy completo (`c.creativo.copyPrincipal`) con «ver más» si pasa de 4 líneas,
  la decisión (`Etiqueta`), y debajo en una línea: «{resultados} resultados · costo por resultado
  {cop(c.costoResultado)} · gancho {pct(c.hookRate)}». No digas «costo por cita»: es «costo por
  resultado».
- Ordena por `c.puesto` (ya viene en `r.creativos`; 1 = el más exitoso) y muestra máximo 10.
- La sección del mercado («ganadores del mercado por ángulo») se queda debajo, con el mismo
  formato de tarjeta; si `r.radar.sinDatos`, no la muestres.

## 7. Creativos: que se lea quién ganó (`app/(panel)/creativos/page.tsx`)

Hoy es una tabla de 11 columnas y 95 filas: demasiado. `r.creativos` ya viene ordenado del más
exitoso al menos y cada uno trae `puesto` (1 = mejor). Cambia a:
- Arriba, un **podio**: las 3 primeras tarjetas grandes (miniatura con el componente `Miniatura` que ya usa `app/(panel)/campanas/page.tsx`, pasando `c.creativo.urlMiniatura` si
  existe, título con `etiquetaCreativo`, decisión, «{resultados} resultados a {cop(costoResultado)}»,
  inversión). Rótulo: «Los 3 que más rindieron».
- La matriz de cuadrantes se queda, pero al lado del podio (mitad y mitad en pantallas anchas).
- La tabla abajo con solo **7 columnas**: # (`puesto`) · Creativo · Decisión · Resultados ·
  Costo por resultado · Inversión · Gancho. Las demás (Retiene, Tasa de clics, Fatiga, Vida útil,
  Al aire) van en un renglón secundario pequeño debajo del nombre («retiene 6 % · clics 0,6 % ·
  fatiga 0,19 · 28 d al aire»). Orden inicial por `puesto`; la cabecera sigue ordenable.
- Muestra las primeras 20 filas y un botón «Ver los 95» para el resto.
- El texto de fatiga de la tarjeta oscura ya usa nombres legibles; no lo cambies.

Entrega: los archivos modificados, una captura de cada pantalla tocada, y el resultado de
`npm run typecheck && npm test && npm run build`.
