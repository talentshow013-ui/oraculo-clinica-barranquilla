# Conexión de fuentes — documento interno (no se comparte con el cliente)

> Al cliente se le habla de "Campañas y audiencias", "Video corto", "Radar de mercado" y
> "Agenda y ventas". Este documento usa los nombres técnicos porque es para quien instala.

## Principio: cero API propia

No se desarrollan wrappers, no se pasa revisión de app, no se guardan tokens de largo plazo.
Todo entra por **conectores MCP oficiales alojados por las plataformas**, invocados desde
**Claude Code en el equipo de la coordinadora con su propia suscripción**. Claude mapea las
respuestas al contrato y escribe `datos/lote.json`; el motor hace el resto. El código del panel
no contiene ningún cliente HTTP.

## Meta — MCP oficial (Ads)

- Endpoint: `https://mcp.facebook.com/ads` · alojado por Meta · OAuth · beta.
- Documentación: developers.facebook.com → Ads & Commerce → Ads AI Connectors → Ads MCP Server.
- Alta en Claude Code (una sola vez, en el equipo de la coordinadora):

```
claude mcp add --transport http meta_ads https://mcp.facebook.com/ads
```

  **No necesita App ID ni app de desarrollador**: el conector es de Meta y se autoriza con «iniciar
  sesión con Facebook» (la cuenta que administra el Business Manager de la clínica). Ponerle un
  `--client-id` rompe la autorización (error PKCE `code_verifier … without a code_challenge`).
  Si Claude Code dice «Dynamic registration is not available», la alternativa es agregarlo desde
  claude.ai → Configuración → Conectores → Añadir conector personalizado con la misma URL. Al primer uso, Claude Code abre el navegador para autorizar con la cuenta que
  administra el Business Manager de la clínica. El token vive en la sesión; no se copia a ningún
  archivo del proyecto.
- Permisos que pedirá: `ads_mcp_management`, `ads_read`, `ads_management`, `catalog_management`,
  `business_management`, `pages_show_list`, `instagram_basic`.

### Herramientas de reporting que alimentan el panel

| Herramienta | Alimenta |
|---|---|
| `ads_get_ad_entities` | campañas/conjuntos/anuncios con gasto, impresiones, clics, resultados; filtros, desgloses y rangos → `InsightRow`, `BreakdownRow` |
| `ads_insights_performance_trend` | evolución de costo por clic, por mil, por resultado, retorno, tasa de clics → contraste con `serie` |
| `ads_insights_anomaly_signal` | patrones inusuales → señal complementaria, **nunca sustituto del motor** |
| `ads_insights_auction_ranking_benchmarks` | posición en subasta → contexto para R02 |
| `ads_insights_industry_benchmark` | comparación con anunciantes similares → calibrar umbrales iniciales (declarando origen) |
| `ads_get_opportunity_score` | puntaje 0-100 → métrica `puntaje_optimizacion` |
| `ads_insights_advertiser_context` | contexto de negocio y embudo |

Operativo: vigilar el encabezado `X-Business-Use-Case-Usage` (error 17 al 100 %). Para consultas
grandes de insights usar trabajos asíncronos. Rango recomendado por sincronización: desde
`meta.hasta − 3 días` (solape para atribución) hasta ayer.

### Cuentas publicitarias

Cada `InsightRow`/`BreakdownRow` lleva `cuentaId` (el `act_…` de Meta). La sincronización trae
TODAS las cuentas listadas en `config/cliente.ts` → `cuentasPublicitarias` en un solo lote; el
panel filtra por la cuenta elegida (cookie `cuenta`) y nunca las suma. Los registros de agenda
se asocian por `campanaId` → campaña → cuenta.

### Mapeo al contrato (verificado con datos reales el 2026-09-14)

El mapeo vive en código, con tests: `lib/adapters/meta.mcp.ts` (filas y desgloses),
`lib/adapters/meta.creativos.ts` (creativos) y `lib/adapters/meta.importar.ts` (archivos crudos →
lote). La receta completa de llamadas está en `.claude/skills/oraculo-sincronizar/SKILL.md`.

Lo que el conector entrega y cómo se lee:

- Números como texto («$ 29.733.426 COP», «98765», «1.82»); ausentes como `null` o «Not available».
  Otra moneda distinta de COP detiene la importación (no se mezclan monedas).
