'use client'
import { useEffect, useState } from 'react'

/**
 * QUÉ SECCIÓN SE ESTÁ MIRANDO, para que el riel la marque. Antes solo se marcaban las rutas
 * completas: al pulsar «Mejores publicaciones» cambiaba la derecha y la izquierda se quedaba en
 * «Resumen». Ahora la izquierda sigue (1) el ancla que se pulsó, (2) el `#` de la barra y (3) el
 * scroll: la última sección con `id` que ya pasó la línea de lectura (140 px bajo la cabecera).
 * Devuelve el id de esa sección o '' cuando se está arriba del todo.
 */
/** `ruta` incluye la búsqueda (`/organico?red=instagram`): al cambiar el filtro se vuelve a asegurar el salto. */
export function useSeccionActiva(ids: string[], ruta: string): string {
  const [activa, setActiva] = useState('')
  const clave = ids.join('|')
  useEffect(() => {
    if (!ids.length) { setActiva(''); return }
    let marco = 0
    const medir = () => {
      marco = 0
      const linea = 140
      /* la sección que ya pasó la línea y está MÁS ABAJO en la página (por posición, no por orden del riel) */
      let elegida = ''
      let mejor = -Infinity
      let masBaja = ''
      let masBajaTop = -Infinity
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        const top = el.getBoundingClientRect().top
        if (top <= linea && top > mejor) { mejor = top; elegida = id }
        if (top > masBajaTop) { masBajaTop = top; masBaja = id }
      }
      /* al final de la página la última sección cuenta aunque no llegue a la línea */
      if (masBaja && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) elegida = masBaja
      setActiva(elegida)
    }
    const alScroll = () => { if (!marco) marco = requestAnimationFrame(medir) }
    const alHash = () => { const h = location.hash.slice(1); if (h && ids.includes(h)) setActiva(h); alScroll() }
    /* la página entra con animación: cuando ya está pintada, se asegura el salto al `#` (Next a
       veces lo hace antes de que las tarjetas tengan su alto) y se mide de nuevo */
    let usuarioMovio = false
    const movio = () => { usuarioMovio = true }
    const asegurar = () => {
      const h = location.hash.slice(1)
      if (h && ids.includes(h) && !usuarioMovio) document.getElementById(h)?.scrollIntoView({ behavior: 'instant', block: 'start' })
      alHash()
    }
    /* dos veces: al pintar y cuando las fotos ya cargaron y la página tiene su alto definitivo */
    const t = window.setTimeout(asegurar, 350)
    const t2 = window.setTimeout(asegurar, 1300)
    /* si la página CRECE (fotos que llegan) las secciones se corren sin que haya scroll: se vuelve a
       medir, y en los primeros segundos se vuelve a asegurar el salto al `#` */
    const inicio = Date.now()
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { if (Date.now() - inicio < 4000) asegurar(); else alScroll() })
    observador?.observe(document.body)
    window.addEventListener('wheel', movio, { passive: true })
    window.addEventListener('touchmove', movio, { passive: true })
    alHash()
    window.addEventListener('scroll', alScroll, { passive: true })
    window.addEventListener('hashchange', alHash)
    return () => { observador?.disconnect(); window.clearTimeout(t); window.clearTimeout(t2); cancelAnimationFrame(marco); window.removeEventListener('scroll', alScroll); window.removeEventListener('hashchange', alHash); window.removeEventListener('wheel', movio); window.removeEventListener('touchmove', movio) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, ruta])
  return activa
}

/** Parte un destino del riel en ruta, filtro `red` y ancla. */
export function partir(a: string) {
  const [sinHash, hash = ''] = a.split('#')
  const [ruta, busqueda = ''] = sinHash!.split('?')
  return { ruta: ruta!, red: new URLSearchParams(busqueda).get('red'), hash }
}

/**
 * QUÉ ÍTEM VA MARCADO. Las rutas completas (Pauta) se marcan por la ruta. Las anclas de una misma
 * pantalla (Orgánico, Google, Pacientes) se marcan por la SECCIÓN que se está mirando: la que se
 * pulsó, la del `#` de la barra o la que el scroll dejó bajo la cabecera. Los filtros por red
 * (`?red=`) se marcan cuando ese filtro está puesto y se mira «Todas».
 */
export function itemActivo(a: string, ruta: string, red: string | null, seccion: string): boolean {
  const d = partir(a)
  if (d.ruta !== ruta && !(d.hash === '' && d.red == null && ruta.startsWith(d.ruta + '/'))) return false
  if (d.red) return red === d.red && seccion === 'todas'
  if (d.hash) return seccion === d.hash && !(d.hash === 'todas' && red)
  /* la entrada de la pantalla (Resumen / Centro de mando): arriba del todo o en su primer bloque */
  return seccion === '' || seccion === 'resumen' || !a.includes('?') && !GRUPOS_CON_ANCLAS.has(ruta)
}
const GRUPOS_CON_ANCLAS = new Set(['/organico', '/web', '/pacientes'])


/**
 * ¿Este destino es un ancla de LA MISMA pantalla? Entonces no hay que pedirle nada al servidor:
 * con `<Link>` Next volvía a traer la página entera (con el motor detrás, 4–5 s) antes de saltar,
 * y la persona veía que «no pasaba nada». Un `<a>` nativo salta al instante y dispara `hashchange`.
 */
export function esAnclaLocal(a: string, ruta: string, busquedaActual: string): boolean {
  const d = partir(a)
  if (!d.hash || d.ruta !== ruta) return false
  const redActual = new URLSearchParams(busquedaActual).get('red')
  return (d.red ?? null) === redActual
}
