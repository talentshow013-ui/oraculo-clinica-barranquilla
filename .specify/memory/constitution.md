<!--
Sync Impact Report
- Version change: 1.1.0 → 1.2.0 (2026-09-16): Principio II admite el token de página del orgánico en `.env`
- Version change: (template) → 1.0.0
- Modified principles: n/a (initial ratification)
- Added sections: Core Principles (I–X), Restricciones de Stack y Despliegue, Flujo de Desarrollo y Puertas de Calidad, Governance
- Removed sections: none
- Templates: plan/spec/tasks templates read this file at runtime; no changes required
- Follow-up TODOs: none
-->

# ORÁCULO Constitution

Panel de inteligencia de marketing para una clínica estética en Barranquilla. El documento
funcional de referencia es `PROMPT_ORACULO_v2.md`; esta constitución fija lo que NO se negocia.

## Core Principles

### I. Contract-first
`lib/adapters/types.ts` (esquemas Zod + tipos derivados) es la única fuente de verdad del dato.
Toda fuente —seed, archivo local, conector real— se mapea AL contrato; el contrato nunca se
modifica para acomodar una fuente. La UI se alimenta de datos de demostración que pasan el mismo
Zod que usará la fuente real. Conectar la fuente real NO DEBE tocar ningún componente.
Un campo obligatorio no se vuelve opcional para "arreglar" un seed: se arregla el seed.

### II. Cero API propia
No se desarrollan wrappers de plataformas ni se pasan revisiones de app. Los datos de pauta entran
por conectores MCP oficiales (Meta, TikTok, Apify) invocados desde Claude Code, que escribe un
lote validado en `datos/lote.json`. **Excepción acotada (enmienda 1.2.0):** el orgánico (Instagram y
Facebook sin pauta) no existe en el conector de anuncios, así que se lee directo de la Graph API de
Meta con un token DE PÁGINA de la app propia de la clínica, en modo desarrollo (sin revisión de app,
solo páginas propias). Ese token vive únicamente en el `.env` de la máquina (VPS o PC), nunca en el
repositorio, y se escribe con `npm run organico:conectar`. No se guardan credenciales de largo plazo
en el repositorio; `.env` está en `.gitignore` y `.env.example` documenta lo configurable.

### III. `null` no es `0`
Si una fuente no entrega un dato, el valor es `null` y la UI muestra `—`. "No hubo" y "no
sabemos" son afirmaciones distintas. `razon(num, den)` devuelve `null` si el denominador es 0 o
falta cualquiera; nunca `Infinity` ni `NaN`. Existe un test por cada uno de estos casos.

### IV. Nunca se promedian promedios
Solo se suman campos crudos (gasto, impresiones, clics, resultados…). Toda razón se recalcula
desde las sumas. NO DEBE existir ninguna función que promedie razones. Test obligatorio:
1/100 y 90/900 agregan a 91/1000 = 9,1 %, no 5,5 %.

### V. Filtro estético comercial
En texto visible al cliente jamás aparecen "API", "MCP", "endpoint", "Zod", "LLM", "sincronización
vía integración". Se dice "Campañas y audiencias", "Video corto", "Radar de mercado", "Agenda y
ventas". Los hallazgos se redactan en lenguaje de dueño de clínica.

### VI. Privacidad por esquema (Ley 1581 de 2012)
No existe en el contrato dónde guardar un dato identificable de paciente (nombre, cédula,
teléfono, correo, dirección, historia clínica). `RegistroEmbudo` es agregado. `validarSinPII`
lanza `ErrorDatoSensible` y detiene la carga. Cruces con `nRegistros < 5` se enmascaran
(k-anonimato, k=5) y la UI informa cuántos segmentos quedaron ocultos.

### VII. Cero invención
Nunca se muestra un estimado disfrazado de dato. No existe forma pública de ver presupuesto ni
retorno de un competidor: `alcanceRango` es `null` si la fuente no lo expone. Ningún benchmark
de industria va quemado en código; los umbrales viven en `config/benchmarks.ts` con origen
declarado y se calibran contra la historia del cliente.

