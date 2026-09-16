import { describe, expect, test } from "vitest";
import { LoteOrganicoSchema } from "./types";
import { formatoIG, formatoFB, mapearMediaIG, mapearPostFB, metricasIG, pedirInsights, sincronizarOrganico, fusionarLotes, type Peticion } from "./organico.graph";

describe("orgánico · formato de cada publicación", () => {
  test("Instagram: reels, historias, carruseles, imágenes y videos de feed", () => {
    expect(formatoIG("VIDEO", "REELS")).toBe("reel");
    expect(formatoIG("IMAGE", "STORY")).toBe("historia");
    expect(formatoIG("CAROUSEL_ALBUM", "FEED")).toBe("carrusel");
    expect(formatoIG("IMAGE", "FEED")).toBe("imagen");
    expect(formatoIG("VIDEO", "FEED")).toBe("video");
  });
  test("Facebook: por el tipo del adjunto", () => {
    expect(formatoFB("added_video", "video_inline")).toBe("video");
    expect(formatoFB("added_photos", "photo")).toBe("imagen");
    expect(formatoFB("added_photos", "album")).toBe("carrusel");
    expect(formatoFB("shared_story", "share")).toBe("enlace");
    expect(formatoFB("mobile_status_update", null)).toBe("texto");
  });
});

