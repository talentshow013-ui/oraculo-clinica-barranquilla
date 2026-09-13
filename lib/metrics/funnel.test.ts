import { describe, expect, test } from "vitest";
import type { RegistroEmbudo } from "@/lib/adapters/types";
import { PASOS } from "@/lib/adapters/types";
import type { ConfigCliente } from "@/config/cliente";
import { cliente } from "@/config/cliente";
import {
  cac,
  cierreEnConsultorio,
  construirEmbudo,
  costoCitaAsistida,
  fugaMasCara,
  ltv,
  metricasNegocio,
  poas,
  ratioCacMargen,
  roasReal,
  showRate,
} from "@/lib/metrics/funnel";

function reg(paso: RegistroEmbudo["paso"], cantidad: number, valorCOP: number | null = null): RegistroEmbudo {
  return {
    fecha: "2026-09-01",
    campanaId: "c1",
    fuenteAtribuida: "meta",
    paso,
    cantidad,
    valorCOP,
    servicio: "toxina",
    sede: null,
    nRegistros: cantidad,
  };
}

const cfgCalibrado: ConfigCliente = {
  ...cliente,
  servicios: [{ id: "toxina", nombre: "Toxina", ticketCOP: 800_000, costoDirectoCOP: 300_000, recurrenciaMeses: 6 }],
};

// 1.000 impresiones → 100 clics → 50 conv → 25 leads → 20 citas → 12 asistidas → 6 ventas → 2 recompras
const registros: RegistroEmbudo[] = [
  reg("impresion", 1000),
  reg("clic", 100),
  reg("conversacion", 50),
  reg("lead_calificado", 25),
  reg("cita_agendada", 20),
  reg("cita_asistida", 12),
  reg("venta", 6, 4_800_000),
  reg("recompra", 2, 1_600_000),
];
const GASTO = 1_200_000;

describe("construirEmbudo", () => {
  const pasos = construirEmbudo(registros, GASTO, cfgCalibrado);

  test("devuelve los 8 pasos en orden", () => {
    expect(pasos.map((p) => p.paso)).toEqual([...PASOS]);
  });

  test("tasa de paso y acumulada", () => {
    const clic = pasos[1]!;
    expect(clic.tasaPaso).toBeCloseTo(0.1);
    const asistida = pasos[5]!;
    expect(asistida.tasaPaso).toBeCloseTo(0.6);
    expect(asistida.tasaAcumulada).toBeCloseTo(12 / 1000);
  });

  test("costo unitario = gasto / cantidad del paso", () => {
    expect(pasos[4]!.costoUnitario).toBeCloseTo(GASTO / 20); // por cita agendada
    expect(pasos[5]!.costoUnitario).toBeCloseTo(GASTO / 12); // por cita asistida
  });

  test("fuga ANTES de cita_asistida se valoriza al costo unitario del paso anterior", () => {
    // De 20 agendadas a 12 asistidas se pierden 8; cada agendada costó 60.000
    const asistida = pasos[5]!;
    expect(asistida.perdidos).toBe(8);
    expect(asistida.fugaCOP).toBeCloseTo(8 * (GASTO / 20));
  });

  test("fuga DESDE cita_asistida se valoriza al margen unitario", () => {
    // De 12 asistidas a 6 ventas se pierden 6; cada venta perdida vale el margen 500.000
    const venta = pasos[6]!;
    expect(venta.perdidos).toBe(6);
    expect(venta.fugaCOP).toBeCloseTo(6 * 500_000);
  });

  test("sin margen calibrado la fuga posterior a cita asistida es null, no 0", () => {
    const sinCalibrar = construirEmbudo(registros, GASTO, cliente);
    expect(sinCalibrar[6]!.fugaCOP).toBeNull();
    expect(sinCalibrar[5]!.fugaCOP).not.toBeNull(); // la anterior sí, porque usa costo
  });

  test("un paso sin registros tiene cantidad 0 y tasa null (no sabemos)", () => {
    const sinRecompra = construirEmbudo(registros.slice(0, 7), GASTO, cfgCalibrado);
    expect(sinRecompra[7]!.cantidad).toBe(0);
    expect(sinRecompra[7]!.tasaPaso).toBe(0);
    const vacio = construirEmbudo([], GASTO, cfgCalibrado);
    expect(vacio[1]!.tasaPaso).toBeNull();
  });

  test("fugaMasCara elige por pesos, no por porcentaje", () => {
    // 40 % de fuga en clic (900 perdidos × 1.200 c/u = 1.080.000) vs 50 % en venta (6 × 500.000 = 3.000.000)
    const peor = fugaMasCara(pasos);
    expect(peor?.paso).toBe("venta");
  });
});

describe("métricas de negocio", () => {
  test("showRate = asistidas / agendadas", () => {
    expect(showRate(registros)).toBeCloseTo(0.6);
  });
  test("cierreEnConsultorio = ventas / asistidas", () => {
    expect(cierreEnConsultorio(registros)).toBeCloseTo(0.5);
  });
  test("costoCitaAsistida = gasto / asistidas", () => {
    expect(costoCitaAsistida(registros, GASTO)).toBeCloseTo(100_000);
  });
  test("cac = gasto / ventas", () => {
    expect(cac(registros, GASTO)).toBeCloseTo(200_000);
  });
  test("roasReal = ingresos de caja / gasto", () => {
    expect(roasReal(registros, GASTO)).toBeCloseTo(6_400_000 / 1_200_000);
  });
  test("POAS: ROAS 4x con margen 20 % es 0,8 — pérdida", () => {
    expect(poas(4, 0.2)).toBeCloseTo(0.8);
    expect(poas(null, 0.2)).toBeNull();
    expect(poas(4, null)).toBeNull();
  });
  test("ratioCacMargen > 1 significa que cada paciente cuesta más de lo que deja", () => {
    expect(ratioCacMargen(200_000, 500_000)).toBeCloseTo(0.4);
    expect(ratioCacMargen(200_000, null)).toBeNull();
  });
  test("ltv proyecta recurrencia dentro del horizonte", () => {
    // margen 500.000, cada 6 meses, horizonte 18 → 3 visitas
    expect(ltv(500_000, 6, 18)).toBe(1_500_000);
    expect(ltv(500_000, null, 18)).toBe(500_000);
    expect(ltv(null, 6, 18)).toBeNull();
  });
  test("metricasNegocio sin calibrar deja lo dependiente de margen en null", () => {
    const m = metricasNegocio(registros, GASTO, cliente);
    expect(m.cac).toBeCloseTo(200_000);
    expect(m.poas).toBeNull();
    expect(m.ratioCacMargen).toBeNull();
    expect(m.calibrado).toBe(false);
  });
});
