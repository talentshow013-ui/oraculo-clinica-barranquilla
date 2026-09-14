# PROMPT — Agente de diseño (frontend): pantalla **Reunión quincenal** (la bitácora)

> Pégalo completo como primer mensaje al agente que hace la parte visual. El motor y las tres
> acciones de guardado ya existen y están probadas; **no hay pantalla**: la construyes tú.
> Repositorio: `CLIENTE PILAR BARRANQUILA/ANALITICA DE DATOS FACEBOOK` (Next 15, React 19,
> Tailwind 4, TypeScript strict). `npm install && npm run seed && npm run dev` →
> `http://localhost:3000/reunion`. Tema **claro**, sin librerías de UI.

---

## 1. El problema que resuelve

El equipo de marketing se reúne **cada quince días** con el panel. Hoy el panel da las cifras,
pero no tiene dónde anotar **qué se decidió** ni, en la siguiente reunión, **cómo nos fue con eso**.
Cada reunión empieza de cero y nadie sabe si lo que se hizo funcionó.

La bitácora hace tres cosas:
1. **Abrir la reunión de hoy**: el motor guarda una **foto** de las cifras que mandan (14 días
   contra los 14 anteriores). Nadie escribe números.
2. **Anotar decisiones**: «Subir presupuesto de Facial 20 %», con la métrica con la que se juzgará
   (elegida de la foto), una meta opcional y el tipo de prueba. Queda «en curso» y se evalúa a
   los 14 días.
3. **Evaluar en la próxima reunión**: cada decisión pendiente se ve con **antes → ahora** (el motor
   pone los dos valores) y el equipo marca **ganó / perdió / sin señal** y qué aprendió.

Las decisiones alimentan las Oportunidades (no se vuelve a proponer lo que ya perdió).

## 2. Qué construyes (y solo eso)

1. `app/(panel)/reunion/page.tsx` — Server Component `async`, ruta `/reunion`, lee `searchParams`
   (promesa: `await`) con `{ ok?, error?, reunion? }`.
2. Componentes `"use client"` pequeños si hacen falta, en `components/cliente/reunion-*.tsx`
   (por ejemplo, un `<select>` de métrica que muestre el valor actual al lado). Sin fetch propio.
3. Entrada en el menú (`components/sidebar.tsx`), grupo **Decidir**, después de «Oportunidades»:
   `{ a: '/reunion', nombre: 'Reunión quincenal', icono: … }` (SVG propio, 18 px, trazo 1.5).

**No tocas** `lib/`, `config/`, `scripts/`, `lib/tipos.ts` ni `app/(panel)/reunion/acciones.ts`.

## 3. Contrato (ya en el repo)

```ts
import { motor } from '@/lib/datos'
import { compararDecision } from '@/lib/reuniones'
import type { Reunion, Decision, DecisionPendiente, FotoReunion, MetricaFoto, ComparacionDecision } from '@/lib/tipos'
import { abrirReunionAccion, agregarDecisionAccion, evaluarDecisionAccion } from './acciones'

const r = await motor()
r.hoy                    // 'YYYY-MM-DD'
r.reuniones              // Reunion[] de la cuenta que se ve, la más reciente primero
r.decisionesPendientes   // DecisionPendiente[] (resultado 'en_curso'), ordenadas por evaluarEl
r.fotoActual             // FotoReunion: las cifras de HOY (misma forma que la foto guardada)
compararDecision(d, r.fotoActual) // → { antes, ahora, delta, mejoro, objetivoCumplido, mejorEs, unidad, nombre }
```

Tipos:
- `Reunion = { id, cuentaId, fecha, foto: FotoReunion, decisiones: Decision[], registradaEn }`
- `FotoReunion = { fecha, metricas: MetricaFoto[] }` ·
  `MetricaFoto = { id, nombre, unidad, mejorEs, reciente, previo, ventana: '14d' | 'periodo' }`
  (`ventana: 'periodo'` = no hay 14 días para esa cifra: muestra solo `reciente`, sin delta).
- `Decision = { id, texto, metricaId, valorAlDecidir, objetivo, tipoPrueba, evaluarEl, resultado:
  'en_curso'|'gano'|'perdio'|'sin_senal', valorAlEvaluar, aprendizaje, evaluadaEn }`
- `DecisionPendiente = Decision & { reunionId, reunionFecha }`
- `ComparacionDecision.mejoro`: `true` verde, `false` rojo, `null` gris (sin métrica o informativa).

**Las tres acciones** (formularios HTML nativos con `action={…}`; los `name` son fijos):

| acción | campos | vuelve a |
|---|---|---|
| `abrirReunionAccion` | `fecha` (YYYY-MM-DD; por defecto `r.hoy`) | `/reunion?ok=reunion&reunion=<id>` o `?error=…` |
| `agregarDecisionAccion` | `reunion` (id, oculto) · `texto` (obligatorio) · `metricaId` (id de `reunion.foto.metricas` o vacío) · `objetivo` (número, opcional; acepta «1.000») · `tipoPrueba` (`creativo`/`audiencia`/`oferta`/`proceso`/`presupuesto`) · `evaluarEl` (opcional; por defecto +14 días) | `/reunion?ok=decision&reunion=<id>` o `?reunion=<id>&error=…` |
| `evaluarDecisionAccion` | `decision` (id, oculto) · `resultado` (`gano`/`perdio`/`sin_senal`) · `aprendizaje` (texto, opcional) | `/reunion?ok=evaluada` o `?error=…` |

