import { describe, expect, test } from "vitest";
import { correrMotor, fuenteActiva } from "@/lib/datos";
import { generarSeed } from "@/scripts/seed";

describe("correrMotor sobre el seed — encuentra los patrones plantados", () => {
  const lote = generarSeed();

  test("produce el resultado completo sin errores de reglas", async () => {
    const r = await correrMotor(lote);
    expect(r.erroresReglas).toEqual([]);
    expect(r.embudo).toHaveLength(8);
    expect(r.catalogo).toHaveLength(145);
    expect(r.lentes).toHaveLength(7);
    expect(r.creativos.length).toBeGreaterThanOrEqual(3); // solo los de la cuenta principal
    expect(r.oportunidades.length).toBeGreaterThan(3);
    expect(r.hoy).toBe(lote.meta.hasta);
  });

  test("encuentra al menos 8 patrones plantados (§11)", async () => {
    const r = await correrMotor(lote);
    const ids = new Set(r.hallazgos.map((h) => h.reglaId));
    const esperados = ["R07", "R10", "R15", "R11", "R02", "R12", "R23", "R24"];
    const encontrados = esperados.filter((id) => ids.has(id));
    expect(encontrados.length, `encontrados: ${[...ids].join(", ")}`).toBeGreaterThanOrEqual(8);
  });

  test("los hallazgos vienen ordenados por plata y ninguno inventa cifras (null se conserva)", async () => {
    const r = await correrMotor(lote);
    const conPlata = r.hallazgos.filter((h) => h.plataEnRiesgo !== null).map((h) => h.plataEnRiesgo!);
    for (let i = 1; i < conPlata.length; i++) expect(conPlata[i - 1]).toBeGreaterThanOrEqual(conPlata[i]!);
    expect(r.hallazgos.some((h) => h.plataEnRiesgo === null)).toBe(true); // p. ej. R23 huecos
  });

  test("sin calibrar, POAS y CAC/margen son null; el retorno real sí se calcula", async () => {
    const r = await correrMotor(lote);
    expect(r.negocio.poas).toBeNull();
    expect(r.negocio.ratioCacMargen).toBeNull();
    expect(r.negocio.roasReal).not.toBeNull();
    expect(r.negocio.calibrado).toBe(false);
  });

  test("la inasistencia plantada se detecta en la ventana reciente y la fuga más cara está en pesos", async () => {
    const r = await correrMotor(lote);
    const r15 = r.hallazgos.find((h) => h.reglaId === "R15");
    expect(r15).toBeDefined();
    expect(r15!.evidencia.some((e) => e.valor === "últimos 14 días")).toBe(true);
    expect(r.fugaMasCara).not.toBeNull();
    expect(r.fugaMasCara!.fugaCOP).toBeGreaterThan(0);
    expect(r.embudo[1]!.fugaCOP).toBeNull(); // impresión→clic no se valoriza
  });

  test("privacidad: reporta cuántos segmentos se ocultaron", async () => {
    const r = await correrMotor(lote);
    expect(r.privacidad.k).toBe(5);
    expect(r.privacidad.segmentosOcultos).toBeGreaterThanOrEqual(0);
  });

  test("las métricas maestras se resuelven a valores (o null), nunca a NaN/Infinity", async () => {
    const r = await correrMotor(lote);
    for (const m of r.maestras) {
      if (typeof m.valor === "number") expect(Number.isFinite(m.valor), m.id).toBe(true);
    }
    expect(r.maestras.length).toBeGreaterThanOrEqual(16);
  });
});

describe("fuenteActiva", () => {
  test("por defecto es demostración; con ORACULO_FUENTE=archivo es la real", () => {
    expect(fuenteActiva("seed").nombre).toBe("demostracion");
    expect(fuenteActiva("archivo").nombre).toBe("campanas_y_audiencias");
    expect(fuenteActiva(undefined).nombre).toBe("demostracion");
  });
});

