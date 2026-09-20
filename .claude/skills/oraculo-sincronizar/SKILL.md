---
name: oraculo-sincronizar
description: Trae los datos reales de campañas de Meta (y opcionalmente el radar de competencia) al archivo datos/lote.json con la forma exacta del contrato de Oráculo, usando el conector oficial de Meta configurado en Claude Code. Úsalo cada mañana (lo hace el reloj de la VPS), cada semana antes de /oraculo-semana, o cuando digan "actualiza los datos", "sincroniza", "trae lo de Meta".
---

> **Candado:** este comando solo LEE. Nunca cambies nada en Meta por tu cuenta. Si el análisis concluye «apagar X», se recomienda con dato y riesgo y se espera a que una persona lo pida y confirme con un «sí» (regla en CLAUDE.md).


# /oraculo-sincronizar — Fuente real → `datos/lote.json`

Solo funciona cuando el conector oficial de Meta (`meta_ads`, https://mcp.facebook.com/ads) está
autorizado en Claude Code (ver `docs/CONEXION_MCP.md`). Si no está, dilo y termina: no hay forma
honesta de traer datos sin él.

## Principio

**Guardas las respuestas crudas del conector en `datos/crudo/` y el importador las mapea al
contrato.** Tú no calculas nada ni reescribes filas: `npm run importar-meta` hace el mapeo
(`lib/adapters/meta.mcp.ts`, `meta.importar.ts`, `meta.creativos.ts`), quita duplicados, valida el
esquema y escribe `datos/lote.json`. Lo que el conector no entrega queda `null`. Nunca 0, nunca
estimado. **El contrato (`lib/adapters/types.ts`) no se toca para acomodar la fuente.**

## Paso 0 — Conector, cuentas y rango

0. **Actualízate primero**: `git pull --ff-only` (trae código, skills y reglas nuevas desde GitHub).
   Si cambió algo: `npm ci --no-audit --no-fund`. Si el pull falla (cambios locales o sin red),
   dilo en una línea y sigue con lo que hay; nunca `git reset --hard` ni `git stash` sin avisar.
1. Verifica que existan las herramientas `ads_get_ad_accounts`, `ads_get_ad_entities` y
   `ads_get_creatives`. Si no aparecen: "El conector de Campañas no está autorizado en este
   equipo" y remite a `docs/CONEXION_MCP.md`.
2. Las cuentas son las de `config/cliente.ts → cuentasPublicitarias` (el `ad_account_id` del
   conector es el número sin `act_`). Si `ads_get_ad_accounts` muestra una cuenta con gasto que
   no está en la configuración, avisa: no la inventes en el lote.
3. Fechas en hora Bogotá. `HOY` = hoy; `AYER` = hoy − 1. Ventanas:
   - campañas: **90 días** diarios (AYER − 89 → AYER);
   - conjuntos y anuncios: **28 días** diarios (AYER − 27 → AYER);
   - desgloses por campaña: los mismos 28 días, agregados (sin `time_increment`);
   - creativos: los de todos los anuncios con gasto en esos 28 días.
   Usa siempre el mismo `client_conversation_id` de 20 caracteres en toda la sincronización y
   `include_additional_context: false`.
4. Vacía `datos/crudo/` de la corrida anterior (déjala en `datos/crudo/_aux/` si quieres
   conservarla; el importador ignora esa carpeta y todo archivo que empiece por `_`).

## Paso 1 — Campañas, conjuntos y anuncios por día (por cada cuenta)

Campos para `ads_get_ad_entities` (nivel campaña/conjunto/anuncio), siempre `time_increment: "1"`,
`limit: 1000`, `filtering: [{"field":"amount_spent","operator":"GREATER_THAN","value":["0"]}]`:

```
id, name, status, effective_status, objective, campaign_id (conjunto), adset_id + creative_id (anuncio),
amount_spent, impressions, reach, frequency, clicks, link_click, unique_link_click, results,
result_values, omni_landing_page_view, post_engagement, post_reaction, comment, post_save,
video_play_actions, video_continuous_2_sec_watched_actions, video_thruplay_watched_actions,
video_p25_watched_actions, video_p50_watched_actions, video_p75_watched_actions,
video_p95_watched_actions, video_p100_watched_actions, video_avg_time_watched_actions,
onsite_conversion_lead_grouped, instagram_profile_follow_v2
```

(`post_shares` y `3_second_video_plays` no existen a nivel anuncio: no los pidas ahí.)

**El límite de 1000 filas corta sin avisar y el cursor no es fiable**: nunca pidas más de 1000
filas por llamada. Regla: filas = entidades × días.

- Campañas (90 días): primero la lista de campañas con gasto en el rango (`fields: ["id","amount_spent"]`,
  sin `time_increment`); luego, con `object_ids`, lotes de **≤ 10 campañas × 91 días**.
- Conjuntos (28 días): lotes de **≤ 35 ids** con `object_ids`, o la lista completa si son ≤ 35.
- Anuncios (28 días): pide **por semanas** (`time_range` de 7 días, 4 llamadas por cuenta) con el
  filtro de gasto; cada semana cabe si hay ≤ 140 anuncios con gasto. Si una cuenta tiene más, parte
  la semana en dos.

Guarda cada respuesta **tal cual** (el JSON `{ad_entities: "..."}`) en:

```
datos/crudo/act_<cuenta>__campana__<n>.json
datos/crudo/act_<cuenta>__conjunto__<n>.json
datos/crudo/act_<cuenta>__anuncio__<n>.json
```

Las respuestas grandes las guarda Claude Code solas en su carpeta `tool-results`: cópialas de ahí
con su nombre nuevo. Las que lleguen en línea, escríbelas con un script corto (no las retipees).

Comprueba que cuadran: la suma de `amount_spent` de anuncios ≈ conjuntos ≈ campañas en los mismos
28 días (diferencias < 1 % son anuncios borrados). Si no cuadra, falta un lote.

## Paso 2 — Desgloses POR CAMPAÑA (no a nivel cuenta)

A nivel cuenta Meta **no entrega resultados** por segmento (mezcla tipos), así que Audiencias
quedaría en ceros. Pide los desgloses a **nivel campaña**, 28 días, **sin `time_increment`**
(una fila por campaña × segmento), con el filtro de gasto y `limit: 1000`:

| archivo | `breakdowns` |
|---|---|
| `act_<cuenta>__desglose-edad__campana__1.json` | `["age"]` |
| `act_<cuenta>__desglose-genero__campana__1.json` | `["gender"]` |
| `act_<cuenta>__desglose-ubicacion__campana__1.json` | `["region"]` |
| `act_<cuenta>__desglose-hora__campana__1.json` | `["hourly_stats_aggregated_by_advertiser_time_zone"]` (sin `reach`/`frequency`) |
| `act_<cuenta>__desglose-plataforma__campana__1.json` | `["publisher_platform","platform_position"]` |

Campos: los del paso 1 sin los de video de p25…p100 (no vienen con desgloses) y sin los ids de
padre. `region` + resultados viene «Not available»: es normal, la zona se lee solo por gasto.
El importador pone `nivel: "campana"`, `id` = campaña y la fecha final del lote; con eso el filtro
de campaña de la cabecera funciona en Audiencias. **No mezcles** desgloses de nivel cuenta con los
de campaña en la misma corrida (se contarían dos veces).

## Paso 3 — Creativos

1. Reúne los `creative_id` distintos de los archivos `__anuncio__` (un script corto).
2. `ads_get_creatives` con `creative_ids` en lotes de **≤ 50**, `fields: ["id","name","status",
   "object_type","body","title","link_url","image_url","thumbnail_url","video_id",
   "call_to_action_type","child_attachments","effective_object_story_id"]`.
3. Guarda cada respuesta tal cual en `datos/crudo/act_<cuenta>__creativo__<n>.json`.

El importador cruza creativo × anuncio (un `Creativo` por anuncio que lo usa), toma el primer día
con gasto y los días activos del anuncio, y clasifica ángulo, servicio y nivel de consciencia con
los diccionarios del radar (`lib/competitive/angles.ts`, `detectarServicio`). Las publicaciones
compartidas («impulsar publicación») no traen texto: se usa el nombre limpio del creativo.

## Paso 3b — Ranking frente a la competencia (lo único externo que entrega Meta)

Por cada cuenta: `ads_insights_auction_ranking_benchmarks` con `date_preset: "last_28d"`. Devuelve
un texto por cohorte («Cohort Info…») con, por anuncio, *Quality / Engagement Rate / Conversion Rate
Ranking* frente a anuncios de otros anunciantes que compiten por el mismo público. Guarda la
respuesta tal cual en `datos/crudo/act_<cuenta>__ranking__1.json` con la forma
`{"ad_account_id": "...", "capturado": "YYYY-MM-DD", "result": "<texto>"}`. Si responde «No auction
ranking benchmarks data available», guárdalo igual: el importador lo lee como «sin dato».
Solo trae anuncios con señal suficiente; los nuevos salen «Not Yet Available» (no se juzgan).
Alimenta la regla R27, la columna «Meta vs. competencia» de Creativos y el bloque «Frente a quién
te comparas» del Centro de mando.

## Paso 3c — Bitácora de cambios (quién prendió y apagó qué)

Por cada cuenta: `ads_account_get_activity_logs` con `event_category: "status"`, `limit: 1000` y
ventanas de **15 días** (`start_time`/`end_time` en ISO): más de 1000 eventos por llamada se
truncan sin aviso, y una cuenta activa pasa de 700 por quincena. Además una llamada con
`event_category: "account"` desde el inicio del periodo (personas agregadas/quitadas). Guarda cada
respuesta en `datos/crudo/act_<cuenta>__bitacora-<status|account>__<n>.json` con la forma
`{"ad_account_id": "...", "capturado": "YYYY-MM-DD", "ventanas": [{"inicio": "...", "fin": "...",
"eventos": [...]}]}` (los eventos son el arreglo que viene dentro de `result`). Las ventanas
pueden solaparse: el importador quita duplicados. Si el conector responde «This tool is new and is
being gradually rolled out», esa cuenta queda sin bitácora y el panel lo dice.
Alimenta la regla R28 y el bloque «Quién cambió qué» de Campañas.

## Paso 3d — Públicos (segmentación de cada conjunto)

Por cada cuenta: `ads_get_ad_entities` con `level: "adset"`, `time_range` = todo el periodo del lote
(90 días), **sin** `time_increment`, `limit: 1000`, filtro `amount_spent > 0` y
`fields: ["id","name","campaign_id","campaign_name","status","effective_status","optimization_goal",
"destination_type","targeting","learning_stage_info","daily_budget","created_time","amount_spent",
"impressions","reach","frequency","clicks","link_click","results","cost_per_result"]`.
Devuelve una fila por conjunto con su `targeting` (edad, género, radio, intereses, públicos
personalizados/similares, Advantage+) y las métricas agregadas del rango. Guarda la respuesta en
`datos/crudo/act_<cuenta>__publico__1.json` **agregando** `"capturado"`, `"desde"` y `"hasta"`
(YYYY-MM-DD) al JSON. Alimenta la pestaña Públicos (ganadores, grupos y sugerencias).

## Paso 3e — Orgánico (Instagram y Facebook sin pauta)

No pasa por el conector de anuncios: va directo a Meta con el token de página del `.env`
(`META_ORGANICO_TOKEN`, `META_PAGINA_ID`, `META_INSTAGRAM_ID`; los deja `npm run organico:conectar`).

1. Si el `.env` tiene `META_ORGANICO_TOKEN`: `npm run organico:sincronizar` (últimos 30 días,
   incremental; la primera vez `-- --dias 90`). Escribe `datos/organico.json`.
2. Si no lo tiene: no inventes nada; reporta «orgánico sin conectar» y sigue. La guía para
   conectarlo está en `docs/CONEXION_ORGANICO.md`.
3. Lee los avisos que imprime (métricas que Meta no entregó) y repítelos en el reporte final.

## Paso 3g — Pauta de TikTok y TikTok orgánico

- Pauta: si el `.env` tiene `TIKTOK_ACCESS_TOKEN` y `TIKTOK_ADVERTISER_ID`: `npm run tiktok:sincronizar`
  (30 días; primera vez `-- --dias 90`). Escribe `datos/tiktok.json`; el panel lo fusiona con Meta
  como la cuenta «TikTok · <id>». Si no está, reporta «TikTok sin conectar» y sigue.
- Orgánico: TikTok no lo da por API. Si la clínica dejó un CSV de TikTok Studio en `datos/entrada/`
  (o te lo pasan), `npm run organico:importar-tiktok -- <csv>`; si no hay archivo, no inventes nada.

## Paso 3h — Pauta de Google Ads

Si el `.env` tiene `GOOGLE_ADS_REFRESH_TOKEN` y `GOOGLE_ADS_CUSTOMER_ID`: `npm run googleads:sincronizar`
(30 días; primera vez `-- --dias 90`). Escribe `datos/googleads.json`; el panel lo fusiona como la
cuenta «Google Ads · <id>». Si no está, reporta «Google Ads sin conectar» y sigue.

## Paso 3f — Sitio web (Google Analytics 4)

Tampoco pasa por el conector: usa la llave de solo lectura del `.env` (`GA4_PROPIEDAD_ID`,
`GA4_CREDENCIALES`). Si está: `npm run web:sincronizar` (30 días, incremental; primera vez
`-- --dias 90`). Escribe `datos/web.json`. Si no está, reporta «sitio web sin conectar»
(`docs/CONEXION_GA4.md`) y sigue. Repite sus avisos en el reporte final.

## Paso 3i — Borradores (opcional)

Si piden revisar borradores: `ads_get_ad_entities` con `level: "campaign"` y `object_state: "draft"`
(sin filtros ni métricas). Se guarda tal cual en `datos/crudo/act_<cuenta>__borrador__1.json` para
que `/oraculo-pregunta` los comente; no entran al lote (no tienen rendimiento).

## Paso 6b — Referencias de otras ciudades (opcional, mensual)

Capturas de la Biblioteca de anuncios de otros mercados, a `datos/referencias/` (no al radar):
`npm run radar:capturar -- --q "clínica estética Cartagena" --pais CO --estado all --max 60 --sin-imagenes --salida datos/referencias/cartagena-1.json`
y lo mismo para `santamarta-1`, `medellin-1`, `miami-1` (`--pais US`)… El prefijo del archivo
decide la ciudad (tabla en `lib/adapters/referencias.adapter.ts`). El panel los estudia solo.

## Paso 4 — Resultados de la clínica

**No se sincronizan aquí.** Se anotan por campaña en la pantalla Campañas del panel
(`datos/resultados.json`) y el motor los mezcla solo. Los pasos de pauta del embudo (vieron, clic,
escribieron) salen de los insights automáticamente.

## Paso 5 — Importar, validar, verificar

```
npm run importar-meta            # datos/crudo/*.json → datos/lote.json (conserva radar/experimentos del lote anterior con --base)
npm run validar-lote
ORACULO_FUENTE=archivo npm run verificar
```

Si el importador ignora un archivo, el nombre no sigue la convención. Si el validador falla, el
mensaje trae la ruta exacta del campo: corrige el crudo o el mapeo, nunca el contrato. Si detecta un
dato sensible, elimina la columna de origen y avisa a la coordinadora.

## Paso 6 — Radar de mercado (Biblioteca de anuncios)

La Biblioteca de anuncios de Meta **no expone anuncios comerciales de Colombia por su API**
(solo UE/UK), pero la interfaz pública sí los muestra. Dos caminos al mismo contrato:

**A) Captura propia (gratis, principal).** Requiere Chromium instalado una vez
(`npx playwright install chromium`; si la descarga falla, ver docs/CONEXION_MCP.md).

