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

## Paso 1 — Traer insights por día y nivel (por cada cuenta)

Repite este paso para **cada cuenta** de `config/cliente.ts → cuentasPublicitarias`, poniendo
su `act_…` en `cuentaId`. Todas van al mismo `datos/lote.json`; el panel las separa.

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

**La agenda NO se sincroniza aquí.** La coordinadora la registra cada lunes en la pantalla
«Agenda semanal» del panel (`datos/agenda.json`, cinco números por semana) y el motor la mezcla
solo (`lib/agenda`). En `embudo` deja únicamente los pasos de pauta: `impresion` (impresiones),
`clic` (clics de enlace) y `conversacion` (conversaciones iniciadas) por día y campaña, desde los
insights de nivel campaña. Si no los escribes, el motor los deriva de los insights igual.
Solo si te entregan una planilla agregada (sin nombres ni teléfonos; si los trae, no la leas y
avisa), puedes convertirla en registros `lead_calificado`…`recompra`, pero una semana registrada
en el panel siempre manda sobre eso.

## Paso 4 — Creativos

Por cada anuncio con gasto: `Creativo` con `copyPrincipal`, `titular`, `descripcion`, `cta`,
`urlDestino`, `formato`, `fechaPrimerGasto`, `diasActivo`, `servicio` (dedúcelo del nombre de
campaña/anuncio). `anguloDetectado`, `nivelConsciencia`, `confianzaClasificacion`,
`senalesDeteccion`: usa `clasificarAngulo` y `nivelConscienciaTexto` de
`lib/competitive/angles.ts` (puedes correr un script con `npx tsx`), no tu criterio.

## Paso 5 — Radar de mercado (Biblioteca de anuncios)

La Biblioteca de anuncios de Meta **no expone anuncios comerciales de Colombia por su API**
(solo UE/UK), pero la interfaz pública sí los muestra. Hay dos caminos al mismo contrato:

**A) Captura propia (gratis, principal).** Requiere Chromium instalado una vez
(`npx playwright install chromium`; si la descarga falla, ver docs/CONEXION_MCP.md).

1. Lee `config/competidores.json` (si no existe, cópialo de `config/competidores.example.json`
   y pregunta a la coordinadora por 6-10 páginas de competidores del radio).
2. Por cada competidor con `pageId`: `npm run radar:capturar -- --pagina <pageId> --estado all --max 80`
   (acumula en `datos/radar-ui.json`). Para descubrir quién más pauta:
   `npm run radar:capturar -- --q "clínica estética barranquilla"` (y variantes: "botox barranquilla",
   "depilación láser barranquilla", "medicina estética barranquilla").
3. `npm run importar-radar -- datos/radar-ui.json --ciudades config/competidores.json` → fusiona en
   `datos/lote.json`, valida y guarda los creativos en `public/radar/<id>.jpg` (el panel los muestra).
4. Si la captura devuelve 0 tarjetas con identificador, Meta cambió la página: usa el camino B y avisa.

**B) Apify (respaldo, de pago por resultado).** Actor `apify/facebook-ads-scraper` vía MCP
(`https://mcp.apify.com?tools=apify/facebook-ads-scraper`): `call-actor` con
`startUrls` = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CO&view_all_page_id=<pageId>`,
`scrapeAdsNewerThan: "6 months"` la primera vez y "5 weeks" después; `get-actor-output` → guarda el
dataset en `datos/radar-apify.json` → `npm run importar-radar -- datos/radar-apify.json --ciudades config/competidores.json`.
Costo ~$3,40–5,80 USD por 1.000 anuncios contra el crédito prepagado (gratis $5/mes).

En ambos casos: `collationCount`/"N anuncios usan este contenido" → variantes; alcance, gasto e
impresiones vienen vacíos para comerciales fuera de la UE → `—`. **Jamás se estima.**

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
