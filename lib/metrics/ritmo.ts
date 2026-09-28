/**
 * RITMO DEL DÍA: ¿hoy viene lento o normal? Compara los leads y el gasto de hoy hasta la última
 * hora completa contra el promedio de los días anteriores hasta esa MISMA hora (así una mañana no
 * se compara con un día entero). Datos por hora de Meta (desglose por hora de la cuenta).
 * Leads por hora = conversaciones iniciadas + formularios (Meta no da «Resultados» por hora).
 */
export interface HoraPauta {
  fecha: string;
  /** 0–23, hora de la cuenta publicitaria. */
  hora: number;
  gasto: number;
  leads: number;
}

export interface RitmoDia {
  fecha: string;
  /** Hora en curso: se compara hasta la anterior (la en curso va incompleta). */
  horaActual: number;
  hoy: { gasto: number; leads: number };
  promedio: { gasto: number; leads: number };
  /** hoy ÷ promedio − 1 (−0,3 = 30 % menos). null si no hay con qué comparar. */
  diferencia: number | null;
  diasComparados: number;
  porHora: { hora: number; hoy: number; promedio: number }[];
  /** La hora completa que más leads perdió frente al promedio. */
  horaMasFloja: { hora: number; hoy: number; promedio: number } | null;
  enCurso: { hora: number; gasto: number; leads: number } | null;
}

export function leadsDeAcciones(acciones: ReadonlyArray<{ action_type: string; value: string | number }> | undefined): number {
  if (!acciones) return 0;
  const v = (t: string) => Number(acciones.find((a) => a.action_type === t)?.value ?? 0) || 0;
  return v("onsite_conversion.messaging_conversation_started_7d") + (v("lead") || v("leadgen.other"));
}

export function ritmoDelDia(horas: ReadonlyArray<HoraPauta>, fecha: string, horaActual: number): RitmoDia {
  const anteriores = [...new Set(horas.filter((x) => x.fecha < fecha).map((x) => x.fecha))];
  const n = anteriores.length;
  const suma = (xs: ReadonlyArray<HoraPauta>) => xs.reduce((a, x) => ({ gasto: a.gasto + x.gasto, leads: a.leads + x.leads }), { gasto: 0, leads: 0 });
  const hoyCompletas = horas.filter((x) => x.fecha === fecha && x.hora < horaActual);
  const antesCompletas = horas.filter((x) => x.fecha < fecha && x.hora < horaActual);
  const hoy = suma(hoyCompletas);
  const tot = suma(antesCompletas);
  const promedio = n ? { gasto: tot.gasto / n, leads: tot.leads / n } : { gasto: 0, leads: 0 };
  const porHora = Array.from({ length: horaActual }, (_, hora) => ({
    hora,
    hoy: suma(hoyCompletas.filter((x) => x.hora === hora)).leads,
    promedio: n ? suma(antesCompletas.filter((x) => x.hora === hora)).leads / n : 0,
  }));
  const floja = n ? [...porHora].sort((a, b) => b.promedio - b.hoy - (a.promedio - a.hoy))[0] : undefined;
  const actual = horas.filter((x) => x.fecha === fecha && x.hora === horaActual);
  return {
    fecha,
    horaActual,
    hoy,
    promedio,
    diferencia: n && promedio.leads > 0 ? hoy.leads / promedio.leads - 1 : null,
    diasComparados: n,
    porHora,
    horaMasFloja: floja && floja.promedio - floja.hoy > 0 ? floja : null,
    enCurso: actual.length ? { hora: horaActual, ...suma(actual) } : null,
  };
}
