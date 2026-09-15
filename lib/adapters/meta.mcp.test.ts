import { describe, expect, test } from "vitest";
import { InsightRowSchema, BreakdownRowSchema } from "./types";
import { esFruto, mapearDesgloseMeta, mapearFilaMeta, numeroMeta, pesosMeta, resultadoMeta, estadoMeta, parsearRespuesta, type FilaMetaCruda } from "./meta.mcp";

/** Una fila tal cual la entrega el conector (día × campaña). */
const cruda: FilaMetaCruda = {
  date_start: "2026-09-10",
  date_stop: "2026-09-10",
  amount_spent: "$ 1.234.567 COP",
  impressions: "98765",
  reach: "54321",
  frequency: "1.82",
  clicks: "1200",
  link_click: "800",
  unique_link_click: "760",
  results: { indicator: "actions:onsite_conversion.messaging_conversation_started_7d", value: "57" },
  result_values: { indicator: "action_values:onsite_conversion.messaging_conversation_started_7d", value: "Not available" },
  omni_landing_page_view: null,
  post_engagement: "1500",
  post_reaction: "300",
  comment: "12",
  post_shares: "8",
  post_save: "20",
  video_play_actions: "40000",
  "3_second_video_plays": "12000",
  video_continuous_2_sec_watched_actions: "15000",
  video_thruplay_watched_actions: "4000",
  video_p25_watched_actions: "9000",
  video_p50_watched_actions: "6000",
  video_p75_watched_actions: "4500",
  video_p95_watched_actions: "3000",
  video_p100_watched_actions: "2800",
  video_avg_time_watched_actions: "7",
  onsite_conversion_lead_grouped: null,
  id: "120245602002100151",
  name: "✅ VENTAS I PUBLICOS FRIOS",
  status: "PAUSED",
  effective_status: "PAUSED",
  objective: "OUTCOME_ENGAGEMENT",
};

