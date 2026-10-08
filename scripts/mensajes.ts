/**
 * Los MENSAJES PREDETERMINADOS de WhatsApp de los anuncios: lo que la persona envía con un toque y
 * la asesora ve primero en Kommo. Lee `datos/mensajes.json` (todos los anuncios, miles; lo actualiza
 * el servicio en vivo cada hora) y, si tiene más de una hora, lo trae de nuevo.
 *
 *   npm run mensajes                              → anuncios ACTIVOS y su mensaje
 *   npm run mensajes -- --buscar "lipo en frio"   → ¿de qué anuncio (de todos, también viejos) es este mensaje de Kommo?
 *   npm run mensajes -- --nuevos                  → los anuncios vistos por primera vez en los últimos 7 días
 *   npm run mensajes -- --archivo                 → guarda entregables/mensajes-predeterminados.md (activos) y .csv (todos)
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { cargarEnv } from "@/lib/adapters/env";
import { buscarMensajeExacto, esGenerico, type AnuncioMensaje } from "@/lib/adapters/meta.mensajes";
import { traerAnuncios } from "@/lib/adapters/meta.mensajes.api";
import { npmSync } from "@/lib/adapters/npm";
import { cliente } from "@/config/cliente";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";

cargarEnv();
const RUTA = "datos/mensajes.json";
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

function cargar(): AnuncioMensaje[] {
  const viejo = !existsSync(RUTA) || Date.now() - statSync(RUTA).mtimeMs > 60 * 60_000;
  if (viejo) {
    console.error("· Trayendo todos los anuncios (la primera vez tarda 2 a 5 minutos)…");
    npmSync(["run", "-s", "mensajes:sincronizar"], { stdio: ["ignore", "inherit", "inherit"] });
  }
  if (!existsSync(RUTA)) {
    console.error("✗ No se pudo traer la lista de anuncios (npm run mensajes:sincronizar)");
    process.exit(1);
  }
  return (JSON.parse(readFileSync(RUTA, "utf8")) as { anuncios: AnuncioMensaje[] }).anuncios;
}

const ESTADO: Record<string, string> = { ACTIVE: "activo", PAUSED: "pausado", CAMPAIGN_PAUSED: "campaña pausada", ADSET_PAUSED: "conjunto pausado", ARCHIVED: "archivado", DISAPPROVED: "rechazado" };
const linea = (a: AnuncioMensaje) => `${a.cuenta} · campaña «${a.campana}» · anuncio «${a.anuncio}» (${ESTADO[a.estado] ?? a.estado.toLowerCase()}, creado ${a.creado || "—"})`;

async function main() {
  const buscar = arg("--buscar");
  if (buscar) {
    /* 1) rápido: los anuncios ACTIVOS, en vivo (segundos). Si está ahí, es la respuesta */
    const token = process.env.META_ORGANICO_TOKEN;
    if (token) {
      const activos = await traerAnuncios(token, cliente.cuentasPublicitarias.filter((x) => (x.plataforma ?? "meta") === "meta"), ["ACTIVE"]);
      const { exactos } = buscarMensajeExacto(activos, buscar);
      if (exactos.length) {
        console.log(`Coincide EXACTO (con sus emojis) con ${exactos.length} anuncio(s) ACTIVO(s), revisado en vivo:`);
        for (const a of exactos) console.log(`  · ${linea(a)}\n    mensaje: ${a.predeterminado}`);
        return;
      }
      console.error("· No está entre los anuncios activos; busco también en los pausados y viejos…");
    }
    /* 2) todos los anuncios (pausados y viejos), desde el archivo guardado */
    const todos = cargar();
    const orden = (a: AnuncioMensaje, b: AnuncioMensaje) => (a.estado === "ACTIVE" ? -1 : 0) - (b.estado === "ACTIVE" ? -1 : 0) || b.creado.localeCompare(a.creado);
    const { exactos, parecidos } = buscarMensajeExacto(todos, buscar);
    const r = (exactos.length ? exactos : parecidos).sort(orden);
    /* el emoji es la marca del anuncio: el exacto (texto + emojis) es la respuesta; los parecidos, solo una pista */
    console.log(exactos.length ? `Coincide EXACTO (con sus emojis) con ${r.length} anuncio(s) de ${todos.length}:` : r.length ? `No hay uno exacto (revisa que se copien los emojis, que son la marca de cada anuncio). Parecidos sin contar emojis: ${r.length} de ${todos.length}:` : `Ningún anuncio (de ${todos.length}) tiene un mensaje parecido a «${buscar}». Prueba con menos palabras.`);
    for (const a of r.slice(0, 30)) console.log(`  · ${linea(a)}\n    mensaje: ${a.predeterminado}`);
    if (r.length > 30) console.log(`  … y ${r.length - 30} más`);
    return;
  }
  const todos = cargar();
  const lista = process.argv.includes("--nuevos") ? todos.filter((a) => a.vistoPrimeraVez >= sumarDias(hoyBogota(), -7)) : todos.filter((a) => a.estado === "ACTIVE");
  const veces = new Map<string, number>();
  for (const a of lista) if (a.predeterminado) veces.set(a.predeterminado, (veces.get(a.predeterminado) ?? 0) + 1);
  const L = [`# Mensajes predeterminados de WhatsApp · ${hoyBogota()}`, "", `${process.argv.includes("--nuevos") ? "Anuncios nuevos (7 días)" : "Anuncios activos"}: lo que la persona envía con un toque. Es lo primero que ve la asesora en Kommo.`, ""];
  for (const cuenta of [...new Set(lista.map((a) => a.cuenta))]) {
    const de = lista.filter((a) => a.cuenta === cuenta).sort((a, b) => a.campana.localeCompare(b.campana));
    L.push(`## ${cuenta} · ${de.length} anuncios`, "");
    for (const a of de) {
      const nota = !a.predeterminado ? (a.desdePublicacion ? "(hecho desde una publicación: Meta no le guarda mensaje predeterminado; llega lo que la persona escriba)" : "(sin mensaje predeterminado)") : esGenerico(a.predeterminado) ? "  ⚠️ genérico: no dice de qué anuncio viene" : (veces.get(a.predeterminado) ?? 0) > 1 ? `  ⚠️ repetido en ${veces.get(a.predeterminado)} anuncios` : "";
      L.push(`- **${a.anuncio}** · campaña «${a.campana}»`, `  - Mensaje: ${a.predeterminado ? `«${a.predeterminado}»` : ""}${nota}`);
    }
    L.push("");
  }
  const con = lista.filter((a) => a.predeterminado);
  L.push("## Resumen", `- ${lista.length} anuncios · ${con.length} con mensaje · ${lista.filter((a) => a.desdePublicacion).length} hechos desde una publicación`, `- ${con.filter((a) => esGenerico(a.predeterminado!)).length} genéricos y ${con.filter((a) => (veces.get(a.predeterminado!) ?? 0) > 1).length} repetidos: con esos no se puede saber de qué anuncio vino el lead.`, `- En total hay ${todos.length} anuncios guardados (todos los estados) para buscar con --buscar.`);
  const texto = L.join("\n");
  console.log(texto);
  if (process.argv.includes("--archivo")) {
    mkdirSync("entregables", { recursive: true });
    writeFileSync("entregables/mensajes-predeterminados.md", texto, "utf8");
    const csv = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    writeFileSync("entregables/mensajes-predeterminados-todos.csv", ["cuenta,campaña,anuncio,estado,creado,mensaje predeterminado,mensaje de bienvenida", ...todos.map((a) => [a.cuenta, a.campana, a.anuncio, ESTADO[a.estado] ?? a.estado, a.creado, a.predeterminado, a.bienvenida].map(csv).join(","))].join("\n"), "utf8");
    console.log("\n✓ entregables/mensajes-predeterminados.md (activos) y mensajes-predeterminados-todos.csv (todos)");
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
