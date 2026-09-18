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

export const RUTA_GOOGLE_ADS = process.env.ORACULO_RUTA_GOOGLE_ADS ? resolve(process.env.ORACULO_RUTA_GOOGLE_ADS) : resolve(process.cwd(), "datos", "googleads.json");

/** Lote de una plataforma de pauta aparte de Meta (TikTok, Google Ads): mismas filas del contrato, una cuenta. */
export const LotePlataformaSchema = z.object({
  insights: z.array(InsightRowSchema),
  creativos: z.array(CreativoSchema),
  meta: z.object({ cuentaId: z.string().min(1), capturadoEn: z.string(), desde: z.string(), hasta: z.string(), origen: z.enum(["tiktok", "google"]), avisos: z.array(z.string()) }),
});
export type LotePlataforma = z.infer<typeof LotePlataformaSchema>;
export const LoteTikTokSchema = LotePlataformaSchema;

export function parsearPlataforma(contenido: string): LotePlataforma {
  const crudo: unknown = JSON.parse(contenido);
  validarSinPII(crudo);
  return LotePlataformaSchema.parse(crudo);
}
export const parsearTikTok = (contenido: string): LoteTikTok => parsearPlataforma(contenido) as LoteTikTok;

export function cargarPlataforma(ruta: string): LotePlataforma | null {
  if (!existsSync(ruta)) return null;
  try {
    return parsearPlataforma(readFileSync(ruta, "utf8"));
  } catch (e) {
    console.warn(`[oráculo] ${ruta} no se pudo leer: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
export const cargarTikTok = (ruta: string = RUTA_TIKTOK): LoteTikTok | null => cargarPlataforma(ruta) as LoteTikTok | null;
export const cargarGoogleAds = (ruta: string = RUTA_GOOGLE_ADS): LotePlataforma | null => cargarPlataforma(ruta);

/** Mete una plataforma en el lote: sus filas reemplazan a las de la misma cuenta que ya hubiera; el rango se amplía si hace falta. */
export function fusionarPlataformaEnLote(lote: LoteDatos, extra: LotePlataforma | null): LoteDatos {
  if (!extra || !extra.insights.length) return lote;
  const cuenta = extra.meta.cuentaId;
  const insights = [...lote.insights.filter((i) => i.cuentaId !== cuenta), ...extra.insights];
  const ids = new Set(extra.creativos.map((c) => c.id));
  const creativos = [...lote.creativos.filter((c) => !ids.has(c.id)), ...extra.creativos];
  const desde = extra.meta.desde < lote.meta.desde ? extra.meta.desde : lote.meta.desde;
  const hasta = extra.meta.hasta > lote.meta.hasta ? extra.meta.hasta : lote.meta.hasta;
  const presentes = new Set(insights.map((i) => i.fecha));
  return { ...lote, insights, creativos, meta: { ...lote.meta, desde, hasta, huecos: listarHuecos(desde, hasta, presentes), advertencias: [...lote.meta.advertencias, ...extra.meta.avisos] } };
}
export const fusionarTikTokEnLote = fusionarPlataformaEnLote;
/** Meta + TikTok + Google Ads, en ese orden. */
export function fusionarPlataformasEnLote(lote: LoteDatos): LoteDatos {
  return fusionarPlataformaEnLote(fusionarPlataformaEnLote(lote, cargarTikTok()), cargarGoogleAds());
}
