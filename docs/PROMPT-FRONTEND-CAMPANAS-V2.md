# PROMPT — Agente de diseño (frontend): **Campañas v2** — comparar varias y «cómo nos fue»

> **Estado: INTEGRADO** (selector de comparación con casillas, tabla métrica × campañas y «Cómo nos fue» ya viven en `app/(panel)/campanas/`).

> Pégalo completo como primer mensaje al agente que hace la parte visual. Son **dos cambios dentro
> de `/campanas`** (que ya existe y ya tiene el bloque de Resultados). No se crea ninguna pestaña.
> El motor ya lo calcula todo. Repositorio: `CLIENTE PILAR BARRANQUILA/ANALITICA DE DATOS FACEBOOK`
> (Next 15, React 19, Tailwind 4, TypeScript strict). `npm install && npm run seed && npm run dev`
> → `http://localhost:3000/campanas`. Tema **claro**, sin librerías de UI.

---

## 1. Qué cambia y por qué

1. **Fuera A y B.** El equipo de analítica quiere escoger **las campañas que quiera** (2, 3, 5…) en
   una **lista desplegable con casillas** y verlas todas lado a lado. Los botones A/B de cada fila,
   las ranuras A/B y `compararCampanas` **desaparecen** de la pantalla.
2. **«Cómo nos fue»**: después de guardar los Resultados de una campaña (el bloque que ya existe),
   el equipo necesita el **veredicto**: «esta pauta sirvió / no sirvió / a medias», con las razones
   en pesos y porcentajes, y **qué funcionó de lo que se subió** (sus creativos). Hoy solo sale el
   número; falta la lectura.

## 2. Qué construyes (y solo eso)

En `app/(panel)/campanas/page.tsx` y `components/cliente/campanas-url.tsx` (ya existen; los editas):

1. **Selector de comparación**: un desplegable propio (`"use client"`, sin librerías) con una
   casilla por campaña del periodo (`vista.campanas`), nombre + etiqueta de estado. Lo elegido
   viaja en la URL como `?comparar=<id1>,<id2>,…` (conserva `periodo`, `registrar`, etc., como ya
   hace `useIrCon`). Mínimo 2 para que aparezca la comparación; un botón «Limpiar».
2. **Bloque «Lado a lado»** (reemplaza al de A/B): tabla **métrica × campañas** desde
   `compararSeleccion(r, ids, periodo)`: una columna por campaña (nombre corto + estado + días con
   gasto), una fila por métrica; **la mejor de cada métrica resaltada** (`mejorIndice`) y, debajo de
   cada valor, la diferencia frente a la mejor (`deltasFrenteAlMejor`, con signo y `pct()`; en la
   mejor, «mejor»). `comparable === false` → fila en gris, sin resaltar («suma, no se compara»).
   `aviso` → `Aviso tono="ojo"` encima. Con más de 4 campañas, la tabla desplaza dentro de su caja.
3. **Bloque «Cómo nos fue»** dentro del bloque de Resultados (`#resultados`), **debajo del
   formulario**, siempre que haya `?registrar=` o `?guardada=`: desde `comoNosFue(r, id)`:
   - Veredicto grande: `titulo` («Esta pauta sirvió» / «no sirvió» / «a medias» / «Todavía no se
     puede decir si sirvió») con tono `bien` / `mal` / `ojo` / `neutro` según `veredicto`.
   - `razones[]` como lista de frases tal cual vienen (ya traen pesos y porcentajes).
   - `faltan` (si no es null) en un `Aviso tono="ojo"`.
   - **«Lo que se subió»**: una tarjeta por creativo de `creativos[]`: miniatura (`urlMiniatura`
     si empieza por `/radar/` o es ruta local; si no, marco vacío con el `formato`), `nombre`,
     `lectura` (la frase: «Funcionó…», «No funcionó…», «No se probó lo suficiente…») con tono por
     `cuadrante` (`escalar` bien · `matar` mal · `arreglar_*` ojo · `sin_senal` neutro), inversión
     (`cop(gasto)`), costo por resultado y clic en el enlace, y la `accion` en pequeño.
     Vacío: «Esta campaña no tiene creativos evaluados en el periodo.»

