import { describe, expect, test } from "vitest";
import { CAMPOS_INSIGHTS, accion, mapearInsightMeta, resultadoDeObjetivo, urlInsights } from "./meta.ads";

const fila = {
  date_start: "2026-09-20",
  date_stop: "2026-09-20",
  campaign_id: "C1",
  campaign_name: "Toxina · mensajes",
  objective: "OUTCOME_LEADS",
  spend: "120000.50",
  impressions: "8587",
  reach: "6100",
  frequency: "1.41",
  clicks: "310",
  actions: [
    { action_type: "link_click", value: "81" },
    { action_type: "post_engagement", value: "1854" },
    { action_type: "post_reaction", value: "10" },
    { action_type: "comment", value: "3" },
    { action_type: "post", value: "1" },
    { action_type: "omni_landing_page_view", value: "42" },
    { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "25" },
    { action_type: "onsite_conversion.total_messaging_connection", value: "10" },
    { action_type: "video_view", value: "900" },
  ],
  video_play_actions: [{ action_type: "video_view", value: "1200" }],
  video_thruplay_watched_actions: [{ action_type: "video_view", value: "300" }],
  video_p25_watched_actions: [{ action_type: "video_view", value: "600" }],
  video_p100_watched_actions: [{ action_type: "video_view", value: "120" }],
  video_avg_time_watched_actions: [{ action_type: "video_view", value: "4.5" }],
};

describe("meta ads · leer una acción", () => {
  test("saca el valor por tipo y devuelve null si no está", () => {
    expect(accion(fila.actions, "link_click")).toBe(81);
    expect(accion(fila.actions, "purchase")).toBeNull();
    expect(accion(undefined, "link_click")).toBeNull();
    expect(accion(fila.video_play_actions)).toBe(1200);
  });
});

describe("meta ads · el resultado es el de la columna «Resultados»", () => {
  test("mensajes: conversaciones iniciadas", () => {
    expect(resultadoDeObjetivo("OUTCOME_LEADS", fila.actions)).toEqual({ valor: 25, tipo: "conversacion" });
  });
  test("formularios: leadgen; compras: purchase; tráfico: no es fruto", () => {
    expect(resultadoDeObjetivo("OUTCOME_LEADS", [{ action_type: "lead", value: "6" }])).toEqual({ valor: 6, tipo: "lead" });
    expect(resultadoDeObjetivo("OUTCOME_SALES", [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "4" }])).toEqual({ valor: 4, tipo: "compra" });
    expect(resultadoDeObjetivo("OUTCOME_TRAFFIC", [{ action_type: "link_click", value: "90" }])).toEqual({ valor: null, tipo: null });
  });
  test("una campaña de mensajes sin conversaciones da cero, no null", () => {
    expect(resultadoDeObjetivo("MESSAGES", [{ action_type: "link_click", value: "3" }])).toEqual({ valor: 0, tipo: "conversacion" });
  });
});

describe("meta ads · mapear al contrato", () => {
  const r = mapearInsightMeta(fila, { cuentaId: "act_1", nivel: "campana", estado: "activo" });
  test("identidad, plata y entrega", () => {
    expect(r).toMatchObject({ fuente: "meta", fecha: "2026-09-20", nivel: "campana", id: "C1", nombre: "Toxina · mensajes", cuentaId: "act_1", estado: "activo", gasto: 120000.5, impresiones: 8587, alcance: 6100, clics: 310, clicsEnlace: 81 });
  });
  test("resultados = conversaciones de mensajería; el resto en su columna", () => {
    expect(r.resultados).toBe(25);
    expect(r.conversacionesIniciadas).toBe(25);
    expect(r.tipoResultado).toBe("conversacion");
    expect(r.interacciones).toBe(1854);
    expect(r.vistasLandingPage).toBe(42);
  });
  test("video: reproducciones, retención y tiempo total", () => {
    expect(r).toMatchObject({ reproducciones: 1200, reproduccionesThru: 300, p25: 600, p100: 120, tiempoReproduccionTotal: 5400 });
  });
  test("pasa el esquema del contrato", async () => {
    const { InsightRowSchema } = await import("./types");
    expect(InsightRowSchema.parse(r)).toBeTruthy();
  });
});

describe("meta ads · manda la columna «Resultados»", () => {
  test("si Meta dice que el resultado son clics, no es un lead: resultados 0 y tipo clic", () => {
    const r = mapearInsightMeta({ ...fila, objective: "LINK_CLICKS", results: [{ indicator: "actions:link_click", values: [{ value: "523" }] }] }, { cuentaId: "act_1", nivel: "campana", estado: "activo" });
    expect(r.resultados).toBe(0);
    expect(r.tipoResultado).toBe("link_click");
  });
  test("campaña de interacción que busca mensajes: cuenta las conversaciones que da Meta", () => {
    const r = mapearInsightMeta({ ...fila, objective: "OUTCOME_ENGAGEMENT", results: [{ indicator: "actions:onsite_conversion.messaging_conversation_started_7d", values: [{ value: "32" }] }] }, { cuentaId: "act_1", nivel: "campana", estado: "activo" });
    expect(r.resultados).toBe(32);
    expect(r.conversacionesIniciadas).toBe(32);
  });
  test("reproducciones de 3 s = video_view", () => {
    expect(mapearInsightMeta(fila, { cuentaId: "act_1", nivel: "anuncio", estado: "activo" }).reproducciones3s).toBe(900);
  });
});

describe("meta ads · la petición", () => {
  test("pide día a día, con las acciones y el nivel correcto", () => {
    const u = new URL(urlInsights("act_9", "campaign", { desde: "2026-09-01", hasta: "2026-09-20" }, "TOKEN"));
    expect(u.pathname).toMatch(/act_9\/insights$/);
    expect(u.searchParams.get("level")).toBe("campaign");
    expect(u.searchParams.get("time_increment")).toBe("1");
    expect(JSON.parse(u.searchParams.get("time_range")!)).toEqual({ since: "2026-09-01", until: "2026-09-20" });
    expect(u.searchParams.get("fields")).toBe(CAMPOS_INSIGHTS.join(","));
    expect(u.searchParams.get("limit")).toBe("500");
    expect(u.searchParams.get("access_token")).toBe("TOKEN");
  });
});
