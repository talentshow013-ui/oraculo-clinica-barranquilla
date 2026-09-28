/**
 * RITMO DEL DÍA: ¿hoy viene lento o normal? Compara los leads y el gasto de hoy hasta la última
 * hora completa contra los días anteriores hasta esa MISMA hora (así una mañana no se compara con
 * un día entero): la MEDIANA de los días anteriores (un día atípico no la infla) y el mismo día de
 * la semana (los lunes arrancan lentos). Datos por hora de Meta (desglose por hora de la cuenta).
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
  /** Lo normal a esta hora: mediana de los días anteriores. */
  promedio: { gasto: number; leads: number };
  /** El mismo día de la semana (la semana pasada, o el promedio si hay varias) a esta hora. */
  mismoDia: { gasto: number; leads: number; dias: number } | null;
  /** hoy ÷ lo normal − 1 (−0,3 = 30 % menos). null si no hay con qué comparar. */
  diferencia: number | null;
  /** hoy ÷ mismo día de la semana − 1. */
  diferenciaMismoDia: number | null;
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
  const mediana = (xs: number[]) => {
    const o = [...xs].sort((a, b) => a - b);
    return o.length ? (o.length % 2 ? o[(o.length - 1) / 2]! : (o[o.length / 2 - 1]! + o[o.length / 2]!) / 2) : 0;
  };
  const porDia = anteriores.map((f) => ({ fecha: f, ...suma(antesCompletas.filter((x) => x.fecha === f)) }));
  const promedio = n ? { gasto: mediana(porDia.map((d) => d.gasto)), leads: mediana(porDia.map((d) => d.leads)) } : { gasto: 0, leads: 0 };
  const dia = (f: string) => new Date(`${f}T12:00:00Z`).getUTCDay();
  const iguales = porDia.filter((d) => dia(d.fecha) === dia(fecha));
  const mismoDia = iguales.length ? { gasto: iguales.reduce((a, d) => a + d.gasto, 0) / iguales.length, leads: iguales.reduce((a, d) => a + d.leads, 0) / iguales.length, dias: iguales.length } : null;
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
    mismoDia,
    diferencia: n && promedio.leads > 0 ? hoy.leads / promedio.leads - 1 : null,
    diferenciaMismoDia: mismoDia && mismoDia.leads > 0 ? hoy.leads / mismoDia.leads - 1 : null,
    diasComparados: n,
    porHora,
    horaMasFloja: floja && floja.promedio - floja.hoy > 0 ? floja : null,
    enCurso: actual.length ? { hora: horaActual, ...suma(actual) } : null,
  };
}