describe("orgánico · publicación de Instagram → contrato", () => {
  test("mezcla los campos del objeto con las métricas, hora en Bogotá", () => {
    const p = mapearMediaIG(
      { id: "17900000000000001", caption: "Toxina botulínica: agenda tu valoración\n\nMás texto", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-09-10T23:30:00+0000", permalink: "https://www.instagram.com/reel/abc/", thumbnail_url: "https://x/y.jpg", like_count: 120, comments_count: 8 },
      { reach: 5400, views: 9100, total_interactions: 150, saved: 14, shares: 8, ig_reels_avg_watch_time: 6200 },
    );
    expect(p).toMatchObject({ id: "17900000000000001", red: "instagram", formato: "reel", publicadoEn: "2026-09-10T18:30", enlace: "https://www.instagram.com/reel/abc/", meGusta: 120, comentarios: 8, alcance: 5400, vistas: 9100, interacciones: 150, guardados: 14, compartidos: 8, segundosPromedio: 6.2, urlMiniatura: "https://x/y.jpg" });
    expect(p.texto).toBe("Toxina botulínica: agenda tu valoración Más texto");
    expect(p.visitasPerfil).toBeNull();
  });
  test("las métricas de cada formato son las que Meta soporta (nada de impresiones retiradas)", () => {
    expect(metricasIG("reel")).toContain("ig_reels_avg_watch_time");
    expect(metricasIG("imagen")).toContain("profile_visits");
    expect(metricasIG("historia")).toContain("replies");
    for (const f of ["reel", "imagen", "carrusel", "historia", "video"] as const) expect(metricasIG(f)).not.toContain("impressions");
  });
});

describe("orgánico · publicación de Facebook → contrato", () => {
  test("usa los conteos del objeto y las vistas nuevas de Meta", () => {
    const p = mapearPostFB(
      { id: "111_222", created_time: "2026-09-01T14:05:00+0000", message: "Promo de septiembre", permalink_url: "https://www.facebook.com/111/posts/222", status_type: "added_photos", attachments: { data: [{ media_type: "photo", type: "photo" }] }, likes: { summary: { total_count: 30 } }, comments: { summary: { total_count: 4 } }, shares: { count: 2 }, reactions: { summary: { total_count: 35 } } },
      { post_media_view: 800, post_total_media_view_unique: 600, post_clicks: 40 },
    );
    expect(p).toMatchObject({ id: "111_222", red: "facebook", formato: "imagen", publicadoEn: "2026-09-01T09:05", meGusta: 35, comentarios: 4, compartidos: 2, vistas: 800, alcance: 600, clics: 40, interacciones: 41, guardados: null });
  });
});

/** Un Graph API de mentira: responde según la ruta; permite simular métricas retiradas. */
function graphFalso(retiradas: string[] = []): { pedir: Peticion; llamadas: string[] } {
  const llamadas: string[] = [];
  const pedir: Peticion = async (ruta, params) => {
    llamadas.push(ruta);
    if (ruta.endsWith("/insights")) {
      const metricas = String(params.metric ?? "").split(",");
      const mala = metricas.find((m) => retiradas.includes(m));
      if (mala) throw new Error(`(#100) ${mala} is not a valid metric`);
      return { data: metricas.map((m) => ({ name: m, values: [{ value: 100 }] })) };
    }
    if (ruta === "IG1/media") return { data: [{ id: "m1", media_type: "IMAGE", media_product_type: "FEED", timestamp: "2026-09-02T12:00:00+0000", permalink: "https://ig/m1", caption: "a", like_count: 1, comments_count: 0 }] };
    if (ruta === "IG1/stories") return { data: [] };
    if (ruta === "IG1") return { id: "IG1", username: "vivante", followers_count: 12000, media_count: 500 };
    if (ruta === "PG1") return { id: "PG1", name: "Vivante", followers_count: 8000 };
    if (ruta === "PG1/posts") return { data: [{ id: "PG1_1", created_time: "2026-09-03T12:00:00+0000", message: "b", permalink_url: "https://fb/1", status_type: "added_photos", attachments: { data: [{ type: "photo" }] }, likes: { summary: { total_count: 2 } }, comments: { summary: { total_count: 0 } } }] };
    return { data: [] };
  };
  return { pedir, llamadas };
}

describe("orgánico · pedir métricas sin que una retirada tumbe todo", () => {
  test("si el lote completo falla, pide una por una y anota la retirada", async () => {
    const g = graphFalso(["saved"]);
    const r = await pedirInsights(g.pedir, "m1", ["reach", "saved", "shares"]);
    expect(r.valores).toEqual({ reach: 100, shares: 100 });
    expect(r.retiradas).toEqual(["saved"]);
  });
  test("si todo va bien, una sola llamada", async () => {
    const g = graphFalso();
    await pedirInsights(g.pedir, "m1", ["reach", "saved"]);
    expect(g.llamadas).toHaveLength(1);
  });
});

describe("orgánico · sincronización completa → lote válido", () => {
  test("trae cuentas, publicaciones y días de las dos redes y cumple el contrato", async () => {
    const g = graphFalso(["profile_visits"]);
    const lote = await sincronizarOrganico({ pedir: g.pedir, instagramId: "IG1", paginaId: "PG1", desde: "2026-08-01", hasta: "2026-09-15", ahora: "2026-09-16T10:00:00Z" });
    expect(LoteOrganicoSchema.safeParse(lote).success).toBe(true);
    expect(lote.cuentas.map((c) => c.red)).toEqual(["instagram", "facebook"]);
    expect(lote.publicaciones).toHaveLength(2);
    expect(lote.meta.avisos.join(" ")).toMatch(/visitas al perfil/);
    expect(lote.dias.length).toBeGreaterThan(0);
  });
  test("fusionar conserva lo viejo y reemplaza lo que se volvió a pedir", () => {
    const viejo = { cuentas: [], dias: [{ red: "instagram" as const, fecha: "2026-07-01", seguidoresNuevos: 1, seguidoresTotal: null, alcance: null, vistas: null, interacciones: null }], publicaciones: [{ id: "a", publicadoEn: "2026-07-01T10:00" }, { id: "b", publicadoEn: "2026-09-01T10:00" }], meta: { capturadoEn: "x", desde: "2026-06-01", hasta: "2026-09-01", origen: "graph" as const, avisos: [] } };
    const nuevo = { cuentas: [], dias: [{ red: "instagram" as const, fecha: "2026-09-02", seguidoresNuevos: 3, seguidoresTotal: null, alcance: null, vistas: null, interacciones: null }], publicaciones: [{ id: "b", publicadoEn: "2026-09-01T10:00", meGusta: 9 }], meta: { capturadoEn: "y", desde: "2026-08-17", hasta: "2026-09-15", origen: "graph" as const, avisos: [] } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = fusionarLotes(viejo as any, nuevo as any);
    expect(f.publicaciones.map((p) => p.id)).toEqual(["b", "a"]); // la más reciente primero
    expect((f.publicaciones[0] as { meGusta?: number }).meGusta).toBe(9);
    expect(f.dias).toHaveLength(2);
    expect(f.meta).toMatchObject({ desde: "2026-06-01", hasta: "2026-09-15", capturadoEn: "y" });
  });
});
