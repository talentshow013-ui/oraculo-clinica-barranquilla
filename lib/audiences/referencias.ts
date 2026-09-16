/**
 * Referencias de otros mercados (Cartagena, Santa Marta, Medellín, Miami…): qué anuncios sostienen
 * las clínicas estéticas de afuera y a quién le hablan. Salen de capturas de la Biblioteca de
 * anuncios de Meta (`npm run radar:capturar -- --q "…" --salida datos/referencias/<ciudad>.json`).
 * La Biblioteca NO muestra la segmentación fuera de Europa: lo que se observa es el mensaje (a
 * quién nombra, qué servicio, qué ángulo, cuánto lleva al aire), nunca el público configurado.
 */
import type { AnuncioCompetidor, Angulo } from "@/lib/adapters/types";
import { mapearRadarUI, type FiltroRadar, type TarjetaCruda } from "@/lib/adapters/radar.ui";
import { urlAnuncioBiblioteca } from "@/lib/competitive/enlaces";

export interface ArchivoReferencia {
  ciudad: string;
  pais: string;
  consulta: string;
  capturadoEn: string;
  tarjetas: TarjetaCruda[];
}

export interface SenalPublico {
  clave: string;
  etiqueta: string;
  anuncios: number;
}

export interface AnuncioReferencia {
  anuncioId: string;
  nombreAnunciante: string;
  diasCorriendo: number;
  activo: boolean;
  angulo: Angulo;
  servicio: string | null;
  copy: string;
  usaPrecio: boolean;
  verificar: string;
}

export interface EstudioCiudad {
  ciudad: string;
  pais: string;
  consultas: string[];
  capturadoEn: string;
  anunciantes: number;
  anuncios: number;
  /** Anuncios con 60+ días al aire: lo que el mercado de esa ciudad sostiene. */
  ganadores: AnuncioReferencia[];
  /** A quién le hablan, según el texto (mujeres, hombres, mamás, +40, novias…). */
  aQuienLeHablan: SenalPublico[];
  angulos: SenalPublico[];
  servicios: SenalPublico[];
  usanPrecio: number;
  /** Frases de dueño con lo que se aprende de esa ciudad. */
  aprendizajes: string[];
}

export interface EstudioReferencias {
  sinDatos: boolean;
  ciudades: EstudioCiudad[];
  /** Lo que se repite en todas las ciudades: la señal más fuerte. */
  transversal: string[];
}

/** Pistas de a quién le habla un anuncio, en el texto. Es lo único observable de «público» desde afuera. */
const PISTAS: ReadonlyArray<[string, string, RegExp]> = [
  ["mujeres", "Mujeres (explícito)", /\bmujer(es)?\b|\bella\b|\bhermosa\b|\bchicas?\b|\bwom[ae]n\b|\bladies\b/i],
  ["hombres", "Hombres (explícito)", /\bhombre(s)?\b|\bmen\b|\bmasculin|\bpara él\b|\bbarba\b|\bginecomastia/i],
  ["mamas", "Mamás / posparto", /\bmam[aá]s?\b|\bmaternidad\b|\bpospart|\bpost ?parto|\bmom(s|my)?\b|\bpost-?pregnancy/i],
  ["mas40", "Mayores de 40 (edad nombrada)", /\b[4-6]0\s*\+|\bm[aá]s de (40|45|50)\b|\bdespu[eé]s de los (40|45|50)|\bover (40|50)\b|\bmenopaus|\b(40|50)s\b/i],
  ["jovenes", "Jóvenes / 20s-30s", /\b(20|25|30)\s*(a|-|y)\s*(30|35|40)\b|\bj[oó]ven(es)?\b|\buniversitari|\bquincea/i],
  ["novias", "Novias / eventos", /\bnovias?\b|\bboda|\bbride|\bwedding|\bmatrimonio|\bgraduaci/i],
  ["fitness", "Gente que entrena", /\bgym|\bgimnasio|\bentren[ao]|\bfitness|\bejercicio|\bworkout|\bdieta\b/i],
  ["profesionales", "Ejecutivas / sin tiempo", /\bejecutiv|\btrabaj[ao]|\bsin tiempo|\bagenda ocupada|\boficina|\bbusy\b|\blunch ?break/i],
  ["turistas", "Turistas / de fuera", /\bturist|\bvisit(as|antes)?\s+(la ciudad|cartagena|medell|santa marta|miami)|\btravel|\bvacacion|\bvacation/i],
];

