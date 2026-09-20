# Conectar Kommo (CRM) — el embudo de pacientes, una sola vez, solo lectura

Kommo es donde caen los leads de WhatsApp de la clínica. Oráculo lo lee para cerrar el círculo
pauta → conversación → **cita → asistencia → venta**, que hoy la clínica tendría que anotar a mano.
Nunca guarda personas: solo conteos por día, fuente, campaña y paso, con `nRegistros` para el
k-anonimato del panel. Nada se escribe en Kommo.

## Conectar (ya hecho el 2026-09-20)
1. Kommo → Ajustes → **Integraciones → Crear integración**: nombre «Oráculo», URL de redirección
   `https://www.esteticavivante.com/oraculo`, permisos de lectura.
2. Pestaña **Claves y alcances** → **Token de larga duración** → copiar.
3. En `.env`:
   ```
   KOMMO_SUBDOMINIO=vivante
   KOMMO_TOKEN=<token de larga duración>
   ```
4. `npm run kommo:sincronizar -- --dias 90`. Después lo corre el reloj diario.

## Cómo se leen las etapas
Cada pipeline de Kommo tiene etapas (statuses). Se mapean a pasos del embudo por nombre:
- «Leads Entrantes», «Seguimiento», «Contestado»… → **lead**
- «AGENDADO», «Agendó cita», «¡AGENDADO!» → **cita agendada**
- «MIS PACIENTES», «PACIENTES», «VIVANTE», «Asistió…» → **cita asistida**
- «Leads ganados» (tipo ganado) → **venta** (con el precio del lead, si lo llenan)
- «Leads perdidos» → no cuenta (pero sí contó como lead al entrar)

Un lead en «MIS PACIENTES» cuenta también como lead y como cita. Si una etapa con nombre raro debe
contar distinto, se dice en `config/kommo.json` (gitignored):
```json
{ "etapas": { "83004844": "cita_agendada" }, "fuentes": { "23038261": "meta", "17736671": "organico" } }
```

## La fuente del lead (Meta / orgánico / directo)
Los anuncios de WhatsApp de Meta **no rellenan los utm** en Kommo, así que hoy todos los leads
llegan como «desconocido». Kommo sí guarda el **canal de entrada** (`source_id`: cada línea de
WhatsApp, Instagram, sitio web). Para atribuir: en Kommo → Ajustes → Fuentes, mirar qué es cada
canal, y anotarlo en `config/kommo.json` → `fuentes` (source_id → `meta` | `organico` | `directo`
| `referido` | `tiktok`). Los ids que aparecen hoy: 23038261 (el más usado), 23034893, 23038143,
17736671, 23034531, 23034217, 17736599, 17737495, 17736679, 17737491.

## Qué falta que haga la clínica en Kommo para que el dato valga más
- Poner **precio** al lead cuando se cierra la venta (hoy vienen en $ 0).
- Nombrar los canales (Fuentes) para separar pauta de orgánico.
