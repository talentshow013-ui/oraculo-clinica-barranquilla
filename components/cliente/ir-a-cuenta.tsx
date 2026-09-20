'use client'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

/** Botón que cambia la cuenta publicitaria elegida (cookie `cuenta`) y lleva al Centro de mando. */
export default function IrACuenta({ cuentaId, children, className = '' }: { cuentaId: string; children: ReactNode; className?: string }) {
  const router = useRouter()
  return (
    <button type="button" className={className} onClick={() => { document.cookie = `cuenta=${encodeURIComponent(cuentaId)}; path=/; max-age=31536000; samesite=lax`; router.push('/panel'); router.refresh() }}>
      {children}
    </button>
  )
}