describe("cuentas publicitarias — una cuenta a la vez", () => {
  const lote = generarSeed();

  test("el seed trae 3 cuentas y correrMotor sin cuenta usa la principal", async () => {
    const r = await correrMotor(lote);
    expect(r.cuentas.length).toBe(3);
    expect(r.cuenta.id).toBe(r.cuentas[0]!.id);
    expect(r.cuentas.map((c) => c.nombre)).toContain("Vivante Riomar");
    expect(r.cuentas.filter((c) => c.activa).length).toBe(2);
  });

  test("con otra cuenta, las cifras cambian y el radar es el mismo (compartido)", async () => {
    const a = await correrMotor(lote, { cuentaId: "act_1048227" });
    const b = await correrMotor(lote, { cuentaId: "act_2213904" });
    expect(a.cuenta.id).toBe("act_1048227");
    expect(b.cuenta.id).toBe("act_2213904");
    expect(a.total.gasto).not.toBe(b.total.gasto);
    expect(a.total.gasto + b.total.gasto).toBeCloseTo(lote.insights.filter((i) => i.nivel === "anuncio").reduce((s, i) => s + i.gasto, 0), 0);
    expect(a.radar.ganadores.length).toBe(b.radar.ganadores.length);
  });

  test("cuenta desconocida → principal sin error; cuenta sin pauta → gasto 0 y sin hallazgos valorizados", async () => {
    const r = await correrMotor(lote, { cuentaId: "act_no_existe" });
    expect(r.cuenta.id).toBe(r.cuentas[0]!.id);
    const vacia = await correrMotor(lote, { cuentaId: "act_3390118" });
    expect(vacia.cuenta.activa).toBe(false);
    expect(vacia.total.gasto).toBe(0);
    expect(vacia.negocio.roasReal).toBeNull();
  });

  test("nunca se suman las cuentas por defecto: el gasto de la principal es menor que el total del lote", async () => {
    const r = await correrMotor(lote);
    const totalLote = lote.insights.filter((i) => i.nivel === "anuncio").reduce((s, i) => s + i.gasto, 0);
    expect(r.total.gasto).toBeLessThan(totalLote);
  });
});

describe("campos que consume la interfaz", () => {
  const lote = generarSeed();

  test("serie incluye los huecos con agregado null", async () => {
    const r = await correrMotor(lote);
    const huecos = r.serie.filter((p) => p.agregado === null).map((p) => p.fecha);
    expect(huecos).toEqual(lote.meta.huecos);
    expect(r.serie[0]!.agregado!.ctrEnlace).not.toBeUndefined();
  });

  test("total/reciente/previa traen derivadas (ctrEnlace, cpm, costoResultado) calculadas desde sumas", async () => {
    const r = await correrMotor(lote);
    expect(r.total.cpm).toBeCloseTo((r.total.gasto / r.total.impresiones) * 1000);
    expect(r.total.ctrEnlace).toBeCloseTo(r.total.clicsEnlace / r.total.impresiones);
    expect(r.negocio.roasDeclarado).toBeNull(); // el seed no trae valorConversion
  });

  test("desgloses enriquecidos: costo por resultado, fuera de radio y fuera de horario", async () => {
    const r = await correrMotor(lote);
    const cartagena = r.desgloses.find((d) => d.dimension === "ubicacion" && d.valor === "Cartagena");
    expect(cartagena?.fueraDeRadio).toBe(true);
    expect(r.desgloses.find((d) => d.dimension === "ubicacion" && d.valor === "Barranquilla")?.fueraDeRadio).toBe(false);
    expect(r.desgloses.find((d) => d.dimension === "hora" && d.valor === "3")?.fueraDeHorario).toBe(true);
    expect(r.desgloses.find((d) => d.dimension === "hora" && d.valor === "10")?.fueraDeHorario).toBe(false);
    expect(r.desgloses.find((d) => d.dimension === "edad" && d.valor === "65+")?.costoResultado).toBeNull();
  });

  test("radar por competidor: cadencia, voz y movimientos semanales; perfiles con id/anuncios60/seguidores", async () => {
    const r = await correrMotor(lote);
    expect(r.radar.cadenciaPorCompetidor.length).toBe(6);
    expect(r.radar.vozPorCompetidor.reduce((s, c) => s + c.porcentaje, 0)).toBeCloseTo(1, 5);
    expect(r.radar.movimientosSemanales.length).toBeGreaterThanOrEqual(4);
    expect(r.radar.perfiles[0]).toHaveProperty("id");
    expect(r.radar.perfiles[0]).toHaveProperty("anuncios60");
    expect(r.radar.perfiles[0]).toHaveProperty("seguidoresPagina");
    expect(r.radar.espaciosVacios[0]?.porQue.length).toBeGreaterThan(10);
    expect(r.privacidad.AVISO_PANEL.length).toBeGreaterThan(20);
  });
});

describe("desgloses agregados por segmento (sumas de crudos, nunca promedios)", () => {
  test("una fila por dimensión × valor; gasto = suma de los días; nRegistros = máximo diario", async () => {
    const lote = generarSeed();
    const r = await correrMotor(lote);
    const claves = r.desgloses.map((d) => `${d.dimension}|${d.valor}`);
    expect(new Set(claves).size).toBe(claves.length);
    const barranquilla = r.desgloses.find((d) => d.dimension === "ubicacion" && d.valor === "Barranquilla")!;
    const diarias = lote.desgloses.filter((d) => d.cuentaId === r.cuenta.id && d.dimension === "ubicacion" && d.valor === "Barranquilla");
    expect(barranquilla.gasto).toBeCloseTo(diarias.reduce((s, d) => s + d.gasto, 0), 3);
    expect(barranquilla.nRegistros).toBe(Math.max(...diarias.map((d) => d.nRegistros)));
    expect(barranquilla.costoResultado).toBeCloseTo(barranquilla.gasto / barranquilla.resultados, 3);
    expect(r.desgloses.length).toBeLessThan(80);
  });
});
