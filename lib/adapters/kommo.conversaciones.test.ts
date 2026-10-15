import { describe, expect, test } from "vitest";
import { validarSinPII } from "@/lib/privacy";
import type { AnuncioMensaje } from "./meta.mensajes";
import {
  aObjeto,
  aplicarMensaje,
  atribuir,
  extraerMensajes,
  huella,
  purgar,
  resumir,
  type EstadoConversaciones,
  type MensajeKommo,
} from "./kommo.conversaciones";

const anuncio = (p: Partial<AnuncioMensaje> & { id: string; predeterminado: string | null }): AnuncioMensaje => ({
  cuenta: "F3 Corporal",
  cuentaId: "act_1",
  campana: "Interaccion_Criolipolisis_Frio_WPP",
  anuncio: "Criolipolisis_Video",
  estado: "ACTIVE",
  creado: "2026-02-14",
  bienvenida: null,
  desdePublicacion: false,
  vistoPrimeraVez: "2026-02-14",
  ...p,
});

const ANUNCIOS: AnuncioMensaje[] = [
  anuncio({ id: "1", predeterminado: "¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨" }),
  anuncio({ id: "2", predeterminado: "¡Hola, Vivante! ✨ Quiero información sobre Lipoz 360 💎", campana: "Lipoz_Frio", anuncio: "Lipoz_Reel" }),
  // dos anuncios con exactamente el mismo mensaje, uno activo y uno pausado
  anuncio({ id: "3", predeterminado: "Hola Vivante 🌸 quiero valoración de Bioláser", campana: "Biolaser_A", anuncio: "Biolaser_V1", estado: "ACTIVE" }),
  anuncio({ id: "4", predeterminado: "Hola Vivante 🌸 quiero valoración de Bioláser", campana: "Biolaser_A", anuncio: "Biolaser_V0", estado: "PAUSED" }),
  // dos activos con el mismo mensaje en campañas distintas → ambiguo
  anuncio({ id: "5", predeterminado: "Hola 🔥 quiero la promo de Botox", campana: "Botox_1", anuncio: "B1" }),
  anuncio({ id: "6", predeterminado: "Hola 🔥 quiero la promo de Botox", campana: "Botox_2", anuncio: "B2" }),
  // genérico
  anuncio({ id: "7", predeterminado: "Hola, quiero información" }),
  anuncio({ id: "8", predeterminado: null, desdePublicacion: true }),
];

const T0 = 1_790_000_000; // segundos Unix, un instante cualquiera

const entrante = (conv: string, texto: string, t = T0, extra: Partial<MensajeKommo> = {}): MensajeKommo => ({
  direccion: "entrante",
  conversacion: conv,
  lead: "9001",
  texto,
  creadoEn: t,
  asesoraId: null,
  origen: "waba",
  ...extra,
});
const saliente = (conv: string, t: number, asesoraId: string | null = "55"): MensajeKommo => ({
  direccion: "saliente",
  conversacion: conv,
  lead: "9001",
  texto: "Hola, con gusto te cuento",
  creadoEn: t,
  asesoraId,
  origen: "waba",
});

const vacio = (): EstadoConversaciones => ({ version: 1, actualizadoEn: "", conversaciones: {} });
const ctx = { secreto: "s3creto", anuncios: ANUNCIOS };

describe("Kommo webhook · leer el cuerpo", () => {
  test("formulario con corchetes (x-www-form-urlencoded) → objeto anidado", () => {
    const cuerpo = new URLSearchParams({
      "account[subdomain]": "vivante",
      "message[add][0][id]": "abc",
      "message[add][0][chat_id]": "c-1",
      "message[add][0][talk_id]": "77",
      "message[add][0][text]": "Hola",
      "message[add][0][author][id]": "x",
    }).toString();
    const o = aObjeto("application/x-www-form-urlencoded; charset=UTF-8", cuerpo) as any;
    expect(o.account.subdomain).toBe("vivante");
    expect(o.message.add[0].talk_id).toBe("77");
    expect(o.message.add[0].author.id).toBe("x");
  });
  test("JSON también se acepta, y basura no rompe nada", () => {
    expect((aObjeto("application/json", '{"a":{"b":1}}') as any).a.b).toBe(1);
    expect(aObjeto("application/json", "{no es json")).toEqual({});
    expect(aObjeto(null, "")).toEqual({});
  });
});

