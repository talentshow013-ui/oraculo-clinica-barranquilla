/**
 * Reglas creativas: R04 portafolio, R05 gancho, R06 gancho que no cumple, R07 fatiga,
 * R08 sin renovación, R09 riesgo de política, R25 clics que no llevan a ninguna parte.
 */
import type { Regla } from "@/lib/diagnostics/engine";
import type { EvaluacionCreativo } from "@/lib/metrics/creative";
import { agregar, filtrarRango, tasaConversacion } from "@/lib/metrics/core";
import { riesgoPolitica } from "@/lib/competitive/angles";
import { diasEntre } from "@/lib/format/fechas";
import { num } from "@/lib/format";
import { ev, evCop, evNum, evPct, notaUmbral, pesos } from "./util";

/** Creativos con gasto en la ventana reciente. */
function activosRecientes(ctx: Parameters<Regla["evaluar"]>[0]): EvaluacionCreativo[] {
  const ids = new Set(filtrarRango(ctx.filasAnuncio, ctx.ventanas.reciente).filter((f) => f.gasto > 0).map((f) => f.id));
  return ctx.creativos.filter((c) => ids.has(c.creativo.anuncioId));
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
      titulo: `Solo ${activos.length} ${activos.length === 1 ? "anuncio activo" : "anuncios activos"}: no se está probando nada`,
      explicacion:
        "Con menos de tres piezas compitiendo no hay comparación posible: no se sabe si el resultado es bueno o malo porque no hay contra qué medirlo. Sin prueba no hay aprendizaje, y sin aprendizaje la cuenta no mejora.",
      evidencia: [evNum("Anuncios con gasto en los últimos 14 días", activos.length), evNum("Mínimo para probar", b.creativosActivosMinimo.valor)],
      acciones: [
        "Lanzar al menos dos variantes más del mejor anuncio: cambiar solo el gancho en una y solo la oferta en otra.",
        "Definir un calendario de producción: una pieza nueva por semana como mínimo.",
      ],
      plataEnRiesgo: null,
      metricas: ["creativos_activos", "ritmo_renovacion"],
      nota: notaUmbral(b.creativosActivosMinimo),
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
      evidencia: debiles.slice(0, 4).map((c) => evPct(`${c.creativo.copyPrincipal.slice(0, 40)}… · gancho`, c.hookRate)),
      acciones: [
        "Cambiar solo los primeros 3 segundos: empezar con la pregunta o el resultado, no con el logo.",
        "Probar apertura con la persona hablando a cámara y texto en pantalla desde el segundo 0.",
      ],
      plataEnRiesgo: pesos(plata),
      metricas: ["hook_rate", "costo_3s"],
      nota: notaUmbral(b.hookRateMinimo),
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
        evPct(`${c.creativo.copyPrincipal.slice(0, 40)}… · gancho`, c.hookRate),
        evPct(`${c.creativo.copyPrincipal.slice(0, 40)}… · retención`, c.holdRate),
      ]),
      acciones: [
        "Cumplir la promesa del gancho en los siguientes 5 segundos; dejar el contexto para el final.",
        "Recortar el video a la mitad y ver si la retención sube.",
      ],
      plataEnRiesgo: pesos(plata),
      metricas: ["hook_rate", "hold_rate", "caida_25_50"],
      nota: notaUmbral(b.hookRateMinimo, b.holdRateMinimo),
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
        evNum(`Índice de fatiga · ${peor.creativo.copyPrincipal.slice(0, 40)}…`, peor.fatiga.indice, 2),
        evPct("Respuesta en su mejor semana", peor.fatiga.ctrMejorVentana),
        evPct("Respuesta en la última semana", peor.fatiga.ctrReciente),
        evNum("Frecuencia en su mejor semana", peor.fatiga.frecuenciaMejorVentana, 1),
        evNum("Frecuencia en la última semana", peor.fatiga.frecuenciaReciente, 1),
      ],
      acciones: [
        "Reemplazar la pieza por una variante con el mismo mensaje y otra apertura visual.",
        "Reducir su presupuesto al 30 % mientras la variante nueva reúne señal.",
        "Registrar la vida útil observada para planear la producción.",
      ],
      plataEnRiesgo: pesos(plata),
      metricas: ["indice_fatiga", "vida_util", "frecuencia"],
      nota: notaUmbral(b.indiceFatigaAlerta),
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
      evidencia: [ev("Último anuncio nuevo", ultimo), evNum("Días de referencia sin renovar", b.diasSinRenovar.valor)],
      acciones: ["Producir dos piezas nuevas esta semana a partir de la estructura de los ganadores del mercado (Radar).", "Fijar cadencia: una pieza nueva cada 7-10 días."],
      plataEnRiesgo: null,
      metricas: ["dias_desde_ultimo_nuevo", "ritmo_renovacion"],
      nota: notaUmbral(b.diasSinRenovar),
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
      evidencia: riesgosos.slice(0, 4).map((x) => ev(x.c.creativo.copyPrincipal.slice(0, 50), x.r.senales.join(", ") || "antes y después")),
      acciones: [
        "Reescribir: hablar del procedimiento y del proceso, no del cuerpo de quien mira.",
        "Reemplazar antes/después por explicación del método o testimonio sin imágenes comparativas.",
      ],
      plataEnRiesgo: pesos(plata),
      metricas: ["riesgo_politica", "anuncios_rechazados"],
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
        evNum("Clics de enlace, últimos 14 días", ctx.reciente.clicsEnlace),
        evNum("Conversaciones iniciadas", ctx.reciente.conversacionesIniciadas),
        evPct("Tasa de conversación", tasa),
        evCop("Costo por clic de enlace", cpc),
      ],
      acciones: [
        "Alinear la llamada a la acción con el destino: si el destino es el chat, el anuncio debe decir “escríbenos” y abrir el chat.",
        "Preescribir el primer mensaje del paciente para que solo tenga que enviarlo.",
      ],
      plataEnRiesgo: pesos(cpc === null ? null : clicsPerdidos * cpc * (1 - tasa / b.tasaConversacionMinima.valor)),
      metricas: ["tasa_conversacion", "calidad_clic", "cpc_enlace"],
      nota: notaUmbral(b.tasaConversacionMinima),
    };
  },
};
