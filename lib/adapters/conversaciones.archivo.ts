/**
 * `datos/conversaciones.json` (lo escribe el webhook de Kommo en la VPS): por conversación, la huella
 * (no el id), de qué anuncio vino, cuánto tardó la primera respuesta y quién. Sin texto, sin nombres,
 * sin teléfonos. Archivo privado (modo 600) y fuera del repositorio.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validarSinPII } from "@/lib/privacy";
import type { EmbudoConversaciones, EstadoConversaciones } from "./kommo.conversaciones";

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

/* ───── el cruce con el embudo de Kommo (lo escribe `npm run conversaciones:cruzar`, cada hora en la VPS) ───── */

export const RUTA_EMBUDO_CONVERSACIONES = process.env.ORACULO_RUTA_CONVERSACIONES
  ? resolve(dirname(resolve(process.env.ORACULO_RUTA_CONVERSACIONES)), "conversaciones-embudo.json")
  : resolve(process.cwd(), "datos", "conversaciones-embudo.json");

export function cargarEmbudoConversaciones(ruta: string = RUTA_EMBUDO_CONVERSACIONES): EmbudoConversaciones | null {
  if (!existsSync(ruta)) return null;
  try {
    const j = JSON.parse(readFileSync(ruta, "utf8")) as Partial<EmbudoConversaciones>;
    return { version: 1, actualizadoEn: j.actualizadoEn ?? "", leads: j.leads ?? {}, asesoras: j.asesoras ?? {} };
  } catch {
    return null;
  }
}

export function guardarEmbudoConversaciones(e: EmbudoConversaciones, ruta: string = RUTA_EMBUDO_CONVERSACIONES): void {
  validarSinPII(e);
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, JSON.stringify(e), { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, ruta);
}
