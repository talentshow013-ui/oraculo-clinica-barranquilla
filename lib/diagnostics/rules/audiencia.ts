/**
 * Reglas de audiencia: R10 fuera del radio, R11 segmento que no produce,
 * R12 franja improductiva, R13 conjuntos compitiendo.
 */
import type { BreakdownRow } from "@/lib/adapters/types";
import type { Regla } from "@/lib/diagnostics/engine";
import { filtrarRango } from "@/lib/metrics/core";
import { pct } from "@/lib/format";
import { ev, evCop, evNum, notaUmbral, pesos } from "./util";

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function porDimension(desgloses: ReadonlyArray<BreakdownRow>, dims: ReadonlyArray<BreakdownRow["dimension"]>) {
  return desgloses.filter((d) => dims.includes(d.dimension));
}

function sumarPorValor(filas: ReadonlyArray<BreakdownRow>) {
  const m = new Map<string, { gasto: number; resultados: number; impresiones: number }>();
  for (const f of filas) {
    const a = m.get(f.valor) ?? { gasto: 0, resultados: 0, impresiones: 0 };
    a.gasto += f.gasto;
    a.resultados += f.resultados;
    a.impresiones += f.impresiones;
    m.set(f.valor, a);
  }
  return m;
}

export const R10: Regla = {
  id: "R10",
  area: "audiencia",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const ubic = porDimension(ctx.desglosesVisibles, ["ubicacion"]);
    if (ubic.length === 0) return null;
    const validas = new Set(ctx.cliente.zonasValidas.map(normalizar));
    const porZona = sumarPorValor(ubic);
    let total = 0;
    let fuera = 0;
    const zonasFuera: [string, number][] = [];
    for (const [zona, a] of porZona) {
      // La plataforma no supo desde dónde: no es «fuera del radio», es dato ausente.
      if (/^(unknown|desconocid[oa])$/.test(normalizar(zona))) continue;
      total += a.gasto;
      if (!validas.has(normalizar(zona))) {
        fuera += a.gasto;
        zonasFuera.push([zona, a.gasto]);
      }
    }
    if (total === 0) return null;
    const fraccion = fuera / total;
    if (fraccion <= b.fueraRadioMaximo.valor) return null;
    zonasFuera.sort((x, y) => y[1] - x[1]);
    return {
      reglaId: "R10",
      area: "audiencia",
      severidad: "alta",
      titulo: `${pct(fraccion, 0)} de la inversión se va a ciudades desde donde nadie viene`,
      explicacion:
        `Nadie viaja desde ${zonasFuera[0]?.[0] ?? "otra ciudad"} por una sesión. El radio útil es el área metropolitana (${ctx.cliente.zonasValidas.join(", ")}). Toda la plata que cae fuera de ese radio es pérdida directa: genera clics y conversaciones que no pueden terminar en una cita.`,
      evidencia: [
        evCop("Gasto fuera del radio", fuera),
        evCop("Gasto total con ubicación conocida", total),
        ...zonasFuera.slice(0, 4).map(([z, g]) => evCop(`Gasto en ${z}`, g)),
      ],
      acciones: [
        "Restringir la segmentación geográfica a los municipios del radio y excluir explícitamente las ciudades que aparecen arriba.",
        "Si un conjunto usa “personas que viven en o visitan”, cambiarlo a “personas que viven en”.",
      ],
      plataEnRiesgo: pesos(fuera),
      metricas: ["inversion_fuera_radio", "cpa_zona"],
      nota: notaUmbral(b.fueraRadioMaximo),
    };
  },
};

export const R11: Regla = {
  id: "R11",
  area: "audiencia",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    // Cada dimensión tiene su propio total: mezclar edad con género diluye las cuotas. Y la plata de
    // edad y la de género es la misma plata: manda la dimensión donde más se pierde, no la suma.
    type Suma = { gasto: number; resultados: number; impresiones: number };
    const culpables: [string, Suma][] = [];
    let total = 0;
    let gasto = 0;
    for (const dim of ["edad", "genero", "edad_genero"] as const) {
      const filas = porDimension(ctx.desglosesVisibles, [dim]);
      const totalDim = filas.reduce((s, d) => s + d.gasto, 0);
      if (totalDim === 0) continue;
      // Si ningún segmento de la dimensión tiene resultados, la fuente no los entrega: dato ausente, no cero.
      if (!filas.some((d) => d.resultados > 0)) continue;
      const culpablesDim: [string, Suma][] = [];
      for (const [valor, a] of sumarPorValor(filas)) {
        if (a.resultados === 0 && a.gasto / totalDim >= b.segmentoConsumoSinResultado.valor) culpablesDim.push([valor, a]);
      }
      const gastoDim = culpablesDim.reduce((s, [, a]) => s + a.gasto, 0);
      culpables.push(...culpablesDim);
      if (culpablesDim.length && gastoDim / totalDim > (total ? gasto / total : 0)) {
        total = totalDim;
        gasto = gastoDim;
      }
    }
    if (culpables.length === 0) return null;
    return {
      reglaId: "R11",
      area: "audiencia",
      severidad: "alta",
      titulo: `El segmento ${culpables.map(([v]) => v).join(", ")} consume ${pct(gasto / total, 0)} del gasto y no produce nada`,
      explicacion:
        "Hay gente que ve el anuncio, a veces hace clic, y nunca llega a escribir ni a agendar. Cada peso que se le muestra es un peso que no se le mostró a quien sí compra. Excluirlo no reduce resultados: los concentra.",
      evidencia: culpables.slice(0, 4).flatMap(([v, a]) => [evCop(`Gasto en ${v}`, a.gasto), evNum(`Resultados en ${v}`, a.resultados)]),
      acciones: ["Excluir el segmento en los conjuntos activos o crear un conjunto aparte con presupuesto mínimo si se quiere seguir probando.", "Revisar si el mensaje del anuncio habla a ese segmento sin querer."],
      plataEnRiesgo: pesos(gasto),
      metricas: ["cpa_edad", "cpa_genero", "segmentos_sin_resultado"],
      nota: notaUmbral(b.segmentoConsumoSinResultado),
    };
  },
};

