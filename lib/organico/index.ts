/**
 * Orgánico: qué rinde de lo que la clínica publica sin pagar (Instagram y Facebook).
 *
 * Todo sale de `datos/organico.json` (Graph API de Meta, `npm run organico:sincronizar`) y se
 * recorta al periodo elegido. Tasa de interacción = interacciones / alcance; una publicación sin
 * alcance no entra en ninguna tasa (nunca cuenta como cero). Cada bloque lleva su fuente.
 */
import type { FormatoOrganico, LoteOrganico, PublicacionOrganica, RedOrganico } from "@/lib/adapters/types";
import type { FuenteHallazgo } from "@/lib/diagnostics/engine";
import { diaSemana, sumarDias } from "@/lib/format/fechas";

export const NOMBRE_RED: Record<RedOrganico, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };
export const NOMBRE_FORMATO: Record<FormatoOrganico, string> = { reel: "Reel", video: "Video", imagen: "Imagen", carrusel: "Carrusel", historia: "Historia", texto: "Texto", enlace: "Enlace" };
export const FRANJAS = ["madrugada", "mañana", "mediodía", "tarde", "noche"] as const;
export type Franja = (typeof FRANJAS)[number];
export const NOMBRE_FRANJA: Record<Franja, string> = { madrugada: "Madrugada (0–5)", mañana: "Mañana (6–11)", mediodía: "Mediodía (12–14)", tarde: "Tarde (15–17)", noche: "Noche (18–23)" };
export const NOMBRE_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

const TOPE_MEJORES = 10;
/** Para «merece pauta»: publicada en los últimos N días, tasa > FACTOR × mediana y alcance ≥ mediana. */
const DIAS_RECIENTES = 30;
const FACTOR_TASA = 1.5;
/** Alcance mínimo para que una tasa signifique algo (evita el 1 de 3). */
const ALCANCE_MINIMO_TASA = 100;

export const VEREDICTOS_PUBLICACION = ["estrella", "gusta", "lejos", "normal", "floja", "sin_dato"] as const;
export type VeredictoPublicacion = (typeof VEREDICTOS_PUBLICACION)[number];
export const NOMBRE_VEREDICTO: Record<VeredictoPublicacion, string> = { estrella: "Estrella", gusta: "Gusta", lejos: "Llega lejos", normal: "Normal", floja: "Floja", sin_dato: "Sin dato" };

export interface PublicacionEvaluada extends PublicacionOrganica {
  fecha: string;
  hora: number;
  diaSemana: number;
  franja: Franja;
  tasaInteraccion: number | null;
  /** Cómo le fue frente a las demás del periodo (mediana de alcance y de tasa). */
  veredicto: VeredictoPublicacion;
  /** Qué hacer con ella, en una frase de dueño; calculada con reglas, no inventada. */
  queHacer: string;
}

export interface ResumenRed {
  red: RedOrganico;
  alias: string;
  seguidores: number | null;
  /** Seguidores ganados en el periodo (Instagram: suma diaria; Facebook: último − primero). */
  seguidoresGanados: number | null;
  publicaciones: number;
  alcance: number | null;
  vistas: number | null;
  interacciones: number | null;
  tasaInteraccion: number | null;
}

export interface GrupoOrganico {
  clave: string;
  etiqueta: string;
  publicaciones: number;
  alcanceMedio: number | null;
  interaccionesMedias: number | null;
  /** Tasa agrupada: interacciones totales / alcance total del grupo. */
  tasa: number | null;
  mejor: boolean;
}

export interface CandidataPauta {
  publicacion: PublicacionEvaluada;
  porQue: string;
}

export interface ResultadoOrganico {
  sinDatos: boolean;
  desde: string;
  hasta: string;
  capturadoEn: string | null;
  avisos: string[];
  redes: ResumenRed[];
  /** Todas las del periodo, la más reciente primero. */
  publicaciones: PublicacionEvaluada[];
  mejores: { porAlcance: PublicacionEvaluada[]; porTasa: PublicacionEvaluada[] };
  porFormato: GrupoOrganico[];
  porDia: GrupoOrganico[];
  porFranja: GrupoOrganico[];
  paraPauta: CandidataPauta[];
  seguidores: { serie: { fecha: string; instagramNuevos: number | null; facebookTotal: number | null; tiktokNuevos: number | null }[]; ganados: Record<RedOrganico, number | null> };
  /** Frases de dueño, calculadas (nunca inventadas). */
  lecturas: string[];
  fuente: FuenteHallazgo;
}

