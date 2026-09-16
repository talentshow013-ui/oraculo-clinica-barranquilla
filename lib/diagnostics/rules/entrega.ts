/**
 * Reglas de entrega: R01 saturación, R02 presión de subasta, R03 concentración, R21 presupuesto.
 */
import type { Regla } from "@/lib/diagnostics/engine";
import { concentracionHHI, cpm, ctrEnlace, delta, filtrarRango, frecuencia } from "@/lib/metrics/core";
import { ev, evCop, evNum, evPct, fuenteDe, notaUmbral, ORIGEN, pesos, RUTA } from "./util";
import { cop, num, pct } from "@/lib/format";

export const R01: Regla = {
  id: "R01",
  area: "entrega",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const frec = frecuencia(ctx.reciente);
    const ctrRec = ctrEnlace(ctx.reciente);
    const ctrPrev = ctrEnlace(ctx.previa);
    if (frec === null || ctrRec === null || ctrPrev === null) return null;
    const caida = delta(ctrRec, ctrPrev);
    if (caida === null) return null;
    if (frec < b.frecuenciaSaturacion.valor || caida > -b.caidaCtrFatiga.valor) return null;

    // Plata: lo que se gastó en la quincena reciente para obtener menos intención por impresión.
    const plata = pesos(ctx.reciente.gasto * Math.abs(caida));
    return {
      reglaId: "R01",
      area: "entrega",
      severidad: "alta",
      titulo: `La misma gente ya vio el anuncio ${num(frec, 1)} veces y cada vez responde menos`,
      explicacion:
        "Cuando la frecuencia sube y la respuesta baja al mismo tiempo, no es el mercado ni el precio: es que la audiencia ya se cansó de esa pieza. Seguir pagando por mostrársela es pagar más por menos.",
      evidencia: [
        evNum("Frecuencia en los últimos 14 días", frec, 1, RUTA.comparacion),
        evPct("Respuesta al enlace, últimos 14 días", ctrRec, RUTA.comparacion),
        evPct("Respuesta al enlace, 14 días anteriores", ctrPrev, RUTA.comparacion),
        evPct("Caída de la respuesta", caida),
      ],
      acciones: [
        "Rotar el creativo principal por una variante nueva (mismo mensaje, otra apertura).",
        "Ampliar la audiencia o excluir a quienes ya interactuaron en los últimos 30 días.",
        "Poner un tope de frecuencia si el objetivo lo permite.",
      ],
      plataEnRiesgo: plata,
      metricas: ["frecuencia", "ctr_enlace", "indice_fatiga"],
      nota: notaUmbral(b.frecuenciaSaturacion, b.caidaCtrFatiga),
      fuente: fuenteDe(
        ORIGEN.nivel(ctx.nivelBase),
        { desde: ctx.ventanas.previa.desde, hasta: ctx.ventanas.reciente.hasta },
        ctx.serie.length,
        `Frecuencia = impresiones ÷ personas alcanzadas en los últimos 14 días. Tasa de clics = clics de enlace ÷ impresiones, comparada con los 14 días anteriores. Se avisa cuando la frecuencia pasa de ${num(b.frecuenciaSaturacion.valor, 1)} y la tasa de clics cae más del ${pct(b.caidaCtrFatiga.valor, 0)}.`,
        RUTA.comparacion,
      ),
    };
  },
};

