# Conectar TikTok — pauta (API, solo lectura) y orgánico (exportación de TikTok Studio)

## A. Pauta de TikTok Ads (automática, solo lectura)

TikTok exige una app de desarrollador aprobada para leer los informes. Se hace una vez; el token no
caduca mientras no se revoque. Nada en Oráculo escribe en TikTok: solo `report/…/get`,
`campaign/get`, `adgroup/get`, `ad/get`.

1. Con la cuenta que administra el **TikTok Business Center** de la clínica, entra a
   https://business-api.tiktok.com/portal → «Become a developer» → crear app («Oráculo»), tipo
   *Ads Management*, alcance mínimo: **Ads Management → Reporting (lectura)**, **Campaign / Ad group /
   Ad (lectura)**. Redirect URL: cualquiera (p. ej. `https://localhost/`). TikTok revisa la app
   (1–3 semanas habitualmente).
2. Aprobada la app: en la app → «Authorized» → autorizar el anunciante de la clínica. TikTok abre
   la URL de redirección con `auth_code=…`. Con ese código se pide el token una vez:
   ```
   curl -X POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/ \
     -H "Content-Type: application/json" \
     -d '{"app_id":"<APP_ID>","secret":"<SECRET>","auth_code":"<AUTH_CODE>"}'
   ```
   La respuesta trae `access_token` y `advertiser_ids`.
3. En `.env` (PC o VPS):
   ```
   TIKTOK_ACCESS_TOKEN=<access_token>
   TIKTOK_ADVERTISER_ID=<advertiser_id>
   ```
4. `npm run tiktok:sincronizar -- --dias 90` la primera vez; después el reloj diario lo hace solo.
   Escribe `datos/tiktok.json`; el panel lo muestra como la cuenta **«TikTok · <id>»** en el
   selector de cuenta (mismas pantallas que Meta: campañas, creativos, rendimiento…).

Lo que se trae por día y por campaña / conjunto / anuncio: gasto, impresiones, alcance, frecuencia,
clics, conversiones, reproducciones (2 s, 6 s, 25/50/75/100 %), me gusta, comentarios, compartidos,
visitas al perfil, seguidores; y el texto, botón y destino de cada anuncio. Los desgloses por edad,
género, hora y ciudad de TikTok no se traen todavía (Audiencias los avisa como «—» para TikTok).

## B. TikTok orgánico (manual: exportación de TikTok Studio)

TikTok **no entrega a terceros** las métricas orgánicas por API. Lo honesto es la exportación:

1. En https://www.tiktok.com/tiktokstudio → Analíticas.
   - **Contenido** → «Descargar datos» (CSV con cada video: vistas, me gusta, comentarios,
     compartidos, tiempo promedio de visualización, alcance si lo da).
   - **Resumen** → «Descargar datos» (CSV por día: vistas, visitas al perfil, me gusta, comentarios,
     compartidos, seguidores y seguidores netos).
2. Importar (sirven los encabezados en inglés o en español):
   ```
   npm run organico:importar-tiktok -- descargas/contenido.csv descargas/resumen.csv --usuario vivante
   ```
   Se mete en `datos/organico.json` como red «TikTok»; la pestaña **Orgánico** lo muestra junto a
   Instagram y Facebook (mejores videos, formato, franja, seguidores). Repetir cada semana o mes.

Si el archivo no se reconoce, el comando imprime las columnas que encontró: mándalas y se agrega el
nombre nuevo a la lista (TikTok cambia los encabezados de vez en cuando).
