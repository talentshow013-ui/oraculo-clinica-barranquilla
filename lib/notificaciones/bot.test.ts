import { describe, expect, test } from "vitest";
import { armarPeticionGemini, chatPermitido, componerContexto, extraerTextoGemini, limpiarParaTelegram, tipoDeMensaje } from "./bot";

describe("bot · quién puede hablarle", () => {
  test("solo los ids de TELEGRAM_CHAT_ID (varios, con espacios)", () => {
    expect(chatPermitido("111", "111, 222")).toBe(true);
    expect(chatPermitido("222", "111, 222")).toBe(true);
    expect(chatPermitido("333", "111, 222")).toBe(false);
    expect(chatPermitido("111", undefined)).toBe(false);
  });
});

describe("bot · qué trae el mensaje", () => {
  test("texto, voz, audio y foto (la foto más grande)", () => {
    expect(tipoDeMensaje({ text: "hola" })).toEqual({ tipo: "texto", texto: "hola" });
    expect(tipoDeMensaje({ voice: { file_id: "v1", mime_type: "audio/ogg" } })).toEqual({ tipo: "audio", fileId: "v1", mime: "audio/ogg", texto: "" });
    expect(tipoDeMensaje({ audio: { file_id: "a1", mime_type: "audio/mpeg" }, caption: "¿qué es esto?" })).toEqual({ tipo: "audio", fileId: "a1", mime: "audio/mpeg", texto: "¿qué es esto?" });
    expect(tipoDeMensaje({ photo: [{ file_id: "p-chica", width: 90 }, { file_id: "p-grande", width: 800 }], caption: "mira" })).toEqual({ tipo: "imagen", fileId: "p-grande", mime: "image/jpeg", texto: "mira" });
    expect(tipoDeMensaje({})).toEqual({ tipo: "otro", texto: "" });
  });
});

describe("bot · contexto para el modelo", () => {
  const cuenta = {
    nombre: "Vivante (Meta)",
    r: {
      hoy: "2026-09-21",
      lote: { meta: { desde: "2026-08-24", hasta: "2026-09-20" } },
      reciente: { gasto: 1_000_000, impresiones: 50_000, clicsEnlace: 900, conversacionesIniciadas: 40, costoConversacion: 25_000, resultados: 40 },
      previa: { gasto: 800_000, impresiones: 40_000, clicsEnlace: 700, conversacionesIniciadas: 30, costoConversacion: 26_667, resultados: 30 },
      serie: [
        { fecha: "2026-09-19", agregado: { gasto: 70_000, conversacionesIniciadas: 3, impresiones: 3000, clicsEnlace: 60 } },
        { fecha: "2026-09-20", agregado: { gasto: 80_000, conversacionesIniciadas: 4, impresiones: 3500, clicsEnlace: 70 } },
      ],
      campanas: [{ nombre: "Toxina septiembre", estado: "activa", alAire: true, total: { gasto: 500_000, conversacionesIniciadas: 20 }, costoConversacion: 25_000, ultimoDia: "2026-09-20" }],
      hallazgos: [{ titulo: "Un anuncio se comió la plata", explicacion: "x", severidad: "alta", plataEnRiesgo: 120_000, acciones: ["Pausarlo"] }],
      plataEnRiesgoTotal: 120_000,
      organico: { sinDatos: false, redes: [{ red: "instagram", alias: "@vivante", seguidores: 10_000, seguidoresGanados: 120, publicaciones: 8, alcance: 50_000, tasaInteraccion: 0.03 }], paraPauta: [{ titulo: "Reel antes/después" }] },
      pacientes: { sinDatos: false, totales: { leads: 1200, citas: 22, asistieron: 3, ventas: 3, valorVentas: 0 }, tasas: { leadACita: 0.018, citaAAsistencia: 0.14, asistenciaAVenta: 1, leadAVenta: 0.0025 } },
      web: { sinDatos: true },
    },
  } as never;
  test("es JSON compacto con lo que un dueño pregunta, y el día de ayer aparte", () => {
    const c = componerContexto([cuenta], "2026-09-21");
    const j = JSON.parse(c);
    expect(j.hoy).toBe("2026-09-21");
    expect(j.cuentas[0].nombre).toBe("Vivante (Meta)");
    expect(j.cuentas[0].ultimos14Dias.gasto).toBe(1_000_000);
    expect(j.cuentas[0].ayer).toMatchObject({ fecha: "2026-09-20", gasto: 80_000, conversaciones: 4 });
    expect(j.cuentas[0].campanasAlAire[0].nombre).toBe("Toxina septiembre");
    expect(j.cuentas[0].hallazgos[0].plataEnRiesgo).toBe(120_000);
    expect(j.organico.redes[0].alias).toBe("@vivante");
    expect(j.pacientes.totales.leads).toBe(1200);
    expect(j.web).toBeUndefined();
    expect(c.length).toBeLessThan(6000);
  });
});

describe("bot · petición y respuesta de Gemini", () => {
  test("arma partes: texto y adjunto en base64", () => {
    const p = armarPeticionGemini({ sistema: "Eres Oráculo", contexto: "{}", texto: "¿cómo vamos?", adjunto: { mime: "audio/ogg", base64: "AAAA" } });
    expect(p.system_instruction.parts[0]!.text).toBe("Eres Oráculo");
    expect(p.contents[0]!.parts.map((x) => Object.keys(x)[0])).toEqual(["text", "inline_data", "text"]);
    expect(p.contents[0]!.parts[1]).toEqual({ inline_data: { mime_type: "audio/ogg", data: "AAAA" } });
  });
  test("sin texto ni adjunto pide el audio/foto igual", () => {
    const p = armarPeticionGemini({ sistema: "s", contexto: "{}", texto: "", adjunto: { mime: "image/jpeg", base64: "BB" } });
    expect(p.contents[0]!.parts).toHaveLength(3);
  });
  test("saca el texto de la respuesta y avisa si viene vacía", () => {
    expect(extraerTextoGemini({ candidates: [{ content: { parts: [{ text: "Hola " }, { text: "mundo" }] } }] })).toBe("Hola mundo");
    expect(extraerTextoGemini({ candidates: [] })).toBeNull();
    expect(extraerTextoGemini({ error: { message: "quota" } })).toBeNull();
  });
  test("quita markdown que Telegram no entiende", () => {
    expect(limpiarParaTelegram("**Bien:** ayer *40* conversaciones\n## Título\n- punto")).toBe("Bien: ayer 40 conversaciones\nTítulo\n• punto");
  });
});
