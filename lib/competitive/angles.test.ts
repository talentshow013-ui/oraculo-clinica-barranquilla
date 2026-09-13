import { describe, expect, test } from "vitest";
import { clasificarAngulo, nivelConscienciaTexto, riesgoPolitica, DICCIONARIO_ANGULOS } from "@/lib/competitive/angles";
import { ANGULOS } from "@/lib/adapters/types";

describe("clasificarAngulo — determinista y transparente", () => {
  test("cubre los 14 ángulos del contrato", () => {
    for (const a of ANGULOS) {
      if (a === "sin_clasificar") continue;
      expect(DICCIONARIO_ANGULOS[a], a).toBeDefined();
      expect(DICCIONARIO_ANGULOS[a].length, a).toBeGreaterThan(2);
    }
  });

  test("autoridad médica con señales visibles", () => {
    const r = clasificarAngulo("Procedimiento realizado por médico estético certificado con 15 años de experiencia");
    expect(r.angulo).toBe("autoridad_medica");
    expect(r.senales.length).toBeGreaterThan(0);
    expect(r.confianza).toBeGreaterThan(0);
  });

  test("promoción con precio", () => {
    expect(clasificarAngulo("Toxina botulínica desde $350.000. Promoción de septiembre, 30 % de descuento").angulo).toBe("promocion");
  });

  test("objeción de dolor", () => {
    expect(clasificarAngulo("¿Te da miedo que duela? Nuestra técnica es sin dolor y sin agujas visibles").angulo).toBe("objecion_dolor");
  });

  test("testimonio", () => {
    expect(clasificarAngulo("Laura nos cuenta su experiencia: 'me cambió la vida, volvería mil veces'").angulo).toBe("testimonio");
  });

  test("sin señales → sin_clasificar con confianza 0", () => {
    const r = clasificarAngulo("Hola");
    expect(r.angulo).toBe("sin_clasificar");
    expect(r.confianza).toBe(0);
  });

  test("misma entrada, misma salida", () => {
    const t = "Agenda hoy: cupos limitados esta semana";
    expect(clasificarAngulo(t)).toEqual(clasificarAngulo(t));
  });
});

describe("nivel de consciencia (Schwartz)", () => {
  test("promoción con precio habla al más consciente (5)", () => {
    expect(nivelConscienciaTexto("Toxina $350.000 solo hoy, agenda ya")).toBe(5);
  });
  test("educativo habla a quien apenas reconoce el problema (2)", () => {
    expect(nivelConscienciaTexto("¿Sabías que las líneas de expresión aparecen por la repetición del gesto? Te explicamos")).toBeLessThanOrEqual(2);
  });
});

describe("riesgoPolitica — publicidad de salud", () => {
  test("antes y después es riesgo", () => {
    const r = riesgoPolitica("Mira el antes y después de nuestra paciente");
    expect(r.riesgo).toBe(true);
    expect(r.senales.some((s) => /antes/i.test(s))).toBe(true);
  });
  test("promesas absolutas son riesgo", () => {
    expect(riesgoPolitica("Resultados garantizados, elimina la grasa para siempre").riesgo).toBe(true);
  });
  test("referencias negativas al cuerpo del espectador son riesgo", () => {
    expect(riesgoPolitica("¿Cansada de tu papada y tu barriga?").riesgo).toBe(true);
  });
  test("un texto educativo limpio no es riesgo", () => {
    expect(riesgoPolitica("Te explicamos cómo funciona la toxina botulínica y qué esperar de la valoración").riesgo).toBe(false);
  });
});
