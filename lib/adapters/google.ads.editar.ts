/**
 * Google Ads · EDITAR (presupuesto diario, pausar, activar). El permiso OAuth `adwords` ya lo permite.
 * Lo usa `npm run google`: siempre valida primero con Google (validateOnly) y solo aplica con
 * `--confirmar`, después del «sí» de una persona (regla 1 de CLAUDE.md).
 */
import { normalizarMensaje } from "./meta.mensajes";
import { VERSION_GOOGLE_ADS } from "./google.ads";

export interface CampanaGoogle {
  id: string;
  nombre: string;
  /** ENABLED, PAUSED */
  estado: string;
  presupuestoRecurso: string;
  /** En pesos. */
  presupuestoDiario: number;
  /** Presupuesto compartido con otras campañas: cambiarlo las afecta a todas. */
  compartido: boolean;
}

export const GAQL_CAMPANAS = "SELECT campaign.id, campaign.name, campaign.status, campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.explicitly_shared FROM campaign WHERE campaign.status != 'REMOVED'";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapearCampanas(filas: any[]): CampanaGoogle[] {
  return filas.map((f) => ({
    id: String(f.campaign.id),
    nombre: String(f.campaign.name),
    estado: String(f.campaign.status),
    presupuestoRecurso: String(f.campaignBudget?.resourceName ?? ""),
    presupuestoDiario: Math.round(Number(f.campaignBudget?.amountMicros ?? 0) / 1e6),
    compartido: !!f.campaignBudget?.explicitlyShared,
  }));
}

/** Por id exacto o por parte del nombre. Si hay varias o ninguna, error con las opciones: nunca se adivina. */
export function resolverCampana(campanas: ReadonlyArray<CampanaGoogle>, texto: string): CampanaGoogle {
  const porId = campanas.find((c) => c.id === texto.trim());
  if (porId) return porId;
  const q = normalizarMensaje(texto);
  const hay = campanas.filter((c) => normalizarMensaje(c.nombre.replace(/_/g, " ")).includes(q));
  if (hay.length === 1) return hay[0]!;
  if (!hay.length) throw new Error(`No hay ninguna campaña de Google que diga «${texto}». Usa: npm run google -- campanas`);
  throw new Error(`Hay varias campañas que dicen «${texto}»: ${hay.map((c) => `${c.nombre} (${c.id})`).join(" · ")}. Usa el id.`);
}

export function aMicros(pesos: number): string {
  if (!Number.isFinite(pesos) || pesos <= 0) throw new Error("El presupuesto diario debe ser un número mayor que 0 (en pesos).");
  return String(Math.round(pesos) * 1_000_000);
}

export function cuerpoPresupuesto(c: CampanaGoogle, pesosDiarios: number, soloValidar: boolean) {
  return { validateOnly: soloValidar, operations: [{ update: { resourceName: c.presupuestoRecurso, amountMicros: aMicros(pesosDiarios) }, updateMask: "amount_micros" }] };
}

export function cuerpoEstado(customerId: string, c: CampanaGoogle, estado: "ENABLED" | "PAUSED", soloValidar: boolean) {
  return { validateOnly: soloValidar, operations: [{ update: { resourceName: `customers/${customerId}/campaigns/${c.id}`, status: estado }, updateMask: "status" }] };
}

/** POST a un `…:mutate` de Google Ads. Devuelve el error de Google tal cual si lo rechaza. */
export async function mutarGoogle(cab: Record<string, string>, customerId: string, ruta: "campaignBudgets:mutate" | "campaigns:mutate", cuerpo: unknown, fetchFn: typeof fetch = fetch): Promise<void> {
  const r = await fetchFn(`https://googleads.googleapis.com/${VERSION_GOOGLE_ADS}/customers/${customerId}/${ruta}`, { method: "POST", headers: cab, body: JSON.stringify(cuerpo) });
  if (r.ok) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = (await r.json().catch(() => ({}))) as any;
  const e = j?.error;
  throw new Error(`Google Ads rechazó el cambio (${e?.status ?? r.status}): ${e?.details?.[0]?.errors?.map((x: { message?: string }) => x.message).join(" · ") || e?.message || r.statusText}`);
}
