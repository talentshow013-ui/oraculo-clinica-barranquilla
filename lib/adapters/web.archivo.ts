/**
 * Lee `datos/web.json` (lo escribe `npm run web:sincronizar` desde Google Analytics 4). Misma
 * validación y guardián que el resto. Sin archivo → null; roto → null con aviso en consola.
 * `ORACULO_RUTA_WEB` permite leerlo desde otra carpeta en el servidor.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LoteWebSchema, type LoteWeb } from "@/lib/adapters/types";
import { validarSinPII } from "@/lib/privacy";

export const RUTA_WEB = process.env.ORACULO_RUTA_WEB ? resolve(process.env.ORACULO_RUTA_WEB) : resolve(process.cwd(), "datos", "web.json");

export function parsearWeb(contenido: string): LoteWeb {
  const crudo: unknown = JSON.parse(contenido);
  validarSinPII(crudo);
  return LoteWebSchema.parse(crudo);
}

export function cargarWeb(ruta: string = RUTA_WEB): LoteWeb | null {
  if (!existsSync(ruta)) return null;
  try {
    return parsearWeb(readFileSync(ruta, "utf8"));
  } catch (e) {
    console.warn(`[oráculo] datos/web.json no se pudo leer: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
