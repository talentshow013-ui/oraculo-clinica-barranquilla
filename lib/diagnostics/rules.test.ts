import { describe, expect, test } from "vitest";
import { cliente, type ConfigCliente } from "@/config/cliente";
import { benchmarks } from "@/config/benchmarks";
import { construirContexto, ejecutarReglas, type Hallazgo } from "@/lib/diagnostics/engine";
import { REGLAS, reglaPorId } from "@/lib/diagnostics/rules";
import {
  DESDE,
  HASTA,
  HOY,
  anuncioCompetidor,
  creativo,
  desglose,
  embudoDiario,
  lote,
  serieAnuncio,
} from "@/lib/diagnostics/fixtures";
import { sumarDias } from "@/lib/format/fechas";
import { generarSeed } from "@/scripts/seed";

const calibrado: ConfigCliente = {
  ...cliente,
  servicios: [{ id: "toxina", nombre: "Toxina", ticketCOP: 800_000, costoDirectoCOP: 300_000, recurrenciaMeses: 6 }],
};

function correr(id: string, l = lote(), cfg = cliente): Hallazgo | null {
  const ctx = construirContexto(l, cfg, benchmarks, HOY);
  return reglaPorId(id).evaluar(ctx);
}

function esperarHallazgoCompleto(h: Hallazgo | null) {
  expect(h).not.toBeNull();
  // Trazabilidad: de dónde salió el dato, con qué método y a dónde ir a verlo.
  expect(h!.fuente.origen.length).toBeGreaterThan(8);
  expect(h!.fuente.metodo.length).toBeGreaterThan(20);
  expect(h!.fuente.enlace).toMatch(/^\//);
  expect(h!.fuente.desde <= h!.fuente.hasta).toBe(true);
  for (const e of h!.evidencia) if (e.enlace !== undefined) expect(e.enlace).toMatch(/^\//);
  expect(h).not.toBeNull();
  expect(h!.titulo.length).toBeGreaterThan(10);
  expect(h!.explicacion.length).toBeGreaterThan(30);
  expect(h!.evidencia.length).toBeGreaterThan(0);
  expect(h!.acciones.length).toBeGreaterThan(0);
  expect(`${h!.titulo} ${h!.explicacion}`).not.toMatch(/\b(API|MCP|endpoint|Zod|LLM|CTR|CPM|CPA)\b/);
}

const recienteDesde = sumarDias(HASTA, -13);
const esReciente = (fecha: string) => fecha >= recienteDesde;

describe("registro de reglas", () => {
  test("hay 28 reglas con ids únicos R01..R28", () => {
    expect(REGLAS).toHaveLength(28);
    const ids = REGLAS.map((r) => r.id);
    expect(new Set(ids).size).toBe(28);
    for (let i = 1; i <= 28; i++) expect(ids).toContain(`R${String(i).padStart(2, "0")}`);
  });
});

describe("R28 campañas que se prenden y apagan a cada rato", () => {
  const cambio = (fecha: string, accion: "prender" | "apagar", actor: string, objetoId = "c1") => ({
    fuente: "meta" as const, cuentaId: "act", fecha, hora: "10:00", actor, tipo: "Estado de la campaña actualizado", objetoTipo: "campana" as const, objetoId, objetoNombre: `Campaña ${objetoId}`, campanaId: objetoId, accion, de: null, a: null,
  });
  test("dispara con 3+ cambios de estado de la misma campaña en 14 días; evidencia enlaza a la campaña y nombra a quienes lo hicieron", () => {
    const l = lote({
      insights: [...serieAnuncio("ad_1"), ...serieAnuncio("c1", () => ({ nivel: "campana", gasto: 100_000 }))],
      bitacora: [cambio(sumarDias(HASTA, -10), "apagar", "Ana"), cambio(sumarDias(HASTA, -8), "prender", "Beto"), cambio(sumarDias(HASTA, -2), "apagar", "Ana"), cambio(sumarDias(HASTA, -1), "apagar", "Ana", "c2")],
    });
    const h = correr("R28", l);
    esperarHallazgoCompleto(h);
    expect(h!.titulo).toMatch(/1 campaña/);
    expect(h!.evidencia[0]!.enlace).toBe("/campanas#campana-c1");
    expect(h!.evidencia[0]!.valor).toMatch(/Ana/);
    expect(h!.fuente.enlace).toBe("/campanas#bitacora");
    expect(h!.plataEnRiesgo).toBe(100_000 * 14);
  });
  test("sin bitácora no dispara", () => {
    expect(correr("R28", lote({ insights: serieAnuncio("ad_1") }))).toBeNull();
  });
});

describe("R27 por debajo de la competencia en subasta, según Meta", () => {
  const ranking = (anuncioId: string, interaccion: "promedio" | "inferior_35" | "inferior_20" | "sin_dato", conversion: "promedio" | "inferior_35" | "inferior_20" | "sin_dato") => ({
    fuente: "meta" as const, cuentaId: "act", anuncioId, nombre: anuncioId, fecha: HASTA, cohorte: "mensajes · públicos nuevos", calidad: "promedio" as const, interaccion, conversion, lecturaMeta: "x",
  });
  test("dispara con anuncios activos en tramo inferior; la evidencia enlaza a cada anuncio y la fuente es el ranking de Meta", () => {
    const l = lote({
      insights: [...serieAnuncio("ad_1", () => ({ gasto: 50_000 })), ...serieAnuncio("ad_2", () => ({ gasto: 30_000 }))],
      creativos: [creativo({ anuncioId: "ad_1", id: "c1" }), creativo({ anuncioId: "ad_2", id: "c2" })],
      rankings: [ranking("ad_1", "inferior_35", "inferior_20"), ranking("ad_2", "promedio", "promedio")],
    });
    const h = correr("R27", l);
    esperarHallazgoCompleto(h);
    expect(h!.titulo).toMatch(/1 anuncio/);
    expect(h!.evidencia[0]!.enlace).toBe("/creativos?anuncio=ad_1#anuncio-ad_1");
    expect(h!.fuente.origen).toMatch(/Meta/);
    expect(h!.plataEnRiesgo).toBe(50_000 * 14);
  });
  test("sin rankings (Meta no los entregó) no dispara: dato ausente, no cero", () => {
    const l = lote({ insights: serieAnuncio("ad_1"), creativos: [creativo({ anuncioId: "ad_1" })] });
    expect(correr("R27", l)).toBeNull();
  });
  test("anuncios sin dato todavía o al promedio no cuentan", () => {
    const l = lote({ insights: serieAnuncio("ad_1"), creativos: [creativo({ anuncioId: "ad_1" })], rankings: [ranking("ad_1", "sin_dato", "sin_dato")] });
    expect(correr("R27", l)).toBeNull();
  });
});

describe("R01 saturación de audiencia", () => {
  test("dispara con frecuencia alta y CTR de enlace cayendo", () => {
    const l = lote({
      insights: serieAnuncio("ad_1", (_d, f) =>
        esReciente(f) ? { alcance: 2_500, frecuencia: 4, clicsEnlace: 100 } : { alcance: 7_000, clicsEnlace: 200 },
      ),
    });
    const h = correr("R01", l);
    esperarHallazgoCompleto(h);
    expect(h!.plataEnRiesgo).toBeGreaterThan(0);
  });
  test("no dispara con frecuencia estable", () => {
    expect(correr("R01", lote({ insights: serieAnuncio("ad_1") }))).toBeNull();
  });
});

describe("R02 presión de subasta", () => {
  test("dispara si el CPM sube con CTR estable: no es el creativo", () => {
    const l = lote({ insights: serieAnuncio("ad_1", (_d, f) => (esReciente(f) ? { gasto: 150_000 } : {})) });
    esperarHallazgoCompleto(correr("R02", l));
  });
  test("no dispara si el CPM sube porque el CTR cayó (eso es R01/R07)", () => {
    const l = lote({
      insights: serieAnuncio("ad_1", (_d, f) => (esReciente(f) ? { gasto: 150_000, clics: 150, clicsEnlace: 100 } : {})),
    });
    expect(correr("R02", l)).toBeNull();
  });
});

describe("R07 fatiga creativa", () => {
  test("dispara con caída de CTR y frecuencia subiendo en un creativo con historia", () => {
    const l = lote({
      insights: serieAnuncio("ad_1", (d) => (d >= 45 ? { clicsEnlace: 60, clics: 90, alcance: 2_000, frecuencia: 5 } : {})),
      creativos: [creativo()],
    });
    const h = correr("R07", l);
    esperarHallazgoCompleto(h);
    expect(h!.evidencia.some((e) => /fatiga/i.test(e.etiqueta))).toBe(true);
  });
  test("no dispara con creativo fresco", () => {
    expect(correr("R07", lote({ insights: serieAnuncio("ad_1"), creativos: [creativo()] }))).toBeNull();
  });
});

describe("R10 inversión fuera del radio", () => {
  test("dispara con 22 % del gasto en Cartagena, Santa Marta y Bogotá; la plata es ese gasto", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      desgloses: [
        desglose({ dimension: "ubicacion", valor: "Barranquilla", gasto: 780_000 }),
        desglose({ dimension: "ubicacion", valor: "Cartagena", gasto: 100_000 }),
        desglose({ dimension: "ubicacion", valor: "Santa Marta", gasto: 70_000 }),
        desglose({ dimension: "ubicacion", valor: "Bogotá", gasto: 50_000 }),
      ],
    });
    const h = correr("R10", l);
    esperarHallazgoCompleto(h);
    expect(h!.plataEnRiesgo).toBe(220_000);
  });
  test("no dispara si todo está en el área metropolitana", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      desgloses: [
        desglose({ dimension: "ubicacion", valor: "Barranquilla", gasto: 800_000 }),
        desglose({ dimension: "ubicacion", valor: "Soledad", gasto: 200_000 }),
      ],
    });
    expect(correr("R10", l)).toBeNull();
  });
  test("Meta entrega departamentos: Atlántico (sin tilde) es el radio; «Unknown» no cuenta como fuera", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      desgloses: [
        desglose({ dimension: "ubicacion", valor: "Atlantico", gasto: 950_000 }),
        desglose({ dimension: "ubicacion", valor: "Magdalena", gasto: 20_000 }),
        desglose({ dimension: "ubicacion", valor: "Unknown", gasto: 30_000 }),
      ],
    });
    expect(correr("R10", l)).toBeNull();
  });
});

