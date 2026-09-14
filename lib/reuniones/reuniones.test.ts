import { describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ValorMetrica } from "@/lib/metrics/resolver";
import { DecisionSchema, ReunionSchema, agregarDecision, compararDecision, crearReunion, decisionesPendientes, evaluarDecision, guardarReuniones, leerReuniones, reunionesAExperimentos, sinDatosPersonales, tomarFoto } from "./index";

const maestra = (p: Partial<ValorMetrica> & Pick<ValorMetrica, "id" | "nombre">): ValorMetrica => ({
  unidad: "cop", valor: 100, valorReciente: 120, valorPrevio: 100, mejorEs: "menor", formula: "", porQueImporta: "", calculada: true, ...p,
});
const maestras: ValorMetrica[] = [
  maestra({ id: "costo_conversacion", nombre: "Costo por conversación", valorReciente: 5_000, valorPrevio: 4_000 }),
  maestra({ id: "show_rate", nombre: "Asistencia a citas", unidad: "porcentaje", mejorEs: "mayor", valor: 0.6, valorReciente: undefined, valorPrevio: null }),
  maestra({ id: "inversion", nombre: "Inversión", mejorEs: "informativo", valorReciente: 2_000_000, valorPrevio: 1_900_000 }),
];

describe("la foto de la reunión — los números del motor en ese momento", () => {
  test("toma reciente/previo de cada maestra; si no hay ventana usa el valor del periodo y lo marca", () => {
    const f = tomarFoto(maestras, "2026-09-14");
    expect(f.fecha).toBe("2026-09-14");
    const cc = f.metricas.find((m) => m.id === "costo_conversacion")!;
    expect(cc.reciente).toBe(5_000);
    expect(cc.previo).toBe(4_000);
    expect(cc.ventana).toBe("14d");
    const sr = f.metricas.find((m) => m.id === "show_rate")!;
    expect(sr.reciente).toBe(0.6);
    expect(sr.ventana).toBe("periodo");
    expect(sr.previo).toBeNull();
  });
});

describe("decisiones — texto sin datos personales", () => {
  test("acepta decisiones de marketing y rechaza teléfonos, correos o cédulas", () => {
    expect(sinDatosPersonales("Subir presupuesto de Facial 20 % y probar gancho de precio")).toBe(true);
    expect(sinDatosPersonales("Llamar a 3001234567 para confirmar")).toBe(false);
    expect(sinDatosPersonales("escribir a ana@gmail.com")).toBe(false);
    expect(sinDatosPersonales("paciente con cédula 1234567890")).toBe(false);
    expect(sinDatosPersonales("")).toBe(false);
  });

  test("el esquema exige texto, tipo de prueba válido y fecha de evaluación", () => {
    const base = { id: "d1", texto: "Probar video de la doctora", metricaId: "costo_conversacion", valorAlDecidir: 5_000, objetivo: 4_000, tipoPrueba: "creativo", evaluarEl: "2026-09-28", resultado: "en_curso", valorAlEvaluar: null, aprendizaje: null, evaluadaEn: null };
    expect(DecisionSchema.safeParse(base).success).toBe(true);
    expect(DecisionSchema.safeParse({ ...base, tipoPrueba: "otra" }).success).toBe(false);
    expect(DecisionSchema.safeParse({ ...base, texto: "correo juan@x.com" }).success).toBe(false);
    expect(DecisionSchema.safeParse({ ...base, paciente: "x" }).success).toBe(false);
  });
});

