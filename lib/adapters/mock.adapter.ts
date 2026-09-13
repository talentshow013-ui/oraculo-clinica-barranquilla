/**
 * Fuente de demostración: lee datos/seed.json (generado por `npm run seed`).
 * Valida con el MISMO contrato que la fuente real. Si el seed se desvía, falla ruidosamente.
 */
import { resolve } from "node:path";
import { FuenteArchivoBase } from "./archivo.base";

export const RUTA_SEED = resolve(process.cwd(), "datos", "seed.json");

export class FuenteMock extends FuenteArchivoBase {
  readonly nombre = "demostracion";
  protected readonly etiquetaPublica = "Datos de demostración";
  protected readonly ayudaSiFalta = "Ejecuta `npm run seed` para generar los datos de demostración.";
  constructor(ruta: string = RUTA_SEED) {
    super(ruta);
  }
}
