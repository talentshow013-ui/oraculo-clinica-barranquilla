# ORÁCULO — Diseño del sistema (v2, alineado al Prompt Maestro)
**Fecha:** 2026-09-13 · **Cliente:** Clínica estética, Barranquilla · **Fuente de verdad funcional:** `PROMPT_ORACULO_v2.md`

Este documento no repite el prompt maestro: lo referencia y registra las **decisiones de
implementación** y las **mejoras** que se agregan sobre él.

## 1. Qué se construye
Panel local de inteligencia de marketing (Next.js 15, sin backend, sin base de datos en fase 1)
que lee un **lote de datos** validado por Zod, corre un **motor determinista** (145 métricas,
26 reglas, embudo de 8 pasos valorizado en COP, radar de competencia por longevidad,
oportunidades ICE, 7 lentes de auditoría, privacidad k=5) y lo muestra en 12 pantallas.

## 2. Despliegue real (restricción del cliente)
- Corre en el PC Windows de la coordinadora. `git clone` → `npm install` → `npm run dev`.
- El motor de análisis narrativo es **Claude Code (VS Code) con la suscripción de la coordinadora**.
- **Cómo entran los datos reales (Fase 2):** Claude Code, con el MCP oficial de Meta
  (`https://mcp.facebook.com/ads`, OAuth, sin tokens de largo plazo), ejecuta el skill
  `/oraculo-sincronizar`, que consulta reporting y escribe `datos/lote.json` con la forma exacta
  de `LoteDatos`. El adapter de archivo lo valida con el **mismo Zod** que el seed. Ni un componente cambia.
- Sin credenciales en el repo. `.env.example` documenta lo único configurable (App ID de Meta).

## 3. Arquitectura
Estructura, contrato, módulos, reglas, fases y criterios: **secciones 5-13 del prompt maestro.**
Se implementan tal cual. Decisiones adicionales:

| Tema | Decisión |
|---|---|
| Fechas | `date-fns-tz`, siempre `America/Bogota`. Función única `hoyBogota()` en `lib/format`. |
| Comparaciones | Toda comparación de periodos usa ventanas del mismo tamaño (`ventanasIguales()` en core, con test). |
| Razones | No existe función que promedie razones. Test explícito 91/1000 = 9,1%. |
| Seed | 180 días deterministas (PRNG con semilla fija, `mulberry32`), patrones plantados de §11. |
| Adapter activo | `lib/datos.ts` expone `fuenteActiva`: `mock` (seed) o `archivo` (`datos/lote.json`). Se elige por `ORACULO_FUENTE` env. |
| Motor sin UI | `scripts/verificar.ts` imprime hallazgos ordenados por plata; sirve de smoke test en CI. |
| UI | Primitivas propias (`Kpi`, `Panel`, `Etiqueta`, `Barra`, `Vacio`, `Celda`, `Th`, `Aviso`). Tema §10. Server Components. |

## 4. Mejoras sobre el prompt maestro (agregadas)
1. **Skills de Claude Code** (`.claude/skills/oraculo-*`): `sincronizar` (Fase 2, Meta MCP → lote.json),
   `semana` (lee salida del motor y redacta el informe de dirección con el carácter de §1),
   `pregunta` (el gerente pregunta; se responde citando métrica y regla). El código calcula,
   el director interpreta. Nunca al revés.
2. **`docs/PROMPT-FRONTEND.md`**: prompt de conexión para el agente de diseño: contrato, rutas,
   qué decisión habilita cada pantalla, tema, reglas de `null`/`—`, qué NO tocar (`lib/`).
3. **Registro de experimentos** (`datos/experimentos.json` + tipo `Experimento`): memoria de lo
   probado y su resultado; alimenta `filtrarYaProbadas` (§7.7). Sin esto el mandato 4 no se cumple.
4. **`npm run verificar` en `pretest`**: el motor entero corre antes de cada suite.
5. **Instalador Windows** (`instalar.ps1`): comprueba Node ≥ 20, instala, corre seed, abre panel.
6. **README para la coordinadora** en 5 pasos, sin jerga, + `docs/` técnicos de §13 Fase 5.

## 5. Fuera de alcance v1
Conexión en vivo a Meta/TikTok/Apify (Fase 2, cuando el cliente entregue accesos), persistencia,
multi-sede, autenticación.

## 6. Orden de ejecución
Fase 0 → 1 → 2 → 3 → 4 → 5 con los criterios de aceptación de §13. Se ejecuta con spec-kit
(constitution → specify → plan → tasks → implement) y TDD en `lib/`.