**No tocas** `lib/`, `config/`, `scripts/`, `lib/tipos.ts` ni `app/(panel)/campanas/acciones.ts`.

## 3. Contrato (ya en el repo, probado)

```ts
import { motor, campanasEnPeriodo, compararSeleccion, comoNosFue } from '@/lib/datos'
import type { ResumenCampana, ComparacionVarias, MetricaVarias, VeredictoCampana, CreativoDeCampana } from '@/lib/tipos'

const { periodo, comparar, registrar, guardada, error } = await searchParams   // promesa: await
const r = await motor()
const vista = campanasEnPeriodo(r, periodo)                       // como hoy
const ids = (comparar ?? '').split(',').filter(Boolean)
const lado = compararSeleccion(r, ids, periodo)                    // ComparacionVarias
const como = registrar || guardada ? comoNosFue(r, registrar ?? guardada!) : null   // { veredicto, creativos } | null
```

- `ComparacionVarias = { campanas: ResumenCampana[], diasDistintos, aviso: string|null, metricas: MetricaVarias[] }`
- `MetricaVarias = { id, nombre, unidad: 'cop'|'numero'|'porcentaje'|'ratio', mejorEs, valores: (number|null)[], mejorIndice: number|null, deltasFrenteAlMejor: (number|null)[], comparable }`
  (`valores[i]` corresponde a `campanas[i]`; con menos de 2 campañas `metricas` viene vacío).
- `VeredictoCampana = { veredicto: 'sirvio'|'a_medias'|'no_sirvio'|'sin_resultados', titulo, razones: string[], faltan: string|null }`
- `CreativoDeCampana = { anuncioId, nombre, formato, cuadrante, lectura, accion, gasto, costoResultado, ctrEnlace, urlMiniatura }`

Formato: `cop()`, `pct()`, `num()`, `ratio()`, `formatear(valor, unidad)` de `@/lib/format`.
Nunca `toFixed`/`toLocaleString` a mano. `null` → «—».

## 4. Reglas que no se negocian

- Ningún número lo calcula la interfaz (ni «mejor», ni deltas: vienen en `MetricaVarias`).
- `null` nunca es cero. Cero jerga (hay un test que revisa el HTML).
- Sin librerías nuevas; mismas primitivas (`Panel`, `Aviso`, `Etiqueta`, `Vacio`, `Miniatura`…).
- Todo lo que se elige viaja en la URL (se puede copiar el enlace y mandarlo por WhatsApp).
- La tabla de comparación y la de pautas, cada una dentro de su caja con scroll; la página nunca
  desplaza horizontal. Móvil 390 px sin desbordes.

## 5. Cómo verifico la entrega

- `npm run typecheck` limpio · `npm test` verde (283) · `npm run build` sin errores.
- `/campanas`, `/campanas?comparar=camp_facial,camp_madre&periodo=todo`,
  `/campanas?registrar=camp_madre`, `/campanas?guardada=camp_madre` → 200.
- Con el seed: marcar «Facial · Toxina y ácido» y «Promoción · Mes de la madre» en el desplegable
  → tabla con las dos columnas, «Costo por resultado» resalta la del Mes de la madre (es menor) y
  la otra muestra «+0,9 %»; las sumas en gris. Guardar Resultados del Mes de la madre (90 / 48 /
  33 / 15 / 9.750.000) → aparece el veredicto con al menos 3 razones y las 2 tarjetas de creativos
  («Madre · Regálale un momento», «Madre · Bono 2x1 toxina») con su lectura.
- No queda ningún «A» / «B» en la pantalla.
- Capturas en 1440 y 390 px.
- `git diff --stat` solo muestra `app/(panel)/campanas/page.tsx`, `components/cliente/campanas-url.tsx`
  y, si creaste alguno, `components/cliente/campanas-*.tsx`.

## 6. Trampas conocidas

- `searchParams` en Next 15 es una **promesa**: `await`.
- El desplegable con casillas es cliente; la tabla que pinta los datos es Server Component (le
  pasas `lado` ya calculado). No hagas fetch.
- Al cambiar de periodo, conserva `comparar` en la URL; las campañas que ya no estén en el periodo
  simplemente no aparecen (`compararSeleccion` las ignora).

Entrega y avísame; yo lo integro y lo verifico.
