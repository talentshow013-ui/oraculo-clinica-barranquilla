import { Suspense } from 'react'
import { motor, campanasEnPeriodo, compararCampanas } from '@/lib/datos'
import type { EstadoCampana, MetricaComparada, ResumenCampana } from '@/lib/tipos'
import { cop, num, pct, ratio } from '@/lib/format'
import { fechaCorta } from '@/lib/format/fechas'
import { Aviso, Barra, Etiqueta, Panel, Titulo, Vacio, tonoDelta, type Tono } from '@/components/ui'
import Ordenable, { type FilaOrdenable } from '@/components/cliente/ordenable'
import { ElegirAB, SelectorPeriodo } from '@/components/cliente/campanas-url'

/**
 * CAMPAÑAS: cada pauta con su cara (al aire, pausada, archivada) en vez de la cuenta sumada, y dos
 * de ellas lado a lado. Periodo y elección viajan en la URL; los números ya vienen calculados.
 */
const ESTADO: Record<EstadoCampana, string> = { activo: 'Activa', pausado: 'Pausada', archivado: 'Archivada', en_revision: 'En revisión', rechazado: 'Rechazada' }
const tonoEstado = (c: ResumenCampana): Tono => (c.alAire ? 'bien' : c.estado === 'rechazado' ? 'mal' : c.estado === 'en_revision' ? 'ojo' : 'neutro')
const formato = (v: number | null, u: MetricaComparada['unidad']) => (u === 'cop' ? cop(v) : u === 'porcentaje' ? pct(v) : u === 'ratio' ? ratio(v) : num(v))
const n = (t: string) => <span className="whitespace-nowrap">{t}</span>
const rango = (c: ResumenCampana) => (c.primerDia && c.ultimoDia ? <><span className="whitespace-nowrap">{fechaCorta(c.primerDia)} →</span> <span className="whitespace-nowrap">{fechaCorta(c.ultimoDia)}</span></> : '—')