Los textos rechazan teléfonos, correos y datos de pacientes; el mensaje de error ya viene
redactado: muéstralo tal cual.

Etiquetas en español (mapa local): `tipoPrueba` → Creativo / Audiencia / Oferta / Proceso /
Presupuesto; `resultado` → En curso / Ganó / Perdió / Sin señal.
Formato: `cop()`, `pct()`, `num()`, `ratio()`, `formatear(valor, unidad)` de `@/lib/format`;
`fechaCorta()`, `fechaHora()` de `@/lib/format/fechas`. `null` → «—».

## 4. Cómo se ve (diseña para la reunión, no para la tabla)

**Arriba** — «¿Qué decidimos y cómo nos fue?», rótulo «Reunión quincenal · bitácora», y el botón
**«Abrir la reunión de hoy»** (formulario de `abrirReunionAccion` con `fecha` oculta = `r.hoy`).
Si ya hay una reunión con `fecha === r.hoy`, el botón no aparece: se muestra esa reunión abierta.
`ok`/`error` → `Aviso`.

**Bloque 1 — Por evaluar** (lo primero, porque es lo que la reunión debe resolver): una tarjeta
por `DecisionPendiente`: texto de la decisión, «decidida el {reunionFecha}», la métrica con
**antes → ahora** (`compararDecision`) y el delta con flecha coloreada por `mejoro`; la meta si la
hay («meta: …», cumplida/no). Debajo, el formulario de `evaluarDecisionAccion`: tres botones
grandes **Ganó / Perdió / Sin señal** (radios estilizados, `name="resultado"`) y un campo corto
«¿Qué aprendimos?» (`name="aprendizaje"`). Vacío: «Nada pendiente. Abre la reunión y anota lo que
decidan hoy.»

**Bloque 2 — La reunión abierta** (la más reciente): la **foto** en una cuadrícula compacta de
las 18 cifras (`foto.metricas`): nombre, `reciente` grande, `previo` pequeño y delta coloreado
por `mejorEs` (usa `tonoDelta` de `components/ui.tsx`; `informativo` y `ventana: 'periodo'` →
neutro sin flecha). Debajo, **«Anotar una decisión»**: formulario de `agregarDecisionAccion`
con `texto` (una línea, placeholder «Subir presupuesto de Facial 20 %»), `metricaId` (select con
las métricas de la foto y su valor actual al lado), `objetivo` (opcional), `tipoPrueba`
(pastillas) y `evaluarEl` (por defecto +14 días, editable). Lista de decisiones ya anotadas en
esta reunión con su etiqueta de estado.

**Bloque 3 — Reuniones anteriores**: acordeón (`components/cliente/plegable.tsx`) por reunión:
fecha, cuántas decisiones y cuántas ganaron/perdieron; dentro, cada decisión con antes → después
(`valorAlDecidir` → `valorAlEvaluar`), resultado y aprendizaje. Es el historial que se lee en
voz alta al empezar cada reunión.

**Móvil**: la reunión se hace a veces desde el celular; 390 px sin desbordes.

## 5. Reglas que no se negocian

- Ningún número lo calcula la interfaz: foto, antes/ahora y deltas vienen del motor.
- `null` nunca es cero. Cero jerga (hay un test que revisa el HTML).
- Formularios HTML nativos hacia las tres acciones; nada de `onSubmit` con fetch.
- Mismas primitivas (`Titulo`, `Panel`, `Grid`, `Kpi`, `Etiqueta`, `Aviso`, `Vacio`, `Plegable`…).
  Nada nuevo en `package.json`.

## 6. Cómo verifico la entrega

- `npm run typecheck` limpio · `npm test` verde (286) · `npm run build` sin errores.
- `/reunion`, `/reunion?ok=reunion`, `/reunion?error=prueba` → 200.
- Desde el navegador: abrir reunión → anotar decisión con métrica «Costo por clic de enlace» y
  meta 1.000 → aparece en «Por evaluar» con antes → ahora → evaluar «Ganó» con aprendizaje →
  desaparece de pendientes y aparece en el historial. Escribir «llamar al 3001234567» muestra el
  error y no guarda. Cambiar de cuenta en la cabecera muestra otra bitácora (vacía).
- Capturas en 1440 y 390 px.
- `git diff --stat` solo muestra `app/(panel)/reunion/page.tsx`, `components/sidebar.tsx` y, si
  creaste alguno, `components/cliente/reunion-*.tsx`.

## 7. Trampas conocidas

- La carpeta `app/(panel)/reunion` lleva paréntesis en el padre: créala con el explorador o con
  comillas; no con llaves en bash.
- `searchParams` en Next 15 es una **promesa**: `await`.
- El botón «Abrir la reunión de hoy» debe estar en su propio `<form>`; no anides formularios.

Entrega la carpeta y avísame; yo la integro y la verifico.
