'use client'
import { useState, type ReactNode } from 'react'

/** Un hallazgo se abre solo cuando se toca: la cabecera siempre visible, el cuerpo entra deslizando. */
export default function Plegable({ cabecera, children, abierto = false, className = '' }: { cabecera: ReactNode; children: ReactNode; abierto?: boolean; className?: string }) {
  const [on, setOn] = useState(abierto)
  return (
    <div className={className}>
      <button type="button" aria-expanded={on} onClick={() => setOn((v) => !v)} className="flex w-full items-center gap-3 text-left">
        <span className="min-w-0 flex-1">{cabecera}</span>
        <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-superficie-2 text-texto-2 transition-transform duration-300 ${on ? 'rotate-90' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 5l7 7-7 7" /></svg>
        </span>
      </button>
      <div className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ gridTemplateRows: on ? '1fr' : '0fr' }}>
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
