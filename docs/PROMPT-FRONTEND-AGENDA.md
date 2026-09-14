# PROMPT — Agente de diseño (frontend): pantalla **Agenda semanal**

> Pégalo completo como primer mensaje al agente que hace la parte visual. El motor, el esquema y
> el guardado ya existen y están probados; hay una **pantalla provisional** que debes **reemplazar**
> con tu diseño. Repositorio: `CLIENTE PILAR BARRANQUILA/ANALITICA DE DATOS FACEBOOK` (Next 15,
> React 19, Tailwind 4, TypeScript strict). `npm install && npm run seed && npm run dev` →
> `http://localhost:3000/agenda`. Tema **claro**, sin librerías de UI.

---

## 1. El problema que resuelve

Meta solo ve hasta «conversación iniciada». Lo que pasa después (cita, asistencia, venta) solo lo
sabe la clínica. Aquí la coordinadora escribe, **cada lunes, cinco números de la semana anterior**.
Dos minutos. Sin planillas, sin nombres de pacientes (el esquema no admite texto libre).
Con eso el embudo llega hasta la venta y la fuga se muestra en pesos.

Quien la usa: una coordinadora con poco tiempo, desde el PC o el celular. Tiene que ser
**imposible equivocarse** y **obvio qué semana está registrando**.

## 2. Qué construyes (y solo eso)

1. `app/(panel)/agenda/page.tsx` — **reemplaza** la provisional. Server Component `async`,
   ruta `/agenda`, lee `searchParams` (promesa: `await`) con `{ semana?, guardada?, error? }`.
2. Si necesitas interacción (p. ej. validación en vivo, resaltar la semana elegida), un componente
   `"use client"` pequeño en `components/cliente/agenda-*.tsx`. Sin fetch propio, sin estado global.
3. La entrada del menú ya existe (`components/sidebar.tsx`, grupo **Confiar**, «Agenda semanal»).
   No la muevas.

**No tocas** `lib/`, `config/`, `scripts/`, `lib/tipos.ts` ni `app/(panel)/agenda/acciones.ts`
(el guardado). El formulario **debe** enviar a esa acción tal cual.

## 3. Contrato (ya en el repo)

```ts
import { motor } from '@/lib/datos'
import { semanasRecientes, tasaAsistencia, tasaCierre } from '@/lib/agenda'
import type { RegistroSemanal, Semana } from '@/lib/tipos'
import { guardarSemanaAccion } from './acciones'   // server action: <form action={guardarSemanaAccion}>

const r = await motor()
r.hoy                       // 'YYYY-MM-DD' Bogotá
r.agenda                    // RegistroSemanal[] ya registradas, la más reciente primero
semanasRecientes(r.hoy, 10) // Semana[] = { desde (lunes), hasta (domingo) }, últimas 10 completas, reciente primero
tasaAsistencia(s)           // asistidas / agendadas → number | null
tasaCierre(s)               // ventas / asistidas  → number | null
```

`RegistroSemanal`: `{ cuentaId, campanaId: string|null (null = toda la cuenta), desde, hasta, contactosCalificados, citasAgendadas, citasAsistidas, ventas, valorVentasCOP: number|null, recompras: number|null, registradoEn: string (ISO) }`.

**El formulario** (los `name` son fijos; la acción los lee así):

| name | tipo | obligatorio |
|---|---|---|
| `semana` | `<select>`/radios con `value = desde` de una `Semana` | sí |
| `campana` | `<select>` con `value = c.id` de `r.campanas` (nombre visible `c.nombre`) o `""` = «Toda la cuenta (no sé de cuál)» | sí (puede ir vacío) |
| `contactosCalificados` | entero ≥ 0 | sí |
| `citasAgendadas` | entero ≥ 0 | sí |
| `citasAsistidas` | entero ≥ 0, ≤ agendadas | sí |
| `ventas` | entero ≥ 0, ≤ asistidas | sí |
| `valorVentasCOP` | entero ≥ 0 (acepta puntos de miles: «4.900.000») | no (vacío = «—») |
| `recompras` | entero ≥ 0 | no (vacío = «—») |

La acción valida, guarda y **redirige**: `/agenda?guardada=<desde>` si salió bien, o
`/agenda?semana=<desde>&error=<mensaje>` si no. Los mensajes de error ya vienen en español y sin
jerga («No pueden asistir más citas de las agendadas», «La semana va de lunes a domingo»…):
muéstralos tal cual. Para **corregir** una semana ya registrada se llega con `?semana=<desde>&campana=<id|vacío>`:
el formulario debe venir **prellenado** con los valores de `r.agenda` de esa semana y campaña.
**Se registra por campaña** (una fila por campaña y semana); «toda la cuenta» es para cuando no se
sabe de cuál salieron, y reemplaza lo de las campañas de esa semana (y al revés). Muéstralo con una
frase corta debajo del selector.

