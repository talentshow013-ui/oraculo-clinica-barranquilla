/**
 * Las 28 reglas de diagnóstico. Orden por id; el motor ordena la salida por plata.
 */
import type { Regla } from "@/lib/diagnostics/engine";
import { R01, R02, R03, R21 } from "./entrega";
import { R04, R05, R06, R07, R08, R09, R25, R27 } from "./creativo";
import { R10, R11, R12, R13 } from "./audiencia";
import { R14, R15, R16, R18 } from "./embudo";
import { R17, R19, R20, R26, R28 } from "./operacion";
import { R22, R23, R24 } from "./datos";

export const REGLAS: ReadonlyArray<Regla> = [
  R01, R02, R03, R04, R05, R06, R07, R08, R09, R10, R11, R12, R13,
  R14, R15, R16, R17, R18, R19, R20, R21, R22, R23, R24, R25, R26, R27, R28,
];

const POR_ID = new Map(REGLAS.map((r) => [r.id, r]));

export function reglaPorId(id: string): Regla {
  const r = POR_ID.get(id);
  if (!r) throw new Error(`Regla desconocida: ${id}`);
  return r;
}

export const NOMBRE_REGLA: Record<string, string> = {
  R01: "Saturación de audiencia",
  R02: "Presión de subasta",
  R03: "Concentración de inversión",
  R04: "Portafolio creativo insuficiente",
  R05: "Gancho débil",
  R06: "El gancho promete lo que el cuerpo no entrega",
  R07: "Fatiga creativa",
  R08: "Sin renovación creativa",
  R09: "Riesgo de política del sector salud",
  R10: "Inversión fuera del radio",
  R11: "Segmento que consume sin producir",
  R12: "Franja horaria improductiva",
  R13: "Conjuntos compitiendo entre sí",
  R14: "Cuello de botella en agenda",
  R15: "Inasistencia a citas",
  R16: "Cierre bajo en consultorio",
  R17: "Conversaciones sin responder",
  R18: "Caída semanal en el embudo",
  R19: "CAC por encima del margen",
  R20: "Servicio vendido a pérdida",
  R21: "Presupuesto insuficiente para aprender",
  R22: "Retorno no verificable",
  R23: "Huecos en los datos",
  R24: "El mercado prueba más rápido",
  R25: "Clics que no llevan a ninguna parte",
  R26: "La página no alcanza a cargar",
  R27: "Por debajo de la competencia en subasta (según Meta)",
  R28: "Campañas que se prenden y apagan a cada rato",
};
