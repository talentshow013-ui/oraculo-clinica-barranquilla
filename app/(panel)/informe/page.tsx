import { motor } from "@/lib/datos";
import { cop, num, pct, ratio } from "@/lib/format";
import { ETIQUETA_PASO } from "@/lib/format/etiquetas";
import { semanaISO } from "@/lib/format/fechas";
import { Aviso, Grid, Kpi, Panel, Titulo } from "@/components/ui";

export default async function Informe() {
  const r = await motor();
  const decisiones = r.hallazgos.slice(0, 3);
  const proximos = r.oportunidades.slice(0, 3);
  const asistidas = r.embudo.find((p) => p.paso === "cita_asistida")?.cantidad ?? null;
  const ventas = r.embudo.find((p) => p.paso === "venta")?.cantidad ?? null;
  const r22 = r.hallazgos.find((h) => h.reglaId === "R22");

  return (
    <>
      <Titulo sub={`Semana ${semanaISO(r.hoy)} · datos del ${r.lote.meta.desde} al ${r.lote.meta.hasta}. Una página: qué pasó, qué se decide, qué se prueba.`}>
        Resumen para dirección
      </Titulo>

      {r22 && (
        <div className="mb-3">
          <Aviso tono="mal" titulo="Antes de leer los retornos">
            {r22.titulo}. {r22.acciones[0]}
          </Aviso>
        </div>
      )}
      {!r.negocio.calibrado && (
        <div className="mb-3">
          <Aviso tono="ojo">Los tickets y costos por procedimiento no están calibrados: el retorno sobre margen y el CAC sobre margen aparecen como “—”. Se definen en la reunión con la clínica.</Aviso>
        </div>
      )}

      <Grid cols={6}>
        <Kpi etiqueta="Inversión" valor={r.total.gasto} unidad="cop" />
        <Kpi etiqueta="Citas asistidas" valor={asistidas} />
        <Kpi etiqueta="Procedimientos vendidos" valor={ventas} />
        <Kpi etiqueta="Ingresos de caja" valor={r.negocio.ingresosCaja} unidad="cop" />
        <Kpi etiqueta="Retorno real" valor={r.negocio.roasReal} unidad="ratio" />
        <Kpi etiqueta="Plata en riesgo" valor={r.plataEnRiesgoTotal} unidad="cop" tono="mal" />
      </Grid>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel titulo="Tres decisiones" ayuda="Las que más plata mueven. Cada una con el dato y la acción.">
          <ol className="space-y-3">
            {decisiones.map((h, i) => (
              <li key={h.reglaId}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-texto">
                    {i + 1}. {h.titulo}
                  </span>
                  <span className="num shrink-0 text-sm font-semibold text-mal">{cop(h.plataEnRiesgo)}</span>
                </div>
                <p className="mt-0.5 text-xs text-texto-2">{h.explicacion}</p>
                <p className="mt-1 text-xs text-texto">→ {h.acciones[0]}</p>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel titulo="Dónde se pierde la plata" ayuda="Fuga del embudo en pesos">
          {r.fugaMasCara ? (
            <div>
              <div className="text-sm text-texto">{ETIQUETA_PASO[r.fugaMasCara.paso]}</div>
              <div className="num text-2xl font-semibold text-ojo">{cop(r.fugaMasCara.fugaCOP)}</div>
              <p className="mt-1 text-xs text-texto-2">
                {num(r.fugaMasCara.perdidos)} personas se pierden en este paso; solo pasa {pct(r.fugaMasCara.tasaPaso, 0)}.
              </p>
            </div>
          ) : (
            <p className="text-sm text-texto-3">Sin fuga calculable.</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Kpi etiqueta="Asistencia a citas" valor={r.negocio.showRate} unidad="porcentaje" />
            <Kpi etiqueta="Cierre en consultorio" valor={r.negocio.cierreEnConsultorio} unidad="porcentaje" />
            <Kpi etiqueta="Costo por cita asistida" valor={r.negocio.costoCitaAsistida} unidad="cop" />
            <Kpi etiqueta="Retorno sobre margen" valor={r.negocio.poas} unidad="ratio" />
          </div>
          <p className="mt-3 text-[11px] text-texto-3">
            Retorno real {ratio(r.negocio.roasReal)}: por cada peso invertido entraron {num(r.negocio.roasReal, 1)} pesos a caja. Cuánto quedó después de pagar el procedimiento depende del margen.
          </p>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel titulo="Qué se prueba esta semana" ayuda="Cada prueba tiene criterio de corte: se sabe de antemano qué significa perder">
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {proximos.map((o, i) => (
              <li key={o.id} className="rounded border border-borde bg-superficie-2 p-3">
                <div className="text-sm font-medium text-texto">
                  {i + 1}. {o.titulo}
                </div>
                <p className="mt-1 text-xs text-texto-2">{o.prueba.metricaExito} · {o.prueba.duracionDias} días</p>
                <p className="mt-1 text-[11px] text-texto-3">{o.prueba.criterioCorte}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="mt-4 text-[11px] text-texto-3">
        {r.contexto.huecos.length > 0 && <p>Días sin datos en el periodo: {r.contexto.huecos.join(", ")}.</p>}
        <p>Los umbrales usados son provisionales hasta calibrarse con la historia de la cuenta. Ningún dato de este informe es estimado sin decirlo.</p>
      </div>
    </>
  );
}
