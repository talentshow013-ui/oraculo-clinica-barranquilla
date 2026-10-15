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
    expect(m).toEqual({ direccion: "entrante", conversacion: "77", lead: "9001", texto: "Hola 🔥", creadoEn: T0, asesoraId: null, origen: "waba", tipo: null, bot: false });
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
  test("una nota de voz o foto que llega SIN el campo `text` también cuenta", () => {
    const voz = { message: { add: [{ talk_id: "81", created_at: String(T0), type: "incoming", message_type: "voice", attachment: { type: "voice", link: "x" } }] } };
    const [m] = extraerMensajes(voz);
    expect(m).toMatchObject({ direccion: "entrante", conversacion: "81", texto: "" });
    // y el aviso de una «conversación» (talk) sigue sin contar como mensaje
    expect(extraerMensajes({ talk: { add: [{ talk_id: "81", chat_id: "c", is_in_work: "1" }] } })).toHaveLength(0);
  });
  test("el formato real de Kommo (visto en la VPS): outgoing_message[add][0][...] con author[user_id]", () => {
    const cuerpo = new URLSearchParams({
      "account[subdomain]": "vivante",
      "outgoing_message[add][0][talk_id]": "500",
      "outgoing_message[add][0][chat_id]": "abc-def",
      "outgoing_message[add][0][text]": "Hola, con gusto",
      "outgoing_message[add][0][type]": "outgoing",
      "outgoing_message[add][0][created_at]": String(T0),
      "outgoing_message[add][0][author][type]": "internal",
      "outgoing_message[add][0][author][user_id]": "12345",
      "outgoing_message[add][0][author][name]": "Asesora",
      "outgoing_message[add][0][recipient][name]": "Paciente",
    }).toString();
    const [m] = extraerMensajes(aObjeto("application/x-www-form-urlencoded", cuerpo));
    expect(m).toMatchObject({ direccion: "saliente", conversacion: "500", asesoraId: "12345", creadoEn: T0 });
    expect(JSON.stringify(m)).not.toContain("Paciente");
  });
  test("un saliente sin user_id (bot o automatización) no tiene asesora", () => {
    const [m] = extraerMensajes({ outgoing_message: { add: [{ talk_id: "1", text: "Hola", created_at: String(T0), type: "outgoing", author: { type: "internal", user_id: "" } }] } });
    expect(m!.asesoraId).toBeNull();
  });
  test("el bot de Kommo llega con user_id 0: es bot, no una asesora (visto en la VPS: «asesora 0» respondía en 3 s)", () => {
    const [m] = extraerMensajes({ outgoing_message: { add: [{ talk_id: "1", text: "¡Hola! Soy el asistente", created_at: String(T0), type: "outgoing", message_type: "text", author: { type: "internal", user_id: "0" } }] } });
    expect(m).toMatchObject({ asesoraId: null, bot: true, tipo: "text" });
    const e = aplicarMensaje(aplicarMensaje(vacio(), entrante("1", "Hola"), ctx).estado, m!, ctx);
    expect(e.efecto).toBe("ignorado");
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

/* ───────────── fase 2: embudo, cierre de conversaciones, pendientes y gasto ───────────── */
import { aplicarTalk, cruzarLeads, extraerTalks, pendientesDeRespuesta } from "./kommo.conversaciones";
import type { EtapaKommo } from "./kommo";

const ETAPAS: EtapaKommo[] = [
  { id: 1, nombre: "Leads Entrantes", pipelineId: 10, tipo: "normal", orden: 1 },
  { id: 3, nombre: "AGENDADO", pipelineId: 10, tipo: "normal", orden: 3 },
  { id: 4, nombre: "MIS PACIENTES", pipelineId: 10, tipo: "normal", orden: 4 },
  { id: 142, nombre: "Leads ganados", pipelineId: 10, tipo: "ganado", orden: 99 },
  { id: 143, nombre: "Leads perdidos", pipelineId: 10, tipo: "perdido", orden: 100 },
];

describe("Kommo webhook · atribución con id del anuncio (para cruzar con el gasto)", () => {
  test("el anuncio atribuido trae su id de Meta", () => {
    expect(atribuir("¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨", ANUNCIOS).anuncioId).toBe("1");
    expect(atribuir("Hola 🔥 quiero la promo de Botox", ANUNCIOS).anuncioId).toBeNull();
  });
});

describe("Kommo webhook · conversación cerrada en Kommo (talk)", () => {
  test("talk[update] con is_in_work=0 cierra la conversación; los mensajes no son talks", () => {
    const raiz = aObjeto("application/x-www-form-urlencoded", new URLSearchParams({ "talk[update][0][talk_id]": "77", "talk[update][0][chat_id]": "c", "talk[update][0][is_in_work]": "0", "talk[update][0][is_read]": "1" }).toString());
    expect(extraerTalks(raiz)).toEqual([{ conversacion: "77", enTrabajo: false }]);
    expect(extraerMensajes(raiz)).toHaveLength(0);
    expect(extraerTalks({ message: { add: [{ talk_id: "77", text: "Hola", type: "incoming" }] } })).toHaveLength(0);
  });
  test("una conversación cerrada sin respuesta no queda pendiente; si se reabre, vuelve", () => {
    let e = aplicarMensaje(vacio(), entrante("77", "gracias", T0), ctx).estado;
    e = aplicarTalk(e, { conversacion: "77", enTrabajo: false }, ctx.secreto);
    expect(Object.values(e.conversaciones)[0]!.cerrada).toBe(true);
    expect(pendientesDeRespuesta(e, T0 + 7200)).toHaveLength(0);
    e = aplicarTalk(e, { conversacion: "77", enTrabajo: true }, ctx.secreto);
    expect(pendientesDeRespuesta(e, T0 + 7200)).toHaveLength(1);
    // un talk de una conversación que no conocemos no crea nada
    expect(Object.keys(aplicarTalk(vacio(), { conversacion: "9", enTrabajo: false }, ctx.secreto).conversaciones)).toHaveLength(0);
  });
});

describe("Kommo webhook · pendientes de respuesta (aviso de más de 1 h)", () => {
  // T0 = 2026-09-21 ~09:13 en Bogotá (horario de atención)
  test("más de 60 min sin respuesta de una persona, empezada en horario y no muy vieja", () => {
    let e = aplicarMensaje(vacio(), entrante("a", "Hola 🔥 quiero la promo de Botox", T0), ctx).estado;
    e = aplicarMensaje(e, entrante("b", "Hola", T0 + 600), ctx).estado;
    e = aplicarMensaje(e, saliente("b", T0 + 900), ctx).estado; // respondida
    const p = pendientesDeRespuesta(e, T0 + 3700);
    expect(p).toHaveLength(1);
    expect(p[0]!.esperaSeg).toBe(3700);
    expect(pendientesDeRespuesta(e, T0 + 1800)).toHaveLength(0); // aún no pasa la hora
    expect(pendientesDeRespuesta(e, T0 + 13 * 3600)).toHaveLength(0); // demasiado vieja: no se avisa a destiempo
  });
  test("lo que entra de noche no se avisa (se ve en el resumen de la mañana)", () => {
    const noche = T0 + 14 * 3600; // ~23:13 Bogotá
    const e = aplicarMensaje(vacio(), entrante("n", "Hola", noche), ctx).estado;
    expect(pendientesDeRespuesta(e, noche + 7200)).toHaveLength(0);
  });
});

describe("Kommo webhook · cruce con el embudo de Kommo (cita, asistió, venta)", () => {
  test("la huella del lead de la conversación se cruza con su etapa actual, sin guardar el id", () => {
    let e = aplicarMensaje(vacio(), entrante("a", "¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨", T0, { lead: "500" }), ctx).estado;
    e = aplicarMensaje(e, entrante("b", "¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨", T0, { lead: "501" }), ctx).estado;
    e = aplicarMensaje(e, entrante("c", "¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨", T0, { lead: "502" }), ctx).estado;
    const huellas = new Set(Object.values(e.conversaciones).map((c) => c.lead!).filter(Boolean));
    const leads = [
      { id: 500, etapaId: 142, precio: 900000 },
      { id: 501, etapaId: 3, precio: 0 },
      { id: 502, etapaId: 143, precio: 0 },
      { id: 999, etapaId: 4, precio: 0 }, // otro lead que no vino por estas conversaciones
    ];
    const cruce = cruzarLeads(huellas, leads, ETAPAS, {}, ctx.secreto);
    expect(Object.keys(cruce)).toHaveLength(3);
    expect(JSON.stringify(cruce)).not.toContain("500");
    const r = resumir(e, { desde: "2026-09-21", hasta: "2026-09-21", ahora: T0 + 60, embudo: cruce, gastoPorAnuncio: { "1": 150000 } });
    expect(r.porAnuncio[0]).toMatchObject({ anuncioId: "1", conversaciones: 3, citas: 2, asistieron: 1, ventas: 1, valor: 900000, gasto: 150000, costoConversacion: 50000, costoCita: 75000, costoVenta: 150000 });
    expect(r.embudo).toMatchObject({ conversaciones: 3, conLead: 3, citas: 2, asistieron: 1, ventas: 1, valor: 900000 });
  });
  test("sin cruce todavía: citas y ventas en cero y costos que dependen de ellas en null", () => {
    const e = aplicarMensaje(vacio(), entrante("a", "¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨", T0), ctx).estado;
    const r = resumir(e, { desde: "2026-09-21", hasta: "2026-09-21", ahora: T0, gastoPorAnuncio: { "1": 30000 } });
    expect(r.porAnuncio[0]).toMatchObject({ citas: 0, ventas: 0, gasto: 30000, costoConversacion: 30000, costoVenta: null });
  });
});
