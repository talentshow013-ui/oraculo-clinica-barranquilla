# Implementation Plan: Panel ORÁCULO

**Branch**: `001-panel-oraculo` | **Date**: 2026-09-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-panel-oraculo/spec.md` + `PROMPT_ORACULO_v2.md`

## Summary

Panel local de inteligencia de marketing para clínica estética. Contract-first: un contrato Zod
(`lib/adapters/types.ts`) alimenta un motor determinista (núcleo de razones nulables, embudo de 8
pasos valorizado en COP, laboratorio creativo, catálogo de 145 métricas, 26 reglas, radar de
competencia, oportunidades ICE con memoria, 7 lentes, privacidad k=5) y una interfaz Next.js de
13 rutas con tema de sala de control. Fase 1 corre sobre un seed determinista de 180 días; la
fuente real (Fase 2) entra por Claude Code + MCP oficial de Meta escribiendo `datos/lote.json`,
sin tocar componentes.

## Technical Context

**Language/Version**: TypeScript 5.9 (`strict`, `noUncheckedIndexedAccess`), Node 24 (≥ 20 requerido)

**Primary Dependencies**: Next.js 15.5.x (App Router, Server Components), React 19.x, Zod 4.x,
Tailwind CSS 4.x (`@tailwindcss/postcss`, `@theme`), date-fns 4 + date-fns-tz 3, tsx 4

**Storage**: N/A en fase 1. Archivos locales: `datos/seed.json` (generado), `datos/lote.json`
(fuente real, opcional), `datos/experimentos.json` (memoria).

**Testing**: Vitest 4.x con `resolve.alias` para `@/*`; `scripts/verificar.ts` como smoke test del motor.

**Target Platform**: Windows 10/11 (PC de la coordinadora), navegador moderno; `npm run dev` local.

**Project Type**: Aplicación web local (App Router) + biblioteca de cálculo (`lib/`) + scripts.

**Performance Goals**: Motor completo sobre 180 días × ~40 entidades en < 2 s; carga de cualquier
ruta con seed en < 1 s en dev.

**Constraints**: Sin backend, sin base de datos, sin librería de componentes, sin credenciales en
repo, sin jerga técnica visible, `null` ≠ `0`, ventanas iguales, `America/Bogota`.

**Scale/Scope**: 1 clínica, 1 usuario, 13 rutas, 145 métricas, 26 reglas, ~50 anuncios de
competencia, 180 días de historia.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo se cumple en este plan | Estado |
|---|---|---|
| I Contract-first | `lib/adapters/types.ts` primero (Fase 1); `mock.adapter` y `archivo.adapter` validan con el mismo Zod; UI solo consume `lib/datos.ts` | ✅ |
| II Cero API propia | Ningún cliente HTTP en el repo; `docs/CONEXION_MCP.md` + skill `oraculo-sincronizar` describen la carga vía MCP en Claude Code | ✅ |
| III null ≠ 0 | `razon()` y `sumaNullable()` en core con tests; primitiva `Vacio`/`Kpi` muestra `—` | ✅ |
| IV No promediar razones | `agregar()` solo suma crudos; test 91/1000; lint de repositorio: no existe `promedio(`/`avg(` sobre razones | ✅ |
| V Filtro comercial | `lib/format/etiquetas.ts` centraliza textos visibles; test `sin-jerga.test.ts` busca términos prohibidos en `app/` y `components/` | ✅ |
| VI Privacidad por esquema | Zod `.strict()` en `RegistroEmbudo`; `validarSinPII` en adapters; `filtrarPorK` en desgloses | ✅ |
| VII Cero invención | `alcanceRango` nullable; `config/benchmarks.ts` con `origen` obligatorio por umbral | ✅ |
| VIII Motor determinista | Reglas puras en `lib/diagnostics/rules/`; ejecutor con try/catch; sin llamadas a LLM en código | ✅ |
| IX Tiempo honesto | `lib/format/fechas.ts` (`hoyBogota`, `aFechaBogota`); `ventanasIguales()` en core con test; `meta.huecos` en UI | ✅ |
| X Calidad verificable | TDD en `lib/`; `npm run typecheck` + `npm test` + `npm run verificar` por fase | ✅ |

Sin violaciones. Complexity Tracking no aplica.

## Project Structure

### Documentation (this feature)

```text
specs/001-panel-oraculo/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── lote-datos.md          # contrato del lote (lo que escribe Claude Code, lo que lee la UI)
│   ├── motor.md               # firmas públicas de lib/ que consume la UI
│   └── skills.md              # contrato de los skills de Claude Code
└── tasks.md                   # /speckit-tasks
```

### Source Code (repository root)

```text
app/
  globals.css                  # @theme de §10
  layout.tsx
  page.tsx                     # redirect → /panel
  (panel)/
    layout.tsx                 # sidebar 4 grupos
    panel/page.tsx             # Centro de Mando
    diagnostico/page.tsx
    oportunidades/page.tsx
    embudo/page.tsx
    rendimiento/page.tsx
    creativos/page.tsx
    audiencias/page.tsx
    competencia/page.tsx
    biblioteca/page.tsx
    consejo/page.tsx
    metricas/page.tsx
    informe/page.tsx
    fuentes/page.tsx
components/
  ui.tsx                       # Kpi, Panel, Etiqueta, Barra, Vacio, Celda, Th, Aviso
  sidebar.tsx
lib/
  adapters/
    types.ts                   # ★ contrato Zod + tipos
    mock.adapter.ts            # lee datos/seed.json
    archivo.adapter.ts         # lee datos/lote.json (fuente real, Fase 2)
  metrics/
    core.ts · core.test.ts
    funnel.ts · funnel.test.ts
    creative.ts · creative.test.ts
    catalog.ts · catalog.test.ts
  diagnostics/
    engine.ts · engine.test.ts
    rules/index.ts · rules/r01-r26.ts (agrupados por área) · rules.test.ts
  competitive/
    index.ts · angles.ts · competitive.test.ts
  opportunities/index.ts · opportunities.test.ts
  frameworks/index.ts · frameworks.test.ts
  privacy/index.ts · privacy.test.ts
  format/index.ts · fechas.ts · etiquetas.ts · format.test.ts
  datos.ts                     # capa de acceso única (fuenteActiva, motor())
config/
  cliente.ts
  benchmarks.ts
scripts/
  seed.ts
  verificar.ts
datos/
  .gitkeep · experimentos.json · (seed.json generado, lote.json opcional)
docs/
  CONTRATO_DATOS.md · CONEXION_MCP.md · REGLAS_DIAGNOSTICO.md · CUMPLIMIENTO.md · PROMPT-FRONTEND.md
.claude/skills/
  oraculo-sincronizar/SKILL.md · oraculo-semana/SKILL.md · oraculo-pregunta/SKILL.md
instalar.ps1 · README.md · .env.example · .gitignore
package.json · tsconfig.json · next.config.ts · postcss.config.mjs · vitest.config.ts
```

**Structure Decision**: aplicación única Next.js con `lib/` como biblioteca pura (sin imports de
React ni Next) para que el motor sea testeable y ejecutable desde `scripts/verificar.ts`. `app/`
y `components/` solo consumen `lib/datos.ts`.

## Fases de ejecución (de §13, con criterios)

| Fase | Entrega | Criterio de cierre |
|---|---|---|
| 0 Cimientos | package.json, tsconfig, vitest.config, next.config, postcss, .env.example, .gitignore, globals.css base | `npx tsc --noEmit` limpio |
| 1 Contrato y núcleo | types.ts, core, funnel, creative, privacy, format, config | ≥ 20 tests verdes incl. los 5 obligatorios |
| 2 Catálogo y motor | catalog (145), engine + 26 reglas, competitive, opportunities, frameworks | `verificar.ts` imprime hallazgos por plata y encuentra patrones plantados |
| 3 Datos | seed.ts, mock.adapter, archivo.adapter, datos.ts, experimentos.json | `npm run seed` genera y valida sin errores |
| 4 Interfaz | globals.css, ui.tsx, sidebar, layout, 13 páginas | `npm run dev` levanta, 13 rutas cargan, ningún `null` como 0 |
| 5 Documentación y operación | docs/*, README, PROMPT-FRONTEND, skills, instalar.ps1 | Un desarrollador nuevo levanta el proyecto con el README |

## Complexity Tracking

No aplica: sin violaciones a la constitución.
