import { motor } from "@/lib/datos";
import { cop } from "@/lib/format";
import { ETIQUETA_AREA, ETIQUETA_SEVERIDAD } from "@/lib/format/etiquetas";
import { NOMBRE_REGLA } from "@/lib/diagnostics/rules";
import { Aviso, Etiqueta, Panel, Titulo, Vacio } from "@/components/ui";

export default async function Diagnostico() {
  const r = await motor();

  return (
    <>
      <Titulo sub="Cada hallazgo responde cuatro preguntas: qué pasa, cómo lo sabemos, qué hago y cuánta plata. Ordenados por plata, no por gravedad.">
        ¿En qué estamos fallando?
      </Titulo>

      {r.erroresReglas.length > 0 && (
        <div className="mb-3">
          <Aviso tono="mal" titulo={`${r.erroresReglas.length} revisiones no pudieron ejecutarse`}>
            {r.erroresReglas.map((e) => `${NOMBRE_REGLA[e.reglaId] ?? e.reglaId}: ${e.mensaje}`).join(" · ")}
          </Aviso>
        </div>
      )}

      {r.hallazgos.length === 0 ? (
        <Vacio mensaje="Ningún hallazgo con los datos actuales." />
      ) : (
        <div className="space-y-4">
          {r.hallazgos.map((h, i) => (
            <Panel key={h.reglaId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-texto-3">{i + 1}.</span>
                    <h2 className="text-base font-semibold text-texto">{h.titulo}</h2>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Etiqueta tono={h.severidad === "alta" ? "mal" : h.severidad === "media" ? "ojo" : "neutro"}>{ETIQUETA_SEVERIDAD[h.severidad]}</Etiqueta>
                    <Etiqueta>{ETIQUETA_AREA[h.area]}</Etiqueta>
                    <Etiqueta>{NOMBRE_REGLA[h.reglaId]}</Etiqueta>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-texto-3">Plata en riesgo</div>
                  <div className={`num text-xl font-semibold ${h.plataEnRiesgo === null ? "text-texto-3" : "text-mal"}`}>{cop(h.plataEnRiesgo)}</div>
                </div>
              </div>

              <p className="mt-3 text-sm text-texto-2">{h.explicacion}</p>

              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-texto-3">Cómo lo sabemos</div>
                  <dl className="mt-1 space-y-1">
                    {h.evidencia.map((e, j) => (
                      <div key={j} className="flex justify-between gap-3 border-b border-borde/60 py-1 text-sm">
                        <dt className="text-texto-2">{e.etiqueta}</dt>
                        <dd className="num text-right text-texto">{e.valor}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-texto-3">Qué hacer</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-texto">
                    {h.acciones.map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {h.nota && <p className="mt-3 text-[11px] text-texto-3">{h.nota}</p>}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
