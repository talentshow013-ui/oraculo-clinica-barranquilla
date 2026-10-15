# Webhook de Kommo — de qué anuncio vino cada conversación y cuánto tardó la asesora

Kommo avisa a una dirección nuestra cada vez que entra o sale un mensaje de WhatsApp. La API normal
de Kommo no entrega el texto de los mensajes; el webhook sí, pero solo de lo que pasa **desde que se
activa** (el historial anterior no llega por esta vía).

## Qué hace y qué NO hace (Ley 1581 de 2012: son datos de salud)
Diseño «leer y olvidar» (`lib/adapters/kommo.conversaciones.ts`):
- El texto del mensaje se lee **en memoria** para dos cosas: de qué anuncio viene (compara con el
  mensaje predeterminado y los emojis de cada anuncio, `datos/mensajes.json`) y la hora. Después se descarta.
- **Se guarda** (`datos/conversaciones.json`, modo 600, fuera de git): una huella irreversible de la
  conversación (HMAC, no el id de Kommo), el día, el anuncio/campaña, los segundos hasta la primera
  respuesta de una persona y el id de la asesora.
- **Nunca se guarda ni se imprime**: texto, nombres, teléfonos, el id de Kommo de la conversación, ni
  el contenido del aviso. El archivo pasa por `validarSinPII`. Se borra lo de más de 90 días.
- `datos/kommo-webhook-forma.json` guarda solo los **nombres** de los campos del aviso (para verificar
  el formato real sin guardar contenido).

## Piezas
- Dirección: `https://oraculo.vivantemedicinaestetica.com/api/kommo/webhook/<KOMMO_WEBHOOK_SECRETO>`
  (`app/api/kommo/webhook/[secreto]/route.ts`). No lleva usuario y clave del panel (Kommo no puede
  ponerlos): la protege el secreto de la dirección. Sin `KOMMO_WEBHOOK_SECRETO` responde 404.
- Un aviso de otra cuenta de Kommo (otro subdominio) se ignora.
- Kommo exige respuesta 2xx en menos de 2 s; si falla reintenta (5 min, 15 min, 15 min, 1 h). Si manda
  más de 100 respuestas inválidas en 2 horas, Kommo desactiva el webhook.
- El bot de Kommo escribe como usuario 0: no cuenta como respuesta de una asesora.
- Prueba sin guardar nada: cabecera `x-oraculo-prueba: 1` → responde qué entendió (dirección, anuncio).
- Consulta: `npm run conversaciones` (7 días) · `-- --hoy` · `-- --dias 30`.

## Estado: ACTIVO desde el 2026-10-15 (webhook id 47515720 en Kommo)
Lo activó el equipo de ITERIA por API con la orden expresa del responsable del proyecto. Eventos:
`add_message` (mensaje entrante), `add_outgoing_message` (mensaje saliente de una persona o bot) y
`update_talk` (la conversación se cerró o se reabrió).

## Activarlo de nuevo (por si hay que repetirlo)
1. En la VPS: `sudo -u oraculo bash /home/oraculo/oraculo/deploy/webhook-kommo.sh` y
   `systemctl restart oraculo-panel`. Deja la dirección completa en `entregables/webhook-kommo.txt`.
2. En Kommo, por API: `POST /api/v4/webhooks` con `{"destination": "<la dirección>", "settings": ["add_message", "add_outgoing_message", "update_talk"]}`
   (con una dirección que ya existe, actualiza sus eventos). O a mano: Ajustes → Integraciones → **Web hooks**.
   Sin el evento saliente se sabe de qué anuncio vino cada conversación, pero no cuánto tardó la asesora.
3. Con la primera conversación: `npm run conversaciones -- --hoy` y revisar `datos/kommo-webhook-forma.json`
   (debe listar campos como `message[add][0][text]`).