describe("Kommo webhook · extraer mensajes", () => {
  test("mensaje entrante: dirección, conversación, lead, texto y hora", () => {
    const raiz = {
      account: { subdomain: "vivante" },
      message: { add: [{ id: "m1", chat_id: "c-1", talk_id: "77", contact_id: "5", text: "Hola 🔥", created_at: String(T0), element_type: "2", entity_type: "lead", element_id: "9001", entity_id: "9001", type: "incoming", origin: "waba", author: { id: "x", type: "external", name: "Persona" } }] },
    };
    const [m] = extraerMensajes(raiz);
    expect(m).toEqual({ direccion: "entrante", conversacion: "77", lead: "9001", texto: "Hola 🔥", creadoEn: T0, asesoraId: null, origen: "waba" });
  });
  test("mensaje saliente de una asesora: lleva su id y no su nombre", () => {
    const raiz = { message: { add: [{ chat_id: "c-1", talk_id: "77", text: "Listo", created_at: String(T0 + 90), type: "outgoing", entity_type: "lead", entity_id: "9001", author: { type: "internal", user_id: "55", name: "Asesora Uno" } }] } };
    const [m] = extraerMensajes(raiz);
    expect(m!.direccion).toBe("saliente");
    expect(m!.asesoraId).toBe("55");
    expect(JSON.stringify(m)).not.toContain("Asesora Uno");
  });
  test("saliente que viene bajo outgoing_message, sin `type`: se reconoce por la clave y por el autor interno", () => {
    const raiz = { outgoing_message: { add: [{ chat_id: "c-9", text: "Hola", created_at: String(T0), author: { type: "internal", user_id: "7" } }] } };
    const [m] = extraerMensajes(raiz);
    expect(m!.direccion).toBe("saliente");
    expect(m!.conversacion).toBe("c-9");
  });
  test("si no hay talk_id usa chat_id; un aviso de «talk» (sin texto) o de lead no es un mensaje", () => {
    const raiz = { message: { add: [{ chat_id: "c-2", text: "Buenas", created_at: String(T0), type: "incoming" }] }, talk: { add: [{ talk_id: "77", chat_id: "c-1", is_in_work: "1" }] }, leads: { add: [{ id: "9001", name: "x" }] } };
    const ms = extraerMensajes(raiz);
    expect(ms).toHaveLength(1);
    expect(ms[0]!.conversacion).toBe("c-2");
  });
  test("los mensajes sin texto (foto, audio) cuentan igual, con texto vacío", () => {
    const raiz = { message: { add: [{ talk_id: "80", text: "", created_at: String(T0), type: "incoming", message_type: "picture" }] } };
    expect(extraerMensajes(raiz)[0]!.texto).toBe("");
  });
});

