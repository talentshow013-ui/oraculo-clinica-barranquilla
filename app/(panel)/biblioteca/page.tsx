import type { CSSProperties } from 'react'
import { motor } from '@/lib/datos'
import { cop, pct } from '@/lib/format'
import { ANGULOS, CUADRANTES } from '@/lib/format/etiquetas'
import type { Angulo } from '@/lib/tipos'
import { Etiqueta, Miniatura, Panel, Titulo } from '@/components/ui'

/** BANCO DE MENSAJES: para escribir la próxima pieza. Los propios que ganan, y las estructuras del mercado por ángulo. */
export default async function Biblioteca() {
  const r = await motor()
  const propios = r.creativos.filter((c) => c.cuadrante === 'escalar' || c.cuadrante === 'arreglar_gancho').sort((a, b) => (a.costoResultado ?? 1e12) - (b.costoResultado ?? 1e12))
  const porAngulo = new Map<Angulo, typeof r.radar.ganadores>()
  r.radar.ganadores.forEach((a) => porAngulo.set(a.anguloDetectado, [...(porAngulo.get(a.anguloDetectado) ?? []), a]))
  return (
    <>
      <Titulo rotulo="Banco de mensajes · para escribir la próxima pieza" extra={<p className="text-[12.5px] text-texto-2">{propios.length} mensajes propios que convierten · {porAngulo.size} ángulos con ganadores del mercado</p>}>Lo que ya funcionó, propio y ajeno</Titulo>
      <section aria-label="Mensajes propios ganadores">
        <div className="mb-3"><p className="rotulo">Propios · la oferta ya convierte</p><h2 className="mt-0.5 text-[19px]">Copy que trae citas a buen costo</h2></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {propios.map((c, i) => (
            <article key={c.creativo.id} className={`${i === 0 ? 'pieza-marina' : 'pieza'} ${i % 2 ? 'entra-der' : 'entra-izq'} flex flex-col p-4`} style={{ '--retraso': `${60 + i * 80}ms` } as CSSProperties}>
              <div className="flex items-start justify-between gap-2">
                <p className={`rotulo ${i === 0 ? 'text-celeste' : ''}`}>{c.creativo.formato} · {ANGULOS[c.creativo.anguloDetectado]}</p>
                <Etiqueta tono={c.cuadrante === 'escalar' ? 'bien' : 'ojo'}>{CUADRANTES[c.cuadrante].nombre}</Etiqueta>
              </div>
              <h3 className={`mt-1.5 text-[17px] ${i === 0 ? 'text-white' : ''}`}>{c.creativo.titular}</h3>
              <p className={`mt-1.5 text-[13.5px] leading-snug ${i === 0 ? 'text-[#EAF2FF]' : ''}`}>«{c.creativo.copyPrincipal}»</p>
              <p className={`num mt-auto pt-3 text-[12px] ${i === 0 ? 'text-celeste' : 'text-texto-2'}`}>Costo por cita {cop(c.costoResultado)} · gancho {pct(c.hookRate)} · botón «{c.creativo.cta}» · nivel {c.creativo.nivelConsciencia}</p>
            </article>
          ))}
        </div>
      </section>
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
                      <p className="flex flex-wrap items-center gap-x-2 text-[12.5px]"><span className="font-medium">{a.nombreAnunciante}</span><span className="num text-texto-2">{a.diasCorriendo} días · ×{a.variantesDelConcepto}</span></p>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-texto-2">Estructura: {[a.usaProfesional && 'médico visible', a.usaTestimonio && 'testimonio', a.usaPrecio && 'precio a la vista', a.usaUrgencia && 'urgencia', a.usaGarantia && 'garantía'].filter(Boolean).join(' + ') || 'mensaje directo'} → botón «{a.cta ?? 'sin botón'}» → {a.dominioDestino ?? 'sin destino visible'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </section>
    </>
  )
}
