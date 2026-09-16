/**
 * Lee `datos/organico.json` (lo escribe `npm run organico:sincronizar` desde la Graph API de Meta).
 * Mismo guardián de datos sensibles y misma validación Zod que el lote de pauta. Sin archivo → null
 * (el panel dice «todavía no se ha conectado el orgánico»); archivo roto → null con aviso en consola,
 * nunca tumba el panel. `ORACULO_RUTA_ORGANICO` permite leerlo desde otra carpeta en el servidor.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LoteOrganicoSchema, type LoteOrganico } from "@/lib/adapters/types";
import { validarSinPII } from "@/lib/privacy";

export const RUTA_ORGANICO = process.env.ORACULO_RUTA_ORGANICO ? resolve(process.env.ORACULO_RUTA_ORGANICO) : resolve(process.cwd(), "datos", "organico.json");

export function parsearOrganico(contenido: string): LoteOrganico {
  const crudo: unknown = JSON.parse(contenido);
  validarSinPII(crudo);
  return LoteOrganicoSchema.parse(crudo);
}

export function cargarOrganico(ruta: string = RUTA_ORGANICO): LoteOrganico | null {
  if (!existsSync(ruta)) return null;
  try {
    return parsearOrganico(readFileSync(ruta, "utf8"));
  } catch (e) {
    console.warn(`[oráculo] datos/organico.json no se pudo leer: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
