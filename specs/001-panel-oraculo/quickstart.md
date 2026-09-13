# Quickstart: validar Panel ORÁCULO

## Prerrequisitos
Node ≥ 20, npm, Windows 10/11 (o cualquier SO para desarrollo).

## Setup
```
npm install
npm run seed          # genera datos/seed.json (180 días deterministas)
```

## Validaciones por fase
| Fase | Comando | Resultado esperado |
|---|---|---|
| 0 | `npm run typecheck` | sin errores |
| 1 | `npm test` | ≥ 20 tests verdes; incluye null≠0, 9,1 %, fuga al margen, POAS 0,8, sin Infinity, PII, k=5 |
| 2 | `npm run verificar` | imprime hallazgos ordenados por plata; encuentra ≥ 8 patrones plantados |
| 3 | `npm run seed && npm run validar-lote` | seed válido contra el contrato |
| 4 | `npm run dev` → abrir `/panel` y las otras 12 rutas | cargan; ningún `null` como 0; huecos visibles |
| 5 | leer `README.md` | un tercero levanta el proyecto sin ayuda |

## Escenarios de aceptación rápidos
- **Fuente real sin tocar UI**: copiar `datos/seed.json` a `datos/lote.json`, `ORACULO_FUENTE=archivo npm run dev` → mismo panel.
- **Lote inválido**: editar `datos/lote.json` y poner `"gasto": null` en una fila → `npm run validar-lote` falla indicando `insights[i].gasto`.
- **PII rechazada**: añadir `"telefono": "300..."` a un `RegistroEmbudo` → carga falla citando Ley 1581.
- **Jerga**: `npm test -- sin-jerga` verde.
