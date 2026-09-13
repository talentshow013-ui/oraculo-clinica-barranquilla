import { describe, expect, test } from "vitest";
import { AnuncioCompetidorSchema, CompetidorSchema } from "@/lib/adapters/types";
import { mapearAnuncioApify, mapearRadarApify, type ItemApify } from "@/lib/adapters/radar.apify";

/** Forma real de un registro del actor apify/facebook-ads-scraper (verificada 2026-09-13). */
const item: ItemApify = {
  inputUrl: "https://www.facebook.com/ads/library/?view_all_page_id=1001",
  pageID: "1001",
  adArchiveID: "1229350099285014",
  startDateFormatted: "2026-06-14T07:00:00.000Z",
  endDateFormatted: "2026-09-10T07:00:00.000Z",
  collationCount: 4,
  pageId: "1001",
  isActive: true,
  pageName: "Dermalux Estética",
  pageIsDeleted: false,
  publisherPlatform: ["FACEBOOK", "INSTAGRAM"],
  startDate: 1781420400,
  endDate: 1789023600,
  reachEstimate: null,
  spend: null,
  currency: "",
  impressionsWithIndex: { impressionsText: null, impressionsIndex: -1 },
  categories: ["UNKNOWN"],
  pageLikeCount: 20327,
  snapshot: {
    title: "Toxina botulínica con médico dermatólogo",
    body: { text: "Toxina botulínica aplicada por médico dermatólogo. Desde $320.000. Agenda tu valoración." },
    ctaText: "Escríbenos",
    linkUrl: "https://wa.me/573001234567",
    images: [{ original_image_url: "https://scontent.example/img.jpg" }],
    videos: [],
  },
};

describe("mapearAnuncioApify", () => {
  test("produce un AnuncioCompetidor válido contra el contrato", () => {
    const a = mapearAnuncioApify(item, "2026-09-12");
    expect(AnuncioCompetidorSchema.safeParse(a).success).toBe(true);
  });

  test("mapea identidad, fechas y días corriendo desde startDate (Bogotá)", () => {
    const a = mapearAnuncioApify(item, "2026-09-12");
    expect(a.anuncioId).toBe("1229350099285014");
    expect(a.competidorId).toBe("1001");
    expect(a.nombreAnunciante).toBe("Dermalux Estética");
    expect(a.primeraVez).toBe("2026-06-14");
    expect(a.activo).toBe(true);
    expect(a.ultimaVez).toBe("2026-09-12"); // activo → hoy
    expect(a.diasCorriendo).toBe(90);
  });

  test("collationCount → variantesDelConcepto; plataformas en minúscula", () => {
    const a = mapearAnuncioApify(item, "2026-09-12");
    expect(a.variantesDelConcepto).toBe(4);
    expect(a.plataformas).toEqual(["facebook", "instagram"]);
  });

  test("alcance null cuando la fuente no lo expone — jamás estimado", () => {
    const a = mapearAnuncioApify(item, "2026-09-12");
    expect(a.alcanceRango).toBeNull();
    expect(a.puntuacionLongevidad).toBe(0); // la recalcula el motor
  });

  test("copy, titular, cta, medio, destino y dominio", () => {
    const a = mapearAnuncioApify(item, "2026-09-12");
    expect(a.copy).toContain("Toxina botulínica");
    expect(a.titular).toBe("Toxina botulínica con médico dermatólogo");
    expect(a.cta).toBe("Escríbenos");
    expect(a.tipoMedia).toBe("imagen");
    expect(a.urlMedia).toBe("https://scontent.example/img.jpg");
    expect(a.dominioDestino).toBe("wa.me");
  });

  test("clasifica ángulo, consciencia y palancas de forma determinista", () => {
    const a = mapearAnuncioApify(item, "2026-09-12");
    expect(a.anguloDetectado).toBe("autoridad_medica");
    expect(a.nivelConsciencia).toBe(5); // hay precio
    expect(a.usaPrecio).toBe(true);
    expect(a.usaProfesional).toBe(true);
    expect(a.servicioDetectado).toBe("toxina");
  });

  test("inactivo: ultimaVez = endDate y días = end − start", () => {
    const a = mapearAnuncioApify({ ...item, isActive: false }, "2026-09-12");
    expect(a.activo).toBe(false);
    expect(a.ultimaVez).toBe("2026-09-10");
    expect(a.diasCorriendo).toBe(88);
  });

  test("video → tipoMedia video; carrusel si hay cards", () => {
    const v = mapearAnuncioApify({ ...item, snapshot: { ...item.snapshot, images: [], videos: [{ video_hd_url: "https://v/1.mp4" }] } }, "2026-09-12");
    expect(v.tipoMedia).toBe("video");
    const c = mapearAnuncioApify({ ...item, snapshot: { ...item.snapshot, cards: [{ title: "a" }, { title: "b" }] } }, "2026-09-12");
    expect(c.tipoMedia).toBe("carrusel");
  });

  test("con reachEstimate presente (UE) lo conserva como rango", () => {
    const a = mapearAnuncioApify({ ...item, reachEstimate: { lower_bound: 1000, upper_bound: 5000 } }, "2026-09-12");
    expect(a.alcanceRango).toEqual({ min: 1000, max: 5000 });
  });
});

describe("mapearRadarApify", () => {
  test("agrupa competidores por página y descarta registros sin id o página borrada", () => {
    const r = mapearRadarApify([item, { ...item, adArchiveID: "2", pageIsDeleted: true }, { ...item, adArchiveID: "", pageID: "1001" }, { ...item, adArchiveID: "3", pageID: "1002", pageId: "1002", pageName: "Otra" }], "2026-09-12");
    expect(r.anunciosCompetencia.map((a) => a.anuncioId)).toEqual(["1229350099285014", "3"]);
    expect(r.competidores).toHaveLength(2);
    expect(r.competidores.every((c) => CompetidorSchema.safeParse(c).success)).toBe(true);
    expect(r.competidores[0]?.seguidoresPagina).toBe(20327);
    expect(r.competidores[0]?.serviciosConocidos).toContain("toxina");
  });
});