function pistasDe(texto: string): string[] {
  return PISTAS.filter(([, , re]) => re.test(texto)).map(([k]) => k);
}

function contar<T extends string>(valores: T[], etiqueta: (v: T) => string): SenalPublico[] {
  const m = new Map<string, number>();
  for (const v of valores) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].map(([clave, anuncios]) => ({ clave, etiqueta: etiqueta(clave as T), anuncios })).sort((a, b) => b.anuncios - a.anuncios);
}

const NOMBRE_ANGULO: Record<Angulo, string> = {
  autoridad_medica: "autoridad médica", prueba_social: "prueba social", aspiracional: "aspiracional", educativo: "educativo", detras_de_camara: "detrás de cámara", testimonio: "testimonio",
  objecion_seguridad: "objeción: seguridad", objecion_dolor: "objeción: dolor", objecion_tiempo: "objeción: tiempo", objecion_precio: "objeción: precio", promocion: "promoción", urgencia: "urgencia", antes_despues: "antes y después", sin_clasificar: "sin clasificar",
};

const ETIQUETA_PISTA = Object.fromEntries(PISTAS.map(([k, e]) => [k, e])) as Record<string, string>;

function aprendizajesDe(ciudad: string, anuncios: AnuncioCompetidor[], ganadores: AnuncioReferencia[], pistas: SenalPublico[], angulos: SenalPublico[], servicios: SenalPublico[], usanPrecio: number): string[] {
  const s: string[] = [];
  if (!anuncios.length) return s;
  const pct = (n: number) => `${Math.round((n / anuncios.length) * 100)} %`;
  if (ganadores.length) {
    const g = ganadores[0]!;
    s.push(`Lo que más dura al aire en ${ciudad} es «${g.nombreAnunciante}» con ${g.diasCorriendo} días (${NOMBRE_ANGULO[g.angulo]}${g.servicio ? `, ${g.servicio}` : ""}): ahí hay un mensaje que a alguien le está pagando.`);
  } else {
    s.push(`En ${ciudad} ningún anuncio capturado pasa de 60 días: el mercado rota rápido o la captura llegó tarde a los que duran.`);
  }
  if (pistas[0]) s.push(`El público que más nombran en el texto es «${pistas[0]!.etiqueta}» (${pct(pistas[0]!.anuncios)} de los anuncios). ${pistas[1] ? `Le sigue «${pistas[1]!.etiqueta}» (${pct(pistas[1]!.anuncios)}).` : ""}`.trim());
  else s.push(`Casi nadie nombra a su público en el texto: hablan del procedimiento, no de la persona.`);
  if (angulos[0]) s.push(`El ángulo dominante es ${angulos[0]!.etiqueta} (${pct(angulos[0]!.anuncios)}); ${angulos[1] ? `segundo, ${angulos[1]!.etiqueta} (${pct(angulos[1]!.anuncios)}).` : ""}`.trim());
  if (servicios[0]) s.push(`Servicios más pautados: ${servicios.slice(0, 3).map((x) => `${x.etiqueta} (${x.anuncios})`).join(", ")}.`);
  s.push(usanPrecio / anuncios.length > 0.3 ? `${pct(usanPrecio)} muestran precio en el anuncio: en ${ciudad} el precio a la vista es normal.` : `Solo ${pct(usanPrecio)} muestran precio: en ${ciudad} se vende la valoración, no la tarifa.`);
  return s;
}

