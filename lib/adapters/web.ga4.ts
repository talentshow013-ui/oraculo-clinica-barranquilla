/**
 * Sitio web desde Google Analytics 4 (Data API v1beta), con una cuenta de servicio de SOLO
 * LECTURA (rol «Lector» en la propiedad). La llave JSON vive fuera del repositorio
 * (`GA4_CREDENCIALES` en `.env`, por defecto `datos/ga4-credenciales.json`, gitignored).
 *
 * Sin librerías: el JWT se firma con `node:crypto`, el token se pide a Google y `runReport` se
 * llama con `fetch`. Todo se mapea AL contrato (`LoteWebSchema`). Si Google rechaza una consulta
 * (dimensión que no existe en esa propiedad, sin permiso), se anota un aviso y el resto sigue.
 */
import { createSign } from "node:crypto";
import type { CiudadWeb, EventoWeb, LoteWeb, PaginaWeb, SesionesWeb } from "@/lib/adapters/types";

export const ALCANCE_SOLO_LECTURA = "https://www.googleapis.com/auth/analytics.readonly";
const URL_TOKEN = "https://oauth2.googleapis.com/token";
const URL_DATA = "https://analyticsdata.googleapis.com/v1beta";
const LIMITE_FILAS = 100000;

export interface LlaveServicio {
  client_email: string;
  private_key: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
/** Una consulta `runReport` (cuerpo sin la propiedad); devuelve el JSON de Google. */
export type Consulta = (cuerpo: Record<string, unknown>) => Promise<Json>;

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** JWT RS256 de una hora para pedir el token de acceso (solo lectura). */
export function firmarJwt(llave: LlaveServicio, ahoraSeg = Math.floor(Date.now() / 1000)): string {
  const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64url(JSON.stringify({ iss: llave.client_email, scope: ALCANCE_SOLO_LECTURA, aud: URL_TOKEN, iat: ahoraSeg, exp: ahoraSeg + 3600 }));
  const firmador = createSign("RSA-SHA256");
  firmador.update(`${cabecera}.${cuerpo}`);
  return `${cabecera}.${cuerpo}.${b64url(firmador.sign(llave.private_key))}`;
}

export async function pedirToken(llave: LlaveServicio, fetchFn: typeof fetch = fetch): Promise<string> {
  const r = await fetchFn(URL_TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: firmarJwt(llave) }).toString() });
  const json = (await r.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!r.ok || !json.access_token) throw new Error(`Google no dio token: ${json.error_description ?? json.error ?? r.status}`);
  return json.access_token;
}

/** Fabrica la consulta real contra una propiedad. */
export function crearConsulta(propiedadId: string, token: string, fetchFn: typeof fetch = fetch): Consulta {
  return async (cuerpo) => {
    const r = await fetchFn(`${URL_DATA}/properties/${propiedadId}:runReport`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ limit: LIMITE_FILAS, ...cuerpo }) });
    const json = (await r.json()) as Json;
    if (!r.ok || json?.error) throw new Error(`(${json?.error?.code ?? r.status}) ${json?.error?.message ?? r.statusText}`);
    return json;
  };
}

// ---------------------------------------------------------------------------
// Mapeo → contrato
// ---------------------------------------------------------------------------

/** Cada fila como objeto {nombreDimension: valor, nombreMetrica: valor} (todo string, como Google). */
export function filasDe(json: Json): Record<string, string>[] {
  const dims: string[] = (json?.dimensionHeaders ?? []).map((h: Json) => String(h.name));
  const mets: string[] = (json?.metricHeaders ?? []).map((h: Json) => String(h.name));
  return (json?.rows ?? []).map((fila: Json) => {
    const o: Record<string, string> = {};
    dims.forEach((d, i) => (o[d] = String(fila.dimensionValues?.[i]?.value ?? "")));
    mets.forEach((m, i) => (o[m] = String(fila.metricValues?.[i]?.value ?? "")));
    return o;
  });
}

const fecha = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
const entero = (v: string | undefined): number => Math.max(0, Math.round(Number(v ?? 0)) || 0);
const numOpc = (v: string | undefined): number | null => (v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));

