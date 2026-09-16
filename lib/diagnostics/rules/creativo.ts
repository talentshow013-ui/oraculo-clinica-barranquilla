/**
 * Reglas creativas: R04 portafolio, R05 gancho, R06 gancho que no cumple, R07 fatiga,
 * R08 sin renovación, R09 riesgo de política, R25 clics que no llevan a ninguna parte,
 * R27 por debajo de la competencia en subasta (ranking de Meta).
 */
import type { Regla } from "@/lib/diagnostics/engine";
import type { EvaluacionCreativo } from "@/lib/metrics/creative";
import { agregar, filtrarRango, tasaConversacion } from "@/lib/metrics/core";
import { riesgoPolitica } from "@/lib/competitive/angles";
import { ES_INFERIOR, rankingEnPalabras } from "@/lib/adapters/meta.rankings";
import { diasEntre } from "@/lib/format/fechas";
import { num, pct } from "@/lib/format";
import { ev, evCop, evNum, evPct, fuenteDe, notaUmbral, ORIGEN, pesos, RUTA } from "./util";

/** Creativos con gasto en la ventana reciente. */
function activosRecientes(ctx: Parameters<Regla["evaluar"]>[0]): EvaluacionCreativo[] {
  const ids = new Set(filtrarRango(ctx.filasAnuncio, ctx.ventanas.reciente).filter((f) => f.gasto > 0).map((f) => f.id));
  return ctx.creativos.filter((c) => ids.has(c.creativo.anuncioId));
}

/** Filas de anuncio con gasto en la ventana reciente: la base de las reglas creativas. */
function filasRecientes(ctx: Parameters<Regla["evaluar"]>[0]) {
  return filtrarRango(ctx.filasAnuncio, ctx.ventanas.reciente).filter((f) => f.gasto > 0);
}

function gastoReciente(ctx: Parameters<Regla["evaluar"]>[0], anuncioId: string): number {
  return agregar(filtrarRango(ctx.filasAnuncio, ctx.ventanas.reciente).filter((f) => f.id === anuncioId)).gasto;
}

export const R04: Regla = {
  id: "R04",
  area: "creativo",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    if (ctx.creativos.length === 0) return null;
    const activos = activosRecientes(ctx);
    if (activos.length >= b.creativosActivosMinimo.valor) return null;
    return {
      reglaId: "R04",
      area: "creativo",
      severidad: "media",
      titulo:
        activos.length === 0
          ? "La pauta está apagada: ningún anuncio gastó en los últimos 14 días"
          : `Solo ${activos.length} ${activos.length === 1 ? "anuncio activo" : "anuncios activos"}: no se está probando nada`,
      explicacion:
        activos.length === 0
          ? "Sin pauta no hay datos nuevos: las cifras recientes quedan en cero o en «—» y la historia se conserva intacta. Si el apagado fue a propósito, esta alerta es solo un recordatorio; si no, hay que revisar la cuenta."
          : "Con menos de tres piezas compitiendo no hay comparación posible: no se sabe si el resultado es bueno o malo porque no hay contra qué medirlo. Sin prueba no hay aprendizaje, y sin aprendizaje la cuenta no mejora.",
      evidencia: [evNum("Anuncios con gasto en los últimos 14 días", activos.length, 0, RUTA.creativos), evNum("Mínimo para probar", b.creativosActivosMinimo.valor)],
      acciones: [
        "Lanzar al menos dos variantes más del mejor anuncio: cambiar solo el gancho en una y solo la oferta en otra.",
        "Definir un calendario de producción: una pieza nueva por semana como mínimo.",
      ],
      plataEnRiesgo: null,
      metricas: ["creativos_activos", "ritmo_renovacion"],
      nota: notaUmbral(b.creativosActivosMinimo),
      fuente: fuenteDe(ORIGEN.anuncios, ctx.ventanas.reciente, filasRecientes(ctx).length, `Se cuentan los anuncios distintos con gasto mayor a cero en los últimos 14 días y se comparan con el mínimo de referencia (${b.creativosActivosMinimo.valor}).`, RUTA.creativos),
    };
  },
};

