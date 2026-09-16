'use client'
import { useMemo, useState, type ReactNode } from 'react'

/**
 * Tabla que se ORDENA al tocar la cabecera. Recibe filas ya formateadas (para pintar) y sus
 * valores crudos (para ordenar): `null` va siempre al final, nunca se trata como 0.
 */
export type FilaOrdenable = { clave: string; crudo: Record<string, number | string | null>; celdas: Record<string, ReactNode> }
export default function Ordenable({ columnas, filas, inicial, desc = true, mostrar, minAncho = 640, prefijoId }: { columnas: { id: string; nombre: string; num?: boolean; ancho?: string }[]; filas: FilaOrdenable[]; inicial?: string; desc?: boolean; /** enseña las primeras N y un botón «Ver los M» */ mostrar?: number; minAncho?: number; /** cada fila recibe id=`${prefijoId}-${clave}` para que un hallazgo pueda enlazarla */ prefijoId?: string }) {
  const [orden, setOrden] = useState<{ id: string; desc: boolean }>({ id: inicial ?? columnas[0]!.id, desc })
  const [todas, setTodas] = useState(false)
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
              <th key={c.id} scope="col" aria-sort={orden.id === c.id ? (orden.desc ? 'descending' : 'ascending') : 'none'} className={`group border-b border-borde pb-2 pr-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-texto-2 ${c.num ? 'text-right' : 'text-left'}`} style={{ width: c.ancho }}>
                <button type="button" onClick={() => setOrden((o) => ({ id: c.id, desc: o.id === c.id ? !o.desc : true }))} className={`relative inline-flex items-center gap-1 hover:text-texto ${orden.id === c.id ? 'text-texto' : ''}`}>
                  {c.nombre}
                  {/* la flecha solo ocupa sitio en la columna activa; en las demás aparece al pasar, sin ensanchar */}
                  <span aria-hidden="true" className={`text-[9px] transition-opacity ${orden.id === c.id ? 'opacity-100' : 'absolute opacity-0 group-hover:opacity-40'}`}>{orden.id === c.id && !orden.desc ? '▲' : '▼'}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(mostrar && !todas ? lista.slice(0, mostrar) : lista).map((f) => (
            <tr key={f.clave} id={prefijoId ? `${prefijoId}-${f.clave}` : undefined} className="scroll-mt-4 transition-colors hover:bg-superficie-2/60 target:bg-acento/10 target:ring-2 target:ring-acento">
              {columnas.map((c) => <td key={c.id} className={`border-b border-borde/70 py-2 pr-2 align-middle ${c.num ? 'num text-right' : ''}`}>{f.celdas[c.id] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {mostrar != null && !todas && lista.length > mostrar && (
        <div className="mt-3 flex justify-center"><button type="button" onClick={() => setTodas(true)} className="rounded-full bg-superficie-2 px-4 py-2 text-[12.5px] font-medium text-texto ring-1 ring-borde transition-colors hover:bg-hielo">Ver los {lista.length}</button></div>
      )}
    </div>
  )
}
