import { describe, expect, test } from "vitest";
import { InsightRowSchema, CreativoSchema } from "./types";
import { consultaGaql, mapearFilaGoogle, mapearCreativosGoogle, sincronizarGoogleAds, type ConsultaGoogle } from "./google.ads";

const filaCampana = { campaign: { id: "111", name: "Búsqueda · Criolipólisis", status: "ENABLED", advertisingChannelType: "SEARCH" }, segments: { date: "2026-09-10" }, metrics: { costMicros: "45000000000", impressions: "9000", clicks: "120", conversions: 8.0, allConversions: 9, interactions: "125", videoViews: "0", engagements: "0" } };
const filaGrupo = { campaign: { id: "111" }, adGroup: { id: "222", name: "Criolipólisis BAQ", status: "ENABLED" }, segments: { date: "2026-09-10" }, metrics: { costMicros: "45000000000", impressions: "9000", clicks: "120", conversions: 8, interactions: "125" } };
const filaAnuncio = { campaign: { id: "111" }, adGroup: { id: "222" }, adGroupAd: { status: "PAUSED", ad: { id: "333", name: "", type: "RESPONSIVE_SEARCH_AD", finalUrls: ["https://wa.me/57300"], responsiveSearchAd: { headlines: [{ text: "Criolipólisis en Barranquilla" }, { text: "Valoración gratis" }], descriptions: [{ text: "Elimina grasa localizada sin cirugía" }] } } }, segments: { date: "2026-09-10" }, metrics: { costMicros: "45000000000", impressions: "9000", clicks: "120", conversions: 8, interactions: "125" } };

describe("Google Ads · GAQL", () => {
  test("arma la consulta por nivel con el rango y sin filas sin gasto", () => {
    const q = consultaGaql("campana", "2026-09-01", "2026-09-15");
    expect(q).toMatch(/^SELECT .*campaign\.id.*FROM campaign WHERE segments\.date BETWEEN '2026-09-01' AND '2026-09-15' AND metrics\.cost_micros > 0/s);
    expect(consultaGaql("anuncio", "2026-09-01", "2026-09-15")).toMatch(/FROM ad_group_ad/);
  });
});

describe("Google Ads · fila → contrato", () => {
  test("campaña: costo en pesos desde micros, conversiones como resultados, estado", () => {
    const r = mapearFilaGoogle(filaCampana, "campana", "1234567890");
    expect(InsightRowSchema.safeParse(r).success).toBe(true);
    expect(r).toMatchObject({ fuente: "google", fecha: "2026-09-10", nivel: "campana", id: "111", nombre: "Búsqueda · Criolipólisis", padreId: null, cuentaId: "ga_1234567890", objetivo: "SEARCH", estado: "activo", gasto: 45000, impresiones: 9000, clics: 120, clicsEnlace: 120, interacciones: 125, resultados: 8, tipoResultado: "conversion" });
  });
  test("conjunto con padre campaña; anuncio con padre conjunto, nombre desde los títulos y estado pausado", () => {
    expect(mapearFilaGoogle(filaGrupo, "conjunto", "1")).toMatchObject({ nivel: "conjunto", id: "222", padreId: "111", nombre: "Criolipólisis BAQ" });
    const a = mapearFilaGoogle(filaAnuncio, "anuncio", "1");
    expect(a).toMatchObject({ nivel: "anuncio", id: "333", padreId: "222", estado: "pausado", nombre: "Criolipólisis en Barranquilla" });
  });
  test("creativos: títulos y descripciones de anuncios de búsqueda; días activos", () => {
    const insights = [mapearFilaGoogle(filaAnuncio, "anuncio", "1")];
    const c = mapearCreativosGoogle([filaAnuncio.adGroupAd], insights);
    expect(CreativoSchema.safeParse(c[0]).success).toBe(true);
    expect(c[0]).toMatchObject({ id: "333", anuncioId: "333", formato: "imagen", titular: "Criolipólisis en Barranquilla · Valoración gratis", copyPrincipal: "Elimina grasa localizada sin cirugía", urlDestino: "https://wa.me/57300", diasActivo: 1 });
  });
});

describe("Google Ads · sincronización", () => {
  test("tres niveles, lote listo; un error se explica", async () => {
    const consultar: ConsultaGoogle = async (gaql) => (gaql.includes("FROM campaign ") ? [filaCampana] : gaql.includes("FROM ad_group ") ? [filaGrupo] : [filaAnuncio]);
    const lote = await sincronizarGoogleAds({ consultar, customerId: "1234567890", desde: "2026-09-01", hasta: "2026-09-15", ahora: "2026-09-18T10:00:00Z" });
    expect(lote.insights).toHaveLength(3);
    expect(lote.creativos).toHaveLength(1);
    expect(lote.meta).toMatchObject({ cuentaId: "ga_1234567890", origen: "google" });
    const malo: ConsultaGoogle = async () => { throw new Error("DEVELOPER_TOKEN_NOT_APPROVED"); };
    await expect(sincronizarGoogleAds({ consultar: malo, customerId: "1", desde: "2026-09-01", hasta: "2026-09-02" })).rejects.toThrow(/DEVELOPER_TOKEN/);
  });
});
