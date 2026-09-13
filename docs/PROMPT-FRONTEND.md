# PROMPT DE CONEXIÓN — Agente de diseño (frontend)

> **Estado (2026-09-13, noche): INTEGRADO.** El frontend entregado en `PANEL ANALISTA DE META/app`
> ya vive en este repositorio (`app/`, `components/`) conectado al motor real. Lo que el agente
> dedujo del contrato se corrigió aquí (ver `docs/frontend-entrega/PARA-EL-AGENTE-DEL-MOTOR.md`
> y `git log`). Para futuras iteraciones visuales, este prompt sigue vigente con estas reglas
> adicionales: **el tema es claro** (el cliente pidió los colores de su panel "Espejo"; los
> tokens conservan los nombres), `lib/tipos.ts` es el barril de tipos reales (no se edita), y
> el selector de cuenta publicitaria (cookie `cuenta`) ya está cableado en `lib/datos.ts`.

> Pégalo completo como primer mensaje al agente que va a trabajar la parte visual.
> El repositorio ya funciona de punta a punta: motor, datos y 13 pantallas cableadas.
> Tu trabajo es hacerlo **bonito y claro** sin romper el contrato.

---

## 1. Qué estás recibiendo

Un panel Next.js 15 (App Router, React 19, Tailwind v4, TypeScript strict) llamado **Oráculo**,
para el dueño de una clínica estética en Barranquilla. Ya está construido y probado:

- `lib/` — motor determinista: 145 métricas, 26 reglas de diagnóstico, embudo de 8 pasos
  valorizado en pesos, laboratorio creativo, radar de competencia, oportunidades, 7 lentes,
  privacidad. **No lo toques.** 201 tests lo protegen.
- `lib/datos.ts` — la única puerta de acceso: `await motor()` devuelve `ResultadoMotor` con todo
  lo que una pantalla necesita. Para ver el radar con datos reales: `npm run radar:capturar -- --q "clínica estética barranquilla"`
  y luego `npm run importar-radar -- datos/radar-ui.json --destino datos/seed.json` (regenera el seed con
  `npm run seed` si quieres volver a los sintéticos).
- `components/ui.tsx` — primitivas propias: `Kpi`, `Panel`, `Etiqueta`, `Barra`, `Vacio`, `Celda`,
  `Th`, `Tabla`, `Aviso`, `Titulo`, `Grid`, `formatear()`.
- `components/sidebar.tsx`, `components/cabecera.tsx` — navegación de 4 grupos y barra de estado.
- `app/(panel)/*/page.tsx` — 13 pantallas funcionales (Server Components).
- `app/globals.css` — tema con `@theme` (tokens abajo).

Corre con `npm install && npm run seed && npm run dev` → `http://localhost:3000/panel`.

## 2. Qué te toca

1. **Diseño visual** de las 13 pantallas: jerarquía, ritmo, densidad, tipografía, estados vacíos.
   Estilo: **oscuro, denso, de sala de control**. Profundidad por capas, no gris plano.
2. **Refinar `components/ui.tsx`**: mejorar las primitivas existentes (puedes añadir variantes y
   nuevas primitivas propias). Sin librerías de componentes de terceros.
3. **Un componente de gráfica propio** (SVG/CSS, sin librería) para: serie semanal en Rendimiento,
   barras del embudo, matriz de cuadrantes en Creativos, mapa de ángulos en Competencia.
4. **Responsive** razonable (≥ 1024 px prioridad; tablet aceptable).
5. **Interacciones puntuales** con `"use client"` solo donde haya interacción real (ordenar tablas,
   expandir un hallazgo, tooltips). Las páginas siguen siendo Server Components.
6. **Galería del radar (nuevo).** Los anuncios de la competencia traen el creativo descargado en
   `a.urlMedia` como ruta local (`/radar/<id>.jpg`, servida desde `public/radar/`). En `/competencia`
   y `/biblioteca` muestra la miniatura de cada anuncio (`<img src={a.urlMedia}>` cuando empieza por
   `/radar/`; si es `null` o una URL externa caducable, muestra un marco vacío con el tipo de medio).
   Añade en `/competencia` una vista de **galería de ganadores probados**: cuadrícula de creativos con
   una insignia de días al aire, variantes (`x3`), ángulo y CTA. Es lo que el dueño quiere VER.
7. **Perfil de competidor (nuevo).** `r.lote.competidores[]` ahora trae `seguidoresPagina` (número o
   `null`) y `urlPagina`. Muéstralos en la tabla de competidores; `null` → `—`.
8. **Informe imprimible.** `/informe` debe verse bien en `@media print` (una página carta, fondo claro
   o tinta ahorrada, sin sidebar). El dueño se lo lleva a la reunión en papel o PDF.

