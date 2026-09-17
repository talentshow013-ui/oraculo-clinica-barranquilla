/**
 * Sitio web (Google Analytics 4): de dónde llega la gente, qué página convierte, qué evento clave
 * (clic a WhatsApp, formulario) se dispara y desde qué ciudad. Todo sale de `datos/web.json`
 * (`npm run web:sincronizar`) recortado al periodo. Tasa de conversión = eventos clave ÷ sesiones.
 * Cada bloque lleva su fuente. Los eventos clave los define la clínica en Google Analytics.
 */
import type { LoteWeb } from "@/lib/adapters/types";
import type { FuenteHallazgo } from "@/lib/diagnostics/engine";

const TOPE = 10;
/** Fuentes que cuentan como pauta de Meta (para cruzar con la pestaña Pauta). */
const FUENTES_META = /^(facebook|instagram|fb|ig|meta|facebook\.com|instagram\.com|l\.instagram\.com|m\.facebook\.com|lm\.facebook\.com)$/i;
const CANALES_PAGADOS = /paid/i;
/** Mínimo de sesiones para que una tasa signifique algo. */
const SESIONES_MINIMAS_TASA = 30;

export interface ResumenWeb {
  sesiones: number;
  usuarios: number | null;
  usuariosNuevos: number | null;
  sesionesComprometidas: number | null;
  tasaCompromiso: number | null;
  eventosClave: number | null;
  tasaConversion: number | null;
  duracionMedia: number | null;
}

export interface CanalWeb {
  canal: string;
  sesiones: number;
  eventosClave: number | null;
  tasaConversion: number | null;
  participacion: number;
  mejor: boolean;
}

export interface FuenteWeb {
  fuente: string;
  canal: string;
  sesiones: number;
  eventosClave: number | null;
  tasaConversion: number | null;
}

export interface PaginaResumen {
  pagina: string;
  sesiones: number;
  sesionesComprometidas: number | null;
  eventosClave: number | null;
  tasaConversion: number | null;
}

export interface CiudadResumen {
  ciudad: string;
  sesiones: number;
  eventosClave: number | null;
  participacion: number;
}

export interface ResultadoWeb {
  sinDatos: boolean;
  desde: string;
  hasta: string;
  capturadoEn: string | null;
  avisos: string[];
  resumen: ResumenWeb;
  porCanal: CanalWeb[];
  porFuente: FuenteWeb[];
  /** Lo que la pauta de Meta trae al sitio: sesiones, eventos clave y qué parte del total son. null si no hay. */
  pautaMeta: { sesiones: number; eventosClave: number | null; participacionSesiones: number; participacionEventos: number | null } | null;
  paginas: PaginaResumen[];
  eventosClave: { evento: string; veces: number }[];
  ciudades: CiudadResumen[];
  /** Parte de las sesiones que llega desde fuera de la ciudad de la clínica. */
  fueraDeCiudad: number | null;
  serie: { fecha: string; sesiones: number; eventosClave: number | null }[];
  lecturas: string[];
  fuente: FuenteHallazgo;
}

const suma = (xs: ReadonlyArray<number | null>): number | null => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};
const tasa = (num: number | null, den: number): number | null => (num != null && den >= SESIONES_MINIMAS_TASA ? num / den : null);
const pctTexto = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function vacio(rango: { desde: string; hasta: string }): ResultadoWeb {
  return {
    sinDatos: true,
    desde: rango.desde,
    hasta: rango.hasta,
    capturadoEn: null,
    avisos: [],
    resumen: { sesiones: 0, usuarios: null, usuariosNuevos: null, sesionesComprometidas: null, tasaCompromiso: null, eventosClave: null, tasaConversion: null, duracionMedia: null },
    porCanal: [],
    porFuente: [],
    pautaMeta: null,
    paginas: [],
    eventosClave: [],
    ciudades: [],
    fueraDeCiudad: null,
    serie: [],
    lecturas: [],
    fuente: { origen: "Google Analytics 4 · sitio web de la clínica", desde: rango.desde, hasta: rango.hasta, registros: 0, metodo: "Todavía no se ha conectado Google Analytics.", enlace: "/web#fuente" },
  };
}

