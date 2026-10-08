/**
 * Importa anuncios de competencia al lote, desde Apify (arreglo JSON) o desde la captura
 * propia con Playwright (`npm run radar:capturar`, objeto con `tarjetas`).
 *
 *   npm run importar-radar -- datos/radar-apify.json                 → fusiona en datos/lote.json
 *   npm run importar-radar -- datos/radar-apify.json --destino datos/seed.json
 *   npm run importar-radar -- datos/radar-apify.json --ciudades config/competidores.json
 *   npm run importar-radar -- datos/radar/                           → todas las ciudades de referencia (un archivo por ciudad)
 *   npm run importar-radar -- datos/radar/medellin.json datos/radar/miami.json --referencias
 *
 * Reemplaza `competidores` y `anunciosCompetencia` del lote destino (los demás bloques
 * se conservan), valida contra el contrato y escribe. Si el destino no existe, lo crea
 * con los demás bloques vacíos (el panel mostrará solo el radar hasta que se sincronicen campañas).
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LoteDatosSchema, type LoteDatos } from "@/lib/adapters/types";
import { mapearRadarApify, type ItemApify } from "@/lib/adapters/radar.apify";
import { combinarRadares, mapearRadarUI, type TarjetaCruda } from "@/lib/adapters/radar.ui";
import { EXCLUIR_EN } from "@/config/radar-referencias";
import { hoyBogota } from "@/lib/format/fechas";
import { cliente } from "@/config/cliente";
import { validarSinPII } from "@/lib/privacy";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/* los archivos de origen son los argumentos sueltos (los que no son bandera ni valor de bandera); una carpeta aporta todos sus .json */
const CON_VALOR = new Set(["--destino", "--ciudades"]);
const sueltos = process.argv.slice(2).filter((x, i, todos) => !x.startsWith("--") && !CON_VALOR.has(todos[i - 1] ?? ""));
const origenes = sueltos.flatMap((r) => {
  const ruta = resolve(process.cwd(), r);
  return existsSync(ruta) && statSync(ruta).isDirectory() ? readdirSync(ruta).filter((f) => f.endsWith(".json")).map((f) => resolve(ruta, f)) : [ruta];
});
if (!origenes.length) {
  console.error("Uso: npm run importar-radar -- <dataset.json | carpeta/> [más archivos] [--destino datos/lote.json] [--ciudades config/competidores.json]");
  process.exit(1);
}
const destino = resolve(process.cwd(), arg("--destino") ?? "datos/lote.json");
const hoy = hoyBogota();

// Dos formatos de entrada, mismo contrato de salida:
//  - arreglo JSON  → dataset de Apify (apify/facebook-ads-scraper)
//  - { tarjetas }  → captura propia con Playwright (npm run radar:capturar), con su `ciudad`
let ciudades: Record<string, string> = {};
const rutaCiudades = arg("--ciudades");
if (rutaCiudades && existsSync(resolve(process.cwd(), rutaCiudades))) {
  const lista = JSON.parse(readFileSync(resolve(process.cwd(), rutaCiudades), "utf8")) as Array<{ id?: string; pageId?: string; ciudad?: string }>;
  for (const c of lista) if ((c.pageId ?? c.id) && c.ciudad) ciudades[String(c.pageId ?? c.id)] = c.ciudad;
}
const referencias = process.argv.includes("--referencias") || origenes.length > 1;
/* con ciudades de referencia también se descartan los rubros ajenos en inglés */
const filtro = referencias ? { ...cliente.radar, excluirNombres: [...cliente.radar.excluirNombres, ...EXCLUIR_EN] } : cliente.radar;
const radares = origenes.map((ruta) => {
  const crudo = JSON.parse(readFileSync(ruta, "utf8")) as ItemApify[] | { tarjetas?: TarjetaCruda[]; ciudad?: string | null };
  if (Array.isArray(crudo)) {
    const r = mapearRadarApify(crudo, hoy, ciudades);
    return { ...r, excluidos: 0 };
  }
  if (!Array.isArray(crudo.tarjetas)) {
    console.error(`${ruta}: debe ser un arreglo JSON (Apify) o un objeto con \`tarjetas\` (captura propia).`);
    process.exit(1);
  }
  const r = mapearRadarUI(crudo.tarjetas, hoy, ciudades, crudo.ciudad ?? "Barranquilla", filtro);
  console.log(`  ${crudo.ciudad ?? "(sin ciudad)"} · ${r.competidores.length} competidores · ${r.anunciosCompetencia.length} anuncios · ${ruta.split("/").pop()}`);
  return r;
});
const radar = radares.length === 1 ? radares[0]! : combinarRadares(radares);

const base: LoteDatos = existsSync(destino)
  ? (JSON.parse(readFileSync(destino, "utf8")) as LoteDatos)
  : {
      insights: [],
      desgloses: [],
      creativos: [],
      embudo: [],
      competidores: [],
      anunciosCompetencia: [],
      experimentos: [],
      meta: { generadoEn: `${hoy}T12:00:00-05:00`, desde: hoy, hasta: hoy, origen: "archivo", huecos: [], advertencias: [] },
    };

const lote: LoteDatos = {
  ...base,
  competidores: radar.competidores,
  anunciosCompetencia: radar.anunciosCompetencia,
  meta: {
    ...base.meta,
    generadoEn: `${hoy}T12:00:00-05:00`,
    advertencias: [
      ...base.meta.advertencias.filter((a) => !a.startsWith("Radar de mercado")),
      `Radar de mercado actualizado el ${hoy}: ${radar.competidores.length} competidores, ${radar.anunciosCompetencia.length} anuncios observados en la Biblioteca pública.`,
    ],
  },
};

validarSinPII(lote);
const r = LoteDatosSchema.safeParse(lote);
if (!r.success) {
  console.error("El lote resultante no cumple el contrato. Se corrige el mapeo, no el contrato.");
  console.error(r.error.issues.slice(0, 10));
  process.exit(1);
}
writeFileSync(destino, JSON.stringify(r.data), "utf8");
console.log(`OK · ${radar.anunciosCompetencia.length} anuncios · ${radar.competidores.length} competidores · ${radar.descartados} descartados · ${"excluidos" in radar ? radar.excluidos : 0} excluidos (clínica propia o rubro ajeno) · escrito en ${destino}`);
