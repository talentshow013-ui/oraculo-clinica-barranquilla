import { mkdtempSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { AnuncioMensaje } from "./meta.mensajes";
import { cargarConversaciones } from "./conversaciones.archivo";
import { procesarAviso, secretoValido } from "./kommo.webhook";

const T0 = 1_790_000_000;
const ANUNCIOS: AnuncioMensaje[] = [
  { id: "1", cuenta: "F3 Corporal", cuentaId: "act_1", campana: "Criolipolisis_Frio", anuncio: "Criolipolisis_Video", estado: "ACTIVE", creado: "2026-02-14", predeterminado: "¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨", bienvenida: null, desdePublicacion: false, vistoPrimeraVez: "2026-02-14" },
];
const TEXTO_SECRETO_DEL_PACIENTE = "¡Hola, Vivante! ✨ Quiero información sobre Criolipólisis🔝 ✨";

const ruta = () => join(mkdtempSync(join(tmpdir(), "oraculo-conv-")), "conversaciones.json");
const formulario = (campos: Record<string, string>) => new URLSearchParams(campos).toString();
const FORM = "application/x-www-form-urlencoded";

const entrante = (talk: string, texto: string, t = T0) =>
  formulario({ "account[subdomain]": "vivante", "message[add][0][talk_id]": talk, "message[add][0][chat_id]": "c-" + talk, "message[add][0][text]": texto, "message[add][0][created_at]": String(t), "message[add][0][type]": "incoming", "message[add][0][entity_type]": "lead", "message[add][0][entity_id]": "9001", "message[add][0][origin]": "waba", "message[add][0][author][name]": "Nombre De Paciente", "message[add][0][author][type]": "external" });
const saliente = (talk: string, t: number) =>
  formulario({ "account[subdomain]": "vivante", "message[add][0][talk_id]": talk, "message[add][0][text]": "Con gusto", "message[add][0][created_at]": String(t), "message[add][0][type]": "outgoing", "message[add][0][author][type]": "internal", "message[add][0][author][user_id]": "55", "message[add][0][author][name]": "Asesora" });

const base = (r: string) => ({ ruta: r, secreto: "s3creto", subdominio: "vivante", anuncios: ANUNCIOS });

describe("Kommo webhook · procesar un aviso", () => {
  test("un mensaje entrante y su respuesta: queda el anuncio y el tiempo, nunca el texto ni el nombre", async () => {
    const r = ruta();
    const a = await procesarAviso({ ...base(r), contentType: FORM, cuerpo: entrante("77", TEXTO_SECRETO_DEL_PACIENTE) });
    expect(a).toMatchObject({ recibidos: 1, nuevas: 1 });
    const b = await procesarAviso({ ...base(r), contentType: FORM, cuerpo: saliente("77", T0 + 180) });
    expect(b).toMatchObject({ respuestas: 1 });

    const guardado = readFileSync(r, "utf8");
    for (const prohibido of ["Quiero", "Criolipólisis🔝", "Nombre De Paciente", "Asesora", "9001", "c-77", '"77"']) expect(guardado).not.toContain(prohibido);
    const [c] = Object.values(cargarConversaciones(r).conversaciones);
    expect(c).toMatchObject({ respuesta: 180, asesoraId: "55" });
    expect(c!.atribucion).toMatchObject({ nivel: "exacto", campana: "Criolipolisis_Frio" });
    expect((statSync(r).mode & 0o777).toString(8)).toBe("600");
  });

  test("un aviso de otra cuenta de Kommo se ignora", async () => {
    const r = ruta();
    const cuerpo = entrante("77", "Hola").replace("vivante", "otraempresa");
    const a = await procesarAviso({ ...base(r), contentType: FORM, cuerpo });
    expect(a).toMatchObject({ recibidos: 0, ignorados: 1 });
    expect(existsSync(r)).toBe(false);
  });

  test("basura o un aviso sin mensajes no rompe ni escribe", async () => {
    const r = ruta();
    expect(await procesarAviso({ ...base(r), contentType: "application/json", cuerpo: "{roto" })).toMatchObject({ recibidos: 0 });
    expect(await procesarAviso({ ...base(r), contentType: FORM, cuerpo: formulario({ "leads[add][0][id]": "5" }) })).toMatchObject({ recibidos: 0 });
    expect(existsSync(r)).toBe(false);
  });

  test("modo prueba: dice qué entendió y NO guarda nada", async () => {
    const r = ruta();
    const a = await procesarAviso({ ...base(r), contentType: FORM, cuerpo: entrante("77", TEXTO_SECRETO_DEL_PACIENTE), prueba: true });
    expect(a.prueba).toEqual([{ direccion: "entrante", nivel: "exacto", campana: "Criolipolisis_Frio", anuncio: "Criolipolisis_Video" }]);
    expect(JSON.stringify(a)).not.toContain("Quiero");
    expect(existsSync(r)).toBe(false);
  });

  test("avisos que llegan a la vez no se pisan", async () => {
    const r = ruta();
    await Promise.all(Array.from({ length: 25 }, (_, i) => procesarAviso({ ...base(r), contentType: FORM, cuerpo: entrante(`t${i}`, "Hola", T0 + i) })));
    expect(Object.keys(cargarConversaciones(r).conversaciones)).toHaveLength(25);
  });

  test("también entiende JSON", async () => {
    const r = ruta();
    const cuerpo = JSON.stringify({ account: { subdomain: "vivante" }, message: { add: [{ talk_id: "9", text: TEXTO_SECRETO_DEL_PACIENTE, created_at: String(T0), type: "incoming" }] } });
    expect(await procesarAviso({ ...base(r), contentType: "application/json", cuerpo })).toMatchObject({ nuevas: 1 });
  });

  test("solo guarda la FORMA del aviso (nombres de campos, nunca valores) para poder verificar el formato real", async () => {
    const r = ruta();
    await procesarAviso({ ...base(r), contentType: FORM, cuerpo: entrante("77", TEXTO_SECRETO_DEL_PACIENTE) });
    const forma = JSON.parse(readFileSync(r.replace("conversaciones.json", "kommo-webhook-forma.json"), "utf8")) as { campos: string[] };
    expect(forma.campos).toContain("message[add][0][text]");
    expect(JSON.stringify(forma)).not.toContain("Quiero");
    expect(JSON.stringify(forma)).not.toContain("Nombre De Paciente");
  });
});

describe("Kommo webhook · conversación cerrada (talk[update])", () => {
  test("cierra la conversación guardada y no guarda nada más", async () => {
    const r = ruta();
    await procesarAviso({ ...base(r), contentType: FORM, cuerpo: entrante("77", "gracias") });
    const a = await procesarAviso({ ...base(r), contentType: FORM, cuerpo: formulario({ "account[subdomain]": "vivante", "talk[update][0][talk_id]": "77", "talk[update][0][is_in_work]": "0" }) });
    expect(a).toMatchObject({ recibidos: 0, talks: 1 });
    expect(Object.values(cargarConversaciones(r).conversaciones)[0]!.cerrada).toBe(true);
  });
});

describe("Kommo webhook · el secreto de la dirección", () => {
  test("solo el secreto exacto pasa; sin secreto configurado, nadie", () => {
    expect(secretoValido("abc123", "abc123")).toBe(true);
    expect(secretoValido("abc124", "abc123")).toBe(false);
    expect(secretoValido("", "")).toBe(false);
    expect(secretoValido("x", undefined)).toBe(false);
    expect(secretoValido("abc", "abcd")).toBe(false);
  });
});
