import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { aplicarMensaje, cruzarLeads, huella, type EstadoConversaciones } from "@/lib/adapters/kommo.conversaciones";
import type { AnuncioMensaje } from "@/lib/adapters/meta.mensajes";
import { completarIdsDeAnuncio, resumenWhatsapp, sumarGastoPorAnuncio } from "./conversaciones";

const T0 = 1_790_000_000; // 2026-09-21 en Bogotá
const AD: AnuncioMensaje = { id: "77001", cuenta: "F3", cuentaId: "act_1", campana: "Crio", anuncio: "Crio_Video", estado: "ACTIVE", creado: "2026-02-14", predeterminado: "Hola Vivante 🔝 quiero Criolipólisis", bienvenida: null, desdePublicacion: false, vistoPrimeraVez: "2026-02-14" };
const vacio = (): EstadoConversaciones => ({ version: 1, actualizadoEn: "", conversaciones: {} });

describe("WhatsApp · gasto por anuncio", () => {
  test("suma solo filas de nivel anuncio dentro del periodo", () => {
    const filas = [
      { nivel: "anuncio", id: "1", fecha: "2026-09-20", gasto: 10 },
      { nivel: "anuncio", id: "1", fecha: "2026-09-21", gasto: 20 },
      { nivel: "campana", id: "1", fecha: "2026-09-21", gasto: 999 },
      { nivel: "anuncio", id: "2", fecha: "2026-09-25", gasto: 5 },
    ];
    expect(sumarGastoPorAnuncio(filas, "2026-09-21", "2026-09-22")).toEqual({ "1": 20 });
  });
  test("las conversaciones guardadas sin id de anuncio lo recuperan por nombre", () => {
    const e = aplicarMensaje(vacio(), { direccion: "entrante", conversacion: "x", lead: null, texto: AD.predeterminado!, creadoEn: T0, asesoraId: null, origen: null }, { secreto: "s", anuncios: [AD] }).estado;
    const sinId: EstadoConversaciones = { ...e, conversaciones: Object.fromEntries(Object.entries(e.conversaciones).map(([h, c]) => [h, { ...c, atribucion: { ...c.atribucion, anuncioId: undefined } }])) };
    expect(Object.values(completarIdsDeAnuncio(sinId, [AD]).conversaciones)[0]!.atribucion.anuncioId).toBe("77001");
  });
});

describe("WhatsApp · resumen completo desde los archivos", () => {
  test("junta conversaciones, cruce con Kommo, gasto del lote y nombres de asesoras", () => {
    const dir = mkdtempSync(join(tmpdir(), "oraculo-wa-"));
    let e = aplicarMensaje(vacio(), { direccion: "entrante", conversacion: "x", lead: "500", texto: AD.predeterminado!, creadoEn: T0, asesoraId: null, origen: null }, { secreto: "s", anuncios: [AD] }).estado;
    e = aplicarMensaje(e, { direccion: "saliente", conversacion: "x", lead: "500", texto: "hola", creadoEn: T0 + 120, asesoraId: "9", origen: null }, { secreto: "s", anuncios: [AD] }).estado;
    writeFileSync(join(dir, "conversaciones.json"), JSON.stringify({ ...e, actualizadoEn: "2026-09-21T15:00:00Z" }));
    const leads = cruzarLeads(new Set([huella("s", "lead:500")]), [{ id: 500, etapaId: 3, precio: 0 }], [{ id: 3, nombre: "AGENDADO", pipelineId: 1, tipo: "normal", orden: 1 }], {}, "s");
    writeFileSync(join(dir, "conversaciones-embudo.json"), JSON.stringify({ version: 1, actualizadoEn: "2026-09-21T16:00:00Z", leads, asesoras: { "9": "Laura" } }));
    writeFileSync(join(dir, "lote.json"), JSON.stringify({ insights: [{ nivel: "anuncio", id: "77001", fecha: "2026-09-21", gasto: 40000 }] }));
    writeFileSync(join(dir, "mensajes.json"), JSON.stringify({ anuncios: [AD] }));
    const r = resumenWhatsapp({ desde: "2026-09-21", hasta: "2026-09-21", ahora: T0 + 200, rutas: { conversaciones: join(dir, "conversaciones.json"), embudo: join(dir, "conversaciones-embudo.json"), lote: join(dir, "lote.json"), mensajes: join(dir, "mensajes.json") } })!;
    expect(r.primerDia).toBe("2026-09-21");
    expect(r.cruceEn).toBe("2026-09-21T16:00:00Z");
    expect(r.porAnuncio[0]).toMatchObject({ anuncio: "Crio_Video", conversaciones: 1, citas: 1, gasto: 40000, costoCita: 40000 });
    expect(r.atencion.porAsesora[0]).toMatchObject({ asesoraId: "9", asesora: "Laura", medianaSeg: 120 });
  });
  test("el gasto se cuenta solo desde que hay conversaciones (si no, el costo por conversación sale inflado)", () => {
    const dir = mkdtempSync(join(tmpdir(), "oraculo-wa-"));
    const e = aplicarMensaje(vacio(), { direccion: "entrante", conversacion: "x", lead: null, texto: AD.predeterminado!, creadoEn: T0, asesoraId: null, origen: null }, { secreto: "s", anuncios: [AD] }).estado;
    writeFileSync(join(dir, "conversaciones.json"), JSON.stringify(e));
    writeFileSync(join(dir, "lote.json"), JSON.stringify({ insights: [{ nivel: "anuncio", id: "77001", fecha: "2026-09-01", gasto: 999999 }, { nivel: "anuncio", id: "77001", fecha: "2026-09-21", gasto: 10000 }] }));
    writeFileSync(join(dir, "mensajes.json"), JSON.stringify({ anuncios: [AD] }));
    const r = resumenWhatsapp({ desde: "2026-09-01", hasta: "2026-09-30", rutas: { conversaciones: join(dir, "conversaciones.json"), embudo: join(dir, "no.json"), lote: join(dir, "lote.json"), mensajes: join(dir, "mensajes.json") } })!;
    expect(r.porAnuncio[0]!.gasto).toBe(10000);
  });
  test("sin conversaciones guardadas → null (otro equipo: se piden a la VPS)", () => {
    const dir = mkdtempSync(join(tmpdir(), "oraculo-wa-"));
    expect(resumenWhatsapp({ desde: "2026-09-21", hasta: "2026-09-21", rutas: { conversaciones: join(dir, "no-existe.json") } })).toBeNull();
  });
});

