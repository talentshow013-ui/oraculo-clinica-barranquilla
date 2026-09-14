# PROMPT — Agente de diseño (frontend): pantalla **Campañas**

> **Estado (2026-09-13, noche): INTEGRADO.** La pantalla entregada por el agente de diseño vive en `app/(panel)/campanas/page.tsx` y `components/cliente/campanas-url.tsx`; el menú tiene la entrada. Ajustes de empalme hechos aquí: alias `EstadoCampana` en `lib/tipos.ts`, `tonoDelta(delta, mejorEs)` con la firma real, y el periodo por defecto es «Todo» (el contrato), no 30.

> Pégalo completo como primer mensaje al agente que hace la parte visual. El repositorio ya
> tiene los números listos; falta **una pantalla nueva** que los pinte. Nada más.
> Repositorio: `CLIENTE PILAR BARRANQUILA/ANALITICA DE DATOS FACEBOOK` (Next 15, React 19,
> Tailwind 4, TypeScript strict). Arranca con `npm install && npm run seed && npm run dev` →
> `http://localhost:3000/panel`. Tema **claro**, sin librerías de UI.

---

## 1. El problema que resuelve

Hoy el panel muestra la cuenta publicitaria **sumada**: todas las pautas juntas. El dueño quiere
ver **cada pauta con cara propia** — la que está al aire, la que se pausó en mayo, la que se
archivó — y **comparar dos** ("¿cómo le fue a la de láser de junio contra la de ahora?").
También quiere escoger el periodo (últimos 14 / 30 / 90 días / todo).

## 2. Qué construyes (y solo eso)

1. `app/(panel)/campanas/page.tsx` — Server Component, `async`, ruta `/campanas`.
2. Un componente cliente pequeño para el selector de periodo y para elegir las dos campañas a
   comparar (los tres viajan en la URL como `?periodo=30&a=<id>&b=<id>`; el Server Component los
   lee de `searchParams` y vuelve a pedir los datos). Sin estado global, sin fetch propio.
3. Añadir la entrada al menú en `components/sidebar.tsx`, grupo **Entender**, después de
   «Rendimiento»: `{ a: '/campanas', nombre: 'Campañas', icono: … }` (ícono SVG propio, 18 px,
   trazo 1.5 como los demás).

**No tocas** `lib/`, `config/`, `scripts/`, ni `lib/tipos.ts`. Los números ya vienen calculados.

## 3. De dónde salen los datos (contrato real, ya en el repo)

```ts
import { motor, campanasEnPeriodo, compararCampanas } from '@/lib/datos'
import type { ResumenCampana, ComparacionCampanas, PeriodoCampanas } from '@/lib/tipos'

export default async function Campanas({ searchParams }: { searchParams: Promise<{ periodo?: string; a?: string; b?: string }> }) {
  const { periodo, a, b } = await searchParams
  const r = await motor()                              // la cuenta elegida en la cabecera
  const vista = campanasEnPeriodo(r, periodo)          // { periodo, desde, hasta, campanas }
  const ca = vista.campanas.find((c) => c.id === a)
  const cb = vista.campanas.find((c) => c.id === b)
  const comparacion = ca && cb && ca.id !== cb.id ? compararCampanas(ca, cb) : null
  …
}
```

`ResumenCampana` (una fila por campaña, **ya ordenadas por inversión descendente**):

| campo | tipo | qué es |
|---|---|---|
| `id`, `nombre` | string | identidad |
| `estado` | `'activo' \| 'pausado' \| 'archivado' \| 'en_revision' \| 'rechazado'` | estado ACTUAL según la plataforma |
| `alAire` | boolean | activa **y** con gasto en los últimos 3 días del periodo |
| `primerDia`, `ultimoDia` | `string \| null` (YYYY-MM-DD) | primer y último día con gasto dentro del periodo |
| `diasConGasto` | number | días en que gastó |
| `nConjuntos`, `nAnuncios` | number | hijos (0 si la fuente no los trae) |
| `total` | `Agregado` | sumas de crudos: `gasto`, `impresiones`, `alcance`, `clics`, `clicsEnlace`, `resultados`, `conversacionesIniciadas`, `conversacionesRespondidas`, … |
| `participacionGasto` | `number \| null` | fracción 0–1 del gasto del periodo |
| `costoResultado`, `costoConversacion`, `cpm` | `number \| null` | pesos |
| `ctrEnlace`, `tasaConversacion` | `number \| null` | fracción 0–1 |
| `frecuencia` | `number \| null` | razón |

`ComparacionCampanas`: `{ a, b, diasDistintos, aviso: string | null, metricas: MetricaComparada[] }`
con `MetricaComparada = { id, nombre, unidad: 'cop'|'numero'|'porcentaje'|'ratio', mejorEs: 'mayor'|'menor'|'rango'|'informativo', a, b, delta, comparable }`.
`comparable === false` significa "es una suma y las campañas corrieron días distintos": píntala en
gris y sin flecha de mejor/peor. `aviso` ya viene redactado; muéstralo tal cual.

`vista.periodo` es `'14' | '30' | '90' | 'todo'`; `vista.desde` / `vista.hasta` son las fechas
reales del recorte (para el rótulo "del 30 ago al 12 sep").

