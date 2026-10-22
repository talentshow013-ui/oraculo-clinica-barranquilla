/**
 * Cualquier periodo de pauta de Meta, directo de la API y ya sumado (segundos), y la comparación con otro.
 * No depende del historial de datos/lote.json: Meta guarda 37 meses.
 *
 *   npm run periodo -- --mes 2026-05                              → mayo, por cuenta y campaña
 *   npm run periodo -- --mes 2026-05 --vs-ultimos 31              → mayo contra los últimos 31 días
 *   npm run periodo -- --mes 2026-05 --vs-mes 2026-09             → mayo contra septiembre
 *   npm run periodo -- --desde 2026-05-01 --hasta 2026-05-15 --vs-anterior   → contra el tramo igual de antes
 *   npm run periodo -- --mes 2026-05 --vs-desde 2026-09-01 --vs-hasta 2026-09-30
 *   opciones: --cuenta "F3" (solo esa) · --json
 *
 * Resultado = columna «Resultados» de Meta, igual que `npm run hoy`. El token vive en .env y no se imprime.
 */
import { cargarEnv } from "@/lib/adapters/env";
import { cliente } from "@/config/cliente";
import { mapearInsightMeta, urlInsightsPeriodo, type FilaInsight } from "@/lib/adapters/meta.ads";
import { cop, num } from "@/lib/format";
import { diasEntre, hoyBogota, sumarDias } from "@/lib/format/fechas";
import { compararPeriodos, rangoDeMes, rangoUltimos, sumar, type Cifras, type FilaPeriodo } from "@/lib/metrics/periodo";

cargarEnv();
const token = process.env.META_ORGANICO_TOKEN;
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
type Rango = { desde: string; hasta: string };

function rangoPrincipal(hoy: string): Rango {
  if (arg("--mes")) return rangoDeMes(arg("--mes")!, hoy);
  if (arg("--desde") && FECHA.test(arg("--desde")!)) return { desde: arg("--desde")!, hasta: arg("--hasta") && FECHA.test(arg("--hasta")!) ? arg("--hasta")! : hoy };
  if (arg("--ultimos")) return rangoUltimos(Number(arg("--ultimos")) || 30, hoy);
  throw new Error('Falta el periodo: --mes 2026-05 | --desde AAAA-MM-DD --hasta AAAA-MM-DD | --ultimos 30');
}

function rangoComparado(a: Rango, hoy: string): Rango | null {
  if (arg("--vs-mes")) return rangoDeMes(arg("--vs-mes")!, hoy);
  if (arg("--vs-ultimos")) return rangoUltimos(Number(arg("--vs-ultimos")) || 30, hoy);
  if (arg("--vs-desde") && FECHA.test(arg("--vs-desde")!)) return { desde: arg("--vs-desde")!, hasta: arg("--vs-hasta") && FECHA.test(arg("--vs-hasta")!) ? arg("--vs-hasta")! : hoy };
  if (process.argv.includes("--vs-anterior")) {
    const largo = diasEntre(a.desde, a.hasta) + 1;
    return { desde: sumarDias(a.desde, -largo), hasta: sumarDias(a.desde, -1) };
  }
  return null;
}

async function traer(r: Rango): Promise<FilaPeriodo[]> {
  const filtro = arg("--cuenta")?.toLowerCase();
  const cuentas = cliente.cuentasPublicitarias.filter((c) => (c.plataforma ?? "meta") === "meta" && (!filtro || c.nombre.toLowerCase().includes(filtro)));
  const salida: FilaPeriodo[] = [];
  await Promise.all(
    cuentas.map(async (c) => {
      let url: string | undefined = urlInsightsPeriodo(c.id, "campaign", r, token!);
      while (url) {
        const j = (await (await fetch(url)).json()) as { data?: FilaInsight[]; paging?: { next?: string }; error?: { message?: string } };
        if (j.error) throw new Error(`${c.nombre}: Meta respondió ${j.error.message}`);
        for (const f of j.data ?? []) {
          const m = mapearInsightMeta({ ...f, date_start: r.desde }, { cuentaId: c.id, nivel: "campana", estado: "activo" });
          salida.push({ cuenta: c.nombre, campanaId: m.id, campana: m.nombre, gasto: m.gasto, resultados: m.resultados ?? 0, tipoResultado: m.tipoResultado ?? null, impresiones: m.impresiones, clics: m.clics });
        }
        url = j.paging?.next;
      }
    }),
  );
  return salida;
}

const txt = (c: Cifras | null) => (c ? `${cop(c.gasto)} · ${num(c.resultados)} resultados · ${c.costoPorResultado == null ? "—" : cop(c.costoPorResultado)} c/u` : "no corrió");
const cambio = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null || !b ? "" : ` (${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)} %)`);

async function main() {
  if (!token) throw new Error("Falta META_ORGANICO_TOKEN (conexión de Meta)");
  const hoy = hoyBogota();
  const a = rangoPrincipal(hoy);
  const b = rangoComparado(a, hoy);
  const [fa, fb] = await Promise.all([traer(a), b ? traer(b) : Promise.resolve([])]);
  if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(b ? { rangoA: a, rangoB: b, ...compararPeriodos(fa, fb) } : { rango: a, total: sumar(fa), filas: fa }, null, 2));
    return;
  }
  console.log(`Pauta de Meta · fuente: API de Meta (columna Resultados) · ${a.desde} → ${a.hasta}${b ? `  vs  ${b.desde} → ${b.hasta}` : ""}`);
  if (!b) {
    const t = sumar(fa);
    console.log(`\nTOTAL: ${txt(t)}`);
    for (const cuenta of [...new Set(fa.map((x) => x.cuenta))]) {
      const del = fa.filter((x) => x.cuenta === cuenta);
      console.log(`\n${cuenta}: ${txt(sumar(del))}`);
      for (const x of [...del].sort((p, q) => q.gasto - p.gasto)) console.log(`  · ${x.campana}: ${txt(sumar([x]))}`);
    }
    return;
  }
  const r = compararPeriodos(fa, fb);
  const A = `${a.desde.slice(5)}→${a.hasta.slice(5)}`;
  const B = `${b.desde.slice(5)}→${b.hasta.slice(5)}`;
  console.log(`\nTOTAL  ${A}: ${txt(r.a)}\n       ${B}: ${txt(r.b)}`);
  console.log(`       cambio del segundo frente al primero: gasto${cambio(r.b.gasto, r.a.gasto)} · resultados${cambio(r.b.resultados, r.a.resultados)} · costo por resultado${cambio(r.b.costoPorResultado, r.a.costoPorResultado)}`);
  for (const c of r.porCuenta) console.log(`\n${c.cuenta}\n  ${A}: ${txt(c.a)}\n  ${B}: ${txt(c.b)}`);
  console.log(`\nPor campaña (más gasto primero):`);
  for (const c of r.campanas) console.log(`  · ${c.cuenta} · ${c.campana}\n      ${A}: ${txt(c.a)}\n      ${B}: ${txt(c.b)}${c.a && c.b ? `  → costo por resultado${cambio(c.b.costoPorResultado, c.a.costoPorResultado)}` : ""}`);
  const soloA = r.campanas.filter((c) => c.a && !c.b).length;
  const soloB = r.campanas.filter((c) => c.b && !c.a).length;
  console.log(`\n${soloA} campañas corrieron solo en ${A} y ${soloB} solo en ${B}.`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
