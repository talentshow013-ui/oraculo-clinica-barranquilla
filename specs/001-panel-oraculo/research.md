# Research: Panel ORÁCULO

**Date**: 2026-09-13. Versiones verificadas contra el registro npm el mismo día.

## 1. Versiones del stack

- **Decision**: Next.js `15.5.x` (última 15.5.25), React `19.3`, TypeScript `5.9.3`, Zod `4.x`,
  Tailwind `4.3.x` + `@tailwindcss/postcss`, Vitest `4.1.x`, tsx `4.x`, date-fns `4.4` + date-fns-tz `3.2`.
- **Rationale**: El prompt maestro fija Next 15; existe Next 16.3 pero cambiar de major sin
  necesidad añade riesgo (Turbopack por defecto, cambios en caching) y no aporta nada al panel.
  TypeScript 7 (port en Go) salió recientemente; Next 15 y sus tipos están validados con TS 5.x.
  Vitest 5.0.0 tiene días de publicado; 4.1 es la línea estable.
- **Alternatives considered**: Next 16 (rechazado por el prompt y estabilidad), TS 7 (inmaduro
  para tooling de Next), Vitest 5 (demasiado nuevo).

## 2. Zod 4 vs 3

- **Decision**: Zod 4 (`import { z } from "zod"`), esquemas `.strict()` en tipos agregados.
- **Rationale**: Zod 4 es la versión activa; `z.strictObject` y mensajes de error más claros ayudan
  a la regla "el seed que omite un campo falla ruidosamente".
- **Alternatives**: Zod 3 (mantenimiento), Valibot (menos conocido; el prompt exige Zod).

## 3. Fechas en America/Bogota

- **Decision**: `lib/format/fechas.ts` con `hoyBogota()`, `aFechaBogota(Date)` usando
  `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })` y `date-fns-tz` para
  aritmética. Prohibido `toISOString().slice(0,10)`.
- **Rationale**: §12.5 del prompt: `toISOString` corrompe el día según zona. Bogotá es UTC-5 sin
  horario de verano; aun así el helper es la única puerta.

## 4. Vitest con alias `@/*`

- **Decision**: `vitest.config.ts` con `resolve.alias: { '@': path.resolve(__dirname) }` y
  `test.include: ['lib/**/*.test.ts', 'config/**/*.test.ts', 'scripts/**/*.test.ts']`.
- **Rationale**: §12.4: sin alias, `import` de valores falla y el error es confuso.

## 5. Seed determinista

- **Decision**: PRNG `mulberry32` con semilla fija `20260913`; generador escribe `datos/seed.json`
  con la forma exacta de `LoteDatos`. `mock.adapter` lo lee y valida.
- **Rationale**: Tests dependen de la misma salida; un JSON en disco permite que la UI y
  `verificar.ts` lean idéntico lote sin recomputar.
- **Alternatives**: generar en memoria en cada carga (más lento, y la coordinadora no ve el archivo).

## 6. Fuente real sin API propia

- **Decision**: `archivo.adapter.ts` lee `datos/lote.json`. El skill `oraculo-sincronizar` (Fase 2)
  guía a Claude Code para consultar el MCP oficial de Meta (`ads_get_ad_entities`,
  `ads_insights_performance_trend`, etc.) y escribir el lote en la forma del contrato.
  `ORACULO_FUENTE=archivo` activa esa fuente.
- **Rationale**: Cumple II (cero API propia) y la restricción del cliente (solo suscripción de
  Claude Code). Claude no calcula: solo mapea respuestas al contrato; el motor hace el resto.
- **Alternatives**: SDK de Meta con token de sistema (rechazado: credencial de largo plazo,
  revisión de app).

## 7. Server Components y acceso a datos

- **Decision**: `lib/datos.ts` expone `obtenerLote()` y `correrMotor()` (async, cache por
  proceso con `React.cache` equivalente manual). Las páginas son Server Components que llaman a
  `correrMotor()` y renderizan; sin `use client` salvo interacciones puntuales (filtros de ventana).
- **Rationale**: §10 y constitución; el lote cabe en memoria y el motor tarda < 2 s.

## 8. Test de jerga

- **Decision**: `lib/format/sin-jerga.test.ts` recorre `app/` y `components/` y falla si encuentra
  `\b(API|MCP|endpoint|Zod|LLM|sincronización de datos vía integración)\b` fuera de comentarios.
- **Rationale**: Principio V verificable automáticamente (SC-005).

## 9. Umbrales

- **Decision**: `config/benchmarks.ts` exporta objetos `{ valor, origen, calibrado: boolean }`. Los
  valores iniciales se marcan `calibrado: false` con origen "provisional — calibrar con historia
  del cliente". Las reglas leen de aquí; nunca constantes sueltas.
- **Rationale**: Principio VII.

## 10. Registro de experimentos

- **Decision**: `datos/experimentos.json` (array de `Experimento`), leído por
  `opportunities.filtrarYaProbadas`. Equivalencia por `(servicio, angulo, tipoPrueba)`.
- **Rationale**: Mandato 4 del prompt; sin memoria no hay mejora acumulada.