export function analizarWeb(lote: LoteWeb | null, rango: { desde: string; hasta: string }, ciudadClinica: string): ResultadoWeb {
  if (!lote || !lote.sesiones.length) return vacio(rango);
  const en = (f: string) => f >= rango.desde && f <= rango.hasta;
  const ses = lote.sesiones.filter((s) => en(s.fecha));
  if (!ses.length) return { ...vacio(rango), sinDatos: false, capturadoEn: lote.meta.capturadoEn, avisos: lote.meta.avisos };

  const sesiones = ses.reduce((a, s) => a + s.sesiones, 0);
  const eventosClave = suma(ses.map((s) => s.eventosClave));
  const comprometidas = suma(ses.map((s) => s.sesionesComprometidas));
  const conDuracion = ses.filter((s) => s.duracionMedia != null && s.sesiones > 0);
  const duracionMedia = conDuracion.length ? conDuracion.reduce((a, s) => a + s.duracionMedia! * s.sesiones, 0) / conDuracion.reduce((a, s) => a + s.sesiones, 0) : null;
  const resumen: ResumenWeb = { sesiones, usuarios: suma(ses.map((s) => s.usuarios)), usuariosNuevos: suma(ses.map((s) => s.usuariosNuevos)), sesionesComprometidas: comprometidas, tasaCompromiso: tasa(comprometidas, sesiones), eventosClave, tasaConversion: tasa(eventosClave, sesiones), duracionMedia };

  const agrupar = <K extends string>(clave: (s: LoteWeb["sesiones"][number]) => K) => {
    const m = new Map<K, { sesiones: number; eventos: (number | null)[]; canal: string }>();
    for (const s of ses) {
      const k = clave(s);
      const g = m.get(k) ?? { sesiones: 0, eventos: [], canal: s.canal };
      g.sesiones += s.sesiones;
      g.eventos.push(s.eventosClave);
      m.set(k, g);
    }
    return m;
  };
  const porCanal: CanalWeb[] = [...agrupar((s) => s.canal).entries()]
    .map(([canal, g]) => ({ canal, sesiones: g.sesiones, eventosClave: suma(g.eventos), tasaConversion: tasa(suma(g.eventos), g.sesiones), participacion: g.sesiones / sesiones, mejor: false }))
    .sort((a, b) => b.sesiones - a.sesiones);
  const conTasa = porCanal.filter((c) => c.tasaConversion != null);
  if (conTasa.length) conTasa.reduce((a, b) => (b.tasaConversion! > a.tasaConversion! ? b : a)).mejor = true;

  const porFuente: FuenteWeb[] = [...agrupar((s) => s.fuente).entries()]
    .map(([fuente, g]) => ({ fuente, canal: g.canal, sesiones: g.sesiones, eventosClave: suma(g.eventos), tasaConversion: tasa(suma(g.eventos), g.sesiones) }))
    .sort((a, b) => b.sesiones - a.sesiones)
    .slice(0, TOPE);

  const deMeta = ses.filter((s) => FUENTES_META.test(s.fuente) && CANALES_PAGADOS.test(s.canal));
  const sesMeta = deMeta.reduce((a, s) => a + s.sesiones, 0);
  const evMeta = suma(deMeta.map((s) => s.eventosClave));
  const pautaMeta = sesMeta > 0 ? { sesiones: sesMeta, eventosClave: evMeta, participacionSesiones: sesMeta / sesiones, participacionEventos: evMeta != null && eventosClave ? evMeta / eventosClave : null } : null;

  const pag = new Map<string, { sesiones: number; comp: (number | null)[]; ev: (number | null)[] }>();
  for (const p of lote.paginas.filter((p) => en(p.fecha))) {
    const g = pag.get(p.pagina) ?? { sesiones: 0, comp: [], ev: [] };
    g.sesiones += p.sesiones;
    g.comp.push(p.sesionesComprometidas);
    g.ev.push(p.eventosClave);
    pag.set(p.pagina, g);
  }
  const paginas: PaginaResumen[] = [...pag.entries()]
    .map(([pagina, g]) => ({ pagina, sesiones: g.sesiones, sesionesComprometidas: suma(g.comp), eventosClave: suma(g.ev), tasaConversion: tasa(suma(g.ev), g.sesiones) }))
    .sort((a, b) => (b.eventosClave ?? 0) - (a.eventosClave ?? 0) || b.sesiones - a.sesiones)
    .slice(0, TOPE);

  const evs = new Map<string, number>();
  for (const e of lote.eventos.filter((e) => en(e.fecha) && e.esClave)) evs.set(e.evento, (evs.get(e.evento) ?? 0) + e.veces);
  const eventosClavePorNombre = [...evs.entries()].map(([evento, veces]) => ({ evento, veces })).sort((a, b) => b.veces - a.veces);

  const ciu = new Map<string, { sesiones: number; ev: (number | null)[] }>();
  for (const c of lote.ciudades.filter((c) => en(c.fecha))) {
    const g = ciu.get(c.ciudad) ?? { sesiones: 0, ev: [] };
    g.sesiones += c.sesiones;
    g.ev.push(c.eventosClave);
    ciu.set(c.ciudad, g);
  }
  const totalCiudades = [...ciu.values()].reduce((a, g) => a + g.sesiones, 0);
  const ciudades: CiudadResumen[] = [...ciu.entries()]
    .map(([ciudad, g]) => ({ ciudad, sesiones: g.sesiones, eventosClave: suma(g.ev), participacion: totalCiudades ? g.sesiones / totalCiudades : 0 }))
    .sort((a, b) => b.sesiones - a.sesiones)
    .slice(0, TOPE);
  const propia = ciudades.find((c) => normalizar(c.ciudad) === normalizar(ciudadClinica));
  const fueraDeCiudad = totalCiudades ? (totalCiudades - (propia?.sesiones ?? 0)) / totalCiudades : null;

  const porDia = new Map<string, { sesiones: number; ev: (number | null)[] }>();
  for (const s of ses) {
    const g = porDia.get(s.fecha) ?? { sesiones: 0, ev: [] };
    g.sesiones += s.sesiones;
    g.ev.push(s.eventosClave);
    porDia.set(s.fecha, g);
  }
  const serie = [...porDia.entries()].map(([fecha, g]) => ({ fecha, sesiones: g.sesiones, eventosClave: suma(g.ev) })).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const lecturas: string[] = [];
  if (pautaMeta) lecturas.push(`La pauta de Meta trae ${pctTexto(pautaMeta.participacionSesiones)} de las visitas${pautaMeta.participacionEventos != null ? ` y ${pctTexto(pautaMeta.participacionEventos)} de los contactos` : ""} del sitio.`);
  const mejor = porCanal.find((c) => c.mejor);
  if (mejor && porCanal.length > 1) lecturas.push(`El canal que mejor convierte por visita es «${mejor.canal}» (${pctTexto(mejor.tasaConversion!)}); el que más visitas trae es «${porCanal[0]!.canal}».`);
  if (paginas[0]?.eventosClave) lecturas.push(`La página que más contactos genera es ${paginas[0].pagina} (${paginas[0].eventosClave} en el periodo).`);
  if (fueraDeCiudad != null && fueraDeCiudad >= 0.3) lecturas.push(`${pctTexto(fueraDeCiudad)} de las visitas llegan desde fuera de ${ciudadClinica}: si la pauta apunta a la ciudad, hay que mirar de dónde sale ese tráfico.`);
  if (!eventosClavePorNombre.length) lecturas.push("Google no tiene eventos clave configurados (clic a WhatsApp, formulario): sin eso no se sabe qué visita se convirtió en contacto.");

  return {
    sinDatos: false,
    desde: rango.desde,
    hasta: rango.hasta,
    capturadoEn: lote.meta.capturadoEn,
    avisos: lote.meta.avisos,
    resumen,
    porCanal,
    porFuente,
    pautaMeta,
    paginas,
    eventosClave: eventosClavePorNombre,
    ciudades,
    fueraDeCiudad,
    serie,
    lecturas,
    fuente: { origen: "Google Analytics 4 · sitio web de la clínica", desde: rango.desde, hasta: rango.hasta, registros: ses.length, metodo: "Sesiones, usuarios y eventos clave por día, canal y fuente tal como los entrega Google; tasa de conversión = eventos clave ÷ sesiones (mínimo 30 sesiones). Los eventos clave los define la clínica en Google Analytics.", enlace: "/web#fuente" },
  };
}
