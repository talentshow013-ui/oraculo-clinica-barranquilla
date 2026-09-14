import { describe, expect, test } from "vitest";
import { benchmarks } from "@/config/benchmarks";
import { creativo, fila } from "@/lib/diagnostics/fixtures";
import type { EvaluacionCreativo } from "@/lib/metrics/creative";
import { resumirCampanas, type ResumenCampana } from "./campanas";
import { compararVarias, creativosDeCampana, veredictoCampana } from "./veredicto";

const camp = (id: string, gasto: number, extra: Partial<ResumenCampana> = {}): ResumenCampana => {
  const base = resumirCampanas([fila({ nivel: "campana", id, nombre: `Campaña ${id}`, padreId: null, fecha: "2026-09-01", gasto, impresiones: 10_000, clics: 300, clicsEnlace: 200, resultados: 20, conversacionesIniciadas: 20 })], { desde: "2026-09-01", hasta: "2026-09-01" })[0]!;
  return { ...base, ...extra };
};

describe("compararVarias — las campañas que uno escoja, lado a lado", () => {
  test("una fila por métrica con el valor de cada campaña, la mejor marcada y la diferencia frente a la mejor", () => {
    const a = camp("A", 100_000, { costoResultado: 5_000, costoCitaAsistida: 30_000, citasAsistidas: 10 });
    const b = camp("B", 100_000, { costoResultado: 4_000, costoCitaAsistida: 50_000, citasAsistidas: 6 });
    const c = camp("C", 100_000, { costoResultado: 6_000, costoCitaAsistida: null, citasAsistidas: null });
    const r = compararVarias([a, b, c]);
    expect(r.campanas.map((x) => x.id)).toEqual(["A", "B", "C"]);
    const cpr = r.metricas.find((m) => m.id === "costo_resultado")!;
    expect(cpr.valores).toEqual([5_000, 4_000, 6_000]);
    expect(cpr.mejorIndice).toBe(1);
    expect(cpr.deltasFrenteAlMejor[0]).toBeCloseTo(0.25);
    expect(cpr.deltasFrenteAlMejor[1]).toBe(0);
    const cca = r.metricas.find((m) => m.id === "costo_cita_asistida")!;
    expect(cca.mejorIndice).toBe(0);
    expect(cca.valores[2]).toBeNull();
    expect(cca.deltasFrenteAlMejor[2]).toBeNull();
  });

  test("las sumas no se comparan cuando los días de pauta difieren; con los mismos días sí", () => {
    const a = camp("A", 100_000);
    const b = { ...camp("B", 100_000), diasConGasto: 30 };
    const r = compararVarias([a, b]);
    expect(r.diasDistintos).toBe(true);
    expect(r.metricas.find((m) => m.id === "gasto")!.comparable).toBe(false);
    const res = r.metricas.find((m) => m.id === "resultados")!;
    expect(res.comparable).toBe(false);
    expect(res.mejorIndice).toBeNull(); // una suma con días distintos no tiene "mejor"
    expect(res.deltasFrenteAlMejor.every((d) => d === null)).toBe(true);
    expect(r.metricas.find((m) => m.id === "costo_resultado")!.comparable).toBe(true);
    expect(r.aviso).toMatch(/días/);
    expect(compararVarias([a, camp("C", 50_000)]).diasDistintos).toBe(false);
  });

  test("con una sola campaña o ninguna no hay comparación", () => {
    expect(compararVarias([camp("A", 1)]).metricas).toEqual([]);
    expect(compararVarias([]).campanas).toEqual([]);
  });

  test("las métricas informativas no marcan mejor", () => {
    const r = compararVarias([camp("A", 100_000), camp("B", 200_000)]);
    expect(r.metricas.find((m) => m.id === "gasto")!.mejorIndice).toBeNull();
  });
});

