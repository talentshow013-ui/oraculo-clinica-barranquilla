/**
 * Reglas de operación y economía: R17 conversaciones sin responder, R26 página que no carga,
 * R19 CAC sobre margen, R20 servicio a pérdida.
 */
import type { Regla } from "@/lib/diagnostics/engine";
import { agregar, costoConversacion, filtrarRango, fugaAterrizaje, razon, tasaRespuesta } from "@/lib/metrics/core";
import { cantidadPaso } from "@/lib/metrics/funnel";
import { margenUnitario } from "@/config/cliente";
import { pct, ratio } from "@/lib/format";
import { evCop, evNum, evPct, evRatio, notaUmbral, pesos } from "./util";

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
        evNum("Conversaciones iniciadas", ctx.reciente.conversacionesIniciadas),
        evNum("Conversaciones respondidas", ctx.reciente.conversacionesRespondidas),
        evPct("Tasa de respuesta", tasa),
        evCop("Costo por conversación", costo),
      ],
      acciones: [
        "Asignar un responsable de chat con meta: primera respuesta en menos de 10 minutos en horario de atención.",
        "Respuesta automática fuera de horario que capture servicio y horario preferido.",
        "Revisar el buzón de solicitudes de mensaje: ahí se esconden conversaciones sin leer.",
      ],
      plataEnRiesgo: pesos(costo === null ? null : sinResponder * costo),
      metricas: ["tasa_respuesta_equipo", "costo_conversacion", "tiempo_primera_respuesta"],
      nota: notaUmbral(b.tasaRespuestaMinima),
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
        evNum("Clics de enlace a una página, últimos 14 días", conPagina.clicsEnlace),
        evNum("Vistas de página", conPagina.vistasLandingPage),
        evPct("Fuga de aterrizaje", fuga),
        evCop("Costo por clic de enlace", cpc),
      ],
      acciones: [
        "Probar la página desde un celular con datos móviles: si tarda más de 3 segundos, comprimir imágenes y quitar scripts.",
        "Si el destino es el chat, enviar directo al chat y no a una página intermedia.",
      ],
      plataEnRiesgo: pesos(cpc === null ? null : perdidos * cpc),
      metricas: ["fuga_aterrizaje", "costo_vista_landing"],
      nota: notaUmbral(b.fugaAterrizajeMaxima),
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
        evCop("Costo por paciente nuevo (CAC)", n.cac),
        evCop("Margen por procedimiento", n.margenUnitarioCOP),
        evRatio("CAC sobre margen", n.ratioCacMargen),
        evNum("Ventas en el periodo", ventas),
      ],
      acciones: [
        "Subir el ticket promedio con paquetes de sesiones antes que bajar el costo por lead.",
        "Concentrar la pauta en los servicios con más margen y recurrencia.",
        "Revisar inasistencia y cierre: suelen ser la causa de que el CAC se dispare.",
      ],
      plataEnRiesgo: pesos((n.cac - n.margenUnitarioCOP) * ventas),
      metricas: ["cac", "cac_margen", "margen_unitario", "ltv_cac"],
      nota: notaUmbral(b.ratioCacMargenMaximo),
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
        evCop(`${p.servicio} · costo por paciente (estimado por participación en ventas)`, p.cac),
      ]),
      acciones: ["Sacar el servicio de la pauta o usarlo solo como puerta de entrada a un paquete con margen.", "Revisar precio y costo directo del servicio con el equipo médico."],
      plataEnRiesgo: pesos(plata),
      metricas: ["cac_servicio", "margen_unitario", "ingresos_por_servicio"],
      nota: "El costo por paciente por servicio es una estimación por participación en ventas hasta que se registre la campaña de origen en la agenda.",
    };
  },
};