## 3. Reglas que NO se negocian (la constitución del proyecto)

- **`null` no es `0`.** Todo dato ausente se muestra como `—`. Nunca inventes un valor, nunca
  pongas 0, nunca ocultes la celda. `formatear(valor, unidad)` ya lo hace: úsalo.
- **Cero jerga técnica** en texto visible: prohibido "API", "MCP", "endpoint", "Zod", "LLM".
  Hay un test (`lib/format/sin-jerga.test.ts`) que recorre `app/` y `components/` y falla si aparecen.
  Se dice "Campañas y audiencias", "Video corto", "Radar de mercado", "Agenda y ventas".
- **Un acento por significado**: `bien` (verde) = va bien · `mal` (rojo) = plata en riesgo ·
  `ojo` (ámbar) = atención · `acento` (azul) = oportunidad/acción. Nada de arcoíris. El color
  solo aparece donde hay una decisión que tomar.
- **`font-variant-numeric: tabular-nums`** en toda cifra (clase `num`). Las columnas no bailan.
- **Pesos sin decimales**, formato es-CO (`$ 1.234.567`). Porcentajes con coma (`9,1 %`).
- **Huecos y advertencias siempre visibles**: `r.contexto.huecos`, `r.lote.meta.advertencias`,
  ventana de atribución (`r.lote.insights[0].ventanaAtribucion`). Ya están en `Cabecera`; no los quites.
- **Los desgloses no suman al total** (Audiencias): la advertencia se muestra.
- **Privacidad**: Audiencias muestra `r.privacidad.segmentosOcultos` y el `AVISO_PANEL`.
- **No modificar `lib/`, `config/`, `scripts/`, `datos/`.** Si necesitas un dato que no está en
  `ResultadoMotor`, pídelo: se añade en `lib/datos.ts` con test, no se calcula en la vista.
- **Nunca promedies razones en la vista.** Si necesitas una tasa agregada, viene del motor.

## 4. Contrato de datos que consumes

```ts
import { motor } from "@/lib/datos";
const r = await motor();   // ResultadoMotor
```

| Campo | Tipo | Para qué pantalla |
|---|---|---|
| `r.hoy`, `r.lote.meta.{desde,hasta,origen,huecos,advertencias}` | fechas, strings | Cabecera, Fuentes |
| `r.maestras` | `ValorMetrica[]` (18) — `{id, nombre, unidad, valor, valorReciente?, valorPrevio, mejorEs, formula, porQueImporta}` | Centro de Mando |
| `r.plataEnRiesgoTotal` | `number \| null` | Centro, Informe |
| `r.hallazgos` | `Hallazgo[]` ordenados por plata — `{reglaId, area, severidad, titulo, explicacion, evidencia[{etiqueta,valor}], acciones[], plataEnRiesgo, metricas[], nota?}` | Diagnóstico, Centro, Informe |
| `r.erroresReglas` | `{reglaId, mensaje}[]` | Diagnóstico (aviso) |
| `r.embudo` | `PasoEmbudo[]` (8) — `{paso, orden, cantidad, tasaPaso, tasaAcumulada, costoUnitario, perdidos, fugaCOP, valorCOP, metodoValorizacion}` | Embudo |
| `r.fugaMasCara` | `PasoEmbudo \| null` | Centro, Informe |
| `r.negocio` | `MetricasNegocio` — showRate, cierreEnConsultorio, costoCitaAsistida, cac, roasReal, poas, ratioCacMargen, ltv, ltvSobreCac, tasaRecompra, ingresosCaja, calibrado | Embudo, Rendimiento, Informe |
| `r.total`, `r.reciente`, `r.previa` | `Agregado` (sumas de crudos) + derivadas en `lib/metrics/core` | Rendimiento |
| `r.serie` | `{fecha, agregado}[]` diario | Rendimiento (gráfica) |
| `r.creativos` | `EvaluacionCreativo[]` — `{creativo, agregado, hookRate, holdRate, ctrEnlace, costoResultado, cuadrante, accion, fatiga{indice, formulaVisible,…}, vidaUtilDias, diasActivo}` | Creativos, Biblioteca |
| `r.contexto.desglosesVisibles`, `r.privacidad` | `BreakdownRow[]`, `{segmentosOcultos, k}` | Audiencias |
| `r.radar` | `ResultadoRadar` — ganadores, cadencia, cadenciaPropia, movimientos, mapaAngulos, espaciosVacios, participacionVoz, perfiles, usoPrecio, usoTestimonio | Competencia, Biblioteca |
| `r.oportunidades` | `Oportunidad[]` — `{titulo, hipotesis, basadaEn[], prueba{presupuestoCOP, duracionDias, metricaExito, criterioCorte}, impacto, confianza, esfuerzo, ice, yaProbada, aprendizajePrevio, origen, tipoPrueba, angulo}` | Oportunidades, Informe |
| `r.lentes` | `ResultadoLente[]` (7) — `{nombre, fuente, paraQue, criterios[{criterio, datoPanel, accionSiFalla, cumple: boolean\|null}], cumplidos, fallidos, sinDato}` | Consejo |
| `r.catalogo` + `resolverMetrica(m, r)` | 145 `MetricaCatalogo` | Métricas |
| `r.fuentes` | `EstadoFuente[]` — `{etiquetaPublica, conectado, ultimaActualizacion, detalle}` | Fuentes |
| `r.cliente`, `r.benchmarks` | config | umbrales para colorear |

