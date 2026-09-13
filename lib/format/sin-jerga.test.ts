import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Filtro estético comercial (constitución V): en lo visible al cliente no aparece
 * jerga técnica. Se recorren app/ y components/ y se buscan términos prohibidos
 * fuera de comentarios e imports.
 */
const PROHIBIDOS = /\b(API|MCP|endpoint|Zod|LLM|sincronizaci[oó]n de datos v[ií]a integraci[oó]n)\b/;

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(tsx?|css)$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

function textoVisible(contenido: string): string {
  return contenido
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*import .*$/gm, "");
}

describe("sin jerga técnica visible", () => {
  const raiz = process.cwd();
  const objetivos = ["app", "components", "lib/format/etiquetas.ts", "lib/diagnostics/rules", "lib/opportunities", "lib/frameworks", "lib/metrics/catalog.ts"];

  test("ni app/, ni components/, ni textos de reglas, oportunidades, lentes o catálogo mencionan API/MCP/endpoint/Zod/LLM", () => {
    const hallados: string[] = [];
    for (const objetivo of objetivos) {
      const ruta = join(raiz, objetivo);
      let lista: string[] = [];
      try {
        lista = statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
      } catch {
        continue;
      }
      for (const archivo of lista) {
        if (archivo.endsWith(".test.ts")) continue;
        const texto = textoVisible(readFileSync(archivo, "utf8"));
        const m = texto.match(PROHIBIDOS);
        if (m) hallados.push(`${archivo.replace(raiz, "")}: "${m[0]}"`);
      }
    }
    expect(hallados, hallados.join("\n")).toEqual([]);
  });
});
