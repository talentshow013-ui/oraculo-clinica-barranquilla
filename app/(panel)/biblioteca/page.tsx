import type { CSSProperties } from 'react'
import { motor } from '@/lib/datos'
import { cop, num, pct } from '@/lib/format'
import { ANGULOS, CUADRANTES, etiquetaCreativo } from '@/lib/format/etiquetas'
import type { Angulo } from '@/lib/tipos'
import { Etiqueta, Miniatura, Panel, Titulo } from '@/components/ui'
import Plegable from '@/components/cliente/plegable'
import { urlAnuncioBiblioteca } from '@/lib/competitive/enlaces'

const TONO = { escalar: 'bien', arreglar_gancho: 'ojo', arreglar_oferta: 'acento', matar: 'mal', sin_senal: 'neutro' } as const

/** COPYS EXITOSOS: los textos de anuncio propios con más resultados y menor costo, para escribir la próxima pieza. Debajo, cómo arma el mercado cada ángulo. */
export default async function Biblioteca() {
  const r = await motor()
  // r.creativos ya viene del mejor al peor (puesto 1..n); el orden aquí es solo defensa.
  // Solo los que tienen texto: una publicación impulsada sin copy no enseña cómo escribir la siguiente.
  const propios = [...r.creativos].filter((c) => c.creativo.copyPrincipal.trim().length >= 20).sort((a, b) => (a.puesto ?? Infinity) - (b.puesto ?? Infinity)).slice(0, 10)
  const porAngulo = new Map<Angulo, typeof r.radar.ganadores>()
  if (!r.radar.sinDatos) r.radar.ganadores.forEach((a) => porAngulo.set(a.anguloDetectado, [...(porAngulo.get(a.anguloDetectado) ?? []), a]))
  return (
    <>
      <Titulo rotulo="Copys exitosos · para escribir la próxima pieza" extra={<p className="text-[12.5px] text-texto-2">Los textos de anuncio propios con más resultados y menor costo, para escribir la próxima pieza</p>}>Los copys que más te funcionaron</Titulo>
      <section aria-label="Copys propios">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {propios.map((c, i) => {
            const largo = c.creativo.copyPrincipal.length > 220
            const marina = i === 0
            return (
              <article key={c.creativo.id} className={`${marina ? 'pieza-marina' : 'pieza'} ${i % 2 ? 'entra-der' : 'entra-izq'} flex flex-col p-4`} style={{ '--retraso': `${60 + i * 70}ms` } as CSSProperties}>
                <div className="flex items-start justify-between gap-2">
                  <p className={`rotulo ${marina ? 'text-celeste' : ''}`}><span className="num">#{c.puesto}</span> · {ANGULOS[c.creativo.anguloDetectado]}</p>
                  <Etiqueta tono={TONO[c.cuadrante]}>{CUADRANTES[c.cuadrante].nombre}</Etiqueta>
                </div>
                <h3 className={`mt-1.5 text-[17px] ${marina ? 'text-white' : ''}`}>{etiquetaCreativo(c.creativo)}</h3>
                {largo ? (
                  <Plegable className="mt-1.5" cabecera={<p className={`line-clamp-4 text-[13.5px] leading-snug ${marina ? 'text-[#EAF2FF]' : ''}`}>«{c.creativo.copyPrincipal}»</p>}>
                    <p className={`mt-1 text-[13.5px] leading-snug ${marina ? 'text-[#EAF2FF]' : ''}`}>«{c.creativo.copyPrincipal}»</p>
                  </Plegable>
                ) : (
                  <p className={`mt-1.5 text-[13.5px] leading-snug ${marina ? 'text-[#EAF2FF]' : ''}`}>«{c.creativo.copyPrincipal}»</p>
                )}
                <p className={`num mt-auto pt-3 text-[12px] ${marina ? 'text-celeste' : 'text-texto-2'}`}>{num(c.agregado.resultados)} resultados · costo por resultado {cop(c.costoResultado)} · gancho {pct(c.hookRate)}</p>
              </article>
            )
          })}
        </div>
      </section>
      {porAngulo.size > 0 && (
        <section className="mt-6" aria-label="Estructuras del mercado por ángulo">
          <div className="mb-3"><p className="rotulo">Del mercado · estructura, no copy</p><h2 className="mt-0.5 text-[19px]">Cómo arman los ganadores cada ángulo</h2></div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {[...porAngulo.entries()].map(([ang, lista], i) => (
              <Panel key={ang} rotulo={`${lista.length} ${lista.length === 1 ? 'ganador' : 'ganadores'} de 60+ días`} titulo={ANGULOS[ang]} retraso={120 + i * 70}>
                <ul className="flex flex-col gap-2">
                  {lista.slice(0, 3).map((a) => (
                    <li key={a.anuncioId} className="grid grid-cols-[56px_1fr] gap-3 rounded-[14px] bg-superficie-2/70 p-2.5">
                      <Miniatura url={a.urlMedia} tipo={a.tipoMedia} alt={`Anuncio de ${a.nombreAnunciante}`} className="aspect-square" />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 text-[12.5px]"><span className="font-medium">{a.nombreAnunciante}</span><span className="num text-texto-2">{a.diasCorriendo} días · ×{a.variantesDelConcepto}</span><a href={urlAnuncioBiblioteca(a.anuncioId)} target="_blank" rel="noopener noreferrer" className="font-medium text-acento" title="Abrir en la Biblioteca de anuncios de Meta">Verificar ↗</a></p>
                        <p className="mt-0.5 line-clamp-4 text-[12.5px] leading-snug text-texto-2">«{a.copy}»</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-texto-3">Estructura: {[a.usaProfesional && 'médico visible', a.usaTestimonio && 'testimonio', a.usaPrecio && 'precio a la vista', a.usaUrgencia && 'urgencia', a.usaGarantia && 'garantía'].filter(Boolean).join(' + ') || 'mensaje directo'} → botón «{a.cta ?? 'sin botón'}»</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
