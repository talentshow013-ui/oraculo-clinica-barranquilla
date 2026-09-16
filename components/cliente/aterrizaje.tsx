'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * ATERRIZAJE de los enlaces con #ancla (`/audiencias#hora`, `/campanas#campana-123`,
 * `/embudo#paso-conversacion`…): la sección o fila destino queda resaltada 2 segundos con un
 * anillo de acento que se desvanece (clases `aterriza` → `aterriza-va`, en globals.css). Lee
 * `window.location.hash` al montar, al cambiar de ruta y en cada `hashchange`. Con
 * `prefers-reduced-motion` la transición dura 0: el anillo se muestra fijo y se quita a los 2 s.
 */
const DURACION = 2000
const DESVANECE = 1100

export default function Aterrizaje() {
  const ruta = usePathname()
  useEffect(() => {
    const temporizadores: ReturnType<typeof setTimeout>[] = []
    let ultimo: HTMLElement | null = null

    const resaltar = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id) return
      const el = document.getElementById(id)
      if (!el) return
      temporizadores.splice(0).forEach(clearTimeout)
      if (ultimo) ultimo.classList.remove('aterriza', 'aterriza-va')
      el.classList.remove('aterriza-va')
      el.classList.add('aterriza')
      ultimo = el
      temporizadores.push(setTimeout(() => el.classList.add('aterriza-va'), DESVANECE))
      temporizadores.push(setTimeout(() => el.classList.remove('aterriza', 'aterriza-va'), DURACION))
    }

    // al montar, el destino puede entrar un instante después del primer pintado
    temporizadores.push(setTimeout(resaltar, 60))
    window.addEventListener('hashchange', resaltar)
    return () => {
      temporizadores.forEach(clearTimeout)
      window.removeEventListener('hashchange', resaltar)
    }
  }, [ruta])
  return null
}
