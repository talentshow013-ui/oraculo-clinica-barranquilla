import { describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fila, lote, registro } from "@/lib/diagnostics/fixtures";
import { RegistroSemanalSchema, derivarPasosDePauta, fusionarAgenda, guardarSemana, leerAgenda, semanaDe, semanasRecientes, semanalAEmbudo, tasaAsistencia } from "./index";

const semana = { desde: "2026-09-07", hasta: "2026-09-13", contactosCalificados: 40, citasAgendadas: 21, citasAsistidas: 14, ventas: 7, valorVentasCOP: 4_900_000, recompras: null, registradoEn: "2026-09-14T09:00:00-05:00" };

describe("registro semanal — cinco números, ni un nombre", () => {
  test("acepta la semana válida y rechaza campos extra (privacidad por esquema)", () => {
    expect(RegistroSemanalSchema.safeParse(semana).success).toBe(true);
    expect(RegistroSemanalSchema.safeParse({ ...semana, paciente: "Ana" }).success).toBe(false);
    expect(RegistroSemanalSchema.safeParse({ ...semana, nota: "llamar a Juan" }).success).toBe(false);
  });

  test("rechaza negativos, decimales y una semana que no va de lunes a domingo", () => {
    expect(RegistroSemanalSchema.safeParse({ ...semana, citasAgendadas: -1 }).success).toBe(false);
    expect(RegistroSemanalSchema.safeParse({ ...semana, ventas: 2.5 }).success).toBe(false);
    expect(RegistroSemanalSchema.safeParse({ ...semana, desde: "2026-09-08" }).success).toBe(false);
    expect(RegistroSemanalSchema.safeParse({ ...semana, hasta: "2026-09-14" }).success).toBe(false);
  });

  test("rechaza un embudo imposible: más asistidas que agendadas, más ventas que asistidas", () => {
    expect(RegistroSemanalSchema.safeParse({ ...semana, citasAsistidas: 30 }).success).toBe(false);
    expect(RegistroSemanalSchema.safeParse({ ...semana, ventas: 20 }).success).toBe(false);
  });

  test("tasaAsistencia = asistidas / agendadas; null si no hay agendadas", () => {
    expect(tasaAsistencia(semana)).toBeCloseTo(14 / 21);
    expect(tasaAsistencia({ ...semana, citasAgendadas: 0, citasAsistidas: 0, ventas: 0 })).toBeNull();
  });
});

describe("semanas — lunes a domingo, hora Bogotá", () => {
  test("semanaDe devuelve el lunes y el domingo que contienen la fecha", () => {
    expect(semanaDe("2026-09-10")).toEqual({ desde: "2026-09-07", hasta: "2026-09-13" }); // jueves
    expect(semanaDe("2026-09-07")).toEqual({ desde: "2026-09-07", hasta: "2026-09-13" }); // lunes
    expect(semanaDe("2026-09-13")).toEqual({ desde: "2026-09-07", hasta: "2026-09-13" }); // domingo
  });

  test("semanasRecientes lista las últimas N semanas COMPLETAS, la más reciente primero", () => {
    const s = semanasRecientes("2026-09-16", 3); // miércoles: la semana en curso no cuenta
    expect(s[0]).toEqual({ desde: "2026-09-07", hasta: "2026-09-13" });
    expect(s[2]).toEqual({ desde: "2026-08-24", hasta: "2026-08-30" });
    expect(s).toHaveLength(3);
  });
});

describe("semanalAEmbudo — reparte la semana en sus 7 días, sin inventar decimales", () => {
  test("cada paso suma exactamente la cantidad semanal y cae dentro de la semana", () => {
    const regs = semanalAEmbudo(semana);
    const suma = (paso: string) => regs.filter((r) => r.paso === paso).reduce((s, r) => s + r.cantidad, 0);
    expect(suma("lead_calificado")).toBe(40);
    expect(suma("cita_agendada")).toBe(21);
    expect(suma("cita_asistida")).toBe(14);
    expect(suma("venta")).toBe(7);
    expect(regs.every((r) => r.fecha >= "2026-09-07" && r.fecha <= "2026-09-13")).toBe(true);
    expect(regs.every((r) => Number.isInteger(r.cantidad) && r.nRegistros === r.cantidad)).toBe(true);
    expect(regs.every((r) => r.campanaId === null && r.fuenteAtribuida === "meta")).toBe(true);
  });

  test("el valor de ventas se reparte proporcional a las ventas de cada día y suma el total", () => {
    const regs = semanalAEmbudo(semana).filter((r) => r.paso === "venta");
    expect(regs.reduce((s, r) => s + (r.valorCOP ?? 0), 0)).toBe(4_900_000);
    expect(regs.filter((r) => r.cantidad === 0).every((r) => r.valorCOP === 0 || r.valorCOP === null)).toBe(true);
  });

  test("recompras null → no genera el paso; 0 → sí genera con cero", () => {
    expect(semanalAEmbudo(semana).some((r) => r.paso === "recompra")).toBe(false);
    expect(semanalAEmbudo({ ...semana, recompras: 0 }).some((r) => r.paso === "recompra")).toBe(true);
  });
});

