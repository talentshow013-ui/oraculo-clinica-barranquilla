import type { ReactNode } from 'react'

/** Íconos de las redes (trazo simple, heredan el color): Instagram, Facebook, TikTok, Google. */
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const S = (d: ReactNode, tam: number) => <svg width={tam} height={tam} viewBox="0 0 24 24" {...base} aria-hidden="true">{d}</svg>

export const NOMBRE_ICONO_RED: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', google: 'Google' }

export function IconoRed({ red, tam = 15 }: { red: string; tam?: number }) {
  if (red === 'instagram') return S(<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.3" cy="6.7" r="0.9" fill="currentColor" stroke="none" /></>, tam)
  if (red === 'facebook') return S(<><path d="M14 8h2.5V4.5H14a3.5 3.5 0 0 0-3.5 3.5v2H8v3.5h2.5V21H14v-7.5h2.5L17 10h-3V8z" /></>, tam)
  if (red === 'tiktok') return S(<><path d="M14 4v9.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 4c.5 2.6 2.3 4.2 5 4.5" /></>, tam)
  if (red === 'google') return S(<><circle cx="12" cy="12" r="8.5" /><path d="M12 12h6.5M12 8.5v7" /></>, tam)
  return S(<circle cx="12" cy="12" r="8" />, tam)
}
