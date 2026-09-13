import { motor } from '@/lib/datos'
import { cop, num, pct, ratio } from '@/lib/format'
import { PASOS } from '@/lib/format/etiquetas'
import { Aviso, Grid, Kpi, Panel, Titulo } from '@/components/ui'
import EmbudoBarras from '@/components/graficas/embudo'

/** EMBUDO: los 8 pasos con la fuga en pesos; el peor resaltado; las dos formas de valorizar, explicadas. */
export default async function Embudo() {
  const r = await motor()
  const n = r.negocio
  return (
    <>
      <Titulo rotulo="Embudo · 8 pasos valorizados en pesos" extra={<p className="num text-[12.5px] text-texto-2">{num(r.embudo[0]?.cantidad)} vieron el anuncio · {num(r.embudo[6]?.cantidad)} compraron</p>}>Dónde se pierde la plata</Titulo>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Panel rotulo="Los ocho pasos" titulo={r.fugaMasCara ? `La fuga más cara: ${PASOS[r.fugaMasCara.paso].toLowerCase()}, ${cop(r.fugaMasCara.fugaCOP)}` : 'Los ocho pasos'} className="lg:col-span-8">
          <EmbudoBarras pasos={r.embudo} peor={r.fugaMasCara} />
        </Panel>
        <div className="flex flex-col gap-3 lg:col-span-4">
          <Panel tono="marina" rotulo="Cómo se valoriza" titulo="Dos precios distintos para una fuga">
            <p className="text-[13px] leading-snug text-[#EAF2FF]"><span className="font-semibold text-white">Antes de la cita asistida</span>, cada perdido vale lo que costó traerlo (costo del paso anterior).</p>
            <p className="mt-2 text-[13px] leading-snug text-[#EAF2FF]"><span className="font-semibold text-white">Desde la cita asistida</span>, cada perdido vale el <span className="text-celeste">margen de una venta</span>: por eso un 10 % de fuga en el paso 6 pesa 40 veces más que un 40 % en el paso 2.</p>
            <p className="mt-3 text-[12px] text-celeste">Margen medio configurado: 57 % sobre un ticket medio de {cop(1_180_000)}.</p>
          </Panel>
          <Aviso tono={n.calibrado ? 'bien' : 'ojo'}>{n.calibrado ? 'Ticket y margen calibrados con la historia de la clínica.' : 'Ticket y margen sin calibrar: los pesos son una aproximación.'}</Aviso>
        </div>
      </div>
      <h2 className="mb-3 mt-5 text-[19px]">Lo que sale del embudo</h2>
      <Grid cols={6}>
        <Kpi nombre="Asistencia a citas" valor={n.showRate} unidad="porcentaje" mejorEs="mayor" tono={n.showRate != null && n.showRate < r.benchmarks.showRateMinimo.valor ? 'mal' : 'bien'} formula="Citas asistidas ÷ agendadas" retraso={60} />
        <Kpi nombre="Cierre en consultorio" valor={n.cierreEnConsultorio} unidad="porcentaje" mejorEs="mayor" formula="Ventas ÷ citas asistidas" retraso={100} />
        <Kpi nombre="Costo por cita asistida" valor={n.costoCitaAsistida} unidad="cop" mejorEs="menor" formula="Inversión ÷ citas asistidas" retraso={140} />
        <Kpi nombre="Costo por paciente nuevo" valor={n.cac} unidad="cop" mejorEs="menor" formula="Inversión ÷ ventas" retraso={180} />
        <Kpi nombre="Costo / margen" valor={n.ratioCacMargen} unidad="ratio" mejorEs="menor" tono={n.ratioCacMargen != null && n.ratioCacMargen > 1 ? 'mal' : 'bien'} formula="Costo por paciente ÷ margen unitario" retraso={220} />
        <Kpi nombre="Valor del paciente / costo" valor={n.ltvSobreCac} unidad="ratio" mejorEs="mayor" formula="Margen de por vida ÷ costo de traerlo" retraso={260} />
      </Grid>
      <p className="mt-3 text-[12.5px] text-texto-2">Recompra {pct(n.tasaRecompra)} · ingresos en caja del periodo {cop(n.ingresosCaja)} · retorno real {ratio(n.roasReal)} · sobre margen {ratio(n.poas)}.</p>
    </>
  )
}
