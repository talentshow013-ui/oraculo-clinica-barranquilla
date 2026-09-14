import { describe, expect, it } from "vitest";
import { CreativoSchema } from "./types";
import { formatoCreativoMeta, mapearCreativosMeta, nombreLimpio, parsearCreativos, type CreativoMetaCrudo } from "./meta.creativos";

const video: CreativoMetaCrudo = {
  id: "c1",
  name: "🎁 ¡50% OFF! Tu valoración 2026-08-14-34d0c1f54d0adaf83c6b0c5eeb8ce75a",
  object_type: "VIDEO",
  body: "¿Esa grasa en el abdomen no cede? La criolipólisis actúa sin cirugía. 50% OFF en tu valoración, solo hoy.",
  title: "🎁 ¡50% OFF! Tu valoración",
  video_id: "v1",
  thumbnail_url: "https://cdn/x/t15.5256-10/a.jpg",
  call_to_action_type: "WHATSAPP_MESSAGE",
  link_url: "https://api.whatsapp.com/send",
};
const compartido: CreativoMetaCrudo = {
  id: "c2",
  name: "Grasa localizada, adiós 2026-08-22-c6c43d231fcfa578f86899187182f4c5",
  object_type: "SHARE",
  thumbnail_url: "https://cdn/x/t39.30808-1/b.jpg",
};

const anuncios = [
  { id: "a1", creativeId: "c1", fechas: [{ fecha: "2026-08-20", gasto: 0 }, { fecha: "2026-08-21", gasto: 1000 }, { fecha: "2026-08-22", gasto: 500 }] },
  { id: "a2", creativeId: "c1", fechas: [{ fecha: "2026-09-01", gasto: 300 }] },
  { id: "a3", creativeId: "c2", fechas: [{ fecha: "2026-08-25", gasto: 200 }] },
  { id: "a4", creativeId: "c9", fechas: [{ fecha: "2026-08-25", gasto: 200 }] },
];

describe("formato del creativo", () => {
  it("video si trae video_id; carrusel con 2+ tarjetas; imagen si no hay pistas", () => {
    expect(formatoCreativoMeta(video)).toBe("video");
    expect(formatoCreativoMeta({ id: "x", child_attachments: [{}, {}] })).toBe("carrusel");
    expect(formatoCreativoMeta({ id: "x", thumbnail_url: "https://cdn/t39.30808-1/b.jpg" })).toBe("imagen");
  });
  it("una publicación compartida con miniatura de video (t15) se lee como video", () => {
    expect(formatoCreativoMeta({ id: "x", object_type: "SHARE", thumbnail_url: "https://cdn/v/t15.5256-10/a.jpg" })).toBe("video");
  });
});

describe("nombre limpio", () => {
  it("quita la fecha y el hash que Meta pega al nombre", () => {
    expect(nombreLimpio(video.name)).toBe("🎁 ¡50% OFF! Tu valoración");
    expect(nombreLimpio("{{product.name}} 2026-07-23-07ac101df6e354ffd5f2d4ac04ab60e5")).toBe("");
  });
});

describe("mapearCreativosMeta", () => {
  const creativos = mapearCreativosMeta([video, compartido], anuncios);

  it("produce un creativo por anuncio que lo usa, válido según el contrato", () => {
    expect(creativos).toHaveLength(3);
    for (const c of creativos) expect(() => CreativoSchema.parse(c)).not.toThrow();
    expect(creativos.map((c) => c.anuncioId).sort()).toEqual(["a1", "a2", "a3"]);
  });
  it("ids únicos aunque dos anuncios compartan el creativo", () => {
    expect(new Set(creativos.map((c) => c.id)).size).toBe(3);
  });
  it("copy, titular, cta, destino y miniatura vienen del creativo; el primer gasto y los días activos del anuncio", () => {
    const a1 = creativos.find((c) => c.anuncioId === "a1")!;
    expect(a1.copyPrincipal).toContain("criolipólisis");
    expect(a1.titular).toBe("🎁 ¡50% OFF! Tu valoración");
    expect(a1.cta).toBe("WHATSAPP_MESSAGE");
    expect(a1.urlDestino).toBe("https://api.whatsapp.com/send");
    expect(a1.urlMiniatura).toBe(video.thumbnail_url);
    expect(a1.fechaPrimerGasto).toBe("2026-08-21");
    expect(a1.diasActivo).toBe(2);
    expect(a1.formato).toBe("video");
  });
  it("clasifica ángulo, servicio y consciencia desde el texto, con señales auditables", () => {
    const a1 = creativos.find((c) => c.anuncioId === "a1")!;
    expect(a1.anguloDetectado).not.toBe("sin_clasificar");
    expect(a1.senalesDeteccion.length).toBeGreaterThan(0);
    expect(a1.servicio).toBe("criolipolisis");
    expect(a1.nivelConsciencia).toBe(5);
  });
  it("una publicación compartida sin texto usa el nombre limpio como copy y queda sin clasificar si no hay señales", () => {
    const a3 = creativos.find((c) => c.anuncioId === "a3")!;
    expect(a3.copyPrincipal).toBe("Grasa localizada, adiós");
    expect(a3.titular).toBeNull();
    expect(a3.servicio).toBe("criolipolisis");
  });
  it("un anuncio cuyo creativo no vino se ignora; un creativo sin anuncio no produce nada", () => {
    expect(creativos.some((c) => c.anuncioId === "a4")).toBe(false);
    expect(mapearCreativosMeta([{ id: "huerfano" }], anuncios)).toHaveLength(0);
  });
});

describe("parsearCreativos", () => {
  it("lee {ad_creatives:[...]} o un arreglo directo", () => {
    expect(parsearCreativos(JSON.stringify({ ad_creatives: [video] }))).toHaveLength(1);
    expect(parsearCreativos(JSON.stringify([video, compartido]))).toHaveLength(2);
    expect(parsearCreativos(JSON.stringify({ ad_creatives: JSON.stringify([video]) }))).toHaveLength(1);
  });
});
