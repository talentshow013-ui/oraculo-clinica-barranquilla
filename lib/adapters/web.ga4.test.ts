import { describe, expect, test } from "vitest";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { LoteWebSchema } from "./types";
import { firmarJwt, filasDe, mapearSesiones, mapearPaginas, mapearEventos, mapearCiudades, sincronizarWeb, fusionarWeb, type Consulta } from "./web.ga4";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });

describe("GA4 · llave de servicio → token", () => {
  test("firma un JWT RS256 válido con el correo de la cuenta y el alcance de solo lectura", () => {
    const jwt = firmarJwt({ client_email: "oraculo@proyecto.iam.gserviceaccount.com", private_key: privateKey }, 1_700_000_000);
    const [h, p, s] = jwt.split(".");
    const cab = JSON.parse(Buffer.from(h!, "base64url").toString());
    const cuerpo = JSON.parse(Buffer.from(p!, "base64url").toString());
    expect(cab).toEqual({ alg: "RS256", typ: "JWT" });
    expect(cuerpo).toMatchObject({ iss: "oraculo@proyecto.iam.gserviceaccount.com", scope: "https://www.googleapis.com/auth/analytics.readonly", aud: "https://oauth2.googleapis.com/token", iat: 1_700_000_000, exp: 1_700_003_600 });
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${p}`);
    expect(v.verify(publicKey, Buffer.from(s!, "base64url"))).toBe(true);
  });
});

/** Respuesta de runReport tal como la devuelve Google. */
const respuesta = (dims: string[], mets: string[], filas: (string | number)[][]) => ({
  dimensionHeaders: dims.map((name) => ({ name })),
  metricHeaders: mets.map((name) => ({ name, type: "TYPE_INTEGER" })),
  rows: filas.map((f) => ({ dimensionValues: f.slice(0, dims.length).map((v) => ({ value: String(v) })), metricValues: f.slice(dims.length).map((v) => ({ value: String(v) })) })),
  rowCount: filas.length,
});

describe("GA4 · filas → contrato", () => {
  test("lee dimensiones y métricas por nombre, fechas YYYYMMDD → YYYY-MM-DD", () => {
    const r = respuesta(["date", "sessionDefaultChannelGroup", "sessionSource", "sessionMedium"], ["sessions", "totalUsers", "newUsers", "engagedSessions", "averageSessionDuration", "keyEvents"], [["20260910", "Paid Social", "facebook", "cpc", 120, 100, 80, 70, "45.5", 9]]);
    const filas = filasDe(r);
    expect(filas[0]).toEqual({ date: "20260910", sessionDefaultChannelGroup: "Paid Social", sessionSource: "facebook", sessionMedium: "cpc", sessions: "120", totalUsers: "100", newUsers: "80", engagedSessions: "70", averageSessionDuration: "45.5", keyEvents: "9" });
    const s = mapearSesiones(r);
    expect(s[0]).toEqual({ fecha: "2026-09-10", canal: "Paid Social", fuente: "facebook", medio: "cpc", sesiones: 120, usuarios: 100, usuariosNuevos: 80, sesionesComprometidas: 70, duracionMedia: 45.5, eventosClave: 9 });
  });
  test("páginas, eventos (clave o no) y ciudades", () => {
    expect(mapearPaginas(respuesta(["date", "landingPagePlusQueryString"], ["sessions", "engagedSessions", "keyEvents"], [["20260910", "/criolipolisis", 50, 30, 4]]))[0]).toEqual({ fecha: "2026-09-10", pagina: "/criolipolisis", sesiones: 50, sesionesComprometidas: 30, eventosClave: 4 });
    const ev = mapearEventos(respuesta(["date", "eventName", "isKeyEvent"], ["eventCount"], [["20260910", "click_whatsapp", "true", 12], ["20260910", "page_view", "false", 400]]));
    expect(ev).toEqual([{ fecha: "2026-09-10", evento: "click_whatsapp", veces: 12, esClave: true }, { fecha: "2026-09-10", evento: "page_view", veces: 400, esClave: false }]);
    expect(mapearCiudades(respuesta(["date", "city"], ["sessions", "keyEvents"], [["20260910", "Barranquilla", 90, 7]]))[0]).toEqual({ fecha: "2026-09-10", ciudad: "Barranquilla", sesiones: 90, eventosClave: 7 });
  });
  test("una respuesta sin filas da lista vacía, no error", () => {
    expect(mapearSesiones({ dimensionHeaders: [], metricHeaders: [] })).toEqual([]);
  });
});

describe("GA4 · sincronización completa", () => {
  test("cuatro consultas, lote válido, y una métrica rechazada se anota como aviso sin tumbar el resto", async () => {
    const llamadas: string[] = [];
    const consultar: Consulta = async (cuerpo) => {
      const dims = (cuerpo.dimensions as { name: string }[]).map((d) => d.name);
      const mets = (cuerpo.metrics as { name: string }[]).map((m) => m.name);
      llamadas.push(dims.join("+"));
      if (dims.includes("city")) throw new Error("(400) Field city is not a valid dimension");
      if (dims.includes("sessionSource")) return respuesta(dims, mets, [["20260910", "Paid Social", "facebook", "cpc", 120, 100, 80, 70, "45.5", 9]]);
      if (dims.includes("landingPagePlusQueryString")) return respuesta(dims, mets, [["20260910", "/", 50, 30, 4]]);
      return respuesta(dims, mets, [["20260910", "click_whatsapp", "true", 12]]);
    };
    const lote = await sincronizarWeb({ consultar, propiedadId: "123456", desde: "2026-09-01", hasta: "2026-09-15", ahora: "2026-09-16T10:00:00Z" });
    expect(LoteWebSchema.safeParse(lote).success).toBe(true);
    expect(llamadas).toHaveLength(4);
    expect(lote.sesiones).toHaveLength(1);
    expect(lote.ciudades).toEqual([]);
    expect(lote.meta.avisos[0]).toMatch(/ciudades/);
  });
  test("fusionar reemplaza los días que se volvieron a pedir y conserva los viejos", () => {
    const base = { propiedadId: "1", sesiones: [], paginas: [], eventos: [], ciudades: [], meta: { capturadoEn: "x", desde: "2026-06-01", hasta: "2026-09-01", origen: "ga4" as const, avisos: [] } };
    const viejo = { ...base, sesiones: [{ fecha: "2026-07-01", canal: "Direct", fuente: "(direct)", medio: "(none)", sesiones: 5, usuarios: null, usuariosNuevos: null, sesionesComprometidas: null, duracionMedia: null, eventosClave: null }, { fecha: "2026-09-01", canal: "Direct", fuente: "(direct)", medio: "(none)", sesiones: 1, usuarios: null, usuariosNuevos: null, sesionesComprometidas: null, duracionMedia: null, eventosClave: null }] };
    const nuevo = { ...base, sesiones: [{ fecha: "2026-09-01", canal: "Direct", fuente: "(direct)", medio: "(none)", sesiones: 9, usuarios: null, usuariosNuevos: null, sesionesComprometidas: null, duracionMedia: null, eventosClave: null }], meta: { ...base.meta, capturadoEn: "y", desde: "2026-08-17", hasta: "2026-09-15" } };
    const f = fusionarWeb(viejo, nuevo);
    expect(f.sesiones.map((s) => [s.fecha, s.sesiones])).toEqual([["2026-07-01", 5], ["2026-09-01", 9]]);
    expect(f.meta).toMatchObject({ desde: "2026-06-01", hasta: "2026-09-15", capturadoEn: "y" });
  });
});
