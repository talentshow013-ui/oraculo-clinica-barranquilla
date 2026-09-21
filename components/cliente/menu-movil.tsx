'use client'
import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import SelectorModo, { modoDeRuta } from './selector-modo'
import { esAnclaLocal, itemActivo, partir, useSeccionActiva } from './seccion-activa'

/* las rutas de cada mundo; el selector de modo va arriba del menú (pedido del prompt v2) */
const RUTAS = {
  pauta: [['/panel', 'Centro de mando'], ['/diagnostico', 'Diagnóstico'], ['/oportunidades', 'Oportunidades'], ['/embudo', 'Embudo'], ['/rendimiento', 'Rendimiento'], ['/campanas', 'Campañas'], ['/creativos', 'Creativos'], ['/audiencias', 'Audiencias'], ['/publicos', 'Públicos'], ['/competencia', 'Radar de mercado'], ['/biblioteca', 'Copys exitosos'], ['/consejo', 'Mesa de consultores'], ['/metricas', 'Catálogo de métricas'], ['/informe', 'Informe'], ['/fuentes', 'Fuentes']],
  organico: [['/organico', 'Resumen'], ['/organico?red=instagram#todas', 'Instagram'], ['/organico?red=facebook#todas', 'Facebook'], ['/organico?red=tiktok#todas', 'TikTok'], ['/organico#para-pauta', 'Qué merece pauta'], ['/organico#mejores', 'Mejores publicaciones'], ['/organico#formatos', 'Formatos y horarios'], ['/organico#seguidores', 'Seguidores'], ['/organico#fuente', 'Fuente']],
  google: [['/panel?plataforma=google', 'Pauta Google Ads · Centro de mando'], ['/campanas?plataforma=google', 'Pauta Google Ads · Campañas'], ['/creativos?plataforma=google', 'Pauta Google Ads · Anuncios'], ['/web', 'Sitio web · Resumen'], ['/web#canales', 'Canales y fuentes'], ['/web#paginas', 'Páginas que convierten'], ['/web#eventos', 'Contactos (eventos clave)'], ['/web#fuente', 'Fuente']],
  pacientes: [['/pacientes', 'Resumen'], ['/pacientes#embudo', 'Lead → cita → venta'], ['/pacientes#fuentes', 'Por fuente'], ['/pacientes#semanas', 'Semana a semana'], ['/pacientes#etapas', 'Etapas de Kommo'], ['/pacientes#fuente', 'Fuente']],
} as const
const FONDO = { pauta: 'bg-marino', organico: 'bg-marino-org', google: 'bg-marino-goo', pacientes: 'bg-marino-pac' } as const

/** En pantallas sin riel (tablet, celular), el menú vive en un botón. */
export default function MenuMovil() {
  const [on, setOn] = useState(false)
  const ruta = usePathname()
  const busqueda = useSearchParams()
  const modo = modoDeRuta(ruta, busqueda?.toString())
  /* el ítem marcado sigue la sección que se mira, igual que el riel grande */
  const anclas = RUTAS[modo].map(([a]) => partir(a)).filter((d) => d.ruta === ruta && d.hash).map((d) => d.hash)
  const seccion = useSeccionActiva([...new Set(['resumen', ...anclas])], `${ruta}?${busqueda?.toString() ?? ''}`)
  const red = busqueda?.get('red') ?? null
  return (
    <div className="lg:hidden">
      <button type="button" aria-expanded={on} aria-label="Menú" onClick={() => setOn((v) => !v)} className={`grid h-9 w-9 place-items-center rounded-full text-white ${FONDO[modo]}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d={on ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'} /></svg>
      </button>
      {on && (
        <nav aria-label="Secciones" className={`absolute left-3 right-3 top-[56px] z-40 rounded-[18px] p-2 text-[13px] text-white shadow-xl ${FONDO[modo]}`}>
          <div className="mb-2 flex items-center gap-2 px-1 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">Modo</span>
            <SelectorModo />
          </div>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {RUTAS[modo].map(([a, n]) => {
              const activo = itemActivo(a, ruta, red, seccion)
              const Enlace = esAnclaLocal(a, ruta, busqueda?.toString() ?? '') ? 'a' : Link
              return <Enlace key={a} href={a} aria-current={activo ? 'page' : undefined} onClick={() => { setOn(false); window.setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 60) }} className={`rounded-[10px] px-3 py-2 ${activo ? 'bg-white font-medium text-marino' : 'hover:bg-white/10'}`}>{n}</Enlace>
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
