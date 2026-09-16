import { describe, expect, test } from "vitest";
import { parsearPublicosMeta, perfilarSegmentacion } from "./meta.publicos";

const base = {
  id: "s1",
  name: "Frío | Zona Norte | intereses",
  campaign_id: "c1",
  campaign_name: "Capilar | Ventas",
  status: "ACTIVE",
  effective_status: "CAMPAIGN_PAUSED",
  optimization_goal: "CONVERSATIONS",
  destination_type: "WHATSAPP",
  daily_budget: "$ 40.000 COP",
  created_time: "2026-08-20T12:47:31-0500",
  amount_spent: "$ 405.983 COP",
  impressions: "58205",
  reach: "28224",
  frequency: "2.062252",
  clicks: "658",
  link_click: "261",
  results: { indicator: "actions:onsite_conversion.messaging_conversation_started_7d", values: [{ value: "124" }] },
  targeting: {
    genders: { "0": 0 },
    age_min: 24,
    age_max: 55,
    geo_locations: { places: { "0": { name: "Vivante Medicina Estética", radius: 2, distance_unit: "kilometer" } }, location_types: { "0": "home", "1": "recent" } },
    excluded_geo_locations: { regions: { "0": { name: "Antioquia" } }, cities: { "0": { name: "Bogotá", radius: 40 } } },
    flexible_spec: { "0": { interests: { "0": { name: "Gimnasio (fitness)" }, "1": { name: "Dieta saludable (cuidado personal)" } }, behaviors: { "0": { name: "Frequent Travelers" } } } },
    targeting_automation: { advantage_audience: 0 },
    effective_publisher_platforms: { "0": "facebook", "1": "instagram" },
  },
};

describe("públicos de Meta (segmentación de cada conjunto) → contrato", () => {
  test("lee edad, género, radio, exclusiones, intereses y clasifica el tipo de público", () => {
    const r = parsearPublicosMeta(JSON.stringify({ ad_entities: JSON.stringify([base]), capturado: "2026-09-16", desde: "2026-06-15", hasta: "2026-09-15" }), "act_1");
    expect(r).toHaveLength(1);
    const p = r[0]!;
    expect(p).toMatchObject({ cuentaId: "act_1", conjuntoId: "s1", campanaId: "c1", desde: "2026-06-15", hasta: "2026-09-15", gasto: 405983, impresiones: 58205, alcance: 28224, clicsEnlace: 261, resultados: 124, tipoResultado: "conversacion", objetivo: "CONVERSATIONS", destino: "WHATSAPP", presupuestoDiario: 40000 });
    expect(p.segmentacion).toMatchObject({ edadMin: 24, edadMax: 55, genero: "todos", radioKm: 2, lugares: ["Vivante Medicina Estética (2 km)"], excluidos: ["Antioquia", "Bogotá"], intereses: ["Gimnasio (fitness)", "Dieta saludable (cuidado personal)", "Frequent Travelers"], personalizados: [], similares: [], advantage: false, tipo: "intereses", plataformas: ["facebook", "instagram"] });
  });
  test("tipos: similar, personalizado (remarketing), advantage y amplio", () => {
    const seg = (t: Record<string, unknown>) => perfilarSegmentacion({ age_min: 18, age_max: 65, geo_locations: {}, ...t });
    expect(seg({ custom_audiences: { "0": { name: "Público similar (1%) - IG 365", subtype: "LOOKALIKE" } } }).tipo).toBe("similar");
    expect(seg({ custom_audiences: { "0": { name: "Interacción IG 365 días", subtype: "ENGAGEMENT" } } }).tipo).toBe("remarketing");
    expect(seg({ targeting_automation: { advantage_audience: 1 } }).tipo).toBe("advantage");
    expect(seg({}).tipo).toBe("amplio");
    expect(seg({ genders: { "0": 2 } }).genero).toBe("mujeres");
    expect(seg({ genders: { "0": 1 } }).genero).toBe("hombres");
  });
  test("resultado que no es fruto (visitas al perfil) queda en cero", () => {
    const r = parsearPublicosMeta(JSON.stringify({ ad_entities: JSON.stringify([{ ...base, results: { indicator: "profile_visit_view", values: [{ value: "493" }] } }]) }), "act_1");
    expect(r[0]!.resultados).toBe(0);
    expect(r[0]!.tipoResultado).toBe("profile_visit_view");
  });
});
