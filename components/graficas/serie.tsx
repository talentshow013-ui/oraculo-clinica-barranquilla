import type { CSSProperties } from 'react'
import type { Agregado } from '@/lib/tipos'
import { fechaCorta } from '@/lib/format/fechas'
import { copCorto, num, pct } from '@/lib/format'

/**
 * SERIE DIARIA en SVG propio: la línea se DIBUJA al entrar, el área se enciende después.
 * Los HUECOS no se rellenan: la línea se corta y el día queda rayado. Los últimos 14 días
 * llevan un velo para leer «14 contra 14» de un vistazo.
 */
export default function Serie({ datos, campo, unidad = 'numero', alto = 200, dias = 60, marcar14 = true }: { datos: { fecha: string; agregado: Agregado | null }[]; campo: keyof Agregado; unidad?: 'numero' | 'cop' | 'porcentaje'; alto?: number; dias?: number; marcar14?: boolean }) {
  const l = datos.slice(-dias)
  const W = 720, H = alto, PI = 44, PD = 8, PT = 10, PB = 26
  const valores = l.map((d) => (d.agregado ? (d.agregado[campo] as number | null) : null))
  const validos = valores.filter((v): v is number => v != null)
  if (!validos.length) return <p className="py-8 text-center text-[13px] text-texto-2">Sin datos en el periodo.</p>
  const max = Math.max(...validos) * 1.08, min = Math.min(0, ...validos)
  const x = (i: number) => PI + (i / Math.max(1, l.length - 1)) * (W - PI - PD)
  const y = (v: number) => PT + (1 - (v - min) / (max - min || 1)) * (H - PT - PB)
  /* tramos: la línea se corta en cada hueco */
  const tramos: string[] = []
  let actual = ''
  valores.forEach((v, i) => {
    if (v == null) { if (actual) tramos.push(actual); actual = ''; return }
    actual += `${actual ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
  })
  if (actual) tramos.push(actual)
  const area = valores.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean)
  const fmt = (v: number) => (unidad === 'cop' ? copCorto(v) : unidad === 'porcentaje' ? pct(v) : num(v))
  const huecos = valores.map((v, i) => (v == null ? i : -1)).filter((i) => i >= 0)
  const ultimo = validos[validos.length - 1]!
  const iUltimo = valores.length - 1 - [...valores].reverse().findIndex((v) => v != null)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Serie diaria de ${String(campo)} en los últimos ${l.length} días`}>
      {[0, 0.5, 1].map((k) => { const v = min + (max - min) * k; return <g key={k}><line x1={PI} x2={W - PD} y1={y(v)} y2={y(v)} stroke="#D9E2EF" strokeDasharray="2 4" /><text x={PI - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#5B6577" className="num">{v === 0 ? '0' : fmt(v)}</text></g> })}
      {marcar14 && l.length > 14 && <rect x={x(l.length - 14)} y={PT} width={x(l.length - 1) - x(l.length - 14)} height={H - PT - PB} fill="#2563EB" opacity="0.06" rx="6" />}
      {huecos.map((i) => <g key={i}><rect x={x(i) - 4} y={PT} width="8" height={H - PT - PB} fill="url(#rayas)" opacity="0.9" /><title>{`${fechaCorta(l[i]!.fecha)}: sin datos`}</title></g>)}
      <defs>
        <pattern id="rayas" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.5" height="4" fill="#B45309" /></pattern>
        <linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2563EB" stopOpacity="0.28" /><stop offset="1" stopColor="#2563EB" stopOpacity="0" /></linearGradient>
      </defs>
      {area.length > 1 && <polygon className="aparece" points={`${area[0]!.split(',')[0]},${y(min)} ${area.join(' ')} ${area[area.length - 1]!.split(',')[0]},${y(min)}`} fill="url(#area)" />}
      {tramos.map((d, i) => <path key={i} d={d.trim()} fill="none" stroke="#2563EB" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" className="traza" style={{ '--retraso': `${150 + i * 200}ms` } as CSSProperties} />)}
      {valores.map((v, i) => v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r="6" fill="transparent"><title>{`${fechaCorta(l[i]!.fecha)}: ${fmt(v)}`}</title></circle>)}
      <g className="aparece" style={{ '--retraso': '1400ms' } as CSSProperties}>
        <circle cx={x(iUltimo)} cy={y(ultimo)} r="4.5" fill="#fff" stroke="#2563EB" strokeWidth="2.2" />
        <text x={Math.min(x(iUltimo), W - 70)} y={y(ultimo) - 10} fontSize="11" fill="#0F172A" className="num" fontWeight="600">{fmt(ultimo)}</text>
      </g>
      {l.map((d, i) => (i % Math.ceil(l.length / 6) === 0 || i === l.length - 1) && <text key={d.fecha} x={x(i)} y={H - 8} textAnchor={i === l.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize="10" fill="#5B6577">{fechaCorta(d.fecha)}</text>)}
      {marcar14 && l.length > 14 && <text x={x(l.length - 14) + 4} y={PT + 12} fontSize="10" fill="#2563EB" fontWeight="600">últimos 14 días</text>}
    </svg>
  )
}
