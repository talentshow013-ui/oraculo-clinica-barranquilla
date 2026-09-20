import { describe, expect, test } from "vitest";
import { RegistroEmbudoSchema } from "./types";
import { clasificarEtapa, fuenteDeLead, agregarLeads, sincronizarKommo, type PeticionKommo, type EtapaKommo } from "./kommo";
import { validarSinPII } from "@/lib/privacy";

const etapas: EtapaKommo[] = [
  { id: 1, nombre: "Nuevo lead", pipelineId: 10, tipo: "normal", orden: 1 },
  { id: 2, nombre: "Contactado", pipelineId: 10, tipo: "normal", orden: 2 },
  { id: 3, nombre: "Cita agendada", pipelineId: 10, tipo: "normal", orden: 3 },
  { id: 4, nombre: "Asistió a valoración", pipelineId: 10, tipo: "normal", orden: 4 },
  { id: 142, nombre: "Venta exitosa", pipelineId: 10, tipo: "ganado", orden: 99 },
  { id: 143, nombre: "Perdido", pipelineId: 10, tipo: "perdido", orden: 100 },
];

describe("Kommo · etapas → pasos del embudo", () => {
  test("por nombre (cita, asistió, venta) y por tipo (ganado)", () => {
    expect(clasificarEtapa(etapas[0]!)).toBe("lead_calificado");
    expect(clasificarEtapa(etapas[2]!)).toBe("cita_agendada");
    expect(clasificarEtapa(etapas[3]!)).toBe("cita_asistida");
    expect(clasificarEtapa(etapas[4]!)).toBe("venta");
    expect(clasificarEtapa(etapas[5]!)).toBeNull();
  });
  test("la configuración manual gana sobre el nombre", () => {
    expect(clasificarEtapa(etapas[1]!, { 2: "cita_agendada" })).toBe("cita_agendada");
  });
});

describe("Kommo · fuente del lead", () => {
  test("utm y nombre de la fuente → meta/tiktok/organico/referido/directo/desconocido", () => {
    expect(fuenteDeLead({ utm_source: "facebook", utm_medium: "cpc" })).toBe("meta");
    expect(fuenteDeLead({ utm_source: "ig", utm_medium: "paid" })).toBe("meta");
    expect(fuenteDeLead({ utm_source: "tiktok" })).toBe("tiktok");
    expect(fuenteDeLead({ utm_source: "instagram", utm_medium: "social" })).toBe("organico");
    expect(fuenteDeLead({ fuente: "Referido" })).toBe("referido");
    expect(fuenteDeLead({ fuente: "Sitio web" })).toBe("directo");
    expect(fuenteDeLead({})).toBe("desconocido");
  });
});

describe("Kommo · leads → registros de embudo agregados (sin personas)", () => {
  const leads = [
    { id: 1, creado: "2026-09-10", etapaId: 1, pipelineId: 10, precio: 0, fuente: "meta" as const, cerradoEn: null, campanaId: "120247008275110151" },
    { id: 2, creado: "2026-09-10", etapaId: 3, pipelineId: 10, precio: 0, fuente: "meta" as const, cerradoEn: null, campanaId: "120247008275110151" },
    { id: 3, creado: "2026-09-10", etapaId: 142, pipelineId: 10, precio: 850000, fuente: "meta" as const, cerradoEn: "2026-09-12", campanaId: "120247008275110151" },
    { id: 4, creado: "2026-09-11", etapaId: 4, pipelineId: 10, precio: 0, fuente: "organico" as const, cerradoEn: null, campanaId: null },
    { id: 5, creado: "2026-09-11", etapaId: 143, pipelineId: 10, precio: 0, fuente: "meta" as const, cerradoEn: "2026-09-11", campanaId: null },
  ];
  test("cada lead cuenta en su paso y en todos los anteriores; la venta lleva valor y fecha de cierre", () => {
    const reg = agregarLeads(leads, etapas, {});
    for (const r of reg) expect(RegistroEmbudoSchema.safeParse(r).success).toBe(true);
    const busca = (fecha: string, paso: string, fuente: string, campanaId: string | null) => reg.find((r) => r.fecha === fecha && r.paso === paso && r.fuenteAtribuida === fuente && r.campanaId === campanaId);
    expect(busca("2026-09-10", "lead_calificado", "meta", "120247008275110151")?.cantidad).toBe(3);
    expect(busca("2026-09-10", "cita_agendada", "meta", "120247008275110151")?.cantidad).toBe(2);
    expect(busca("2026-09-12", "venta", "meta", "120247008275110151")).toMatchObject({ cantidad: 1, valorCOP: 850000 });
    expect(busca("2026-09-11", "cita_asistida", "organico", null)?.cantidad).toBe(1);
    expect(busca("2026-09-11", "lead_calificado", "meta", null)?.cantidad).toBe(1); // el perdido sí fue lead
  });
  test("nunca sale un nombre, teléfono ni id de persona", () => {
    const reg = agregarLeads(leads, etapas, {});
    expect(() => validarSinPII(reg)).not.toThrow();
    expect(JSON.stringify(reg)).not.toMatch(/"id":|telefono|nombre/);
  });
});

describe("Kommo · sincronización", () => {
  test("pipelines + leads paginados con utm y campaña; lote de embudo", async () => {
    const pedir: PeticionKommo = async (ruta, params) => {
      if (ruta === "/api/v4/leads/pipelines") return { _embedded: { pipelines: [{ id: 10, name: "Ventas", _embedded: { statuses: etapas.map((e) => ({ id: e.id, name: e.nombre, sort: e.orden, type: e.tipo === "ganado" ? 1 : e.tipo === "perdido" ? 2 : 0, pipeline_id: 10 })) } }] } };
      if (ruta === "/api/v4/leads") {
        const page = Number(params?.page ?? 1);
        if (page > 1) return { _embedded: { leads: [] } };
        return { _embedded: { leads: [
          { id: 900, name: "Lead Fulana", price: 0, status_id: 3, pipeline_id: 10, created_at: 1789000000, closed_at: null, custom_fields_values: [{ field_code: "UTM_SOURCE", values: [{ value: "facebook" }] }, { field_code: "UTM_MEDIUM", values: [{ value: "cpc" }] }, { field_code: "UTM_CAMPAIGN", values: [{ value: "120247008275110151" }] }], _embedded: { contacts: [{ id: 5 }] } },
          { id: 901, name: "Lead Mengano", price: 500000, status_id: 142, pipeline_id: 10, created_at: 1789000000, closed_at: 1789100000, custom_fields_values: null },
        ] } };
      }
      return {};
    };
    const lote = await sincronizarKommo({ pedir, desde: "2026-09-01", hasta: "2026-09-30", ahora: "2026-09-20T10:00:00Z" });
    expect(lote.etapas).toHaveLength(6);
    expect(lote.embudo.length).toBeGreaterThan(0);
    expect(lote.embudo.every((r) => RegistroEmbudoSchema.safeParse(r).success)).toBe(true);
    expect(JSON.stringify(lote)).not.toMatch(/Fulana|Mengano/);
    expect(lote.meta).toMatchObject({ origen: "kommo", leads: 2 });
  });
});