export function mapearSesiones(json: Json): SesionesWeb[] {
  return filasDe(json).map((f) => ({ fecha: fecha(f.date!), canal: f.sessionDefaultChannelGroup ?? "", fuente: f.sessionSource ?? "", medio: f.sessionMedium ?? "", sesiones: entero(f.sessions), usuarios: numOpc(f.totalUsers), usuariosNuevos: numOpc(f.newUsers), sesionesComprometidas: numOpc(f.engagedSessions), duracionMedia: numOpc(f.averageSessionDuration), eventosClave: numOpc(f.keyEvents) }));
}
export function mapearPaginas(json: Json): PaginaWeb[] {
  return filasDe(json).map((f) => ({ fecha: fecha(f.date!), pagina: f.landingPagePlusQueryString ?? "", sesiones: entero(f.sessions), sesionesComprometidas: numOpc(f.engagedSessions), eventosClave: numOpc(f.keyEvents) }));
}
export function mapearEventos(json: Json): EventoWeb[] {
  return filasDe(json).map((f) => ({ fecha: fecha(f.date!), evento: f.eventName ?? "", veces: entero(f.eventCount), esClave: f.isKeyEvent === "true" }));
}
export function mapearCiudades(json: Json): CiudadWeb[] {
  return filasDe(json).map((f) => ({ fecha: fecha(f.date!), ciudad: f.city ?? "", sesiones: entero(f.sessions), eventosClave: numOpc(f.keyEvents) }));
}

// ---------------------------------------------------------------------------
// Sincronización
// ---------------------------------------------------------------------------

export interface OpcionesWeb {
  consultar: Consulta;
  propiedadId: string;
  desde: string;
  hasta: string;
  ahora?: string;
}

const dims = (...n: string[]) => n.map((name) => ({ name }));

export async function sincronizarWeb(o: OpcionesWeb): Promise<LoteWeb> {
  const rango = [{ startDate: o.desde, endDate: o.hasta }];
  const lote: LoteWeb = { propiedadId: o.propiedadId, sesiones: [], paginas: [], eventos: [], ciudades: [], meta: { capturadoEn: o.ahora ?? new Date().toISOString(), desde: o.desde, hasta: o.hasta, origen: "ga4", avisos: [] } };
  const intentar = async (nombre: string, cuerpo: Record<string, unknown>, aplicar: (json: Json) => void) => {
    try {
      aplicar(await o.consultar({ dateRanges: rango, ...cuerpo }));
    } catch (e) {
      lote.meta.avisos.push(`Google no entregó ${nombre} (${e instanceof Error ? e.message : String(e)}); se muestra como «—».`);
    }
  };
  await intentar("las sesiones por canal", { dimensions: dims("date", "sessionDefaultChannelGroup", "sessionSource", "sessionMedium"), metrics: dims("sessions", "totalUsers", "newUsers", "engagedSessions", "averageSessionDuration", "keyEvents") }, (j) => lote.sesiones.push(...mapearSesiones(j)));
  await intentar("las páginas de entrada", { dimensions: dims("date", "landingPagePlusQueryString"), metrics: dims("sessions", "engagedSessions", "keyEvents") }, (j) => lote.paginas.push(...mapearPaginas(j)));
  await intentar("los eventos", { dimensions: dims("date", "eventName", "isKeyEvent"), metrics: dims("eventCount") }, (j) => lote.eventos.push(...mapearEventos(j)));
  await intentar("las ciudades", { dimensions: dims("date", "city"), metrics: dims("sessions", "keyEvents") }, (j) => lote.ciudades.push(...mapearCiudades(j)));
  return lote;
}

/** Une una captura nueva con la anterior: los días de la nueva reemplazan a los viejos; el resto se conserva. */
export function fusionarWeb(viejo: LoteWeb | null, nuevo: LoteWeb): LoteWeb {
  if (!viejo) return nuevo;
  const fuera = (f: { fecha: string }) => f.fecha < nuevo.meta.desde || f.fecha > nuevo.meta.hasta;
  const orden = <T extends { fecha: string }>(xs: T[]) => xs.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    propiedadId: nuevo.propiedadId,
    sesiones: orden([...viejo.sesiones.filter(fuera), ...nuevo.sesiones]),
    paginas: orden([...viejo.paginas.filter(fuera), ...nuevo.paginas]),
    eventos: orden([...viejo.eventos.filter(fuera), ...nuevo.eventos]),
    ciudades: orden([...viejo.ciudades.filter(fuera), ...nuevo.ciudades]),
    meta: { ...nuevo.meta, desde: viejo.meta.desde < nuevo.meta.desde ? viejo.meta.desde : nuevo.meta.desde, hasta: viejo.meta.hasta > nuevo.meta.hasta ? viejo.meta.hasta : nuevo.meta.hasta },
  };
}
