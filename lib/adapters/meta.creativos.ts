/**
 * Creativos del conector oficial de Meta (herramienta ads_get_creatives) al contrato.
 *
 * Un creativo de Meta puede estar en varios anuncios; el contrato evalúa por anuncio, así que se
 * emite un Creativo por cada anuncio que lo usa (id = creativo·anuncio cuando hay más de uno).
 * El texto (copy, titular, cta, destino) es del creativo; el primer gasto y los días activos son del
 * anuncio. Ángulo, servicio y nivel de consciencia se clasifican con los mismos diccionarios que
 * el radar de competencia (auditables: las señales quedan en senalesDeteccion).
 *
 * Publicaciones compartidas (object_type SHARE, «impulsar publicación»): el conector no trae el
 * texto del post; se usa el nombre del creativo sin la fecha/hash que Meta le pega.
 */
import type { Creativo, Formato } from "./types";
import { clasificarAngulo, nivelConscienciaTexto } from "@/lib/competitive/angles";
import { detectarServicio } from "./radar.apify";

export interface CreativoMetaCrudo {
  id: string;
  name?: string | null;
  object_type?: string | null;
  body?: string | null;
  title?: string | null;
  link_url?: string | null;
  image_url?: string | null;
  thumbnail_url?: string | null;
  video_id?: string | null;
  call_to_action_type?: string | null;
  child_attachments?: ReadonlyArray<Record<string, unknown>> | null;
}

/** Lo que se necesita del anuncio: qué creativo usa y qué días gastó. */
export interface AnuncioParaCreativo {
  id: string;
  creativeId: string | null;
  fechas: ReadonlyArray<{ fecha: string; gasto: number }>;
}

const texto = (v: string | null | undefined): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** Meta nombra los creativos «<titular> <AAAA-MM-DD>-<hash>»; y «{{product.name}}» cuando no hay titular. */
export function nombreLimpio(nombre: string | null | undefined): string {
  return (nombre ?? "")
    .replace(/\s*\d{4}-\d{2}-\d{2}-[0-9a-f]{32}\s*$/i, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .trim();
}

export function formatoCreativoMeta(c: CreativoMetaCrudo): Formato {
  if ((c.child_attachments?.length ?? 0) >= 2) return "carrusel";
  if (c.video_id || String(c.object_type ?? "").toUpperCase() === "VIDEO") return "video";
  // Miniaturas de video en el CDN de Meta viven bajo /t15.…; las de imagen bajo /t39. o /t45.
  if (/\/t15\./.test(c.thumbnail_url ?? "")) return "video";
  return "imagen";
}

export function mapearCreativosMeta(creativos: ReadonlyArray<CreativoMetaCrudo>, anuncios: ReadonlyArray<AnuncioParaCreativo>): Creativo[] {
  const porCreativo = new Map<string, AnuncioParaCreativo[]>();
  for (const a of anuncios) {
    if (!a.creativeId) continue;
    const lista = porCreativo.get(a.creativeId);
    if (lista) lista.push(a);
    else porCreativo.set(a.creativeId, [a]);
  }

  const salida: Creativo[] = [];
  for (const c of creativos) {
    const usos = porCreativo.get(String(c.id)) ?? [];
    if (!usos.length) continue;
    const titular = texto(c.title);
    const copy = texto(c.body) ?? nombreLimpio(c.name);
    const textoTotal = `${titular ?? ""} ${copy}`.trim();
    const angulo = clasificarAngulo(textoTotal);
    const base = {
      formato: formatoCreativoMeta(c),
      urlMiniatura: texto(c.thumbnail_url) ?? texto(c.image_url),
      copyPrincipal: copy,
      titular,
      descripcion: null,
      cta: texto(c.call_to_action_type),
      urlDestino: texto(c.link_url),
      servicio: detectarServicio(textoTotal),
      anguloDetectado: angulo.angulo,
      nivelConsciencia: nivelConscienciaTexto(textoTotal),
      confianzaClasificacion: angulo.confianza,
      senalesDeteccion: angulo.senales,
    };
    for (const a of usos) {
      const conGasto = a.fechas.filter((f) => f.gasto > 0).map((f) => f.fecha).sort();
      salida.push({
        id: usos.length > 1 ? `${c.id}·${a.id}` : String(c.id),
        anuncioId: a.id,
        ...base,
        fechaPrimerGasto: conGasto[0] ?? (a.fechas.map((f) => f.fecha).sort()[0] ?? "2000-01-01"),
        diasActivo: new Set(conGasto).size,
      });
    }
  }
  return salida;
}

/** Archivo crudo de ads_get_creatives: {ad_creatives:[...]} (o el arreglo como texto) o un arreglo directo. */
export function parsearCreativos(textoJson: string): CreativoMetaCrudo[] {
  const crudo: unknown = JSON.parse(textoJson);
  if (Array.isArray(crudo)) return crudo as CreativoMetaCrudo[];
  const lista = (crudo as { ad_creatives?: unknown }).ad_creatives;
  const parsed = typeof lista === "string" ? (JSON.parse(lista) as unknown) : lista;
  return Array.isArray(parsed) ? (parsed as CreativoMetaCrudo[]) : [];
}
