/**
 * Reglas de operación y economía: R17 conversaciones sin responder, R26 página que no carga,
 * R19 CAC sobre margen, R20 servicio a pérdida, R28 campañas que se prenden y apagan a cada rato.
 */
import type { Regla } from "@/lib/diagnostics/engine";
import { agregar, costoConversacion, filtrarRango, fugaAterrizaje, razon, tasaRespuesta } from "@/lib/metrics/core";
import { cantidadPaso } from "@/lib/metrics/funnel";
import { margenUnitario } from "@/config/cliente";
import { pct, ratio } from "@/lib/format";
import { ev, evCop, evNum, evPct, evRatio, fuenteDe, notaUmbral, ORIGEN, pesos, RUTA } from "./util";
import { campanasInterruptor } from "@/lib/metrics/bitacora";

export const R17: Regla = {
  id: "R17",
  area: "operacion",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const tasa = tasaRespuesta(ctx.reciente);
    if (tasa === null || tasa >= b.tasaRespuestaMinima.valor) return null;
    const sinResponder = (ctx.reciente.conversacionesIniciadas ?? 0) - (ctx.reciente.conversacionesRespondidas ?? 0);
    const costo = costoConversacion(ctx.reciente);
    return {
      reglaId: "R17",
      area: "operacion",
      severidad: "alta",
      titulo: `${sinResponder} personas escribieron en las últimas dos semanas y nadie les contestó`,
      explicacion:
        "Cada una de esas conversaciones se pagó con pauta. Un mensaje sin responder no es un lead perdido: es plata que ya salió de la cuenta y no volvió. Esto no se arregla con más anuncios; se arregla con quien contesta.",
      evidencia: [
        evNum("Conversaciones iniciadas", ctx.reciente.conversacionesIniciadas, 0, RUTA.comparacion),
        evNum("Conversaciones respondidas", ctx.reciente.conversacionesRespondidas, 0, RUTA.comparacion),
        evPct("Tasa de respuesta", tasa),
        evCop("Costo por conversación", costo, RUTA.comparacion),
      ],
      acciones: [
        "Asignar un responsable de chat con meta: primera respuesta en menos de 10 minutos en horario de atención.",
        "Respuesta automática fuera de horario que capture servicio y horario preferido.",
        "Revisar el buzón de solicitudes de mensaje: ahí se esconden conversaciones sin leer.",
      ],
      plataEnRiesgo: pesos(costo === null ? null : sinResponder * costo),
      metricas: ["tasa_respuesta_equipo", "costo_conversacion", "tiempo_primera_respuesta"],
      nota: notaUmbral(b.tasaRespuestaMinima),
      fuente: fuenteDe(ORIGEN.nivel(ctx.nivelBase), ctx.ventanas.reciente, ctx.serie.filter((p) => p.fecha >= ctx.ventanas.reciente.desde).length, `Tasa de respuesta = conversaciones respondidas por la clínica ÷ conversaciones iniciadas, últimos 14 días. Se avisa por debajo del ${pct(b.tasaRespuestaMinima.valor, 0)}. La plata es cada conversación sin responder al costo por conversación.`, RUTA.comparacion),
    };
  },
};

export const R26: Regla = {
  id: "R26",
  area: "operacion",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    // Solo los anuncios que llevan a una página reportan vistas; los de chat no tienen página que cargar.
    const conPagina = agregar(filtrarRango(ctx.filasAnuncio, ctx.ventanas.reciente).filter((f) => f.vistasLandingPage !== null));
    const fuga = fugaAterrizaje(conPagina);
    if (fuga === null || fuga <= b.fugaAterrizajeMaxima.valor) return null;
    const perdidos = conPagina.clicsEnlace - (conPagina.vistasLandingPage ?? 0);
    const cpc = razon(conPagina.gasto, conPagina.clicsEnlace);
    return {
      reglaId: "R26",
      area: "operacion",
      severidad: "alta",
      titulo: `${pct(fuga, 0)} de los clics nunca llegan a ver la página`,
      explicacion:
        "La gente hace clic y se va antes de que cargue. Es la página, no el anuncio: tarda demasiado, pesa demasiado o el enlace está roto. Cada clic perdido se pagó completo y ni siquiera tuvo la oportunidad de convertir.",
      evidencia: [
        evNum("Clics de enlace a una página, últimos 14 días", conPagina.clicsEnlace, 0, RUTA.creativos),
        evNum("Vistas de página", conPagina.vistasLandingPage, 0, RUTA.creativos),
        evPct("Fuga de aterrizaje", fuga),
        evCop("Costo por clic de enlace", cpc, RUTA.creativos),
      ],
      acciones: [
        "Probar la página desde un celular con datos móviles: si tarda más de 3 segundos, comprimir imágenes y quitar scripts.",
        "Si el destino es el chat, enviar directo al chat y no a una página intermedia.",
      ],
      plataEnRiesgo: pesos(cpc === null ? null : perdidos * cpc),
      metricas: ["fuga_aterrizaje", "costo_vista_landing"],
      nota: notaUmbral(b.fugaAterrizajeMaxima),
      fuente: fuenteDe(ORIGEN.anuncios, ctx.ventanas.reciente, filtrarRango(ctx.filasAnuncio, ctx.ventanas.reciente).filter((f) => f.vistasLandingPage !== null).length, `Solo cuentan los anuncios que llevan a una página (los de chat no tienen página que cargar). Fuga = 1 − vistas de página ÷ clics de enlace, últimos 14 días. Se avisa por encima del ${pct(b.fugaAterrizajeMaxima.valor, 0)}. La plata es cada clic perdido al costo por clic.`, RUTA.creativos),
    };
  },
};

