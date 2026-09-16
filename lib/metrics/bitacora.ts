/**
 * Lectura de la bitácora: quién cambió qué, y qué campañas se prenden y apagan a cada rato.
 * Cada apagado/prendido reinicia el aprendizaje de la plataforma; contarlos es contar plata.
 */
import type { CambioCuenta, ObjetoCambio, Rango } from "@/lib/adapters/types";
import { semanaISO } from "@/lib/format/fechas";

export interface ActorBitacora {
  actor: string;
  cambios: number;
  apagados: number;
  prendidos: number;
}

export interface Interruptor {
  objetoId: string;
  objetoTipo: ObjetoCambio;
  nombre: string;
  campanaId: string | null;
  apagados: number;
  prendidos: number;
  actores: string[];
  ultimo: string;
}

export interface SemanaBitacora {
  semana: string;
  cambios: number;
  actores: number;
}

export interface ResumenBitacora {
  desde: string;
  hasta: string;
  total: number;
  porActor: ActorBitacora[];
  /** Campañas y conjuntos con más prendidos/apagados en el rango, de más a menos. */
  interruptores: Interruptor[];
  personasAgregadas: number;
  personasEliminadas: number;
  porSemana: SemanaBitacora[];
}

const enRango = (c: CambioCuenta, r: Rango) => c.fecha >= r.desde && c.fecha <= r.hasta;

export function resumirBitacora(cambios: ReadonlyArray<CambioCuenta>, rango: Rango): ResumenBitacora {
  const lista = cambios.filter((c) => enRango(c, rango));
  const actores = new Map<string, ActorBitacora>();
  const objetos = new Map<string, Interruptor>();
  const semanas = new Map<string, { cambios: number; actores: Set<string> }>();
  let agregadas = 0;
  let eliminadas = 0;
  for (const c of lista) {
    const a = actores.get(c.actor) ?? { actor: c.actor, cambios: 0, apagados: 0, prendidos: 0 };
    a.cambios++;
    if (c.accion === "apagar") a.apagados++;
    if (c.accion === "prender") a.prendidos++;
    actores.set(c.actor, a);
    if (c.accion === "persona_agregada") agregadas++;
    if (c.accion === "persona_eliminada") eliminadas++;
    const sem = semanas.get(semanaISO(c.fecha)) ?? { cambios: 0, actores: new Set<string>() };
    sem.cambios++;
    sem.actores.add(c.actor);
    semanas.set(semanaISO(c.fecha), sem);
    if ((c.objetoTipo === "campana" || c.objetoTipo === "conjunto") && (c.accion === "apagar" || c.accion === "prender")) {
      const clave = `${c.objetoTipo}|${c.objetoId}`;
      const o = objetos.get(clave) ?? { objetoId: c.objetoId, objetoTipo: c.objetoTipo, nombre: c.objetoNombre, campanaId: c.objetoTipo === "campana" ? c.objetoId : c.campanaId, apagados: 0, prendidos: 0, actores: [], ultimo: c.fecha };
      if (c.accion === "apagar") o.apagados++;
      else o.prendidos++;
      if (!o.actores.includes(c.actor)) o.actores.push(c.actor);
      if (c.fecha > o.ultimo) o.ultimo = c.fecha;
      objetos.set(clave, o);
    }
  }
  return {
    desde: rango.desde,
    hasta: rango.hasta,
    total: lista.length,
    porActor: [...actores.values()].sort((x, y) => y.cambios - x.cambios),
    interruptores: [...objetos.values()].sort((x, y) => y.apagados + y.prendidos - (x.apagados + x.prendidos)),
    personasAgregadas: agregadas,
    personasEliminadas: eliminadas,
    porSemana: [...semanas.entries()].map(([semana, s]) => ({ semana, cambios: s.cambios, actores: s.actores.size })).sort((x, y) => x.semana.localeCompare(y.semana)),
  };
}

/** Campañas que se prendieron y apagaron `minimo` veces o más en el rango: reinicios de aprendizaje. */
export function campanasInterruptor(cambios: ReadonlyArray<CambioCuenta>, rango: Rango, minimo = 3): Interruptor[] {
  return resumirBitacora(cambios, rango).interruptores.filter((i) => i.objetoTipo === "campana" && i.apagados + i.prendidos >= minimo);
}