export const R05: Regla = {
  id: "R05",
  area: "creativo",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const debiles = activosRecientes(ctx).filter(
      (c) => c.creativo.formato === "video" && c.cuadrante !== "sin_senal" && c.hookRate !== null && c.hookRate < b.hookRateMinimo.valor,
    );
    if (debiles.length === 0) return null;
    const plata = debiles.reduce((s, c) => {
      const g = gastoReciente(ctx, c.creativo.anuncioId);
      return s + g * (1 - (c.hookRate ?? 0) / b.hookRateMinimo.valor);
    }, 0);
    return {
      reglaId: "R05",
      area: "creativo",
      severidad: "media",
      titulo: `${debiles.length} ${debiles.length === 1 ? "video no detiene" : "videos no detienen"} el scroll en los primeros 3 segundos`,
      explicacion:
        "Si la gente no se detiene en el arranque, el resto del video no existe: no importa qué tan buena sea la oferta si nadie la ve. Se paga por impresiones que nunca se convierten en atención.",
      evidencia: debiles.slice(0, 4).map((c) => evPct(`${c.creativo.copyPrincipal.slice(0, 40)}… · gancho`, c.hookRate, RUTA.anuncio(c.creativo.anuncioId))),
      acciones: [
        "Cambiar solo los primeros 3 segundos: empezar con la pregunta o el resultado, no con el logo.",
        "Probar apertura con la persona hablando a cámara y texto en pantalla desde el segundo 0.",
      ],
      plataEnRiesgo: pesos(plata),
      metricas: ["hook_rate", "costo_3s"],
      nota: notaUmbral(b.hookRateMinimo),
      fuente: fuenteDe(
        ORIGEN.anuncios,
        ctx.ventanas.reciente,
        filasRecientes(ctx).length,
        `Gancho = personas que ven los primeros 3 segundos (o el primer cuarto del video cuando Meta no entrega los 3 segundos) ÷ impresiones, por cada video con señal suficiente. Se listan los que quedan por debajo del ${pct(b.hookRateMinimo.valor, 0)} de referencia. La plata es el gasto reciente multiplicado por lo que le falta al gancho para llegar a la referencia.`,
        RUTA.creativos,
      ),
    };
  },
};

export const R06: Regla = {
  id: "R06",
  area: "creativo",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const rotos = activosRecientes(ctx).filter(
      (c) =>
        c.creativo.formato === "video" &&
        c.cuadrante !== "sin_senal" &&
        c.hookRate !== null &&
        c.holdRate !== null &&
        c.hookRate >= b.hookRateMinimo.valor &&
        c.holdRate < b.holdRateMinimo.valor,
    );
    if (rotos.length === 0) return null;
    const plata = rotos.reduce((s, c) => s + gastoReciente(ctx, c.creativo.anuncioId), 0);
    return {
      reglaId: "R06",
      area: "creativo",
      severidad: "media",
      titulo: `${rotos.length} ${rotos.length === 1 ? "video promete" : "videos prometen"} en el gancho lo que el cuerpo no entrega`,
      explicacion:
        "La gente se detiene, pero se va enseguida. El arranque genera una expectativa que el resto del video no cumple. El problema no es la atención: es la continuidad del mensaje.",
      evidencia: rotos.slice(0, 4).flatMap((c) => [
        evPct(`${c.creativo.copyPrincipal.slice(0, 40)}… · gancho`, c.hookRate, RUTA.anuncio(c.creativo.anuncioId)),
        evPct(`${c.creativo.copyPrincipal.slice(0, 40)}… · retención`, c.holdRate, RUTA.anuncio(c.creativo.anuncioId)),
      ]),
      acciones: [
        "Cumplir la promesa del gancho en los siguientes 5 segundos; dejar el contexto para el final.",
        "Recortar el video a la mitad y ver si la retención sube.",
      ],
      plataEnRiesgo: pesos(plata),
      metricas: ["hook_rate", "hold_rate", "caida_25_50"],
      nota: notaUmbral(b.hookRateMinimo, b.holdRateMinimo),
      fuente: fuenteDe(
        ORIGEN.anuncios,
        ctx.ventanas.reciente,
        filasRecientes(ctx).length,
        `Retención = personas que ven el video completo ÷ impresiones. Se listan los videos cuyo gancho supera el ${pct(b.hookRateMinimo.valor, 0)} pero cuya retención queda por debajo del ${pct(b.holdRateMinimo.valor, 0)}. La plata es todo su gasto reciente.`,
        RUTA.creativos,
      ),
    };
  },
};