describe("R11 segmento que consume sin producir", () => {
  test("dispara con 65+ gastando 15 % y 0 resultados", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      desgloses: [
        desglose({ dimension: "edad", valor: "25-34", gasto: 500_000, resultados: 50 }),
        desglose({ dimension: "edad", valor: "35-44", gasto: 350_000, resultados: 30 }),
        desglose({ dimension: "edad", valor: "65+", gasto: 150_000, resultados: 0 }),
      ],
    });
    const h = correr("R11", l);
    esperarHallazgoCompleto(h);
    expect(h!.plataEnRiesgo).toBe(150_000);
  });
  test("la cuota se calcula por dimensión: las filas de género no diluyen a las de edad", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      desgloses: [
        desglose({ dimension: "edad", valor: "25-34", gasto: 850_000, resultados: 50 }),
        desglose({ dimension: "edad", valor: "65+", gasto: 150_000, resultados: 0 }),
        desglose({ dimension: "genero", valor: "mujer", gasto: 800_000, resultados: 45 }),
        desglose({ dimension: "genero", valor: "hombre", gasto: 200_000, resultados: 5 }),
      ],
    });
    const h = correr("R11", l);
    esperarHallazgoCompleto(h);
    expect(h!.plataEnRiesgo).toBe(150_000);
  });

  test("ignora segmentos ocultos por privacidad (n < 5)", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      desgloses: [
        desglose({ dimension: "edad", valor: "25-34", gasto: 800_000, resultados: 50 }),
        desglose({ dimension: "edad", valor: "65+", gasto: 200_000, resultados: 0, nRegistros: 3 }),
      ],
    });
    expect(correr("R11", l)).toBeNull();
  });
  test("si la dimensión entera viene sin resultados (la fuente no los entrega), no es que nadie produzca: no dispara", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      desgloses: [
        desglose({ dimension: "edad", valor: "25-34", gasto: 500_000, resultados: 0 }),
        desglose({ dimension: "edad", valor: "35-44", gasto: 350_000, resultados: 0 }),
        desglose({ dimension: "genero", valor: "mujer", gasto: 850_000, resultados: 0 }),
      ],
    });
    expect(correr("R11", l)).toBeNull();
  });
  test("con culpables en edad y en género, la cuota y la plata no se suman entre dimensiones (es la misma plata)", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      desgloses: [
        desglose({ dimension: "edad", valor: "25-34", gasto: 800_000, resultados: 50 }),
        desglose({ dimension: "edad", valor: "65+", gasto: 200_000, resultados: 0 }),
        desglose({ dimension: "genero", valor: "mujer", gasto: 700_000, resultados: 50 }),
        desglose({ dimension: "genero", valor: "hombre", gasto: 300_000, resultados: 0 }),
      ],
    });
    const h = correr("R11", l);
    esperarHallazgoCompleto(h);
    expect(h!.plataEnRiesgo).toBe(300_000);
    expect(h!.titulo).toContain("30 %");
    expect(h!.titulo).toContain("65+");
  });
});

