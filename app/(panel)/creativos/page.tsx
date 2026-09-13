import { motor } from '@/lib/datos'
import { cop, indice, num, pct } from '@/lib/format'
import { ANGULOS, CUADRANTES } from '@/lib/format/etiquetas'
import { Aviso, Etiqueta, Panel, Titulo, type Tono } from '@/components/ui'
import Ordenable from '@/components/cliente/ordenable'
import Cuadrantes from '@/components/graficas/cuadrantes'

const TONO: Record<string, Tono> = { escalar: 'bien', arreglar_gancho: 'ojo', arreglar_oferta: 'acento', matar: 'mal', sin_senal: 'neutro' }

/** CREATIVOS: la matriz de decisión, la fatiga con su fórmula visible, y «esperar señal» como salida de primera clase. */
export default async function Creativos() {
  const r = await motor()
  const cuenta = (c: string) => r.creativos.filter((x) => x.cuadrante === c).length
  const filas = r.creativos.map((c) => ({
    clave: c.creativo.id,
    crudo: { id: c.creativo.id, titular: c.creativo.titular, cuadrante: c.cuadrante, hook: c.hookRate, hold: c.holdRate, ctr: c.ctrEnlace, costo: c.costoResultado, gasto: c.agregado.gasto, fatiga: c.fatiga.indice, vida: c.vidaUtilDias, dias: c.diasActivo },
    celdas: {
      id: <span className="num font-semibold">{c.creativo.id.replace('cr_', '')}</span>,
      titular: <span className="block max-w-[260px]"><span className="block truncate font-medium">{c.creativo.titular}</span><span className="block truncate text-[11.5px] text-texto-2">{c.creativo.formato} · {ANGULOS[c.creativo.anguloDetectado]} · nivel {c.creativo.nivelConsciencia}</span></span>,
      cuadrante: <Etiqueta tono={TONO[c.cuadrante]}>{CUADRANTES[c.cuadrante].nombre}</Etiqueta>,
      hook: pct(c.hookRate), hold: pct(c.holdRate), ctr: pct(c.ctrEnlace, 2), costo: cop(c.costoResultado), gasto: cop(c.agregado.gasto),
      fatiga: <span title={c.fatiga.formulaVisible} className={c.fatiga.indice != null && c.fatiga.indice >= 0.6 ? 'font-semibold text-mal' : ''}>{indice(c.fatiga.indice)}</span>,
      vida: c.vidaUtilDias == null ? '—' : `${num(c.vidaUtilDias)} d`, dias: `${num(c.diasActivo)} d`,
    },
  }))
  return (
    <>
      <Titulo rotulo="Laboratorio creativo · matriz de decisión" extra={<div className="flex flex-wrap gap-1">{(['escalar', 'arreglar_gancho', 'arreglar_oferta', 'matar', 'sin_senal'] as const).map((c) => <Etiqueta key={c} tono={TONO[c]}>{cuenta(c)} {CUADRANTES[c].nombre.toLowerCase()}</Etiqueta>)}</div>}>Qué anuncio escalar y cuál apagar</Titulo>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Panel rotulo="Gancho × costo por resultado" titulo="La matriz: cada burbuja es un anuncio, su tamaño es la inversión" className="lg:col-span-8"><Cuadrantes creativos={r.creativos} /></Panel>
        <div className="flex flex-col gap-3 lg:col-span-4">
          <Panel tono="marina" rotulo="Fatiga · fórmula visible" titulo="Cómo se calcula">
            <p className="text-[13px] leading-snug text-[#EAF2FF]">{r.creativos[0]?.fatiga.formulaVisible}. Una caída de CTR con frecuencia estable es ruido; con la frecuencia subiendo es agotamiento real. De 0 a 1.</p>
            {r.creativos.filter((c) => (c.fatiga.indice ?? 0) >= 0.6).map((c) => <p key={c.creativo.id} className="mt-2 rounded-[12px] bg-mal/20 px-3 py-2 text-[13px] text-white ring-1 ring-mal/40">«{c.creativo.titular}» va en {indice(c.fatiga.indice)}: le quedan ~{num(c.vidaUtilDias)} días. Ten el siguiente listo.</p>)}
          </Panel>
          <Aviso tono="neutro">«Esperar señal» no es un caso borde: con menos de 40.000 impresiones o 12 resultados no se decide. Matar un creativo bueno por ruido cuesta más que esperar tres días.</Aviso>
        </div>
      </div>
      <Panel rotulo="Todos los creativos" titulo="Toca una cabecera para ordenar" className="mt-3" retraso={200}>
        <Ordenable inicial="gasto" minAncho={980} columnas={[{ id: 'id', nombre: '#', ancho: '40px' }, { id: 'titular', nombre: 'Creativo' }, { id: 'cuadrante', nombre: 'Decisión' }, { id: 'hook', nombre: 'Gancho', num: true }, { id: 'hold', nombre: 'Retiene', num: true }, { id: 'ctr', nombre: 'CTR enlace', num: true }, { id: 'costo', nombre: 'Costo/resultado', num: true }, { id: 'gasto', nombre: 'Inversión', num: true }, { id: 'fatiga', nombre: 'Fatiga', num: true }, { id: 'vida', nombre: 'Vida útil', num: true }, { id: 'dias', nombre: 'Al aire', num: true }]} filas={filas} />
        <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[12.5px] text-texto-2 md:grid-cols-2 xl:grid-cols-3">
          {(['escalar', 'arreglar_gancho', 'arreglar_oferta', 'matar', 'sin_senal'] as const).map((c) => <li key={c} className="flex gap-2"><Etiqueta tono={TONO[c]} className="shrink-0">{CUADRANTES[c].nombre}</Etiqueta><span>{CUADRANTES[c].accion}</span></li>)}
        </ul>
      </Panel>
    </>
  )
}
