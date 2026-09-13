import { motor } from '@/lib/datos'
import { cop, num, pct, ratio } from '@/lib/format'
import { Aviso, Celda, Grid, Kpi, Panel, Tabla, Th, Titulo } from '@/components/ui'
import Contar from '@/components/cliente/contar'
import Serie from '@/components/graficas/serie'

/** RENDIMIENTO: ¿la pauta rinde? Retorno declarado vs real vs sobre margen, 14 contra 14, y la serie con sus huecos. */
export default async function Rendimiento() {
  const r = await motor()
  const n = r.negocio
  const filas: { nombre: string; f: (a: typeof r.total) => number | null; u: 'cop' | 'numero' | 'porcentaje' | 'ratio' }[] = [
    { nombre: 'Inversión', f: (a) => a.gasto, u: 'cop' }, { nombre: 'Impresiones', f: (a) => a.impresiones, u: 'numero' }, { nombre: 'Alcance', f: (a) => a.alcance, u: 'numero' }, { nombre: 'Frecuencia', f: (a) => a.frecuencia, u: 'ratio' },
    { nombre: 'Clics al enlace', f: (a) => a.clicsEnlace, u: 'numero' }, { nombre: 'Clic en el enlace (CTR)', f: (a) => a.ctrEnlace, u: 'porcentaje' }, { nombre: 'Costo por mil', f: (a) => a.cpm, u: 'cop' }, { nombre: 'Costo por clic', f: (a) => a.cpcEnlace, u: 'cop' },
    { nombre: 'Conversaciones', f: (a) => a.conversacionesIniciadas, u: 'numero' }, { nombre: 'Respondidas', f: (a) => a.conversacionesRespondidas, u: 'numero' }, { nombre: 'Resultados', f: (a) => a.resultados, u: 'numero' }, { nombre: 'Costo por resultado', f: (a) => a.costoResultado, u: 'cop' },
  ]
  const fmt = (v: number | null, u: string) => (u === 'cop' ? cop(v) : u === 'porcentaje' ? pct(v) : u === 'ratio' ? ratio(v) : num(v))
  return (
    <>
      <Titulo rotulo="Rendimiento · inversión y eficiencia" extra={<p className="text-[12.5px] text-texto-2">Últimos 14 días contra los 14 anteriores · serie de 90</p>}>¿La pauta rinde?</Titulo>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { n: 'Retorno declarado', v: n.roasDeclarado, t: 'Lo que reporta la plataforma: cuenta ingresos atribuidos', piel: 'pieza' },
          { n: 'Retorno real', v: n.roasReal, t: 'Ingresos en caja ÷ inversión', piel: 'pieza' },
          { n: 'Retorno sobre margen', v: n.poas, t: 'El que paga nómina: ingresos × margen ÷ inversión', piel: 'pieza-marina' },
        ].map((x, i) => (
          <div key={x.n} className={`${x.piel} entra-zoom p-5`} style={{ ['--retraso' as string]: `${i * 100}ms` }}>
            <p className={`rotulo ${x.piel === 'pieza-marina' ? 'text-celeste' : ''}`}>{x.n}</p>
            <p className={`cifra num mt-2 text-[44px] ${x.piel === 'pieza-marina' ? 'text-white' : ''}`}><Contar valor={x.v} unidad="ratio" /></p>
            <p className={`mt-1.5 text-[12.5px] leading-snug ${x.piel === 'pieza-marina' ? 'text-celeste' : 'text-texto-2'}`}>{x.t}</p>
          </div>
        ))}
      </div>
      <Aviso tono="ojo" className="mt-3">Con {pct(0.57, 0)} de margen medio, un retorno declarado de {ratio(n.roasDeclarado)} son {ratio(n.poas)} reales sobre margen. El presupuesto se decide con el tercero.</Aviso>

      <h2 className="mb-3 mt-5 text-[19px]">14 contra 14</h2>
      <Grid cols={6}>
        <Kpi nombre="Inversión" valor={r.reciente.gasto} unidad="cop" previo={r.previa.gasto} mejorEs="rango" retraso={60} />
        <Kpi nombre="Clic en el enlace" valor={r.reciente.ctrEnlace} unidad="porcentaje" previo={r.previa.ctrEnlace} mejorEs="mayor" retraso={100} />
        <Kpi nombre="Costo por mil" valor={r.reciente.cpm} unidad="cop" previo={r.previa.cpm} mejorEs="menor" retraso={140} />
        <Kpi nombre="Costo por clic" valor={r.reciente.cpcEnlace} unidad="cop" previo={r.previa.cpcEnlace} mejorEs="menor" retraso={180} />
        <Kpi nombre="Resultados" valor={r.reciente.resultados} unidad="numero" previo={r.previa.resultados} mejorEs="mayor" retraso={220} />
        <Kpi nombre="Costo por resultado" valor={r.reciente.costoResultado} unidad="cop" previo={r.previa.costoResultado} mejorEs="menor" retraso={260} />
      </Grid>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel rotulo="Serie diaria · 90 días" titulo="Inversión" retraso={200}><Serie datos={r.serie} campo="gasto" unidad="cop" dias={90} /></Panel>
        <Panel rotulo="Serie diaria · 90 días" titulo="Clic en el enlace" retraso={260}><Serie datos={r.serie} campo="ctrEnlace" unidad="porcentaje" dias={90} /></Panel>
        <Panel rotulo="Serie diaria · 90 días" titulo="Costo por mil (presión de la subasta)" retraso={320}><Serie datos={r.serie} campo="cpm" unidad="cop" dias={90} /></Panel>
        <Panel rotulo="Serie diaria · 90 días" titulo="Resultados" retraso={380}><Serie datos={r.serie} campo="resultados" unidad="numero" dias={90} /></Panel>
      </div>

      <Panel rotulo="Todo el periodo" titulo="Las sumas, sin promediar promedios" className="mt-3" retraso={420}>
        <Tabla>
          <thead><tr><Th>Métrica</Th><Th num>Últimos 14</Th><Th num>14 anteriores</Th><Th num>Periodo completo</Th></tr></thead>
          <tbody>{filas.map((f) => <tr key={f.nombre}><Celda>{f.nombre}</Celda><Celda num>{fmt(f.f(r.reciente), f.u)}</Celda><Celda num>{fmt(f.f(r.previa), f.u)}</Celda><Celda num>{fmt(f.f(r.total), f.u)}</Celda></tr>)}</tbody>
        </Tabla>
        <p className="mt-2 text-[12px] text-texto-2">Alcance y frecuencia salen como «—» donde la plataforma dejó de entregarlos: no se estiman.</p>
      </Panel>
    </>
  )
}
