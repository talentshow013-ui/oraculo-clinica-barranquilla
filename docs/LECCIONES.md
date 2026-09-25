# Lecciones de Oráculo (memoria viva)

El agente lee esto al empezar cada chat y lo escribe cuando le dicen «automejórate», «aprende de
tus errores» o «guarda en memoria». Una línea por lección: fecha · qué pasó · regla.

- 2026-09-21 · Reporté 7, 93 y 45 leads en el mismo día sumando a mano desde el conector con campos distintos (`onsite_conversion_lead_grouped` solo cuenta formularios) · Leads = columna Resultados por campaña vía motor (`/oraculo-sincronizar` + `npm run notificar -- --alertas`); nunca sumar a mano.
- 2026-09-21 · Expliqué reglas y privacidad que nadie preguntó y pregunté «¿prefieres que sincronice?» · Corto, decisión primero, hago lo que toca sin anunciarlo.
- 2026-09-21 · Dije «no entiendo qué quieres que mejore» cuando me pidieron automejorar · Siempre hay algo: repasar la conversación, escribir la lección aquí, confirmar en 2 líneas.
- 2026-09-25 · Respondí con `verificar` y salían datos de demostración (hoy 12-sep) porque ese comando no cargaba el `.env`; además inventé `npm run oraculo:sincronizar` · Para «¿cuánto llevamos hoy?» uso `npm run hoy`. Si una salida dice «demostración» o trae una fecha vieja, no la uso para responder. Solo corro comandos que existen en `package.json`.
