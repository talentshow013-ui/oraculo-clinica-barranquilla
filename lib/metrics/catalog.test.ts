import { describe, expect, test } from "vitest";
import { CATALOGO, FAMILIAS, metricaPorId, metricasMaestras, metricasPorFamilia } from "@/lib/metrics/catalog";

const CONTEOS: Record<string, number> = {
  entrega: 13,
  costo: 16,
  interaccion: 11,
  video: 14,
  mensajeria: 7,
  conversion: 15,
  negocio: 17,
  creativo: 12,
  audiencia: 11,
  competencia: 13,
  salud_cuenta: 9,
  operacion: 7,
};

describe("catálogo de métricas", () => {
  test("hay exactamente 145 métricas", () => {
    expect(CATALOGO).toHaveLength(145);
  });

  test("12 familias con el conteo objetivo", () => {
    expect(FAMILIAS).toHaveLength(12);
    for (const [familia, n] of Object.entries(CONTEOS)) {
      expect(metricasPorFamilia(familia as (typeof FAMILIAS)[number])).toHaveLength(n);
    }
  });

  test("ids únicos", () => {
    const ids = CATALOGO.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("toda métrica declara qué decisión cambia (porQueImporta) y una fórmula legible", () => {
    for (const m of CATALOGO) {
      expect(m.porQueImporta.length, m.id).toBeGreaterThan(25);
      expect(m.formula.length, m.id).toBeGreaterThan(3);
      expect(m.fuentes.length, m.id).toBeGreaterThan(0);
    }
  });

  test("ninguna métrica trae benchmark quemado", () => {
    for (const m of CATALOGO) {
      expect(m, m.id).not.toHaveProperty("benchmark");
      expect(m, m.id).not.toHaveProperty("umbral");
    }
  });

  test("aproximadamente 18 maestras para el Centro de Mando", () => {
    const n = metricasMaestras().length;
    expect(n).toBeGreaterThanOrEqual(16);
    expect(n).toBeLessThanOrEqual(20);
  });

  test("las métricas críticas del negocio existen", () => {
    for (const id of ["show_rate", "fuga_pesos", "poas", "cac", "cac_margen", "hook_rate", "hold_rate", "costo_cita_asistida", "inversion_fuera_radio", "plata_en_riesgo", "puntuacion_longevidad", "espacios_vacios"]) {
      expect(metricaPorId(id), id).toBeDefined();
    }
  });

  test("la jerga técnica no aparece en nombres ni explicaciones", () => {
    for (const m of CATALOGO) {
      expect(`${m.nombre} ${m.porQueImporta}`).not.toMatch(/\b(API|MCP|endpoint|Zod|LLM)\b/);
    }
  });
});
