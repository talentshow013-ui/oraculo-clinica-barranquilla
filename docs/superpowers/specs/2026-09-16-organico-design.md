# Orgánico — Instagram y Facebook sin pauta (diseño, 2026-09-16)

## Qué pide el cliente
Un desplegable arriba, donde dice ORÁCULO, con dos modos: **Pauta** (todo lo que existe hoy) y
**Orgánico**. En Orgánico: todas las métricas de lo que la clínica publica sin pagar en Instagram y
Facebook (reels, imágenes, carruseles, historias): alcance, vistas, me gusta, comentarios,
guardados, compartidos, seguidores, y qué aprender de eso. Conectado directo a la API de Meta, para
que en la VPS se traiga solo cada día.

## Decisiones
- **Fuente: Graph API de Meta directamente** (no el conector MCP, que es solo de anuncios y no expone
  métricas orgánicas — verificado 2026-09-16: `ads_get_ig_accounts` devuelve vacío y `ads_get_ig_media`
  solo lista publicaciones impulsables). App de Meta ya existente: `VIVANTE CLAUDE` (1874860969848011,
  modo desarrollo; sirve para páginas propias sin revisión de app).
- **Token**: token de página (derivado de un token largo de usuario; no caduca). Vive SOLO en `.env`
  (`META_ORGANICO_TOKEN`), nunca en el repositorio. La constitución se enmienda: «sin tokens en
  archivos» pasa a «sin tokens en el repositorio; los del `.env` de la VPS son los únicos».
- **Métricas (Graph API v25)**. Instagram por publicación: `reach, views, total_interactions, saved,
  shares, profile_visits, follows` (feed); `reach, views, total_interactions, saved, shares,
  ig_reels_avg_watch_time` (reels); `reach, views, replies, shares, total_interactions` (historias).
  Más `like_count, comments_count` del propio objeto. Facebook por publicación: `post_media_view,
  post_total_media_view_unique, post_clicks` + `likes/comments/shares/reactions` del objeto (las
  métricas `post_impressions*` están retiradas desde junio 2026). Cuenta: seguidores hoy y serie
  diaria (`follower_count`, `reach` en Instagram; `page_follows`, `page_post_engagements`,
  `page_media_view` en Facebook).
- **Resiliencia**: si Meta retira una métrica, la sincronización la descarta con aviso (pide todas,
  y al fallar pide una por una); nunca tumba el lote.
- **Archivo aparte**: `datos/organico.json` (gitignored), no dentro de `lote.json`: la pauta no se
  toca. Contrato Zod nuevo (`LoteOrganicoSchema`) y guardián PII igual que el resto.
- **Motor** (`lib/organico/`): resumen por red; mejores publicaciones (por alcance y por tasa de
  interacción = interacciones / alcance); qué formato rinde; mejor día y hora; qué publicación merece
  pauta (últimos 30 días, tasa ≥ 1,5× la mediana y alcance ≥ mediana); seguidores ganados en el
  periodo. Todo con `fuente` (origen, periodo, registros, método, enlace) como los hallazgos.
- **Pantalla** `/organico` (funcional; lo visual va en `docs/PROMPT-FRONTEND-ORGANICO.md`), con
  anclas: `#resumen #mejores #formatos #horario #para-pauta #seguidores #fuente`. Cada publicación es
  un enlace a Instagram/Facebook. Desplegable en el riel: ORÁCULO ▾ → Pauta / Orgánico.
- **Comandos**: `npm run organico:conectar -- <token>` (una vez: canjea el token, encuentra la
  página y el Instagram, escribe el `.env`); `npm run organico:sincronizar` (diario; incremental:
  vuelve a pedir los últimos 30 días y conserva lo anterior). El reloj diario lo corre.

## Fuera de alcance (por ahora)
- Cruce «ya impulsada» entre publicaciones orgánicas y anuncios (el contrato de creativos no
  guarda el id de la publicación). Se agrega cuando se pida.
- Historias de Facebook, comentarios con texto (solo conteos: privacidad).
