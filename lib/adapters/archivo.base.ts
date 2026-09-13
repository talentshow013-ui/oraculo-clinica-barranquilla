/**
 * Base común de los adapters de archivo: leer JSON, validar con el MISMO Zod,
 * pasar el guardián de datos sensibles y recortar al rango pedido.
 *
 * Aquí no hay nada específico de una plataforma. Conectar una fuente real es
 * escribir el archivo con la forma del contrato; ningún componente cambia.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import type { EstadoFuente, FuenteDatos, LoteDatos, Rango } from "@/lib/adapters/types";
import { LoteDatosSchema } from "@/lib/adapters/types";
import { validarSinPII } from "@/lib/privacy";
import { listarHuecos } from "@/lib/format/fechas";

export class ErrorLote extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorLote";
  }
}

function describirRuta(path: ReadonlyArray<PropertyKey>): string {
  return path.reduce<string>((acc, p) => (typeof p === "number" ? `${acc}[${p}]` : acc ? `${acc}.${String(p)}` : String(p)), "");
}

export function leerLote(ruta: string, ayudaSiFalta: string): LoteDatos {
  if (!existsSync(ruta)) throw new ErrorLote(`No se encontró el archivo de datos en ${ruta}. ${ayudaSiFalta}`);
  let crudo: unknown;
  try {
    crudo = JSON.parse(readFileSync(ruta, "utf8"));
  } catch (e) {
    throw new ErrorLote(`El archivo ${ruta} no es un JSON válido: ${e instanceof Error ? e.message : String(e)}`);
  }
  // Primero el guardián de datos sensibles: es más barato romper la carga que filtrar un dato de paciente.
  validarSinPII(crudo);
  const r = LoteDatosSchema.safeParse(crudo);
  if (!r.success) {
    const primeros = r.error.issues.slice(0, 5).map((i) => `${describirRuta(i.path)}: ${i.message}`).join(" · ");
    throw new ErrorLote(`El archivo ${ruta} no cumple el contrato de datos (${r.error.issues.length} problemas). ${primeros}`);
  }
  return r.data;
}

/** Recorta el lote al rango pedido y recalcula huecos y meta. */
export function recortar(lote: LoteDatos, rango: Rango): LoteDatos {
  const desde = rango.desde > lote.meta.desde ? rango.desde : lote.meta.desde;
  const hasta = rango.hasta < lote.meta.hasta ? rango.hasta : lote.meta.hasta;
  const en = (f: string) => f >= desde && f <= hasta;
  const insights = lote.insights.filter((i) => en(i.fecha));
  const presentes = new Set(insights.map((i) => i.fecha));
  return {
    ...lote,
    insights,
    desgloses: lote.desgloses.filter((d) => en(d.fecha)),
    embudo: lote.embudo.filter((r) => en(r.fecha)),
    meta: { ...lote.meta, desde, hasta, huecos: listarHuecos(desde, hasta, presentes) },
  };
}

export abstract class FuenteArchivoBase implements FuenteDatos {
  abstract readonly nombre: string;
  protected abstract readonly etiquetaPublica: string;
  protected abstract readonly ayudaSiFalta: string;
  constructor(protected readonly ruta: string) {}

  async obtener(rango: Rango): Promise<LoteDatos> {
    return recortar(leerLote(this.ruta, this.ayudaSiFalta), rango);
  }

  async estado(): Promise<EstadoFuente[]> {
    if (!existsSync(this.ruta)) {
      return [{ id: this.nombre, etiquetaPublica: this.etiquetaPublica, conectado: false, ultimaActualizacion: null, detalle: this.ayudaSiFalta }];
    }
    try {
      const lote = leerLote(this.ruta, this.ayudaSiFalta);
      const modificado = statSync(this.ruta).mtime.toISOString();
      return [
        {
          id: this.nombre,
          etiquetaPublica: this.etiquetaPublica,
          conectado: true,
          ultimaActualizacion: lote.meta.generadoEn || modificado,
          detalle: `Datos del ${lote.meta.desde} al ${lote.meta.hasta}${lote.meta.huecos.length ? ` · ${lote.meta.huecos.length} días sin datos` : ""}`,
        },
      ];
    } catch (e) {
      return [{ id: this.nombre, etiquetaPublica: this.etiquetaPublica, conectado: false, ultimaActualizacion: null, detalle: e instanceof Error ? e.message : String(e) }];
    }
  }
}