export const R07: Regla = {
  id: "R07",
  area: "creativo",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const fatigados = activosRecientes(ctx).filter((c) => c.fatiga.indice !== null && c.fatiga.indice >= b.indiceFatigaAlerta.valor);
    if (fatigados.length === 0) return null;
    const plata = fatigados.reduce((s, c) => s + gastoReciente(ctx, c.creativo.anuncioId) * (c.fatiga.indice ?? 0), 0);
    const peor = [...fatigados].sort((a, c) => (c.fatiga.indice ?? 0) - (a.fatiga.indice ?? 0))[0]!;
    return {
      reglaId: "R07",
      area: "creativo",
      severidad: "alta",
      titulo: `${fatigados.length} ${fatigados.length === 1 ? "anuncio se agotó" : "anuncios se agotaron"}: la audiencia ya no reacciona`,
      explicacion:
        "La respuesta al anuncio cayó respecto a su mejor semana y, al mismo tiempo, la misma gente lo está viendo más veces. Eso no es ruido: es agotamiento real. Cada día que sigue corriendo cuesta más y produce menos.",
      evidencia: [
        evNum(`Índice de fatiga · ${peor.creativo.copyPrincipal.slice(0, 40)}…`, peor.fatiga.indice, 2, RUTA.anuncio(peor.creativo.anuncioId)),
        evPct("Respuesta en su mejor semana", peor.fatiga.ctrMejorVentana, RUTA.anuncio(peor.creativo.anuncioId)),
        evPct("Respuesta en la última semana", peor.fatiga.ctrReciente, RUTA.anuncio(peor.creativo.anuncioId)),
        evNum("Frecuencia en su mejor semana", peor.fatiga.frecuenciaMejorVentana, 1, RUTA.anuncio(peor.creativo.anuncioId)),
        evNum("Frecuencia en la última semana", peor.fatiga.frecuenciaReciente, 1, RUTA.anuncio(peor.creativo.anuncioId)),
        ...fatigados.filter((c) => c !== peor).slice(0, 3).map((c) => evNum(`Índice de fatiga · ${c.creativo.copyPrincipal.slice(0, 40)}…`, c.fatiga.indice, 2, RUTA.anuncio(c.creativo.anuncioId))),
      ],
      acciones: [
        "Reemplazar la pieza por una variante con el mismo mensaje y otra apertura visual.",
        "Reducir su presupuesto al 30 % mientras la variante nueva reúne señal.",
        "Registrar la vida útil observada para planear la producción.",
      ],
      plataEnRiesgo: pesos(plata),
      metricas: ["indice_fatiga", "vida_util", "frecuencia"],
      nota: notaUmbral(b.indiceFatigaAlerta),
      fuente: fuenteDe(
        ORIGEN.anuncios,
        ctx.rango,
        ctx.filasAnuncio.length,
        `${peor.fatiga.formulaVisible} Se avisa desde ${b.indiceFatigaAlerta.valor}. La plata es el gasto reciente de cada anuncio multiplicado por su índice.`,
        RUTA.creativos,
      ),
    };
  },
};

export const R08: Regla = {
  id: "R08",
  area: "creativo",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    if (ctx.creativos.length === 0) return null;
    const ultimo = ctx.creativos.map((c) => c.creativo.fechaPrimerGasto).sort().at(-1);
    if (!ultimo) return null;
    const dias = diasEntre(ultimo, ctx.hoy) - 1;
    if (dias <= b.diasSinRenovar.valor) return null;
    return {
      reglaId: "R08",
      area: "creativo",
      severidad: "media",
      titulo: `Hace ${dias} días que no entra un anuncio nuevo`,
      explicacion:
        "Los anuncios se desgastan. Si no hay piezas nuevas en producción, el día que el actual fatigue no habrá reemplazo probado y la cuenta se frena mientras se produce a las carreras.",
      evidencia: [ev("Último anuncio nuevo", ultimo, RUTA.creativos), evNum("Días de referencia sin renovar", b.diasSinRenovar.valor)],
      acciones: ["Producir dos piezas nuevas esta semana a partir de la estructura de los ganadores del mercado (Radar).", "Fijar cadencia: una pieza nueva cada 7-10 días."],
      plataEnRiesgo: null,
      metricas: ["dias_desde_ultimo_nuevo", "ritmo_renovacion"],
      nota: notaUmbral(b.diasSinRenovar),
      fuente: fuenteDe(ORIGEN.creativos, ctx.rango, ctx.creativos.length, `Se toma la fecha del primer gasto más reciente entre todos los anuncios y se cuentan los días hasta hoy (${ctx.hoy}). Se avisa a partir de ${b.diasSinRenovar.valor} días.`, RUTA.creativos),
    };
  },
};

