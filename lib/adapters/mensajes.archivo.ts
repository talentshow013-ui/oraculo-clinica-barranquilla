/**
 * `datos/mensajes.json` (lo escribe `npm run mensajes:sincronizar`, cada hora en la VPS): el mensaje
 * predeterminado de WhatsApp de todos los anuncios. Sin archivo → lista vacía.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnuncioMensaje } from "./meta.mensajes";

export const RUTA_MENSAJES = resolve(process.cwd(), "datos", "mensajes.json");

export function cargarMensajes(ruta: string = RUTA_MENSAJES): { capturadoEn: string | null; anuncios: AnuncioMensaje[] } {
  if (!existsSync(ruta)) return { capturadoEn: null, anuncios: [] };
  try {
    const j = JSON.parse(readFileSync(ruta, "utf8")) as { capturadoEn?: string; anuncios?: AnuncioMensaje[] };
    return { capturadoEn: j.capturadoEn ?? null, anuncios: j.anuncios ?? [] };
  } catch {
    return { capturadoEn: null, anuncios: [] };
  }
}