describe("WhatsApp · leer las conversaciones (texto cifrado en la VPS)", () => {
  test("«revisa las de ayer» y «las que vienen de este mensaje»: arma cada conversación con su anuncio", async () => {
    const { guardarChats } = await import("@/lib/adapters/chats");
    const { conversacionesLegibles } = await import("./conversaciones");
    const dir = mkdtempSync(join(tmpdir(), "oraculo-wa-"));
    const LL = "d".repeat(64);
    let e = aplicarMensaje(vacio(), { direccion: "entrante", conversacion: "x", lead: null, texto: AD.predeterminado!, creadoEn: T0, asesoraId: null, origen: null }, { secreto: "s", anuncios: [AD] }).estado;
    e = aplicarMensaje(e, { direccion: "entrante", conversacion: "y", lead: null, texto: "Buenas, ¿dónde quedan?", creadoEn: T0 + 60, asesoraId: null, origen: null }, { secreto: "s", anuncios: [AD] }).estado;
    writeFileSync(join(dir, "conversaciones.json"), JSON.stringify(e));
    writeFileSync(join(dir, "mensajes.json"), JSON.stringify({ anuncios: [AD] }));
    guardarChats(join(dir, "chats"), LL, [
      { t: T0, conv: huella("s", "x"), dir: "entrante", texto: AD.predeterminado!, tipo: "text", asesoraId: null, bot: false },
      { t: T0 + 60, conv: huella("s", "y"), dir: "entrante", texto: "Buenas, ¿dónde quedan?", tipo: "text", asesoraId: null, bot: false },
    ]);
    const rutas = { chats: join(dir, "chats"), conversaciones: join(dir, "conversaciones.json"), embudo: join(dir, "no.json"), mensajes: join(dir, "mensajes.json") };
    const todas = conversacionesLegibles({ desde: "2026-09-21", hasta: "2026-09-21", rutas, llave: LL })!;
    expect(todas.total).toBe(2);
    expect(todas.texto).toContain("Crio_Video");
    expect(todas.texto).toContain("Paciente: Buenas, ¿dónde quedan?");
    const delAnuncio = conversacionesLegibles({ desde: "2026-09-21", hasta: "2026-09-21", rutas, llave: LL, filtro: { texto: AD.predeterminado! } })!;
    expect(delAnuncio.total).toBe(1);
    expect(conversacionesLegibles({ desde: "2026-09-21", hasta: "2026-09-21", rutas, llave: undefined as unknown as string })).toBeNull();
  });
});
