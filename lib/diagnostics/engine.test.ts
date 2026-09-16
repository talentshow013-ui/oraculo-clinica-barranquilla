import { describe, expect, test } from "vitest";
import type { LoteDatos } from "@/lib/adapters/types";
import { cliente } from "@/config/cliente";
import { benchmarks } from "@/config/benchmarks";
import { construirContexto, ejecutarReglas, type Hallazgo, type Regla } from "@/lib/diagnostics/engine";

const loteVacio: LoteDatos = {
  insights: [],
  desgloses: [],
  creativos: [],
  embudo: [],
  competidores: [],
  anunciosCompetencia: [],
  experimentos: [],
  meta: { generadoEn: "2026-09-13T10:00:00-05:00", desde: "2026-08-01", hasta: "2026-09-12", origen: "seed", huecos: [], advertencias: [] },
};

function hallazgo(id: string, plata: number | null): Hallazgo {
  return {
    reglaId: id,
    area: "entrega",
    severidad: "media",
    titulo: `Hallazgo ${id}`,
    explicacion: "x",
    evidencia: [{ etiqueta: "dato", valor: "1" }],
    acciones: ["hacer algo"],
    plataEnRiesgo: plata,
    metricas: [],
    fuente: { origen: "prueba", desde: "2026-08-01", hasta: "2026-09-12", registros: 1, metodo: "fijado a mano para la prueba", enlace: "/rendimiento" },
  };
}

describe("ejecutarReglas", () => {
  const ctx = construirContexto(loteVacio, cliente, benchmarks, "2026-09-12");

  test("una regla que lanza no tumba las demás y queda registrada", () => {
    const reglas: Regla[] = [
      { id: "R_OK", area: "entrega", evaluar: () => hallazgo("R_OK", 100) },
      {
        id: "R_BOOM",
        area: "entrega",
        evaluar: () => {
          throw new Error("explotó");
        },
      },
      { id: "R_OK2", area: "entrega", evaluar: () => hallazgo("R_OK2", 200) },
    ];
    const r = ejecutarReglas(ctx, reglas);
    expect(r.hallazgos).toHaveLength(2);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]?.reglaId).toBe("R_BOOM");
    expect(r.errores[0]?.mensaje).toContain("explotó");
  });

  test("los hallazgos se ordenan por plata, no por severidad; null al final", () => {
    const reglas: Regla[] = [
      { id: "A", area: "entrega", evaluar: () => ({ ...hallazgo("A", 80_000), severidad: "alta" }) },
      { id: "B", area: "entrega", evaluar: () => ({ ...hallazgo("B", 4_000_000), severidad: "media" }) },
      { id: "C", area: "entrega", evaluar: () => hallazgo("C", null) },
      { id: "D", area: "entrega", evaluar: () => hallazgo("D", 500_000) },
    ];
    const r = ejecutarReglas(ctx, reglas);
    expect(r.hallazgos.map((h) => h.reglaId)).toEqual(["B", "D", "A", "C"]);
  });

  test("una regla que devuelve null no produce hallazgo", () => {
    const r = ejecutarReglas(ctx, [{ id: "N", area: "entrega", evaluar: () => null }]);
    expect(r.hallazgos).toHaveLength(0);
    expect(r.errores).toHaveLength(0);
  });

  test("plataEnRiesgo total suma solo los conocidos", () => {
    const reglas: Regla[] = [
      { id: "A", area: "entrega", evaluar: () => hallazgo("A", 100) },
      { id: "C", area: "entrega", evaluar: () => hallazgo("C", null) },
    ];
    expect(ejecutarReglas(ctx, reglas).plataEnRiesgoTotal).toBe(100);
  });
});

describe("construirContexto", () => {
  test("las ventanas reciente y previa tienen el mismo tamaño", () => {
    const ctx = construirContexto(loteVacio, cliente, benchmarks, "2026-09-12");
    expect(ctx.ventanas.reciente).toEqual({ desde: "2026-08-30", hasta: "2026-09-12" });
    expect(ctx.ventanas.previa).toEqual({ desde: "2026-08-16", hasta: "2026-08-29" });
  });

  test("con lote vacío los agregados son 0 y las razones null", () => {
    const ctx = construirContexto(loteVacio, cliente, benchmarks, "2026-09-12");
    expect(ctx.total.gasto).toBe(0);
    expect(ctx.negocio.cac).toBeNull();
    expect(ctx.embudo).toHaveLength(8);
  });
});

describe("nivel base cuando los niveles no cubren los mismos días", () => {
  test("los totales salen del nivel que cubre más días (campaña, 90 d) y no del más fino con menos cobertura (anuncio, 28 d)", async () => {
    const { fila, lote } = await import("@/lib/diagnostics/fixtures");
    const { rangoDias } = await import("@/lib/format/fechas");
    const dias90 = rangoDias("2026-06-15", "2026-09-12");
    const dias28 = rangoDias("2026-08-16", "2026-09-12");
    const filas = [
      ...dias90.map((fecha) => fila({ nivel: "campana", id: "c1", padreId: null, fecha, gasto: 1000, impresiones: 100, clics: 10, clicsEnlace: 5 })),
      ...dias28.map((fecha) => fila({ nivel: "conjunto", id: "s1", padreId: "c1", fecha, gasto: 1000, impresiones: 100, clics: 10, clicsEnlace: 5 })),
      ...dias28.map((fecha) => fila({ nivel: "anuncio", id: "a1", padreId: "s1", fecha, gasto: 1000, impresiones: 100, clics: 10, clicsEnlace: 5 })),
    ];
    const l = lote({ insights: filas, meta: { ...lote().meta, desde: "2026-06-15", hasta: "2026-09-12", huecos: [] } });
    const ctx = construirContexto(l, cliente, benchmarks, "2026-09-12");
    expect(ctx.total.gasto).toBe(90 * 1000); // 90 días, no 28
    expect(ctx.reciente.gasto).toBe(14 * 1000);
    expect(ctx.filasAnuncio.every((f) => f.nivel === "anuncio")).toBe(true); // las reglas de creativos siguen viendo anuncios
    expect(ctx.filasAnuncio).toHaveLength(28);
  });

  test("con la misma cobertura, manda el nivel más fino (anuncio), como siempre", async () => {
    const { fila, lote } = await import("@/lib/diagnostics/fixtures");
    const filas = [
      fila({ nivel: "campana", id: "c1", padreId: null, fecha: "2026-09-01", gasto: 5000 }),
      fila({ nivel: "anuncio", id: "a1", padreId: "s1", fecha: "2026-09-01", gasto: 2000 }),
      fila({ nivel: "anuncio", id: "a2", padreId: "s1", fecha: "2026-09-01", gasto: 3000 }),
    ];
    const ctx = construirContexto(lote({ insights: filas }), cliente, benchmarks, "2026-09-12");
    expect(ctx.total.gasto).toBe(5000);
    expect(ctx.total.entidades).toBe(2);
  });
});
