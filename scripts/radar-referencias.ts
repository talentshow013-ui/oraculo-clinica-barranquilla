/**
 * Rehace el radar con las ciudades de referencia (config/radar-referencias.ts): captura la
 * Biblioteca de anuncios de Meta ciudad por ciudad y consulta por consulta, y al final importa todo
 * al lote. Barranquilla no entra. Tarda: unos 2 minutos por consulta (va despacio a propósito).
 *
 *   npm run radar:referencias                     → todas las ciudades y los dos pasos
 *   npm run radar:referencias -- --ciudad Miami   → solo esa ciudad
 *   npm run radar:referencias -- --max 40         → anuncios por consulta (40 por defecto)
 *   npm run radar:referencias -- --solo-importar  → no captura; importa lo que ya hay en datos/radar/
 */
import { npmSync } from "@/lib/adapters/npm";
import { mkdirSync } from "node:fs";
import { CIUDADES_REFERENTES } from "@/config/radar-referencias";

const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const solo = arg("--ciudad")?.toLowerCase();
const max = arg("--max") ?? "40";
const slug = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function npm(args: string[]): number {
  const r = npmSync(["run", "-s", ...args], { stdio: "inherit" });
  return r.status ?? 1;
}

async function main() {
  mkdirSync("datos/radar", { recursive: true });
  const ciudades = CIUDADES_REFERENTES.filter((c) => !solo || c.ciudad.toLowerCase() === solo);
  if (!ciudades.length) {
    console.error(`No hay una ciudad «${solo}» en config/radar-referencias.ts`);
    process.exit(1);
  }
  if (!process.argv.includes("--solo-importar")) {
    for (const c of ciudades) {
      for (const q of c.consultas) {
        console.log(`\n▶ ${c.ciudad} (${c.pais}) · «${q}»`);
        const codigo = npm(["radar:capturar", "--", "--q", q, "--pais", c.pais, "--ciudad", c.ciudad, "--max", max, "--salida", `datos/radar/${slug(c.ciudad)}.json`]);
        if (codigo !== 0) console.error(`  ✗ no se pudo capturar «${q}»; sigo con la siguiente`);
        await esperar(4_000 + Math.random() * 4_000);
      }
    }
  }
  console.log("\n▶ Importando al lote…");
  process.exit(npm(["importar-radar", "--", "datos/radar/"]));
}

main();
