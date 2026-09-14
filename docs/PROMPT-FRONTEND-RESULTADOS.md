# PROMPT — Agente de diseño (frontend): resultados por pauta dentro de **Campañas**

> **Estado: INTEGRADO** (bloque de resultados y tres columnas ya viven en `app/(panel)/campanas/`; `ordenable.tsx` compactado por el agente para que quepan 13 columnas).

> Pégalo completo como primer mensaje al agente que hace la parte visual. Es **un bloque dentro de
> una pantalla que ya existe** (`/campanas`). No se crea ninguna pestaña. El motor y el guardado
> ya existen y están probados. Repositorio: `CLIENTE PILAR BARRANQUILA/ANALITICA DE DATOS
> FACEBOOK` (Next 15, React 19, Tailwind 4, TypeScript strict). `npm install && npm run seed &&
> npm run dev` → `http://localhost:3000/campanas`. Tema **claro**, sin librerías de UI.

---

## 1. El problema que resuelve

Meta solo ve hasta «conversación iniciada». Lo que pasa después (contactos cerrados, citas,
asistencia, ventas) solo lo sabe la clínica, **y es por campaña**: cuando una pauta corre o
termina, el equipo anota sus cinco números. Con eso, cada campaña muestra citas y ventas al lado
de su inversión, y la comparación A/B que ya existe las incluye. Sin semanas, sin planillas, sin
nombres de pacientes (el esquema no admite texto libre).

## 2. Qué construyes (y solo eso)

En `app/(panel)/campanas/page.tsx` (ya existe; la editas):

1. **Tres columnas nuevas** en la tabla «Las pautas», después de «Costo por conversación»:
   **Citas asistidas** (`c.citasAsistidas`), **Costo por cita asistida** (`c.costoCitaAsistida`),
   **Ventas** (`c.ventas`). `null` → «—» (lo hacen `num()`/`cop()` solos).
2. En cada fila, un botón discreto **«Resultados»** que lleva a `?registrar=<id>` (conserva el
   resto de la URL, como hacen los botones A/B de `components/cliente/campanas-url.tsx`).
3. Un bloque **«Resultados de la campaña»** con `id="resultados"`, debajo de la tabla, que
   aparece cuando viene `?registrar=<id>` (o `?guardada=` / `?error=`): el formulario de cinco
   casillas para ESA campaña. Si ya tiene resultados registrados (`r.resultadosPauta`), viene
   **prellenado** y el título dice «Corregir resultados».

**No tocas** `lib/`, `config/`, `scripts/`, `lib/tipos.ts` ni `app/(panel)/campanas/acciones.ts`
(el guardado). El formulario **debe** enviar a esa acción tal cual.

## 3. Contrato (ya en el repo)

```ts
import { motor, campanasEnPeriodo, compararCampanas } from '@/lib/datos'
import { tasaAsistencia, tasaCierre } from '@/lib/resultados'
import type { ResumenCampana, RegistroPauta } from '@/lib/tipos'
import { guardarResultadosPautaAccion } from './acciones'   // <form action={guardarResultadosPautaAccion}>

const { periodo, a, b, registrar, guardada, error } = await searchParams   // promesa: await
const r = await motor()
r.resultadosPauta        // RegistroPauta[] de la cuenta que se ve: { cuentaId, campanaId, contactosCerrados, citasAgendadas, citasAsistidas, ventas, valorVentasCOP: number|null, registradoEn }
tasaAsistencia(reg)      // asistidas / agendadas → number | null
tasaCierre(reg)          // ventas / asistidas  → number | null
```

`ResumenCampana` ahora trae además: `citasAgendadas`, `citasAsistidas`, `ventas`, `valorVentasCOP`,
`costoCitaAsistida` (todos `number | null`; null = no se registró). `compararCampanas` ya incluye
«Citas asistidas (agenda)», «Costo por cita asistida» y «Ventas (agenda)» en `metricas[]`.

**El formulario** (los `name` son fijos; la acción los lee así):