### VIII. Motor determinista, no generativo
Las 26 reglas de diagnóstico, el embudo, el laboratorio creativo y el radar son código puro,
auditable y versionado: misma entrada, misma salida. Cada hallazgo declara evidencia exacta,
acciones concretas y plata en riesgo en COP, y se ordena por plata, no por severidad. Una regla
que falla no tumba el panel. Claude Code interpreta lo calculado; NUNCA calcula ni inventa cifras.

### IX. Tiempo y comparaciones honestas
Toda fecha se interpreta en `America/Bogota`; prohibido `toISOString()` crudo para obtener el
día. Toda comparación de periodos usa ventanas del mismo tamaño. Los huecos de datos se listan en
`meta.huecos` y la UI los muestra: un hueco puede simular una caída que nunca ocurrió.

### X. Calidad verificable
TypeScript `strict` + `noUncheckedIndexedAccess`. Vitest para todo `lib/`; en `lib/` se trabaja
con TDD (test primero, rojo, verde, refactor). `npx tsc --noEmit` limpio y suite verde son
requisito para cerrar cada fase. `scripts/verificar.ts` corre el motor completo sin UI y debe
encontrar los patrones plantados en el seed.

## Restricciones de Stack y Despliegue

- Next.js 15 (App Router, Server Components por defecto), React 19, TypeScript, Zod,
  Tailwind v4 (`@theme`, sin config JS), Vitest, tsx, date-fns-tz.
- Sin base de datos en fase 1; el adapter lee archivo local. Sin librería de componentes de
  terceros: primitivas propias (`Kpi`, `Panel`, `Etiqueta`, `Barra`, `Vacio`, `Celda`, `Th`, `Aviso`).
- Vive en UNA máquina siempre encendida (VPS Ubuntu, `deploy/`) donde conviven el panel, el
  reloj diario y Claude Code con los conectores MCP; el mismo repositorio corre 100 % local en
  Windows para desarrollo y demostración (`instalar.ps1`). El análisis narrativo lo ejecuta Claude
  Code con la suscripción del cliente. Sin backend propio, sin base de datos, sin API propia.
- Las credenciales de los conectores las guarda Claude Code en su propio perfil de la máquina
  (OAuth), nunca el repositorio ni un archivo del proyecto. La única credencial en archivo es el
  token de página del orgánico, en `.env` (Principio II). En internet el panel exige usuario y
  clave (`ORACULO_USUARIO`/`ORACULO_CLAVE`) y, delante, Cloudflare Access; los datos del lote no
  contienen pacientes (Principio VI) y aun así nunca se sirven sin candado.
- Idioma de todo lo visible: español (Colombia). Pesos sin decimales, formato `es-CO`,
  `tabular-nums` en toda cifra.

## Flujo de Desarrollo y Puertas de Calidad

- Fases 0→5 de `PROMPT_ORACULO_v2.md` §13 en orden; no se avanza sin cumplir el criterio de
  aceptación de la fase.
- Toda regla de diagnóstico, métrica del catálogo y lente de auditoría declara qué decisión
  cambia; si no cambia ninguna, no existe.
- Los experimentos y su resultado se registran (`datos/experimentos.json`); una hipótesis ya
  probada y perdida no se vuelve a proponer sin marcarlo.
- Commits pequeños y descriptivos por fase/módulo. `.claude/` y `.env` fuera del repositorio
  salvo los skills del proyecto.

## Governance

Esta constitución prevalece sobre cualquier otra práctica del proyecto. Una decisión de
implementación que contradiga un principio está mal, no el principio. Las enmiendas se
documentan en este archivo con versión semántica (MAJOR: eliminación o redefinición de
principios; MINOR: principio o sección nueva; PATCH: aclaraciones) y fecha. Toda revisión de
código y cada `/speckit-plan` verifican cumplimiento; la complejidad adicional debe
justificarse por escrito en el plan.

**Version**: 1.2.0 | **Ratified**: 2026-09-13 | **Last Amended**: 2026-09-16

Enmienda 1.1.0 (2026-09-13): despliegue en VPS siempre encendida con Claude Code y reloj diario
(sección "Restricciones de Stack y Despliegue"); candado del panel en internet. Los principios I–X
no cambian.