describe("R26 la página no alcanza a cargar", () => {
  test("solo mira los anuncios que llevan a una página: los de mensajes no tienen vistas y no son fuga", () => {
    const l = lote({
      insights: [
        ...serieAnuncio("ad_pagina", () => ({ clicsEnlace: 100, vistasLandingPage: 90 })),
        ...serieAnuncio("ad_chat", () => ({ clicsEnlace: 900, vistasLandingPage: null })),
      ],
    });
    expect(correr("R26", l)).toBeNull();
  });
  test("dispara cuando los anuncios con página sí pierden la mayoría de los clics", () => {
    const l = lote({
      insights: [
        ...serieAnuncio("ad_pagina", () => ({ clicsEnlace: 100, vistasLandingPage: 20 })),
        ...serieAnuncio("ad_chat", () => ({ clicsEnlace: 900, vistasLandingPage: null })),
      ],
    });
    const h = correr("R26", l);
    esperarHallazgoCompleto(h);
    expect(h!.titulo).toContain("80 %");
  });
});

describe("R12 franja horaria improductiva", () => {
  test("dispara con la mitad de la pauta corriendo fuera del horario de atención", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      desgloses: Array.from({ length: 24 }, (_, h) => desglose({ dimension: "hora", valor: String(h), gasto: 10_000 })),
    });
    const h = correr("R12", l);
    esperarHallazgoCompleto(h);
    expect(h!.plataEnRiesgo).toBeGreaterThan(0);
  });
  test("no dispara si la pauta corre en horario", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      desgloses: Array.from({ length: 10 }, (_, i) => desglose({ dimension: "hora", valor: String(8 + i), gasto: 10_000 })),
    });
    expect(correr("R12", l)).toBeNull();
  });
});