export const R12: Regla = {
  id: "R12",
  area: "audiencia",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const horas = porDimension(ctx.desglosesVisibles, ["hora"]);
    if (horas.length === 0) return null;
    const { inicio, fin } = ctx.cliente.horarioAtencion;
    let total = 0;
    let fuera = 0;
    for (const h of horas) {
      const hora = Number.parseInt(h.valor, 10);
      if (!Number.isFinite(hora)) continue;
      total += h.gasto;
      if (hora < inicio || hora >= fin) fuera += h.gasto;
    }
    if (total === 0) return null;
    const fraccion = fuera / total;
    if (fraccion <= b.fueraHorarioMaximo.valor) return null;
    return {
      reglaId: "R12",
      area: "audiencia",
      severidad: "media",
      titulo: `${pct(fraccion, 0)} de la pauta corre cuando no hay nadie que conteste`,
      explicacion:
        `La clínica atiende de ${inicio}:00 a ${fin}:00, pero buena parte de la inversión se muestra fuera de ese horario. Quien escribe a las 11 de la noche y recibe respuesta a las 9 de la mañana ya escribió a otra clínica. La velocidad de respuesta define quién se queda con el paciente.`,
      evidencia: [evCop("Gasto fuera de horario", fuera), evCop("Gasto total con hora conocida", total), ev("Horario de atención", `${inicio}:00 – ${fin}:00`)],
      acciones: [
        "Programar la pauta para el horario de atención, o dejar un 20 % fuera de horario con respuesta automática que agende.",
        "Configurar un mensaje automático de bienvenida que capture servicio y horario preferido.",
      ],
      plataEnRiesgo: pesos(fuera),
      metricas: ["inversion_fuera_horario", "conversaciones_fuera_horario", "tiempo_primera_respuesta"],
      nota: notaUmbral(b.fueraHorarioMaximo),
    };
  },
};

export const R13: Regla = {
  id: "R13",
  area: "audiencia",
  evaluar(ctx) {
    const conjuntos = filtrarRango(ctx.filasConjunto, ctx.ventanas.reciente).filter((f) => f.estado === "activo" && f.gasto > 0);
    if (conjuntos.length === 0) return null;
    // Conjuntos de la misma campaña cuyo nombre, sin números ni sufijos, coincide: misma audiencia.
    const grupos = new Map<string, Set<string>>();
    const nombres = new Map<string, string>();
    for (const f of conjuntos) {
      const clave = `${f.padreId ?? ""}|${normalizar(f.nombre).replace(/[\d_\-·|#().]+/g, " ").replace(/\b(v|var|test|copia|copy)\b/g, "").replace(/\s+/g, " ").trim()}`;
      (grupos.get(clave) ?? grupos.set(clave, new Set()).get(clave)!).add(f.id);
      nombres.set(f.id, f.nombre);
    }
    const solapados = [...grupos.values()].filter((s) => s.size >= 2);
    if (solapados.length === 0) return null;
    const ids = solapados.flatMap((s) => [...s]);
    return {
      reglaId: "R13",
      area: "audiencia",
      severidad: "media",
      titulo: `${ids.length} conjuntos le están comprando la misma gente a la misma subasta`,
      explicacion:
        "Cuando dos conjuntos apuntan a la misma audiencia, compiten entre sí y suben el costo por mil de la propia cuenta. Se paga más por las mismas personas y la plataforma reparte el aprendizaje entre dos en vez de concentrarlo en uno.",
      evidencia: ids.slice(0, 6).map((id) => ev("Conjunto", nombres.get(id) ?? id)),
      acciones: ["Fusionar los conjuntos duplicados y dejar la diferencia solo a nivel de anuncio.", "Si son pruebas de audiencia, separarlas con exclusiones mutuas."],
      plataEnRiesgo: null,
      metricas: ["solapamiento_conjuntos", "cpm"],
    };
  },
};
