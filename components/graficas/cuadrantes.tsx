import type { CSSProperties } from 'react'
import type { EvaluacionCreativo } from '@/lib/tipos'
import { CUADRANTES, etiquetaCreativo } from '@/lib/format/etiquetas'
import { cop, pct } from '@/lib/format'
import { rutaAnuncio } from '@/lib/format/rutas'

/**
 * MATRIZ DE CUADRANTES: gancho (se detienen) en X, costo por resultado en Y (invertido: arriba
 * es barato). Cada creativo es una burbuja del tamaño de su inversión; su color es la decisión.
 * Los «sin señal» van huecos y grises: no se decide sobre ellos.
 */
const COLOR = { escalar: '#15803D', arreglar_gancho: '#B45309', arreglar_oferta: '#2563EB', matar: '#DC2626', sin_senal: '#6B7689' }
export default function Cuadrantes({ creativos, numeros, umbralGancho = 0.26, umbralCosto = 12_000 }: { creativos: EvaluacionCreativo[]; /** número corto por creativo (el de la columna #); sin él, el id */ numeros?: ReadonlyMap<string, number>; umbralGancho?: number; umbralCosto?: number }) {
  const W = 640, H = 380, P = 44
  /* sin video no hay gancho: se usa el CTR de enlace ×18 como proxy, y la burbuja lo dice en su título */
  const gancho = (c: EvaluacionCreativo) => c.hookRate ?? (c.ctrEnlace == null ? null : c.ctrEnlace * 18)
  const conDatos = creativos.filter((c) => gancho(c) != null && c.costoResultado != null)
  const xs = conDatos.map((c) => gancho(c)!), ys = conDatos.map((c) => c.costoResultado!), gs = creativos.map((c) => c.agregado.gasto)
  const xMax = Math.max(umbralGancho * 1.6, ...xs) * 1.05, yMax = Math.max(umbralCosto * 1.6, ...ys) * 1.05, gMax = Math.max(1, ...gs)
  const x = (v: number) => P + (v / xMax) * (W - P * 1.5)
  const y = (v: number) => H - P + (0 - v / yMax) * (H - P * 1.5) // invertido: arriba barato
  const ux = x(umbralGancho), uy = y(umbralCosto)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Matriz de decisión: gancho contra costo por resultado">
      <rect x={P} y={P / 2} width={W - P * 1.5} height={H - P * 1.5} fill="#F4F7FB" rx="10" />
      <rect x={ux} y={P / 2} width={W - P / 2 - ux} height={uy - P / 2} fill="#15803D" opacity="0.07" />
      <rect x={P} y={P / 2} width={ux - P} height={uy - P / 2} fill="#B45309" opacity="0.06" />
      <rect x={ux} y={uy} width={W - P / 2 - ux} height={H - P - uy} fill="#2563EB" opacity="0.06" />
      <rect x={P} y={uy} width={ux - P} height={H - P - uy} fill="#DC2626" opacity="0.06" />
      <line x1={ux} x2={ux} y1={P / 2} y2={H - P} stroke="#B9C7DB" strokeDasharray="4 4" />
      <line x1={P} x2={W - P / 2} y1={uy} y2={uy} stroke="#B9C7DB" strokeDasharray="4 4" />
      <text x={W - P / 2 - 6} y={P / 2 + 14} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#15803D">{CUADRANTES.escalar.nombre.toUpperCase()}</text>
      <text x={P + 6} y={P / 2 + 14} fontSize="10.5" fontWeight="700" fill="#B45309">{CUADRANTES.arreglar_gancho.nombre.toUpperCase()}</text>
      <text x={W - P / 2 - 6} y={H - P - 6} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#2563EB">{CUADRANTES.arreglar_oferta.nombre.toUpperCase()}</text>
      <text x={P + 6} y={H - P - 6} fontSize="10.5" fontWeight="700" fill="#DC2626">{CUADRANTES.matar.nombre.toUpperCase()}</text>
      <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#526077">Se detienen a los 3 s (gancho; sin video, la tasa de clics) →</text>
      <text x={12} y={H / 2} textAnchor="middle" fontSize="10.5" fill="#526077" transform={`rotate(-90 12 ${H / 2})`}>← Costo por resultado (arriba: barato)</text>
      {creativos.map((c, i) => {
        const g = gancho(c)
        const cx = g == null ? P + 14 : x(g)
        const cy = c.costoResultado == null ? H - P - 14 : y(c.costoResultado)
        const r = 7 + Math.sqrt(c.agregado.gasto / gMax) * 20
        const sin = c.cuadrante === 'sin_senal'
        return (
          <a key={c.creativo.id} href={rutaAnuncio(c.creativo.anuncioId)} className="entra-zoom cursor-pointer" style={{ '--retraso': `${200 + i * 60}ms`, transformOrigin: `${cx}px ${cy}px` } as CSSProperties}>
            <circle cx={cx} cy={cy} r={r} fill={sin ? 'transparent' : COLOR[c.cuadrante]} fillOpacity={sin ? 0 : 0.85} stroke={COLOR[c.cuadrante]} strokeWidth={sin ? 1.5 : 0} strokeDasharray={sin ? '3 3' : undefined} />
            <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={sin ? '#6B7689' : '#fff'} className="num">{numeros?.get(c.creativo.id) ?? c.puesto ?? c.creativo.id.replace('cr_', '')}</text>
            <title>{`${etiquetaCreativo(c.creativo)} · ${c.hookRate == null ? `sin video: tasa de clics ${pct(c.ctrEnlace, 2)} como gancho` : `gancho ${pct(c.hookRate)}`} · costo ${cop(c.costoResultado)} · inversión ${cop(c.agregado.gasto)} · ${CUADRANTES[c.cuadrante].nombre}`}</title>
          </a>
        )
      })}
    </svg>
  )
}