describe("fusionarAgenda — lo manual manda en su semana; lo de la pauta sale de los insights", () => {
  test("reemplaza los pasos de clínica de esa semana y conserva los demás días y los pasos de pauta", () => {
    const base = lote({
      insights: [fila({ nivel: "campana", id: "c1", padreId: null, fecha: "2026-09-08", impresiones: 1000, clicsEnlace: 50, conversacionesIniciadas: 10 })],
      embudo: [
        registro("cita_agendada", 99, { fecha: "2026-09-08" }), // será reemplazado
        registro("cita_agendada", 5, { fecha: "2026-08-20" }), // otra semana: se queda
        registro("conversacion", 10, { fecha: "2026-09-08" }), // paso de pauta: se queda
      ],
    });
    const r = fusionarAgenda(base, [semana]);
    const agendadasSemana = r.embudo.filter((x) => x.paso === "cita_agendada" && x.fecha >= "2026-09-07" && x.fecha <= "2026-09-13").reduce((s, x) => s + x.cantidad, 0);
    expect(agendadasSemana).toBe(21);
    expect(r.embudo.some((x) => x.fecha === "2026-08-20" && x.cantidad === 5)).toBe(true);
    expect(r.embudo.some((x) => x.paso === "conversacion" && x.cantidad === 10)).toBe(true);
  });

  test("si el lote no trae impresión/clic/conversación en el embudo, se derivan de los insights (nivel campaña)", () => {
    const base = lote({
      insights: [
        fila({ nivel: "campana", id: "c1", padreId: null, fecha: "2026-09-08", impresiones: 1000, clicsEnlace: 50, conversacionesIniciadas: 10 }),
        fila({ nivel: "anuncio", id: "a1", padreId: "s1", fecha: "2026-09-08", impresiones: 1000, clicsEnlace: 50, conversacionesIniciadas: 10 }), // no se suma dos veces
      ],
      embudo: [],
    });
    const derivados = derivarPasosDePauta(base.insights);
    expect(derivados.find((x) => x.paso === "impresion")!.cantidad).toBe(1000);
    expect(derivados.find((x) => x.paso === "clic")!.cantidad).toBe(50);
    expect(derivados.find((x) => x.paso === "conversacion")!.cantidad).toBe(10);
    const r = fusionarAgenda(base, [semana]);
    expect(r.embudo.some((x) => x.paso === "impresion")).toBe(true);
    expect(r.embudo.some((x) => x.paso === "cita_asistida")).toBe(true);
  });

  test("sin semanas manuales, el lote vuelve tal cual", () => {
    const base = lote({ embudo: [registro("venta", 3, { fecha: "2026-09-08" })] });
    expect(fusionarAgenda(base, [])).toBe(base);
  });

  test("la agenda pasa el guardián de privacidad del lote completo", async () => {
    const { validarSinPII } = await import("@/lib/privacy");
    const r = fusionarAgenda(lote({ embudo: [] }), [semana]);
    expect(() => validarSinPII(r)).not.toThrow();
  });
});

describe("archivo datos/agenda.json — leer y guardar sin pisar otras semanas", () => {
  test("guardarSemana crea el archivo, reemplaza la misma semana y ordena por fecha", () => {
    const dir = mkdtempSync(join(tmpdir(), "agenda-"));
    const ruta = join(dir, "agenda.json");
    try {
      expect(leerAgenda(ruta)).toEqual([]);
      guardarSemana(ruta, semana);
      guardarSemana(ruta, { ...semana, desde: "2026-08-31", hasta: "2026-09-06", citasAgendadas: 10, citasAsistidas: 8, ventas: 3 });
      guardarSemana(ruta, { ...semana, citasAgendadas: 25, citasAsistidas: 20, ventas: 9 }); // misma semana: reemplaza
      const s = leerAgenda(ruta);
      expect(s).toHaveLength(2);
      expect(s[0]!.desde).toBe("2026-09-07");
      expect(s[0]!.citasAgendadas).toBe(25);
      expect(JSON.parse(readFileSync(ruta, "utf8")).semanas).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("un archivo corrupto o con campos de paciente se rechaza, no se lee a medias", () => {
    const dir = mkdtempSync(join(tmpdir(), "agenda-"));
    const ruta = join(dir, "agenda.json");
    try {
      guardarSemana(ruta, semana);
      const crudo = JSON.parse(readFileSync(ruta, "utf8"));
      crudo.semanas[0].telefono = "300";
      writeFileSync(ruta, JSON.stringify(crudo));
      expect(() => leerAgenda(ruta)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
