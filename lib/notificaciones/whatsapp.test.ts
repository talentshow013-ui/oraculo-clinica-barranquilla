import { describe, expect, test } from "vitest";
import type { Pendiente, ResumenConversaciones } from "@/lib/adapters/kommo.conversaciones";
import { bloqueWhatsapp, componerAvisoSinRespuesta, duracion } from "./whatsapp";

const base: ResumenConversaciones = {
  desde: "2026-10-16",
  hasta: "2026-10-16",
  nuevas: 12,
  identificadas: 8,
  porAnuncio: [
    { cuenta: "F3", campana: "Crio", anuncio: "Crio_Video <V1>", anuncioId: "1", conversaciones: 5, conLead: 5, citas: 2, asistieron: 1, ventas: 1, valor: 900000, atendidas: 5, medianaSeg: 240, certeza: "exacto", gasto: 100000, costoConversacion: 20000, costoCita: 50000, costoVenta: 100000 },
    { cuenta: "F2", campana: "Lipoz", anuncio: "Lipoz_Reel", anuncioId: "2", conversaciones: 3, conLead: 3, citas: 0, asistieron: 0, ventas: 0, valor: 0, atendidas: 2, medianaSeg: 600, certeza: "exacto", gasto: null, costoConversacion: null, costoCita: null, costoVenta: null },
  ],
  sinIdentificar: { total: 4, genericas: 3, ambiguas: 0, ninguno: 1 },
  embudo: { conversaciones: 12, conLead: 11, citas: 3, asistieron: 1, ventas: 1, valor: 900000 },
  atencion: { atendidas: 10, sinRespuesta: 2, cerradasSinRespuesta: 0, hasta5min: 6, hasta15min: 8, hasta60min: 10, medianaSeg: 300, porAsesora: [] },
};

describe("Telegram · bloque de WhatsApp en el resumen", () => {
  test("corto y entendible: conversaciones, de qué anuncio, respuesta, sin respuesta, citas", () => {
    const t = bloqueWhatsapp(base).join("\n");
    expect(t).toContain("12 conversaciones nuevas");
    expect(t).toContain("8 de anuncios identificados");
    expect(t).toContain("5 min"); // mediana
    expect(t).toContain("2 sin respuesta");
    expect(t).toContain("3 citas");
    expect(t).toContain("Crio_Video");
    expect(t).toContain("&lt;V1&gt;"); // HTML escapado
  });
  test("sin conversaciones en el periodo: una línea", () => {
    expect(bloqueWhatsapp({ ...base, nuevas: 0, identificadas: 0, porAnuncio: [] })).toEqual(["💬 <b>WhatsApp (Kommo)</b>", "Sin conversaciones nuevas."]);
  });
});

describe("Telegram · aviso de conversaciones sin respuesta", () => {
  const p: Pendiente[] = [
    { huella: "a", esperaSeg: 7500, atribucion: { nivel: "exacto", cuenta: "F3", campana: "Crio", anuncio: "Crio_Video", anuncioId: "1" } },
    { huella: "b", esperaSeg: 3700, atribucion: { nivel: "generico", cuenta: null, campana: null, anuncio: null } },
  ];
  test("agrupado en un mensaje, con la espera más larga y de qué anuncios vienen; sin nada de pacientes", () => {
    const t = componerAvisoSinRespuesta(p, "10:15");
    expect(t).toContain("2 conversaciones de WhatsApp");
    expect(t).toContain("2 h 5 min");
    expect(t).toContain("Crio_Video");
    expect(t).toContain("Kommo");
  });
  test("duración legible", () => {
    expect(duracion(45)).toBe("45 s");
    expect(duracion(600)).toBe("10 min");
    expect(duracion(3600)).toBe("1 h");
    expect(duracion(null)).toBe("—");
  });
});