## El texto de las conversaciones (desde el 15-oct-2026, autorizado por el responsable del proyecto)
Para poder decir «revisa las conversaciones de ayer» o «las que vienen de este anuncio», el texto se
guarda (`lib/adapters/chats.ts`), solo si hay `CHATS_LLAVE` en la configuración de la VPS:
- `datos/chats/AAAA-MM-DD.chat`, una línea cifrada (AES-256-GCM) por mensaje, archivos modo 600, fuera de git.
- Antes de guardar se quitan teléfonos, correos y números de documento (`[número]`, `[correo]`). Los
  precios y horas se quedan. Lo que la persona escriba de sí misma (su nombre, su caso) sí queda en el
  texto: por eso solo vive cifrado en la VPS y se borra a los 30 días.
- No se guarda el nombre ni el teléfono del contacto ni el id de Kommo: la conversación va por su huella.
- Leer: `npm run chats -- --ayer` (filtros `--anuncio`, `--asesora`, `--resultado`, `--sin-respuesta`). En
  otro equipo pide el texto a la VPS (`GET /api/chats`, detrás del usuario y clave del panel).
- Apagar: quitar `CHATS_LLAVE` y reiniciar `oraculo-panel` (deja de guardar); borrar `datos/chats/`.
  Si la llave se pierde, lo guardado no se puede leer.

## Qué se hace con eso (desde el 15-oct-2026)
- **Cruce con el embudo** (`npm run conversaciones:cruzar`, cada hora en `oraculo-vivo`): lee los leads de Kommo
  tocados desde la primera conversación, los convierte en huella y guarda solo los que coinciden con una
  conversación, con su etapa (lead / cita / asistió / venta / perdido) en `datos/conversaciones-embudo.json`.
  Guarda también los nombres de las asesoras (personal de la clínica, no pacientes).
- **Panel** → Pacientes → «WhatsApp por anuncio»: conversaciones, citas, asistieron, ventas, gasto y costo por
  conversación, cita y venta de cada anuncio; primera respuesta por asesora. Sigue el calendario. El gasto se
  cuenta solo desde el primer día con conversaciones.
- **Telegram**: bloque de WhatsApp en el resumen de 6, 12 y 18; y `notificar --sin-respuesta` (cada 10 min en
  `oraculo-vivo`, APAGADO salvo `WHATSAPP_AVISO_SIN_RESPUESTA=1`): un mensaje agrupado cuando hay conversaciones con más de 1 h sin respuesta de una persona,
  empezadas entre 7 a. m. y 7 p. m., no cerradas en Kommo y de menos de 12 h. Como mucho uno por hora; de 9 p. m.
  a 6 a. m. calla. Las conversaciones que la asesora cierra en Kommo (evento `update_talk`) no se avisan.
- **Otros equipos** (PC de la clínica, Mac): `npm run conversaciones` pide el resumen a la VPS
  (`GET /api/conversaciones`, detrás del usuario y clave del panel: `VPS_PANEL_USUARIO` / `VPS_PANEL_CLAVE`).

## Apagarlo
Kommo → Web hooks → borrar la dirección, o `DELETE /api/v4/webhooks` con `{"destination": "<la dirección>"}` (o quitar `KOMMO_WEBHOOK_SECRETO` de `.env` y reiniciar el panel:
la dirección pasa a responder 404). `datos/conversaciones.json` se puede borrar sin consecuencias.

## Límites que conviene saber
- Solo cuenta desde la activación. No hay conversaciones anteriores.
- Una conversación cuenta como «nueva» la primera vez que se ve su `talk_id`; un paciente que vuelve
  cuando Kommo abre una conversación nueva cuenta otra vez.
- Si la persona cambia el mensaje predeterminado o el anuncio es de los «hechos desde una publicación»
  (sin mensaje propio), queda «sin identificar». Dos campañas con el mismo mensaje quedan «ambiguo»:
  por eso conviene un mensaje distinto (con su emoji) por anuncio.
- Los tiempos de respuesta incluyen noches y fines de semana.