const suma = (xs: ReadonlyArray<number | null>): number | null => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};
const media = (xs: ReadonlyArray<number | null>): number | null => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const mediana = (xs: ReadonlyArray<number>): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const tasaDe = (interacciones: number | null, alcance: number | null): number | null => (interacciones != null && alcance != null && alcance >= ALCANCE_MINIMO_TASA ? interacciones / alcance : null);
const pctTexto = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;

function franjaDe(hora: number): Franja {
  if (hora < 6) return "madrugada";
  if (hora < 12) return "mañana";
  if (hora < 15) return "mediodía";
  if (hora < 18) return "tarde";
  return "noche";
}

function evaluar(p: PublicacionOrganica): PublicacionEvaluada {
  const fecha = p.publicadoEn.slice(0, 10);
  const hora = Number(p.publicadoEn.slice(11, 13));
  return { ...p, fecha, hora, diaSemana: diaSemana(fecha), franja: franjaDe(hora), tasaInteraccion: tasaDe(p.interacciones, p.alcance), veredicto: "sin_dato", queHacer: "" };
}

/** Veredicto y consejo frente a la mediana del periodo: estrella (ambas arriba), gusta (tasa arriba), lejos (alcance arriba), normal, floja (ambas abajo). */
function juzgar(p: PublicacionEvaluada, medAlcance: number | null, medTasa: number | null, mejorFormato: string | null, mejorFranja: Franja | null): PublicacionEvaluada {
  if (p.alcance == null || medAlcance == null) return { ...p, veredicto: "sin_dato", queHacer: "Meta no entregó el alcance de esta publicación: no se juzga." };
  const alcanceAlto = p.alcance >= medAlcance;
  const tasaAlta = p.tasaInteraccion != null && medTasa != null && p.tasaInteraccion >= medTasa;
  const tasaBaja = p.tasaInteraccion != null && medTasa != null && p.tasaInteraccion < medTasa * 0.6;
  const formato = `${p.red}|${p.formato}`;
  const pista = [mejorFormato && formato !== mejorFormato ? `el formato que mejor rinde es ${NOMBRE_FORMATO[mejorFormato.split("|")[1] as FormatoOrganico].toLowerCase()}` : "", mejorFranja && p.franja !== mejorFranja ? `la franja que mejor rinde es ${NOMBRE_FRANJA[mejorFranja].toLowerCase()}` : ""].filter(Boolean).join(" y ");
  if (alcanceAlto && tasaAlta) return { ...p, veredicto: "estrella", queHacer: "Llega lejos y gusta: ponle pauta ya y repite el mismo gancho en el próximo video." };
  if (tasaAlta) return { ...p, veredicto: "gusta", queHacer: `Gusta a quien la ve pero llegó a poca gente: vuelve a publicarla en otro horario${pista ? ` (${pista})` : ""} o impúlsala con poco presupuesto.` };
  if (alcanceAlto && tasaBaja) return { ...p, veredicto: "lejos", queHacer: "Llegó lejos pero pocos reaccionaron: el gancho atrae y el contenido no cierra; cambia el final o el llamado a escribir." };
  if (alcanceAlto) return { ...p, veredicto: "lejos", queHacer: "Llega lejos con interacción normal: sirve para dar a conocer; prueba una versión con pregunta o llamado a escribir." };
  if (tasaBaja) return { ...p, veredicto: "floja", queHacer: `Ni llegó ni gustó: no repetir este ángulo${pista ? `; ${pista}` : ""}.` };
  return { ...p, veredicto: "normal", queHacer: `En la media. Para subirla: mismo tema con un gancho más fuerte en el primer segundo${pista ? `; ${pista}` : ""}.` };
}

function agrupar(pubs: ReadonlyArray<PublicacionEvaluada>, claves: ReadonlyArray<{ clave: string; etiqueta: string }>, claveDe: (p: PublicacionEvaluada) => string): GrupoOrganico[] {
  const grupos = claves.map((k) => {
    const del = pubs.filter((p) => claveDe(p) === k.clave);
    const alc = suma(del.map((p) => p.alcance));
    const int = suma(del.filter((p) => p.alcance != null).map((p) => p.interacciones));
    return { ...k, publicaciones: del.length, alcanceMedio: media(del.map((p) => p.alcance)), interaccionesMedias: media(del.map((p) => p.interacciones)), tasa: alc != null && alc >= ALCANCE_MINIMO_TASA && int != null ? int / alc : null, mejor: false };
  });
  const conTasa = grupos.filter((g) => g.tasa != null);
  if (conTasa.length) {
    const top = conTasa.reduce((a, b) => (b.tasa! > a.tasa! ? b : a));
    top.mejor = true;
  }
  return grupos;
}

