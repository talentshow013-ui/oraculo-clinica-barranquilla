import { motor } from "@/lib/datos";
import { cop, num, pct } from "@/lib/format";
import { ETIQUETA_ANGULO, ETIQUETA_CUADRANTE, NIVEL_CONSCIENCIA } from "@/lib/format/etiquetas";
import { ANGULOS, type Angulo } from "@/lib/adapters/types";
import { Etiqueta, Panel, Titulo, Vacio } from "@/components/ui";

/** Estructura de un mensaje: lo que se replica. El texto de la competencia nunca se copia. */
function estructura(a: { anguloDetectado: Angulo; nivelConsciencia: number; usaPrecio?: boolean; usaTestimonio?: boolean; usaProfesional?: boolean; usaUrgencia?: boolean; tipoMedia?: string; formato?: string }) {
  const partes = [
    `Ángulo: ${ETIQUETA_ANGULO[a.anguloDetectado]}`,
    `Habla a: ${NIVEL_CONSCIENCIA[a.nivelConsciencia as 1 | 2 | 3 | 4 | 5]}`,
    `Formato: ${a.tipoMedia ?? a.formato ?? "—"}`,
  ];
  const palancas = [a.usaProfesional && "profesional visible", a.usaTestimonio && "testimonio", a.usaPrecio && "precio", a.usaUrgencia && "urgencia"].filter(Boolean);
  if (palancas.length) partes.push(`Palancas: ${palancas.join(", ")}`);
  return partes;
}

export default async function Biblioteca() {
  const r = await motor();
  const propios = r.creativos.filter((c) => c.agregado.gasto > 0).sort((a, b) => (a.costoResultado ?? Infinity) - (b.costoResultado ?? Infinity));
  const mercado = r.radar.ganadores;
  const nombreServicio = (id: string | null) => r.cliente.servicios.find((s) => s.id === id)?.nombre ?? id ?? "—";

  const porAngulo = ANGULOS.filter((a) => a !== "sin_clasificar").map((angulo) => ({
    angulo,
    propios: propios.filter((c) => c.creativo.anguloDetectado === angulo),
    mercado: mercado.filter((m) => m.anguloDetectado === angulo),
  })).filter((g) => g.propios.length + g.mercado.length > 0);

  return (
    <>
      <Titulo sub="Lo que ha funcionado, propio y del mercado, organizado por ángulo. Del mercado se toma la estructura; el texto se escribe desde cero.">
        Banco de mensajes
      </Titulo>

      <div className="mb-4">
        <Panel titulo="Mensajes propios con mejor costo por resultado" ayuda="Solo los que tienen señal suficiente">
          {propios.filter((c) => c.cuadrante !== "sin_senal").length === 0 ? (
            <Vacio mensaje="Todavía no hay anuncios con señal suficiente para elegir un ganador." />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {propios
                .filter((c) => c.cuadrante !== "sin_senal")
                .slice(0, 6)
                .map((c) => (
                  <div key={c.creativo.id} className="rounded border border-borde bg-superficie-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Etiqueta tono={c.cuadrante === "escalar" ? "bien" : c.cuadrante === "matar" ? "mal" : "ojo"}>{ETIQUETA_CUADRANTE[c.cuadrante]}</Etiqueta>
                      <span className="num text-xs text-texto-2">{cop(c.costoResultado)} / resultado</span>
                    </div>
                    <p className="mt-2 text-sm text-texto">{c.creativo.copyPrincipal}</p>
                    {c.creativo.titular && <p className="mt-1 text-xs text-texto-2">Titular: {c.creativo.titular}</p>}
                    <ul className="mt-2 text-[11px] text-texto-3">
                      {estructura({ ...c.creativo, formato: c.creativo.formato }).map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                      <li>Servicio: {nombreServicio(c.creativo.servicio)} · gancho {pct(c.hookRate)} · {num(c.diasActivo)} días</li>
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        {porAngulo.map((g) => (
          <Panel key={g.angulo} titulo={ETIQUETA_ANGULO[g.angulo]} ayuda={`${g.propios.length} propios · ${g.mercado.length} ganadores del mercado`}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-texto-3">Propios</div>
                {g.propios.length === 0 ? (
                  <p className="mt-1 text-xs text-texto-3">Sin piezas propias en este ángulo.</p>
                ) : (
                  <ul className="mt-1 space-y-2">
                    {g.propios.map((c) => (
                      <li key={c.creativo.id} className="text-sm">
                        <span className="text-texto">{c.creativo.copyPrincipal}</span>
                        <span className="ml-2 text-[11px] text-texto-3">{ETIQUETA_CUADRANTE[c.cuadrante]} · {cop(c.costoResultado)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-texto-3">Estructuras probadas por el mercado</div>
                {g.mercado.length === 0 ? (
                  <p className="mt-1 text-xs text-texto-3">Ningún competidor sostiene este ángulo 60+ días.</p>
                ) : (
                  <ul className="mt-1 space-y-2">
                    {g.mercado.map((m) => (
                      <li key={m.anuncioId} className="rounded border border-borde bg-superficie-2 p-2 text-xs">
                        <div className="text-texto">
                          {m.nombreAnunciante} · {num(m.diasCorriendo)} días · {nombreServicio(m.servicioDetectado)}
                        </div>
                        <ul className="mt-1 text-texto-3">
                          {estructura(m).map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
