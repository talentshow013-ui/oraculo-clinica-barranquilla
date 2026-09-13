'use client'
import { useEffect, useRef, useState } from 'react'
import type { Unidad } from '@/lib/tipos'
import { formatear } from '@/lib/format'

/**
 * La cifra se CUENTA desde cero al entrar en pantalla (1,1 s, suavizado). `null` sale como «—».
 * 🔴 El HTML del servidor lleva el valor REAL (no 0): así la impresión, una captura o un lector
 * sin JavaScript nunca ven un «$ 0» que no existe. La cuenta empieza solo cuando se ve.
 */
export default function Contar({ valor, unidad, duracion = 1100 }: { valor: number | null | undefined; unidad: Unidad; duracion?: number }) {
  const [v, setV] = useState<number | null>(valor ?? null)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (valor == null) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(valor)
      return
    }
    const el = ref.current
    if (!el) return
    let raf = 0
    const ob = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return
      ob.disconnect()
      setV(0)
      const t0 = performance.now()
      const paso = (t: number) => {
        const k = Math.min(1, (t - t0) / duracion)
        const s = 1 - Math.pow(1 - k, 3)
        setV(valor * s)
        if (k < 1) raf = requestAnimationFrame(paso)
      }
      raf = requestAnimationFrame(paso)
    }, { threshold: 0.2 })
    ob.observe(el)
    return () => {
      ob.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [valor, duracion])
  return <span ref={ref}>{formatear(v, unidad)}</span>
}
