import { describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fila, lote, registro } from "@/lib/diagnostics/fixtures";
import { RegistroPautaSchema, derivarPasosDePauta, diasConGastoDeCampana, fusionarResultados, guardarResultado, leerResultados, pautaAEmbudo, tasaAsistencia, tasaCierre } from "./index";

const resultado = { cuentaId: "act_1", campanaId: "camp_1", contactosCerrados: 40, citasAgendadas: 21, citasAsistidas: 14, ventas: 7, valorVentasCOP: 4_900_000, registradoEn: "2026-09-14T09:00:00-05:00" };
const filasCamp = (id: string, fechas: string[], gasto = 100_000) => fechas.map((fecha) => fila({ nivel: "campana", id, nombre: `Campaña ${id}`, padreId: null, fecha, gasto, impresiones: 1000, clicsEnlace: 50, conversacionesIniciadas: 10 }));

describe("resultados por pauta — cinco números por campaña, ni un nombre", () => {
  test("acepta el registro y rechaza campos extra, negativos, decimales y embudos imposibles", () => {
    expect(RegistroPautaSchema.safeParse(resultado).success).toBe(true);
    expect(RegistroPautaSchema.safeParse({ ...resultado, paciente: "Ana" }).success).toBe(false);
    expect(RegistroPautaSchema.safeParse({ ...resultado, nota: "llamar" }).success).toBe(false);
    expect(RegistroPautaSchema.safeParse({ ...resultado, ventas: -1 }).success).toBe(false);
    expect(RegistroPautaSchema.safeParse({ ...resultado, ventas: 2.5 }).success).toBe(false);
    expect(RegistroPautaSchema.safeParse({ ...resultado, citasAsistidas: 30 }).success).toBe(false);
    expect(RegistroPautaSchema.safeParse({ ...resultado, ventas: 20 }).success).toBe(false);
    expect(RegistroPautaSchema.safeParse({ ...resultado, campanaId: "" }).success).toBe(false);
  });

  test("tasas: asistencia = asistidas/agendadas, cierre = ventas/asistidas; null sin denominador", () => {
    expect(tasaAsistencia(resultado)).toBeCloseTo(14 / 21);
    expect(tasaCierre(resultado)).toBeCloseTo(7 / 14);
    expect(tasaAsistencia({ ...resultado, citasAgendadas: 0, citasAsistidas: 0, ventas: 0 })).toBeNull();
  });
});

describe("pautaAEmbudo — los totales de la campaña se reparten en sus días con gasto", () => {
  test("cada paso suma exactamente el total, va con la campaña y cae en días con gasto", () => {
    const dias = ["2026-09-01", "2026-09-02", "2026-09-03"];
    const regs = pautaAEmbudo(resultado, dias);
    const suma = (paso: string) => regs.filter((r) => r.paso === paso).reduce((s, r) => s + r.cantidad, 0);
    expect(suma("lead_calificado")).toBe(40);
    expect(suma("cita_agendada")).toBe(21);
    expect(suma("cita_asistida")).toBe(14);
    expect(suma("venta")).toBe(7);
    expect(regs.filter((r) => r.paso === "venta").reduce((s, r) => s + (r.valorCOP ?? 0), 0)).toBe(4_900_000);
    expect(regs.every((r) => dias.includes(r.fecha) && r.campanaId === "camp_1" && Number.isInteger(r.cantidad) && r.nRegistros === r.cantidad)).toBe(true);
  });

  test("sin días con gasto no se genera nada (no hay dónde ponerlo)", () => {
    expect(pautaAEmbudo(resultado, [])).toEqual([]);
  });

  test("diasConGastoDeCampana usa el nivel campaña; si no hay, los conjuntos por su padre", () => {
    const insights = [...filasCamp("camp_1", ["2026-09-01", "2026-09-03"]), fila({ nivel: "campana", id: "camp_1", padreId: null, fecha: "2026-09-02", gasto: 0 })];
    expect(diasConGastoDeCampana(insights, "camp_1")).toEqual(["2026-09-01", "2026-09-03"]);
    const soloConjuntos = [fila({ nivel: "conjunto", id: "s1", padreId: "camp_9", fecha: "2026-09-05", gasto: 10 })];
    expect(diasConGastoDeCampana(soloConjuntos, "camp_9")).toEqual(["2026-09-05"]);
  });
});

