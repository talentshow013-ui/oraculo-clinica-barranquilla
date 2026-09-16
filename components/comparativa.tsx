import Link from 'next/link'
import type { Comparativa, ColumnaPropia } from '@/lib/tipos'
import { cop, num, pct, ratio } from '@/lib/format'
import { fechaCorta } from '@/lib/format/fechas'
import { Panel } from '@/components/ui'

/**
 * FRENTE A QUIÉN TE COMPARAS. Tres columnas con su fuente declarada: tú (14 días), tu mejor mes de
 * los cargados y el mercado (ranking de Meta frente a la competencia en subasta + radar). La cuarta
 * referencia —tus pacientes— la tiene la clínica: se anota en Campañas.
 */
export default function BloqueComparativa({ c, radar, retraso = 0 }: { c: Comparativa; radar: { competidores: number; cadenciaMercado: number; cadenciaPropia: number | null; ganadores: number; sinDatos: boolean }; retraso?: number }) {
  const filas: { nombre: string; f: (x: ColumnaPropia) => string; mejorEs: 'menor' | 'mayor' }[] = [
    { nombre: 'Costo por conversación', f: (x) => cop(x.costoConversacion), mejorEs: 'menor' },
    { nombre: 'Conversaciones', f: (x) => num(x.conversaciones), mejorEs: 'mayor' },
    { nombre: 'Inversión', f: (x) => cop(x.gasto), mejorEs: 'mayor' },
    { nombre: 'Tasa de clics', f: (x) => pct(x.ctrEnlace), mejorEs: 'mayor' },
    { nombre: 'Costo por mil', f: (x) => cop(x.cpm), mejorEs: 'menor' },
    { nombre: 'Frecuencia', f: (x) => ratio(x.frecuencia), mejorEs: 'menor' },
  ]
  const m = c.mercadoMeta
  return (
    <Panel rotulo="Frente a quién te comparas · cada columna dice de dónde sale" titulo="Tú, tu mejor mes y el mercado" retraso={retraso} extra={<Link href="/diagnostico" className="text-[13px] font-medium text-acento">Cómo se usa en los hallazgos →</Link>}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="overflow-x-auto lg:col-span-7">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.1em] text-texto-2">
                <th className="pb-2 pr-2 font-semibold">Cifra</th>
                <th className="pb-2 pr-2 text-right font-semibold">Tú · {c.tu.etiqueta}<span className="block normal-case tracking-normal text-texto-3">{fechaCorta(c.tu.desde)} – {fechaCorta(c.tu.hasta)}</span></th>
                <th className="pb-2 pr-2 text-right font-semibold">{c.anterior.etiqueta}<span className="block normal-case tracking-normal text-texto-3">{fechaCorta(c.anterior.desde)} – {fechaCorta(c.anterior.hasta)}</span></th>
                <th className="pb-2 text-right font-semibold">Tu mejor mes<span className="block normal-case tracking-normal text-texto-3">{c.mejorMes ? `${c.mejorMes.etiqueta} · ${c.mejorMes.dias} días` : `ningún mes con ${15}+ días`}</span></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.nombre} className="border-t border-borde/70">
                  <td className="py-1.5 pr-2">{f.nombre}</td>
                  <td className="num py-1.5 pr-2 text-right font-semibold">{f.f(c.tu)}</td>
                  <td className="num py-1.5 pr-2 text-right text-texto-2">{f.f(c.anterior)}</td>
                  <td className="num py-1.5 text-right text-texto-2">{c.mejorMes ? f.f(c.mejorMes) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11.5px] text-texto-3">Fuente: Meta, rendimiento diario de la cuenta. «Tu mejor mes» es el de menor costo por conversación entre los {c.mesesConsiderados} meses cargados con 15 días o más de gasto; con 12 meses de historia esta columna se vuelve la referencia fuerte.</p>
        </div>
        <div className="flex flex-col gap-2 lg:col-span-5">
          <div className="rounded-[14px] bg-superficie-2 p-3">
            <p className="rotulo">El mercado según Meta · ranking en subasta</p>
            {m ? (
              <>
                <p className="mt-1 text-[13px] leading-snug">De {num(m.anunciosConDato)} anuncios con dato, <span className="font-semibold text-mal">{num(m.inferior)}</span> {m.inferior === 1 ? 'está' : 'están'} por debajo de la competencia que pelea el mismo público, {num(m.igual)} como la competencia y <span className="font-semibold text-bien">{num(m.mejor)}</span> por encima. {num(m.sinDato)} sin dato todavía (anuncios nuevos).</p>
                <p className="mt-1 text-[11.5px] text-texto-3">Fuente: Meta compara cada anuncio con anuncios de otros anunciantes por el mismo público, capturado el {fechaCorta(m.fecha)}. <Link href="/creativos" className="font-medium text-acento">Ver por anuncio →</Link></p>
              </>
            ) : (
              <p className="mt-1 text-[13px] text-texto-2">Meta no entregó ranking para esta cuenta: sin dato, no se inventa.</p>
            )}
          </div>
          <div className="rounded-[14px] bg-superficie-2 p-3">
            <p className="rotulo">El mercado según el radar · Biblioteca de anuncios</p>
            {radar.sinDatos ? (
              <p className="mt-1 text-[13px] text-texto-2">Todavía no se ha capturado la competencia.</p>
            ) : (
              <>
                <p className="mt-1 text-[13px] leading-snug">{num(radar.competidores)} competidores observados en Barranquilla; {num(radar.ganadores)} anuncios llevan 60+ días al aire. Lanzan {num(radar.cadenciaMercado, 1)} anuncios nuevos por semana entre todos; la clínica, {num(radar.cadenciaPropia, 1)}.</p>
                <p className="mt-1 text-[11.5px] text-texto-3">Fuente: Biblioteca de anuncios de Meta (pública); cada anuncio tiene su enlace para verificarlo. <Link href="/competencia" className="font-medium text-acento">Abrir el radar →</Link></p>
              </>
            )}
          </div>
          <div className="rounded-[14px] border border-dashed border-borde-fuerte p-3">
            <p className="rotulo">Tus pacientes · la referencia que falta</p>
            <p className="mt-1 text-[13px] leading-snug text-texto-2">Costo por cita y por paciente aparecen cuando la clínica anota los resultados por campaña. Es la única comparación que Meta no puede dar. <Link href="/campanas" className="font-medium text-acento">Anotar en Campañas →</Link></p>
          </div>
        </div>
      </div>
    </Panel>
  )
}