Etiquetas públicas (nombres de pasos, ángulos, cuadrantes, áreas, niveles de consciencia):
`lib/format/etiquetas.ts`. Formato: `lib/format/index.ts` (`cop`, `pct`, `num`, `ratio`, `indice`, `deltaPct`, `VACIO`).

## 5. Qué decisión habilita cada pantalla (diseña para eso)

| Ruta | El dueño entra para… | Lo que debe ver en 5 segundos |
|---|---|---|
| `/panel` | saber cómo va y qué hacer hoy | plata en riesgo, 3-5 hallazgos con acción, fuga más cara, próximo experimento |
| `/diagnostico` | entender por qué y con qué evidencia | cada hallazgo: título → evidencia → acciones → plata |
| `/oportunidades` | decidir qué probar | hipótesis, prueba y criterio de corte; lo ya probado marcado |
| `/embudo` | ver dónde se pierde la plata | 8 pasos con fuga en pesos; el peor resaltado |
| `/rendimiento` | saber si la pauta rinde | retorno declarado vs real vs sobre margen; 14 vs 14; serie semanal con huecos |
| `/creativos` | decidir qué anuncio escalar/apagar | matriz de cuadrantes, fatiga con fórmula visible, "esperar señal" explícito |
| `/audiencias` | decidir exclusiones y horarios | fuera de radio, fuera de horario, segmentos que gastan sin producir, ocultos por privacidad |
| `/competencia` | saber qué sostiene el mercado y dónde hay espacio | ganadores de 60+ días (estructura, no copy), ángulos saturados, espacios vacíos |
| `/biblioteca` | escribir la próxima pieza | mensajes propios ganadores + estructuras del mercado por ángulo |
| `/consejo` | auditar con criterio externo | 7 lentes con fuente, criterios ok/fallan/sin dato, acción si falla |
| `/metricas` | entender una cifra | fórmula y "qué decisión cambia" |
| `/informe` | llevar una página a la reunión | 6 cifras, 3 decisiones, dónde se pierde la plata, qué se prueba |
| `/fuentes` | confiar (o no) en los datos | cobertura, huecos, última actualización, conexiones |

## 6. Tema (ya en `app/globals.css`)

```css
@theme {
  --color-fondo: #08090c;  --color-superficie: #0e1014;  --color-superficie-2: #14171d;
  --color-borde: #1e222b;  --color-borde-fuerte: #2c313c;
  --color-texto: #e8eaed;  --color-texto-2: #9aa1ad;  --color-texto-3: #646b78;
  --color-bien: #35d6a4;   --color-mal: #ff5f6d;  --color-ojo: #ffb454;  --color-acento: #6e8cff;
}
```

Clases Tailwind disponibles: `bg-fondo`, `bg-superficie`, `text-texto-2`, `border-borde`, `text-bien`, etc.

## 7. Criterios de aceptación (los verifico yo)

- `npm run typecheck` limpio · `npm test` verde (224+) · `npm run build` sin errores.
- Las 13 rutas responden 200 con el seed (`npm run seed`).
- Ninguna cifra ausente aparece como `0`; aparece `—`.
- El test de jerga sigue verde.
- Ningún archivo de `lib/`, `config/`, `scripts/` cambia (`git diff --stat` lo muestra).
- Nada de librerías de UI (`package.json` no cambia salvo que lo acordemos).

## 8. Trampas conocidas

- Las carpetas `app/(panel)/x` tienen paréntesis: créalas una por una, no con llaves en bash.
- `import.meta` y `node:fs` solo en Server Components; los componentes `"use client"` reciben datos por props.
- No uses `toISOString().slice(0,10)` para fechas: usa `lib/format/fechas`.
- El seed es determinista; si ves los mismos números siempre, es correcto.

Empieza por `/panel` y `/diagnostico`: son las que el dueño abre primero. Muéstrame capturas antes de seguir con el resto.
