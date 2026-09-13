/**
 * Reglas de embudo: R14 cuello de botella en agenda, R15 inasistencia (la más importante),
 * R16 cierre bajo en consultorio, R18 caída semanal (ventanas iguales).
 */
import type { Regla } from "@/lib/diagnostics/engine";
import { cantidadPaso } from "@/lib/metrics/funnel";
import { delta, razon } from "@/lib/metrics/core";
import { diasEntre } from "@/lib/format/fechas";
import { pct } from "@/lib/format";
import { ev, evCop, evNum, evPct, notaUmbral, pesos } from "./util";

export const R14: Regla = {
  id: "R14",
  area: "embudo",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const leads = cantidadPaso(ctx.lote.embudo, "lead_calificado");
    const agendadas = cantidadPaso(ctx.lote.embudo, "cita_agendada");
    const tasa = razon(agendadas, leads);
    if (tasa === null || tasa >= b.tasaAgendamientoMinima.valor) return null;
    const paso = ctx.embudo.find((p) => p.paso === "cita_agendada");
    return {
      reglaId: "R14",
      area: "embudo",
      severidad: "alta",
      titulo: `Solo ${pct(tasa, 0)} de los interesados reales consigue una cita`,
      explicacion:
        "Hay gente calificada que quiere ir y no termina agendada. Eso es agenda llena, cierre en chat lento o cupos que no se ofrecen a tiempo. Es la fuga más absurda: ya se pagó por traerlos y ya dijeron que sí.",
      evidencia: [
        evNum("Leads calificados", leads),
        evNum("Citas agendadas", agendadas),
        evPct("Tasa de agendamiento", tasa),
        evCop("Fuga en pesos en este paso", paso?.fugaCOP ?? null),
      ],
      acciones: [
        "Ofrecer dos horarios concretos en el primer mensaje de respuesta, no preguntar “¿cuándo puedes?”.",
        "Abrir cupos de valoración en franja de tarde/sábado si la agenda está llena.",
        "Medir el tiempo entre lead calificado y cita ofrecida; objetivo: menos de 1 hora.",
      ],
      plataEnRiesgo: pesos(paso?.fugaCOP ?? null),
      metricas: ["tasa_agendamiento", "ocupacion_agenda", "fuga_pesos"],
      nota: notaUmbral(b.tasaAgendamientoMinima),
    };
  },
};

export const R15: Regla = {
  id: "R15",
  area: "embudo",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const agendadas = cantidadPaso(ctx.lote.embudo, "cita_agendada");
    const asistidas = cantidadPaso(ctx.lote.embudo, "cita_asistida");
    const show = razon(asistidas, agendadas);
    if (show === null || show >= b.showRateMinimo.valor) return null;
    const inasistencia = 1 - show;
    const paso = ctx.embudo.find((p) => p.paso === "cita_asistida");
    return {
      reglaId: "R15",
      area: "embudo",
      severidad: "alta",
      titulo: `${pct(inasistencia, 1)} de las citas agendadas no se presentan`,
      explicacion:
        "Cada persona que no llega ya te costó toda la inversión de traerla, y además dejó un cupo vacío que nadie más pudo usar. Se pierde dos veces. Esta es, casi siempre, la fuga más cara de una clínica y la más barata de arreglar: es proceso, no pauta.",
      evidencia: [
        evNum("Citas agendadas", agendadas),
        evNum("Citas asistidas", asistidas),
        evPct("Asistencia", show),
        evCop("Costo por cita agendada", ctx.embudo.find((p) => p.paso === "cita_agendada")?.costoUnitario ?? null),
        evCop("Fuga en pesos por inasistencia", paso?.fugaCOP ?? null),
      ],
      acciones: [
        "Confirmación 24 horas antes y recordatorio 2 horas antes, por el mismo canal donde escribió.",
        "Abono simbólico para separar el cupo (se descuenta del procedimiento).",
        "Agendar a menos de 72 horas del contacto: cuanto más lejos la cita, más inasistencia.",
      ],
      plataEnRiesgo: pesos(paso?.fugaCOP ?? null),
      metricas: ["show_rate", "costo_cita_asistida", "fuga_pesos", "costo_cupo_vacio"],
      nota: notaUmbral(b.showRateMinimo),
    };
  },
};

