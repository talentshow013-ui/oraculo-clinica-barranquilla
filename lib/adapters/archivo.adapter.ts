/**
 * Fuente real: lee datos/lote.json, escrito por el proceso de sincronización
 * (ver docs/CONEXION_MCP.md). Mismo contrato, mismo guardián. Ningún componente cambia.
 */
import { resolve } from "node:path";
import { FuenteArchivoBase } from "./archivo.base";

/** `ORACULO_RUTA_LOTE` permite leer el lote desde otra carpeta (disco persistente en un servidor). */
export const RUTA_LOTE = process.env.ORACULO_RUTA_LOTE ? resolve(process.env.ORACULO_RUTA_LOTE) : resolve(process.cwd(), "datos", "lote.json");

export class FuenteArchivo extends FuenteArchivoBase {
  readonly nombre = "campanas_y_audiencias";
  protected readonly etiquetaPublica = "Campañas y audiencias";
  protected readonly ayudaSiFalta =
    "Aún no se han cargado datos reales en datos/lote.json. Ejecuta la sincronización semanal desde el asistente para generarlo.";
  constructor(ruta: string = RUTA_LOTE) {
    super(ruta);
  }
}
