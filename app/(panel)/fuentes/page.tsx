import type { CSSProperties } from 'react'
import { motor } from '@/lib/datos'
import { fechaHora, fechaLarga } from '@/lib/format/fechas'
import { pct } from '@/lib/format'
import { Aviso, Etiqueta, Panel, Titulo } from '@/components/ui'

/** FUENTES: cobertura, huecos, última actualización y conexiones. Para confiar, o no, en los datos. */
export default async function Fuentes() {
  const r = await motor()
  const dias = r.serie.length
  const cobertura = 1 - r.contexto.huecos.length / dias
  return (
    <>
      <Titulo rotulo="Fuentes · estado de sincronización" extra={<p className="num text-[12.5px] text-texto-2">Cobertura {pct(cobertura)} · {dias} días · generado {fechaHora(r.lote.meta.generadoEn)}</p>}>¿Se puede confiar en estos datos?</Titulo>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {r.fuentes.map((f, i) => (
          <section key={f.etiquetaPublica} className={`pieza ${i % 2 ? 'entra-der' : 'entra-izq'} p-4 sm:p-5`} style={{ '--retraso': `${60 + i * 80}ms` } as CSSProperties} aria-label={f.etiquetaPublica}>
            <div className="flex items-start justify-between gap-2">
              <div><p className="rotulo">Fuente</p><h2 className="mt-0.5 text-[18px]">{f.etiquetaPublica}</h2></div>
              <Etiqueta tono={f.conectado ? 'bien' : 'neutro'}>{f.conectado ? 'Conectada' : 'Sin conectar'}</Etiqueta>
            </div>
            <p className="mt-2 text-[13px] leading-snug">{f.detalle}</p>
            <p className="num mt-2 text-[12px] text-texto-2">Última actualización: {fechaHora(f.ultimaActualizacion)}</p>
          </section>
        ))}
      </div>
      <Panel rotulo="Huecos y advertencias" titulo="Lo que hay que saber antes de leer una gráfica" className="mt-3" retraso={300}>
        <div className="flex flex-col gap-2">
          {r.contexto.huecos.map((h) => <Aviso key={h} tono="ojo">Sin datos el {fechaLarga(h)}. Se excluye de los cálculos y se marca rayado en las series; no se rellena con ceros.</Aviso>)}
          {r.lote.meta.advertencias.map((a) => <Aviso key={a} tono="neutro">{a}.</Aviso>)}
          <Aviso tono="acento">{r.privacidad.AVISO_PANEL}</Aviso>
        </div>
      </Panel>
    </>
  )
}
