/**
 * Trae de la API de Meta los anuncios de una lista de cuentas con su mensaje predeterminado de
 * WhatsApp. Lo usan `npm run mensajes` (búsqueda rápida: solo activos, segundos) y
 * `npm run mensajes:sincronizar` (todos los estados: miles, un par de minutos).
 */
import { mensajeDeCreativo, type AnuncioMensaje } from "./meta.mensajes";

export const ESTADOS_TODOS = ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "ARCHIVED", "DISAPPROVED", "WITH_ISSUES", "IN_PROCESS", "PENDING_REVIEW", "PREAPPROVED"];

interface AnuncioApi {
  id: string;
  name: string;
  effective_status: string;
  created_time?: string;
  campaign?: { name?: string };
  creative?: Parameters<typeof mensajeDeCreativo>[0] & { effective_object_story_id?: string };
}

export async function traerAnuncios(token: string, cuentas: ReadonlyArray<{ id: string; nombre: string }>, estados: ReadonlyArray<string>, avance?: (texto: string) => void): Promise<AnuncioMensaje[]> {
  const salida: AnuncioMensaje[] = [];
  for (const c of cuentas) {
    const p = new URLSearchParams({ fields: "name,effective_status,created_time,campaign{name},creative{object_story_id,effective_object_story_id,object_story_spec}", effective_status: JSON.stringify(estados), limit: "100", access_token: token });
    let url: string | undefined = `https://graph.facebook.com/v25.0/${c.id}/ads?${p}`;
    let n = 0;
    for (let i = 0; url && i < 200; i++) {
      let j: { data?: AnuncioApi[]; paging?: { next?: string }; error?: { message: string } } = {};
      for (let intento = 1; intento <= 3; intento++) {
        j = (await (await fetch(url)).json()) as typeof j;
        if (!j.error) break;
        await new Promise((r) => setTimeout(r, 3000 * intento));
      }
      if (j.error) throw new Error(`${c.nombre}: ${j.error.message}`);
      for (const a of j.data ?? []) {
        const m = mensajeDeCreativo(a.creative);
        salida.push({ id: a.id, cuenta: c.nombre, cuentaId: c.id, campana: a.campaign?.name ?? "", anuncio: a.name, estado: a.effective_status, creado: (a.created_time ?? "").slice(0, 10), predeterminado: m?.predeterminado ?? null, bienvenida: m?.bienvenida ?? null, desdePublicacion: !m && !!(a.creative?.object_story_id || a.creative?.effective_object_story_id), vistoPrimeraVez: "" });
        n++;
      }
      url = j.paging?.next;
    }
    avance?.(`  ${c.nombre}: ${n} anuncios`);
  }
  return salida;
}
