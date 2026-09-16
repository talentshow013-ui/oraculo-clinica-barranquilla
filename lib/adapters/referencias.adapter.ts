/**
 * Lee las capturas de referencia de otros mercados (`datos/referencias/<ciudad>-<n>.json`), hechas
 * con `npm run radar:capturar -- --q "…" --pais XX --sin-imagenes --salida datos/referencias/<ciudad>-<n>.json`.
 * La ciudad y el país salen del nombre del archivo (tabla abajo); lo que no se reconoce se ignora
 * con aviso. `ORACULO_RUTA_REFERENCIAS` permite leerlas desde otra carpeta en el servidor.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ArchivoReferencia } from "@/lib/audiences/referencias";
import type { TarjetaCruda } from "@/lib/adapters/radar.ui";

export const RUTA_REFERENCIAS = process.env.ORACULO_RUTA_REFERENCIAS ? resolve(process.env.ORACULO_RUTA_REFERENCIAS) : resolve(process.cwd(), "datos", "referencias");

/** Prefijo del archivo → ciudad y país. Agregar aquí una ciudad nueva basta para que el panel la muestre. */
export const CIUDADES_REFERENCIA: Record<string, { ciudad: string; pais: string }> = {
  cartagena: { ciudad: "Cartagena", pais: "CO" },
  santamarta: { ciudad: "Santa Marta", pais: "CO" },
  medellin: { ciudad: "Medellín", pais: "CO" },
  bogota: { ciudad: "Bogotá", pais: "CO" },
  cali: { ciudad: "Cali", pais: "CO" },
  miami: { ciudad: "Miami", pais: "US" },
  houston: { ciudad: "Houston", pais: "US" },
  losangeles: { ciudad: "Los Ángeles", pais: "US" },
  mexico: { ciudad: "Ciudad de México", pais: "MX" },
  madrid: { ciudad: "Madrid", pais: "ES" },
};

export function interpretarNombreReferencia(nombre: string): { ciudad: string; pais: string } | null {
  const base = nombre.replace(/^.*[\\/]/, "").replace(/\.json$/i, "").toLowerCase();
  const prefijo = base.split(/[-_]/)[0] ?? "";
  return CIUDADES_REFERENCIA[prefijo] ?? null;
}

export function parsearReferencia(nombre: string, contenido: string): ArchivoReferencia | null {
  const ubic = interpretarNombreReferencia(nombre);
  if (!ubic) return null;
  const obj = JSON.parse(contenido) as { capturadoEn?: unknown; consulta?: unknown; tarjetas?: unknown };
  const tarjetas = Array.isArray(obj.tarjetas) ? (obj.tarjetas as TarjetaCruda[]) : [];
  return {
    ...ubic,
    consulta: typeof obj.consulta === "string" ? obj.consulta : nombre,
    capturadoEn: typeof obj.capturadoEn === "string" ? obj.capturadoEn.slice(0, 10) : "",
    tarjetas,
  };
}

/** Carga todas las capturas de la carpeta; sin carpeta → lista vacía (el panel dice «sin referencias»). */
export function cargarReferencias(carpeta: string = RUTA_REFERENCIAS): ArchivoReferencia[] {
  if (!existsSync(carpeta)) return [];
  const salida: ArchivoReferencia[] = [];
  for (const n of readdirSync(carpeta).filter((x) => x.endsWith(".json")).sort()) {
    try {
      const r = parsearReferencia(n, readFileSync(resolve(carpeta, n), "utf8"));
      if (r) salida.push(r);
    } catch {
      /* archivo roto: se ignora, no tumba el panel */
    }
  }
  return salida;
}