describe("Kommo webhook · de qué anuncio vino", () => {
  test("el mensaje predeterminado exacto (con sus emojis) dice campaña y anuncio", () => {
    const a = atribuir("¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨", ANUNCIOS);
    expect(a).toMatchObject({ nivel: "exacto", campana: "Interaccion_Criolipolisis_Frio_WPP", cuenta: "F3 Corporal" });
  });
  test("espacios, tildes y mayúsculas no importan, el emoji sí", () => {
    expect(atribuir("hola vivante ✨ quiero informacion sobre criolipolisis🔝 ✨", ANUNCIOS).nivel).toBe("exacto");
    // mismo texto pero OTRO emoji = otro anuncio que no está en la lista: no se le atribuye al de Lipoz
    expect(atribuir("¡Hola, Vivante! ✨ Quiero información sobre Lipoz 360 🔝", ANUNCIOS).nivel).toBe("ninguno");
  });
  test("si la persona reescribió el mensaje sin emojis y solo un anuncio se parece → «parecido»", () => {
    expect(atribuir("Hola Vivante quiero información sobre Lipoz 360", ANUNCIOS)).toMatchObject({ nivel: "parecido", anuncio: "Lipoz_Reel" });
  });
  test("mismo mensaje en un anuncio activo y uno pausado → el activo (nivel «activo»)", () => {
    expect(atribuir("Hola Vivante 🌸 quiero valoración de Bioláser", ANUNCIOS)).toMatchObject({ nivel: "activo", anuncio: "Biolaser_V1" });
  });
  test("mismo mensaje en dos campañas activas → ambiguo, sin inventar", () => {
    const a = atribuir("Hola 🔥 quiero la promo de Botox", ANUNCIOS);
    expect(a.nivel).toBe("ambiguo");
    expect(a.campana).toBeNull();
  });
  test("mensaje genérico → no se atribuye; lo que no se parece a nada → ninguno", () => {
    expect(atribuir("Hola, quiero información", ANUNCIOS).nivel).toBe("generico");
    expect(atribuir("Ok gracias, ¿a qué hora cierran?", ANUNCIOS).nivel).toBe("ninguno");
    expect(atribuir("", ANUNCIOS).nivel).toBe("ninguno");
  });
  test("el resultado nunca contiene el texto del paciente", () => {
    expect(JSON.stringify(atribuir("¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨", ANUNCIOS))).not.toContain("Quiero");
  });
});

describe("Kommo webhook · conversaciones", () => {
  test("el primer mensaje abre la conversación y guarda de qué anuncio vino, sin el texto", () => {
    const r = aplicarMensaje(vacio(), entrante("77", "¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨"), ctx);
    expect(r.efecto).toBe("nueva");
    const guardado = JSON.stringify(r.estado);
    expect(guardado).not.toContain("Quiero");
    expect(guardado).not.toContain("77"); // ni siquiera el id crudo: va con huella
    const [c] = Object.values(r.estado.conversaciones);
    expect(c!.atribucion.campana).toBe("Interaccion_Criolipolisis_Frio_WPP");
    expect(c!.respuesta).toBeNull();
    expect(c!.dia).toBe("2026-09-21");
  });
  test("la primera respuesta de una asesora fija el tiempo y quién fue; la segunda no lo cambia", () => {
    let e = aplicarMensaje(vacio(), entrante("77", "Hola 🔥 quiero la promo de Botox"), ctx).estado;
    const r1 = aplicarMensaje(e, saliente("77", T0 + 240), ctx);
    expect(r1.efecto).toBe("respuesta");
    e = r1.estado;
    const r2 = aplicarMensaje(e, saliente("77", T0 + 5000, "99"), ctx);
    expect(r2.efecto).toBe("seguimiento");
    const [c] = Object.values(r2.estado.conversaciones);
    expect(c).toMatchObject({ respuesta: 240, asesoraId: "55" });
  });
  test("un mensaje automático (sin id de asesora) no cuenta como respuesta humana", () => {
    const e = aplicarMensaje(vacio(), entrante("77", "Hola"), ctx).estado;
    const r = aplicarMensaje(e, saliente("77", T0 + 2, null), ctx);
    expect(r.efecto).toBe("ignorado");
    expect(Object.values(r.estado.conversaciones)[0]!.respuesta).toBeNull();
  });
  test("una respuesta a una conversación que no vimos empezar se ignora (no hay hora de inicio)", () => {
    expect(aplicarMensaje(vacio(), saliente("123", T0), ctx).efecto).toBe("ignorado");
  });
  test("más mensajes del paciente en la misma conversación no abren otra", () => {
    let e = aplicarMensaje(vacio(), entrante("77", "Hola"), ctx).estado;
    const r = aplicarMensaje(e, entrante("77", "¿sigue la promo?", T0 + 60), ctx);
    expect(r.efecto).toBe("seguimiento");
    expect(Object.keys(r.estado.conversaciones)).toHaveLength(1);
  });
  test("el estado guardado pasa el guardián de privacidad", () => {
    let e = aplicarMensaje(vacio(), entrante("77", "Hola 🔥 quiero la promo de Botox"), ctx).estado;
    e = aplicarMensaje(e, saliente("77", T0 + 60), ctx).estado;
    expect(() => validarSinPII(e)).not.toThrow();
  });
  test("la huella es estable, depende del secreto y no revela el id", () => {
    expect(huella("a", "77")).toBe(huella("a", "77"));
    expect(huella("a", "77")).not.toBe(huella("b", "77"));
    expect(huella("a", "77")).not.toContain("77");
  });
  test("purgar quita lo muy viejo", () => {
    const e = aplicarMensaje(vacio(), entrante("77", "Hola", T0), ctx).estado;
    expect(Object.keys(purgar(e, T0 + 91 * 86_400, 90).conversaciones)).toHaveLength(0);
    expect(Object.keys(purgar(e, T0 + 10 * 86_400, 90).conversaciones)).toHaveLength(1);
  });
});

