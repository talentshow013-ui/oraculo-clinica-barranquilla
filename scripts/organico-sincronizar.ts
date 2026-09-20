/**
 * Trae el orgánico (Instagram y Facebook sin pauta) desde la Graph API de Meta a
 * `datos/organico.json`. Lo corre el reloj diario en la VPS y cualquiera a mano.
 *
 *   npm run organico:sincronizar                 → últimos 30 días (incremental: conserva lo anterior)
 *   npm run organico:sincronizar -- --dias 90    → primera vez: 90 días hacia atrás
 *
 * Necesita en .env: META_ORGANICO_TOKEN, META_PAGINA_ID y/o META_INSTAGRAM_ID (los deja
 * `npm run organico:conectar`). Si Meta retiró una métrica, se anota como aviso y el resto sigue.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { cargarEnv } from "@/lib/adapters/env";
import { RUTA_ORGANICO, parsearOrganico } from "@/lib/adapters/organico.archivo";
import { crearPeticion, fusionarLotes, sincronizarOrganico } from "@/lib/adapters/organico.graph";
import { guardarMiniaturas } from "@/lib/adapters/organico.miniaturas";
import { LoteOrganicoSchema } from "@/lib/adapters/types";
import { hoyBogota, sumarDias } from "@/lib/format/fechas";
import { validarSinPII } from "@/lib/privacy";

cargarEnv();
const iDias = process.argv.indexOf("--dias");
const dias = iDias >= 0 ? Number(process.argv[iDias + 1]) : 30;
const token = process.env.META_ORGANICO_TOKEN;
const paginaId = process.env.META_PAGINA_ID || null;
const instagramId = process.env.META_INSTAGRAM_ID || null;
if (!token || (!paginaId && !instagramId)) {
  console.error("✗ Falta la conexión del orgánico en .env. Corre primero: npm run organico:conectar -- <token>  (docs/CONEXION_ORGANICO.md)");
  process.exit(1);
}

async function main() {
  const hasta = sumarDias(hoyBogota(), -1);
  const desde = sumarDias(hasta, -(Number.isFinite(dias) && dias > 0 ? dias : 30) + 1);
  console.log(`· Orgánico ${desde} → ${hasta}${instagramId ? " · Instagram" : ""}${paginaId ? " · Facebook" : ""}`);
  const nuevo = await sincronizarOrganico({ pedir: crearPeticion(token!), instagramId, paginaId, desde, hasta });
  const viejo = existsSync(RUTA_ORGANICO) ? parsearOrganico(readFileSync(RUTA_ORGANICO, "utf8")) : null;
  const lote = LoteOrganicoSchema.parse(validarSinPII(fusionarLotes(viejo, nuevo)));
  const mini = await guardarMiniaturas(lote);
  console.log(`✓ Imágenes de las publicaciones: ${mini.nuevas} nuevas guardadas${mini.fallidas ? ` · ${mini.fallidas} no se pudieron bajar` : ""}`);
  mkdirSync(dirname(RUTA_ORGANICO), { recursive: true });
  writeFileSync(RUTA_ORGANICO, JSON.stringify(lote, null, 2), "utf8");
  for (const c of lote.cuentas) console.log(`✓ ${c.red === "instagram" ? "Instagram @" : "Facebook "}${c.alias}: ${c.seguidores?.toLocaleString("es-CO") ?? "—"} seguidores`);
  console.log(`✓ ${nuevo.publicaciones.length} publicaciones nuevas o actualizadas · ${lote.publicaciones.length} en total (${lote.meta.desde} → ${lote.meta.hasta}) · ${lote.dias.length} días de serie`);
  for (const a of lote.meta.avisos) console.log(`· ${a}`);
  console.log(`✓ Escrito ${RUTA_ORGANICO}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
