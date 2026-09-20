/**
 * `datos/kommo.json` (lo escribe `npm run kommo:sincronizar`) y su fusión con el lote: los registros
 * de embudo de Kommo (pacientes: lead → cita → asistió → venta) entran al `embudo` del lote junto a
 * los que la clínica anote a mano. Sin archivo → el lote sigue igual.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { RegistroEmbudoSchema, type LoteDatos } from "@/lib/adapters/types";
import { validarSinPII } from "@/lib/privacy";
import type { LoteKommo } from "./kommo";

export const RUTA_KOMMO = process.env.ORACULO_RUTA_KOMMO ? resolve(process.env.ORACULO_RUTA_KOMMO) : resolve(process.cwd(), "datos", "kommo.json");

export const LoteKommoSchema = z.object({
  etapas: z.array(z.object({ id: z.number(), nombre: z.string(), pipelineId: z.number(), tipo: z.enum(["normal", "ganado", "perdido"]), orden: z.number() })),
  embudo: z.array(RegistroEmbudoSchema),
  meta: z.object({ capturadoEn: z.string(), desde: z.string(), hasta: z.string(), origen: z.literal("kommo"), leads: z.number(), avisos: z.array(z.string()) }),
});

export function parsearKommo(contenido: string): LoteKommo {
  const crudo: unknown = JSON.parse(contenido);
  validarSinPII(crudo);
  return LoteKommoSchema.parse(crudo) as LoteKommo;
}

export function cargarKommo(ruta: string = RUTA_KOMMO): LoteKommo | null {
  if (!existsSync(ruta)) return null;
  try {
    return parsearKommo(readFileSync(ruta, "utf8"));
  } catch (e) {
    console.warn(`[oráculo] datos/kommo.json no se pudo leer: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Mete el embudo de Kommo al lote (se suma al que haya anotado la clínica; los pasos de pauta no se tocan). */
export function fusionarKommoEnLote(lote: LoteDatos, kommo: LoteKommo | null): LoteDatos {
  if (!kommo || !kommo.embudo.length) return lote;
  return { ...lote, embudo: [...lote.embudo, ...kommo.embudo], meta: { ...lote.meta, advertencias: [...lote.meta.advertencias, ...kommo.meta.avisos] } };
}
