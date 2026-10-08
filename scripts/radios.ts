/**
 * El «kilometraje» y la segmentación de cada conjunto ACTIVO, en vivo desde Meta: a cuántos km de la
 * clínica llega, quiénes, edad, género y si Advantage+ está encendido. Para comprobar de verdad que
 * un cambio quedó hecho (nunca «ya quedó» sin mirarlo aquí).
 *
 *   npm run radios                  → todas las cuentas
 *   npm run radios -- --cuenta F3   → una cuenta (parte del nombre)
 */
import { cargarEnv } from "@/lib/adapters/env";
import { cliente } from "@/config/cliente";
import { resumirSegmentacion, type TargetingMeta } from "@/lib/adapters/meta.segmentacion";
import { cop } from "@/lib/format";

cargarEnv();
const token = process.env.META_ORGANICO_TOKEN;
if (!token) {
  console.error("✗ Falta META_ORGANICO_TOKEN en .env");
  process.exit(1);
}
const iC = process.argv.indexOf("--cuenta");
const filtro = iC >= 0 ? process.argv[iC + 1]?.toLowerCase() : undefined;

interface Conjunto { id: string; name: string; daily_budget?: string; targeting?: TargetingMeta }

async function conjuntos(cuenta: string): Promise<Conjunto[]> {
  const salida: Conjunto[] = [];
  let url: string | undefined = `https://graph.facebook.com/v25.0/${cuenta}/adsets?${new URLSearchParams({ fields: "name,daily_budget,targeting{geo_locations,age_min,age_max,genders,targeting_automation}", effective_status: '["ACTIVE"]', limit: "100", access_token: token! })}`;
  for (let i = 0; url && i < 10; i++) {
    const j = (await (await fetch(url)).json()) as { data?: Conjunto[]; paging?: { next?: string }; error?: { message: string } };
    if (j.error) throw new Error(j.error.message);
    salida.push(...(j.data ?? []));
    url = j.paging?.next;
  }
  return salida;
}

async function main() {
  for (const c of cliente.cuentasPublicitarias.filter((x) => (x.plataforma ?? "meta") === "meta" && (!filtro || x.nombre.toLowerCase().includes(filtro)))) {
    const lista = await conjuntos(c.id);
    console.log(`\n${c.nombre} · ${lista.length} conjuntos activos`);
    const porRadio = new Map<string, number>();
    for (const x of lista) {
      const s = resumirSegmentacion(x.targeting ?? {});
      const r = s.radioKm == null ? "sin radio" : `${Math.round(s.radioKm * 10) / 10} km`;
      porRadio.set(r, (porRadio.get(r) ?? 0) + 1);
      console.log(`  ${r.padEnd(9)} · ${s.quienes} · ${s.edad} · ${s.generos} · Advantage+ ${s.advantagePlus ? "SÍ" : "no"}${x.daily_budget ? ` · ${cop(Number(x.daily_budget))}/día` : ""} · ${x.name.slice(0, 60)}`);
    }
    console.log(`  Resumen: ${[...porRadio.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${n} a ${r}`).join(" · ")}`);
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
