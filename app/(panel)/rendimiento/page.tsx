import { motor } from "@/lib/datos";
import { cop, num, pct, ratio } from "@/lib/format";
import { Aviso, Celda, Grid, Kpi, Panel, Tabla, Th, Titulo, tonoPorDelta } from "@/components/ui";
import * as core from "@/lib/metrics/core";
import { rangoDias } from "@/lib/format/fechas";

export default async function Rendimiento() {
  const r = await motor();
  const rec = r.reciente;
  const prev = r.previa;

  const filas: { id: string; nombre: string; unidad: "cop" | "porcentaje" | "ratio" | "numero"; fn: (a: core.Agregado) => number | null; mejorEs: "mayor" | "menor" | "informativo" }[] = [
    { id: "inversion", nombre: "Inversión", unidad: "cop", fn: (a) => a.gasto, mejorEs: "informativo" },
    { id: "cpm", nombre: "Costo por mil impresiones", unidad: "cop", fn: core.cpm, mejorEs: "menor" },
    { id: "ctr_enlace", nombre: "Tasa de clics de enlace", unidad: "porcentaje", fn: core.ctrEnlace, mejorEs: "mayor" },
    { id: "cpc_enlace", nombre: "Costo por clic de enlace", unidad: "cop", fn: core.cpcEnlace, mejorEs: "menor" },
    { id: "frecuencia", nombre: "Frecuencia", unidad: "ratio", fn: core.frecuencia, mejorEs: "informativo" },
    { id: "conversaciones", nombre: "Conversaciones iniciadas", unidad: "numero", fn: (a) => a.conversacionesIniciadas, mejorEs: "mayor" },
    { id: "costo_conversacion", nombre: "Costo por conversación", unidad: "cop", fn: core.costoConversacion, mejorEs: "menor" },
    { id: "tasa_respuesta", nombre: "Tasa de respuesta del equipo", unidad: "porcentaje", fn: core.tasaRespuesta, mejorEs: "mayor" },
    { id: "hook", nombre: "Gancho (video)", unidad: "porcentaje", fn: core.hookRate, mejorEs: "mayor" },
    { id: "hold", nombre: "Retención (video)", unidad: "porcentaje", fn: core.holdRate, mejorEs: "mayor" },
    { id: "fuga_aterrizaje", nombre: "Fuga de aterrizaje", unidad: "porcentaje", fn: core.fugaAterrizaje, mejorEs: "menor" },
  ];

  // Serie semanal (sumas de crudos por semana; razones recalculadas).
  const porSemana = new Map<string, core.Agregado>();
  const dias = rangoDias(r.lote.meta.desde, r.lote.meta.hasta);
  const semanaDe = new Map<string, string>();
  dias.forEach((d, i) => semanaDe.set(d, dias[Math.floor(i / 7) * 7] ?? d));
  const filasPorSemana = new Map<string, typeof r.lote.insights>();
  for (const f of r.contexto.filasAnuncio) {
    const s = semanaDe.get(f.fecha) ?? f.fecha;
    (filasPorSemana.get(s) ?? filasPorSemana.set(s, []).get(s)!).push(f);
  }
  for (const [s, fs] of filasPorSemana) porSemana.set(s, core.agregar(fs));
  const semanas = [...porSemana.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(-12);
  const huecosSet = new Set(r.contexto.huecos);

  return (
    <>
      <Titulo sub="Inversión y eficiencia. Las dos ventanas comparadas tienen el mismo tamaño (14 días): nunca se compara una semana contra un mes.">Rendimiento</Titulo>

      <Grid cols={4}>
        <Kpi etiqueta="Inversión total" valor={r.total.gasto} unidad="cop" />
        <Kpi etiqueta="Retorno declarado por la plataforma" valor={core.roas(r.total)} unidad="ratio" nota="Con su ventana de atribución, no la caja" />
        <Kpi etiqueta="Retorno real (caja)" valor={r.negocio.roasReal} unidad="ratio" tono="acento" />
        <Kpi etiqueta="Retorno sobre margen (POAS)" valor={r.negocio.poas} unidad="ratio" nota={r.negocio.poas === null ? "Requiere margen calibrado" : "Lo que decide si la pauta gana plata"} />
      </Grid>

      <div className="mt-3">
        <Aviso tono="neutro">
          Retorno real {ratio(r.negocio.roasReal)} significa que por cada peso invertido entraron {num(r.negocio.roasReal, 1)} a caja. Sin restar el costo del procedimiento no se sabe si hubo ganancia: eso es el POAS.
        </Aviso>
      </div>

      <div className="mt-4">
        <Panel titulo="Últimos 14 días contra los 14 anteriores" ayuda={`${r.contexto.ventanas.reciente.desde} → ${r.contexto.ventanas.reciente.hasta} vs ${r.contexto.ventanas.previa.desde} → ${r.contexto.ventanas.previa.hasta}`}>
          <Tabla>
            <thead>
              <tr>
                <Th>Métrica</Th>
                <Th alinear="right">Reciente</Th>
                <Th alinear="right">Anterior</Th>
                <Th alinear="right">Cambio</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const a = f.fn(rec);
                const b = f.fn(prev);
                const d = core.delta(a, b);
                const fmt = (v: number | null) => (f.unidad === "cop" ? cop(v) : f.unidad === "porcentaje" ? pct(v) : f.unidad === "ratio" ? ratio(v) : num(v));
                return (
                  <tr key={f.id}>
                    <Celda>{f.nombre}</Celda>
                    <Celda alinear="right">{fmt(a)}</Celda>
                    <Celda alinear="right">{fmt(b)}</Celda>
                    <Celda alinear="right" tono={tonoPorDelta(d, f.mejorEs)}>{d === null ? "—" : `${d > 0 ? "+" : ""}${num(d * 100, 1)} %`}</Celda>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel titulo="Semana a semana" ayuda="Sumas de crudos por semana; las razones se recalculan. Las semanas con días sin datos están marcadas.">
          <Tabla>
            <thead>
              <tr>
                <Th>Semana del</Th>
                <Th alinear="right">Inversión</Th>
                <Th alinear="right">Costo por mil</Th>
                <Th alinear="right">Clics enlace</Th>
                <Th alinear="right">Tasa de clics</Th>
                <Th alinear="right">Conversaciones</Th>
                <Th alinear="right">Costo por conversación</Th>
                <Th alinear="right">Frecuencia</Th>
              </tr>
            </thead>
            <tbody>
              {semanas.map(([s, a]) => {
                const conHueco = rangoDias(s, dias[Math.min(dias.length - 1, dias.indexOf(s) + 6)] ?? s).some((d) => huecosSet.has(d));
                return (
                  <tr key={s}>
                    <Celda>
                      {s} {conHueco && <span className="text-mal" title="Esta semana tiene días sin datos">●</span>}
                    </Celda>
                    <Celda alinear="right">{cop(a.gasto)}</Celda>
                    <Celda alinear="right">{cop(core.cpm(a))}</Celda>
                    <Celda alinear="right">{num(a.clicsEnlace)}</Celda>
                    <Celda alinear="right">{pct(core.ctrEnlace(a))}</Celda>
                    <Celda alinear="right">{num(a.conversacionesIniciadas)}</Celda>
                    <Celda alinear="right">{cop(core.costoConversacion(a))}</Celda>
                    <Celda alinear="right">{num(core.frecuencia(a), 1)}</Celda>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
        </Panel>
      </div>
    </>
  );
}