export const R02: Regla = {
  id: "R02",
  area: "entrega",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const cpmRec = cpm(ctx.reciente);
    const cpmPrev = cpm(ctx.previa);
    const ctrRec = ctrEnlace(ctx.reciente);
    const ctrPrev = ctrEnlace(ctx.previa);
    const subida = delta(cpmRec, cpmPrev);
    const cambioCtr = delta(ctrRec, ctrPrev);
    if (subida === null || cambioCtr === null) return null;
    if (subida < b.subidaCpmPresion.valor) return null;
    if (Math.abs(cambioCtr) > 0.1) return null; // el CTR se movió: no es la subasta, es el creativo

    const sobrecosto = cpmPrev === null || cpmRec === null ? null : ctx.reciente.gasto * (1 - cpmPrev / cpmRec);
    return {
      reglaId: "R02",
      area: "entrega",
      severidad: "media",
      titulo: `Comprar atención salió ${pct(subida, 0)} más caro y no es culpa del anuncio`,
      explicacion:
        "El costo por mil impresiones subió mientras la gente sigue respondiendo igual. Eso es presión de subasta: más anunciantes compitiendo por las mismas personas. No se arregla cambiando el creativo; se arregla cambiando dónde y a quién se compite.",
      evidencia: [
        evCop("Costo por mil, últimos 14 días", cpmRec, RUTA.comparacion),
        evCop("Costo por mil, 14 días anteriores", cpmPrev, RUTA.comparacion),
        evPct("Cambio en la respuesta al enlace", cambioCtr, RUTA.comparacion),
      ],
      acciones: [
        "Probar ubicaciones o audiencias con menos competencia (intereses adyacentes, municipios del radio menos cubiertos).",
        "Revisar el Radar de mercado: si la competencia subió cadencia, evitar sus horarios y ángulos.",
        "No subir puja ni presupuesto hasta confirmar que el costo por cita asistida sigue dentro del margen.",
      ],
      plataEnRiesgo: pesos(sobrecosto),
      metricas: ["cpm", "ctr_enlace", "puja_promedio"],
      nota: notaUmbral(b.subidaCpmPresion),
      fuente: fuenteDe(
        ORIGEN.nivel(ctx.nivelBase),
        { desde: ctx.ventanas.previa.desde, hasta: ctx.ventanas.reciente.hasta },
        ctx.serie.length,
        `Costo por mil = gasto ÷ impresiones × 1000, últimos 14 días contra los 14 anteriores. Se avisa si sube más del ${pct(b.subidaCpmPresion.valor, 0)} mientras la tasa de clics se mueve menos del 10 %: si la gente responde igual, el encarecimiento viene de la subasta, no del anuncio.`,
        RUTA.comparacion,
      ),
    };
  },
};

export const R03: Regla = {
  id: "R03",
  area: "entrega",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const filas = filtrarRango(ctx.filasAnuncio, ctx.ventanas.reciente);
    const porAnuncio = new Map<string, number>();
    for (const f of filas) porAnuncio.set(f.id, (porAnuncio.get(f.id) ?? 0) + f.gasto);
    if (porAnuncio.size < 2) return null;
    const gastos = [...porAnuncio.values()];
    const hhi = concentracionHHI(gastos);
    if (hhi === null || hhi < b.hhiConcentracion.valor) return null;
    const total = gastos.reduce((s, g) => s + g, 0);
    const [idTop, gastoTop] = [...porAnuncio.entries()].sort((a, c) => c[1] - a[1])[0]!;
    const nombreTop = filas.find((f) => f.id === idTop)?.nombre ?? idTop;
    // Una semana de gasto del creativo del que depende todo.
    const plata = pesos((gastoTop / 14) * 7);
    return {
      reglaId: "R03",
      area: "entrega",
      severidad: "media",
      titulo: `${pct(gastoTop / total, 0)} de la inversión depende de un solo anuncio`,
      explicacion:
        "Cuando casi toda la plata está en una pieza, el día que esa pieza fatiga la cuenta entera se cae y no hay reemplazo probado. Es una bomba de tiempo: no por lo que pasa hoy, sino por lo que va a pasar.",
      evidencia: [
        ev("Anuncio principal", nombreTop, RUTA.anuncio(idTop)),
        evCop("Gasto del principal, últimos 14 días", gastoTop, RUTA.anuncio(idTop)),
        evNum("Índice de concentración (1 = todo en uno)", hhi, 2),
        evNum("Anuncios con gasto", porAnuncio.size, 0, RUTA.creativos),
      ],
      acciones: [
        "Producir 2 variantes del anuncio principal (misma promesa, distinto gancho) y darles 20 % del presupuesto.",
        "Fijar una regla: ningún anuncio por encima del 50 % del gasto semanal.",
      ],
      plataEnRiesgo: plata,
      metricas: ["hhi_inversion", "top1_inversion"],
      nota: notaUmbral(b.hhiConcentracion),
      fuente: fuenteDe(
        ORIGEN.anuncios,
        ctx.ventanas.reciente,
        filas.length,
        `Se suma el gasto de cada anuncio en los últimos 14 días y se calcula cuánto se concentra (índice: 1 = todo en un solo anuncio, cerca de 0 = muy repartido). Se avisa desde ${num(b.hhiConcentracion.valor, 2)}. La plata es una semana de gasto del anuncio principal.`,
        RUTA.creativos,
      ),
    };
  },
};

