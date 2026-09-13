/**
 * Embudo de 8 pasos con fuga valorizada en pesos — el corazón del producto.
 *
 * La valorización cambia según dónde ocurre la fuga:
 *  - Antes de `cita_asistida`: perdidos × costo unitario del paso anterior.
 *    Se perdió un contacto: vale lo que costó traerlo.
 *  - Desde `cita_asistida`: perdidos × margen unitario.
 *    Se perdió una venta: vale el margen que se dejó de ganar.
 *
 * Un 10 % de fuga en el paso 6 puede valer 40 veces más que un 40 % en el
 * paso 2. Eso solo se ve en pesos. Todo se ordena por plata. (§7.2)
 *
 * Refinamiento sobre §7.2: el paso impresión→clic NO se valoriza. Una impresión
 * que no hace clic no es un contacto perdido, es el costo normal de comprar
 * atención; se mide con costo por mil y tasa de clics. La fuga en pesos empieza
 * en el primer contacto pagado (clic→conversación).
 */
import type { Paso, RegistroEmbudo } from "@/lib/adapters/types";
import { PASOS } from "@/lib/adapters/types";
import type { ConfigCliente } from "@/config/cliente";
import { estaCalibrado, margenPromedio, margenUnitario, servicioPorId } from "@/config/cliente";
import { razon } from "@/lib/metrics/core";

export interface PasoEmbudo {
  paso: Paso;
  orden: number;
  cantidad: number;
  /** Cantidad / cantidad del paso anterior. null si el anterior es 0 o no hay datos. */
  tasaPaso: number | null;
  /** Cantidad / cantidad del primer paso. */
  tasaAcumulada: number | null;
  /** Gasto / cantidad. */
  costoUnitario: number | null;
  /** Cantidad del paso anterior − cantidad. */
  perdidos: number | null;
  /** Fuga en COP según la regla de valorización. */
  fugaCOP: number | null;
  /** Ingresos registrados en este paso (ventas, recompras). */
  valorCOP: number | null;
  /** Cómo se valorizó, para el tooltip de la UI. */
  metodoValorizacion: "costo_paso_anterior" | "margen_unitario" | "no_aplica";
}

const INDICE_CITA_ASISTIDA = PASOS.indexOf("cita_asistida");
/** Desde aquí existe un contacto pagado que se puede perder. Impresión→clic es exposición. */
const INDICE_PRIMER_CONTACTO = PASOS.indexOf("conversacion");

/** Suma cantidad de un paso. 0 si no hay registros (medido: nadie llegó). */
export function cantidadPaso(registros: ReadonlyArray<RegistroEmbudo>, paso: Paso): number {
  let total = 0;
  for (const r of registros) if (r.paso === paso) total += r.cantidad;
  return total;
}

function valorPaso(registros: ReadonlyArray<RegistroEmbudo>, paso: Paso): number | null {
  let total: number | null = null;
  for (const r of registros) {
    if (r.paso === paso && r.valorCOP !== null) total = (total ?? 0) + r.valorCOP;
  }
  return total;
}

/**
 * Margen unitario aplicable al embudo: ponderado por servicio cuando los
 * registros de venta lo traen; si no, el promedio de los calibrados; null si nada.
 */
export function margenEmbudo(registros: ReadonlyArray<RegistroEmbudo>, cfg: ConfigCliente): number | null {
  if (!estaCalibrado(cfg)) return null;
  let suma = 0;
  let n = 0;
  for (const r of registros) {
    if (r.paso !== "venta") continue;
    const m = margenUnitario(r.servicio, cfg);
    if (m === null || !servicioPorId(r.servicio, cfg)) continue;
    suma += m * r.cantidad;
    n += r.cantidad;
  }
  if (n > 0) return suma / n;
  return margenPromedio(cfg);
}

export function construirEmbudo(
  registros: ReadonlyArray<RegistroEmbudo>,
  gasto: number,
  cfg: ConfigCliente,
): PasoEmbudo[] {
  const hayDatos = registros.length > 0;
  const margen = margenEmbudo(registros, cfg);
  const cantidades = PASOS.map((p) => cantidadPaso(registros, p));
  const primero = cantidades[0] ?? 0;

  return PASOS.map((paso, i) => {
    const cantidad = cantidades[i] ?? 0;
    const anterior = i > 0 ? (cantidades[i - 1] ?? 0) : null;
    const costoUnitario = razon(gasto, cantidad);
    const costoAnterior = anterior === null ? null : razon(gasto, anterior);

    const tasaPaso = !hayDatos ? null : anterior === null ? null : razon(cantidad, anterior);
    const tasaAcumulada = !hayDatos ? null : i === 0 ? null : razon(cantidad, primero);
    const perdidos = anterior === null ? null : Math.max(anterior - cantidad, 0);

    let fugaCOP: number | null = null;
    let metodo: PasoEmbudo["metodoValorizacion"] = "no_aplica";
    if (perdidos !== null && i >= INDICE_PRIMER_CONTACTO) {
      // La fuga que llega HASTA cita_asistida (incluida la inasistencia) se perdió como
      // contacto: vale lo que costó. La fuga posterior se perdió como venta: vale el margen.
      if (i <= INDICE_CITA_ASISTIDA) {
        metodo = "costo_paso_anterior";
        fugaCOP = costoAnterior === null ? null : perdidos * costoAnterior;
      } else {
        metodo = "margen_unitario";
        fugaCOP = margen === null ? null : perdidos * margen;
      }
    }

    return {
      paso,
      orden: i + 1,
      cantidad,
      tasaPaso,
      tasaAcumulada,
      costoUnitario,
      perdidos,
      fugaCOP,
      valorCOP: valorPaso(registros, paso),
      metodoValorizacion: metodo,
    };
  });
}

