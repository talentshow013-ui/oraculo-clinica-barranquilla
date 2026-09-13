# Contrato: skills de Claude Code (`.claude/skills/oraculo-*`)

| Skill | Entrada | Salida | Reglas |
|---|---|---|---|
| `oraculo-sincronizar` | Rango de fechas; MCP oficial de Meta conectado | `datos/lote.json` válido contra `LoteDatosSchema`; `npm run validar-lote` verde | Solo mapea respuestas al contrato; nunca calcula razones; `null` donde la herramienta no entrega; escribe `meta.huecos` y `meta.advertencias`. Si el esquema falla, corrige el mapeo, no el esquema. |
| `oraculo-semana` | Salida de `npm run verificar -- --json` | `reportes/YYYY-Www.md` en lenguaje de dueño | Cada cifra cita `metricaId` o `reglaId`; discrepa con evidencia; no inventa; marca estimados y datos no calibrados. |
| `oraculo-pregunta` | Pregunta del gerente en lenguaje natural | Respuesta con dato, regla y alternativa | Si los datos contradicen la premisa, empieza con "no, esto no va por ahí" + dato + alternativa. |
