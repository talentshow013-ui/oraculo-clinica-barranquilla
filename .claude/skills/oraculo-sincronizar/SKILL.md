---
name: oraculo-sincronizar
description: Trae los datos reales de campañas de Meta (y opcionalmente el radar de competencia) al archivo datos/lote.json con la forma exacta del contrato de Oráculo, usando el conector oficial de Meta configurado en Claude Code. Úsalo cada mañana (lo hace el reloj de la VPS), cada semana antes de /oraculo-semana, o cuando digan "actualiza los datos", "sincroniza", "trae lo de Meta".
---

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