function vacio(rango: { desde: string; hasta: string }): ResultadoOrganico {
  return {
    sinDatos: true,
    desde: rango.desde,
    hasta: rango.hasta,
    capturadoEn: null,
    avisos: [],
    redes: [],
    publicaciones: [],
    mejores: { porAlcance: [], porTasa: [] },
    porFormato: [],
    porDia: [],
    porFranja: [],
    paraPauta: [],
    seguidores: { serie: [], ganados: { instagram: null, facebook: null, tiktok: null } },
    lecturas: [],
    fuente: { origen: "Meta · Instagram y Facebook (publicaciones sin pauta)", desde: rango.desde, hasta: rango.hasta, registros: 0, metodo: "Todavía no se ha conectado el orgánico.", enlace: "/organico#fuente" },
  };
}

export function analizarOrganico(lote: LoteOrganico | null, rango: { desde: string; hasta: string }, hoy: string): ResultadoOrganico {
  if (!lote || (!lote.publicaciones.length && !lote.dias.length)) return vacio(rango);
  const en = (f: string) => f >= rango.desde && f <= rango.hasta;
  const pubs = lote.publicaciones.map(evaluar).filter((p) => en(p.fecha)).sort((a, b) => b.publicadoEn.localeCompare(a.publicadoEn));
  const dias = lote.dias.filter((d) => en(d.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Seguidores ganados: Instagram entrega nuevos por día; Facebook, el total del día.
  const ganados: Record<RedOrganico, number | null> = { instagram: suma(dias.filter((d) => d.red === "instagram").map((d) => d.seguidoresNuevos)), facebook: null, tiktok: suma(dias.filter((d) => d.red === "tiktok").map((d) => d.seguidoresNuevos)) };
  const fbTotales = dias.filter((d) => d.red === "facebook" && d.seguidoresTotal != null);
  if (fbTotales.length >= 2) ganados.facebook = fbTotales[fbTotales.length - 1]!.seguidoresTotal! - fbTotales[0]!.seguidoresTotal!;

  const redes: ResumenRed[] = lote.cuentas.map((c) => {
    const del = pubs.filter((p) => p.red === c.red);
    const alcance = suma(del.map((p) => p.alcance));
    const interacciones = suma(del.map((p) => p.interacciones));
    const intConAlcance = suma(del.filter((p) => p.alcance != null).map((p) => p.interacciones));
    return { red: c.red, alias: c.alias, seguidores: c.seguidores, seguidoresGanados: ganados[c.red], publicaciones: del.length, alcance, vistas: suma(del.map((p) => p.vistas)), interacciones, tasaInteraccion: alcance != null && alcance >= ALCANCE_MINIMO_TASA && intConAlcance != null ? intConAlcance / alcance : null };
  });

  const conAlcance0 = pubs.filter((p) => p.alcance != null);
  const conTasa0 = pubs.filter((p) => p.tasaInteraccion != null);
  const medAlcance0 = mediana(conAlcance0.map((p) => p.alcance!));
  const medTasa0 = mediana(conTasa0.map((p) => p.tasaInteraccion!));
  const grupoFormato = agrupar(pubs, [...new Set(pubs.map((p) => `${p.red}|${p.formato}`))].map((k) => ({ clave: k, etiqueta: k })), (p) => `${p.red}|${p.formato}`).find((g) => g.mejor && g.publicaciones >= 2);
  const grupoFranja = agrupar(pubs, FRANJAS.map((f) => ({ clave: f, etiqueta: f })), (p) => p.franja).find((g) => g.mejor && g.publicaciones >= 2);
  for (let i = 0; i < pubs.length; i++) pubs[i] = juzgar(pubs[i]!, medAlcance0, medTasa0, grupoFormato?.clave ?? null, (grupoFranja?.clave as Franja | undefined) ?? null);
  const conAlcance = pubs.filter((p) => p.alcance != null);
  const conTasa = pubs.filter((p) => p.tasaInteraccion != null);
  const mejores = {
    porAlcance: [...conAlcance].sort((a, b) => b.alcance! - a.alcance!).slice(0, TOPE_MEJORES),
    porTasa: [...conTasa].sort((a, b) => b.tasaInteraccion! - a.tasaInteraccion!).slice(0, TOPE_MEJORES),
  };

  const clavesFormato = [...new Set(pubs.map((p) => `${p.red}|${p.formato}`))].sort().map((k) => {
    const [red, formato] = k.split("|") as [RedOrganico, FormatoOrganico];
    return { clave: k, etiqueta: `${NOMBRE_FORMATO[formato]} · ${NOMBRE_RED[red]}` };
  });
  const porFormato = agrupar(pubs, clavesFormato, (p) => `${p.red}|${p.formato}`);
  const porDia = agrupar(pubs, NOMBRE_DIA.map((n, i) => ({ clave: String(i), etiqueta: n })), (p) => String(p.diaSemana));
  const porFranja = agrupar(pubs, FRANJAS.map((f) => ({ clave: f, etiqueta: NOMBRE_FRANJA[f] })), (p) => p.franja);

  // Merece pauta: reciente, tasa muy por encima de la mediana y alcance sobre la mediana.
  const medTasa = mediana(conTasa.map((p) => p.tasaInteraccion!));
  const medAlcance = mediana(conAlcance.map((p) => p.alcance!));
  const limite = sumarDias(hoy, -DIAS_RECIENTES);
  const paraPauta: CandidataPauta[] = medTasa != null && medAlcance != null
    ? conTasa
        .filter((p) => p.fecha >= limite && p.tasaInteraccion! > medTasa * FACTOR_TASA && p.alcance! >= medAlcance)
        .sort((a, b) => b.tasaInteraccion! - a.tasaInteraccion!)
        .map((p) => ({ publicacion: p, porQue: `Tasa de interacción ${pctTexto(p.tasaInteraccion!)} (la mitad de tus publicaciones no pasa de ${pctTexto(medTasa)}) y alcance ${p.alcance!.toLocaleString("es-CO")} sin pagar: ya probó que gusta; con pauta llega a quien no te sigue.` }))
    : [];

  const fechas = [...new Set(dias.map((d) => d.fecha))].sort();
  const serie = fechas.map((f) => ({ fecha: f, instagramNuevos: dias.find((d) => d.red === "instagram" && d.fecha === f)?.seguidoresNuevos ?? null, facebookTotal: dias.find((d) => d.red === "facebook" && d.fecha === f)?.seguidoresTotal ?? null, tiktokNuevos: dias.find((d) => d.red === "tiktok" && d.fecha === f)?.seguidoresNuevos ?? null }));

  const lecturas: string[] = [];
  const mejorFormato = porFormato.find((g) => g.mejor);
  if (mejorFormato && mejorFormato.publicaciones >= 2) lecturas.push(`El formato que más conversación genera por persona alcanzada es «${mejorFormato.etiqueta}» (${pctTexto(mejorFormato.tasa!)} con ${mejorFormato.publicaciones} publicaciones).`);
  const mejorFranja = porFranja.find((g) => g.mejor);
  if (mejorFranja && mejorFranja.publicaciones >= 2) lecturas.push(`Publicar en la franja «${mejorFranja.etiqueta}» rinde mejor (${pctTexto(mejorFranja.tasa!)} con ${mejorFranja.publicaciones} publicaciones).`);
  if (paraPauta.length) lecturas.push(`${paraPauta.length === 1 ? "Una publicación reciente merece" : `${paraPauta.length} publicaciones recientes merecen`} pauta: ya demostró que gusta sin pagar.`);
  for (const r of redes) if (r.seguidoresGanados != null) lecturas.push(`${NOMBRE_RED[r.red]}: ${r.seguidoresGanados >= 0 ? "+" : ""}${r.seguidoresGanados.toLocaleString("es-CO")} seguidores en el periodo${r.seguidores != null ? ` (hoy ${r.seguidores.toLocaleString("es-CO")})` : ""}.`);

  return {
    sinDatos: false,
    desde: rango.desde,
    hasta: rango.hasta,
    capturadoEn: lote.meta.capturadoEn,
    avisos: lote.meta.avisos,
    redes,
    publicaciones: pubs,
    mejores,
    porFormato,
    porDia,
    porFranja,
    paraPauta,
    seguidores: { serie, ganados },
    lecturas,
    fuente: { origen: "Meta · Instagram y Facebook (publicaciones sin pauta)", desde: rango.desde, hasta: rango.hasta, registros: pubs.length, metodo: "Cada publicación con su alcance, vistas e interacciones tal como las entrega Meta; tasa de interacción = interacciones ÷ alcance. Sin alcance, no hay tasa.", enlace: "/organico#fuente" },
  };
}
