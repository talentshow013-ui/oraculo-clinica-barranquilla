import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { EstadoConversaciones } from "./kommo.conversaciones";
import { cifrar, descifrar, filtrarConversaciones, formatearConversaciones, guardarChats, leerChats, purgarChats, redactar, unirConversaciones, type RegistroChat } from "./chats";

const LLAVE = "a".repeat(64); // 32 bytes en hex (de prueba)
const T0 = 1_790_000_000; // 2026-09-21 09:13 en Bogotá
const dir = () => mkdtempSync(join(tmpdir(), "oraculo-chats-"));

describe("Chats · borrar teléfonos y correos del texto antes de guardarlo", () => {
  test("teléfonos colombianos en varios formatos, correos y documentos", () => {
    expect(redactar("mi cel es 300 123 4567, escríbeme")).toBe("mi cel es [número], escríbeme");
    expect(redactar("+57 3001234567")).toBe("[número]");
    expect(redactar("llama al 310-555-1234")).toBe("llama al [número]");
    expect(redactar("correo ana.perez@gmail.com ok")).toBe("correo [correo] ok");
    expect(redactar("cédula 1.234.567.890")).toBe("cédula [número]");
  });
  test("precios, horas, fechas y cantidades cortas se quedan (sirven para analizar)", () => {
    expect(redactar("¿cuánto vale? $350.000 o 350000")).toBe("¿cuánto vale? $350.000 o 350000");
    expect(redactar("a las 3:30 pm del 15/10, 2 sesiones")).toBe("a las 3:30 pm del 15/10, 2 sesiones");
  });
});

describe("Chats · cifrado en disco", () => {
  test("ida y vuelta; con otra llave o alterado no se lee", () => {
    const linea = cifrar(LLAVE, { hola: "mundo" });
    expect(linea).not.toContain("mundo");
    expect(descifrar(LLAVE, linea)).toEqual({ hola: "mundo" });
    expect(descifrar("b".repeat(64), linea)).toBeNull();
    expect(descifrar(LLAVE, linea.slice(0, -4) + "AAAA")).toBeNull();
  });
});

const reg = (p: Partial<RegistroChat>): RegistroChat => ({ t: T0, conv: "h1", dir: "entrante", texto: "Hola", tipo: "text", asesoraId: null, bot: false, ...p });

describe("Chats · guardar por día, leer por rango y borrar a los 30 días", () => {
  test("cada mensaje va al archivo de su día (Bogotá), cifrado y privado", () => {
    const d = dir();
    guardarChats(d, LLAVE, [reg({}), reg({ t: T0 + 86_400, texto: "otro día" })]);
    expect(readdirSync(d).sort()).toEqual(["2026-09-21.chat", "2026-09-22.chat"]);
    expect(readFileSync(join(d, "2026-09-21.chat"), "utf8")).not.toContain("Hola");
    expect((statSync(join(d, "2026-09-21.chat")).mode & 0o777).toString(8)).toBe("600");
    expect(leerChats(d, LLAVE, "2026-09-21", "2026-09-21").map((r) => r.texto)).toEqual(["Hola"]);
    expect(leerChats(d, LLAVE, "2026-09-21", "2026-09-22")).toHaveLength(2);
  });
  test("purgar borra los días con más de 30 días", () => {
    const d = dir();
    writeFileSync(join(d, "2026-08-01.chat"), "x");
    writeFileSync(join(d, "2026-09-20.chat"), "x");
    purgarChats(d, "2026-09-21", 30);
    expect(existsSync(join(d, "2026-08-01.chat"))).toBe(false);
    expect(existsSync(join(d, "2026-09-20.chat"))).toBe(true);
    void utimesSync;
  });
});

