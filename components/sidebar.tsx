'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import SelectorModo, { modoDeRuta } from './cliente/selector-modo'
import { IconoRed } from './iconos-redes'

const t = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const I = (d: ReactNode) => <svg width="18" height="18" viewBox="0 0 24 24" {...t} aria-hidden="true">{d}</svg>

/** Cuatro grupos, como pide el prompt: decidir · entender · mercado · confiar. */
/** En modo Orgánico el riel muestra solo sus bloques (anclas de /organico). */
const GRUPOS_ORGANICO: { titulo: string; rutas: { a: string; nombre: string; icono: ReactNode }[] }[] = [
  { titulo: 'Orgánico', rutas: [
    { a: '/organico', nombre: 'Resumen', icono: I(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></>) },
    { a: '/organico?red=instagram#todas', nombre: 'Instagram', icono: <IconoRed red="instagram" tam={18} /> },
    { a: '/organico?red=facebook#todas', nombre: 'Facebook', icono: <IconoRed red="facebook" tam={18} /> },
    { a: '/organico?red=tiktok#todas', nombre: 'TikTok', icono: <IconoRed red="tiktok" tam={18} /> },
    { a: '/organico#para-pauta', nombre: 'Qué merece pauta', icono: I(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></>) },
    { a: '/organico#mejores', nombre: 'Mejores publicaciones', icono: I(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3z" /></>) },
    { a: '/organico#formatos', nombre: 'Formatos y horarios', icono: I(<><path d="M4 19V10M10 19V5M16 19v-8M22 19H2" /></>) },
    { a: '/organico#seguidores', nombre: 'Seguidores', icono: I(<><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 18a4 4 0 0 1 7 0" /></>) },
    { a: '/organico#fuente', nombre: 'Fuente', icono: I(<><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /></>) },
  ] },
]

/** En modo Google el riel muestra los bloques de /web. */
const GRUPOS_GOOGLE: { titulo: string; rutas: { a: string; nombre: string; icono: ReactNode }[] }[] = [
  { titulo: 'Sitio web', rutas: [
    { a: '/web', nombre: 'Resumen', icono: I(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></>) },
    { a: '/web#canales', nombre: 'Canales y fuentes', icono: I(<><path d="M4 19V10M10 19V5M16 19v-8M22 19H2" /></>) },
    { a: '/web#paginas', nombre: 'Páginas que convierten', icono: I(<><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h6M9 16h6M15 3v4h4" /></>) },
    { a: '/web#eventos', nombre: 'Contactos (eventos clave)', icono: I(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></>) },
    { a: '/web#ciudades', nombre: 'Ciudades', icono: I(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12l6-6" /></>) },
    { a: '/web#fuente', nombre: 'Fuente', icono: I(<><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /></>) },
  ] },
]

const GRUPOS: { titulo: string; rutas: { a: string; nombre: string; icono: ReactNode }[] }[] = [
  { titulo: 'Decidir', rutas: [
    { a: '/panel', nombre: 'Centro de mando', icono: I(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 4v3M12 17v3M4 12h3M17 12h3" /></>) },
    { a: '/diagnostico', nombre: 'Diagnóstico', icono: I(<><path d="M9 3h6l1 4h3l-1 14H6L5 7h3z" /><path d="M9 11h6M9 15h4" /></>) },
    { a: '/oportunidades', nombre: 'Oportunidades', icono: I(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></>) },
    { a: '/informe', nombre: 'Informe', icono: I(<><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h6M9 16h6M15 3v4h4" /></>) },
  ] },
  { titulo: 'Entender', rutas: [
    { a: '/embudo', nombre: 'Embudo', icono: I(<><path d="M3 5h18l-7 8v6l-4 2v-8z" /></>) },
    { a: '/rendimiento', nombre: 'Rendimiento', icono: I(<><path d="M4 19V10M10 19V5M16 19v-8M22 19H2" /></>) },
    { a: '/campanas', nombre: 'Campañas', icono: I(<><path d="M4 6h9M4 12h13M4 18h7" /><circle cx="18" cy="6" r="2" /><circle cx="15" cy="18" r="2" /></>) },
    { a: '/creativos', nombre: 'Creativos', icono: I(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3z" /></>) },
    { a: '/audiencias', nombre: 'Audiencias', icono: I(<><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 18a4 4 0 0 1 7 0" /></>) },
    { a: '/publicos', nombre: 'Públicos', icono: I(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></>) },
  ] },
  { titulo: 'Mercado', rutas: [
    { a: '/competencia', nombre: 'Radar de mercado', icono: I(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12l6-6" /></>) },
    { a: '/biblioteca', nombre: 'Copys exitosos', icono: I(<><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M8 8h8M8 12h8M8 16h5" /></>) },
    { a: '/consejo', nombre: 'Mesa de consultores', icono: I(<><path d="M4 20h16M6 20V9l6-5 6 5v11" /><path d="M10 20v-5h4v5" /></>) },
  ] },
  { titulo: 'Confiar', rutas: [
    { a: '/metricas', nombre: 'Catálogo de métricas', icono: I(<><path d="M4 6h16M4 12h10M4 18h13" /></>) },
    { a: '/fuentes', nombre: 'Fuentes', icono: I(<><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>) },
  ] },
]

/**
 * CADA MODO ES OTRO MUNDO: el riel cambia de color (Pauta marino; Orgánico marino con matiz
 * violeta/rosa; Google azul-verde) y el rótulo bajo ORÁCULO dice en qué mundo se está.
 */
export const PIEL_MODO = {
  pauta: { riel: 'bg-marino', claro: 'text-celeste', claroTenue: 'text-celeste/70', punto: '#2563EB', rotulo: (cliente: string, sede: string) => `${cliente} · ${sede}` },
  organico: { riel: 'bg-marino-org', claro: 'text-rosa', claroTenue: 'text-rosa/70', punto: '#E879F9', rotulo: () => 'Orgánico · Instagram, Facebook y TikTok' },
  google: { riel: 'bg-marino-goo', claro: 'text-menta', claroTenue: 'text-menta/70', punto: '#2DD4BF', rotulo: () => 'Sitio web · Google Analytics' },
} as const

export default function Sidebar({ cliente, sede }: { cliente: string; sede: string }) {
  const ruta = usePathname()
  const modo = modoDeRuta(ruta)
  const grupos = modo === 'organico' ? GRUPOS_ORGANICO : modo === 'google' ? GRUPOS_GOOGLE : GRUPOS
  const piel = PIEL_MODO[modo]
  return (
    <aside className={`no-imprimir sticky top-0 hidden h-[100svh] w-[232px] shrink-0 flex-col text-[#EAF2FF] transition-colors duration-500 lg:flex ${piel.riel}`} aria-label="Secciones">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="7" className={piel.claro} /><circle cx="12" cy="12" r="2.2" fill={piel.punto} stroke="none" /></svg>
        </span>
        <span className="leading-tight">
          <span className="block text-[12.5px] font-semibold tracking-[0.2em]">ORÁCULO</span>
          <span className={`block text-[11.5px] ${piel.claro}`}>{piel.rotulo(cliente, sede.split(',')[0]!)}</span>
        </span>
      </div>
      <div className="px-4 pb-3"><SelectorModo /></div>
      <nav className="sin-barra flex-1 overflow-y-auto px-2.5 pb-4">
        {grupos.map((g) => (
          <div key={g.titulo} className="mb-3">
            <p className={`px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.22em] ${piel.claroTenue}`}>{g.titulo}</p>
            {g.rutas.map((x) => {
              const activo = x.a.includes('#') || x.a.includes('?') ? false : ruta === x.a || ruta.startsWith(x.a + '/')
              return (
                <Link key={x.a} href={x.a} aria-current={activo ? 'page' : undefined} className={`group relative mb-0.5 flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-[13px] transition-colors ${activo ? 'bg-white text-marino' : 'text-[#EAF2FF]/85 hover:bg-white/10 hover:text-white'}`}>
                  <span className={`absolute -left-2.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-acento transition-transform ${activo ? 'scale-y-100' : 'scale-y-0'}`} aria-hidden="true" />
                  <span className={activo ? 'text-acento' : piel.claro}>{x.icono}</span>
                  {x.nombre}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <p className={`px-4 pb-4 text-[10.5px] leading-snug ${piel.claroTenue}`}>Todo dato ausente se muestra como «—». Nunca se inventa un cero.</p>
    </aside>
  )
}
