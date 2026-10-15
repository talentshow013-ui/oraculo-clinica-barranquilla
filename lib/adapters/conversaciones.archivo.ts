/**
 * `datos/conversaciones.json` (lo escribe el webhook de Kommo en la VPS): por conversación, la huella
 * (no el id), de qué anuncio vino, cuánto tardó la primera respuesta y quién. Sin texto, sin nombres,
 * sin teléfonos. Archivo privado (modo 600) y fuera del repositorio.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validarSinPII } from "@/lib/privacy";
import type { EstadoConversaciones } from "./kommo.conversaciones";

export const RUTA_CONVERSACIONES = process.env.ORACULO_RUTA_CONVERSACIONES ? resolve(process.env.ORACULO_RUTA_CONVERSACIONES) : resolve(process.cwd(), "datos", "conversaciones.json");

export const estadoVacio = (): EstadoConversaciones => ({ version: 1, actualizadoEn: "", conversaciones: {} });

export function cargarConversaciones(ruta: string = RUTA_CONVERSACIONES): EstadoConversaciones {
  if (!existsSync(ruta)) return estadoVacio();
  try {
    const j = JSON.parse(readFileSync(ruta, "utf8")) as Partial<EstadoConversaciones>;
    return { version: 1, actualizadoEn: j.actualizadoEn ?? "", conversaciones: j.conversaciones ?? {} };
  } catch {
    return estadoVacio();
  }
}

/** Escritura atómica (archivo temporal + renombrar) para que un corte no deje el archivo a medias. */
export function guardarConversaciones(estado: EstadoConversaciones, ruta: string = RUTA_CONVERSACIONES): void {
  validarSinPII(estado);
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, JSON.stringify(estado), { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, ruta);
  try {
    chmodSync(ruta, 0o600);
  } catch {
    /* Windows */
  }
}