/** El paso con más plata fugada. null si ninguno tiene fuga calculable. */
export function fugaMasCara(pasos: ReadonlyArray<PasoEmbudo>): PasoEmbudo | null {
  let peor: PasoEmbudo | null = null;
  for (const p of pasos) {
    if (p.fugaCOP === null) continue;
    if (peor === null || (peor.fugaCOP ?? 0) < p.fugaCOP) peor = p;
  }
  return peor;
}

// ---------------------------------------------------------------------------
// Métricas de negocio
// ---------------------------------------------------------------------------

export const showRate = (r: ReadonlyArray<RegistroEmbudo>) =>
  razon(cantidadPaso(r, "cita_asistida"), cantidadPaso(r, "cita_agendada"));

export const cierreEnConsultorio = (r: ReadonlyArray<RegistroEmbudo>) =>
  razon(cantidadPaso(r, "venta"), cantidadPaso(r, "cita_asistida"));

export const costoCitaAsistida = (r: ReadonlyArray<RegistroEmbudo>, gasto: number) =>
  razon(gasto, cantidadPaso(r, "cita_asistida"));

export const cac = (r: ReadonlyArray<RegistroEmbudo>, gasto: number) => razon(gasto, cantidadPaso(r, "venta"));

/** Ingresos de caja (ventas + recompras) / gasto. Lo que declara la clínica, no la plataforma. */
export function roasReal(r: ReadonlyArray<RegistroEmbudo>, gasto: number): number | null {
  const ingresos = [valorPaso(r, "venta"), valorPaso(r, "recompra")].reduce<number | null>(
    (s, v) => (v === null ? s : (s ?? 0) + v),
    null,
  );
  return razon(ingresos, gasto);
}

/** POAS = ROAS × margen. Un ROAS 4x con 20 % de margen es 0,8: pérdida. */
export function poas(roasValor: number | null, margenFraccion: number | null): number | null {
  if (roasValor === null || margenFraccion === null) return null;
  return roasValor * margenFraccion;
}

export const ratioCacMargen = (cacValor: number | null, margenCOP: number | null) => razon(cacValor, margenCOP);

/** Margen × visitas esperadas en el horizonte. Sin recurrencia = una visita. */
export function ltv(margenCOP: number | null, recurrenciaMeses: number | null, horizonteMeses: number): number | null {
  if (margenCOP === null) return null;
  if (recurrenciaMeses === null || recurrenciaMeses <= 0) return margenCOP;
  const visitas = Math.max(1, Math.floor(horizonteMeses / recurrenciaMeses));
  return margenCOP * visitas;
}

export interface MetricasNegocio {
  gasto: number;
  ingresosCaja: number | null;
  showRate: number | null;
  cierreEnConsultorio: number | null;
  costoCitaAsistida: number | null;
  cac: number | null;
  roasReal: number | null;
  /** Fracción de margen sobre ingresos, si se puede derivar de la config. */
  margenFraccion: number | null;
  margenUnitarioCOP: number | null;
  poas: number | null;
  ratioCacMargen: number | null;
  ltv: number | null;
  ltvSobreCac: number | null;
  /** Ingresos de recompra / ingresos totales. */
  tasaRecompra: number | null;
  calibrado: boolean;
}

export function metricasNegocio(
  registros: ReadonlyArray<RegistroEmbudo>,
  gasto: number,
  cfg: ConfigCliente,
): MetricasNegocio {
  const margenCOP = margenEmbudo(registros, cfg);
  const ventas = cantidadPaso(registros, "venta");
  const ingresosVenta = valorPaso(registros, "venta");
  const ingresosRecompra = valorPaso(registros, "recompra");
  const ingresos = [ingresosVenta, ingresosRecompra].reduce<number | null>(
    (s, v) => (v === null ? s : (s ?? 0) + v),
    null,
  );
  const ticketObservado = razon(ingresosVenta, ventas);
  const margenFraccion = margenCOP === null ? null : razon(margenCOP, ticketObservado);
  const roas = roasReal(registros, gasto);
  const cacValor = cac(registros, gasto);

  // Recurrencia promedio de los servicios vendidos (si están en config).
  const recurrencias = registros
    .filter((r) => r.paso === "venta")
    .map((r) => servicioPorId(r.servicio, cfg)?.recurrenciaMeses ?? null)
    .filter((x): x is number => x !== null);
  const recurrencia = recurrencias.length ? recurrencias.reduce((s, x) => s + x, 0) / recurrencias.length : null;
  const ltvValor = ltv(margenCOP, recurrencia, cfg.horizonteLtvMeses);

  return {
    gasto,
    ingresosCaja: ingresos,
    showRate: showRate(registros),
    cierreEnConsultorio: cierreEnConsultorio(registros),
    costoCitaAsistida: costoCitaAsistida(registros, gasto),
    cac: cacValor,
    roasReal: roas,
    margenFraccion,
    margenUnitarioCOP: margenCOP,
    poas: poas(roas, margenFraccion),
    ratioCacMargen: ratioCacMargen(cacValor, margenCOP),
    ltv: ltvValor,
    ltvSobreCac: razon(ltvValor, cacValor),
    tasaRecompra: razon(ingresosRecompra, ingresos),
    calibrado: estaCalibrado(cfg),
  };
}
