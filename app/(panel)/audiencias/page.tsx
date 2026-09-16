import { motor } from '@/lib/datos'
import { cop, num, pct } from '@/lib/format'
import { Aviso, Barra, Celda, Etiqueta, Grid, Kpi, Panel, Tabla, Th, Titulo } from '@/components/ui'
import { etiquetaHora } from '@/lib/format/etiquetas'
import type { DesgloseVista } from '@/lib/tipos'

/** AUDIENCIAS: fuera de radio, fuera de horario, segmentos que gastan sin producir, y los ocultos por privacidad. */
export default async function Audiencias() {
  const r = await motor()
  const d = r.desgloses
  const por = (dim: DesgloseVista['dimension']) => d.filter((x) => x.dimension === dim).sort((a, b) => b.gasto - a.gasto)
  // Cada dimensión reparte su propio total (los desgloses cubren su periodo, no siempre el del panel).
  const totalDim = (dim: DesgloseVista['dimension']) => d.filter((x) => x.dimension === dim).reduce((s, x) => s + x.gasto, 0)
  const totalZona = totalDim('ubicacion') || r.total.gasto
  const totalHora = totalDim('hora') || r.total.gasto
  const fueraRadio = d.filter((x) => x.fueraDeRadio).reduce((s, x) => s + x.gasto, 0)
  const fueraHorario = d.filter((x) => x.fueraDeHorario).reduce((s, x) => s + x.gasto, 0)
  // Las horas van de 12 a. m. a 11 p. m., como un reloj, no por inversión.
  const horas = d.filter((x) => x.dimension === 'hora').sort((a, b) => Number(a.valor) - Number(b.valor))
  const horaMax = Math.max(1, ...horas.map((x) => x.gasto))
  const horasConResultados = horas.some((x) => x.resultados > 0)
  const { inicio, fin } = r.cliente.horarioAtencion
  const enHorario = (x: DesgloseVista) => Number(x.valor) >= inicio && Number(x.valor) < fin
  // Dato ausente no es cero: si ningún segmento de edad trae resultados, la fuente no los entrega.
  const hayResultados = (dim: DesgloseVista['dimension']) => d.some((x) => x.dimension === dim && x.resultados > 0)
  const sinProducir = hayResultados('edad') ? d.filter((x) => x.dimension === 'edad' && x.gasto / (totalDim('edad') || 1) >= 0.01 && x.resultados / Math.max(1, x.clicsEnlace) < 0.02) : []
  const Bloque = ({ titulo, filas, marca, retraso }: { titulo: string; filas: DesgloseVista[]; marca?: (x: DesgloseVista) => string | null; retraso: number }) => {
    const total = filas.reduce((s, x) => s + x.gasto, 0) || r.total.gasto
    const conResultados = filas.some((x) => x.resultados > 0)
    return (
    <Panel id={titulo} rotulo={`Por ${titulo}`} titulo={titulo === 'edad' ? '¿Quién gasta y quién produce?' : titulo === 'zona' ? '¿Desde dónde pueden venir?' : '¿A qué hora escriben y quién contesta?'} retraso={retraso}>
      <Tabla minAncho={480}>
        <thead><tr><Th>{titulo}</Th><Th num>Inversión</Th><Th num>% del total</Th><Th num>Clics</Th><Th num>Resultados</Th><Th num>Costo por resultado</Th><Th>Señal</Th></tr></thead>
        <tbody>
          {filas.map((x) => {
            const m = marca?.(x)
            return (
              <tr key={x.valor} className={m ? 'bg-mal/[0.04]' : ''}>
                <Celda><span className="font-medium">{x.valor}</span></Celda>
                <Celda num>{cop(x.gasto)}</Celda>
                <Celda num>{pct(x.gasto / total, 0)}</Celda>
                <Celda num>{num(x.clicsEnlace)}</Celda>
                <Celda num tono={conResultados && x.resultados === 0 ? 'mal' : undefined}>{conResultados ? num(x.resultados) : '—'}</Celda>
                <Celda num tono={x.costoResultado != null && x.costoResultado > 120_000 ? 'mal' : undefined}>{conResultados ? cop(x.costoResultado) : '—'}</Celda>
                <Celda>{m ? <Etiqueta tono="mal">{m}</Etiqueta> : x.nRegistros < r.privacidad.k * 4 ? <Etiqueta tono="neutro">pocos registros</Etiqueta> : ''}</Celda>
              </tr>
            )
          })}
        </tbody>
      </Tabla>
    </Panel>
    )
  }
  return (
    <>
      {r.campanaActiva && !r.desglosesPorCampana && (
        <Aviso tono="ojo" className="mb-3">Estás mirando la campaña «{r.campanaActiva.nombre}», pero los datos de audiencias vienen por cuenta completa, no por campaña. Elige «Todas las campañas» arriba para verlos, o pide en la próxima sincronización los desgloses por campaña.</Aviso>
      )}
      <Titulo rotulo="Audiencias · edad, zona, franja horaria" extra={<p className="text-[12.5px] text-texto-2">{r.privacidad.segmentosOcultos} segmentos ocultos por privacidad (menos de {r.privacidad.k} registros)</p>}>Qué excluir y a qué hora pautar</Titulo>
      <Grid cols={4}>
        <Kpi nombre="Inversión fuera del radio" valor={fueraRadio / totalZona} unidad="porcentaje" tono="mal" formula={`Gasto a más de ${r.cliente.radioKm} km ÷ total con zona conocida`} porQueImporta="Nadie viene desde Bogotá a una sesión" retraso={40} />
        <Kpi nombre="Inversión fuera de horario" valor={fueraHorario / totalHora} unidad="porcentaje" tono="mal" formula="Gasto de 6 p. m. a 8 a. m. ÷ total con hora conocida" porQueImporta="Escriben y nadie contesta hasta el día siguiente" retraso={80} />
        <Kpi nombre="Plata en esas dos fugas" valor={fueraRadio + fueraHorario * 0.6} unidad="cop" tono="mal" formula="Fuera de radio + 60 % de fuera de horario" retraso={120} />
        <Kpi nombre="Segmentos que gastan sin producir" valor={hayResultados('edad') ? sinProducir.length : null} unidad="numero" tono={sinProducir.length ? 'ojo' : 'bien'} formula="Rangos de edad con menos de 2 % de resultado por clic" retraso={160} />
      </Grid>
      <div className="mt-3 flex flex-col gap-2">
        <Aviso tono="neutro">{r.lote.meta.advertencias[0]}. Cada tabla se lee sola.</Aviso>
        <Aviso tono="acento">{r.privacidad.AVISO_PANEL}</Aviso>
        {r.periodo.elegido && <Aviso tono="neutro">Las audiencias muestran siempre los últimos 28 días; el periodo elegido no las cambia.</Aviso>}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="xl:col-span-12"><Bloque titulo="zona" filas={por('ubicacion')} marca={(x) => (x.fueraDeRadio ? 'fuera del radio' : null)} retraso={200} /></div>
        <div className="xl:col-span-12"><Bloque titulo="edad" filas={por('edad')} marca={(x) => (hayResultados('edad') && x.gasto / (totalDim('edad') || 1) >= 0.01 && x.resultados / Math.max(1, x.clicsEnlace) < 0.02 ? 'gasta y no produce' : null)} retraso={260} /></div>
        <div className="xl:col-span-12">
          <Panel id="hora" rotulo="Por hora · de 12 a. m. a 11 p. m." titulo="¿A qué hora escriben y quién contesta?" retraso={320} extra={<span className="text-[11.5px] text-texto-3">Sombreado: horario de atención ({etiquetaHora(inicio)} – {etiquetaHora(fin)})</span>}>
            <Tabla minAncho={620}>
              <thead><tr><Th>Hora</Th><Th>Inversión</Th><Th num>% del total</Th><Th num>Clics</Th><Th num>Resultados</Th><Th num>Costo por resultado</Th><Th>Señal</Th></tr></thead>
              <tbody>
                {horas.map((x, i) => (
                  <tr key={x.valor} className={enHorario(x) ? 'bg-superficie-2' : ''}>
                    <Celda><span className="num font-medium">{etiquetaHora(x.valor)}</span></Celda>
                    <Celda className="min-w-[170px]"><Barra pct={x.gasto / horaMax} tono={enHorario(x) ? 'acento' : 'neutro'} valor={cop(x.gasto)} alto={6} retraso={100 + i * 20} /></Celda>
                    <Celda num>{pct(x.gasto / totalHora, 0)}</Celda>
                    <Celda num>{num(x.clicsEnlace)}</Celda>
                    <Celda num tono={horasConResultados && x.resultados === 0 ? 'mal' : undefined}>{horasConResultados ? num(x.resultados) : '—'}</Celda>
                    <Celda num tono={x.costoResultado != null && x.costoResultado > 120_000 ? 'mal' : undefined}>{horasConResultados ? cop(x.costoResultado) : '—'}</Celda>
                    <Celda>{x.fueraDeHorario ? <Etiqueta tono="mal">fuera de horario</Etiqueta> : ''}</Celda>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </Panel>
        </div>
      </div>
    </>
  )
}