export const R09: Regla = {
  id: "R09",
  area: "creativo",
  evaluar(ctx) {
    const riesgosos = ctx.creativos
      .map((c) => ({ c, r: riesgoPolitica(`${c.creativo.copyPrincipal} ${c.creativo.titular ?? ""} ${c.creativo.descripcion ?? ""}`) }))
      .filter((x) => x.r.riesgo || x.c.creativo.anguloDetectado === "antes_despues");
    if (riesgosos.length === 0) return null;
    const plata = riesgosos.reduce((s, x) => s + gastoReciente(ctx, x.c.creativo.anuncioId), 0);
    return {
      reglaId: "R09",
      area: "creativo",
      severidad: "alta",
      titulo: `${riesgosos.length} ${riesgosos.length === 1 ? "anuncio tiene" : "anuncios tienen"} señales que la plataforma rechaza en salud`,
      explicacion:
        "Antes y después, promesas absolutas y referencias al cuerpo del espectador son terreno minado en publicidad de salud. Un rechazo no solo apaga el anuncio: reinicia el aprendizaje de toda la campaña.",
      evidencia: riesgosos.slice(0, 4).map((x) => ev(x.c.creativo.copyPrincipal.slice(0, 50), x.r.senales.join(", ") || "antes y después", RUTA.anuncio(x.c.creativo.anuncioId))),
      acciones: [
        "Reescribir: hablar del procedimiento y del proceso, no del cuerpo de quien mira.",
        "Reemplazar antes/después por explicación del método o testimonio sin imágenes comparativas.",
      ],
      plataEnRiesgo: pesos(plata),
      metricas: ["riesgo_politica", "anuncios_rechazados"],
      fuente: fuenteDe(
        ORIGEN.creativos,
        ctx.rango,
        ctx.creativos.length,
        "Se lee el texto, el titular y la descripción de cada anuncio buscando frases que las políticas de salud de Meta suelen rechazar: promesas absolutas («elimina», «dile adiós»), referencias al cuerpo de quien mira y comparaciones de antes y después. La plata es el gasto reciente de esos anuncios.",
        RUTA.creativos,
      ),
    };
  },
};

export const R25: Regla = {
  id: "R25",
  area: "creativo",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const tasa = tasaConversacion(ctx.reciente);
    if (tasa === null || tasa >= b.tasaConversacionMinima.valor) return null;
    const clicsPerdidos = ctx.reciente.clicsEnlace - (ctx.reciente.conversacionesIniciadas ?? 0);
    const cpc = ctx.reciente.clicsEnlace > 0 ? ctx.reciente.gasto / ctx.reciente.clicsEnlace : null;
    return {
      reglaId: "R25",
      area: "creativo",
      severidad: "media",
      titulo: `De cada 100 clics, solo ${num(tasa * 100)} terminan en una conversación`,
      explicacion:
        "La gente hace clic pero no escribe. El anuncio genera curiosidad, no intención; o el destino no invita a hablar. Cada clic que no lleva a ninguna parte se pagó completo.",
      evidencia: [
        evNum("Clics de enlace, últimos 14 días", ctx.reciente.clicsEnlace, 0, RUTA.comparacion),
        evNum("Conversaciones iniciadas", ctx.reciente.conversacionesIniciadas, 0, RUTA.comparacion),
        evPct("Tasa de conversación", tasa),
        evCop("Costo por clic de enlace", cpc, RUTA.comparacion),
      ],
      acciones: [
        "Alinear la llamada a la acción con el destino: si el destino es el chat, el anuncio debe decir “escríbenos” y abrir el chat.",
        "Preescribir el primer mensaje del paciente para que solo tenga que enviarlo.",
      ],
      plataEnRiesgo: pesos(cpc === null ? null : clicsPerdidos * cpc * (1 - tasa / b.tasaConversacionMinima.valor)),
      metricas: ["tasa_conversacion", "calidad_clic", "cpc_enlace"],
      nota: notaUmbral(b.tasaConversacionMinima),
      fuente: fuenteDe(
        ORIGEN.nivel(ctx.nivelBase),
        ctx.ventanas.reciente,
        filtrarRango(ctx.filasAnuncio, ctx.ventanas.reciente).length,
        `Tasa de conversación = conversaciones iniciadas ÷ clics de enlace en los últimos 14 días, sumando toda la cuenta. Se avisa por debajo del ${pct(b.tasaConversacionMinima.valor, 0)}.`,
        RUTA.comparacion,
      ),
    };
  },
};

