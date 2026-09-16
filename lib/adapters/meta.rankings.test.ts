import { describe, expect, test } from "vitest";
import { parsearRankingsMeta, rankingEnPalabras } from "./meta.rankings";

const TEXTO =
  "Cohort Info: Optimization Goal (REPLIES), Optimized Event (onsite_conversion.messaging_deep_conversation), and Audience Type (prospecting (new customers)).\\nAd Relevance Diagnostics:\\n" +
  "- Name: ✅ VENTAS I PUBLICOS FRIOS 🔵 I MARZO I CRIOLIPOLISIS 🟪 I  ANUNCIO PERDEDOR 🟥, ID: 120248267631460151, Type: AD, Quality Ranking: Average, Engagement Rate Ranking: Average, Conversion Rate Ranking: Average, Diagnosis: You are all good!\\n" +
  "- Name: ✅ VENTAS I PUBLICOS FRIOS 🔵 I MARZO I 🟫CRIOLIPOLISIS 🟪 I ANUNCIO I GANADOR❇️, ID: 120256796886300151, Type: AD, Quality Ranking: Above Average, Engagement Rate Ranking: Below Average (Bottom 35% of ads), Conversion Rate Ranking: Below Average (Bottom 20% of ads), Diagnosis: The ad is not spurring interest or producing conversions.\\n" +
  "- Name: 💎13SEP - Testeo lipoz 360, ID: 120257422254350151, Type: AD, Quality Ranking: Not Yet Available, Engagement Rate Ranking: Not Yet Available, Conversion Rate Ranking: Not Yet Available, Diagnosis: Quality, engagement rate, and conversion rate rankings are not yet available.\\n" +
  "\\nCohort Info: Optimization Goal (REPLIES), Optimized Event (onsite_conversion.messaging_deep_conversation), and Audience Type (retargeting (existing customers)).\\nAd Relevance Diagnostics:\\n" +
  "- Name: ✨ 12Sep - Ultraláser - Testeo, ID: 52615851336645, Type: AD, Quality Ranking: Below Average (Bottom 10% of ads), Engagement Rate Ranking: Average, Conversion Rate Ranking: Above Average, Diagnosis: x";

describe("rankings de Meta frente a la competencia en subasta", () => {
  test("lee cada anuncio con sus tres rankings, su cohorte y su diagnóstico", () => {
    const r = parsearRankingsMeta(TEXTO, "act_1", "2026-09-15");
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({ cuentaId: "act_1", anuncioId: "120248267631460151", fecha: "2026-09-15", calidad: "promedio", interaccion: "promedio", conversion: "promedio", cohorte: "mensajes · públicos nuevos" });
    expect(r[1]).toMatchObject({ anuncioId: "120256796886300151", calidad: "superior", interaccion: "inferior_35", conversion: "inferior_20" });
    expect(r[1]!.lecturaMeta).toMatch(/interest|conversions/);
    expect(r[2]).toMatchObject({ calidad: "sin_dato", interaccion: "sin_dato", conversion: "sin_dato" });
    expect(r[3]).toMatchObject({ anuncioId: "52615851336645", calidad: "inferior_10", conversion: "superior", cohorte: "mensajes · públicos que ya conocen la clínica" });
  });
  test("sin datos → lista vacía, sin error", () => {
    expect(parsearRankingsMeta("No auction ranking benchmarks data available for the given criteria.", "act_1", "2026-09-15")).toEqual([]);
  });
  test("acepta el archivo crudo del conector ({result}) y el texto suelto", () => {
    expect(parsearRankingsMeta(JSON.stringify({ result: TEXTO }), "act_1", "2026-09-15")).toHaveLength(4);
  });
  test("en palabras de la clínica, sin jerga", () => {
    expect(rankingEnPalabras("inferior_35")).toBe("por debajo del 65 % de la competencia");
    expect(rankingEnPalabras("superior")).toBe("mejor que la competencia");
    expect(rankingEnPalabras("promedio")).toBe("como la competencia");
    expect(rankingEnPalabras("sin_dato")).toBe("sin dato todavía");
  });
});