export default async function Campanas({ searchParams }: { searchParams: Promise<{ periodo?: string; a?: string; b?: string }> }) {
  const { periodo, a, b } = await searchParams
  const r = await motor()
  const vista = campanasEnPeriodo(r, periodo)
  const ca = vista.campanas.find((c) => c.id === a)
  const cb = vista.campanas.find((c) => c.id === b)
  const comparacion = ca && cb && ca.id !== cb.id ? compararCampanas(ca, cb) : null
  const alAire = vista.campanas.filter((c) => c.alAire).length
  const rotuloPeriodo = `${r.cuenta.nombre} · del ${fechaCorta(vista.desde)} al ${fechaCorta(vista.hasta)}`

  const columnas = [
    { id: 'nombre', nombre: 'Campaña', ancho: '20%' }, { id: 'periodo', nombre: 'Periodo' }, { id: 'gasto', nombre: 'Inversión', num: true },
    { id: 'parte', nombre: '% del gasto', ancho: '96px' }, { id: 'conv', nombre: 'Conversa­ciones', num: true }, { id: 'res', nombre: 'Resultados', num: true },
    { id: 'cr', nombre: 'Costo por resultado', num: true }, { id: 'cc', nombre: 'Costo por conversación', num: true }, { id: 'ctr', nombre: 'Clic en el enlace', num: true }, { id: 'frec', nombre: 'Frecuencia', num: true },
  ]
  const filas: FilaOrdenable[] = vista.campanas.map((c, i) => ({
    clave: c.id,
    crudo: { nombre: c.nombre, periodo: c.primerDia, gasto: c.total.gasto, parte: c.participacionGasto, conv: c.total.conversacionesIniciadas, res: c.total.resultados, cr: c.costoResultado, cc: c.costoConversacion, ctr: c.ctrEnlace, frec: c.frecuencia },
    celdas: {
      nombre: (
        <span className="flex min-w-0 items-center gap-2">
          <Suspense><ElegirAB id={c.id} esA={c.id === ca?.id} esB={c.id === cb?.id} /></Suspense>
          <span className="min-w-0 grow shrink basis-0">
            <span className="line-clamp-2 w-0 min-w-full font-medium leading-tight text-texto">{c.nombre}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5"><Etiqueta tono={tonoEstado(c)}>{c.alAire ? 'Al aire' : ESTADO[c.estado]}</Etiqueta><span className="whitespace-nowrap text-[11px] text-texto-3">{c.nConjuntos} conj. · {c.nAnuncios} anuncios</span></span>
          </span>
        </span>
      ),
      periodo: <span className="block leading-tight"><span className="num block">{rango(c)}</span><span className="block whitespace-nowrap text-[11px] text-texto-3">{c.diasConGasto} días con gasto</span></span>,
      gasto: <span className="whitespace-nowrap font-medium text-texto">{cop(c.total.gasto)}</span>,
      parte: <Barra pct={c.participacionGasto} tono={i === 0 ? 'acento' : 'neutro'} valor={pct(c.participacionGasto, 0)} alto={5} retraso={120 + i * 40} />,
      conv: n(num(c.total.conversacionesIniciadas)), res: n(num(c.total.resultados)), cr: n(cop(c.costoResultado)), cc: n(cop(c.costoConversacion)), ctr: n(pct(c.ctrEnlace)), frec: n(ratio(c.frecuencia)),
    },
  }))

  return (
    <>
      <Titulo rotulo={`Campañas · ${rotuloPeriodo}`} extra={<Suspense><SelectorPeriodo actual={vista.periodo} /></Suspense>}>¿Cómo le fue a cada pauta?</Titulo>

      {vista.campanas.length === 0 ? (
        <Vacio titulo="Ninguna campaña gastó en este periodo" texto="Amplía el periodo con las pastillas de arriba: una pauta pausada o archivada sigue apareciendo con su historia en los días en que sí gastó." />
      ) : (
        <Panel rotulo="Las pautas" titulo={<>{vista.campanas.length} {vista.campanas.length === 1 ? 'campaña gastó' : 'campañas gastaron'} en el periodo · {alAire} al aire</>} extra={<p className="max-w-[46ch] text-[12.5px] leading-snug text-texto-2">Las pausadas y archivadas se ven igual de claras: solo cambia la etiqueta. Toca <b className="text-texto">A</b> y <b className="text-texto">B</b> para ponerlas lado a lado.</p>}>
          <Ordenable columnas={columnas} filas={filas} inicial="gasto" minAncho={960} />
        </Panel>
      )}

      <div className="mt-4 grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          {comparacion ? <Comparacion c={comparacion} /> : (
            <Panel rotulo="Comparar dos" titulo="Lado a lado" retraso={120} extra={<p className="text-[12.5px] text-texto-2">¿Cómo le fue a la de junio contra la de ahora?</p>}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Ranura letra="A" x={ca} />
                <Ranura letra="B" x={cb} />
              </div>
            </Panel>
          )}
        </div>
        <Panel rotulo="Cómo se calcula" className="lg:col-span-4" retraso={200}>
          <ul className="space-y-2 text-[13.5px] leading-relaxed text-texto-2">
            <li className="flex gap-2"><span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />Cada campaña suma sus propios días de pauta; los costos y tasas se recalculan desde esas sumas.</li>
            <li className="flex gap-2"><span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />Comparar dos que corrieron días distintos: mira costos y tasas, no las sumas.</li>
            <li className="flex gap-2"><span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />Una campaña pausada sigue apareciendo con su historia; solo deja de estar «al aire».</li>
          </ul>
        </Panel>
      </div>
    </>
  )
}

