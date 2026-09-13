import { motor } from '@/lib/datos'
import { cop, num, pct, ratio } from '@/lib/format'
import { fechaCorta, fechaLarga } from '@/lib/format/fechas'
import { PASOS } from '@/lib/format/etiquetas'
import Imprimir from '@/components/cliente/imprimir'
import EmbudoBarras from '@/components/graficas/embudo'

/** INFORME: una carta. Seis cifras, tres decisiones, dónde se pierde la plata, qué se prueba. Se imprime sin riel. */
export default async function Informe() {
  const r = await motor()
  const n = r.negocio
  const decisiones = r.hallazgos.slice(0, 3)
  const pruebas = r.oportunidades.filter((o) => !o.yaProbada).slice(0, 2)
  const cifras = [
    { n: 'Plata en riesgo', v: cop(r.plataEnRiesgoTotal), mal: true }, { n: 'Inversión del periodo', v: cop(r.total.gasto) }, { n: 'Citas asistidas', v: num(r.embudo[5]?.cantidad) },
    { n: 'Costo por cita asistida', v: cop(n.costoCitaAsistida) }, { n: 'Asistencia a citas', v: pct(n.showRate), mal: (n.showRate ?? 1) < r.benchmarks.showRateMinimo.valor }, { n: 'Retorno sobre margen', v: ratio(n.poas) },
  ]
  return (
    <div className="mx-auto max-w-[880px]">
      <div className="entra mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="rotulo">Informe para dirección · {r.cliente.nombre}</p>
          <h1 className="mt-1 text-[clamp(1.5rem,2.4vw,2rem)]">{fechaCorta(r.lote.meta.desde)} – {fechaLarga(r.lote.meta.hasta)}</h1>
          <p className="mt-0.5 text-[12.5px] text-texto-2">{r.lote.meta.origen} · atribución {r.lote.insights[0]?.ventanaAtribucion} · {r.lote.meta.huecos.length} {r.lote.meta.huecos.length === 1 ? 'día sin datos' : 'días sin datos'}</p>
        </div>
        <Imprimir />
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Seis cifras">
        {cifras.map((c, i) => <div key={c.n} className="pieza entra-zoom p-3.5" style={{ ['--retraso' as string]: `${i * 50}ms` }}><p className="text-[11.5px] text-texto-2">{c.n}</p><p className={`cifra num mt-1 text-[24px] ${c.mal ? 'text-mal' : ''}`}>{c.v}</p></div>)}
      </section>

      <section className="pieza-marina entra mt-3 p-5" aria-label="Tres decisiones" style={{ ['--retraso' as string]: '200ms' }}>
        <p className="rotulo text-celeste">Tres decisiones para esta semana</p>
        <ol className="mt-2 flex flex-col gap-2.5">
          {decisiones.map((h, i) => (
            <li key={h.reglaId} className="grid grid-cols-[26px_1fr] gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[12px] font-bold text-marino">{i + 1}</span>
              <div><p className="text-[15px] leading-snug text-white">{h.acciones[0]}</p><p className="mt-0.5 text-[12.5px] text-celeste">Porque: {h.titulo.toLowerCase()}. {h.plataEnRiesgo ? `Vale ${cop(h.plataEnRiesgo)}.` : ''}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="pieza entra mt-3 p-5" aria-label="Dónde se pierde la plata" style={{ ['--retraso' as string]: '280ms' }}>
        <p className="rotulo">Dónde se pierde la plata</p>
        <h2 className="mb-3 mt-0.5 text-[18px]">{r.fugaMasCara ? `La fuga más cara es en ${PASOS[r.fugaMasCara.paso].toLowerCase()}: ${cop(r.fugaMasCara.fugaCOP)}` : 'Sin fuga valorizada'}</h2>
        <EmbudoBarras pasos={r.embudo} peor={r.fugaMasCara} compacto />
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label="Qué se prueba">
        {pruebas.map((o, i) => (
          <div key={o.titulo} className="pieza-hielo entra mt-3 p-4" style={{ ['--retraso' as string]: `${360 + i * 60}ms` }}>
            <p className="rotulo text-cobalto">Qué se prueba · prioridad {o.ice}</p>
            <h3 className="mt-0.5 text-[16px]">{o.titulo}</h3>
            <p className="mt-1 text-[12.5px] leading-snug text-texto-2">{o.hipotesis}</p>
            <p className="mt-1.5 text-[12.5px]"><span className="font-semibold">{o.prueba.duracionDias} días · {o.prueba.presupuestoCOP ? cop(o.prueba.presupuestoCOP) : 'sin costo'}.</span> Éxito si {o.prueba.metricaExito.toLowerCase()}. <span className="text-mal">Corte:</span> {o.prueba.criterioCorte}</p>
          </div>
        ))}
      </section>
      <p className="mt-4 text-[11px] text-texto-3">Todo dato ausente aparece como «—». Los desgloses no suman al total. Segmentos con menos de {r.privacidad.k} registros no se muestran.</p>
    </div>
  )
}
