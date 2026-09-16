/**
 * `.env` sin dependencias: los scripts (`tsx`) no lo cargan solos como lo hace Next.
 * Solo lectura de CLAVE=valor (comentarios y líneas vacías se ignoran) y escritura de claves
 * puntuales conservando el resto del archivo. Nunca imprime valores.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const RUTA_ENV = resolve(process.cwd(), ".env");

export function leerEnv(contenido: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const linea of contenido.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linea);
    if (!m) continue;
    let v = m[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]!] = v;
  }
  return out;
}

/** Carga `.env` en `process.env` sin pisar lo que ya venga del sistema. */
export function cargarEnv(ruta: string = RUTA_ENV): void {
  if (!existsSync(ruta)) return;
  for (const [k, v] of Object.entries(leerEnv(readFileSync(ruta, "utf8")))) if (process.env[k] === undefined) process.env[k] = v;
}

/** Reemplaza (o agrega al final) las claves dadas; el resto del archivo queda igual. */
export function actualizarEnv(contenido: string, claves: Record<string, string>): string {
  const pendientes = new Set(Object.keys(claves));
  const lineas = contenido.split(/\r?\n/).map((linea) => {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(linea);
    if (m && pendientes.has(m[1]!)) {
      pendientes.delete(m[1]!);
      return `${m[1]}=${claves[m[1]!]}`;
    }
    return linea;
  });
  if (lineas.length && lineas[lineas.length - 1] === "") lineas.pop();
  for (const k of pendientes) lineas.push(`${k}=${claves[k]}`);
  return lineas.join("\n") + "\n";
}

export function guardarEnEnv(claves: Record<string, string>, ruta: string = RUTA_ENV): void {
  const actual = existsSync(ruta) ? readFileSync(ruta, "utf8") : "";
  writeFileSync(ruta, actualizarEnv(actual, claves), "utf8");
  for (const [k, v] of Object.entries(claves)) process.env[k] = v;
}