Formato: **siempre** `cop()`, `pct()`, `num()`, `ratio()` de `@/lib/format` y `fechaCorta()` de
`@/lib/format/fechas`. Jamás `toFixed` ni `toLocaleString` a mano. `null` → `—` (lo hacen solos).
Etiquetas de estado en español: usa un mapa local `{ activo: 'Activa', pausado: 'Pausada', archivado: 'Archivada', en_revision: 'En revisión', rechazado: 'Rechazada' }`.

## 4. Cómo se ve (diseña para la decisión)

**Arriba** — título «¿Cómo le fue a cada pauta?», rótulo con la cuenta y el rango de fechas,
y el selector de periodo como cuatro pastillas (14 · 30 · 90 · Todo). Cambiar de pastilla
cambia la URL y refresca (`router.push`), igual que hace `components/cliente/selector-cuenta.tsx`
con la cookie.

**Bloque 1 — Las pautas** (tabla ordenable; reutiliza `components/cliente/ordenable.tsx`):
columnas: Campaña (nombre + etiqueta de estado + punto verde si `alAire`), Periodo
(`fechaCorta(primerDia)` → `fechaCorta(ultimoDia)` · `diasConGasto` d), Inversión, % del gasto
(barra fina: `components/ui.tsx → Barra`), Conversaciones, Resultados, Costo por resultado,
Costo por conversación, Clic en el enlace, Frecuencia. Orden inicial: Inversión.
Las **pausadas/archivadas se ven igual de claras, no escondidas**: solo la etiqueta cambia de tono
(`Etiqueta tono="neutro"`). Fila con `alAire` → etiqueta `tono="bien"`.
Cada fila tiene dos botones discretos «A» y «B» que la ponen en la comparación (cambian `?a=` / `?b=`).

**Bloque 2 — Comparar dos** (solo aparece cuando hay `comparacion`; si no, un `Vacio` que
explique «Elige A y B en la tabla para verlas lado a lado»):
dos columnas con el nombre, estado y periodo de cada una; debajo, una fila por métrica con
valor A, valor B y el delta con flecha coloreada por `mejorEs` (usa `tonoDelta` de
`components/ui.tsx`; si `comparable === false`, gris y sin flecha). El `aviso`, si viene, en
un `Aviso tono="ojo"` encima de la tabla.

**Bloque 3 — Cómo se calcula** (un `Panel` corto al pie, texto fijo):
«Cada campaña suma sus propios días de pauta; los costos y tasas se recalculan desde esas sumas.
Comparar dos que corrieron días distintos: mira costos y tasas, no las sumas. Una campaña
pausada sigue apareciendo con su historia; solo deja de estar "al aire".»

Estado vacío global (`vista.campanas.length === 0`): `Vacio` con «Ninguna campaña gastó en este
periodo» y una pista para ampliar el periodo.

## 5. Reglas que no se negocian

- Nada de cifras calculadas en la interfaz: ni sumas, ni promedios, ni divisiones. Todo viene en
  `ResumenCampana` / `ComparacionCampanas`.
- `null` nunca es cero. Nunca `0` donde el dato no existe.
- Cero jerga técnica en texto visible (no «API», «endpoint», «query», «CTR» a secas: di «Clic en el
  enlace»). Hay un test que lo revisa.
- Server Component para la página; `"use client"` solo en el selector de periodo y los botones A/B.
- Mismas primitivas que el resto (`Titulo`, `Panel`, `Grid`, `Kpi`, `Etiqueta`, `Barra`, `Aviso`,
  `Vacio`, `Tabla/Th/Celda`, `Ordenable`). Nada de librerías nuevas: `package.json` no cambia.
- Responsive como las demás pantallas: la tabla va dentro de su propio contenedor con scroll
  horizontal; nunca la página entera.

## 6. Cómo verifico la entrega

- `npm run typecheck` limpio · `npm test` verde (250) · `npm run build` sin errores.
- `/campanas`, `/campanas?periodo=14`, `/campanas?periodo=todo&a=camp_facial&b=camp_madre` responden
  200 con el seed. Con el seed, la cuenta principal muestra **dos** campañas: «Facial · Toxina y ácido»
  (al aire) y «Promoción · Mes de la madre (terminada)» (pausada, 21 abr → 26 may, 36 días). En
  `?periodo=14` la terminada **no** aparece (no gastó).
- Una captura de cada bloque.
- `git diff --stat` solo muestra `app/(panel)/campanas/**`, `components/sidebar.tsx` y, si creaste
  alguno, `components/cliente/<nuevo>.tsx`.

## 7. Trampas conocidas

- La carpeta `app/(panel)/campanas` lleva paréntesis en el padre: créala con el explorador o con
  comillas; no con llaves en bash.
- `searchParams` en Next 15 es una **promesa**: `await`.
- Para fechas usa `lib/format/fechas` (`fechaCorta`), nunca `new Date(...).toLocaleDateString` a mano.
- El seed es determinista: si ves siempre los mismos números, es correcto.

Entrega la carpeta y avísame; yo la integro y la verifico.
