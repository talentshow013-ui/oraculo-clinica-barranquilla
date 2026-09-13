# Tasks: Panel ORÁCULO

**Input**: Design documents from `/specs/001-panel-oraculo/` + `PROMPT_ORACULO_v2.md`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD obligatorio en `lib/` (constitución X). Cada módulo de `lib/` tiene su `*.test.ts` escrito antes del código.

**Organization**: Fases 0-5 del prompt maestro mapeadas a Setup → Foundational → historias → Polish. Las historias US1/US2/US6 son P1; US3/US4/US5 son P2.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Fase 0 — Cimientos)

- [x] T001 Crear `package.json` con scripts `dev`, `build`, `start`, `typecheck`, `test`, `seed`, `verificar`, `validar-lote` y dependencias pinneadas (next 15.5, react 19, zod 4, tailwindcss 4, @tailwindcss/postcss, date-fns, date-fns-tz, typescript 5.9, vitest 4, tsx, @types/*)
- [x] T002 [P] Crear `tsconfig.json` (strict, noUncheckedIndexedAccess, paths `@/*`, plugin next) y `next.config.ts`
- [x] T003 [P] Crear `vitest.config.ts` con `resolve.alias` `@` y `include` de `lib/**/*.test.ts`, `config/**/*.test.ts`, `scripts/**/*.test.ts`
- [x] T004 [P] Crear `postcss.config.mjs`, `app/globals.css` con `@import "tailwindcss"` y `@theme` de §10, `.env.example`, `.gitignore` (node_modules, .next, .env, datos/seed.json, datos/lote.json, reportes/)
- [x] T005 Ejecutar `npm install` y confirmar `npx tsc --noEmit` limpio (criterio Fase 0)

## Phase 2: Foundational (Fase 1 — Contrato y núcleo)

**⚠️ CRITICAL**: Todo lo demás depende del contrato y del núcleo.

- [x] T006 Escribir `lib/adapters/types.test.ts`: InsightRow válido pasa; `gasto: null` falla; `RegistroEmbudo` con `telefono` falla (strict); `alcance: null` pasa; `nRegistros` obligatorio en BreakdownRow
- [x] T007 Implementar `lib/adapters/types.ts` con esquemas Zod y tipos: InsightRow, BreakdownRow, RegistroEmbudo (strict), Creativo, AnuncioCompetidor, Competidor, Experimento, LoteDatos, EstadoFuente, FuenteDatos, enums (PASOS, ANGULOS, DIMENSIONES, ESTADOS, FORMATOS) según data-model.md
- [x] T008 [P] Escribir `lib/metrics/core.test.ts`: `razon(1,0)` → null; `razon(null,5)` → null; nunca Infinity/NaN; `sumaNullable([null,null])` → null; `sumaNullable([null,3])` → 3; agregar 1/100 + 90/900 → ctr 0.091 (no 0.055); `ventanasIguales` rechaza 7 vs 28 días; hookRate cae a 2s si no hay 3s
- [x] T009 Implementar `lib/metrics/core.ts`: `razon`, `sumaNullable`, `agregar` (solo crudos), `Agregado`, `ventanasIguales`, `serieDiaria`, y todas las derivadas de §7.1 (cpm, cpc, cpcEnlace, ctr, ctrEnlace, ctrUnico, frecuencia, cpa, roas, costoConversacion, tasaConversacion, tasaRespuesta, calidadClic, tasaConversion, tasaInteraccion, tasaGuardado, tasaCompartido, tasaComentario, ratioGuardadoLike, tasaVisitaPerfil, costoMilAlcance, costoVistaLanding, costoInteraccion, fugaAterrizaje, hookRate, holdRate, tasaFinalizacion, retencion25/50/75, caida2550, caida5075, tiempoPromedio, eficienciaSegundo, ctrPostHold, costo3s, costoThruplay, concentracionHHI, concentracionTop1, delta, desviacion, coeficienteVariacion)
- [x] T010 [P] Escribir `lib/format/format.test.ts`: `cop(1234567)` → "$ 1.234.567"; `pct(0.0913)` → "9,1 %"; `null` → "—"; `aFechaBogota` de una fecha UTC 04:30 devuelve el día anterior en Bogotá; `hoyBogota()` formato YYYY-MM-DD
- [x] T011 [P] Implementar `lib/format/index.ts` (cop, pct, num, vacio "—", ratio) y `lib/format/fechas.ts` (hoyBogota, aFechaBogota, sumarDias, rangoDias, listarHuecos) y `lib/format/etiquetas.ts` (nombres públicos: "Campañas y audiencias", "Video corto", "Radar de mercado", "Agenda y ventas", etiquetas de pasos, familias, cuadrantes, ángulos)
- [x] T012 [P] Crear `config/cliente.ts` (ciudad Barranquilla, zonasValidas del área metropolitana, servicios con ticket y costoDirecto en 0, margenPorDefecto null, horarioAtencion, cuposDiarios, radioKm 40, monedaCOP) y `config/benchmarks.ts` (umbrales `{valor, origen, calibrado:false}` para frecuencia, caídaCTR, hookRate mínimo, showRate, cierre, CAC/margen, mínimo estadístico, diasSinRenovar, presupuestoMinimoAprendizaje, tiempoRespuestaMin)
- [x] T013 Escribir `lib/privacy/privacy.test.ts`: `validarSinPII({telefono:'x'})` lanza ErrorDatoSensible con "Ley 1581"; `enmascarar(10,3,5)` → null; `filtrarPorK` separa visibles/ocultas; `pseudonimizar` determinista y distinto por sal
- [x] T014 Implementar `lib/privacy/index.ts`: K_MINIMO=5, enmascarar, filtrarPorK, CAMPOS_PROHIBIDOS, ErrorDatoSensible, validarSinPII (recursivo), pseudonimizar (SHA-256 vía `node:crypto`), AVISO_PANEL
- [x] T015 Escribir `lib/metrics/funnel.test.ts`: 8 pasos en orden; fuga antes de cita_asistida = perdidos × costo paso anterior; desde cita_asistida = perdidos × margen; POAS 0,8 con ROAS 4x y margen 20 %; showRate; fugaMasCara elige por COP no por %; margen null → fuga null
- [x] T016 Implementar `lib/metrics/funnel.ts`: PasoEmbudo, construirEmbudo, fugaMasCara, showRate, cierreEnConsultorio, costoCitaAsistida, cac, poas, roasReal, ratioCacMargen, ltv, MetricasNegocio
- [x] T017 [P] Escribir `lib/metrics/creative.test.ts`: fatiga mayor con frecuencia subiendo que estable; índice en [0,1]; cuadrantes escalar/arreglar_gancho/arreglar_oferta/matar; pocos datos → sin_senal; formulaVisible es string
- [x] T018 [P] Implementar `lib/metrics/creative.ts`: indiceFatiga (con formulaVisible), clasificarCuadrante, EvaluacionCreativo, evaluarCreativos, vidaUtil, ritmoRenovacion
- [x] T019 Ejecutar `npm test`: ≥ 20 tests verdes incluidos los 5 obligatorios (criterio Fase 1)

**Checkpoint**: contrato + núcleo listos; historias pueden avanzar.

## Phase 3: User Story 2 — Diagnóstico auditable (Priority: P1) 🎯 (Fase 2 — motor)

**Goal**: 145 métricas declaradas y 26 reglas deterministas que encuentran los patrones plantados.

**Independent Test**: `npm run verificar` imprime hallazgos ordenados por plata.

- [x] T020 [P] [US2] Escribir `lib/metrics/catalog.test.ts`: exactamente 145 métricas; 12 familias con conteos {entrega 13, costo 16, interaccion 11, video 14, mensajeria 7, conversion 15, negocio 17, creativo 12, audiencia 11, competencia 13, salud_cuenta 9, operacion 7}; ids únicos; todas con porQueImporta no vacío; ~18 maestras; ninguna con campo `benchmark`
- [x] T021 [P] [US2] Implementar `lib/metrics/catalog.ts` con las 145 MetricaCatalogo (id, nombre, familia, unidad, formula, porQueImporta, mejorEs, derivada, fuentes, maestra)
- [x] T022 [US2] Escribir `lib/diagnostics/engine.test.ts`: regla que lanza no tumba las demás y queda en errores; hallazgos ordenados por plataEnRiesgo desc con null al final; contexto construido desde lote + config
- [x] T023 [US2] Implementar `lib/diagnostics/engine.ts`: tipos Regla, Hallazgo, ContextoDiagnostico, construirContexto (agregados, series, ventanas iguales 14/14 días, embudo, creativos, desgloses filtrados por k, radar, cliente, benchmarks), ejecutarReglas con try/catch y orden por plata
- [x] T024 [US2] Escribir `lib/diagnostics/rules.test.ts`: por regla un caso que dispara y uno que no (R01, R02, R07, R10, R11, R12, R15, R18, R19, R21, R22, R23 como mínimo); R18 con ventanas iguales; R15 usa redacción de §7.5
- [x] T025 [US2] Implementar reglas de entrega y creativo en `lib/diagnostics/rules/entrega.ts` (R01, R02, R03, R21) y `lib/diagnostics/rules/creativo.ts` (R04, R05, R06, R07, R08, R09, R25)
- [x] T026 [P] [US2] Implementar reglas de audiencia y embudo en `lib/diagnostics/rules/audiencia.ts` (R10, R11, R12, R13) y `lib/diagnostics/rules/embudo.ts` (R14, R15, R16, R18)
- [x] T027 [P] [US2] Implementar reglas de operación, economía, datos y competencia en `lib/diagnostics/rules/operacion.ts` (R17, R26), `lib/diagnostics/rules/economia.ts` (R19, R20), `lib/diagnostics/rules/datos.ts` (R22, R23), `lib/diagnostics/rules/competencia.ts` (R24)
- [x] T028 [US2] Crear `lib/diagnostics/rules/index.ts` exportando `REGLAS` (26) y test de conteo/ids únicos

## Phase 4: User Story 3 — Laboratorio creativo y radar (Priority: P2)

- [x] T029 [P] [US3] Escribir `lib/competitive/competitive.test.ts`: clasificador de ángulos devuelve señales; riesgoPolitica detecta "antes y después"/"garantizado"; longevidad saturante y mayor con variantes; ganadoresProbados ≥ 60 días; espaciosVacios excluye combinaciones atacadas; participacionVoz suma 1
- [x] T030 [US3] Implementar `lib/competitive/angles.ts`: DICCIONARIO_ANGULOS (14), clasificarAngulo (con senales y confianza), nivelConsciencia, riesgoPolitica
- [x] T031 [US3] Implementar `lib/competitive/index.ts`: puntuacionLongevidad, ganadoresProbados, cadenciaSemanal, entradasYSalidas, mapaAngulos, espaciosVacios, participacionVoz, perfilar, ResultadoRadar

## Phase 5: User Story 4 — Oportunidades y lentes (Priority: P2)

- [x] T032 [P] [US4] Escribir `lib/opportunities/opportunities.test.ts`: cada oportunidad tiene hipótesis "si…entonces…porque", basadaEn no vacío, prueba con criterioCorte; ICE = impacto×confianza/esfuerzo; filtrarYaProbadas baja confianza y marca yaProbada
- [x] T033 [US4] Implementar `lib/opportunities/index.ts`: desdeHallazgos, desdeEspaciosVacios, desdeGanadoresMercado, priorizarICE, filtrarYaProbadas, generarOportunidades
- [x] T034 [P] [US4] Escribir `lib/frameworks/frameworks.test.ts`: 7 lentes con fuente; cada criterio tiene datoPanel y accionSiFalla; cumple null cuando falta dato
- [x] T035 [P] [US4] Implementar `lib/frameworks/index.ts`: 7 lentes (Hormozi, Schwartz, Cialdini, Miller, respuesta directa, Holmes, North Star/AARRR) evaluadas sobre ResultadoMotor parcial

## Phase 6: User Story 1 — Centro de Mando y Embudo (Priority: P1) 🎯 MVP (Fase 3 datos + Fase 4 UI base)

**Goal**: seed, adapters, capa de datos, verificar.ts, y las pantallas Centro de Mando, Embudo, Rendimiento, Diagnóstico.

- [x] T036 [US1] Escribir `scripts/seed.test.ts`: misma semilla → mismo JSON; lote pasa LoteDatosSchema; contiene 180 días con 2 huecos; ≥ 6 competidores y ≥ 40 anuncios con alguno ≥ 60 días
- [x] T037 [US1] Implementar `scripts/seed.ts` (mulberry32, 180 días, patrones §11: fatiga día 90+, 22 % fuera de radio, caída asistencia últimos 25 días, 65+ sin convertir, CPM creciente, 50 % fuera de horario, 2 huecos, 6 competidores/~50 anuncios) escribiendo `datos/seed.json`; añadir `datos/experimentos.json` inicial y `datos/.gitkeep`
- [x] T038 [P] [US1] Implementar `lib/adapters/mock.adapter.ts` (lee `datos/seed.json`, valida, validarSinPII) y `lib/adapters/archivo.adapter.ts` (lee `datos/lote.json`, mismo Zod, mismo guardián, estado con etiquetaPublica)
- [x] T039 [US1] Implementar `lib/datos.ts`: fuenteActiva por `ORACULO_FUENTE`, obtenerLote, correrMotor (agregado, serie, embudo, negocio, creativos, hallazgos, oportunidades, radar, lentes, catálogo, privacidad, fuentes) con caché por proceso
- [x] T040 [US1] Implementar `scripts/verificar.ts` (corre correrMotor sin UI, imprime hallazgos por plata, `--json` para skills) y `scripts/validar-lote.ts`; ejecutar `npm run seed && npm run verificar` y confirmar ≥ 8 patrones (criterio Fases 2-3)
- [x] T041 [P] [US1] Implementar `components/ui.tsx` (Kpi, Panel, Etiqueta, Barra, Vacio, Celda, Th, Aviso) con `tabular-nums`, `—` para null, un acento por significado
- [x] T042 [P] [US1] Implementar `components/sidebar.tsx` (4 grupos: Dirección / Cuenta / Mercado / Sistema) y `app/(panel)/layout.tsx`, `app/layout.tsx`, `app/page.tsx` (redirect /panel)
- [x] T043 [US1] Implementar `app/(panel)/panel/page.tsx` (Centro de Mando: métricas maestras, top hallazgos por plata, fuga más cara, huecos y advertencias, ventana de atribución visible)
- [x] T044 [P] [US1] Implementar `app/(panel)/embudo/page.tsx` (8 pasos con cantidad, tasa, costo, perdidos, fuga COP ordenada) y `app/(panel)/rendimiento/page.tsx` (inversión, CPM/CPC/CTR/CPA, ROAS vs POAS con explicación, serie diaria con huecos)
- [x] T045 [P] [US1] Implementar `app/(panel)/diagnostico/page.tsx` (hallazgos con título, explicación, evidencia, acciones, plata; errores de reglas en aviso)

## Phase 7: User Story 6 — Privacidad visible (Priority: P1)

- [x] T046 [US6] Implementar `app/(panel)/audiencias/page.tsx` con desgloses filtrados por k, contador de segmentos ocultos, AVISO_PANEL, advertencia "los desgloses no suman al total", inversión fuera de radio
- [x] T047 [US6] Escribir `lib/format/sin-jerga.test.ts` que recorre `app/` y `components/` buscando `API|MCP|endpoint|Zod|LLM` en texto y falla si encuentra

## Phase 8: Resto de pantallas (US3, US4)

- [x] T048 [P] [US3] Implementar `app/(panel)/creativos/page.tsx` (matriz de cuadrantes, fatiga con fórmula visible, sin_senal explícito) y `app/(panel)/competencia/page.tsx` (ganadores probados, cadencia, mapa de ángulos, espacios vacíos; alcance `—` si null)
- [x] T049 [P] [US4] Implementar `app/(panel)/oportunidades/page.tsx` (ICE, hipótesis, prueba con criterio de corte, ya probadas marcadas) y `app/(panel)/consejo/page.tsx` (7 lentes con fuente y criterios)
- [x] T050 [P] [US4] Implementar `app/(panel)/biblioteca/page.tsx` (banco de mensajes por ángulo/servicio desde creativos y ganadores del mercado — estructura, no copy) y `app/(panel)/metricas/page.tsx` (catálogo 145 por familia con fórmula y porQueImporta)
- [x] T051 [P] [US1] Implementar `app/(panel)/informe/page.tsx` (Resumen para dirección: 3 decisiones, plata en riesgo, fuga más cara, próximos experimentos) y `app/(panel)/fuentes/page.tsx` (estado de fuentes con etiquetaPublica, rango, huecos, última actualización)
- [x] T052 Ejecutar `npm run build` y recorrer las 13 rutas en `npm run dev` verificando ningún null como 0 (criterio Fase 4)

## Phase 9: User Story 5 — Operación y documentación (Priority: P2) (Fase 5)

- [x] T053 [P] [US5] Escribir `docs/CONTRATO_DATOS.md`, `docs/REGLAS_DIAGNOSTICO.md` (26 reglas con condición, evidencia, acciones), `docs/CUMPLIMIENTO.md` (Ley 1581, obligaciones del cliente, políticas de salud de Meta), `docs/CONEXION_MCP.md` (interno: Meta MCP, herramientas, mapeo al contrato, Apify, TikTok)
- [x] T054 [P] [US5] Escribir `docs/PROMPT-FRONTEND.md`: prompt de conexión para el agente de diseño (qué existe, contrato, `lib/datos.ts`, rutas, decisión por pantalla, tema, reglas de null/—, qué no tocar, criterios de aceptación)
- [x] T055 [P] [US5] Crear skills `.claude/skills/oraculo-sincronizar/SKILL.md`, `.claude/skills/oraculo-semana/SKILL.md`, `.claude/skills/oraculo-pregunta/SKILL.md` según contracts/skills.md, con el carácter de §1
- [x] T056 [P] [US5] Crear `instalar.ps1` (verifica Node ≥ 20, npm install, npm run seed, abre navegador, npm run dev) y `README.md` para la coordinadora (5 pasos, sin jerga) + sección técnica breve
- [x] T057 [US5] Verificación final: `npm run typecheck`, `npm test`, `npm run verificar`, `npm run build`; commit final

## Dependencies

- Setup (T001-T005) → Foundational (T006-T019) → US2 motor (T020-T028) → US3 (T029-T031) y US4 (T032-T035) en paralelo → US1 datos+UI (T036-T045) → US6 (T046-T047) → resto pantallas (T048-T052) → US5 docs (T053-T057).
- `lib/datos.ts` (T039) requiere motor, radar, oportunidades y lentes completos.

## Parallel Execution Examples

- Fase 0: T002, T003, T004 en paralelo tras T001.
- Foundational: T008/T010/T012/T017 (tests y config) en paralelo; T009 tras T008; T011 tras T010; T018 tras T017.
- Motor: T020-T021 (catálogo) en paralelo con T022-T028 (reglas); T026 y T027 en paralelo tras T025.
- UI: T041-T042 en paralelo; luego T043-T045 en paralelo; T048-T051 en paralelo.

## Implementation Strategy

MVP = Setup + Foundational + US2 (motor) + US1 (seed, datos, Centro de Mando, Embudo, Rendimiento, Diagnóstico). Con eso el dueño ya ve dónde se pierde la plata. Luego privacidad visible (US6), resto de pantallas (US3/US4) y operación (US5).