describe("R15 inasistencia a citas — la más importante", () => {
  test("dispara con 40 % de inasistencia, valoriza al costo y usa la redacción esperada", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      embudo: embudoDiario({ cita_agendada: 100, cita_asistida: 60 }),
    });
    const h = correr("R15", l);
    esperarHallazgoCompleto(h);
    expect(h!.titulo).toMatch(/40,0 % de las citas agendadas no se presentan/);
    expect(h!.explicacion).toMatch(/dos veces/);
    expect(h!.acciones.join(" ")).toMatch(/24/);
    expect(h!.plataEnRiesgo).toBeGreaterThan(0);
  });
  test("no dispara con asistencia sana", () => {
    const l = lote({ insights: serieAnuncio("ad_1"), embudo: embudoDiario({ cita_agendada: 100, cita_asistida: 85 }) });
    expect(correr("R15", l)).toBeNull();
  });
});

describe("R18 caída semanal en el embudo — ventanas iguales", () => {
  test("dispara si las citas asistidas de la última quincena caen > 20 % contra la quincena anterior", () => {
    const previa = { desde: sumarDias(recienteDesde, -14), hasta: sumarDias(recienteDesde, -1) };
    const l = lote({
      insights: serieAnuncio("ad_1"),
      embudo: [
        ...embudoDiario({ cita_agendada: 40, cita_asistida: 30 }, previa.desde, previa.hasta),
        ...embudoDiario({ cita_agendada: 40, cita_asistida: 15 }, recienteDesde, HASTA),
      ],
    });
    const h = correr("R18", l);
    esperarHallazgoCompleto(h);
    expect(h!.evidencia.some((e) => e.valor.includes("14"))).toBe(true);
  });
  test("no dispara con ventanas estables", () => {
    const l = lote({ insights: serieAnuncio("ad_1"), embudo: embudoDiario({ cita_agendada: 100, cita_asistida: 80 }) });
    expect(correr("R18", l)).toBeNull();
  });
});

