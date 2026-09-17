import { describe, expect, test } from "vitest";
import { InsightRowSchema, CreativoSchema } from "./types";
import { estadoTikTok, mapearFilaTikTok, mapearCreativosTikTok, sincronizarTikTok, type PeticionTikTok } from "./tiktok.ads";

const fila = { dimensions: { ad_id: "1780001", stat_time_day: "2026-09-10 00:00:00" }, metrics: { spend: "45000.5", impressions: "9000", reach: "7000", frequency: "1.28", clicks: "120", conversion: "8", result: "8", video_play_actions: "8800", video_watched_2s: "3000", video_watched_6s: "1200", video_views_p25: "2500", video_views_p50: "1400", video_views_p75: "800", video_views_p100: "500", likes: "40", comments: "3", shares: "5", profile_visits: "12", follows: "4", campaign_id: "1700001", campaign_name: "Crio · Conversiones", adgroup_id: "1750001", adgroup_name: "Mujeres 25-45 BAQ", ad_name: "Reel antes-después", objective_type: "CONVERSIONS" } };

describe("TikTok Ads · fila del informe → contrato", () => {
  test("nivel anuncio: gasto, entrega, video y resultados; padre = conjunto; cuenta tt_<id>", () => {
    const r = mapearFilaTikTok(fila, "anuncio", "7000000001", { "1780001": "ENABLE" });
    expect(InsightRowSchema.safeParse(r).success).toBe(true);
    expect(r).toMatchObject({ fuente: "tiktok", fecha: "2026-09-10", nivel: "anuncio", id: "1780001", nombre: "Reel antes-después", padreId: "1750001", cuentaId: "tt_7000000001", objetivo: "CONVERSIONS", estado: "activo", gasto: 45000.5, impresiones: 9000, alcance: 7000, frecuencia: 1.28, clics: 120, clicsEnlace: 120, reacciones: 40, comentarios: 3, compartidos: 5, visitasPerfil: 12, seguidoresNuevos: 4, reproducciones: 8800, reproducciones2s: 3000, reproducciones6s: 1200, p25: 2500, p50: 1400, p75: 800, p100: 500, resultados: 8, tipoResultado: "conversion", conversacionesIniciadas: null });
    expect(r.ventanaAtribucion).toMatch(/TikTok/);
  });
  test("nivel campaña sin padre; conjunto con padre campaña; estado por operation_status", () => {
    const c = mapearFilaTikTok({ ...fila, dimensions: { campaign_id: "1700001", stat_time_day: "2026-09-10 00:00:00" } }, "campana", "7000000001", { "1700001": "DISABLE" });
    expect(c).toMatchObject({ nivel: "campana", id: "1700001", nombre: "Crio · Conversiones", padreId: null, estado: "pausado" });
    const g = mapearFilaTikTok({ ...fila, dimensions: { adgroup_id: "1750001", stat_time_day: "2026-09-10 00:00:00" } }, "conjunto", "7000000001", {});
    expect(g).toMatchObject({ nivel: "conjunto", id: "1750001", padreId: "1700001", estado: "activo" });
  });
  test("estados", () => {
    expect(estadoTikTok("ENABLE")).toBe("activo");
    expect(estadoTikTok("DISABLE")).toBe("pausado");
    expect(estadoTikTok("DELETE")).toBe("archivado");
    expect(estadoTikTok(undefined)).toBe("activo");
  });
  test("un objetivo de mensajes cuenta como conversación", () => {
    const r = mapearFilaTikTok({ ...fila, metrics: { ...fila.metrics, objective_type: "LEAD_GENERATION" } }, "anuncio", "7", {});
    expect(r.tipoResultado).toBe("lead");
  });
});

