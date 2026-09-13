---
name: oraculo-sincronizar
description: Trae los datos reales de campañas de Meta (y opcionalmente TikTok y el radar de competencia) al archivo datos/lote.json con la forma exacta del contrato de Oráculo, usando los conectores oficiales configurados en Claude Code. Úsalo cada semana antes de /oraculo-semana, o cuando digan "actualiza los datos", "sincroniza", "trae lo de Meta".
---

# /oraculo-sincronizar — Fuente real → `datos/lote.json`

Este skill es la **Fase 2** del proyecto. Solo funciona cuando el conector oficial de Meta está
añadido en Claude Code (ver `docs/CONEXION_MCP.md`, documento interno). Si no está, dilo y
termina: no hay forma honesta de traer datos sin él.

## Principio

**Mapeas respuestas al contrato. No calculas nada.** El motor hace las razones, los
agregados y los diagnósticos. Tú produces filas crudas: gasto, impresiones, clics, resultados…
Lo que la herramienta no entrega es `null`. Nunca 0, nunca estimado.

**El contrato no se modifica para acomodar la fuente.** Si algo no encaja, se ajusta el mapeo.
Si el esquema rechaza el archivo, se corrige el archivo.

## Paso 0 — Confirmar el conector

Verifica que existan las herramientas de reporting del conector de Meta (`ads_get_ad_entities`,
`ads_insights_performance_trend`, etc.). Si no aparecen, informa: "El conector de Campañas y
audiencias no está configurado en este equipo" y remite a `docs/CONEXION_MCP.md`.

Lee `datos/lote.json` si existe para conocer `meta.hasta`: traerás desde el día siguiente
(con 3 días de solape para que la atribución se estabilice) hasta ayer (hora Bogotá).
Si no existe, trae 90 días.

## Paso 1 — Traer insights por día y nivel

Para los niveles `campana`, `conjunto` y `anuncio`, pide desglose diario (`time_increment=1`)
con al menos: gasto, impresiones, alcance, frecuencia, clics, clics de enlace, clics únicos,
interacciones, reacciones, comentarios, compartidos, guardados, vistas de página de destino,
reproducciones (2 s / 3 s / ThruPlay / 25 / 50 / 75 / 95 / 100 %), tiempo de reproducción,
conversaciones iniciadas, resultados y su tipo, valor de conversión, ventana de atribución,
estado, objetivo, id del padre.

Mapea cada fila a `InsightRow` (`lib/adapters/types.ts`). Campos obligatorios: `fuente: "meta"`,
`fecha` (YYYY-MM-DD Bogotá), `nivel`, `id`, `nombre`, `cuentaId`, `estado`, `gasto`,
`impresiones`, `clics`, `clicsEnlace`, `resultados`, `ventanaAtribucion`. **Todo lo demás es
nullable: si no viene, `null`.** El nombre es el de la campaña/anuncio, nunca de una persona.

Para consultas grandes usa el modo asíncrono del conector. Vigila el encabezado de uso del
negocio (error 17 = límite): si aparece, espera y reintenta; no partas el rango a mano.

## Paso 2 — Traer desgloses (nivel cuenta)

Dimensiones: `edad`, `genero`, `ubicacion` (región/ciudad), `plataforma` (plataforma ×
ubicación de anuncio), `hora` (hora del día, últimos 28 días bastan), `dispositivo` si está.
Cada fila → `BreakdownRow` = `InsightRow` + `dimension`, `valor`, `nRegistros`.

`nRegistros` = personas del segmento (usa alcance si viene; si no, impresiones / frecuencia;
si tampoco, `Math.round(impresiones / 1.4)`). Es lo que protege el k-anonimato.

## Paso 3 — Agenda y ventas (datos de la clínica)

Pregunta a la coordinadora por la planilla semanal (o lee `datos/agenda.csv` si existe) con
columnas **agregadas por día, campaña y servicio**: `fecha, campanaId, servicio, conversaciones,
leads_calificados, citas_agendadas, citas_asistidas, ventas, valor_ventas_cop, recompras,
valor_recompras_cop`. Conviértelas en `RegistroEmbudo` (un registro por paso, `nRegistros` =
cantidad). **Ni nombres, ni teléfonos, ni historias: si la planilla trae una columna así, no la
leas y avisa.** `impresion` y `clic` del embudo salen de los insights (nivel campaña).

## Paso 4 — Creativos

Por cada anuncio con gasto: `Creativo` con `copyPrincipal`, `titular`, `descripcion`, `cta`,
`urlDestino`, `formato`, `fechaPrimerGasto`, `diasActivo`, `servicio` (dedúcelo del nombre de
campaña/anuncio). `anguloDetectado`, `nivelConsciencia`, `confianzaClasificacion`,
`senalesDeteccion`: usa `clasificarAngulo` y `nivelConscienciaTexto` de
`lib/competitive/angles.ts` (puedes correr un script con `npx tsx`), no tu criterio.

## Paso 5 — Radar (opcional)

Si el conector de Apify está configurado, trae anuncios activos de los competidores listados
en `config/competidores.json` (si existe) y mapea a `AnuncioCompetidor`. `alcanceRango` solo si
la fuente lo expone; **jamás estimes**. `puntuacionLongevidad` ponla en 0: el motor la recalcula.
Si no hay conector, deja `competidores` y `anunciosCompetencia` vacíos y avisa.

## Paso 6 — Escribir y validar

Fusiona con el lote anterior (reemplaza las fechas del rango nuevo, conserva el resto).
Escribe `datos/lote.json` con:

```json
{ "insights": [...], "desgloses": [...], "creativos": [...], "embudo": [...],
  "competidores": [...], "anunciosCompetencia": [...], "experimentos": [...],
  "meta": { "generadoEn": "<ISO con -05:00>", "desde": "...", "hasta": "...", "origen": "archivo",
            "huecos": ["fechas del rango sin filas"], "advertencias": ["texto para el cliente, sin jerga"] } }
```

`experimentos`: conserva los de `datos/experimentos.json`.

Luego:

```
npm run validar-lote
```

Si falla, el mensaje dice la ruta exacta del campo (`insights[12].gasto`). Corrige el mapeo y
repite. **No toques `lib/adapters/types.ts`.** Si detecta un dato sensible, elimina la
columna de origen y avisa a la coordinadora.

## Paso 7 — Activar y reportar

Asegúrate de que `.env` tenga `ORACULO_FUENTE=archivo`. Di cuántas filas, el rango, los
huecos y las advertencias. Sugiere correr `/oraculo-semana`.
