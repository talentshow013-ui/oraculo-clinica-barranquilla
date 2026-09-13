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
claude mcp add --transport http --client-id <META_APP_ID> meta-ads https://mcp.facebook.com/ads
```

  El `META_APP_ID` es el de la app de la agencia en developers.facebook.com (no requiere revisión
  para uso propio). Al primer uso, Claude Code abre el navegador para autorizar con la cuenta que
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

### Mapeo al contrato (resumen)

`spend→gasto`, `impressions→impresiones`, `reach→alcance`, `frequency→frecuencia`,
`clicks→clics`, `inline_link_clicks→clicsEnlace`, `unique_clicks→clicsUnicos`,
`post_engagement→interacciones`, `post_reactions→reacciones`, `comment→comentarios`,
`post→compartidos`, `post_save→guardados`, `landing_page_view→vistasLandingPage`,
`video_play→reproducciones`, `video_3_sec_watched→reproducciones3s`,
`video_thruplay_watched→reproduccionesThru`, `video_p25/50/75/95/100_watched→p25…p100`,
`video_play_time→tiempoReproduccionTotal`, `messaging_conversation_started_7d→conversacionesIniciadas`,
`messaging_conversation_replied_7d→conversacionesRespondidas`, `results→resultados`,
`result_type→tipoResultado`, `action_values→valorConversion`, `attribution_setting→ventanaAtribucion`.
**Lo que no venga es `null`.** `nombre` es el nombre de la entidad.

## TikTok — MCP oficial (opcional)

- TikTok for Business MCP Server (~400 herramientas). Docs: business-api.tiktok.com → TikTok Ads MCP Server v1.3.
- **Usar el modo de carga progresiva**, nunca el que expone el catálogo completo: quema contexto sin
  aportar; el panel solo necesita reporting.
- Mapeo: gancho a 2 s (`reproducciones2s`) y 6 s (`reproducciones6s`); el motor cae a ellos cuando
  no hay 3 s / ThruPlay. `fuente: "tiktok"`.

## Radar — Apify MCP (verificado 2026-09-13)

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
