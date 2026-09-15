import type { CSSProperties } from 'react'
import { motor } from '@/lib/datos'
import { cop, indice, num, pct } from '@/lib/format'
import { ANGULOS, CUADRANTES, etiquetaCreativo } from '@/lib/format/etiquetas'
import { Aviso, Etiqueta, Miniatura, Panel, Titulo, type Tono } from '@/components/ui'
import Ordenable from '@/components/cliente/ordenable'
import Cuadrantes from '@/components/graficas/cuadrantes'

const TONO: Record<string, Tono> = { escalar: 'bien', arreglar_gancho: 'ojo', arreglar_oferta: 'acento', matar: 'mal', sin_senal: 'neutro' }
const PRIMERAS = 20

/**
 * CREATIVOS: que se lea quién ganó. Arriba el podio (los 3 primeros por `puesto`) junto a la
 * matriz; abajo una tabla de 7 columnas —las demás cifras van en un renglón chico bajo el
 * nombre— con las primeras 20 filas y «Ver los N». Antes eran 11 columnas y 95 filas.
 */
export default async function Creativos() {
  const r = await motor()
  const lista = [...r.creativos].sort((a, b) => (a.puesto ?? Infinity) - (b.puesto ?? Infinity))
  const cuenta = (c: string) => lista.filter((x) => x.cuadrante === c).length
  const filas = lista.map((c) => ({
    clave: c.creativo.id,
    crudo: { puesto: c.puesto ?? 0, titular: etiquetaCreativo(c.creativo), cuadrante: c.cuadrante, resultados: c.agregado.resultados, costo: c.costoResultado, gasto: c.agregado.gasto, hook: c.hookRate },
    celdas: {
      puesto: <span className="num font-semibold">{c.puesto}</span>,
      titular: (
        <span className="block max-w-[300px]">
          <span className="block truncate font-medium">{etiquetaCreativo(c.creativo)}</span>
          <span className="num block truncate text-[11.5px] text-texto-2">retiene {pct(c.holdRate, 0)} · clics {pct(c.ctrEnlace)} · fatiga {indice(c.fatiga.indice)} · {num(c.diasActivo)} d al aire</span>
        </span>
      ),
      cuadrante: <Etiqueta tono={TONO[c.cuadrante]}>{CUADRANTES[c.cuadrante].nombre}</Etiqueta>,
      resultados: num(c.agregado.resultados), costo: cop(c.costoResultado), gasto: cop(c.agregado.gasto), hook: pct(c.hookRate),
    },
  }))
  return (
    <>
      <Titulo rotulo="Laboratorio creativo · matriz de decisión" extra={<div className="flex flex-wrap gap-1">{(['escalar', 'arreglar_gancho', 'arreglar_oferta', 'matar', 'sin_senal'] as const).map((c) => <Etiqueta key={c} tono={TONO[c]}>{cuenta(c)} {CUADRANTES[c].nombre.toLowerCase()}</Etiqueta>)}</div>}>Qué anuncio escalar y cuál apagar</Titulo>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section aria-label="Los 3 que más rindieron">
          <div className="mb-2"><p className="rotulo">Podio</p><h2 className="mt-0.5 text-[19px]">Los 3 que más rindieron</h2></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {lista.slice(0, 3).map((c, i) => (
              <article key={c.creativo.id} className={`${i === 0 ? 'pieza-marina' : 'pieza'} entra-zoom flex flex-col overflow-hidden`} style={{ '--retraso': `${60 + i * 80}ms` } as CSSProperties}>
                <div className="relative">
                  <Miniatura url={c.creativo.urlMiniatura} tipo={c.creativo.formato} alt={`Miniatura de «${etiquetaCreativo(c.creativo)}»`} className="aspect-[4/3] w-full rounded-none" />
                  <span className={`num absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold ${i === 0 ? 'bg-acento text-white' : 'bg-marino text-white'}`}>{c.puesto}</span>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                  <p className={`text-[15px] font-medium leading-tight ${i === 0 ? 'text-white' : ''}`}>{etiquetaCreativo(c.creativo)}</p>
                  <Etiqueta tono={TONO[c.cuadrante]}>{CUADRANTES[c.cuadrante].nombre}</Etiqueta>
                  <p className={`num text-[13px] ${i === 0 ? 'text-[#EAF2FF]' : 'text-texto'}`}>{num(c.agregado.resultados)} resultados a {cop(c.costoResultado)}</p>
                  <p className={`num text-[12px] ${i === 0 ? 'text-celeste' : 'text-texto-2'}`}>Inversión {cop(c.agregado.gasto)} · {ANGULOS[c.creativo.anguloDetectado]}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <Panel rotulo="Gancho × costo por resultado" titulo="La matriz: cada burbuja es un anuncio, su tamaño es la inversión"><Cuadrantes creativos={r.creativos} /></Panel>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Panel tono="marina" rotulo="Fatiga · fórmula visible" titulo="Cómo se calcula" className="lg:col-span-7">
          <p className="text-[13px] leading-snug text-[#EAF2FF]">{r.creativos[0]?.fatiga.formulaVisible}. Una caída de clics con frecuencia estable es ruido; con la frecuencia subiendo es agotamiento real. De 0 a 1.</p>
          {[...r.creativos].filter((c) => (c.fatiga.indice ?? 0) >= 0.6).sort((a, b) => b.agregado.gasto - a.agregado.gasto).slice(0, 6).map((c) => <p key={c.creativo.id} className="mt-2 rounded-[12px] bg-mal/20 px-3 py-2 text-[13px] text-white ring-1 ring-mal/40">«{etiquetaCreativo(c.creativo)}» va en {indice(c.fatiga.indice)}: le quedan ~{num(c.vidaUtilDias)} días. Ten el siguiente listo.</p>)}
        </Panel>
        <Aviso tono="neutro" className="lg:col-span-5">«Esperar señal» no es un caso borde: con menos de 40.000 impresiones o 12 resultados no se decide. Matar un creativo bueno por ruido cuesta más que esperar tres días.</Aviso>
      </div>
      <Panel rotulo="Todos los creativos" titulo="Del más exitoso al menos · toca una cabecera para ordenar" className="mt-3" retraso={200}>
        <Ordenable inicial="puesto" desc={false} mostrar={PRIMERAS} minAncho={760} columnas={[{ id: 'puesto', nombre: '#', num: true, ancho: '48px' }, { id: 'titular', nombre: 'Creativo' }, { id: 'cuadrante', nombre: 'Decisión' }, { id: 'resultados', nombre: 'Resultados', num: true }, { id: 'costo', nombre: 'Costo por resultado', num: true }, { id: 'gasto', nombre: 'Inversión', num: true }, { id: 'hook', nombre: 'Gancho', num: true }]} filas={filas} />
        <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[12.5px] text-texto-2 md:grid-cols-2 xl:grid-cols-3">
          {(['escalar', 'arreglar_gancho', 'arreglar_oferta', 'matar', 'sin_senal'] as const).map((c) => <li key={c} className="flex gap-2"><Etiqueta tono={TONO[c]} className="shrink-0">{CUADRANTES[c].nombre}</Etiqueta><span>{CUADRANTES[c].accion}</span></li>)}
        </ul>
      </Panel>
    </>
  )
}
