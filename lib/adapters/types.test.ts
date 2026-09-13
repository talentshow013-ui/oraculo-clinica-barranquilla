import { describe, expect, test } from "vitest";
import {
  BreakdownRowSchema,
  InsightRowSchema,
  LoteDatosSchema,
  PASOS,
  RegistroEmbudoSchema,
} from "@/lib/adapters/types";

const filaBase = {
  fuente: "meta",
  fecha: "2026-09-01",
  nivel: "anuncio",
  id: "ad_1",
  nombre: "Toxina — autoridad",
  padreId: "adset_1",
  cuentaId: "act_1",
  objetivo: "mensajes",
  estado: "activo",
  gasto: 120000,
  impresiones: 4000,
  alcance: null,
  frecuencia: null,
  subastasGanadas: null,
  pujaPromedio: null,
  clics: 80,
  clicsEnlace: 60,
  clicsUnicos: null,
  interacciones: null,
  reacciones: null,
  comentarios: null,
  compartidos: null,
  guardados: null,
  visitasPerfil: null,
  seguidoresNuevos: null,
  vistasLandingPage: null,
  reproducciones: null,
  reproducciones2s: null,
  reproducciones3s: null,
  reproducciones6s: null,
  reproduccionesThru: null,
  p25: null,
  p50: null,
  p75: null,
  p95: null,
  p100: null,
  tiempoReproduccionTotal: null,
  duracionCreativoSeg: null,
  conversacionesIniciadas: null,
  conversacionesRespondidas: null,
  resultados: 5,
  tipoResultado: "conversacion",
  valorConversion: null,
  ventanaAtribucion: "7d_click_1d_view",
};

describe("InsightRow", () => {
  test("una fila válida con nullables en null pasa", () => {
    expect(InsightRowSchema.safeParse(filaBase).success).toBe(true);
  });

  test("gasto null es rechazado: es obligatorio", () => {
    const r = InsightRowSchema.safeParse({ ...filaBase, gasto: null });
    expect(r.success).toBe(false);
  });

  test("gasto negativo es rechazado", () => {
    expect(InsightRowSchema.safeParse({ ...filaBase, gasto: -1 }).success).toBe(false);
  });

  test("alcance null pasa: Meta retiró alcance orgánico en 2026", () => {
    expect(InsightRowSchema.safeParse({ ...filaBase, alcance: null }).success).toBe(true);
  });

  test("ventanaAtribucion es obligatoria", () => {
    const { ventanaAtribucion: _v, ...sin } = filaBase;
    expect(InsightRowSchema.safeParse(sin).success).toBe(false);
  });
});

describe("BreakdownRow", () => {
  test("nRegistros es obligatorio", () => {
    const r = BreakdownRowSchema.safeParse({ ...filaBase, dimension: "edad", valor: "25-34" });
    expect(r.success).toBe(false);
  });

  test("con dimension, valor y nRegistros pasa", () => {
    const r = BreakdownRowSchema.safeParse({
      ...filaBase,
      dimension: "edad",
      valor: "25-34",
      nRegistros: 12,
    });
    expect(r.success).toBe(true);
  });
});

describe("RegistroEmbudo — sin PII posible", () => {
  const registro = {
    fecha: "2026-09-01",
    campanaId: "camp_1",
    fuenteAtribuida: "meta",
    paso: "cita_agendada",
    cantidad: 4,
    valorCOP: null,
    servicio: "toxina",
    sede: null,
    nRegistros: 4,
  };

  test("registro agregado válido pasa", () => {
    expect(RegistroEmbudoSchema.safeParse(registro).success).toBe(true);
  });

  test("un campo telefono rompe la carga (esquema estricto)", () => {
    expect(RegistroEmbudoSchema.safeParse({ ...registro, telefono: "3001234567" }).success).toBe(false);
  });

  test("un campo pacienteId rompe la carga", () => {
    expect(RegistroEmbudoSchema.safeParse({ ...registro, pacienteId: "p1" }).success).toBe(false);
  });

  test("los 8 pasos están en orden", () => {
    expect(PASOS).toEqual([
      "impresion",
      "clic",
      "conversacion",
      "lead_calificado",
      "cita_agendada",
      "cita_asistida",
      "venta",
      "recompra",
    ]);
  });
});

describe("LoteDatos", () => {
  test("lote mínimo válido pasa", () => {
    const lote = {
      insights: [filaBase],
      desgloses: [],
      creativos: [],
      embudo: [],
      competidores: [],
      anunciosCompetencia: [],
      experimentos: [],
      meta: {
        generadoEn: "2026-09-13T10:00:00-05:00",
        desde: "2026-09-01",
        hasta: "2026-09-01",
        origen: "seed",
        huecos: [],
        advertencias: [],
      },
    };
    expect(LoteDatosSchema.safeParse(lote).success).toBe(true);
  });

  test("meta.huecos es obligatorio", () => {
    const lote = {
      insights: [],
      desgloses: [],
      creativos: [],
      embudo: [],
      competidores: [],
      anunciosCompetencia: [],
      experimentos: [],
      meta: { generadoEn: "x", desde: "2026-09-01", hasta: "2026-09-01", origen: "seed", advertencias: [] },
    };
    expect(LoteDatosSchema.safeParse(lote).success).toBe(false);
  });
});
