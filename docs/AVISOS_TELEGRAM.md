# Avisos por Telegram (resumen cada mañana, informe los lunes)

El reloj diario de la VPS manda al chat de la clínica un mensaje con: estado de la sincronización,
pauta de los últimos 14 días por cuenta (inversión, conversaciones y variación, costo por
conversación), plata en riesgo, los 3 hallazgos que más pesan, orgánico (si está conectado) y el
enlace al panel. Los lunes, además, el informe semanal. Todo sale del motor: cifras reales.

## Configurar (5 minutos, una vez)
1. En Telegram, abre **@BotFather** → `/newbot` → nombre (p. ej. «Oráculo Vivante») → usuario que
   termine en `bot`. Te da un **token**.
2. Abre el bot que acabas de crear y pulsa **Iniciar** (o agrégalo a un grupo de la clínica y escribe
   cualquier cosa ahí).
3. En la carpeta del proyecto (PC o VPS):
   ```bash
   # pon TELEGRAM_BOT_TOKEN=<token> en .env, luego:
   npm run notificar -- --chats        # muestra el chat: copia el TELEGRAM_CHAT_ID al .env
   npm run notificar -- --prueba       # debe llegar «Oráculo conectado»
   npm run notificar                   # el resumen de hoy, como lo verá la clínica
   ```
4. Para mandarlo a **varias personas** (sin grupo): cada una abre el bot y pulsa Iniciar; `--chats` muestra
   los ids y se ponen separados por coma: `TELEGRAM_CHAT_ID=111111,222222`.
5. Opcional: `ORACULO_URL_PANEL=https://…` en `.env` para que el mensaje traiga el enlace al panel.

En la VPS, `deploy/oraculo-diario.sh` lo manda solo cada mañana a las 6:30 si las dos claves están
en el `.env`. Nada de esto va al repositorio.

## Alertas de la clínica: 6 a. m., 12 m. y 6 p. m.
Tres veces al día (`deploy/oraculo-alertas.sh`, cron) trae Meta y Google en vivo y manda, por cuenta:
1. **Alertas** (umbrales de la clínica, `lib/notificaciones/alertas.ts → UMBRALES_CLINICA`):
   costo por lead por encima de $4.000 (3 días); anuncio rechazado; CTR por debajo de 1,30 % en un
   conjunto (con al menos 1.000 impresiones); anuncio de bajo rendimiento a 3 / 7 / 15 días
   (gancho < 20 %, retención < 20 %, o más de 2.000 impresiones sin un lead).
2. **Al aire**: cada campaña activa con leads, gasto, costo por lead y CTR, y debajo cada anuncio
   activo con leads, costo, impresiones, CTR, gancho y retención; los prendidos en los últimos 3 días
   salen con 🆕 NUEVO.
A mano: `npm run notificar -- --alertas`. Para cambiar un umbral se edita `UMBRALES_CLINICA`.

## El bot también RESPONDE (texto, notas de voz y fotos)
Además de los avisos, Oráculo contesta lo que le escriban por Telegram las personas de
`TELEGRAM_CHAT_ID`: «¿cómo le fue ayer a la cuenta de Meta?», una nota de voz, o la foto de un
anuncio para que opine. Responde con los números del motor (nunca inventa) y no cambia nada en las
plataformas: eso se pide en el computador. Usa Gemini (`GEMINI_API_KEY` en `.env`).

- En la VPS corre como servicio: `systemctl enable --now oraculo-telegram` (ya lo deja el instalador);
  se reinicia solo. Ver qué pasa: `journalctl -u oraculo-telegram -f`.
- A mano, en cualquier PC: `npm run telegram:bot`.
- Solo contesta a los chats de la lista; a cualquier otro, silencio.

## Comandos
| Comando | Qué hace |
|---|---|
| `npm run notificar` | Resumen de la mañana (todas las cuentas) |
| `npm run notificar -- --prueba` | Mensaje de prueba |
| `npm run notificar -- --chats` | Descubre el id del chat |
| `npm run notificar -- --texto "…"` | Manda ese texto |
| `npm run notificar -- --archivo reportes/semana-2026-09-21.md` | Manda un informe |

## Si algo falla
- «chat not found»: el chat no ha escrito al bot (paso 2) o el id está mal.
- «bot was blocked by the user»: alguien bloqueó el bot; vuelve a abrirlo y pulsa Iniciar.
- Nada llega y el registro dice «telegram: sin configurar»: falta una de las dos claves en el `.env` de la VPS.
