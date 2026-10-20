/**
 * Referentes ORGÁNICOS: últimas publicaciones públicas de cada cuenta de config/organico-referentes.ts
 * por la API oficial de Instagram (Business Discovery), comparadas con Vivante con los mismos números.
 * Lo corre la VPS cada domingo (deploy/oraculo-radar.sh); también a mano.
 *
 *   npm run organico:referentes                → resumen y las 3 mejores publicaciones de cada uno (con enlace)
 *   npm run organico:referentes -- --n 50      → leer más publicaciones por cuenta (25 por defecto)
 *
 * Meta no da alcance ni vistas de cuentas ajenas: solo «me gusta», comentarios, texto, tipo y fecha.
 * Guarda datos/organico-referentes.json (fuera de git).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { cargarEnv } from "@/lib/adapters/env";
import { CUENTA_PROPIA, REFERENTES_ORGANICOS } from "@/config/organico-referentes";
import { resumirCuenta, type PublicacionPublica, type ResumenReferente } from "@/lib/organico/referentes";

cargarEnv();
const token = process.env.META_ORGANICO_TOKEN;
const ig = process.env.META_INSTAGRAM_ID;
const i = process.argv.indexOf("--n");
const n = i >= 0 ? Number(process.argv[i + 1]) || 25 : 25;

async function leer(usuario: string): Promise<ResumenReferente> {
  const campos = `business_discovery.username(${usuario}){followers_count,media.limit(${n}){caption,like_count,comments_count,media_product_type,timestamp,permalink}}`;
  const r = await fetch(`https://graph.facebook.com/v25.0/${ig}?${new URLSearchParams({ fields: campos, access_token: token! })}`);
  const j = (await r.json()) as { business_discovery?: { followers_count: number; media?: { data?: Record<string, unknown>[] } }; error?: { message?: string } };
  if (!j.business_discovery) throw new Error(j.error?.message?.slice(0, 120) ?? "sin datos (¿es cuenta de empresa o creador?)");
  const pubs: PublicacionPublica[] = (j.business_discovery.media?.data ?? []).map((m) => ({
    likes: typeof m.like_count === "number" ? m.like_count : null,
    comentarios: Number(m.comments_count ?? 0),
    tipo: String(m.media_product_type ?? ""),
    fecha: String(m.timestamp ?? ""),
    enlace: String(m.permalink ?? ""),
    texto: String(m.caption ?? "").replace(/\s+/g, " ").slice(0, 160),
  }));
  return resumirCuenta({ usuario, seguidores: j.business_discovery.followers_count }, pubs);
}

async function main() {
  if (!token || !ig) throw new Error("Falta META_ORGANICO_TOKEN o META_INSTAGRAM_ID (conexión del orgánico)");
  const cuentas = [{ usuario: CUENTA_PROPIA, nombre: "Vivante (propia)", ciudad: "Barranquilla", porQue: "" }, ...REFERENTES_ORGANICOS];
  const salida: (ResumenReferente & { nombre: string; ciudad: string; porQue: string })[] = [];
  for (const c of cuentas) {
    try {
      salida.push({ ...(await leer(c.usuario)), nombre: c.nombre, ciudad: c.ciudad, porQue: c.porQue });
    } catch (e) {
      console.log(`✗ @${c.usuario}: ${(e as Error).message}`);
    }
  }
  mkdirSync("datos", { recursive: true });
  writeFileSync("datos/organico-referentes.json", JSON.stringify({ capturadoEn: new Date().toISOString(), publicacionesPorCuenta: n, cuentas: salida }, null, 2));
  const fmt = (x: number | null) => (x == null ? "—" : Math.round(x).toLocaleString("es-CO"));
  console.log(`Referentes orgánicos · Instagram (API oficial) · últimas ${n} publicaciones de cada cuenta · ${new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}\n`);
  for (const r of [...salida].sort((a, b) => (b.medianaComentarios ?? 0) - (a.medianaComentarios ?? 0))) {
    console.log(`@${r.usuario}${r.usuario === CUENTA_PROPIA ? " (VIVANTE)" : ""} · ${r.nombre} · ${r.ciudad} · ${fmt(r.seguidores)} seguidores · mediana ${fmt(r.medianaMeGusta)} me gusta / ${fmt(r.medianaComentarios)} comentarios · ${r.porSemana ?? "—"} posts/semana · ${r.parteReels == null ? "—" : Math.round(r.parteReels * 100)} % reels`);
  }
  console.log("\nLas 3 mejores de cada cuenta (comentarios pesan triple):");
  for (const r of salida) {
    console.log(`\n@${r.usuario}`);
    for (const p of r.mejores) console.log(`  ${fmt(p.likes)} me gusta · ${p.comentarios} com. · ${p.tipo} · ${p.fecha.slice(0, 10)} · ${p.texto.slice(0, 110)}\n    ${p.enlace}`);
  }
  console.log("\n✓ datos/organico-referentes.json");
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
