/**
 * Importa un dataset del actor `apify/facebook-ads-scraper` (JSON array) al lote.
 *
 *   npm run importar-radar -- datos/radar-apify.json                 → fusiona en datos/lote.json
 *   npm run importar-radar -- datos/radar-apify.json --destino datos/seed.json
 *   npm run importar-radar -- datos/radar-apify.json --ciudades config/competidores.json
 *
 * Reemplaza `competidores` y `anunciosCompetencia` del lote destino (los demás bloques
 * se conservan), valida contra el contrato y escribe. Si el destino no existe, lo crea
 * con los demás bloques vacíos (el panel mostrará solo el radar hasta que se sincronicen campañas).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LoteDatosSchema, type LoteDatos } from "@/lib/adapters/types";
import { mapearRadarApify, type ItemApify } from "@/lib/adapters/radar.apify";
import { hoyBogota } from "@/lib/format/fechas";
import { validarSinPII } from "@/lib/privacy";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const origen = process.argv[2];
if (!origen || origen.startsWith("--")) {
  console.error("Uso: npm run importar-radar -- <dataset.json> [--destino datos/lote.json] [--ciudades config/competidores.json]");
  process.exit(1);
}
const destino = resolve(process.cwd(), arg("--destino") ?? "datos/lote.json");
const hoy = hoyBogota();

const items = JSON.parse(readFileSync(resolve(process.cwd(), origen), "utf8")) as ItemApify[];
if (!Array.isArray(items)) {
  console.error("El archivo de origen debe ser un arreglo JSON (exportación del dataset de Apify).");
  process.exit(1);
}

let ciudades: Record<string, string> = {};
const rutaCiudades = arg("--ciudades");
if (rutaCiudades && existsSync(resolve(process.cwd(), rutaCiudades))) {
  const lista = JSON.parse(readFileSync(resolve(process.cwd(), rutaCiudades), "utf8")) as Array<{ id?: string; pageId?: string; ciudad?: string }>;
  for (const c of lista) if ((c.pageId ?? c.id) && c.ciudad) ciudades[String(c.pageId ?? c.id)] = c.ciudad;
}

const radar = mapearRadarApify(items, hoy, ciudades);

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
console.log(`OK · ${radar.anunciosCompetencia.length} anuncios · ${radar.competidores.length} competidores · ${radar.descartados} descartados · escrito en ${destino}`);
