'use client'
import Link from 'next/link'
import { useState } from 'react'

const RUTAS = [['/panel', 'Centro de mando'], ['/diagnostico', 'Diagnóstico'], ['/oportunidades', 'Oportunidades'], ['/embudo', 'Embudo'], ['/rendimiento', 'Rendimiento'], ['/campanas', 'Campañas'], ['/creativos', 'Creativos'], ['/audiencias', 'Audiencias'], ['/publicos', 'Públicos'], ['/competencia', 'Radar de mercado'], ['/biblioteca', 'Copys exitosos'], ['/consejo', 'Mesa de consultores'], ['/metricas', 'Catálogo de métricas'], ['/informe', 'Informe'], ['/fuentes', 'Fuentes']]

/** En pantallas sin riel (tablet, celular), el menú vive en un botón. */
export default function MenuMovil() {
  const [on, setOn] = useState(false)
  return (
    <div className="lg:hidden">
      <button type="button" aria-expanded={on} aria-label="Menú" onClick={() => setOn((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full bg-marino text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d={on ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
      </button>
      {on && (
        <nav aria-label="Secciones" className="absolute left-3 right-3 top-[56px] z-40 grid grid-cols-2 gap-1 rounded-[18px] bg-marino p-2 text-[13px] text-white shadow-xl sm:grid-cols-3">
          {RUTAS.map(([a, n]) => <Link key={a} href={a!} onClick={() => setOn(false)} className="rounded-[10px] px-3 py-2 hover:bg-white/10">{n}</Link>)}
        </nav>
      )}
    </div>
  )
}