export const R19: Regla = {
  id: "R19",
  area: "economia",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const n = ctx.negocio;
    if (!n.calibrado || n.ratioCacMargen === null || n.cac === null || n.margenUnitarioCOP === null) return null;
    if (n.ratioCacMargen <= b.ratioCacMargenMaximo.valor) return null;
    const ventas = cantidadPaso(ctx.lote.embudo, "venta");
    return {
      reglaId: "R19",
      area: "economia",
      severidad: "alta",
      titulo: `Cada paciente nuevo cuesta ${ratio(n.ratioCacMargen)} lo que deja`,
      explicacion:
        "El costo de conseguir un paciente supera el margen que ese paciente deja en su primer procedimiento. Se está comprando facturación con pérdida. Solo tiene sentido si el paciente vuelve, y eso hay que demostrarlo con recompras, no suponerlo.",
      evidencia: [
        evCop("Costo por paciente nuevo (CAC)", n.cac, RUTA.embudo),
        evCop("Margen por procedimiento", n.margenUnitarioCOP),
        evRatio("CAC sobre margen", n.ratioCacMargen),
        evNum("Ventas en el periodo", ventas, 0, RUTA.paso("venta")),
      ],
      acciones: [
        "Subir el ticket promedio con paquetes de sesiones antes que bajar el costo por lead.",
        "Concentrar la pauta en los servicios con más margen y recurrencia.",
        "Revisar inasistencia y cierre: suelen ser la causa de que el CAC se dispare.",
      ],
      plataEnRiesgo: pesos((n.cac - n.margenUnitarioCOP) * ventas),
      metricas: ["cac", "cac_margen", "margen_unitario", "ltv_cac"],
      nota: notaUmbral(b.ratioCacMargenMaximo),
      fuente: fuenteDe(ORIGEN.clinica, ctx.rango, ctx.lote.embudo.length, `Costo por paciente = inversión total ÷ ventas anotadas por la clínica. Margen por procedimiento = ticket promedio − costo directo, de la configuración de la clínica. Se avisa cuando el costo por paciente supera ${ratio(b.ratioCacMargenMaximo.valor)} el margen.`, RUTA.embudo),
    };
  },
};

