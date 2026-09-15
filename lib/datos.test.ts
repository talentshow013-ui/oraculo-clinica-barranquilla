import { describe, expect, test } from "vitest";
import { campanasEnPeriodo, comoNosFue, compararSeleccion, correrMotor, filtrarPorCampana, filtrarPorCuenta, filtrarPorRango, fuenteActiva } from "@/lib/datos";
import { diasEntre, sumarDias } from "@/lib/format/fechas";
import { CUENTAS_SEED, generarSeed } from "@/scripts/seed";

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

  test("las cuentas configuradas aparecen todas; el seed pauta en las dos primeras; sin cuenta se usa la principal", async () => {
    const r = await correrMotor(lote);
    expect(r.cuentas.length).toBe(CUENTAS_SEED.length);
    expect(r.cuenta.id).toBe(r.cuentas[0]!.id);
    expect(r.cuentas.map((c) => c.id)).toEqual(CUENTAS_SEED);
    expect(r.cuentas.filter((c) => c.activa).map((c) => c.id)).toEqual(CUENTAS_SEED.slice(0, 2));
  });

  test("con otra cuenta, las cifras cambian y el radar es el mismo (compartido)", async () => {
    const a = await correrMotor(lote, { cuentaId: CUENTAS_SEED[0]! });
    const b = await correrMotor(lote, { cuentaId: CUENTAS_SEED[1]! });
    expect(a.cuenta.id).toBe(CUENTAS_SEED[0]!);
    expect(b.cuenta.id).toBe(CUENTAS_SEED[1]!);
    expect(a.total.gasto).not.toBe(b.total.gasto);
    expect(a.total.gasto + b.total.gasto).toBeCloseTo(lote.insights.filter((i) => i.nivel === "anuncio").reduce((s, i) => s + i.gasto, 0), 0);
    expect(a.radar.ganadores.length).toBe(b.radar.ganadores.length);
  });

  test("cuenta desconocida → principal sin error; cuenta sin pauta → gasto 0 y sin hallazgos valorizados", async () => {
    const r = await correrMotor(lote, { cuentaId: "act_no_existe" });
    expect(r.cuenta.id).toBe(r.cuentas[0]!.id);
    const vacia = await correrMotor(lote, { cuentaId: CUENTAS_SEED[2]! });
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

describe("campañas con cara propia — vivas y terminadas en la misma lista", () => {
  const lote = generarSeed();

  test("la cuenta principal trae la campaña terminada (pausada) junto a la viva; nunca desaparece", async () => {
    const r = await correrMotor(lote);
    const ids = r.campanas.map((c) => c.id);
    expect(ids).toContain("camp_facial");
    expect(ids).toContain("camp_madre");
    const madre = r.campanas.find((c) => c.id === "camp_madre")!;
    expect(madre.estado).toBe("pausado");
    expect(madre.alAire).toBe(false);
    expect(madre.ultimoDia).not.toBeNull();
    expect(madre.ultimoDia! < r.hoy).toBe(true);
    expect(madre.costoResultado).not.toBeNull();
    expect(r.campanas.find((c) => c.id === "camp_facial")!.alAire).toBe(true);
  });

  test("campanasEnPeriodo: en los últimos 14 días la terminada no aparece; en «todo» sí; periodo inválido → todo", async () => {
    const r = await correrMotor(lote);
    const quincena = campanasEnPeriodo(r, "14");
    expect(quincena.periodo).toBe("14");
    expect(diasEntre(quincena.desde, quincena.hasta)).toBe(14);
    expect(quincena.campanas.map((c) => c.id)).not.toContain("camp_madre");
    expect(campanasEnPeriodo(r, "todo").campanas.map((c) => c.id)).toContain("camp_madre");
    expect(campanasEnPeriodo(r, "loquesea").periodo).toBe("todo");
  });

  test("las campañas de una cuenta no se mezclan con las de otra", async () => {
    const norte = await correrMotor(lote, { cuentaId: CUENTAS_SEED[1]! });
    expect(norte.campanas.map((c) => c.id).sort()).toEqual(["camp_corporal", "camp_laser"]);
  });
});

describe("¿qué se ve cuando se apaga la pauta? — el motor no se cae ni inventa", () => {
  test("sin filas en los últimos 14 días: gasto reciente 0, razones «—» (null), sin errores de reglas, historia intacta", async () => {
    const base = generarSeed();
    const corte = sumarDias(base.meta.hasta, -20);
    const apagado = { ...base, insights: base.insights.filter((i) => i.fecha <= corte), desgloses: base.desgloses.filter((d) => d.fecha <= corte) };
    const r = await correrMotor(apagado);
    expect(r.erroresReglas).toEqual([]);
    expect(r.reciente.gasto).toBe(0);
    expect(r.reciente.costoResultado).toBeNull();
    expect(r.reciente.cpm).toBeNull();
    expect(r.previa.gasto).toBeGreaterThan(0);
    expect(r.total.gasto).toBeGreaterThan(0);
    for (const c of r.campanas) expect(c.alAire).toBe(false);
    expect(r.campanas.length).toBeGreaterThan(0);
    for (const m of r.maestras) expect(Number.isNaN(m.valor as number)).toBe(false);
  });
});

describe("R04 con la pauta apagada", () => {
  test("dice que la pauta está apagada, no «Solo 0 anuncios»", async () => {
    const base = generarSeed();
    const corte = sumarDias(base.meta.hasta, -20);
    const r = await correrMotor({ ...base, insights: base.insights.filter((i) => i.fecha <= corte) });
    const r04 = r.hallazgos.find((h) => h.reglaId === "R04")!;
    expect(r04.titulo).toMatch(/apagada/);
    expect(r04.titulo).not.toMatch(/Solo 0/);
  });
});

describe("resultados por pauta — por cuenta y campaña; no contaminan otras cuentas ni tocan lo de Meta", () => {
  const registro = { cuentaId: CUENTAS_SEED[0]!, campanaId: "camp_facial", contactosCerrados: 600, citasAgendadas: 300, citasAsistidas: 150, ventas: 60, valorVentasCOP: 42_000_000, registradoEn: "2026-09-08T09:00:00-05:00" };

  test("lo de Meta no cambia; la campaña recibe sus citas y ventas; el total del periodo es exacto", async () => {
    const lote = generarSeed();
    const a = await correrMotor(lote, { resultados: [] });
    const d = await correrMotor(lote, { resultados: [registro] });
    expect(d.total.gasto).toBe(a.total.gasto);
    expect(d.total.cpm).toBe(a.total.cpm);
    expect(d.creativos.length).toBe(a.creativos.length);
    const facial = d.campanas.find((c) => c.id === "camp_facial")!;
    expect(facial.citasAsistidas).toBe(150);
    expect(facial.ventas).toBe(60);
    expect(facial.valorVentasCOP).toBe(42_000_000);
    expect(facial.costoCitaAsistida).toBeCloseTo(facial.total.gasto / 150);
    expect(d.resultadosPauta).toHaveLength(1);
  });

  test("lo registrado para Riomar no aparece en la cuenta Norte", async () => {
    const lote = generarSeed();
    const norte = await correrMotor(lote, { resultados: [registro], cuentaId: CUENTAS_SEED[1]! });
    expect(norte.resultadosPauta).toHaveLength(0);
    expect(norte.lote.embudo.some((r) => r.campanaId === "camp_facial")).toBe(false);
  });
});

describe("comoNosFue y compararSeleccion — lo que se lee en la reunión", () => {
  test("con resultados registrados la campaña recibe veredicto con razones y sus creativos con lectura", async () => {
    const lote = generarSeed();
    const registro = { cuentaId: CUENTAS_SEED[0]!, campanaId: "camp_madre", contactosCerrados: 90, citasAgendadas: 48, citasAsistidas: 33, ventas: 15, valorVentasCOP: 9_750_000, registradoEn: "2026-09-08T09:00:00-05:00" };
    const r = await correrMotor(lote, { resultados: [registro] });
    const x = comoNosFue(r, "camp_madre")!;
    expect(["sirvio", "a_medias", "no_sirvio"]).toContain(x.veredicto.veredicto);
    expect(x.veredicto.razones.length).toBeGreaterThanOrEqual(3);
    expect(x.creativos.length).toBe(2);
    expect(x.creativos.every((c) => c.lectura.length > 5)).toBe(true);
    expect(comoNosFue(r, "camp_laser")).toBeNull(); // otra cuenta
    // Sin ningún dato de clínica (ni registrado ni sincronizado) el veredicto lo dice y pide los Resultados.
    const sinDatos = await correrMotor({ ...lote, embudo: [] }, { resultados: [] });
    expect(comoNosFue(sinDatos, "camp_facial")!.veredicto.veredicto).toBe("sin_resultados");
  });

  test("compararSeleccion respeta el periodo e ignora ids que no existen", async () => {
    const r = await correrMotor(generarSeed());
    const c = compararSeleccion(r, ["camp_facial", "camp_madre", "no_existe"], "todo");
    expect(c.campanas.map((x) => x.id)).toEqual(["camp_facial", "camp_madre"]);
    expect(c.metricas.length).toBeGreaterThan(5);
    expect(compararSeleccion(r, ["camp_facial", "camp_madre"], "14").campanas.map((x) => x.id)).toEqual(["camp_facial"]);
  });
});

describe("filtro de campaña — todo el panel se recalcula para UNA pauta", () => {
  test("filtrarPorCampana deja solo la campaña, sus conjuntos, sus anuncios, sus creativos y su embudo; el radar sigue", () => {
    const lote = generarSeed();
    const riomar = filtrarPorCuenta(lote, CUENTAS_SEED[0]!);
    const f = filtrarPorCampana(riomar, "camp_madre");
    expect(f.insights.every((i) => (i.nivel === "campana" && i.id === "camp_madre") || (i.nivel === "conjunto" && i.padreId === "camp_madre") || (i.nivel === "anuncio" && i.padreId === "adset_madre_mujeres"))).toBe(true);
    expect(f.insights.some((i) => i.nivel === "anuncio")).toBe(true);
    expect(f.creativos.every((c) => c.anuncioId.startsWith("ad_madre"))).toBe(true);
    expect(f.creativos.length).toBe(2);
    expect(f.embudo.every((r) => r.campanaId === "camp_madre")).toBe(true);
    expect(f.anunciosCompetencia.length).toBe(lote.anunciosCompetencia.length);
    // Los desgloses del seed son de nivel cuenta: por campaña no hay, y se dice.
    expect(f.desgloses).toEqual([]);
  });

  test("correrMotor con campanaId: cifras de esa campaña, campana activa, lista completa para el selector, cuenta intacta", async () => {
    const lote = generarSeed();
    const todas = await correrMotor(lote, { cuentaId: CUENTAS_SEED[0]! });
    const madre = await correrMotor(lote, { cuentaId: CUENTAS_SEED[0]!, campanaId: "camp_madre" });
    expect(madre.campanaActiva?.id).toBe("camp_madre");
    expect(madre.cuenta.id).toBe(CUENTAS_SEED[0]!);
    expect(madre.total.gasto).toBeLessThan(todas.total.gasto);
    expect(madre.total.gasto).toBe(todas.campanas.find((c) => c.id === "camp_madre")!.total.gasto);
    expect(madre.creativos.length).toBe(2);
    expect(madre.campanasCuenta.map((c) => c.id).sort()).toEqual(["camp_facial", "camp_madre"]);
    expect(madre.desglosesPorCampana).toBe(false);
    expect(madre.erroresReglas).toEqual([]);
    expect(todas.campanaActiva).toBeNull();
    expect(todas.desglosesPorCampana).toBe(true);
  });

  test("campaña que no es de la cuenta → se ignora (todas)", async () => {
    const r = await correrMotor(generarSeed(), { cuentaId: CUENTAS_SEED[0]!, campanaId: "camp_laser" });
    expect(r.campanaActiva).toBeNull();
    expect(r.total.gasto).toBeGreaterThan(0);
  });
});

describe("periodo elegido con calendario (desde/hasta)", () => {
  const lote = generarSeed();
  test("filtrarPorRango recorta insights y embudo a las fechas, ajusta meta y conserva los desgloses (son de los últimos 28 días)", () => {
    const r = filtrarPorRango(lote, "2026-08-01", "2026-08-14");
    expect(r.meta.desde).toBe("2026-08-01");
    expect(r.meta.hasta).toBe("2026-08-14");
    expect(r.insights.every((i) => i.fecha >= "2026-08-01" && i.fecha <= "2026-08-14")).toBe(true);
    expect(r.embudo.every((i) => i.fecha >= "2026-08-01" && i.fecha <= "2026-08-14")).toBe(true);
    expect(r.desgloses.length).toBe(lote.desgloses.length);
  });
  test("fechas fuera del lote se recortan al lote; desde > hasta se invierte; sin fechas no cambia nada", () => {
    const r = filtrarPorRango(lote, "2000-01-01", "2999-01-01");
    expect(r.meta.desde).toBe(lote.meta.desde);
    expect(r.meta.hasta).toBe(lote.meta.hasta);
    const inv = filtrarPorRango(lote, "2026-08-14", "2026-08-01");
    expect(inv.meta.desde).toBe("2026-08-01");
    expect(filtrarPorRango(lote, undefined, undefined)).toBe(lote);
  });
  test("el motor con desde/hasta analiza solo ese periodo: hoy = hasta, ventanas dentro del rango, y lo dice en r.periodo", async () => {
    const r = await correrMotor(lote, { desde: "2026-08-01", hasta: "2026-08-28" });
    expect(r.periodo).toEqual({ desde: "2026-08-01", hasta: "2026-08-28", elegido: true, minimo: lote.meta.desde, maximo: lote.meta.hasta });
    expect(r.hoy).toBe("2026-08-28");
    expect(r.contexto.ventanas.reciente.hasta).toBe("2026-08-28");
    expect(r.contexto.ventanas.previa.desde >= "2026-08-01").toBe(true);
    expect(r.serie[0]?.fecha).toBe("2026-08-01");
    const todo = await correrMotor(lote);
    expect(todo.periodo.elegido).toBe(false);
    expect(todo.total.gasto).toBeGreaterThan(r.total.gasto);
  });
});

describe("lo que se pinta arriba y en Creativos", () => {
  const lote = generarSeed();
  test("las cifras que mandan salen en orden de importancia y sin las que no tienen dato", async () => {
    const r = await correrMotor(lote);
    expect(r.maestras.every((m) => m.valor !== null && m.valor !== undefined)).toBe(true);
    expect(r.maestras[0]?.id).toBe("inversion");
    const ids = r.maestras.map((m) => m.id);
    expect(ids.indexOf("costo_conversacion")).toBeLessThan(ids.indexOf("frecuencia"));
    expect(ids).not.toContain("poas"); // sin calibrar no hay margen: no se pinta
  });
  test("los creativos vienen del mejor al peor con su puesto (1 = el más exitoso)", async () => {
    const r = await correrMotor(lote);
    expect(r.creativos.map((c) => c.puesto)).toEqual(r.creativos.map((_, i) => i + 1));
    const orden = { escalar: 0, arreglar_oferta: 1, arreglar_gancho: 1, matar: 2, sin_senal: 3 } as const;
    for (let i = 1; i < r.creativos.length; i++) expect(orden[r.creativos[i - 1]!.cuadrante]).toBeLessThanOrEqual(orden[r.creativos[i]!.cuadrante]);
  });
});