export const R16: Regla = {
  id: "R16",
  area: "embudo",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const asistidas = cantidadPaso(ctx.lote.embudo, "cita_asistida");
    const ventas = cantidadPaso(ctx.lote.embudo, "venta");
    const cierre = razon(ventas, asistidas);
    if (cierre === null || cierre >= b.cierreConsultorioMinimo.valor) return null;
    const paso = ctx.embudo.find((p) => p.paso === "venta");
    return {
      reglaId: "R16",
      area: "embudo",
      severidad: "alta",
      titulo: `De cada 10 personas que llegan a valoración, solo ${Math.round(cierre * 10)} compran`,
      explicacion:
        "La gente llegó. La pauta hizo su trabajo. Si no compran, el problema está en la consulta: el precio no se presentó bien, la propuesta no resolvió la duda o no hubo una razón para decidir hoy. Ninguna campaña arregla esto.",
      evidencia: [
        evNum("Citas asistidas", asistidas),
        evNum("Ventas", ventas),
        evPct("Cierre en consultorio", cierre),
        evCop("Fuga en pesos (margen dejado de ganar)", paso?.fugaCOP ?? null),
      ],
      acciones: [
        "Guion de cierre en valoración: diagnóstico → plan → precio con opciones de pago → fecha de inicio.",
        "Oferta de decisión el mismo día (no descuento: un beneficio, p. ej. primera sesión de mantenimiento incluida).",
        "Seguimiento a las 48 horas a quien no cerró, con una sola pregunta.",
      ],
      plataEnRiesgo: pesos(paso?.fugaCOP ?? null),
      metricas: ["cierre_consultorio", "ticket_promedio", "fuga_pesos"],
      nota: paso?.fugaCOP === null ? "Sin ticket y costo calibrados no se puede valorizar esta fuga; se muestra el porcentaje." : notaUmbral(b.cierreConsultorioMinimo),
    };
  },
};

export const R18: Regla = {
  id: "R18",
  area: "embudo",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const { reciente, previa } = ctx.ventanas;
    // Ventanas iguales por construcción; se verifica igual para que un cambio futuro no rompa la regla.
    if (diasEntre(reciente.desde, reciente.hasta) !== diasEntre(previa.desde, previa.hasta)) return null;

    const rec = ctx.embudoReciente.find((p) => p.paso === "cita_asistida")?.cantidad ?? 0;
    const prev = ctx.embudoPrevio.find((p) => p.paso === "cita_asistida")?.cantidad ?? 0;
    const usarConversaciones = rec === 0 && prev === 0;
    const actual = usarConversaciones ? ctx.reciente.conversacionesIniciadas : rec;
    const base = usarConversaciones ? ctx.previa.conversacionesIniciadas : prev;
    const cambio = delta(actual, base);
    if (cambio === null || cambio > -b.caidaSemanalAlerta.valor) return null;

    const etiqueta = usarConversaciones ? "Conversaciones" : "Citas asistidas";
    const costoPrevio = ctx.embudoPrevio.find((p) => p.paso === (usarConversaciones ? "conversacion" : "cita_asistida"))?.costoUnitario ?? razon(ctx.previa.gasto, base);
    const perdidos = (base ?? 0) - (actual ?? 0);
    return {
      reglaId: "R18",
      area: "embudo",
      severidad: "alta",
      titulo: `${etiqueta} cayeron ${pct(Math.abs(cambio), 0)} en las últimas dos semanas`,
      explicacion:
        `Comparado contra las dos semanas anteriores (mismo tamaño de ventana), el volumen que llega bajó de forma clara. Puede ser inversión, entrega, creativo o agenda; el diagnóstico de arriba dice cuál. Lo que no puede pasar es que nadie lo note hasta el cierre del mes.`,
      evidencia: [
        ev("Ventana reciente", `${reciente.desde} → ${reciente.hasta} (${diasEntre(reciente.desde, reciente.hasta)} días)`),
        ev("Ventana anterior", `${previa.desde} → ${previa.hasta} (${diasEntre(previa.desde, previa.hasta)} días)`),
        evNum(`${etiqueta}, ventana reciente`, actual),
        evNum(`${etiqueta}, ventana anterior`, base),
        evPct("Cambio", cambio),
      ],
      acciones: [
        "Revisar primero inversión y entrega: si el gasto también cayó, es presupuesto; si no, es creativo o audiencia.",
        "Cruzar con los huecos de datos antes de concluir: un hueco simula una caída.",
      ],
      plataEnRiesgo: pesos(costoPrevio === null ? null : perdidos * costoPrevio),
      metricas: usarConversaciones ? ["conversaciones_iniciadas", "elasticidad_inversion"] : ["paso_cita_asistida", "elasticidad_inversion"],
      nota: notaUmbral(b.caidaSemanalAlerta),
    };
  },
};