describe("TikTok Ads · anuncios → creativos", () => {
  test("texto, cta, destino, formato y días activos desde los insights", () => {
    const ads = [{ ad_id: "1780001", ad_name: "Reel antes-después", ad_text: "Criolipólisis sin cirugía: agenda tu valoración gratis", call_to_action: "BOOK_NOW", landing_page_url: "https://wa.me/57300", video_id: "v1", image_ids: [] }];
    const insights = [mapearFilaTikTok(fila, "anuncio", "7000000001", {}), mapearFilaTikTok({ ...fila, dimensions: { ad_id: "1780001", stat_time_day: "2026-09-11 00:00:00" } }, "anuncio", "7000000001", {})];
    const c = mapearCreativosTikTok(ads, insights);
    expect(c).toHaveLength(1);
    expect(CreativoSchema.safeParse(c[0]).success).toBe(true);
    expect(c[0]).toMatchObject({ id: "1780001", anuncioId: "1780001", formato: "video", copyPrincipal: "Criolipólisis sin cirugía: agenda tu valoración gratis", cta: "BOOK_NOW", urlDestino: "https://wa.me/57300", fechaPrimerGasto: "2026-09-10", diasActivo: 2 });
    expect(c[0]!.servicio).toBeTruthy();
  });
});

describe("TikTok Ads · sincronización", () => {
  test("tres niveles + estados + anuncios; pagina; lote listo para fusionar", async () => {
    const llamadas: string[] = [];
    const pedir: PeticionTikTok = async (ruta, params) => {
      llamadas.push(`${ruta}?${params.data_level ?? ""}p${params.page ?? ""}`);
      if (ruta === "report/integrated/get/") {
        const nivel = String(params.data_level);
        const dim = nivel === "AUCTION_CAMPAIGN" ? { campaign_id: "1700001" } : nivel === "AUCTION_ADGROUP" ? { adgroup_id: "1750001" } : { ad_id: "1780001" };
        const page = Number(params.page ?? 1);
        return { code: 0, data: { list: [{ dimensions: { ...dim, stat_time_day: `2026-09-1${page - 1} 00:00:00` }, metrics: fila.metrics }], page_info: { page, total_page: 2 } } };
      }
      if (ruta === "campaign/get/") return { code: 0, data: { list: [{ campaign_id: "1700001", operation_status: "ENABLE" }], page_info: { page: 1, total_page: 1 } } };
      if (ruta === "adgroup/get/") return { code: 0, data: { list: [{ adgroup_id: "1750001", operation_status: "DISABLE" }], page_info: { page: 1, total_page: 1 } } };
      if (ruta === "ad/get/") return { code: 0, data: { list: [{ ad_id: "1780001", operation_status: "ENABLE", ad_name: "Reel", ad_text: "Hifu sin dolor", call_to_action: "LEARN_MORE", landing_page_url: null, video_id: "v", image_ids: [] }], page_info: { page: 1, total_page: 1 } } };
      return { code: 0, data: { list: [], page_info: { page: 1, total_page: 1 } } };
    };
    const lote = await sincronizarTikTok({ pedir, advertiserId: "7000000001", desde: "2026-09-10", hasta: "2026-09-11", ahora: "2026-09-17T10:00:00Z" });
    expect(lote.insights).toHaveLength(6);
    expect(lote.insights.filter((i) => i.nivel === "conjunto")[0]!.estado).toBe("pausado");
    expect(lote.creativos).toHaveLength(1);
    expect(lote.meta).toMatchObject({ cuentaId: "tt_7000000001", desde: "2026-09-10", hasta: "2026-09-11", origen: "tiktok" });
    expect(llamadas.filter((l) => l.startsWith("report")).length).toBe(6);
  });
  test("un error de TikTok se explica con su mensaje", async () => {
    const pedir: PeticionTikTok = async () => ({ code: 40105, message: "Access token is incorrect or has been revoked." });
    await expect(sincronizarTikTok({ pedir, advertiserId: "1", desde: "2026-09-10", hasta: "2026-09-10" })).rejects.toThrow(/revoked/);
  });
});
