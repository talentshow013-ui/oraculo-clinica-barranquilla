/**
 * Convierte los archivos crudos del conector de Meta (datos/crudo/*.json) en datos/lote.json.
 *   npm run importar-meta                      → lee datos/crudo, conserva lo demás de datos/lote.json si existe
 *   npm run importar-meta -- --base datos/seed.json   → conserva creativos/radar/experimentos de otro lote
 * Ver lib/adapters/meta.importar.ts para el nombre que debe tener cada archivo.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LoteDatosSchema } from "@/lib/adapters/types";
import { construirLoteDesdeCrudos } from "@/lib/adapters/meta.importar";
import { validarSinPII } from "@/lib/privacy";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const carpeta = resolve(process.cwd(), arg("--crudo") ?? "datos/crudo");
const destino = resolve(process.cwd(), arg("--destino") ?? "datos/lote.json");
const rutaBase = resolve(process.cwd(), arg("--base") ?? destino);

if (!existsSync(carpeta)) { console.error(`No existe ${carpeta}`); process.exit(1); }
// Los que empiezan por «_» son auxiliares (listas, respaldos): no son crudos del conector.
const archivos = readdirSync(carpeta).filter((n) => n.endsWith(".json") && !n.startsWith("_")).map((n) => ({ nombre: n, contenido: readFileSync(resolve(carpeta, n), "utf8") }));
if (!archivos.length) { console.error(`No hay archivos .json en ${carpeta}`); process.exit(1); }
const base = existsSync(rutaBase) ? LoteDatosSchema.parse(JSON.parse(readFileSync(rutaBase, "utf8"))) : undefined;

const { resumen, ...lote } = construirLoteDesdeCrudos(archivos, base);
validarSinPII(lote);
mkdirSync(resolve(destino, ".."), { recursive: true });
writeFileSync(destino, JSON.stringify(lote), "utf8");
console.log(`Lote escrito en ${destino}`);
console.log(`  archivos: ${resumen.archivos} · filas leídas: ${resumen.filasLeidas} · insights: ${resumen.insights} · desgloses: ${resumen.desgloses} · creativos: ${resumen.creativos} · rankings de Meta: ${resumen.rankings} · cambios en bitácora: ${resumen.bitacora} · públicos: ${resumen.publicos}`);
console.log(`  cuentas: ${resumen.cuentas.join(", ")} · rango: ${lote.meta.desde} → ${lote.meta.hasta} · huecos: ${lote.meta.huecos.length}`);
if (resumen.ignorados.length) console.log(`  ignorados (nombre no reconocido): ${resumen.ignorados.join(", ")}`);
