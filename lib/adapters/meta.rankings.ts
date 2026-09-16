/**
 * Ranking de cada anuncio frente a los que compiten por el mismo público, según Meta
 * (`ads_insights_auction_ranking_benchmarks`). Es la única comparación con el mercado que entrega
 * la plataforma: calidad, tasa de interacción y tasa de conversión, en tramos («promedio»,
 * «inferior 35 %»...). El conector lo devuelve como texto; aquí se convierte al contrato.
 */
import type { NivelRanking, RankingAnuncio } from "@/lib/adapters/types";

const TRAMO: ReadonlyArray<[RegExp, NivelRanking]> = [
  [/above average/i, "superior"],
  [/bottom 10%/i, "inferior_10"],
  [/bottom 20%/i, "inferior_20"],
  [/bottom 35%/i, "inferior_35"],
  [/below average/i, "inferior_35"],
  [/^average/i, "promedio"],
];

function nivel(texto: string | undefined): NivelRanking {
  const t = (texto ?? "").trim();
  if (!t || /not yet available/i.test(t)) return "sin_dato";
  for (const [re, n] of TRAMO) if (re.test(t)) return n;
  return "sin_dato";
}

/** La cohorte en palabras de la clínica: objetivo y tipo de público con el que Meta compara. */
function cohorteEnPalabras(linea: string): string {
  const objetivo = /Optimization Goal \(([^)]+)\)/.exec(linea)?.[1] ?? "";
  const publico = /Audience Type \(([a-z]+)/i.exec(linea)?.[1]?.toLowerCase() ?? "";
  const obj = /REPLIES|MESSAG|CONVERSATION/i.test(objetivo) ? "mensajes" : /LEAD/i.test(objetivo) ? "formularios" : /CONVERSION|PURCHASE/i.test(objetivo) ? "ventas" : /LINK|CLICK|TRAFFIC/i.test(objetivo) ? "clics" : objetivo.toLowerCase() || "sin objetivo";
  const pub = publico === "prospecting" ? "públicos nuevos" : publico === "retargeting" ? "públicos que ya conocen la clínica" : publico || "público sin clasificar";
  return `${obj} · ${pub}`;
}

/** Acepta el archivo crudo ({result: "..."}) o el texto tal cual; sin datos devuelve []. */
export function parsearRankingsMeta(contenido: string, cuentaId: string, fecha: string): RankingAnuncio[] {
  let texto = contenido;
  try {
    const obj = JSON.parse(contenido) as { result?: unknown };
    if (obj && typeof obj === "object" && typeof obj.result === "string") texto = obj.result;
  } catch {
    /* texto suelto */
  }
  const lineas = texto.replace(/\\n/g, "\n").split("\n");
  const salida: RankingAnuncio[] = [];
  let cohorte = "sin cohorte";
  for (const linea of lineas) {
    if (/^Cohort Info:/i.test(linea)) {
      cohorte = cohorteEnPalabras(linea);
      continue;
    }
    const m = /^- Name: (.*?), ID: (\d+), Type: AD, Quality Ranking: (.*?), Engagement Rate Ranking: (.*?), Conversion Rate Ranking: (.*?), Diagnosis: (.*)$/.exec(linea.trim());
    if (!m) continue;
    salida.push({
      fuente: "meta",
      cuentaId,
      anuncioId: m[2]!,
      nombre: m[1]!.trim(),
      fecha,
      cohorte,
      calidad: nivel(m[3]),
      interaccion: nivel(m[4]),
      conversion: nivel(m[5]),
      lecturaMeta: m[6]!.trim(),
    });
  }
  return salida;
}

/** Cómo se lee cada tramo, sin jerga. */
export function rankingEnPalabras(n: NivelRanking): string {
  switch (n) {
    case "superior":
      return "mejor que la competencia";
    case "promedio":
      return "como la competencia";
    case "inferior_35":
      return "por debajo del 65 % de la competencia";
    case "inferior_20":
      return "por debajo del 80 % de la competencia";
    case "inferior_10":
      return "por debajo del 90 % de la competencia";
    default:
      return "sin dato todavía";
  }
}

export const ES_INFERIOR = (n: NivelRanking): boolean => n === "inferior_35" || n === "inferior_20" || n === "inferior_10";
