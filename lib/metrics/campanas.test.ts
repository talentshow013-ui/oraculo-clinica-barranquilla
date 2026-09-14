import { describe, expect, test } from "vitest";
import { fila as filaBase } from "@/lib/diagnostics/fixtures";
import { compararCampanas, resumirCampanas } from "./campanas";

/** Filas de nivel campaña, un día cada una. */
const fila = (id: string, fecha: string, extra: Partial<Parameters<typeof filaBase>[0]> = {}) =>
  filaBase({ nivel: "campana", id, nombre: `Campaña ${id}`, padreId: null, fecha, gasto: 100_000, impresiones: 10_000, clics: 200, clicsEnlace: 150, resultados: 10, conversacionesIniciadas: 10, estado: "activo", ...extra });

describe("resumirCampanas — cada pauta con cara propia, viva o terminada", () => {
  test("agrupa por campaña y suma crudos; las razones se recalculan desde las sumas", () => {
    const filas = [fila("A", "2026-09-01"), fila("A", "2026-09-02", { gasto: 50_000, resultados: 5 }), fila("B", "2026-09-02")];
    const r = resumirCampanas(filas, { desde: "2026-09-01", hasta: "2026-09-02" });
    expect(r.map((c) => c.id).sort()).toEqual(["A", "B"]);
    const a = r.find((c) => c.id === "A")!;
    expect(a.total.gasto).toBe(150_000);
    expect(a.total.resultados).toBe(15);
    expect(a.costoResultado).toBe(10_000);
    expect(a.diasConGasto).toBe(2);
  });

  test("primer y último día con gasto; sin gasto un día no cuenta", () => {
    const filas = [fila("A", "2026-08-01"), fila("A", "2026-08-05"), fila("A", "2026-08-09", { gasto: 0, impresiones: 0, clics: 0, clicsEnlace: 0, resultados: 0, conversacionesIniciadas: 0 })];
    const [a] = resumirCampanas(filas, { desde: "2026-08-01", hasta: "2026-08-10" });
    expect(a!.primerDia).toBe("2026-08-01");
    expect(a!.ultimoDia).toBe("2026-08-05");
    expect(a!.diasConGasto).toBe(2);
  });

  test("alAire = activa Y con gasto en los últimos 3 días del periodo; una pausada nunca está al aire", () => {
    const filas = [fila("viva", "2026-09-12"), fila("vieja", "2026-08-01"), fila("pausada", "2026-09-12", { estado: "pausado" })];
    const r = resumirCampanas(filas, { desde: "2026-08-01", hasta: "2026-09-12" });
    const por = Object.fromEntries(r.map((c) => [c.id, c]));
    expect(por["viva"]!.alAire).toBe(true);
    expect(por["vieja"]!.alAire).toBe(false);
    expect(por["pausada"]!.alAire).toBe(false);
    expect(por["pausada"]!.estado).toBe("pausado");
  });

  test("el estado es el de la fila más reciente (la plataforma reporta el estado actual)", () => {
    const filas = [fila("A", "2026-09-01", { estado: "activo" }), fila("A", "2026-09-05", { estado: "archivado" })];
    const [a] = resumirCampanas(filas, { desde: "2026-09-01", hasta: "2026-09-05" });
    expect(a!.estado).toBe("archivado");
  });

  test("participación del gasto suma 1 entre las campañas del periodo", () => {
    const filas = [fila("A", "2026-09-01", { gasto: 300_000 }), fila("B", "2026-09-01", { gasto: 100_000 })];
    const r = resumirCampanas(filas, { desde: "2026-09-01", hasta: "2026-09-01" });
    const por = Object.fromEntries(r.map((c) => [c.id, c.participacionGasto]));
    expect(por["A"]).toBeCloseTo(0.75);
    expect(por["B"]).toBeCloseTo(0.25);
  });

  test("respeta el periodo: lo que queda fuera no se suma ni aparece", () => {
    const filas = [fila("A", "2026-07-01"), fila("A", "2026-09-01"), fila("vieja", "2026-06-01")];
    const r = resumirCampanas(filas, { desde: "2026-08-01", hasta: "2026-09-12" });
    expect(r).toHaveLength(1);
    expect(r[0]!.total.gasto).toBe(100_000);
  });

  test("ordena por gasto descendente y sin gasto en cero: null se muestra como «—», no como 0", () => {
    const filas = [fila("chica", "2026-09-01", { gasto: 10_000 }), fila("grande", "2026-09-01", { gasto: 900_000, resultados: 0, conversacionesIniciadas: 0 })];
    const r = resumirCampanas(filas, { desde: "2026-09-01", hasta: "2026-09-01" });
    expect(r[0]!.id).toBe("grande");
    expect(r[0]!.costoResultado).toBeNull();
  });

  test("si la fuente no trae nivel campaña, agrupa conjuntos por su padre", () => {
    const filas = [
      filaBase({ nivel: "conjunto", id: "s1", padreId: "C1", fecha: "2026-09-01", gasto: 100, impresiones: 10, clics: 1, clicsEnlace: 1, resultados: 1 }),
      filaBase({ nivel: "conjunto", id: "s2", padreId: "C1", fecha: "2026-09-01", gasto: 100, impresiones: 10, clics: 1, clicsEnlace: 1, resultados: 1 }),
      filaBase({ nivel: "anuncio", id: "ad1", padreId: "s1", fecha: "2026-09-01", gasto: 200, impresiones: 20, clics: 2, clicsEnlace: 2, resultados: 2 }),
    ];
    const r = resumirCampanas(filas, { desde: "2026-09-01", hasta: "2026-09-01" });
    expect(r).toHaveLength(1);
    expect(r[0]!.id).toBe("C1");
    expect(r[0]!.total.gasto).toBe(200); // no suma conjunto + anuncio
  });

  test("cuenta conjuntos y anuncios hijos cuando vienen en las filas", () => {
    const filas = [
      fila("C1", "2026-09-01"),
      filaBase({ nivel: "conjunto", id: "s1", padreId: "C1", fecha: "2026-09-01" }),
      filaBase({ nivel: "anuncio", id: "a1", padreId: "s1", fecha: "2026-09-01" }),
      filaBase({ nivel: "anuncio", id: "a2", padreId: "s1", fecha: "2026-09-01" }),
    ];
    const [c] = resumirCampanas(filas, { desde: "2026-09-01", hasta: "2026-09-01" });
    expect(c!.nConjuntos).toBe(1);
    expect(c!.nAnuncios).toBe(2);
  });
});

