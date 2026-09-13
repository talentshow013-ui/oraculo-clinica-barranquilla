# ORÁCULO — cómo se enchufa este frontend al motor real

El `PROMPT-FRONTEND.md` daba por hecho un repositorio Next.js con `lib/` (motor, 201 tests) y
13 pantallas. **Ese repositorio no estaba en esta máquina** (solo llegó el prompt), así que el
panel se construyó completo, con el MISMO stack y la MISMA estructura, sobre un sustituto del
motor. Está en `app/`. Corre con `npm install && npm run build && npm start` → `http://localhost:3000/panel`.

## Lo que se reemplaza (y solo eso)

| Archivo del panel | Qué es | Qué se hace al integrar |
|---|---|---|
| `lib/tipos.ts` | `ResultadoMotor` y todos los tipos, **deducidos** del prompt | Se borra; las pantallas importan de `@/lib/adapters/types` (o donde vivan los tipos reales). Ajustar el `import type` de cada página con un buscar-y-reemplazar de `@/lib/tipos` |
| `lib/datos.ts` | `motor()` determinista con los patrones plantados + `resolverMetrica()` | Se borra; el real ya exporta `motor` y `resolverMetrica` con esa firma |
| `lib/format/index.ts` | `cop`, `pct`, `num`, `ratio`, `indice`, `deltaPct`, `VACIO`, `formatear(valor, unidad)` y `copCorto`, `conSigno`, `dias`, `minutos` | Si el real tiene los mismos nombres, se borra. Si no, se conservan solo `copCorto` y `conSigno` (los usan las gráficas) |
| `lib/format/etiquetas.ts` | `PASOS`, `PASOS_CORTO`, `ANGULOS`, `CUADRANTES`, `AREAS`, `SEVERIDADES`, `NIVELES`, `NIVELES_CORTO` | Cotejar nombres con el real; `PASOS_CORTO` y `NIVELES_CORTO` son nuevos (ejes apretados) |
| `lib/format/fechas.ts` | `hoyBogota`, `sumarDias`, `fechaCorta`, `fechaLarga`, `fechaHora`, `diaSemana` (todo America/Bogota) | Si el real los tiene, se borra |
| `public/radar/*.jpg` | 16 miniaturas de demostración | Se borran; el real las descarga ahí con `npm run radar:capturar` |

**No se toca nada de `app/`, `components/` ni `globals.css` al integrar.** Todo lo que pinta
sale de `await motor()`.

## Campos que el panel usa y que en el prompt no estaban explícitos (confirmar)

- `r.negocio.roasDeclarado` (además de `roasReal` y `poas`): Rendimiento muestra los tres lado a lado.
- `r.creativos[].fatiga.{caidaCtr, alzaFrecuencia}` además de `indice` y `formulaVisible`.
- `r.contexto.desglosesVisibles[].{costoResultado, fueraDeRadio?, fueraDeHorario?}`: si el motor no los marca, Audiencias los deduce de `valor` (nombre de ciudad / franja) — mejor que vengan del motor.
- `r.radar.perfiles[].{anunciosActivos, anuncios60}` (conteos por competidor para la tabla).
- `r.radar.mapaAngulos` debe cubrir también los ángulos que aparecen en `espaciosVacios`, si no el mapa no puede señalarlos.
- `r.serie[].agregado` puede ser `null` en un hueco: la gráfica corta la línea y raya el día. Si el motor omite el día, el panel no lo ve como hueco: mandarlo con `null`.
- `r.fuentes[].ultimaActualizacion` en ISO con zona; `null` si nunca.

## Decisiones tomadas que difieren del prompt (avisadas al cliente)

1. **Tema claro, no oscuro.** El cliente pidió «los mismos colores» del panel ESPEJO (blanco y
   azules). El `@theme` conserva los MISMOS nombres de token del prompt (`fondo`, `superficie`,
   `superficie-2`, `borde`, `borde-fuerte`, `texto`, `texto-2`, `texto-3`, `bien`, `mal`, `ojo`,
   `acento`) con valores claros, más `marino`, `marino-2`, `celeste`, `cobalto`, `hielo`. Volver al
   oscuro es cambiar los valores del bloque `@theme` en `app/globals.css`.
2. **Sin librerías nuevas.** `package.json` solo trae Next 15, React 19, Tailwind 4 y TypeScript.
   Las gráficas son SVG propio; el movimiento es CSS (`@keyframes`) y tres componentes de
   cliente: contar cifras (`components/cliente/contar.tsx`), plegar (`plegable.tsx`) y ordenar tablas
   (`ordenable.tsx`). El resto son Server Components.
3. **«—» para todo dato ausente**, como manda la constitución. El auditor anti-IA del taller marca la
   raya larga en prosa; aquí se declara «no aplica: es el contrato». Los ejes de las gráficas
   escriben `0` (origen del eje), nunca `$ 0` como si fuera un dato.
4. Los mensajes de la cabecera (huecos, advertencias, atribución) y el aviso de privacidad de
   Audiencias están cableados y no se quitan.

## Cuentas publicitarias (actividad nueva)

El panel analiza UNA cuenta a la vez y se elige en la barra superior. El contrato completo
(`cuenta`, `cuentas`, `motor(cuentaId?)`, cookie `cuenta`) está en `PROMPT-CUENTAS-PUBLICITARIAS.md`.

## Primitivas de `components/ui.tsx`

`Titulo`, `Panel` (tonos blanco / marina / hielo), `Grid`, `Kpi` (cifra contada, variación con color
según `mejorEs`, fórmula y «qué decisión cambia» al pasar el mouse), `Etiqueta`, `Barra`, `Vacio`,
`Aviso`, `Tabla` + `Th` + `Celda`, `Miniatura` (imagen local o marco con el tipo de medio),
`formatear`, `tonoSeveridad`, `tonoDelta`. Gráficas en `components/graficas/`: `Serie` (línea que se
dibuja, área, huecos rayados, velo de 14 días), `EmbudoBarras` (raíz de la cantidad, fuga en pesos,
peor en rojo), `Cuadrantes` (burbujas por inversión, «sin señal» hueco), `MapaAngulos` (calor +
espacios vacíos con aro).

## Comprobado antes de entregar

- `npm run typecheck` limpio · `npm run build` sin errores · las 13 rutas responden 200 · `/` → `/panel` · ruta inexistente → 404.
- Test de jerga (API, MCP, endpoint, Zod, LLM) sobre `app/` y `components/`: vacío.
- Anti-IA del taller 12/13 en las 13 rutas (el 13.º es la raya «—», declarada).
- Sin desborde a 1440 / 1024 / 390; sin letras sobre letras; ningún «$ 0» disfrazado de ausente.
- Ordenar tablas, plegar hallazgos, imprimir (`@media print`: sin riel ni cabecera, fondo blanco; el informe cabe en ~1 carta).