/** Junta varios archivos de captura de la misma ciudad y los estudia. `hoy` fija la longevidad. */
export function estudiarCiudad(archivos: ReadonlyArray<ArchivoReferencia>, hoy: string, filtro: FiltroRadar = {}): EstudioCiudad | null {
  if (!archivos.length) return null;
  const { ciudad, pais } = archivos[0]!;
  const tarjetas = archivos.flatMap((a) => a.tarjetas);
  const { anunciosCompetencia: anuncios } = mapearRadarUI(tarjetas, hoy, {}, ciudad, filtro);
  const ganadores = anuncios
    .filter((a) => a.diasCorriendo >= 60)
    .sort((a, b) => b.diasCorriendo - a.diasCorriendo)
    .slice(0, 8)
    .map((a) => ({ anuncioId: a.anuncioId, nombreAnunciante: a.nombreAnunciante, diasCorriendo: a.diasCorriendo, activo: a.activo, angulo: a.anguloDetectado, servicio: a.servicioDetectado, copy: a.copy.slice(0, 280), usaPrecio: a.usaPrecio, verificar: urlAnuncioBiblioteca(a.anuncioId) }));
  const pistas = contar(anuncios.flatMap((a) => pistasDe(a.copy)), (k) => ETIQUETA_PISTA[k] ?? k);
  const angulos = contar(anuncios.map((a) => a.anguloDetectado).filter((x) => x !== "sin_clasificar"), (k) => NOMBRE_ANGULO[k]);
  const servicios = contar(anuncios.map((a) => a.servicioDetectado).filter((x): x is string => x !== null), (k) => k);
  const usanPrecio = anuncios.filter((a) => a.usaPrecio).length;
  return {
    ciudad,
    pais,
    consultas: [...new Set(archivos.map((a) => a.consulta))],
    capturadoEn: archivos.map((a) => a.capturadoEn).sort().at(-1)!,
    anunciantes: new Set(anuncios.map((a) => a.competidorId)).size,
    anuncios: anuncios.length,
    ganadores,
    aQuienLeHablan: pistas,
    angulos,
    servicios,
    usanPrecio,
    aprendizajes: aprendizajesDe(ciudad, anuncios, ganadores, pistas, angulos, servicios, usanPrecio),
  };
}

export function estudiarReferencias(archivos: ReadonlyArray<ArchivoReferencia>, hoy: string, filtro: FiltroRadar = {}): EstudioReferencias {
  const porCiudad = new Map<string, ArchivoReferencia[]>();
  for (const a of archivos) (porCiudad.get(a.ciudad) ?? porCiudad.set(a.ciudad, []).get(a.ciudad)!).push(a);
  const ciudades = [...porCiudad.values()].map((l) => estudiarCiudad(l, hoy, filtro)).filter((c): c is EstudioCiudad => c !== null && c.anuncios > 0);
  const transversal: string[] = [];
  if (ciudades.length >= 2) {
    const total = ciudades.reduce((s, c) => s + c.anuncios, 0);
    const pista = new Map<string, number>();
    const angulo = new Map<string, number>();
    for (const c of ciudades) {
      for (const p of c.aQuienLeHablan) pista.set(p.etiqueta, (pista.get(p.etiqueta) ?? 0) + p.anuncios);
      for (const a of c.angulos) angulo.set(a.etiqueta, (angulo.get(a.etiqueta) ?? 0) + a.anuncios);
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    const p = top(pista);
    const a = top(angulo);
    if (p) transversal.push(`En ${ciudades.length} ciudades y ${total} anuncios, el público que más se nombra es «${p[0]}» (${Math.round((p[1] / total) * 100)} %).`);
    if (a) transversal.push(`El ángulo que más se repite entre ciudades es ${a[0]} (${Math.round((a[1] / total) * 100)} % de los anuncios).`);
    const conGanadores = ciudades.filter((c) => c.ganadores.length);
    if (conGanadores.length) transversal.push(`Anuncios de 60+ días: ${conGanadores.map((c) => `${c.ciudad} ${c.ganadores.length}`).join(" · ")}. Esos son los mensajes que ya pagaron su prueba en otro mercado.`);
  }
  return { sinDatos: ciudades.length === 0, ciudades, transversal };
}
