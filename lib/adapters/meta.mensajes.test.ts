import { describe, expect, test } from "vitest";
import { buscarMensaje, esGenerico, mensajeDeCreativo, normalizarMensaje } from "./meta.mensajes";

const bienvenida = (autofill: string, texto = "Hola, ¿quieres reducir medidas?") =>
  JSON.stringify({ type: "VISUAL_EDITOR", text_format: { customer_action_type: "autofill_message", message: { autofill_message: { content: autofill }, text: texto } }, image_format: { message: { quick_replies: [{ title: "Quiero obtener más información." }] } } });

describe("mensaje predeterminado de un anuncio de WhatsApp", () => {
  test("lo saca del creativo (imagen o video)", () => {
    expect(mensajeDeCreativo({ object_story_spec: { link_data: { page_welcome_message: bienvenida("¡Hola! Vivante 💎 Quiero mi evaluación para Lipoz 360") } } })).toEqual({ predeterminado: "¡Hola! Vivante 💎 Quiero mi evaluación para Lipoz 360", bienvenida: "Hola, ¿quieres reducir medidas?", respuestasRapidas: ["Quiero obtener más información."] });
    expect(mensajeDeCreativo({ object_story_spec: { video_data: { page_welcome_message: bienvenida("Hola. Como agendo mi valoración") } } })?.predeterminado).toBe("Hola. Como agendo mi valoración");
  });
  test("anuncio hecho desde una publicación: no lo trae (null)", () => {
    expect(mensajeDeCreativo({ object_story_id: "1_2" })).toBeNull();
    expect(mensajeDeCreativo({ object_story_spec: { link_data: { page_welcome_message: "{no es json" } } })).toBeNull();
  });
  test("genérico = no dice de qué anuncio viene", () => {
    expect(esGenerico("¡Hola! Quiero más información.")).toBe(true);
    expect(esGenerico("Hola")).toBe(true);
    expect(esGenerico("¡Hola! Vivante 💎 Quiero mi evaluación para Lipoz 360")).toBe(false);
  });
  test("buscar el anuncio de un mensaje que llegó a Kommo: sin emojis, acentos ni mayúsculas", () => {
    expect(normalizarMensaje("🫨 Hola.  Cómo agendo mi VALORACIÓN para lipo en frío 🎁")).toBe("hola como agendo mi valoracion para lipo en frio");
    const anuncios = [
      { anuncio: "A", predeterminado: "🫨 Hola. Como agendo mi valoración para lipo en frio 🎁" },
      { anuncio: "B", predeterminado: "¡Hola! Vivante 💎 Quiero mi evaluación para Lipoz 360 ⏳ ✨" },
      { anuncio: "C", predeterminado: null },
    ];
    expect(buscarMensaje(anuncios, "hola como agendo mi valoracion para lipo en frio").map((x) => x.anuncio)).toEqual(["A"]);
    expect(buscarMensaje(anuncios, "Lipoz 360").map((x) => x.anuncio)).toEqual(["B"]);
    expect(buscarMensaje(anuncios, "botox")).toEqual([]);
  });
});

describe("archivo de mensajes: todos los anuncios, con los nuevos marcados", () => {
  test("fusionar conserva cuándo se vio cada anuncio por primera vez y dice cuáles son nuevos", async () => {
    const { fusionarMensajes } = await import("./meta.mensajes");
    const a = (id: string, estado = "ACTIVE") => ({ id, cuenta: "F3", cuentaId: "act_1", campana: "C", anuncio: `Anuncio ${id}`, estado, creado: "2026-09-01", predeterminado: `Hola ${id}`, bienvenida: null, desdePublicacion: false, vistoPrimeraVez: "" });
    const viejo = [{ ...a("1"), vistoPrimeraVez: "2026-09-01" }, { ...a("2"), vistoPrimeraVez: "2026-09-02" }];
    const r = fusionarMensajes(viejo, [a("2", "PAUSED"), a("3")], "2026-10-08");
    expect(r.todos.map((x) => `${x.id}:${x.estado}:${x.vistoPrimeraVez}`)).toEqual(["1:ACTIVE:2026-09-01", "2:PAUSED:2026-09-02", "3:ACTIVE:2026-10-08"]);
    expect(r.nuevos.map((x) => x.id)).toEqual(["3"]);
  });
  test("la primera vez no hay «nuevos» (no se avisa de 3.000 anuncios viejos)", async () => {
    const { fusionarMensajes } = await import("./meta.mensajes");
    const r = fusionarMensajes(null, [{ id: "9", cuenta: "F3", cuentaId: "act_1", campana: "C", anuncio: "X", estado: "ACTIVE", creado: "2026-01-01", predeterminado: "Hola", bienvenida: null, desdePublicacion: false, vistoPrimeraVez: "" }], "2026-10-08");
    expect(r.nuevos).toEqual([]);
    expect(r.todos[0]!.vistoPrimeraVez).toBe("2026-10-08");
  });
  test("aviso de anuncios nuevos: el mensaje, y si es genérico o repetido se dice", async () => {
    const { componerAvisoMensajes } = await import("./meta.mensajes");
    const t = componerAvisoMensajes([
      { anuncio: "Lipo nuevo", cuenta: "F3", predeterminado: "Hola, quiero mi valoración de lipo en frío 🎁", repetido: false },
      { anuncio: "Hifu test", cuenta: "F2", predeterminado: "¡Hola! Quiero más información.", repetido: false },
      { anuncio: "Post", cuenta: "F2", predeterminado: null, repetido: false },
    ]);
    expect(t).toMatch(/Lipo nuevo/);
    expect(t).toMatch(/genérico/);
    expect(t).toMatch(/sin mensaje predeterminado/);
  });
});

describe("el emoji es la marca de cada anuncio", () => {
  const anuncios = [
    { anuncio: "Efecto lipo", predeterminado: "¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨" },
    { anuncio: "Liposucción no", predeterminado: "¡Hola, Vivante! ✨ Quiero información sobre CRIOLIPOLISIS🧬✨" },
    { anuncio: "Testeo", predeterminado: "¡Hola, Vivante!  Quiero información sobre CRIOLIPOLISIS 💙🟥" },
  ];
  test("con el emoji, sale solo el anuncio exacto (aunque cambien espacios o mayúsculas)", async () => {
    const { buscarMensajeExacto } = await import("./meta.mensajes");
    const r = buscarMensajeExacto(anuncios, "¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis 🔝 ✨");
    expect(r.exactos.map((x) => x.anuncio)).toEqual(["Efecto lipo"]);
  });
  test("sin coincidencia exacta, devuelve los parecidos (sin contar emojis)", async () => {
    const { buscarMensajeExacto } = await import("./meta.mensajes");
    const r = buscarMensajeExacto(anuncios, "Hola Vivante quiero informacion sobre criolipolisis");
    expect(r.exactos).toEqual([]);
    expect(r.parecidos).toHaveLength(3);
  });
});