export const R27: Regla = {
  id: "R27",
  area: "creativo",
  evaluar(ctx) {
    // La única comparación con el mercado que entrega Meta: cómo queda cada anuncio frente a los que
    // compiten por el mismo público. Sin ranking no se juzga: dato ausente, no cero.
    const conRanking = activosRecientes(ctx).filter((c) => c.rankingMeta !== null);
    if (conRanking.length === 0) return null;
    const inferiores = conRanking.filter((c) => ES_INFERIOR(c.rankingMeta!.interaccion) || ES_INFERIOR(c.rankingMeta!.conversion));
    if (inferiores.length === 0) return null;
    const plata = inferiores.reduce((s, c) => s + gastoReciente(ctx, c.creativo.anuncioId), 0);
    const fecha = inferiores[0]!.rankingMeta!.fecha;
    return {
      reglaId: "R27",
      area: "creativo",
      severidad: "alta",
      titulo: `${inferiores.length} ${inferiores.length === 1 ? "anuncio está" : "anuncios están"} por debajo de la competencia que pelea el mismo público, según Meta`,
      explicacion:
        "Meta compara cada anuncio con los de otros anunciantes que compiten por las mismas personas y dice si despierta menos interés o convierte menos que ellos. No es una comparación contra la propia cuenta: es contra el mercado. Un anuncio en el tramo inferior paga más caro cada impresión porque la subasta lo castiga.",
      evidencia: inferiores.slice(0, 5).map((c) => {
        const r = c.rankingMeta!;
        return ev(`${c.creativo.copyPrincipal.slice(0, 40) || r.nombre.slice(0, 40)}… · interés / conversión`, `${rankingEnPalabras(r.interaccion)} · ${rankingEnPalabras(r.conversion)}`, RUTA.anuncio(c.creativo.anuncioId));
      }),
      acciones: [
        "En los que están abajo en interés: cambiar la apertura y el formato (vertical, con persona a cámara), no la oferta.",
        "En los que están abajo en conversión: revisar destino y llamada a la acción; si convierte peor que el mercado con el mismo público, la oferta no compite.",
        "Pedirle a Meta el ranking otra vez en 7 días: los anuncios nuevos no tienen dato hasta juntar señal.",
      ],
      plataEnRiesgo: pesos(plata),
      metricas: ["ranking_calidad", "ranking_interaccion", "ranking_conversion"],
      nota: "Meta solo entrega este ranking para anuncios con señal suficiente; los que no aparecen no se juzgan.",
      fuente: fuenteDe(
        "Meta · ranking de cada anuncio frente a los que compiten por el mismo público (últimos 28 días)",
        { desde: fecha, hasta: fecha },
        conRanking.length,
        "Meta clasifica cada anuncio en calidad, tasa de interacción y tasa de conversión frente a anuncios de otros anunciantes que compiten por el mismo público, en tramos (mejor, como la competencia, por debajo del 65 %, 80 % o 90 %). Aquí se listan los activos que caen en un tramo inferior en interés o en conversión. La plata es su gasto de los últimos 14 días.",
        RUTA.creativos,
      ),
    };
  },
};

