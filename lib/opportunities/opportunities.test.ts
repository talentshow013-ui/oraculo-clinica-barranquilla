import { describe, expect, test } from "vitest";
import type { Experimento } from "@/lib/adapters/types";
import type { Hallazgo } from "@/lib/diagnostics/engine";
import type { EspacioVacio } from "@/lib/competitive";
import { desdeEspaciosVacios, desdeGanadoresMercado, desdeHallazgos, filtrarYaProbadas, generarOportunidades, priorizarICE } from "@/lib/opportunities";
import { anuncioCompetidor } from "@/lib/diagnostics/fixtures";
import { cliente } from "@/config/cliente";

const hallazgoR15: Hallazgo = {
  reglaId: "R15",
  area: "embudo",
  severidad: "alta",
  titulo: "40,0 % de las citas agendadas no se presentan",
  explicacion: "…",
  evidencia: [{ etiqueta: "Asistencia", valor: "60,0 %" }],
  acciones: ["Confirmación 24h antes"],
  plataEnRiesgo: 3_000_000,
  metricas: ["show_rate"],
};

const espacio: EspacioVacio = { servicio: "toxina", angulo: "educativo", nivelConsciencia: 2, competidoresQueLoAtacan: 0, porQue: "nadie lo ataca" };

describe("oportunidades — una idea sin criterio de corte es una corazonada", () => {
  test("desdeHallazgos crea hipótesis si→entonces→porque con prueba completa", () => {
    const [o] = desdeHallazgos([hallazgoR15], cliente);
    expect(o).toBeDefined();
    expect(o!.hipotesis).toMatch(/^Si .+ entonces .+ porque .+/i);
    expect(o!.basadaEn.length).toBeGreaterThan(0);
    expect(o!.prueba.criterioCorte.length).toBeGreaterThan(10);
    expect(o!.prueba.duracionDias).toBeGreaterThan(0);
    expect(o!.prueba.metricaExito.length).toBeGreaterThan(0);
    expect(o!.origen).toBe("hallazgo");
    expect(o!.tipoPrueba).toBe("proceso");
  });

  test("desdeEspaciosVacios propone creativo en la combinación libre", () => {
    const [o] = desdeEspaciosVacios([espacio], cliente);
    expect(o!.servicio).toBe("toxina");
    expect(o!.angulo).toBe("educativo");
    expect(o!.tipoPrueba).toBe("creativo");
    expect(o!.origen).toBe("espacio_vacio");
  });

  test("desdeGanadoresMercado replica la ESTRUCTURA, nunca el copy", () => {
    const g = anuncioCompetidor({ copy: "Rejuvenece tu piel con nuestro láser exclusivo", anguloDetectado: "aspiracional", servicioDetectado: "laser_facial", diasCorriendo: 90 });
    const [o] = desdeGanadoresMercado([g], cliente);
    expect(o!.hipotesis).not.toContain("Rejuvenece tu piel con nuestro láser exclusivo");
    expect(o!.hipotesis).toMatch(/estructura/i);
    expect(o!.origen).toBe("ganador_mercado");
  });

  test("priorizarICE = impacto × confianza / esfuerzo, descendente", () => {
    const base = desdeHallazgos([hallazgoR15], cliente)[0]!;
    const a = { ...base, id: "a", impacto: 9, confianza: 0.8, esfuerzo: 2 };
    const b = { ...base, id: "b", impacto: 5, confianza: 0.9, esfuerzo: 1 };
    const r = priorizarICE([a, b]);
    expect(r[0]!.id).toBe("b"); // 4.5 > 3.6
    expect(r[0]!.ice).toBeCloseTo(4.5);
  });

  test("filtrarYaProbadas baja la confianza y marca lo que ya perdió", () => {
    const o = desdeEspaciosVacios([espacio], cliente)[0]!;
    const perdido: Experimento = {
      id: "e1",
      hipotesis: "x",
      servicio: "toxina",
      angulo: "educativo",
      tipoPrueba: "creativo",
      inicio: "2026-06-01",
      fin: "2026-06-15",
      resultado: "perdio",
      metricaExito: "costo por conversación",
      aprendizaje: "no generó conversaciones",
      origenOportunidadId: null,
    };
    const [r] = filtrarYaProbadas([o], [perdido]);
    expect(r!.yaProbada).toBe(true);
    expect(r!.confianza).toBeLessThan(o.confianza);
    expect(r!.aprendizajePrevio).toContain("no generó");
  });

  test("un experimento ganado no penaliza", () => {
    const o = desdeEspaciosVacios([espacio], cliente)[0]!;
    const ganado: Experimento = { id: "e2", hipotesis: "x", servicio: "toxina", angulo: "educativo", tipoPrueba: "creativo", inicio: "2026-06-01", fin: "2026-06-15", resultado: "gano", metricaExito: "cpl", aprendizaje: null, origenOportunidadId: null };
    const [r] = filtrarYaProbadas([o], [ganado]);
    expect(r!.yaProbada).toBe(false);
    expect(r!.confianza).toBe(o.confianza);
  });

  test("generarOportunidades combina orígenes, prioriza y limita", () => {
    const r = generarOportunidades({ hallazgos: [hallazgoR15], espaciosVacios: [espacio, { ...espacio, servicio: "acido" }], ganadores: [anuncioCompetidor()], experimentos: [], cliente });
    expect(r.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < r.length; i++) expect(r[i - 1]!.ice).toBeGreaterThanOrEqual(r[i]!.ice);
    expect(new Set(r.map((o) => o.id)).size).toBe(r.length);
  });
});
