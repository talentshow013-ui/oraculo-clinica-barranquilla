'use client'
import { useMemo, useState, type ReactNode } from 'react'

/**
 * Tabla que se ORDENA al tocar la cabecera. Recibe filas ya formateadas (para pintar) y sus
 * valores crudos (para ordenar): `null` va siempre al final, nunca se trata como 0.
 */
export type FilaOrdenable = { clave: string; crudo: Record<string, number | string | null>; celdas: Record<string, ReactNode> }
export default function Ordenable({ columnas, filas, inicial, minAncho = 640 }: { columnas: { id: string; nombre: string; num?: boolean; ancho?: string }[]; filas: FilaOrdenable[]; inicial?: string; minAncho?: number }) {
  const [orden, setOrden] = useState<{ id: string; desc: boolean }>({ id: inicial ?? columnas[0]!.id, desc: true })
  const lista = useMemo(() => {
    const l = [...filas]
    l.sort((a, b) => {
      const x = a.crudo[orden.id], y = b.crudo[orden.id]
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')
      return orden.desc ? -c : c
    })
    return l
  }, [filas, orden])
  return (
    <div className="sin-barra overflow-x-auto">
      <table className="w-full text-[13px]" style={{ minWidth: minAncho }}>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.id} scope="col" aria-sort={orden.id === c.id ? (orden.desc ? 'descending' : 'ascending') : 'none'} className={`border-b border-borde pb-2 pr-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-texto-2 ${c.num ? 'text-right' : 'text-left'}`} style={{ width: c.ancho }}>
                <button type="button" onClick={() => setOrden((o) => ({ id: c.id, desc: o.id === c.id ? !o.desc : true }))} className={`inline-flex items-center gap-1 hover:text-texto ${orden.id === c.id ? 'text-texto' : ''}`}>
                  {c.nombre}
                  <span aria-hidden="true" className={`text-[9px] transition-opacity ${orden.id === c.id ? 'opacity-100' : 'opacity-30'}`}>{orden.id === c.id && !orden.desc ? '▲' : '▼'}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.map((f) => (
            <tr key={f.clave} className="transition-colors hover:bg-superficie-2/60">
              {columnas.map((c) => <td key={c.id} className={`border-b border-borde/70 py-2 pr-3 align-middle ${c.num ? 'num text-right' : ''}`}>{f.celdas[c.id] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