describe("números del conector — texto con separadores y moneda", () => {
  test("pesos: quita el signo, los puntos de miles y la moneda; USD se rechaza (no se mezclan monedas)", () => {
    expect(pesosMeta("$ 29.733.426 COP")).toBe(29_733_426);
    expect(pesosMeta("$ 0 COP")).toBe(0);
    expect(pesosMeta("$ 1.234 COP")).toBe(1_234);
    expect(() => pesosMeta("$0,00 USD")).toThrow(/USD/);
  });

  test("números enteros y decimales; null y 'Not available' → null", () => {
    expect(numeroMeta("98765")).toBe(98_765);
    expect(numeroMeta("1.82")).toBeCloseTo(1.82);
    expect(numeroMeta(null)).toBeNull();
    expect(numeroMeta(undefined)).toBeNull();
    expect(numeroMeta("Not available")).toBeNull();
  });

  test("resultado: valor y tipo desde el indicador", () => {
    expect(resultadoMeta({ indicator: "actions:onsite_conversion.messaging_conversation_started_7d", value: "57" })).toEqual({ valor: 57, tipo: "conversacion" });
    expect(resultadoMeta({ indicator: "actions:lead", value: "3" })).toEqual({ valor: 3, tipo: "lead" });
    expect(resultadoMeta({ indicator: "actions:link_click", value: "Not available" })).toEqual({ valor: null, tipo: "link_click" });
    expect(resultadoMeta(null)).toEqual({ valor: null, tipo: null });
    // Forma alterna (conjuntos/anuncios): values[] por ventana de atribución
    expect(resultadoMeta({ indicator: "actions:onsite_conversion.messaging_conversation_started_7d", values: [{ attribution_windows: ["default"], value: "127" }] })).toEqual({ valor: 127, tipo: "conversacion" });
    expect(resultadoMeta({ indicator: "profile_visit_view", values: [{ value: "161" }] })).toEqual({ valor: 161, tipo: "profile_visit_view" });
    expect(resultadoMeta({ indicator: "actions:leadgen.other", values: [{ value: "6" }] })).toEqual({ valor: 6, tipo: "lead" });
  });

  test("resultados: solo cuentan los frutos (conversación, lead, compra, chat); clics y visitas al perfil quedan en cero pero conservan su tipo", () => {
    const trafico = mapearFilaMeta({ ...cruda, results: { indicator: "actions:link_click", values: [{ value: "1046" }] } }, { cuentaId: "act_1", nivel: "campana" });
    expect(trafico.resultados).toBe(0);
    expect(trafico.tipoResultado).toBe("link_click");
    const perfil = mapearFilaMeta({ ...cruda, results: { indicator: "profile_visit_view", values: [{ value: "161" }] } }, { cuentaId: "act_1", nivel: "anuncio" });
    expect(perfil.resultados).toBe(0);
    expect(perfil.tipoResultado).toBe("profile_visit_view");
    const lead = mapearFilaMeta({ ...cruda, results: { indicator: "actions:leadgen.other", values: [{ value: "6" }] } }, { cuentaId: "act_1", nivel: "campana" });
    expect(lead.resultados).toBe(6);
    const chat = mapearFilaMeta({ ...cruda, results: { indicator: "actions:offsite_conversion.fb_pixel_custom.JoinChat", values: [{ value: "12" }] } }, { cuentaId: "act_1", nivel: "campana" });
    expect(chat.resultados).toBe(12);
    expect(chat.tipoResultado).toBe("fb_pixel_custom.JoinChat");
    expect(esFruto("conversacion")).toBe(true);
    expect(esFruto("total_profile_visits")).toBe(false);
    expect(esFruto(null)).toBe(false);
  });

  test("estado: el configurado manda; revisión y rechazo vienen del efectivo", () => {
    expect(estadoMeta("ACTIVE", "ACTIVE")).toBe("activo");
    expect(estadoMeta("PAUSED", "PAUSED")).toBe("pausado");
    expect(estadoMeta("ARCHIVED", "ARCHIVED")).toBe("archivado");
    expect(estadoMeta("DELETED", "DELETED")).toBe("archivado");
    expect(estadoMeta("ACTIVE", "PENDING_REVIEW")).toBe("en_revision");
    expect(estadoMeta("ACTIVE", "DISAPPROVED")).toBe("rechazado");
    expect(estadoMeta("ACTIVE", "CAMPAIGN_PAUSED")).toBe("activo");
  });
});

