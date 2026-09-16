# Conectar el orgánico (Instagram y Facebook sin pauta) — una sola vez

El conector de anuncios de Meta no entrega métricas orgánicas. Para eso Oráculo va directo a la
Graph API de Meta con un **token de página** (no caduca) que vive solo en el `.env` de la máquina
(PC o VPS). Se hace una vez; después `npm run organico:sincronizar` corre solo cada mañana.

## Lo que ya existe
- App de Meta **VIVANTE CLAUDE** (id `1874860969848011`) en developers.facebook.com, modo
  desarrollo. En ese modo sirve para las páginas propias sin revisión de app: solo hay que tener
  rol en la app (admin/desarrollador/probador) y ser administrador de la página de la clínica.
- El Instagram de la clínica debe ser profesional y estar vinculado a la página de Facebook
  (Meta Business Suite → Configuración → Cuentas → Instagram). Si no, solo se trae Facebook.

## Pasos (10 minutos, con el Facebook que administra la página de la clínica)

1. Abre https://developers.facebook.com/tools/explorer y elige la app **VIVANTE CLAUDE**.
2. En «Permisos» agrega: `pages_show_list`, `pages_read_engagement`, `read_insights`,
   `instagram_basic`, `instagram_manage_insights`, `business_management`.
3. Pulsa **Generar token de acceso** e inicia sesión con el Facebook que administra la página.
   Acepta la página de la clínica y su Instagram cuando lo pregunte.
4. (Recomendado) Abre https://developers.facebook.com/tools/debug/accesstoken, pega el token y pulsa
   **Extender token de acceso**. Copia el token extendido. Si en `.env` están `META_APP_ID` y
   `META_APP_SECRET` (Configuración → Básica de la app), este paso lo hace el comando solo.
5. En la carpeta del proyecto:
   ```bash
   npm run organico:conectar -- <token>
   # si administra varias páginas, repite con --pagina <id> (el comando las lista)
   npm run organico:sincronizar -- --dias 90     # primera vez: 90 días hacia atrás
   ```
   Eso deja en `.env`: `META_ORGANICO_TOKEN` (token de página, no caduca), `META_PAGINA_ID`,
   `META_INSTAGRAM_ID`; y escribe `datos/organico.json`. Ni el token ni el archivo van al repositorio.
6. Abre el panel → desplegable **Pauta / Orgánico** (bajo ORÁCULO) → **Orgánico**.

## Qué se trae (Graph API v25, 2026)
| Red | Por publicación | Por día |
|---|---|---|
| Instagram | alcance, vistas, me gusta, comentarios, guardados, compartidos, interacciones, visitas al perfil, seguidores ganados; reels: segundos promedio; historias: respuestas | alcance, seguidores nuevos (Meta solo da 30 días) |
| Facebook | alcance (`post_total_media_view_unique`), vistas (`post_media_view`), reacciones, comentarios, compartidos, clics | seguidores, interacciones, vistas |

Las «impresiones» de Facebook e Instagram están retiradas por Meta (junio 2026): no se piden.
Si Meta retira otra métrica, la sincronización la descarta con aviso (aparece arriba de la pantalla
Orgánico como «Meta no entregó …») y el resto sigue.

## En la VPS
`deploy/oraculo-diario.sh` corre `npm run organico:sincronizar` cada mañana si el `.env` tiene
`META_ORGANICO_TOKEN`. Para conectar allá: `ssh` como `oraculo`, `cd ~/oraculo` y los pasos 5–6
(el token se genera en cualquier navegador; solo se pega en la VPS).

## Si algo falla
- «Ese Facebook no administra ninguna página»: el token se generó con un Facebook sin rol en la página.
- «(#10) … permission»: falta un permiso del paso 2; vuelve a generar el token con todos.
- «(#190) … expired»: el token no era de página (no se corrió `organico:conectar`) o se revocó al
  cambiar la contraseña de Facebook; repite los pasos 3–5.
- Sin Instagram en el resultado: la página no tiene Instagram profesional vinculado.