describe("veredictoCampana — ¿sirvió o no, y por qué?", () => {
  const otras = [camp("X", 100_000, { costoConversacion: 5_000, costoCitaAsistida: 40_000, citasAgendadas: 20, citasAsistidas: 15, ventas: 6 }), camp("Y", 100_000, { costoConversacion: 6_000, costoCitaAsistida: 45_000, citasAgendadas: 20, citasAsistidas: 14, ventas: 5 })];

  test("sin resultados registrados → sin veredicto de negocio, pero sí de pauta (costo por conversación)", () => {
    const c = camp("A", 100_000, { costoConversacion: 4_000, citasAsistidas: null, costoCitaAsistida: null });
    const v = veredictoCampana(c, [c, ...otras], benchmarks);
    expect(v.veredicto).toBe("sin_resultados");
    expect(v.razones.some((r) => /conversación/i.test(r))).toBe(true);
    expect(v.faltan).toMatch(/Resultados/);
  });

  test("mejor costo por cita que las demás, buena asistencia y cierre → sirvió", () => {
    const c = camp("A", 100_000, { costoConversacion: 4_000, citasAgendadas: 20, citasAsistidas: 16, ventas: 8, costoCitaAsistida: 25_000 });
    const v = veredictoCampana(c, [c, ...otras], benchmarks);
    expect(v.veredicto).toBe("sirvio");
    expect(v.razones.length).toBeGreaterThanOrEqual(2);
    expect(v.razones.join(" ")).toMatch(/cita asistida/);
    expect(v.razones.join(" ")).toMatch(/asist/i);
  });

  test("costo por cita muy por encima de las demás y asistencia baja → no sirvió, con las razones", () => {
    const c = camp("A", 100_000, { costoConversacion: 9_000, citasAgendadas: 20, citasAsistidas: 8, ventas: 2, costoCitaAsistida: 90_000 });
    const v = veredictoCampana(c, [c, ...otras], benchmarks);
    expect(v.veredicto).toBe("no_sirvio");
    expect(v.razones.join(" ")).toMatch(/más car/);
    expect(v.razones.join(" ")).toMatch(/asist/i);
  });

  test("señales mezcladas → a medias", () => {
    const c = camp("A", 100_000, { costoConversacion: 4_000, citasAgendadas: 20, citasAsistidas: 10, ventas: 5, costoCitaAsistida: 30_000 });
    const v = veredictoCampana(c, [c, ...otras], benchmarks);
    expect(v.veredicto).toBe("a_medias");
  });

  test("única campaña de la cuenta: se juzga contra los umbrales, no contra otras", () => {
    const c = camp("A", 100_000, { citasAgendadas: 20, citasAsistidas: 16, ventas: 8, costoCitaAsistida: 25_000 });
    const v = veredictoCampana(c, [c], benchmarks);
    expect(v.veredicto).toBe("sirvio");
    expect(v.razones.join(" ")).not.toMatch(/otras campañas/);
  });
});

describe("creativosDeCampana — qué funcionó de lo que se subió", () => {
  test("mapea anuncio → conjunto → campaña y devuelve cada creativo con su cuadrante y acción, ordenados por inversión", () => {
    const insights = [
      fila({ nivel: "conjunto", id: "s1", padreId: "campA", fecha: "2026-09-01" }),
      fila({ nivel: "anuncio", id: "ad1", padreId: "s1", fecha: "2026-09-01", gasto: 100 }),
      fila({ nivel: "anuncio", id: "ad2", padreId: "s1", fecha: "2026-09-01", gasto: 300 }),
      fila({ nivel: "anuncio", id: "ad9", padreId: "s9", fecha: "2026-09-01", gasto: 999 }), // otra campaña
    ];
    const ev = (anuncioId: string, cuadrante: EvaluacionCreativo["cuadrante"], gasto: number): EvaluacionCreativo => ({
      creativo: creativo({ anuncioId, id: `cr_${anuncioId}` }),
      agregado: { gasto } as EvaluacionCreativo["agregado"],
      hookRate: 0.3, holdRate: 0.1, ctrEnlace: 0.01, costoResultado: 4_000, cuadrante, accion: "x", fatiga: { indice: null, ctrMejorVentana: null, ctrReciente: null, frecuenciaReciente: null } as EvaluacionCreativo["fatiga"], vidaUtilDias: null, diasActivo: 10,
    });
    const r = creativosDeCampana("campA", insights, [ev("ad1", "escalar", 100), ev("ad2", "matar", 300), ev("ad9", "escalar", 999)]);
    expect(r.map((c) => c.anuncioId)).toEqual(["ad2", "ad1"]);
    expect(r[1]!.lectura).toMatch(/funcion/i);
    expect(r[0]!.lectura).toMatch(/no/i);
  });
});