/** Una ranura de la comparación: llena con la campaña elegida, o vacía diciendo qué tocar. */
function Ranura({ letra, x }: { letra: 'A' | 'B'; x: ResumenCampana | undefined }) {
  if (!x) {
    return (
      <div className="flex min-h-[92px] items-center gap-3 rounded-[14px] border border-dashed border-borde-fuerte px-4 py-3">
        <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed text-[15px] font-bold ${letra === 'A' ? 'border-marino/40 text-marino' : 'border-acento/40 text-acento'}`}>{letra}</span>
        <p className="text-[13px] leading-snug text-texto-2">Toca <b className="text-texto">{letra}</b> en una fila de la tabla para ponerla aquí.</p>
      </div>
    )
  }
  const oscuro = letra === 'A'
  return (
    <div className={`${oscuro ? 'pieza-marina' : 'pieza-hielo'} entra-zoom flex min-h-[92px] items-start gap-3 p-4`}>
      <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-bold ${oscuro ? 'bg-white/12 text-celeste' : 'bg-acento text-white'}`}>{letra}</span>
      <span className="min-w-0">
        <span className={`block text-[16px] font-medium leading-tight ${oscuro ? 'text-white' : 'text-texto'}`}>{x.nombre}</span>
        <span className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] ${oscuro ? 'text-celeste' : 'text-texto-2'}`}>
          <Etiqueta tono={x.alAire ? 'bien' : 'neutro'}>{x.alAire ? 'Al aire' : ESTADO[x.estado]}</Etiqueta>
          <span className="num">{rango(x)}</span><span>· {x.diasConGasto} días con gasto</span>
        </span>
      </span>
    </div>
  )
}

function Comparacion({ c }: { c: NonNullable<ReturnType<typeof compararCampanas>> }) {
  return (
    <Panel rotulo="Comparar dos" titulo="Lado a lado" retraso={120} extra={c.diasDistintos ? <Etiqueta tono="ojo">Corrieron días distintos</Etiqueta> : <Etiqueta tono="bien">Mismos días: todo se compara</Etiqueta>}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Ranura letra="A" x={c.a} />
        <Ranura letra="B" x={c.b} />
      </div>
      {c.aviso && <Aviso tono="ojo" className="mt-3">{c.aviso}</Aviso>}
      <div className="sin-barra mt-3 overflow-x-auto">
        <table className="w-full text-[12.5px] sm:text-[13px]">
          <thead>
            <tr>
              <th scope="col" className="border-b border-borde pb-2 pr-2 sm:pr-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.16em] text-texto-2">Métrica</th>
              <th scope="col" className="border-b border-borde pb-2 pr-2 sm:pr-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.16em] text-marino">A</th>
              <th scope="col" className="border-b border-borde pb-2 pr-2 sm:pr-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.16em] text-acento">B</th>
              <th scope="col" className="border-b border-borde pb-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.16em] text-texto-2">B frente a A</th>
            </tr>
          </thead>
          <tbody>
            {c.metricas.map((m) => <FilaMetrica key={m.id} m={m} />)}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function FilaMetrica({ m }: { m: MetricaComparada }) {
  const tono: Tono = !m.comparable || m.mejorEs === 'informativo' ? 'neutro' : tonoDelta(m.delta, m.mejorEs)
  const color = tono === 'bien' ? 'text-bien' : tono === 'mal' ? 'text-mal' : 'text-texto-3'
  const flecha = tono === 'bien' || tono === 'mal' ? (m.delta! > 0 ? '↑' : '↓') : ''
  return (
    <tr className={`transition-colors hover:bg-superficie-2/60 ${m.comparable ? '' : 'text-texto-3'}`}>
      <td className="border-b border-borde/70 py-2 pr-2 sm:pr-3 leading-snug">{m.nombre}{!m.comparable && <span className="ml-1.5 hidden whitespace-nowrap text-[11px] sm:inline">· suma, no se compara</span>}</td>
      <td className={`num whitespace-nowrap border-b border-borde/70 py-2 pr-2 sm:pr-3 text-right ${m.comparable ? 'font-medium text-texto' : ''}`}>{formato(m.a, m.unidad)}</td>
      <td className={`num whitespace-nowrap border-b border-borde/70 py-2 pr-2 sm:pr-3 text-right ${m.comparable ? 'font-medium text-texto' : ''}`}>{formato(m.b, m.unidad)}</td>
      <td className={`num whitespace-nowrap border-b border-borde/70 py-2 text-right ${color}`}>{m.comparable && m.delta != null ? <><span aria-hidden="true">{flecha}</span> {m.delta > 0 ? '+' : m.delta < 0 ? '−' : ''}{pct(Math.abs(m.delta))}</> : '—'}</td>
    </tr>
  )
}