describe("fusionarResultados — lo registrado manda para esa campaña; lo de pauta sale de los insights", () => {
  test("reemplaza los pasos de clínica de la campaña (todas las fechas) y conserva otras campañas y los pasos de pauta", () => {
    const base = lote({
      insights: [...filasCamp("camp_1", ["2026-09-01", "2026-09-02"]), ...filasCamp("camp_2", ["2026-09-01"])],
      embudo: [
        registro("cita_agendada", 99, { fecha: "2026-09-01", campanaId: "camp_1" }), // reemplazado
        registro("cita_agendada", 5, { fecha: "2026-08-20", campanaId: "camp_1" }), // también (misma campaña)
        registro("cita_agendada", 7, { fecha: "2026-09-01", campanaId: "camp_2" }), // otra campaña: se queda
        registro("conversacion", 10, { fecha: "2026-09-01", campanaId: "camp_1" }), // paso de pauta: se queda
      ],
    });
    const r = fusionarResultados(base, [resultado]);
    const agendadas = (c: string) => r.embudo.filter((x) => x.paso === "cita_agendada" && x.campanaId === c).reduce((s, x) => s + x.cantidad, 0);
    expect(agendadas("camp_1")).toBe(21);
    expect(agendadas("camp_2")).toBe(7);
    expect(r.embudo.some((x) => x.paso === "conversacion" && x.cantidad === 10)).toBe(true);
  });

  test("si el lote no trae impresión/clic/conversación, se derivan de los insights (un solo nivel)", () => {
    const base = lote({ insights: [...filasCamp("camp_1", ["2026-09-01"]), fila({ nivel: "anuncio", id: "a1", padreId: "s1", fecha: "2026-09-01", impresiones: 1000, clicsEnlace: 50 })], embudo: [] });
    expect(derivarPasosDePauta(base.insights).find((x) => x.paso === "impresion")!.cantidad).toBe(1000);
    const r = fusionarResultados(base, [resultado]);
    expect(r.embudo.some((x) => x.paso === "impresion")).toBe(true);
    expect(r.embudo.some((x) => x.paso === "cita_asistida" && x.campanaId === "camp_1")).toBe(true);
  });

  test("una campaña sin días con gasto en el lote no genera registros pero tampoco rompe", () => {
    const base = lote({ insights: [], embudo: [registro("venta", 3, { fecha: "2026-09-08", campanaId: "camp_1" })] });
    const r = fusionarResultados(base, [resultado]);
    expect(r.embudo.some((x) => x.paso === "venta" && x.campanaId === "camp_1")).toBe(false);
  });

  test("sin registros, el lote vuelve tal cual; con registros pasa el guardián de privacidad", async () => {
    const base = lote({ embudo: [] });
    expect(fusionarResultados(base, [])).toBe(base);
    const { validarSinPII } = await import("@/lib/privacy");
    expect(() => validarSinPII(fusionarResultados(lote({ insights: filasCamp("camp_1", ["2026-09-01"]) }), [resultado]))).not.toThrow();
  });
});

describe("archivo datos/resultados.json — un registro por cuenta y campaña", () => {
  test("guardar crea el archivo, reemplaza la misma campaña y conserva las demás", () => {
    const dir = mkdtempSync(join(tmpdir(), "resultados-"));
    const ruta = join(dir, "resultados.json");
    try {
      expect(leerResultados(ruta)).toEqual([]);
      guardarResultado(ruta, resultado);
      guardarResultado(ruta, { ...resultado, campanaId: "camp_2", citasAgendadas: 4, citasAsistidas: 3, ventas: 1 });
      guardarResultado(ruta, { ...resultado, citasAgendadas: 25, citasAsistidas: 20, ventas: 9 }); // misma campaña: reemplaza
      const s = leerResultados(ruta);
      expect(s).toHaveLength(2);
      expect(s.find((x) => x.campanaId === "camp_1")!.citasAgendadas).toBe(25);
      expect(JSON.parse(readFileSync(ruta, "utf8")).registros).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("un archivo con campos de paciente se rechaza entero", () => {
    const dir = mkdtempSync(join(tmpdir(), "resultados-"));
    const ruta = join(dir, "resultados.json");
    try {
      guardarResultado(ruta, resultado);
      const crudo = JSON.parse(readFileSync(ruta, "utf8"));
      crudo.registros[0].telefono = "300";
      writeFileSync(ruta, JSON.stringify(crudo));
      expect(() => leerResultados(ruta)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
