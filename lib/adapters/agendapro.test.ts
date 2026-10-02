import { describe, expect, test } from "vitest";
import { validarSinPII } from "@/lib/privacy";
import { agregarAgenda, citaDesdeApi, combinarConKommo, fusionarAgendaEnLote, fusionarCitas, PASO_DE_ESTADO, type LoteAgenda } from "./agendapro";

const cruda = (p: Record<string, unknown>) => ({
  id: 1, service_provider_id: 9, service_id: 7, location_id: 3, price: 500000, status_id: 3, payment_id: null,
  notes: "nota con datos", company_comment: "x", service: "Ultrahifu", service_provider: "Dra. Gisella", location: "Vivante",
  status: "Asiste", start: "2026-09-20T16:00:00.000Z", end: "2026-09-20T17:00:00.000Z", is_session: false,
  created_date: "2026-09-10T13:15:32.280Z", client: { first_name: "Ana", phone: "300", email: "a@b.co" }, ...p,
});

describe("agendapro · una cita sin datos de la paciente", () => {
  test("se queda solo con lo agregable y pasa el guardián de privacidad", () => {
    const c = citaDesdeApi(cruda({}));
    expect(c).toEqual({ id: 1, fecha: "2026-09-20", hora: 11, creada: "2026-09-10", estado: "Asiste", servicio: "Ultrahifu", profesional: "Dra. Gisella", sede: "Vivante", precio: 500000 });
    expect(() => validarSinPII({ citas: [c] })).not.toThrow();
    expect(JSON.stringify(c)).not.toMatch(/Ana|300|a@b|nota/);
  });
  test("la fecha es la de Bogotá (una cita a las 8 p. m. no se pasa al día siguiente)", () => {
    expect(citaDesdeApi(cruda({ start: "2026-09-21T01:00:00.000Z" })).fecha).toBe("2026-09-20");
  });
  test("estados → pasos del embudo", () => {
    expect(PASO_DE_ESTADO["Asiste"]).toBe("cita_asistida");
    expect(PASO_DE_ESTADO["Cancelado"]).toBeNull();
    expect(PASO_DE_ESTADO["No Asiste"]).toBe("cita_agendada");
  });
});

describe("agendapro · agregado por día", () => {
  const citas = [
    citaDesdeApi(cruda({ id: 1 })),
    citaDesdeApi(cruda({ id: 2, status: "No Asiste", price: 300000 })),
    citaDesdeApi(cruda({ id: 3, status: "Cancelado" })),
    citaDesdeApi(cruda({ id: 4, status: "Reservado", start: "2026-10-30T16:00:00.000Z" })),
  ];
  const r = agregarAgenda(citas, "2026-09-25");
  test("agendadas = todas menos canceladas; asistidas = Asiste con su valor; el futuro no entra", () => {
    const ag = r.filter((x) => x.paso === "cita_agendada");
    const as = r.filter((x) => x.paso === "cita_asistida");
    expect(ag.reduce((a, x) => a + x.cantidad, 0)).toBe(2);
    expect(as).toHaveLength(1);
    expect(as[0]).toMatchObject({ fecha: "2026-09-20", cantidad: 1, valorCOP: 500000, servicio: "Ultrahifu", sede: "Vivante", fuenteAtribuida: "desconocido", campanaId: null });
    expect(r.every((x) => x.fecha <= "2026-09-25")).toBe(true);
  });
});

describe("agendapro · fusión", () => {
  test("una cita que cambia de estado reemplaza a la vieja (por id)", () => {
    const vieja = citaDesdeApi(cruda({ id: 5, status: "Reservado" }));
    const nueva = citaDesdeApi(cruda({ id: 5, status: "Asiste" }));
    const f = fusionarCitas([vieja, citaDesdeApi(cruda({ id: 6 }))], [nueva]);
    expect(f).toHaveLength(2);
    expect(f.find((c) => c.id === 5)!.estado).toBe("Asiste");
  });
  const agenda: LoteAgenda = { citas: [citaDesdeApi(cruda({}))], meta: { capturadoEn: "2026-09-25T10:00:00Z", desde: "2026-06-01", hasta: "2026-09-25", origen: "agendapro", avisos: [] } };
  const reg = (paso: "lead_calificado" | "cita_agendada" | "cita_asistida" | "venta") => ({ fecha: "2026-09-20", campanaId: null, fuenteAtribuida: "desconocido" as const, paso, cantidad: 4, valorCOP: null, servicio: null, sede: null, nRegistros: 4 });
  test("en el lote, la agenda manda en citas: se quitan las citas que venían de Kommo, se quedan leads y ventas", () => {
    const lote = { insights: [], embudo: [reg("lead_calificado"), reg("cita_agendada"), reg("cita_asistida"), reg("venta")], meta: { advertencias: [] } } as never;
    const r = fusionarAgendaEnLote(lote, agenda, "2026-09-25") as unknown as { embudo: { paso: string; cantidad: number }[] };
    expect(r.embudo.filter((x) => x.paso === "cita_agendada").reduce((a, x) => a + x.cantidad, 0)).toBe(1);
    expect(r.embudo.filter((x) => x.paso === "lead_calificado")).toHaveLength(1);
    expect(r.embudo.filter((x) => x.paso === "venta")).toHaveLength(1);
  });
  test("para Pacientes: leads de Kommo + citas de la agenda", () => {
    const kommo = { etapas: [], embudo: [reg("lead_calificado"), reg("cita_agendada")], meta: { capturadoEn: "x", desde: "2026-06-01", hasta: "2026-09-25", origen: "kommo" as const, leads: 4, avisos: [] } };
    const c = combinarConKommo(kommo, agenda, "2026-09-25")!;
    expect(c.embudo.filter((x) => x.paso === "lead_calificado")[0]!.cantidad).toBe(4);
    expect(c.embudo.filter((x) => x.paso === "cita_agendada").reduce((a, x) => a + x.cantidad, 0)).toBe(1);
    expect(c.meta.avisos.join(" ")).toMatch(/AgendaPro/);
  });
});