- `results` = `{indicator, value}` o `{indicator, values:[{attribution_windows, value}]}`. El
  indicador dice el tipo: `messaging_conversation_started_7d` → conversación (también llena
  `conversacionesIniciadas`), `leadgen`/`lead_grouped` → lead, `link_click`, `profile_visit_view`…
- Campos por nivel: `amount_spent, impressions, reach, frequency, clicks, link_click,
  unique_link_click, results, result_values, omni_landing_page_view, post_engagement, post_reaction,
  comment, post_save, video_play_actions, video_thruplay_watched_actions, video_p25…p100,
  video_avg_time_watched_actions, onsite_conversion_lead_grouped, instagram_profile_follow_v2,
  status, effective_status, objective, campaign_id, adset_id, creative_id`. **No existen por
  anuncio**: `post_shares`, `3_second_video_plays`; y `video_continuous_2_sec_watched_actions`
  llega vacío → el gancho cae al 25 % visto (`hookRate`).
- `tiempoReproduccionTotal` = reproducciones × promedio de segundos (lo único derivado; declarado).
- **Límite 1000 filas por llamada, corta sin avisar y el cursor de paginación falla**: se pide por
  lotes (`object_ids`) o por semanas para que entidades × días ≤ 1000.
- **Desgloses**: a nivel cuenta Meta no entrega `results` (mezcla tipos) → se piden a **nivel
  campaña** sin `time_increment` (una fila por campaña × segmento, 28 días). `region` no trae
  resultados (solo gasto). Combinar dos desgloses (`region`+`age`) devuelve vacío.
- **Creativos**: `ads_get_creatives` con `creative_ids` (≤ 50 por llamada). Los `SHARE`
  («impulsar publicación») no traen `body`/`title`: se usa el nombre limpio del creativo. Formato:
  `video_id` → video; `child_attachments` ≥ 2 → carrusel; miniatura `/t15.` → video; si no, imagen.
- Estados: `PENDING_REVIEW/PREAPPROVED` → en revisión; `DISAPPROVED` → rechazado; `PAUSED` →
  pausado; `ARCHIVED/DELETED` → archivado; el resto activo.
- Resultado de la primera carga real (4 cuentas): 97 campañas con gasto en 90 días, 15.540 filas
  diarias, 2.768 desgloses por campaña, 320 creativos, 0 huecos; anuncios ≈ conjuntos ≈ campañas
  en gasto (diferencias < 1 % por anuncios borrados).

## TikTok — MCP oficial (opcional)

- TikTok for Business MCP Server (~400 herramientas). Docs: business-api.tiktok.com → TikTok Ads MCP Server v1.3.
- **Usar el modo de carga progresiva**, nunca el que expone el catálogo completo: quema contexto sin
  aportar; el panel solo necesita reporting.
- Mapeo: gancho a 2 s (`reproducciones2s`) y 6 s (`reproducciones6s`); el motor cae a ellos cuando
  no hay 3 s / ThruPlay. `fuente: "tiktok"`.

## Radar — captura propia con Playwright (principal, gratis; verificado en vivo 2026-09-13)

`npm run radar:capturar -- --q "clínica estética barranquilla"` abre la Biblioteca pública con un
navegador controlado (Playwright, Chromium), hace scroll, y extrae por tarjeta: identificador,
"En circulación desde el <fecha>", activo/inactivo, "N anuncios usan este contenido" (variantes),
nombre de la página y su enlace, copy, CTA, destino real (deshace `l.facebook.com/l.php?u=`),
imagen de mayor resolución o póster del video. Descarga los creativos a `public/radar/<id>.jpg`
(Meta caduca sus URLs; el archivo local perdura). Prueba real: 29 resultados → 22 tarjetas → 22 creativos.

- Parser puro y testeado: `lib/adapters/radar.ui.ts` (español e inglés). Capturador: `scripts/radar-capturar.ts`.
- `--pagina <pageId>` para seguir un competidor; `--estado all` para ver también inactivos (salidas
  rápidas); `--visible` para depurar con el navegador a la vista.
- Requiere `npx playwright install chromium` una vez. Si la descarga del CDN se agota, fijar
  `playwright@1.59.1` (ya está en `package.json`) reutiliza el Chromium 1223 si existe en
  `%LOCALAPPDATA%\ms-playwright`; o descargar en otro momento.
