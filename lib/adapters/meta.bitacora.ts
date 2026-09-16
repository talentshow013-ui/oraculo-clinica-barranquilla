/**
 * Bitácora de cambios de la cuenta (`ads_account_get_activity_logs`): quién prendió, apagó o
 * creó qué, y cuándo. Es la misma historia que muestra el administrador de anuncios de Meta;
 * aquí se guarda para poder responder «¿qué pasó la semana que cayeron las conversaciones?».
 * Solo aparecen personas con acceso a la cuenta publicitaria (operadores), nunca pacientes.
 */
import type { AccionCambio, CambioCuenta, ObjetoCambio } from "@/lib/adapters/types";

interface EventoCrudo {
  event_type?: unknown;
  actor_id?: unknown;
  actor_name?: unknown;
  object_id?: unknown;
  object_name?: unknown;
  datetime?: unknown;
  extra_data?: unknown;
}

/** «25/8/2026 a las 9:47 a. m.» → fecha ISO y hora de 24 h. Null si no se entiende. */
export function parsearFechaMeta(texto: string): { fecha: string; hora: string } | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+a\s+las?\s+(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i.exec(texto.replace(/ /g, " ").trim());
  if (!m) return null;
  let h = Number(m[4]);
  const pm = m[6]!.toLowerCase() === "p";
  if (pm && h < 12) h += 12;
  if (!pm && h === 12) h = 0;
  return { fecha: `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`, hora: `${String(h).padStart(2, "0")}:${m[5]}` };
}

function objetoDe(tipoEvento: string): ObjetoCambio {
  const t = tipoEvento.toLowerCase();
  if (/campaña|campana/.test(t)) return "campana";
  if (/conjunto/.test(t)) return "conjunto";
  if (/anuncio/.test(t)) return "anuncio";
  if (/persona|cuenta/.test(t)) return "cuenta";
  return "otro";
}

const APAGADO = /^(inactiv|pausad|paused|archiv)/i;
const PRENDIDO = /^(activ|active)/i;

function accionDe(tipoEvento: string, de: string | null, a: string | null): AccionCambio {
  const t = tipoEvento.toLowerCase();
  if (/persona agregada/.test(t)) return "persona_agregada";
  if (/persona eliminada/.test(t)) return "persona_eliminada";
  if (/revisi/.test(t) || /revisi|pendiente|aprobad/i.test(`${de ?? ""} ${a ?? ""}`)) return "revision";
  if (a && APAGADO.test(a)) return "apagar";
  if (a && PRENDIDO.test(a)) return "prender";
  return "otro";
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" ? String(v) : null;
}

/** Lee el archivo crudo ({ventanas:[{eventos:[...]}]} o {result:"[...]"}) o un arreglo de eventos. */
export function parsearBitacoraMeta(contenido: string, cuentaId: string): CambioCuenta[] {
  const crudo: unknown = JSON.parse(contenido);
  const eventos: EventoCrudo[] = [];
  const meter = (x: unknown) => {
    if (Array.isArray(x)) eventos.push(...(x as EventoCrudo[]));
    else if (typeof x === "string") meter(JSON.parse(x));
  };
  if (Array.isArray(crudo)) meter(crudo);
  else if (crudo && typeof crudo === "object") {
    const o = crudo as { result?: unknown; ventanas?: Array<{ eventos?: unknown }> };
    if (o.result !== undefined) meter(o.result);
    for (const v of o.ventanas ?? []) meter(v.eventos);
  }
  const vistos = new Set<string>();
  const salida: CambioCuenta[] = [];
  for (const e of eventos) {
    const tipo = texto(e.event_type) ?? "";
    const cuando = parsearFechaMeta(texto(e.datetime) ?? "");
    if (!cuando) continue;
    let extra: Record<string, unknown> = {};
    try {
      extra = typeof e.extra_data === "string" ? (JSON.parse(e.extra_data) as Record<string, unknown>) : {};
    } catch {
      extra = {};
    }
    const de = texto(extra.old_value);
    const a = texto(extra.new_value);
    const objetoId = texto(e.object_id) ?? "";
    const clave = `${cuando.fecha}|${cuando.hora}|${texto(e.actor_id) ?? ""}|${objetoId}|${tipo}|${de ?? ""}|${a ?? ""}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    salida.push({
      fuente: "meta",
      cuentaId,
      fecha: cuando.fecha,
      hora: cuando.hora,
      actor: texto(e.actor_name) ?? "desconocido",
      tipo,
      objetoTipo: objetoDe(tipo),
      objetoId,
      objetoNombre: texto(e.object_name) ?? "",
      campanaId: texto(extra.campaign_id),
      accion: accionDe(tipo, de, a),
      de,
      a,
    });
  }
  return salida.sort((x, y) => `${x.fecha} ${x.hora}`.localeCompare(`${y.fecha} ${y.hora}`));
}
