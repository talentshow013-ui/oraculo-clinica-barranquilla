# Prompt para el agente de frontend — trazabilidad, oportunidades separadas y radar verificable

Copia desde aquí hasta el final y pásaselo al agente. **El motor ya entrega todo**; su trabajo es
solo pulir lo visual. Lo funcional ya está hecho y probado (359 tests): no lo rehagas.

---

Eres el agente de frontend del panel **Oráculo** (Next 15 App Router, React 19, Tailwind 4, tema
CLARO, sin librerías de UI). El motor (`lib/`) **no se toca**. No toques tampoco `config/**`,
`scripts/**`, `middleware.ts`, `app/(panel)/campanas/acciones.ts`. Componentes en
`components/ui.tsx` (`Panel`, `Kpi`, `Tabla`, `Th`, `Celda`, `Etiqueta`, `Aviso`, `Barra`, `Grid`,
`Titulo`); reutilízalos. Cero jerga técnica en texto visible. Dato ausente = «—». Al terminar:
`npm run typecheck && npm test && npm run build` deben pasar; no cambies tests.

Ya existe y funciona (revísalo antes de tocar nada):

- **Cada hallazgo trae su fuente**: `h.fuente = { origen, desde, hasta, registros, metodo, enlace }`
  y cada evidencia puede traer `e.enlace` (ruta interna que lleva a la tabla exacta).
  Componentes: `components/hallazgo-fuente.tsx` (`ChipEvidencia`, `TarjetaEvidencia`,
  `FuenteDelHallazgo`). Usados en `app/(panel)/diagnostico/page.tsx` y `app/(panel)/panel/page.tsx`.
- **Oportunidades en dos bloques** (`app/(panel)/oportunidades/page.tsx`): `o.ambito` es
  `"propio"` (nace de tus datos) o `"mercado"` (nace del radar). `o.verEn` = ruta del panel;
  `o.verificar` = enlace externo a la Biblioteca de anuncios de Meta (solo mercado).
- **Radar verificable** (`app/(panel)/competencia/page.tsx`): cada anuncio ganador tiene
  `urlAnuncioBiblioteca(a.anuncioId)`; cada perfil `p.verificar`; cada espacio vacío `e.verificar`.
  Lo mismo en `app/(panel)/biblioteca/page.tsx` (sección del mercado).
- **Ranking de Meta frente a la competencia** en Creativos: `c.rankingMeta` (`calidad`,
  `interaccion`, `conversion` con `rankingEnPalabras()` de `@/lib/adapters/meta.rankings`).
- **Bitácora** en Campañas: `r.bitacora = { reciente, periodo }` → `components/bitacora.tsx`.
- **Frente a quién te comparas** en el Centro de mando: `r.comparativa` → `components/comparativa.tsx`.
- **Anuncio señalado**: `/creativos?anuncio=<id>#anuncio-<id>` muestra arriba una sección con
  todo el detalle de ese anuncio (así los enlaces de los hallazgos aterrizan en él).

Pule estas 6 cosas, en este orden. No cambies datos ni textos de origen/método (vienen del motor).

## 1. Tarjeta de hallazgo (Diagnóstico y Centro de mando)

- En Diagnóstico, «Cómo lo sabemos» y «De dónde sale» deben leerse como una sola historia:
  primero los datos (tarjetas clicables con «Ver el dato →»), debajo el bloque «De dónde sale»
  (fuente · periodo · registros · cómo se calcula · «Ver la tabla completa →»). Dale al bloque de
  fuente un fondo suave distinto al de la evidencia para que se vea que es la ficha técnica.
- En el Centro de mando, la línea compacta «De dónde sale: …» debe caber en una sola línea en
  escritorio y en dos en móvil; si la fuente es larga, recórtala con elipsis y deja siempre visible
  «ver la tabla →».
- Los chips de evidencia con enlace llevan una flecha «→» al final: que se note que son clicables
  (subrayado al pasar, cursor de mano). Los que no tienen enlace, sin flecha y sin hover.

## 2. Aterrizaje de los enlaces

Cuando un enlace llega con `#ancla` (p. ej. `/audiencias#hora`, `/campanas#campana-123`,
`/embudo#paso-conversacion`, `/rendimiento#comparacion`), la sección o fila destino debe quedar
**resaltada 2 segundos** (anillo `ring-acento` que se desvanece). Hazlo con un client component
pequeño que lea `window.location.hash` al montar y aplique una clase temporal; respeta
`prefers-reduced-motion`. Las filas de `Ordenable` ya tienen `id` cuando reciben `prefijoId`.

## 3. Oportunidades: que los dos bloques no se confundan

- Bloque 1 «Lo que tus números piden probar» y Bloque 2 «Lo que hace la competencia y tú no»
  con un separador fuerte entre ambos (línea + espacio) y un color de rótulo distinto (acento para
  lo propio, marino para el mercado).
- En cada tarjeta, los dos enlaces («Ver el dato en el panel →» y «Verificar en la Biblioteca de
  anuncios de Meta ↗») como botones pequeños de texto, siempre en la misma posición (debajo de
  las etiquetas «basada en»).

## 4. Radar: el enlace de verificación siempre visible

- En las tarjetas de ganadores, «Verificar ↗» debe verse sin pasar el mouse (no solo en hover) y
  no puede tapar la etiqueta del ángulo: si no cabe, va en una segunda línea.
- En «Quién pauta», la columna «Comprobar» con «Sus anuncios ↗ · página» alineada a la derecha.
- En «Dónde no hay nadie» (fondo marino), el enlace «Verificar en la Biblioteca de anuncios ↗» en
  celeste, subrayado al pasar.

## 5. Creativos: ranking de Meta

En la tabla, el renglón «Meta vs. competencia: …» va en rojo cuando está por debajo y en gris
cuando está igual o mejor; añade un pequeño distintivo (chip «Meta») delante para que se entienda
que ese dato lo dice Meta y no el panel. En la sección «Anuncio señalado» ya aparece completo.

## 6. Campañas: bloque «Quién cambió qué»

- Que el bloque quede **después** de la tabla de campañas y **antes** de «Comparar varias».
- Barras por persona: nombre a la izquierda con ancho fijo (160 px) para que no bailen.
- En la tabla de interruptores, las filas con 3 o más cambios llevan fondo rojo suave (ya está) y
  un chip «reinicia aprendizaje» al lado del nombre.

Entrega: archivos modificados, una captura de Diagnóstico, Oportunidades, Radar y Campañas, y el
resultado de `npm run typecheck && npm test && npm run build`.