- Riesgos: Meta cambia el DOM (el extractor se ancla en el texto "Identificador de la biblioteca" +
  "Ver detalles del anuncio", no en clases); bloqueos por volumen (correr semanal, no diario; máximo
  ~80 por página). Si devuelve 0 tarjetas, usar Apify (mismo contrato).
- Lo que este camino NO puede dar y Apify sí: `pageLikeCount` (tamaño de la página). Nada más.

## Radar — Apify MCP (respaldo; verificado 2026-09-13)

**Por qué Apify y no la API oficial:** la API de la Biblioteca de anuncios de Meta devuelve
anuncios comerciales (`ad_type=ALL`) **solo cuando `ad_reached_countries` es de la UE o UK**; para
Colombia solo entrega políticos y de temas sociales. Los comerciales se ven en la interfaz pública,
y eso es lo que raspa el actor `apify/facebook-ads-scraper`.

- MCP: `https://mcp.apify.com?tools=apify/facebook-ads-scraper` · OAuth (el navegador pide
  sesión la primera vez; sin token en archivos) · alternativa `Authorization: Bearer <token>`.
- Alta rápida: `apify mcp install claude-code` (usa el token guardado del CLI de Apify), o
  `claude mcp add --transport http apify "https://mcp.apify.com?tools=apify/facebook-ads-scraper"`.
- Herramientas: `call-actor` (ejecuta) y `get-actor-output` (dataset completo; la primera
  respuesta viene recortada para no saturar el contexto).
- Entrada del actor: URLs de la Biblioteca (`view_all_page_id=<pageId>`, `country=CO`), estado
  activo/inactivo/todos, tipo de medio, "más nuevos que N días/meses", límite de resultados.
- Salida (campos reales): `adArchiveID`, `pageID`, `pageName`, `pageLikeCount`, `isActive`,
  `startDate`/`startDateFormatted`, `endDate`/`endDateFormatted`, `publisherPlatform[]`,
  **`collationCount`** (variantes del concepto), `categories[]`, `snapshot.{title, body.text,
  ctaText, linkUrl, images[], videos[], cards[]}`, `reachEstimate`, `spend`, `impressionsWithIndex`.
  Para comerciales fuera de la UE `reachEstimate`, `spend` e `impressions` vienen **null** →
  `alcanceRango: null`. Consistente con el contrato: jamás se estima.
- Mapeo: `lib/adapters/radar.apify.ts` (con tests). Importación: `npm run importar-radar -- <dataset.json>`.
- Costo: pago por resultado, ~$3,40–5,80 USD por 1.000 anuncios según plan; se descuenta del
  crédito prepagado mensual (gratis $5/mes; Starter $19/mes con $19 de uso). No hay cargo por
  búsqueda ni por corrida aparte de los resultados y el cómputo del actor. Una corrida semanal de
  10 competidores cabe en el plan gratuito.
- Retención: los anuncios comerciales fuera de la UE solo aparecen mientras están activos; por
  eso se corre semanalmente y se conserva el histórico en `datos/lote.json` (el importador
  reemplaza el bloque de radar: si se quiere histórico de inactivos, fusionar antes de importar —
  pendiente de implementar cuando haya datos reales).
- Lista de competidores: `config/competidores.json` (copiar de `config/competidores.example.json`).

## Agenda y ventas — planilla de la clínica

No hay conector: es una planilla semanal **agregada** (fecha × campaña × servicio) sin datos de
pacientes. Formato en el skill `oraculo-sincronizar`. Si el software de agenda exporta CSV, se
agrega antes de cargar; nunca se carga fila por paciente.

## Flujo semanal

1. `/oraculo-sincronizar` en Claude Code → escribe `datos/lote.json` → `npm run validar-lote`.
2. `.env`: `ORACULO_FUENTE=archivo`.
3. `npm run dev` (o `npm start` tras `npm run build`) → panel con datos reales.
4. `/oraculo-semana` → `reportes/<semana>.md`.
5. Registrar decisiones ejecutadas en `datos/experimentos.json`.

## Cuando se conecte en vivo — lo que NO cambia

`lib/adapters/types.ts` no se modifica para acomodar la fuente: se mapea la fuente al contrato.
Ningún componente de `app/` ni `components/` cambia. Ese fue el punto de todo el diseño.