describe("mapearFilaMeta — de la fila del conector al contrato", () => {
  test("campaña: pasa el contrato, con conversaciones desde el resultado de mensajería y video completo", () => {
    const r = mapearFilaMeta(cruda, { cuentaId: "act_536430824306104", nivel: "campana" });
    expect(InsightRowSchema.safeParse(r).success).toBe(true);
    expect(r.fecha).toBe("2026-09-10");
    expect(r.id).toBe("120245602002100151");
    expect(r.padreId).toBeNull();
    expect(r.cuentaId).toBe("act_536430824306104");
    expect(r.estado).toBe("pausado");
    expect(r.gasto).toBe(1_234_567);
    expect(r.impresiones).toBe(98_765);
    expect(r.alcance).toBe(54_321);
    expect(r.frecuencia).toBeCloseTo(1.82);
    expect(r.clics).toBe(1200);
    expect(r.clicsEnlace).toBe(800);
    expect(r.clicsUnicos).toBe(760);
    expect(r.resultados).toBe(57);
    expect(r.tipoResultado).toBe("conversacion");
    expect(r.conversacionesIniciadas).toBe(57);
    expect(r.conversacionesRespondidas).toBeNull();
    expect(r.valorConversion).toBeNull();
    expect(r.vistasLandingPage).toBeNull();
    expect(r.reproducciones).toBe(40_000);
    expect(r.reproducciones2s).toBe(15_000);
    expect(r.reproducciones3s).toBe(12_000);
    expect(r.reproduccionesThru).toBe(4_000);
    expect(r.p100).toBe(2_800);
    // tiempo total = promedio por reproducción × reproducciones (lo único derivado, y se declara)
    expect(r.tiempoReproduccionTotal).toBe(7 * 40_000);
    expect(r.ventanaAtribucion).toBe("7d_click_1d_view");
  });

  test("anuncio: padre = conjunto; conjunto: padre = campaña; sin resultado de mensajería, conversaciones = null y resultados = 0", () => {
    const anuncio = mapearFilaMeta({ ...cruda, adset_id: "5555", campaign_id: "9999", results: { indicator: "actions:link_click", value: "Not available" } }, { cuentaId: "act_1", nivel: "anuncio" });
    expect(anuncio.padreId).toBe("5555");
    expect(anuncio.conversacionesIniciadas).toBeNull();
    expect(anuncio.resultados).toBe(0);
    expect(anuncio.tipoResultado).toBe("link_click");
    const conjunto = mapearFilaMeta({ ...cruda, campaign_id: "9999" }, { cuentaId: "act_1", nivel: "conjunto" });
    expect(conjunto.padreId).toBe("9999");
  });

  test("un día sin entrega (impresiones null) queda en cero, no se descarta", () => {
    const r = mapearFilaMeta({ ...cruda, amount_spent: "$ 0 COP", impressions: null, clicks: "0", link_click: null }, { cuentaId: "act_1", nivel: "campana" });
    expect(r.gasto).toBe(0);
    expect(r.impresiones).toBe(0);
    expect(r.clicsEnlace).toBe(0);
    expect(InsightRowSchema.safeParse(r).success).toBe(true);
  });
});

describe("desgloses — una fila por segmento con nRegistros = alcance", () => {
  test("edad y género desde breakdowns; nRegistros = alcance (o impresiones/frecuencia)", () => {
    const d = mapearDesgloseMeta({ ...cruda, age: "25-34", gender: "female" }, { cuentaId: "act_1", dimension: "edad", valorDe: (f) => String(f.age) });
    expect(BreakdownRowSchema.safeParse(d).success).toBe(true);
    expect(d.dimension).toBe("edad");
    expect(d.valor).toBe("25-34");
    expect(d.nRegistros).toBe(54_321);
    expect(d.nivel).toBe("cuenta");
    const sinAlcance = mapearDesgloseMeta({ ...cruda, reach: null, gender: "male" }, { cuentaId: "act_1", dimension: "genero", valorDe: (f) => (f.gender === "male" ? "hombre" : "mujer") });
    expect(sinAlcance.valor).toBe("hombre");
    expect(sinAlcance.nRegistros).toBe(Math.round(98_765 / 1.82));
  });
});

describe("parsearRespuesta — el archivo crudo del conector", () => {
  test("acepta el envoltorio {ad_entities: '<json>'} y también un arreglo directo", () => {
    const envuelto = JSON.stringify({ ad_entities: JSON.stringify([cruda, cruda]), pagination: { next_cursor: "abc" } });
    const r = parsearRespuesta(envuelto);
    expect(r.filas).toHaveLength(2);
    expect(r.siguiente).toBe("abc");
    expect(parsearRespuesta(JSON.stringify([cruda])).filas).toHaveLength(1);
    expect(parsearRespuesta(JSON.stringify({ ad_entities: "[]" })).siguiente).toBeNull();
  });
});

