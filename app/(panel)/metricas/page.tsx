import { motor, resolverMetrica } from '@/lib/datos'
import { formatear } from '@/lib/format'
import { AREAS } from '@/lib/format/etiquetas'
import type { Area } from '@/lib/tipos'
import { Etiqueta, Panel, Titulo } from '@/components/ui'

/** CATÁLOGO: cada métrica con su fórmula y qué decisión cambia. Si no cambia ninguna, no debería existir. */
export default async function Metricas() {
  const r = await motor()
  const familias = [...new Set(r.catalogo.map((m) => m.familia))] as Area[]
  return (
    <>
      <Titulo rotulo={`Catálogo · ${r.catalogo.length} métricas en ${familias.length} familias`} extra={<p className="text-[12.5px] text-texto-2">Las marcadas como maestras van al centro de mando</p>}>Entender una cifra</Titulo>
      <nav aria-label="Familias" className="sin-barra mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {familias.map((f) => <a key={f} href={`#f-${f}`} className="shrink-0 rounded-full bg-superficie px-3 py-1 text-[12.5px] ring-1 ring-borde hover:ring-acento/50">{AREAS[f]} <span className="num text-texto-2">{r.catalogo.filter((m) => m.familia === f).length}</span></a>)}
      </nav>
      <div className="flex flex-col gap-3">
        {familias.map((f, i) => (
          <Panel key={f} id={`f-${f}`} rotulo={`Familia · ${r.catalogo.filter((m) => m.familia === f).length}`} titulo={AREAS[f]} retraso={40 + i * 40}>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {r.catalogo.filter((m) => m.familia === f).map((m) => {
                const v = resolverMetrica(m, r)
                return (
                  <article key={m.id} className="brilla rounded-[14px] bg-superficie-2/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] font-medium leading-tight">{m.nombre}</p>
                      <span className="num shrink-0 text-[15px] font-semibold">{formatear(v.valor, m.unidad)}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-texto-2"><span className="text-texto-3">Fórmula:</span> {m.formula}</p>
                    <p className="mt-0.5 text-[12px] leading-snug"><span className="text-texto-3">Cambia:</span> {m.porQueImporta}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1"><Etiqueta tono="neutro">mejor {m.mejorEs === 'mayor' ? 'alta' : m.mejorEs === 'menor' ? 'baja' : 'en rango'}</Etiqueta>{m.maestra && <Etiqueta tono="acento">maestra</Etiqueta>}</div>
                  </article>
                )
              })}
            </div>
          </Panel>
        ))}
      </div>
    </>
  )
}
