/**
 * TikTok orgánico desde los CSV que exporta TikTok Studio (Analíticas → Contenido → «Descargar
 * datos», y Analíticas → Resumen → «Descargar datos»). TikTok no entrega estas métricas por API a
 * terceros, así que la clínica descarga el archivo y `npm run organico:importar-tiktok -- <csv>` lo
 * mete en `datos/organico.json` como red «tiktok». Encabezados en inglés o español; lo que no
 * viene queda `null` (nunca 0). Sin datos de personas: solo videos y totales.
 */
import type { DiaOrganico, PublicacionOrganica } from "@/lib/adapters/types";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** CSV sencillo: coma, comillas dobles (con comillas escapadas como ""), saltos \r\n. Primera fila = encabezados. */
export function leerCsv(texto: string): Record<string, string>[] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let enComillas = false;
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (enComillas) {
      if (c === '"' && t[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') enComillas = false;
      else celda += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(celda);
      celda = "";
      if (fila.some((x) => x.trim() !== "")) filas.push(fila);
      fila = [];
    } else celda += c;
  }
  if (celda !== "" || fila.length) {
    fila.push(celda);
    if (fila.some((x) => x.trim() !== "")) filas.push(fila);
  }
  const [cab, ...resto] = filas;
  if (!cab) return [];
  return resto.map((r) => Object.fromEntries(cab.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/** Busca una columna por varios nombres posibles (inglés/español), sin acentos ni mayúsculas. */
function columna(fila: Record<string, string>, ...nombres: string[]): string | undefined {
  const claves = Object.keys(fila);
  for (const n of nombres) {
    const k = claves.find((c) => norm(c) === norm(n));
    if (k !== undefined) return fila[k];
  }
  for (const n of nombres) {
    const k = claves.find((c) => norm(c).includes(norm(n)));
    if (k !== undefined) return fila[k];
  }
  return undefined;
}

const num = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const limpio = v.replace(/[^0-9.,-]/g, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (limpio === "" || limpio === "-") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? Math.max(0, n) : null;
};

export function detectarTipoCsv(filas: Record<string, string>[]): "videos" | "dias" | "desconocido" {
  const f = filas[0];
  if (!f) return "desconocido";
  if (columna(f, "Video link", "Enlace del video", "Video title", "Titulo del video") !== undefined) return "videos";
  if (columna(f, "Date", "Fecha") !== undefined && columna(f, "Video views", "Visualizaciones de video", "Followers", "Seguidores") !== undefined) return "dias";
  return "desconocido";
}

function horaLocal(v: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec((v ?? "").trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? "00"}:${m[5] ?? "00"}`;
}

export function mapearVideosTikTok(filas: Record<string, string>[]): PublicacionOrganica[] {
  const salida: PublicacionOrganica[] = [];
  for (const f of filas) {
    const enlace = (columna(f, "Video link", "Enlace del video", "Link") ?? "").trim();
    const publicadoEn = horaLocal(columna(f, "Post time", "Hora de publicacion", "Fecha de publicacion", "Publish time"));
    if (!publicadoEn) continue;
    const id = /video\/(\d+)/.exec(enlace)?.[1] ?? `${publicadoEn}-${salida.length}`;
    const meGusta = num(columna(f, "Total likes", "Me gusta totales", "Likes", "Me gusta"));
    const comentarios = num(columna(f, "Total comments", "Comentarios totales", "Comments", "Comentarios"));
    const compartidos = num(columna(f, "Total shares", "Veces compartido", "Shares", "Compartidos"));
    const guardados = num(columna(f, "Saves", "Guardados", "Favorites"));
    const partes = [meGusta, comentarios, compartidos, guardados].filter((x): x is number => x != null);
    salida.push({
      id,
      red: "tiktok",
      formato: "video",
      publicadoEn,
      texto: (columna(f, "Video title", "Titulo del video", "Title", "Caption") ?? "").replace(/\s+/g, " ").trim(),
      enlace,
      urlMiniatura: null,
      alcance: num(columna(f, "Reach", "Alcance", "Reached audience")),
      vistas: num(columna(f, "Total views", "Visualizaciones totales", "Video views", "Views", "Visualizaciones")),
      meGusta,
      comentarios,
      compartidos,
      guardados,
      interacciones: partes.length ? partes.reduce((a, b) => a + b, 0) : null,
      visitasPerfil: null,
      seguidoresGanados: num(columna(f, "New followers", "Seguidores nuevos", "Follows")),
      clics: null,
      segundosPromedio: num(columna(f, "Average watch time", "Tiempo promedio de visualizacion", "Avg watch time")),
      respuestas: null,
    });
  }
  return salida;
}

export function mapearDiasTikTok(filas: Record<string, string>[]): DiaOrganico[] {
  const salida: DiaOrganico[] = [];
  for (const f of filas) {
    const fecha = horaLocal(columna(f, "Date", "Fecha"))?.slice(0, 10);
    if (!fecha) continue;
    const likes = num(columna(f, "Likes", "Me gusta"));
    const comentarios = num(columna(f, "Comments", "Comentarios"));
    const compartidos = num(columna(f, "Shares", "Compartidos", "Veces compartido"));
    const partes = [likes, comentarios, compartidos].filter((x): x is number => x != null);
    salida.push({
      red: "tiktok",
      fecha,
      seguidoresNuevos: num(columna(f, "Net followers", "Seguidores netos", "New followers", "Seguidores nuevos")),
      seguidoresTotal: num(columna(f, "Followers", "Seguidores", "Total followers")),
      alcance: num(columna(f, "Reach", "Alcance")),
      vistas: num(columna(f, "Video views", "Visualizaciones de video", "Views", "Visualizaciones")),
      interacciones: partes.length ? partes.reduce((a, b) => a + b, 0) : null,
    });
  }
  return salida;
}