| name | tipo | obligatorio |
|---|---|---|
| `campana` | oculto, `value = id` de la campaña | sí |
| `contactosCerrados` | entero ≥ 0 | sí |
| `citasAgendadas` | entero ≥ 0 | sí |
| `citasAsistidas` | entero ≥ 0, ≤ agendadas | sí |
| `ventas` | entero ≥ 0, ≤ asistidas | sí |
| `valorVentasCOP` | entero ≥ 0 (acepta puntos de miles: «9.750.000») | no (vacío = «—») |

La acción valida, guarda y **redirige** a `/campanas?guardada=<id>#resultados` si salió bien, o a
`/campanas?registrar=<id>&error=<mensaje>#resultados` si no. Los mensajes ya vienen en español y
sin jerga («No pueden asistir más citas de las agendadas»): muéstralos tal cual en un `Aviso`.

Formato: `cop()`, `pct()`, `num()` de `@/lib/format`; `fechaHora()` de `@/lib/format/fechas`.
Nunca `toFixed`/`toLocaleString` a mano.

## 4. Cómo se ve

El bloque «Resultados de la campaña» va en un `Panel` con el nombre de la campaña, su estado y su
periodo (como la ranura A/B), y las cinco casillas grandes (`inputMode="numeric"`), en dos
columnas en escritorio y una en móvil, cada una con su ayuda de una línea:
- Contactos cerrados — «Personas que escribieron y sí eran candidatas.»
- Citas agendadas — «Valoraciones o procedimientos que quedaron en la agenda.»
- Citas asistidas — «Las que de verdad llegaron a la clínica.»
- Ventas — «Personas que pagaron un procedimiento tras la cita.»
- Valor vendido (pesos) · opcional — «Suma de lo facturado. Si no se sabe, en blanco.»
Al pie: «Solo cantidades. Ni nombres, ni teléfonos, ni notas: aquí no caben y el sistema los
rechaza.» Botón único **«Guardar resultados»**. Si ya había registro: «registrados el {fechaHora}»
y las tasas (`tasaAsistencia`, `tasaCierre`) como `Etiqueta`.
`?guardada=` → `Aviso tono="bien"` «Resultados de {nombre} guardados. La tabla y la comparación ya
los usan.»

Sin `?registrar=` el bloque no aparece: la pantalla se ve como hoy, solo con las tres columnas.

## 5. Reglas que no se negocian

- Cero cifras calculadas en la interfaz. `null` nunca es cero. Cero jerga (hay un test).
- Formulario HTML nativo hacia la acción; nada de `onSubmit` con fetch. Sin `<textarea>`.
- Mismas primitivas (`Panel`, `Aviso`, `Etiqueta`, `Vacio`…). Nada nuevo en `package.json`.
- La tabla sigue dentro de su contenedor con scroll; en 1366 px con barra lateral debe caber
  sin scroll (revisa anchos de columna).

## 6. Cómo verifico la entrega

- `npm run typecheck` limpio · `npm test` verde (271) · `npm run build` sin errores.
- `/campanas`, `/campanas?registrar=camp_madre`, `/campanas?guardada=camp_madre`,
  `/campanas?registrar=camp_madre&error=prueba` → 200.
- Desde el navegador: «Resultados» en la fila de «Promoción · Mes de la madre» → 90 / 48 / 33 /
  15 / 9.750.000 → guardar → la fila muestra 33 citas asistidas y 15 ventas, y la comparación
  A/B las incluye. Escribir 9 asistidas de 5 agendadas muestra el error y no guarda.
- Capturas en 1440 y 390 px.
- `git diff --stat` solo muestra `app/(panel)/campanas/page.tsx` y, si lo tocaste,
  `components/cliente/campanas-url.tsx`.

## 7. Trampas conocidas

- `searchParams` en Next 15 es una **promesa**: `await`.
- El formulario de resultados debe ser su propio `<form>`; no lo anides en la tabla ordenable.

Entrega y avísame; yo lo integro y lo verifico.