describe("R19 CAC por encima del margen", () => {
  test("dispara cuando cada paciente cuesta más de lo que deja", () => {
    // gasto 6.000.000 (60 días × 100.000) y 6 ventas → CAC 1.000.000 > margen 500.000
    const l = lote({ insights: serieAnuncio("ad_1"), embudo: embudoDiario({ cita_asistida: 20, venta: 6 }, DESDE, HASTA, 800_000) });
    const h = correr("R19", l, calibrado);
    esperarHallazgoCompleto(h);
    expect(h!.plataEnRiesgo).toBeCloseTo((1_000_000 - 500_000) * 6, -2);
  });
  test("sin calibrar no dispara (no se inventa margen)", () => {
    const l = lote({ insights: serieAnuncio("ad_1"), embudo: embudoDiario({ venta: 6 }) });
    expect(correr("R19", l)).toBeNull();
  });
});

describe("R21 presupuesto insuficiente para aprender", () => {
  test("dispara con conjuntos gastando menos del mínimo diario", () => {
    const l = lote({
      insights: [
        ...serieAnuncio("adset_1", () => ({ nivel: "conjunto", padreId: "camp_1", gasto: 15_000 })),
        ...serieAnuncio("ad_1"),
      ],
    });
    esperarHallazgoCompleto(correr("R21", l));
  });
  test("no dispara con presupuesto suficiente", () => {
    const l = lote({
      insights: [...serieAnuncio("adset_1", () => ({ nivel: "conjunto", padreId: "camp_1", gasto: 100_000 })), ...serieAnuncio("ad_1")],
    });
    expect(correr("R21", l)).toBeNull();
  });
});

describe("R22 retorno no verificable", () => {
  test("dispara si no hay datos de agenda ni ventas", () => {
    const h = correr("R22", lote({ insights: serieAnuncio("ad_1") }));
    esperarHallazgoCompleto(h);
    expect(h!.severidad).toBe("alta");
  });
  test("no dispara con cobertura de ventas suficiente", () => {
    const l = lote({ insights: serieAnuncio("ad_1"), embudo: embudoDiario({ cita_asistida: 60, venta: 30 }) });
    expect(correr("R22", l)).toBeNull();
  });
});