Formato: `cop()`, `pct()`, `num()` de `@/lib/format`; `fechaCorta()`, `fechaHora()` de
`@/lib/format/fechas`. Nunca `toFixed`/`toLocaleString` a mano. `null` → «—».

## 4. Cómo se ve (diseña para que no se equivoquen)

**Arriba** — título «¿Qué pasó después de la conversación?», rótulo «Agenda semanal · lo que Meta
no ve», una frase de contexto. Si viene `guardada` → `Aviso tono="bien"` («Semana del … guardada.
El panel ya la está usando»); si viene `error` → `Aviso tono="mal"`.

**Bloque 1 — La semana** (lo primero que se ve): la semana elegida en grande, **«lunes 7 → domingo
13 de septiembre»**, con las otras 9 como pastillas o lista; las ya registradas marcadas
(«registrada»). Por defecto, la semana pasada (`semanasRecientes(r.hoy, 10)[0]`) o la de
`?semana=`.

**Bloque 2 — Los cinco números**: campos grandes, `inputMode="numeric"`, uno debajo del otro en
móvil y en dos columnas en escritorio, cada uno con su ayuda de una línea:
- Contactos calificados — «Personas que escribieron y sí eran candidatas.»
- Citas agendadas — «Valoraciones o procedimientos que quedaron en la agenda.»
- Citas asistidas — «Las que de verdad llegaron a la clínica.»
- Ventas — «Personas que pagaron un procedimiento tras la cita.»
- Valor vendido (pesos) · opcional — «Suma de lo facturado. Si no se sabe, en blanco.»
- Recompras · opcional — «Pacientes anteriores que volvieron a comprar.»
Ayuda visual del embudo mientras escriben (opcional, cliente): asistidas no puede superar
agendadas, ventas no puede superar asistidas; si pasa, avisar antes de enviar.
Al pie: «Solo cantidades. Ni nombres, ni teléfonos, ni notas: aquí no caben y el sistema los
rechaza.» Botón único **«Guardar semana»**.

**Bloque 3 — Registradas**: tabla o tarjetas con `r.agenda`, agrupadas por semana y dentro por
campaña (nombre desde `r.campanas`; `null` → «Toda la cuenta»): semana (enlace a
`?semana=<desde>&campana=<id>` para corregir), agendadas, asistieron (+ `Etiqueta` con `tasaAsistencia`: ≥ 75 % bien, ≥ 60 % ojo,
menos mal), ventas (+ `tasaCierre` pequeño), valor, «registrada el …» (`fechaHora`).
Vacío: `Vacio` «El embudo termina en la conversación» + «Registra la semana pasada para empezar».

**Estados**: móvil primero (390 px), sin desbordes; la tabla en su propio contenedor con scroll.

## 5. Reglas que no se negocian

- Cero cifras calculadas en la interfaz (las tasas vienen de `lib/agenda`).
- `null` nunca es cero. Cero jerga (hay un test que revisa el HTML).
- Sin texto libre en el formulario: ningún `<textarea>`, ninguna «nota».
- Mismas primitivas (`Titulo`, `Panel`, `Aviso`, `Etiqueta`, `Vacio`, `Tabla/Th/Celda`…). Nada
  nuevo en `package.json`.

## 6. Cómo verifico la entrega

- `npm run typecheck` limpio · `npm test` verde (278) · `npm run build` sin errores.
- `/agenda`, `/agenda?semana=2026-08-31`, `/agenda?guardada=2026-08-31`,
  `/agenda?error=prueba` → 200.
- Guardar desde el navegador crea `datos/agenda.json`; corregir la misma semana la reemplaza;
  «9 asistidas de 5 agendadas» muestra el error y no guarda.
- Capturas en 1440 y 390 px.
- `git diff --stat` solo muestra `app/(panel)/agenda/page.tsx` y, si creaste alguno,
  `components/cliente/agenda-*.tsx`.

## 7. Trampas conocidas

- La carpeta `app/(panel)/agenda` lleva paréntesis en el padre: créala con el explorador o con
  comillas; no con llaves en bash.
- `searchParams` en Next 15 es una **promesa**: `await`.
- El `<form>` debe ser HTML nativo con `action={guardarSemanaAccion}`; nada de `onSubmit` con fetch.

Entrega la carpeta y avísame; yo la integro y la verifico.