describe("una reunión cada quince días", () => {
  test("crearReunion guarda la foto y la cuenta; agregarDecision toma el valor de la métrica de la foto y evalúa a los 14 días", () => {
    const foto = tomarFoto(maestras, "2026-09-14");
    const r = crearReunion({ cuentaId: "act_1", fecha: "2026-09-14", foto, registradaEn: "2026-09-14T10:00:00-05:00" });
    expect(ReunionSchema.safeParse(r).success).toBe(true);
    const r2 = agregarDecision(r, { texto: "Subir presupuesto Facial 20 %", metricaId: "costo_conversacion", objetivo: 4_000, tipoPrueba: "presupuesto" });
    expect(r2.decisiones).toHaveLength(1);
    const d = r2.decisiones[0]!;
    expect(d.valorAlDecidir).toBe(5_000);
    expect(d.evaluarEl).toBe("2026-09-28");
    expect(d.resultado).toBe("en_curso");
    expect(d.id).toMatch(/^dec_/);
  });

  test("decisionesPendientes lista las en curso; evaluarDecision cierra con el valor actual y el aprendizaje", () => {
    const foto = tomarFoto(maestras, "2026-09-14");
    const r = agregarDecision(crearReunion({ cuentaId: "act_1", fecha: "2026-09-14", foto, registradaEn: "2026-09-14T10:00:00-05:00" }), { texto: "Probar gancho de precio", metricaId: "costo_conversacion", objetivo: null, tipoPrueba: "creativo" });
    const pendientes = decisionesPendientes([r]);
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0]!.reunionFecha).toBe("2026-09-14");
    const fotoHoy = tomarFoto([maestra({ id: "costo_conversacion", nombre: "Costo por conversación", valorReciente: 3_800, valorPrevio: 5_000 })], "2026-09-28");
    const cerradas = evaluarDecision([r], r.decisiones[0]!.id, { resultado: "gano", aprendizaje: "el precio en el gancho bajó el costo" }, fotoHoy, "2026-09-28T09:00:00-05:00");
    const d = cerradas[0]!.decisiones[0]!;
    expect(d.resultado).toBe("gano");
    expect(d.valorAlEvaluar).toBe(3_800);
    expect(d.evaluadaEn).toBe("2026-09-28T09:00:00-05:00");
    expect(decisionesPendientes(cerradas)).toHaveLength(0);
  });

  test("compararDecision dice si la métrica mejoró según mejorEs, con el valor actual", () => {
    const foto = tomarFoto(maestras, "2026-09-14");
    const r = agregarDecision(crearReunion({ cuentaId: "act_1", fecha: "2026-09-14", foto, registradaEn: "2026-09-14T10:00:00-05:00" }), { texto: "Probar gancho de precio", metricaId: "costo_conversacion", objetivo: 4_000, tipoPrueba: "creativo" });
    const fotoHoy = tomarFoto([maestra({ id: "costo_conversacion", nombre: "Costo por conversación", valorReciente: 3_800 })], "2026-09-28");
    const c = compararDecision(r.decisiones[0]!, fotoHoy);
    expect(c.antes).toBe(5_000);
    expect(c.ahora).toBe(3_800);
    expect(c.delta).toBeCloseTo(-0.24);
    expect(c.mejoro).toBe(true);
    expect(c.objetivoCumplido).toBe(true);
    const sinMetrica = compararDecision({ ...r.decisiones[0]!, metricaId: null, valorAlDecidir: null }, fotoHoy);
    expect(sinMetrica.mejoro).toBeNull();
  });

  test("las decisiones se vuelven experimentos para la memoria de oportunidades", () => {
    const foto = tomarFoto(maestras, "2026-09-14");
    const r = agregarDecision(crearReunion({ cuentaId: "act_1", fecha: "2026-09-14", foto, registradaEn: "2026-09-14T10:00:00-05:00" }), { texto: "Probar gancho de precio", metricaId: "costo_conversacion", objetivo: null, tipoPrueba: "creativo" });
    const [e] = reunionesAExperimentos([r]);
    expect(e!.hipotesis).toBe("Probar gancho de precio");
    expect(e!.tipoPrueba).toBe("creativo");
    expect(e!.inicio).toBe("2026-09-14");
    expect(e!.resultado).toBe("en_curso");
    expect(e!.metricaExito).toBe("Costo por conversación");
  });
});

describe("archivo datos/reuniones.json", () => {
  test("guarda y lee; una reunión con campos de paciente se rechaza entera", () => {
    const dir = mkdtempSync(join(tmpdir(), "reuniones-"));
    const ruta = join(dir, "reuniones.json");
    try {
      expect(leerReuniones(ruta)).toEqual([]);
      const r = crearReunion({ cuentaId: "act_1", fecha: "2026-09-14", foto: tomarFoto(maestras, "2026-09-14"), registradaEn: "2026-09-14T10:00:00-05:00" });
      guardarReuniones(ruta, [r]);
      expect(leerReuniones(ruta)).toHaveLength(1);
      expect(() => guardarReuniones(ruta, [{ ...r, telefono: "300" } as unknown as typeof r])).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
