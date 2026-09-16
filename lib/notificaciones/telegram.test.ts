import { describe, expect, test } from "vitest";
import { componerResumenDiario, enviarTelegram, recortar, type ResumenCuenta } from "./telegram";

const base = (extra: Partial<ResumenCuenta["r"]> = {}): ResumenCuenta["r"] => ({
  hoy: "2026-09-16",
  reciente: { gasto: 1200000, conversacionesIniciadas: 80, costoConversacion: 15000 } as never,
  previa: { gasto: 2000000, conversacionesIniciadas: 138 } as never,
  hallazgos: [
    { reglaId: "R1", severidad: "alta", titulo: "Un anuncio se lleva la mitad del gasto sin conversar", plataEnRiesgo: 400000 } as never,
    { reglaId: "R2", severidad: "media", titulo: "Media", plataEnRiesgo: 900000 } as never,
    { reglaId: "R3", severidad: "alta", titulo: "Frecuencia alta <en> zona norte", plataEnRiesgo: 250000 } as never,
  ],
  plataEnRiesgoTotal: 650000,
  organico: { sinDatos: true } as never,
  lote: {} as never,
  ...extra,
});

describe("resumen diario por Telegram", () => {
  test("una línea por cuenta con pauta, plata en riesgo, hallazgos altos ordenados por plata y sin HTML roto", () => {
    const t = componerResumenDiario([{ nombre: "F3 · Corporal", r: base() }, { nombre: "Sin pauta", r: base({ reciente: { gasto: 0 } as never, plataEnRiesgoTotal: null, hallazgos: [] }) }], { hoy: "2026-09-16", urlPanel: "https://panel", estado: "sincronización: ok" });
    expect(t).toContain("<b>Oráculo · 16 de sept</b>");
    expect(t).toContain("sincronización: ok");
    expect(t).toContain("• F3 · Corporal: $ 1.200.000 · 80 conversaciones (-42 % vs 14 d antes) · $ 15.000 por conversación");
    expect(t).not.toContain("• Sin pauta");
    expect(t).toContain("Plata en riesgo: $ 650.000");
    expect(t.indexOf("se lleva la mitad")).toBeLessThan(t.indexOf("Frecuencia alta"));
    expect(t).not.toContain("Media");
    expect(t).toContain("&lt;en&gt;");
    expect(t).toContain("Panel: https://panel");
  });
  test("orgánico aparece solo si hay datos", () => {
    const con = base({ organico: { sinDatos: false, redes: [{ red: "instagram", seguidoresGanados: 25, tasaInteraccion: 0.074 }], paraPauta: [{}] } as never });
    expect(componerResumenDiario([{ nombre: "A", r: con }], { hoy: "2026-09-16" })).toContain("<b>Orgánico</b> · +25 seguidores en Instagram · interacción 7,4 % · 1 publicación merece pauta");
    expect(componerResumenDiario([{ nombre: "A", r: base() }], { hoy: "2026-09-16" })).not.toContain("Orgánico");
  });
  test("nunca pasa de 4000 caracteres", () => {
    expect(Array.from(recortar("x".repeat(9000))).length).toBe(4000);
  });
  test("enviar usa la API del bot y devuelve el id; un error de Telegram se explica", async () => {
    const llamadas: { url: string; body: unknown }[] = [];
    const fetchFalso = (async (url: string, init?: RequestInit) => {
      llamadas.push({ url, body: JSON.parse(String(init?.body)) });
      return { json: async () => ({ ok: true, result: { message_id: 7 } }) };
    }) as unknown as typeof fetch;
    expect(await enviarTelegram("T", "C", "hola", fetchFalso)).toBe(7);
    expect(llamadas[0]!.url).toBe("https://api.telegram.org/botT/sendMessage");
    expect(llamadas[0]!.body).toMatchObject({ chat_id: "C", text: "hola", parse_mode: "HTML" });
    const malo = (async () => ({ json: async () => ({ ok: false, description: "chat not found" }) })) as unknown as typeof fetch;
    await expect(enviarTelegram("T", "C", "hola", malo)).rejects.toThrow(/chat not found/);
  });
});
