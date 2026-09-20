import { useId, type ReactNode } from 'react'

/**
 * Íconos de las redes: Instagram, Facebook, TikTok, Google.
 *  - Por defecto son trazo simple y HEREDAN el color del texto (en todo el panel).
 *  - Con `marca`, van en su color de marca (Instagram degradado, Facebook azul, TikTok negro con
 *    sus dos desfases, Google multicolor). Solo se usa en la pastilla de la cabecera.
 */
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const S = (d: ReactNode, tam: number) => <svg width={tam} height={tam} viewBox="0 0 24 24" {...base} aria-hidden="true">{d}</svg>

export const NOMBRE_ICONO_RED: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', google: 'Google' }

export function IconoRed({ red, tam = 15, marca = false }: { red: string; tam?: number; marca?: boolean }) {
  if (marca) return <IconoMarca red={red} tam={tam} />
  if (red === 'instagram') return S(<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none" /></>, tam)
  if (red === 'facebook') return S(<><path d="M14 8h2.5V4.5H14a3.5 3.5 0 0 0-3.5 3.5v2H8v3.5h2.5V21H14v-7.5h2.5L17 10h-3V8z" /></>, tam)
  if (red === 'tiktok') return S(<><path d="M14 4v9.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 4c.5 2.6 2.3 4.2 5 4.5" /></>, tam)
  if (red === 'google') return S(<><circle cx="12" cy="12" r="8.5" /><path d="M12 12h6.5M12 8.5v7" /></>, tam)
  return S(<circle cx="12" cy="12" r="8" />, tam)
}

/** En color de marca. El degradado de Instagram necesita un id único por instancia. */
function IconoMarca({ red, tam }: { red: string; tam: number }) {
  /* `useId` cuadra en servidor y navegador: un contador de módulo rompería la hidratación */
  const id = useId()
  if (red === 'instagram') {
    return (
      <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F9CE34" /><stop offset="0.5" stopColor="#EE2A7B" /><stop offset="1" stopColor="#6228D7" />
          </linearGradient>
        </defs>
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill={`url(#${id})`} />
        <circle cx="12" cy="12" r="4" stroke="#fff" strokeWidth="1.8" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="#fff" />
      </svg>
    )
  }
  if (red === 'facebook') {
    return (
      <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#1877F2" />
        <path d="M13.4 19.5v-6.2h2.1l.3-2.5h-2.4V9.3c0-.7.2-1.2 1.2-1.2h1.3V5.9c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v1.7H8.7v2.5h2.1v6.2z" fill="#fff" />
      </svg>
    )
  }
  if (red === 'tiktok') {
    const nota = 'M13.5 4v9.6a3.2 3.2 0 1 1-3.2-3.2'
    const gancho = 'M13.5 4c.4 2.5 2.1 4 4.7 4.3'
    return (
      <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#0F0F0F" />
        <g transform="translate(-0.7,-0.5)" stroke="#25F4EE"><path d={nota} /><path d={gancho} /></g>
        <g transform="translate(0.7,0.5)" stroke="#FE2C55"><path d={nota} /><path d={gancho} /></g>
        <g stroke="#fff"><path d={nota} /><path d={gancho} /></g>
      </svg>
    )
  }
  if (red === 'google') {
    return (
      <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" strokeWidth="3.2" strokeLinecap="butt" aria-hidden="true">
        <path d="M18 6A8.5 8.5 0 0 0 4.4 9" stroke="#EA4335" />
        <path d="M4.4 9a8.5 8.5 0 0 0 0 6" stroke="#FBBC05" />
        <path d="M4.4 15A8.5 8.5 0 0 0 18 18" stroke="#34A853" />
        <path d="M18 18a8.5 8.5 0 0 0 2.5-5.5" stroke="#4285F4" />
        <path d="M12 12.5h8.5" stroke="#4285F4" />
      </svg>
    )
  }
  return S(<circle cx="12" cy="12" r="8" />, tam)
}
