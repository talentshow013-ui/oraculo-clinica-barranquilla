# Contrato: LoteDatos (archivo)

Lo que escribe cualquier fuente (seed, Claude Code vía MCP) y lo que lee la interfaz.
Definición normativa: `lib/adapters/types.ts` (`LoteDatosSchema`). Este documento es la vista humana.

- Ruta: `datos/seed.json` (demostración) o `datos/lote.json` (real). UTF-8, JSON.
- Selección: variable `ORACULO_FUENTE` = `seed` (defecto) | `archivo`.
- Validación: `LoteDatosSchema.parse()` en el adapter; error → carga rechazada con mensaje que indica ruta JSON del campo (`insights[12].gasto`).
- Reglas: `null` para desconocido; fechas `YYYY-MM-DD` Bogotá; `meta.huecos` lista fechas del rango sin filas en `insights`; `meta.advertencias` texto libre para la UI (sin jerga).
- Tamaño esperado: ≤ 10 MB.
- Prohibido: cualquier campo no declarado en `RegistroEmbudo` o `BreakdownRow` (strict).