export const R20: Regla = {
  id: "R20",
  area: "economia",
  evaluar(ctx) {
    if (!ctx.negocio.calibrado) return null;
    const ventasPorServicio = new Map<string, { cantidad: number; ingresos: number | null }>();
    for (const r of ctx.lote.embudo) {
      if (r.paso !== "venta" || !r.servicio) continue;
      const v = ventasPorServicio.get(r.servicio) ?? { cantidad: 0, ingresos: null };
      v.cantidad += r.cantidad;
      if (r.valorCOP !== null) v.ingresos = (v.ingresos ?? 0) + r.valorCOP;
      ventasPorServicio.set(r.servicio, v);
    }
    const totalVentas = [...ventasPorServicio.values()].reduce((s, v) => s + v.cantidad, 0);
    if (totalVentas === 0) return null;

    const perdedores: { servicio: string; margen: number; cac: number; ventas: number }[] = [];
    for (const [servicio, v] of ventasPorServicio) {
      const margen = margenUnitario(servicio, ctx.cliente);
      if (margen === null || v.cantidad === 0) continue;
      // Gasto atribuido proporcional a la participación en ventas (sin atribución por campaña no hay nada mejor).
      const gastoAtribuido = ctx.total.gasto * (v.cantidad / totalVentas);
      const cacServicio = gastoAtribuido / v.cantidad;
      if (margen <= 0 || cacServicio > margen) perdedores.push({ servicio, margen, cac: cacServicio, ventas: v.cantidad });
    }
    if (perdedores.length === 0) return null;
    const plata = perdedores.reduce((s, p) => s + Math.max(0, p.cac - p.margen) * p.ventas, 0);
    const nombres = perdedores.map((p) => ctx.cliente.servicios.find((s) => s.id === p.servicio)?.nombre ?? p.servicio);
    return {
      reglaId: "R20",
      area: "economia",
      severidad: "alta",
      titulo: `${nombres.join(", ")} se ${perdedores.length === 1 ? "vende" : "venden"} a pérdida`,
      explicacion:
        "Para este servicio, traer un paciente cuesta más que el margen que deja. O el precio está mal, o el costo de conseguirlo es demasiado alto para lo que vale. Se decide subir precio, empaquetar, o dejar de pautarlo.",
      evidencia: perdedores.slice(0, 4).flatMap((p) => [
        evCop(`${p.servicio} · margen por venta`, p.margen),
        evCop(`${p.servicio} · costo por paciente (estimado por participación en ventas)`, p.cac, RUTA.paso("venta")),
      ]),
      acciones: ["Sacar el servicio de la pauta o usarlo solo como puerta de entrada a un paquete con margen.", "Revisar precio y costo directo del servicio con el equipo médico."],
      plataEnRiesgo: pesos(plata),
      metricas: ["cac_servicio", "margen_unitario", "ingresos_por_servicio"],
      nota: "El costo por paciente por servicio es una estimación por participación en ventas hasta que se registre la campaña de origen en la agenda.",
      fuente: fuenteDe(ORIGEN.clinica, ctx.rango, ctx.lote.embudo.filter((r) => r.paso === "venta").length, "Para cada servicio se cuentan las ventas anotadas por la clínica y se le atribuye inversión en proporción a su participación en ventas. Ese gasto ÷ ventas es su costo por paciente; se compara con el margen del servicio (ticket − costo directo) de la configuración.", RUTA.paso("venta")),
    };
  },
};

/** Cambios de estado de una misma campaña en 14 días a partir de los cuales se habla de interruptor. */
const MINIMO_INTERRUPTOR = 3;

export const R28: Regla = {
  id: "R28",
  area: "operacion",
  evaluar(ctx) {
    const bitacora = ctx.lote.bitacora ?? [];
    if (bitacora.length === 0) return null;
    const { reciente } = ctx.ventanas;
    const interruptores = campanasInterruptor(bitacora, reciente, MINIMO_INTERRUPTOR);
    if (interruptores.length === 0) return null;
    const ids = new Set(interruptores.map((i) => i.objetoId));
    const gasto = filtrarRango(ctx.filasCampana, reciente).filter((f) => ids.has(f.id)).reduce((s, f) => s + f.gasto, 0);
    const cambios = interruptores.reduce((s, i) => s + i.apagados + i.prendidos, 0);
    const personas = new Set(interruptores.flatMap((i) => i.actores));
    const enRango = bitacora.filter((c) => c.fecha >= reciente.desde && c.fecha <= reciente.hasta);
    return {
      reglaId: "R28",
      area: "operacion",
      severidad: "alta",
      titulo: `${interruptores.length} ${interruptores.length === 1 ? "campaña se prendió y apagó" : "campañas se prendieron y apagaron"} ${cambios} veces en 14 días, entre ${personas.size} ${personas.size === 1 ? "persona" : "personas"}`,
      explicacion:
        "Cada vez que una campaña se apaga y se vuelve a prender, la plataforma reinicia su aprendizaje y vuelve a cobrar el precio caro de los primeros días. Con varias manos en el interruptor nadie sabe qué está probando qué, y las conversaciones suben y bajan sin que el anuncio haya cambiado.",
      evidencia: interruptores.slice(0, 6).map((i) => ev(i.nombre.slice(0, 60), `${i.apagados} apagados · ${i.prendidos} prendidos · ${i.actores.join(", ")}`, RUTA.campana(i.objetoId))),
      acciones: [
        "Una sola persona con permiso de prender y apagar; el resto, solo lectura.",
        "Regla escrita: ninguna campaña se apaga antes de 14 días o 50 conversaciones, y ninguna se vuelve a prender sin un cambio en el anuncio o la oferta.",
        "Registrar en Campañas por qué se apagó cada una, para que la historia no se pierda.",
      ],
      plataEnRiesgo: pesos(gasto),
      metricas: ["cambios_estado_campana", "personas_operando"],
      fuente: fuenteDe(
        ORIGEN.bitacora,
        reciente,
        enRango.length,
        `Se cuentan los cambios de estado (prender/apagar) de cada campaña en los últimos 14 días según el historial de Meta; se listan las que suman ${MINIMO_INTERRUPTOR} o más, con las personas que los hicieron. La plata es lo que esas campañas gastaron en esos 14 días: todo corrió bajo reinicios de aprendizaje.`,
        RUTA.bitacora,
      ),
    };
  },
};

