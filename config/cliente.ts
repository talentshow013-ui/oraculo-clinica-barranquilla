/**
 * Configuración del cliente. Los tickets y costos directos van en CERO a
 * propósito: salen de la reunión 1. Sin margen real el CAC no significa nada,
 * y el panel lo dice en vez de inventarlo (`estaCalibrado() === false`).
 */

export interface Servicio {
  id: string;
  nombre: string;
  /** Precio de venta al paciente, COP. 0 = sin calibrar. */
  ticketCOP: number;
  /** Costo directo por procedimiento (insumos, tiempo médico), COP. 0 = sin calibrar. */
  costoDirectoCOP: number;
  /** Meses típicos hasta la siguiente sesión/mantenimiento. null = no recurrente. */
  recurrenciaMeses: number | null;
}

/** Una cuenta publicitaria de Meta/TikTok. El panel analiza UNA a la vez; nunca se suman por defecto. */
export interface CuentaPublicitaria {
  /** Id de la cuenta en la plataforma, p. ej. "act_1048227". */
  id: string;
  /** Lo que ve el dueño. */
  nombre: string;
  plataforma: "meta" | "tiktok" | "google";
  moneda: "COP";
}

export interface ConfigCliente {
  nombre: string;
  /** Cuentas publicitarias, la principal primero. */
  cuentasPublicitarias: ReadonlyArray<CuentaPublicitaria>;
  ciudad: string;
  /** Municipios del radio real de captación. Todo lo demás es inversión fuera de radio. */
  zonasValidas: ReadonlyArray<string>;
  /** Radar de mercado: páginas de la propia clínica (nunca son competencia) y rubros ajenos que la búsqueda pública arrastra. */
  radar: { paginasPropias: ReadonlyArray<string>; excluirNombres: ReadonlyArray<string> };
  radioKm: number;
  servicios: ReadonlyArray<Servicio>;
  /**
   * Margen (0-1) sobre el ticket cuando el servicio tiene ticket pero no costo.
   * null = no se asume nada; las métricas dependientes muestran "—".
   */
  margenPorDefecto: number | null;
  horarioAtencion: { inicio: number; fin: number; dias: ReadonlyArray<number> };
  cuposDiarios: number;
  moneda: "COP";
  /** Margen mínimo considerado saludable sobre el ticket. */
  margenObjetivo: number;
  /** Cuántos meses de LTV se proyectan. */
  horizonteLtvMeses: number;
  /** Sal para pseudonimizar cuando haya deduplicación de recompra. Cambiar por cliente. */
  salPseudonimizacion: string;
}

export const cliente: ConfigCliente = {
  nombre: "Clínica estética",
  cuentasPublicitarias: [
    { id: "act_536430824306104", nombre: "F3 · Vivante Corporal 2026", plataforma: "meta", moneda: "COP" },
    { id: "act_1083324715683244", nombre: "F2 · Vivante Facial 2026", plataforma: "meta", moneda: "COP" },
    { id: "act_28503083", nombre: "Vivante 6 · Varios tratamientos", plataforma: "meta", moneda: "COP" },
    { id: "act_677891593042927", nombre: "No invasiva · Otros tratamientos", plataforma: "meta", moneda: "COP" },
  ],
  ciudad: "Barranquilla",
  zonasValidas: ["Barranquilla", "Soledad", "Malambo", "Puerto Colombia", "Galapa", "Sabanagrande", "Baranoa", "Atlántico"],
  radar: {
    paginasPropias: ["Vivantemedicinaestetica", "vivante"],
    excluirNombres: ["odonto", "dental", "endodonc", "sonrisa", "escuela", "curso", "diplomado", "master", "máster", "training", "diario", "universidad", "ginec", "veterinar", "cucuta", "cúcuta", "ventas online", "latapa"],
  },
  radioKm: 40,
  servicios: [
    { id: "toxina", nombre: "Toxina botulínica", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: 6 },
    { id: "acido", nombre: "Ácido hialurónico", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: 12 },
    { id: "limpieza", nombre: "Limpieza facial profunda", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: 1 },
    { id: "peeling", nombre: "Peeling químico", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: 2 },
    { id: "laser_facial", nombre: "Láser facial", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: 3 },
    { id: "depilacion", nombre: "Depilación láser", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: 1 },
    { id: "criolipolisis", nombre: "Criolipólisis (Lipo en frío)", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: null },
    { id: "lipoz360", nombre: "Lipoz 360 (moldeo corporal)", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: null },
    { id: "hifu", nombre: "Ultrahifu (firmeza facial)", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: 12 },
    { id: "packdual", nombre: "Pack Dual (calidad de piel)", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: 6 },
    { id: "tensapro", nombre: "TensaPro corporal", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: null },
    { id: "radiofrecuencia", nombre: "Radiofrecuencia corporal", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: 1 },
    { id: "prp", nombre: "Plasma rico en plaquetas", ticketCOP: 0, costoDirectoCOP: 0, recurrenciaMeses: 4 },
  ],
  margenPorDefecto: null,
  horarioAtencion: { inicio: 8, fin: 18, dias: [1, 2, 3, 4, 5, 6] },
  cuposDiarios: 12,
  moneda: "COP",
  margenObjetivo: 0.35,
  horizonteLtvMeses: 18,
  salPseudonimizacion: "cambiar-por-cliente",
};

export function servicioPorId(id: string | null, cfg: ConfigCliente = cliente): Servicio | null {
  if (!id) return null;
  return cfg.servicios.find((s) => s.id === id) ?? null;
}

/** Margen unitario COP de un servicio; null si no está calibrado. */
export function margenUnitario(id: string | null, cfg: ConfigCliente = cliente): number | null {
  const s = servicioPorId(id, cfg);
  if (!s || s.ticketCOP <= 0) return null;
  if (s.costoDirectoCOP > 0) return s.ticketCOP - s.costoDirectoCOP;
  if (cfg.margenPorDefecto !== null) return s.ticketCOP * cfg.margenPorDefecto;
  return null;
}

/** Ticket promedio de los servicios calibrados; null si ninguno lo está. */
export function ticketPromedio(cfg: ConfigCliente = cliente): number | null {
  const calibrados = cfg.servicios.filter((s) => s.ticketCOP > 0);
  if (calibrados.length === 0) return null;
  return calibrados.reduce((s, x) => s + x.ticketCOP, 0) / calibrados.length;
}

/** Margen promedio (COP) de los servicios calibrados; null si ninguno lo está. */
export function margenPromedio(cfg: ConfigCliente = cliente): number | null {
  const margenes = cfg.servicios.map((s) => margenUnitario(s.id, cfg)).filter((m): m is number => m !== null);
  if (margenes.length === 0) return null;
  return margenes.reduce((s, m) => s + m, 0) / margenes.length;
}

export function estaCalibrado(cfg: ConfigCliente = cliente): boolean {
  return cfg.servicios.some((s) => s.ticketCOP > 0);
}
