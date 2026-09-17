/**
 * `datos/tiktok.json` (lo escribe `npm run tiktok:sincronizar`) y su fusión con el lote de Meta:
 * las filas de TikTok entran como una cuenta más (`tt_<advertiser_id>`) para que todas las pantallas
 * las vean sin cambiar nada. Sin archivo → el lote sigue igual. `ORACULO_RUTA_TIKTOK` opcional.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { CreativoSchema, InsightRowSchema, type LoteDatos } from "@/lib/adapters/types";
import { validarSinPII } from "@/lib/privacy";
import { listarHuecos } from "@/lib/format/fechas";
import type { LoteTikTok } from "./tiktok.ads";

export const RUTA_TIKTOK = process.env.ORACULO_RUTA_TIKTOK ? resolve(process.env.ORACULO_RUTA_TIKTOK) : resolve(process.cwd(), "datos", "tiktok.json");

export const LoteTikTokSchema = z.object({
  insights: z.array(InsightRowSchema),
  creativos: z.array(CreativoSchema),
  meta: z.object({ cuentaId: z.string().min(1), capturadoEn: z.string(), desde: z.string(), hasta: z.string(), origen: z.literal("tiktok"), avisos: z.array(z.string()) }),
});

export function parsearTikTok(contenido: string): LoteTikTok {
  const crudo: unknown = JSON.parse(contenido);
  validarSinPII(crudo);
  return LoteTikTokSchema.parse(crudo) as LoteTikTok;
}

export function cargarTikTok(ruta: string = RUTA_TIKTOK): LoteTikTok | null {
  if (!existsSync(ruta)) return null;
  try {
    return parsearTikTok(readFileSync(ruta, "utf8"));
  } catch (e) {
    console.warn(`[oráculo] datos/tiktok.json no se pudo leer: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Mete TikTok en el lote: sus filas reemplazan a las de la misma cuenta que ya hubiera; el rango se amplía si hace falta. */
export function fusionarTikTokEnLote(lote: LoteDatos, tiktok: LoteTikTok | null): LoteDatos {
  if (!tiktok || !tiktok.insights.length) return lote;
  const cuenta = tiktok.meta.cuentaId;
  const insights = [...lote.insights.filter((i) => i.cuentaId !== cuenta), ...tiktok.insights];
  const ids = new Set(tiktok.creativos.map((c) => c.id));
  const creativos = [...lote.creativos.filter((c) => !ids.has(c.id)), ...tiktok.creativos];
  const desde = tiktok.meta.desde < lote.meta.desde ? tiktok.meta.desde : lote.meta.desde;
  const hasta = tiktok.meta.hasta > lote.meta.hasta ? tiktok.meta.hasta : lote.meta.hasta;
  const presentes = new Set(insights.map((i) => i.fecha));
  return { ...lote, insights, creativos, meta: { ...lote.meta, desde, hasta, huecos: listarHuecos(desde, hasta, presentes), advertencias: [...lote.meta.advertencias, ...tiktok.meta.avisos] } };
}
