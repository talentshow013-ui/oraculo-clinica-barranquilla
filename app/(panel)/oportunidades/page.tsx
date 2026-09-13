import { motor } from "@/lib/datos";
import { cop, num } from "@/lib/format";
import { ETIQUETA_ANGULO } from "@/lib/format/etiquetas";
import { Etiqueta, Panel, Titulo, Vacio } from "@/components/ui";

const ORIGEN = { hallazgo: "Desde un hallazgo", espacio_vacio: "Espacio vacío del mercado", ganador_mercado: "Ganador del mercado" } as const;
const TIPO = { creativo: "Anuncio", audiencia: "Audiencia", oferta: "Oferta", proceso: "Proceso", presupuesto: "Presupuesto" } as const;

export default async function Oportunidades() {
  const r = await motor();

  return (
    <>
      <Titulo sub="Una idea sin criterio de corte es una corazonada. Cada oportunidad trae hipótesis, el dato que la sustenta y cómo saber si perdió. Ordenadas por impacto × confianza / esfuerzo.">
        Ideas para mejorar
      </Titulo>

      {r.oportunidades.length === 0 ? (
        <Vacio mensaje="Sin oportunidades: faltan hallazgos o datos del radar." />
      ) : (
        <div className="space-y-4">
          {r.oportunidades.map((o, i) => (
            <Panel key={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-texto-3">{i + 1}.</span>
                    <h2 className="text-base font-semibold text-texto">{o.titulo}</h2>
                    {o.yaProbada && <Etiqueta tono="ojo">Ya se probó y perdió</Etiqueta>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Etiqueta tono="acento">{ORIGEN[o.origen]}</Etiqueta>
                    <Etiqueta>{TIPO[o.tipoPrueba]}</Etiqueta>
                    {o.angulo && <Etiqueta>{ETIQUETA_ANGULO[o.angulo]}</Etiqueta>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-texto-3">Prioridad</div>
                  <div className="num text-xl font-semibold text-acento">{num(o.ice, 1)}</div>
                  <div className="num text-[11px] text-texto-3">
                    impacto {o.impacto} · confianza {num(o.confianza * 100)} % · esfuerzo {o.esfuerzo}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm text-texto">{o.hipotesis}</p>

              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-texto-3">Basada en</div>
                  <ul className="mt-1 space-y-0.5 text-sm text-texto-2">
                    {o.basadaEn.map((b, j) => (
                      <li key={j}>· {b}</li>
                    ))}
                  </ul>
                  {o.aprendizajePrevio && <p className="mt-2 text-xs text-ojo">Aprendizaje previo: {o.aprendizajePrevio}</p>}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-texto-3">La prueba</div>
                  <dl className="mt-1 space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-texto-2">Presupuesto</dt>
                      <dd className="num text-texto">{o.prueba.presupuestoCOP === null ? "sin pauta adicional" : cop(o.prueba.presupuestoCOP)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-texto-2">Duración</dt>
                      <dd className="num text-texto">{o.prueba.duracionDias} días</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-texto-2">Métrica de éxito</dt>
                      <dd className="text-right text-texto">{o.prueba.metricaExito}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 rounded border border-borde bg-superficie-2 p-2 text-xs text-texto-2">
                    <span className="font-medium text-texto">Criterio de corte: </span>
                    {o.prueba.criterioCorte}
                  </p>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