describe("Chats · conversaciones legibles (para «revisa las de ayer» o «las de este anuncio»)", () => {
  const estado: EstadoConversaciones = {
    version: 1,
    actualizadoEn: "",
    conversaciones: {
      h1: { inicio: T0, dia: "2026-09-21", origen: "waba", atribucion: { nivel: "exacto", cuenta: "F3", campana: "Crio_Frio", anuncio: "Crio_Video", anuncioId: "77" }, lead: "L1", respuesta: 240, asesoraId: "9", mensajes: 3 },
      h2: { inicio: T0 + 600, dia: "2026-09-21", origen: "waba", atribucion: { nivel: "generico", cuenta: null, campana: null, anuncio: null }, lead: null, respuesta: null, asesoraId: null, mensajes: 1 },
    },
  };
  const registros: RegistroChat[] = [
    reg({ conv: "h1", texto: "Hola quiero Criolipólisis 🔝" }),
    reg({ conv: "h1", t: T0 + 5, dir: "saliente", texto: "¡Hola! Soy el asistente", bot: true }),
    reg({ conv: "h1", t: T0 + 240, dir: "saliente", texto: "Hola, te cuento los precios", asesoraId: "9" }),
    reg({ conv: "h2", t: T0 + 600, texto: "Hola, quiero información" }),
  ];
  const lista = unirConversaciones(registros, estado, { L1: { paso: "cita_agendada", perdido: false, valor: null } }, { "9": "Laura" });

  test("cada conversación trae su anuncio, quién atendió, el resultado y los mensajes en orden", () => {
    expect(lista).toHaveLength(2);
    const c = lista.find((x) => x.huella === "h1")!;
    expect(c).toMatchObject({ anuncio: "Crio_Video", campana: "Crio_Frio", asesora: "Laura", resultado: "cita agendada", primeraRespuestaSeg: 240 });
    expect(c.mensajes.map((m) => m.quien)).toEqual(["Paciente", "Bot", "Laura"]);
  });
  test("buscar y excluir por texto en TODAS las conversaciones (frase o número, sin importar tildes ni mayúsculas)", () => {
    expect(filtrarConversaciones(lista, { buscar: ["PRECIOS"] }).map((c) => c.huella)).toEqual(["h1"]);
    expect(filtrarConversaciones(lista, { excluir: ["quiero información"] }).map((c) => c.huella)).toEqual(["h1"]);
    expect(filtrarConversaciones(lista, { excluir: ["informacion", "criolipolisis"] })).toHaveLength(0);
  });
  test("sin difusiones: solo las conversaciones que empezó la persona (las que abrió la clínica o el bot quedan fuera)", () => {
    const conDifusion = [...lista, { ...lista[0]!, huella: "dif", mensajes: [{ t: T0, quien: "Bot", texto: "¿Y si este mes llegas a tu peso ideal?" }] }];
    expect(filtrarConversaciones(conDifusion, { escribioPrimero: true }).map((c) => c.huella).sort()).toEqual(["h1", "h2"]);
  });
  test("filtros: por anuncio o campaña (sin importar tildes ni mayúsculas), por asesora, por resultado y sin respuesta", () => {
    expect(filtrarConversaciones(lista, { anuncio: "crio" }).map((c) => c.huella)).toEqual(["h1"]);
    expect(filtrarConversaciones(lista, { asesora: "laura" }).map((c) => c.huella)).toEqual(["h1"]);
    expect(filtrarConversaciones(lista, { resultado: "cita" }).map((c) => c.huella)).toEqual(["h1"]);
    expect(filtrarConversaciones(lista, { sinRespuesta: true }).map((c) => c.huella)).toEqual(["h2"]);
  });
  test("chat que ya venía de antes (la asesora escribe primero): no dice «sin respuesta» y empieza en su primer mensaje", () => {
    const e2: EstadoConversaciones = { version: 1, actualizadoEn: "", conversaciones: { h3: { inicio: T0 + 60, dia: "2026-09-21", origen: null, atribucion: { nivel: "ninguno", cuenta: null, campana: null, anuncio: null }, lead: null, respuesta: null, asesoraId: null, mensajes: 1 } } };
    const l = unirConversaciones([reg({ conv: "h3", t: T0, dir: "saliente", texto: "¿Pudiste revisar?", asesoraId: "9" }), reg({ conv: "h3", t: T0 + 60, texto: "Sí, gracias" })], e2, {}, { "9": "Laura" });
    expect(l[0]!.inicio).toBe(T0);
    const t = formatearConversaciones(l);
    expect(t).not.toContain("sin respuesta de una persona");
    expect(t).toContain("ya venía de antes");
  });
  test("el texto para leer: encabezado por conversación y los mensajes con hora y quién; nunca el nombre del paciente", () => {
    const t = formatearConversaciones(lista);
    expect(t).toContain("Crio_Video");
    expect(t).toContain("cita agendada");
    expect(t).toMatch(/09:13 Paciente: Hola quiero Criolipólisis/);
    expect(t).toMatch(/09:17 Laura: Hola, te cuento los precios/);
  });
});
