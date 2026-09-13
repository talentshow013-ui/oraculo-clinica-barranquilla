import { motor } from "@/lib/datos";
import { Etiqueta, Panel, Titulo } from "@/components/ui";

export default async function Consejo() {
  const r = await motor();

  return (
    <>
      <Titulo sub="Siete marcos publicados, con su fuente, aplicados como lista de verificación sobre los datos reales. No se simula a nadie ni se le ponen palabras en la boca.">
        Mesa de consultores
      </Titulo>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {r.lentes.map((l) => (
          <Panel key={l.id} titulo={l.nombre} ayuda={l.fuente} accion={
            <div className="flex gap-1">
              {l.cumplidos > 0 && <Etiqueta tono="bien">{l.cumplidos} ok</Etiqueta>}
              {l.fallidos > 0 && <Etiqueta tono="mal">{l.fallidos} fallan</Etiqueta>}
              {l.sinDato > 0 && <Etiqueta>{l.sinDato} sin dato</Etiqueta>}
            </div>
          }>
            <p className="text-sm text-texto-2">{l.paraQue}</p>
            <ul className="mt-3 space-y-2">
              {l.criterios.map((c) => (
                <li key={c.criterio} className="rounded border border-borde bg-superficie-2 p-2">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${c.cumple === true ? "bg-bien" : c.cumple === false ? "bg-mal" : "bg-texto-3"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-texto">{c.criterio}</div>
                      <div className="text-[11px] text-texto-3">Se responde con: {c.datoPanel}</div>
                      {c.cumple === false && <div className="mt-1 text-xs text-ojo">{c.accionSiFalla}</div>}
                      {c.cumple === null && <div className="mt-1 text-[11px] text-texto-3">Sin dato suficiente para responder.</div>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  );
}