1. Lee `config/competidores.json` (si no existe, cópialo de `config/competidores.example.json`
   y pregunta a la coordinadora por 6-10 páginas de competidores del radio).
2. Por cada competidor con `pageId`: `npm run radar:capturar -- --pagina <pageId> --estado all --max 80`
   (acumula en `datos/radar-ui.json`). Para descubrir quién más pauta:
   `npm run radar:capturar -- --q "clínica estética barranquilla"` (y variantes).
3. `npm run importar-radar -- datos/radar-ui.json --ciudades config/competidores.json` → fusiona en
   `datos/lote.json`, valida y guarda los creativos en `public/radar/<id>.jpg`.
4. Si la captura devuelve 0 tarjetas con identificador, Meta cambió la página: usa el camino B y avisa.

**B) Apify (respaldo, de pago por resultado).** Actor `apify/facebook-ads-scraper` vía MCP:
`call-actor` con `startUrls` = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CO&view_all_page_id=<pageId>`,
`scrapeAdsNewerThan: "6 months"` la primera vez y "5 weeks" después; `get-actor-output` → guarda el
dataset en `datos/radar-apify.json` → `npm run importar-radar -- datos/radar-apify.json --ciudades config/competidores.json`.

En ambos casos: alcance, gasto e impresiones vienen vacíos para comerciales fuera de la UE → `—`.
**Jamás se estima.**

## Paso 7 — Activar y reportar

Asegúrate de que `.env` tenga `ORACULO_FUENTE=archivo` y reinicia el panel si corre como servicio
(`sudo systemctl restart oraculo-panel`). Di cuántas filas por nivel, cuántos desgloses y creativos,
el rango, los huecos y las advertencias. Sugiere correr `/oraculo-semana`.