describe("compararCampanas — dos pautas lado a lado, cada una en sus propios días", () => {
  test("devuelve delta por métrica y avisa cuando los días de pauta difieren", () => {
    const filas = [fila("A", "2026-09-01", { gasto: 100_000, resultados: 10 }), fila("A", "2026-09-02", { gasto: 100_000, resultados: 10 }), fila("B", "2026-09-01", { gasto: 100_000, resultados: 5 })];
    const [a, b] = resumirCampanas(filas, { desde: "2026-09-01", hasta: "2026-09-02" });
    const c = compararCampanas(a!, b!);
    const cpr = c.metricas.find((m) => m.id === "costo_resultado")!;
    expect(cpr.a).toBe(10_000);
    expect(cpr.b).toBe(20_000);
    expect(cpr.delta).toBeCloseTo(1); // B cuesta el doble
    expect(cpr.mejorEs).toBe("menor");
    expect(c.diasDistintos).toBe(true);
    expect(c.aviso).toMatch(/días/i);
  });

  test("con los mismos días no avisa", () => {
    const filas = [fila("A", "2026-09-01"), fila("B", "2026-09-01")];
    const [a, b] = resumirCampanas(filas, { desde: "2026-09-01", hasta: "2026-09-01" });
    const c = compararCampanas(a!, b!);
    expect(c.diasDistintos).toBe(false);
    expect(c.aviso).toBeNull();
  });

  test("las sumas (inversión, resultados) se marcan como no comparables si los días difieren; las razones sí", () => {
    const filas = [fila("A", "2026-09-01"), fila("A", "2026-09-02"), fila("B", "2026-09-01")];
    const [a, b] = resumirCampanas(filas, { desde: "2026-09-01", hasta: "2026-09-02" });
    const c = compararCampanas(a!, b!);
    expect(c.metricas.find((m) => m.id === "gasto")!.comparable).toBe(false);
    expect(c.metricas.find((m) => m.id === "costo_resultado")!.comparable).toBe(true);
  });
});
