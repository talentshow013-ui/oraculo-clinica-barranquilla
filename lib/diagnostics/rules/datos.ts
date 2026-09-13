/**
 * Reglas de datos y competencia: R22 retorno no verificable, R23 huecos, R24 el mercado prueba más rápido.
 */
import type { Regla } from "@/lib/diagnostics/engine";
import { diasEntre, sumarDias } from "@/lib/format/fechas";
import { pct } from "@/lib/format";
import { ev, evNum, evPct, notaUmbral } from "./util";

export const R22: Regla = {
  id: "R22",
  area: "datos",
  evaluar(ctx) {
    const b = ctx.benchmarks;
    const dias = diasEntre(ctx.rango.desde, ctx.rango.hasta);
    const conVenta = new Set(ctx.lote.embudo.filter((r) => r.paso === "cita_asistida" || r.paso === "venta").map((r) => r.fecha));
    const cobertura = conVenta.size / Math.max(1, dias);
    if (cobertura >= b.coberturaVentasMinima.valor) return null;
    return {
      reglaId: "R22",
      area: "datos",
      severidad: "alta",
      titulo:
        conVenta.size === 0
          ? "No hay datos de agenda ni ventas: el retorno que se ve es el que declara la plataforma"
          : `Solo ${pct(cobertura, 0)} de los días tienen datos de agenda y ventas`,
      explicacion:
        "Sin registros de citas asistidas y procedimientos vendidos, el panel no puede decir si la pauta gana o pierde plata. Lo que muestra la plataforma es su propia versión, con su propia ventana de atribución. La cifra de caja solo la tiene la clínica.",
      evidencia: [evNum("Días del periodo", dias), evNum("Días con registros de agenda/ventas", conVenta.size), evPct("Cobertura", cobertura)],
      acciones: [
        "Registrar semanalmente citas agendadas, asistidas y procedimientos vendidos (cantidad y valor), sin datos de pacientes.",
        "Cargar al menos 60 días de historia para que el retorno real tenga sentido.",
      ],
      plataEnRiesgo: null,
      metricas: ["cobertura_datos_venta", "roas_real", "indice_discrepancia"],
      nota: notaUmbral(b.coberturaVentasMinima),
    };
  },
};

export const R23: Regla = {
  id: "R23",
  area: "datos",
  evaluar(ctx) {
    if (ctx.huecos.length === 0) return null;
    const lista = ctx.huecos.slice(0, 10).join(", ") + (ctx.huecos.length > 10 ? ` y ${ctx.huecos.length - 10} más` : "");
    return {
      reglaId: "R23",
      area: "datos",
      severidad: "media",
      titulo: `Faltan ${ctx.huecos.length} ${ctx.huecos.length === 1 ? "día" : "días"} de datos en el periodo`,
      explicacion:
        "Un día sin datos se ve igual que un día sin resultados, y eso puede simular una caída que nunca ocurrió. Antes de concluir nada sobre una baja, hay que mirar si coincide con un hueco.",
      evidencia: [ev("Días sin datos", lista), evNum("Total de huecos", ctx.huecos.length)],
      acciones: ["Actualizar los datos del periodo completo antes de la próxima revisión.", "Si el hueco es real (pauta apagada), registrarlo como decisión para que no se lea como problema."],
      plataEnRiesgo: null,
      metricas: ["huecos_datos", "cobertura_periodo"],
    };
  },
};

export const R24: Regla = {
  id: "R24",
  area: "competencia",
  evaluar(ctx) {
    const anuncios = ctx.lote.anunciosCompetencia;
    if (anuncios.length === 0) return null;
    const desde = sumarDias(ctx.hoy, -27);
    const semanas = 4;
    const nuevosCompetencia = anuncios.filter((a) => a.primeraVez >= desde);
    const competidores = new Set(anuncios.map((a) => a.competidorId)).size || 1;
    const cadenciaCompetencia = nuevosCompetencia.length / semanas / competidores;
    const nuevosPropios = ctx.creativos.filter((c) => c.creativo.fechaPrimerGasto >= desde).length;
    const cadenciaPropia = nuevosPropios / semanas;
    if (cadenciaPropia >= cadenciaCompetencia) return null;
    return {
      reglaId: "R24",
      area: "competencia",
      severidad: "media",
      titulo: `La competencia lanza ${cadenciaCompetencia.toFixed(1)} anuncios nuevos por semana; la cuenta, ${cadenciaPropia.toFixed(1)}`,
      explicacion:
        "El que prueba más rápido aprende más rápido y encuentra primero el mensaje que funciona. No es cuestión de gastar más: es cuestión de producir y probar con una cadencia que el mercado ya está sosteniendo.",
      evidencia: [
        evNum("Anuncios nuevos de la competencia, últimas 4 semanas", nuevosCompetencia.length),
        evNum("Competidores observados", competidores),
        evNum("Anuncios nuevos propios, últimas 4 semanas", nuevosPropios),
      ],
      acciones: [
        "Fijar cadencia mínima igual a la de la competencia y planear la producción con dos semanas de anticipación.",
        "Usar los espacios vacíos del Radar para que cada pieza nueva ataque una combinación que nadie está usando.",
      ],
      plataEnRiesgo: null,
      metricas: ["brecha_cadencia", "cadencia_competencia", "ritmo_renovacion"],
    };
  },
};
