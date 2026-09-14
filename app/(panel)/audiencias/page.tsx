import { motor } from '@/lib/datos'
import { cop, num, pct } from '@/lib/format'
import { Aviso, Celda, Etiqueta, Grid, Kpi, Panel, Tabla, Th, Titulo } from '@/components/ui'
import type { DesgloseVista } from '@/lib/tipos'

/** AUDIENCIAS: fuera de radio, fuera de horario, segmentos que gastan sin producir, y los ocultos por privacidad. */
export default async function Audiencias() {
  const r = await motor()
  const d = r.desgloses
  const por = (dim: DesgloseVista['dimension']) => d.filter((x) => x.dimension === dim).sort((a, b) => b.gasto - a.gasto)
  const gastoTotal = r.total.gasto
  const fueraRadio = d.filter((x) => x.fueraDeRadio).reduce((s, x) => s + x.gasto, 0)
  const fueraHorario = d.filter((x) => x.fueraDeHorario).reduce((s, x) => s + x.gasto, 0)
  const sinProducir = d.filter((x) => x.dimension === 'edad' && x.resultados / Math.max(1, x.clicsEnlace) < 0.02)
  const Bloque = ({ titulo, filas, marca, retraso }: { titulo: string; filas: DesgloseVista[]; marca?: (x: DesgloseVista) => string | null; retraso: number }) => (
    <Panel rotulo={`Por ${titulo}`} titulo={titulo === 'edad' ? '¿Quién gasta y quién agenda?' : titulo === 'zona' ? '¿Desde dónde pueden venir?' : '¿A qué hora escriben y quién contesta?'} retraso={retraso}>
      <Tabla minAncho={520}>
        <thead><tr><Th>{titulo}</Th><Th num>Inversión</Th><Th num>% del total</Th><Th num>Clics</Th><Th num>Citas</Th><Th num>Costo por cita</Th><Th>Señal</Th></tr></thead>
        <tbody>
          {filas.map((x) => {
            const m = marca?.(x)
            return (
              <tr key={x.valor} className={m ? 'bg-mal/[0.04]' : ''}>
                <Celda><span className="font-medium">{x.valor}</span></Celda>
                <Celda num>{cop(x.gasto)}</Celda>
                <Celda num>{pct(x.gasto / gastoTotal, 0)}</Celda>
                <Celda num>{num(x.clicsEnlace)}</Celda>
                <Celda num tono={x.resultados === 0 ? 'mal' : undefined}>{num(x.resultados)}</Celda>
                <Celda num tono={x.costoResultado != null && x.costoResultado > 120_000 ? 'mal' : undefined}>{cop(x.costoResultado)}</Celda>
                <Celda>{m ? <Etiqueta tono="mal">{m}</Etiqueta> : x.nRegistros < r.privacidad.k * 4 ? <Etiqueta tono="neutro">pocos registros</Etiqueta> : ''}</Celda>
              </tr>
            )
          })}
        </tbody>
      </Tabla>
    </Panel>
  )
  return (
    <>
      {r.campanaActiva && !r.desglosesPorCampana && (
        <Aviso tono="ojo" className="mb-3">Estás mirando la campaña «{r.campanaActiva.nombre}», pero los datos de audiencias vienen por cuenta completa, no por campaña. Elige «Todas las campañas» arriba para verlos, o pide en la próxima sincronización los desgloses por campaña.</Aviso>
      )}
      <Titulo rotulo="Audiencias · edad, zona, franja horaria" extra={<p className="text-[12.5px] text-texto-2">{r.privacidad.segmentosOcultos} segmentos ocultos por privacidad (menos de {r.privacidad.k} registros)</p>}>Qué excluir y a qué hora pautar</Titulo>
      <Grid cols={4}>
        <Kpi nombre="Inversión fuera del radio" valor={fueraRadio / gastoTotal} unidad="porcentaje" tono="mal" formula={`Gasto a más de ${r.cliente.radioKm} km ÷ total`} porQueImporta="Nadie viene desde Bogotá a una sesión" retraso={40} />
        <Kpi nombre="Inversión fuera de horario" valor={fueraHorario / gastoTotal} unidad="porcentaje" tono="mal" formula="Gasto de 6 p. m. a 8 a. m. ÷ total" porQueImporta="Escriben y nadie contesta hasta el día siguiente" retraso={80} />
        <Kpi nombre="Plata en esas dos fugas" valor={fueraRadio + fueraHorario * 0.6} unidad="cop" tono="mal" formula="Fuera de radio + 60 % de fuera de horario" retraso={120} />
        <Kpi nombre="Segmentos que gastan sin producir" valor={sinProducir.length} unidad="numero" tono={sinProducir.length ? 'ojo' : 'bien'} formula="Rangos de edad con menos de 2 % de cita por clic" retraso={160} />
      </Grid>
      <div className="mt-3 flex flex-col gap-2">
        <Aviso tono="neutro">{r.lote.meta.advertencias[0]}. Cada tabla se lee sola.</Aviso>
        <Aviso tono="acento">{r.privacidad.AVISO_PANEL}</Aviso>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="xl:col-span-7"><Bloque titulo="zona" filas={por('ubicacion')} marca={(x) => (x.fueraDeRadio ? 'fuera del radio' : null)} retraso={200} /></div>
        <div className="xl:col-span-5"><Bloque titulo="hora" filas={por('hora')} marca={(x) => (x.fueraDeHorario ? 'fuera de horario' : null)} retraso={260} /></div>
        <div className="xl:col-span-12"><Bloque titulo="edad" filas={por('edad')} marca={(x) => (x.resultados / Math.max(1, x.clicsEnlace) < 0.02 ? 'gasta y no agenda' : null)} retraso={320} /></div>
      </div>
    </>
  )
}
