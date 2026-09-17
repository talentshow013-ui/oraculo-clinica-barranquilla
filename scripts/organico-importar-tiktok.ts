/**
 * Mete el orgánico de TikTok (CSV de TikTok Studio) en `datos/organico.json` como red «tiktok».
 *
 *   npm run organico:importar-tiktok -- descargas/contenido.csv            (videos)
 *   npm run organico:importar-tiktok -- descargas/resumen.csv              (por día)
 *   npm run organico:importar-tiktok -- a.csv b.csv --usuario vivante --seguidores 12500
 *
 * Los videos e Instagram/Facebook que ya estén en el archivo se conservan; los de TikTok con el
 * mismo id se reemplazan. Guía: docs/CONEXION_TIKTOK.md (parte orgánica).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { RUTA_ORGANICO, parsearOrganico } from "@/lib/adapters/organico.archivo";
import { fusionarLotes } from "@/lib/adapters/organico.graph";
import { detectarTipoCsv, leerCsv, mapearDiasTikTok, mapearVideosTikTok } from "@/lib/adapters/organico.tiktok";
import { LoteOrganicoSchema, type LoteOrganico } from "@/lib/adapters/types";
import { hoyBogota } from "@/lib/format/fechas";
import { validarSinPII } from "@/lib/privacy";

const args = process.argv.slice(2);
const opc = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const archivos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1]!.startsWith("--")));
if (!archivos.length) {
  console.error("Uso: npm run organico:importar-tiktok -- <archivo.csv> [otro.csv] [--usuario nombre] [--seguidores N]");
  process.exit(1);
}

const nuevo: LoteOrganico = { cuentas: [], publicaciones: [], dias: [], meta: { capturadoEn: new Date().toISOString(), desde: hoyBogota(), hasta: hoyBogota(), origen: "graph", avisos: [] } };
for (const a of archivos) {
  const ruta = resolve(process.cwd(), a);
  const filas = leerCsv(readFileSync(ruta, "utf8"));
  const tipo = detectarTipoCsv(filas);
  if (tipo === "videos") {
    const p = mapearVideosTikTok(filas);
    nuevo.publicaciones.push(...p);
    console.log(`✓ ${a}: ${p.length} videos`);
  } else if (tipo === "dias") {
    const d = mapearDiasTikTok(filas);
    nuevo.dias.push(...d);
    console.log(`✓ ${a}: ${d.length} días`);
  } else {
    console.error(`✗ ${a}: no parece un CSV de TikTok Studio (videos o resumen por día). Columnas: ${Object.keys(filas[0] ?? {}).join(", ")}`);
    process.exit(1);
  }
}
const fechas = [...nuevo.publicaciones.map((p) => p.publicadoEn.slice(0, 10)), ...nuevo.dias.map((d) => d.fecha)].sort();
if (fechas.length) {
  nuevo.meta.desde = fechas[0]!;
  nuevo.meta.hasta = fechas[fechas.length - 1]!;
}
const viejo = existsSync(RUTA_ORGANICO) ? parsearOrganico(readFileSync(RUTA_ORGANICO, "utf8")) : null;
const seguidores = opc("--seguidores") ? Number(opc("--seguidores")) : (viejo?.cuentas.find((c) => c.red === "tiktok")?.seguidores ?? nuevo.dias.filter((d) => d.seguidoresTotal != null).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]?.seguidoresTotal ?? null);
const alias = opc("--usuario") ?? viejo?.cuentas.find((c) => c.red === "tiktok")?.alias ?? (/@([^/]+)\//.exec(nuevo.publicaciones[0]?.enlace ?? "")?.[1] ?? "tiktok");
nuevo.cuentas = [...(viejo?.cuentas.filter((c) => c.red !== "tiktok") ?? []), { red: "tiktok", id: alias, alias, seguidores, publicaciones: null }];
const lote = LoteOrganicoSchema.parse(validarSinPII(fusionarLotes(viejo, nuevo)));
// fusionarLotes toma las cuentas del nuevo (ya traen las de Meta conservadas) y los avisos del nuevo
lote.meta.avisos = [...new Set([...(viejo?.meta.avisos ?? []), "TikTok orgánico viene de la exportación manual de TikTok Studio: se actualiza cuando se vuelve a importar el archivo."])];
mkdirSync(dirname(RUTA_ORGANICO), { recursive: true });
writeFileSync(RUTA_ORGANICO, JSON.stringify(lote, null, 2), "utf8");
console.log(`✓ Orgánico: ${lote.publicaciones.filter((p) => p.red === "tiktok").length} videos de TikTok · ${lote.publicaciones.length} publicaciones en total · ${lote.dias.filter((d) => d.red === "tiktok").length} días de TikTok · escrito ${RUTA_ORGANICO}`);
