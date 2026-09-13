import type { CSSProperties } from 'react'
import type { AnuncioCompetidor, Angulo, ResultadoRadar } from '@/lib/tipos'
import { ANGULOS, NIVELES_CORTO } from '@/lib/format/etiquetas'

/**
 * MAPA DE ÁNGULOS: ángulo × nivel de consciencia. Cuanto más oscuro, más anuncios del mercado
 * ahí (saturado). Las celdas con aro azul punteado son los ESPACIOS VACÍOS: nadie los ataca.
 */
export default function MapaAngulos({ anuncios, radar }: { anuncios: AnuncioCompetidor[]; radar: ResultadoRadar }) {
  const angulos = radar.mapaAngulos.map((m) => m.angulo)
  const niveles = [1, 2, 3, 4, 5] as const
  const cuenta = new Map<string, number>()
  anuncios.forEach((a) => cuenta.set(`${a.anguloDetectado}|${a.nivelConsciencia}`, (cuenta.get(`${a.anguloDetectado}|${a.nivelConsciencia}`) ?? 0) + 1))
  const max = Math.max(1, ...cuenta.values())
  const vacios = new Set(radar.espaciosVacios.map((e) => `${e.angulo}|${e.nivelConsciencia}`))
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1" style={{ gridTemplateColumns: `150px repeat(5, minmax(56px, 1fr))`, minWidth: 460 }} role="table" aria-label="Mapa de ángulos por nivel de consciencia">
        <span />
        {niveles.map((n) => <span key={n} role="columnheader" className="pb-1 text-center text-[10.5px] font-semibold uppercase tracking-[0.12em] text-texto-2">{n} · {NIVELES_CORTO[n]}</span>)}
        {angulos.map((ang, fi) => (
          <Fila key={ang} ang={ang} fi={fi} niveles={niveles} cuenta={cuenta} max={max} vacios={vacios} saturado={radar.mapaAngulos.find((m) => m.angulo === ang)?.saturado ?? false} />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-texto-2"><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-marino" />Saturado</span><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] bg-marino/25" />Pocos</span><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[4px] ring-2 ring-acento ring-offset-1" />Espacio vacío: nadie lo ataca</span></p>
    </div>
  )
}
function Fila({ ang, fi, niveles, cuenta, max, vacios, saturado }: { ang: Angulo; fi: number; niveles: readonly (1 | 2 | 3 | 4 | 5)[]; cuenta: Map<string, number>; max: number; vacios: Set<string>; saturado: boolean }) {
  return (
    <>
      <span role="rowheader" className="flex items-center gap-1.5 truncate pr-2 text-[12.5px]">{ANGULOS[ang]}{saturado && <span className="rounded-full bg-mal/10 px-1.5 text-[9.5px] font-bold text-mal">SAT.</span>}</span>
      {niveles.map((n, ci) => {
        const k = cuenta.get(`${ang}|${n}`) ?? 0
        const vacio = vacios.has(`${ang}|${n}`)
        const op = k ? 0.18 + (k / max) * 0.82 : 0
        return (
          <span key={n} role="cell" className={`entra-zoom relative grid h-9 place-items-center rounded-[8px] text-[12px] font-semibold ${vacio ? 'ring-2 ring-acento ring-offset-1 ring-offset-superficie' : ''} ${k ? '' : 'bg-superficie-2 text-texto-3'}`} style={{ background: k ? `rgba(11,29,58,${op.toFixed(2)})` : undefined, color: op > 0.5 ? '#fff' : undefined, '--retraso': `${100 + fi * 40 + ci * 25}ms` } as CSSProperties} title={`${ANGULOS[ang]} · nivel ${n}: ${k} ${k === 1 ? 'anuncio' : 'anuncios'}${vacio ? ' · espacio vacío' : ''}`}>
            {k || (vacio ? <span className="text-acento">◎</span> : '·')}
          </span>
        )
      })}
    </>
  )
}