describe("construirLoteDesdeCrudos — de los archivos crudos al lote validado", () => {
  const archivo = (nombre: string, filas: FilaMetaCruda[]) => ({ nombre, contenido: JSON.stringify({ ad_entities: JSON.stringify(filas) }) });
  const dia = (fecha: string, id: string, extra: Partial<FilaMetaCruda> = {}): FilaMetaCruda => ({ ...cruda, date_start: fecha, date_stop: fecha, id, ...extra });

  test("nombre de archivo = cuenta__nivel__n; junta niveles, quita duplicados, calcula rango y huecos", async () => {
    const { construirLoteDesdeCrudos } = await import("./meta.importar");
    const lote = construirLoteDesdeCrudos([
      archivo("act_1__campana__1.json", [dia("2026-09-01", "c1"), dia("2026-09-03", "c1")]),
      archivo("act_1__campana__2.json", [dia("2026-09-03", "c1")]), // duplicado (solape de páginas)
      archivo("act_1__conjunto__1.json", [dia("2026-09-01", "s1", { campaign_id: "c1" })]),
      archivo("act_1__anuncio__1.json", [dia("2026-09-01", "a1", { adset_id: "s1" })]),
      archivo("act_1__desglose-edad__1.json", [dia("2026-09-03", "act_1", { age: "25-34" })]),
    ]);
    expect(lote.insights).toHaveLength(4);
    expect(lote.insights.filter((i) => i.nivel === "campana")).toHaveLength(2);
    expect(lote.insights.find((i) => i.nivel === "anuncio")!.padreId).toBe("s1");
    expect(lote.desgloses).toHaveLength(1);
    expect(lote.desgloses[0]!.valor).toBe("25-34");
    expect(lote.meta.desde).toBe("2026-09-01");
    expect(lote.meta.hasta).toBe("2026-09-03");
    expect(lote.meta.huecos).toEqual(["2026-09-02"]);
    expect(lote.meta.origen).toBe("archivo");
    expect(lote.creativos).toEqual([]);
    expect(lote.embudo).toEqual([]);
  });

  test("conserva del lote base lo que el conector no trae (competidores, experimentos, resultados de clínica)", async () => {
    const { construirLoteDesdeCrudos } = await import("./meta.importar");
    const { lote: base } = await import("@/lib/diagnostics/fixtures");
    const previo = base({ competidores: [{ id: "x", nombre: "Comp", ciudad: "Barranquilla", serviciosConocidos: [], urlPagina: null, seguidoresPagina: null }] });
    const lote = construirLoteDesdeCrudos([archivo("act_1__campana__1.json", [dia("2026-09-01", "c1")])], previo);
    expect(lote.competidores).toHaveLength(1);
    expect(lote.experimentos).toEqual(previo.experimentos);
  });

  test("desgloses de género y ubicación se traducen al vocabulario del panel", async () => {
    const { construirLoteDesdeCrudos } = await import("./meta.importar");
    const lote = construirLoteDesdeCrudos([
      archivo("act_1__desglose-genero__1.json", [dia("2026-09-01", "act_1", { gender: "female" }), dia("2026-09-01", "act_1", { gender: "male" }), dia("2026-09-01", "act_1", { gender: "unknown" })]),
      archivo("act_1__desglose-ubicacion__1.json", [dia("2026-09-01", "act_1", { region: "Atlantico", country: "CO" })]),
      archivo("act_1__desglose-hora__1.json", [dia("2026-09-01", "act_1", { hourly_stats_aggregated_by_advertiser_time_zone: "14:00:00 - 14:59:59" })]),
      archivo("act_1__desglose-plataforma__1.json", [dia("2026-09-01", "act_1", { publisher_platform: "instagram", platform_position: "instagram_reels" })]),
    ]);
    const v = (d: string) => lote.desgloses.filter((x) => x.dimension === d).map((x) => x.valor);
    expect(v("genero")).toEqual(["mujer", "hombre", "desconocido"]);
    expect(v("ubicacion")).toEqual(["Atlantico"]);
    expect(v("hora")).toEqual(["14"]);
    expect(v("plataforma")).toEqual(["instagram_reels"]);
  });

  test("archivos __creativo__ se cruzan con los anuncios: un creativo por anuncio, con su primer gasto y días activos", async () => {
    const { construirLoteDesdeCrudos } = await import("./meta.importar");
    const lote = construirLoteDesdeCrudos([
      archivo("act_1__anuncio__1.json", [
        dia("2026-09-01", "a1", { adset_id: "s1", creative_id: "k1", amount_spent: "$ 0 COP" }),
        dia("2026-09-02", "a1", { adset_id: "s1", creative_id: "k1", amount_spent: "$ 1.000 COP" }),
        dia("2026-09-02", "a2", { adset_id: "s1", creative_id: "k1", amount_spent: "$ 500 COP" }),
        dia("2026-09-02", "a3", { adset_id: "s1", creative_id: "k9", amount_spent: "$ 500 COP" }),
      ]),
      { nombre: "act_1__creativo__1.json", contenido: JSON.stringify({ ad_creatives: [{ id: "k1", name: "Promo 2026-09-01-0123456789abcdef0123456789abcdef", object_type: "VIDEO", video_id: "v", body: "50% OFF en tu valoración de criolipólisis", title: "Promo", call_to_action_type: "WHATSAPP_MESSAGE" }] }) },
    ]);
    expect(lote.creativos.map((c) => c.anuncioId).sort()).toEqual(["a1", "a2"]);
    const a1 = lote.creativos.find((c) => c.anuncioId === "a1")!;
    expect(a1.fechaPrimerGasto).toBe("2026-09-02");
    expect(a1.diasActivo).toBe(1);
    expect(a1.formato).toBe("video");
    expect(a1.servicio).toBe("criolipolisis");
  });

  test("archivos __desglose-<dim>__campana__ son desgloses POR CAMPAÑA: nivel campaña, id de la campaña, sin colisión entre campañas y con fecha del lote si el conector no la trae", async () => {
    const { construirLoteDesdeCrudos } = await import("./meta.importar");
    const sinFecha = (id: string, extra: Partial<FilaMetaCruda>): FilaMetaCruda => {
      const f: FilaMetaCruda = { ...cruda, id, name: `Campaña ${id}`, ...extra };
      delete f.date_start;
      delete f.date_stop;
      return f;
    };
    const lote = construirLoteDesdeCrudos([
      archivo("act_1__campana__1.json", [dia("2026-09-01", "c1"), dia("2026-09-03", "c2")]),
      archivo("act_1__desglose-edad__campana__1.json", [
        sinFecha("c1", { age: "25-34", amount_spent: "$ 1.000 COP", results: { indicator: "actions:onsite_conversion.messaging_conversation_started_7d", values: [{ attribution_windows: ["default"], value: "4" }] } }),
        sinFecha("c2", { age: "25-34", amount_spent: "$ 2.000 COP" }),
      ]),
    ]);
    expect(lote.desgloses).toHaveLength(2);
    expect(lote.desgloses.every((d) => d.nivel === "campana" && d.dimension === "edad" && d.valor === "25-34")).toBe(true);
    expect(lote.desgloses.map((d) => d.id).sort()).toEqual(["c1", "c2"]);
    expect(lote.desgloses.every((d) => d.fecha === "2026-09-03")).toBe(true);
    expect(lote.desgloses.find((d) => d.id === "c1")!.resultados).toBe(4);
    expect(lote.desgloses.find((d) => d.id === "c1")!.conversacionesIniciadas).toBe(4);
  });

  test("«Unknown» en edad, género y ubicación se lee como desconocido", async () => {
    const { construirLoteDesdeCrudos } = await import("./meta.importar");
    const lote = construirLoteDesdeCrudos([
      archivo("act_1__desglose-edad__1.json", [dia("2026-09-01", "act_1", { age: "Unknown" })]),
      archivo("act_1__desglose-ubicacion__1.json", [dia("2026-09-01", "act_1", { region: "Unknown" })]),
    ]);
    expect(lote.desgloses.map((d) => d.valor)).toEqual(["desconocido", "desconocido"]);
  });
});