describe("Kommo webhook · resumen", () => {
  test("por anuncio, qué tanto se identifica y cómo atiende cada asesora", () => {
    let e = vacio();
    const crea = (conv: string, texto: string, t: number) => (e = aplicarMensaje(e, entrante(conv, texto, t), ctx).estado);
    const resp = (conv: string, t: number, ase: string) => (e = aplicarMensaje(e, saliente(conv, t, ase), ctx).estado);
    const croio = "¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨";
    crea("a", croio, T0);
    resp("a", T0 + 120, "55"); // 2 min
    crea("b", croio, T0 + 10);
    resp("b", T0 + 10 + 1200, "55"); // 20 min
    crea("c", "Hola, quiero información", T0 + 20);
    resp("c", T0 + 20 + 60, "66"); // 1 min
    crea("d", "¿Dónde quedan?", T0 + 30); // sin respuesta
    const r = resumir(e, { desde: "2026-09-21", hasta: "2026-09-21", ahora: T0 + 7200 });
    expect(r.nuevas).toBe(4);
    expect(r.porAnuncio).toHaveLength(1);
    expect(r.porAnuncio[0]).toMatchObject({ campana: "Interaccion_Criolipolisis_Frio_WPP", conversaciones: 2, atendidas: 2 });
    expect(r.identificadas).toBe(2);
    expect(r.sinIdentificar).toMatchObject({ total: 2, genericas: 1, ninguno: 1, ambiguas: 0 });
    expect(r.atencion.atendidas).toBe(3);
    expect(r.atencion.sinRespuesta).toBe(1);
    expect(r.atencion.hasta5min).toBe(2);
    expect(r.atencion.medianaSeg).toBe(120);
    const a55 = r.atencion.porAsesora.find((x) => x.asesoraId === "55")!;
    expect(a55).toMatchObject({ atendidas: 2, medianaSeg: 660 });
  });
  test("lo que está fuera del rango no entra, y lo reciente sin respuesta aún no es «sin respuesta»", () => {
    const e = aplicarMensaje(vacio(), entrante("a", "Hola", T0), ctx).estado;
    expect(resumir(e, { desde: "2026-09-01", hasta: "2026-09-02", ahora: T0 }).nuevas).toBe(0);
    expect(resumir(e, { desde: "2026-09-21", hasta: "2026-09-21", ahora: T0 + 300 }).atencion.sinRespuesta).toBe(0);
  });
});