describe("R23 huecos en los datos", () => {
  test("dispara si faltan días en el rango y los lista", () => {
    const sinDosDias = serieAnuncio("ad_1").filter((f) => f.fecha !== "2026-08-10" && f.fecha !== "2026-08-11");
    const h = correr("R23", lote({ insights: sinDosDias }));
    esperarHallazgoCompleto(h);
    expect(h!.evidencia.some((e) => e.valor.includes("2026-08-10"))).toBe(true);
  });
  test("no dispara sin huecos", () => {
    expect(correr("R23", lote({ insights: serieAnuncio("ad_1") }))).toBeNull();
  });
});

describe("R24 el mercado prueba más rápido", () => {
  test("dispara si la competencia lanza más anuncios nuevos por semana que la cuenta", () => {
    const nuevos = Array.from({ length: 12 }, (_, i) =>
      anuncioCompetidor({ anuncioId: `cx_${i}`, competidorId: `comp_${i % 3}`, primeraVez: sumarDias(HASTA, -i * 2), diasCorriendo: i * 2 }),
    );
    const l = lote({ insights: serieAnuncio("ad_1"), creativos: [creativo()], anunciosCompetencia: nuevos });
    esperarHallazgoCompleto(correr("R24", l));
  });
});

describe("trazabilidad: cada hallazgo dice de dónde sale y la evidencia lleva al dato", () => {
  test("R12 apunta a la tabla de horas de Audiencias y su evidencia es clicable", () => {
    const l = lote({ insights: serieAnuncio("ad_1"), desgloses: Array.from({ length: 24 }, (_, h) => desglose({ dimension: "hora", valor: String(h), gasto: 10_000 })) });
    const h = correr("R12", l)!;
    expect(h.fuente.enlace).toBe("/audiencias#hora");
    expect(h.fuente.origen).toMatch(/Meta/);
    expect(h.evidencia[0]!.enlace).toBe("/audiencias#hora");
  });
  test("R05 enlaza cada video a su fila en Creativos", () => {
    const l = lote({ insights: serieAnuncio("ad_1", () => ({ impresiones: 20_000, gasto: 200_000, clicsEnlace: 100, resultados: 12, reproducciones3s: 400, reproducciones: 20_000 })), creativos: [creativo({ anuncioId: "ad_1", formato: "video" })] });
    const h = correr("R05", l);
    expect(h).not.toBeNull();
    expect(h!.evidencia[0]!.enlace).toBe("/creativos?anuncio=ad_1#anuncio-ad_1");
    expect(h!.fuente.enlace).toBe("/creativos");
  });
  test("todas las reglas que disparan sobre el seed traen fuente y enlaces válidos", () => {
    const ctx = construirContexto(generarSeed(), cliente, benchmarks, "2026-09-12");
    const r = ejecutarReglas(ctx, REGLAS);
    expect(r.errores).toHaveLength(0);
    expect(r.hallazgos.length).toBeGreaterThan(5);
    for (const h of r.hallazgos) esperarHallazgoCompleto(h);
  });
});

describe("motor completo sobre un lote sano", () => {
  test("un lote sano y calibrado produce pocos hallazgos y ningún error", () => {
    const l = lote({
      insights: serieAnuncio("ad_1"),
      creativos: [creativo()],
      embudo: embudoDiario({ impresion: 600_000, clic: 12_000, conversacion: 2_400, lead_calificado: 1_200, cita_agendada: 700, cita_asistida: 600, venta: 300, recompra: 60 }, DESDE, HASTA, 800_000),
    });
    const ctx = construirContexto(l, calibrado, benchmarks, HOY);
    const r = ejecutarReglas(ctx, REGLAS);
    expect(r.errores).toHaveLength(0);
    expect(r.hallazgos.length).toBeLessThan(6);
  });
});
