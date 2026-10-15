/**
 * Conversaciones de WhatsApp (webhook de Kommo) listas para el panel, Telegram y `npm run conversaciones`:
 * de qué anuncio vino cada una, cuánto tardó la asesora, y hasta dónde llegó su lead en Kommo
 * (cita, asistió, venta), con el gasto de cada anuncio en el mismo periodo. Solo conteos y tiempos.
 * Los archivos viven en la VPS (`datos/conversaciones*.json`); en otro equipo no hay datos aquí
 * (el comando los pide a la VPS por `/api/conversaciones`).
 */
import { existsSync, readFileSync } from "node:fs";
import { RUTA_LOTE } from "@/lib/adapters/archivo.adapter";
import { RUTA_CONVERSACIONES, RUTA_EMBUDO_CONVERSACIONES, cargarConversaciones, cargarEmbudoConversaciones } from "@/lib/adapters/conversaciones.archivo";
import { resumir, type EstadoConversaciones, type ResumenConversaciones } from "@/lib/adapters/kommo.conversaciones";
import { anunciosConMensaje } from "@/lib/adapters/kommo.webhook";
import type { AnuncioMensaje } from "@/lib/adapters/meta.mensajes";

export interface ResumenWhatsapp extends ResumenConversaciones {
  /** Primer día con datos (el día en que se activó el webhook). */
  primerDia: string;
  /** Último aviso guardado. */
  actualizadoEn: string | null;
  /** Última vez que se cruzó con el embudo de Kommo. */
  cruceEn: string | null;
}

/** Gasto de cada anuncio de Meta en el periodo (filas de nivel anuncio del lote). */
export function sumarGastoPorAnuncio(insights: ReadonlyArray<{ nivel: string; id: string; fecha: string; gasto: number }>, desde: string, hasta: string): Record<string, number> {
  const g: Record<string, number> = {};
  for (const r of insights) if (r.nivel === "anuncio" && r.fecha >= desde && r.fecha <= hasta) g[r.id] = (g[r.id] ?? 0) + (r.gasto || 0);
  return g;
}

/** Las conversaciones guardadas antes de que se guardara el id del anuncio lo recuperan por nombre. */
export function completarIdsDeAnuncio(estado: EstadoConversaciones, anuncios: ReadonlyArray<AnuncioMensaje>): EstadoConversaciones {
  const porNombre = new Map(anuncios.map((a) => [`${a.cuenta}|${a.campana}|${a.anuncio}`, a.id]));
  let cambio = false;
  const conversaciones = Object.fromEntries(
    Object.entries(estado.conversaciones).map(([h, c]) => {
      const a = c.atribucion;
      if (a.anuncioId || !a.anuncio) return [h, c];
      const id = porNombre.get(`${a.cuenta}|${a.campana}|${a.anuncio}`);
      if (!id) return [h, c];
      cambio = true;
      return [h, { ...c, atribucion: { ...a, anuncioId: id } }];
    }),
  );
  return cambio ? { ...estado, conversaciones } : estado;
}

function insightsDelLote(ruta: string): { nivel: string; id: string; fecha: string; gasto: number }[] {
  if (!existsSync(ruta)) return [];
  try {
    return (JSON.parse(readFileSync(ruta, "utf8")) as { insights?: { nivel: string; id: string; fecha: string; gasto: number }[] }).insights ?? [];
  } catch {
    return [];
  }
}

/** null = este equipo no tiene conversaciones guardadas (no es la VPS, o el webhook no ha traído nada). */
export function resumenWhatsapp(o: { desde: string; hasta: string; ahora?: number; rutas?: { conversaciones?: string; embudo?: string; lote?: string; mensajes?: string } }): ResumenWhatsapp | null {
  const estadoCrudo = cargarConversaciones(o.rutas?.conversaciones ?? RUTA_CONVERSACIONES);
  const todas = Object.values(estadoCrudo.conversaciones);
  if (!todas.length) return null;
  const estado = completarIdsDeAnuncio(estadoCrudo, anunciosConMensaje(o.rutas?.mensajes));
  const cruce = cargarEmbudoConversaciones(o.rutas?.embudo ?? RUTA_EMBUDO_CONVERSACIONES);
  const primerDia = todas.reduce((a, c) => (c.dia < a ? c.dia : a), todas[0]!.dia);
  /* el gasto, solo desde que hay conversaciones: antes de activar el webhook no hay con qué dividirlo */
  const desdeGasto = o.desde < primerDia ? primerDia : o.desde;
  const r = resumir(estado, {
    desde: o.desde,
    hasta: o.hasta,
    ahora: o.ahora,
    embudo: cruce?.leads,
    asesoras: cruce?.asesoras,
    gastoPorAnuncio: sumarGastoPorAnuncio(insightsDelLote(o.rutas?.lote ?? RUTA_LOTE), desdeGasto, o.hasta),
  });
  return { ...r, primerDia, actualizadoEn: estadoCrudo.actualizadoEn || null, cruceEn: cruce?.actualizadoEn || null };
}