export const R21: Regla = {
  id: "R21",
  area: "entrega",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const conjuntos = filtrarRango(ctx.filasConjunto, ctx.ventanas.reciente).filter((f) => f.estado === "activo");
    if (conjuntos.length === 0) return null;
    const porConjunto = new Map<string, { nombre: string; gasto: number; dias: Set<string>; campana: string | null }>();
    for (const f of conjuntos) {
      const c = porConjunto.get(f.id) ?? { nombre: f.nombre, gasto: 0, dias: new Set<string>(), campana: f.padreId };
      c.gasto += f.gasto;
      c.dias.add(f.fecha);
      porConjunto.set(f.id, c);
    }
    const insuficientes = [...porConjunto.values()]
      .map((c) => ({ ...c, diario: c.gasto / Math.max(1, c.dias.size) }))
      .filter((c) => c.diario < b.presupuestoDiarioMinimoCOP.valor);
    if (insuficientes.length === 0) return null;
    const gastoAtrapado = insuficientes.reduce((s, c) => s + c.gasto, 0);
    return {
      reglaId: "R21",
      area: "entrega",
      severidad: "media",
      titulo: `${insuficientes.length} ${insuficientes.length === 1 ? "conjunto gasta" : "conjuntos gastan"} tan poco que nunca ${insuficientes.length === 1 ? "sale" : "salen"} de aprendizaje`,
      explicacion:
        "Con menos presupuesto del mínimo, la plataforma no reúne suficientes resultados para estabilizar el costo. Se paga el precio inestable de siempre estar aprendiendo. Mejor menos conjuntos con presupuesto real que muchos con migajas.",
      evidencia: [
        ...insuficientes.slice(0, 4).map((c) => evCop(`${c.nombre} · gasto diario`, c.diario, c.campana ? RUTA.campana(c.campana) : RUTA.campanas)),
        evCop("Mínimo diario de referencia", b.presupuestoDiarioMinimoCOP.valor),
      ],
      acciones: [
        "Consolidar los conjuntos pequeños en uno con presupuesto suficiente.",
        "Pausar los que no tengan una hipótesis clara de por qué existen.",
      ],
      plataEnRiesgo: pesos(gastoAtrapado),
      metricas: ["gasto_diario_promedio", "conjuntos_en_aprendizaje"],
      nota: notaUmbral(b.presupuestoDiarioMinimoCOP),
      fuente: fuenteDe(
        ORIGEN.conjuntos,
        ctx.ventanas.reciente,
        conjuntos.length,
        `Para cada conjunto activo se divide su gasto de los últimos 14 días entre los días en que gastó. Se listan los que quedan por debajo del mínimo diario de referencia (${cop(b.presupuestoDiarioMinimoCOP.valor)}). La plata es todo lo que gastaron esos conjuntos.`,
        RUTA.campanas,
      ),
    };
  },
};
