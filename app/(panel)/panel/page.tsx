import Link from "next/link";
import { motor } from "@/lib/datos";
import { cop, pct } from "@/lib/format";
import { ETIQUETA_PASO, ETIQUETA_AREA, METODO_VALORIZACION } from "@/lib/format/etiquetas";
import { NOMBRE_REGLA } from "@/lib/diagnostics/rules";
import { Aviso, Etiqueta, Grid, Kpi, Panel, Titulo, tonoPorDelta, Vacio } from "@/components/ui";
import { delta } from "@/lib/metrics/core";

export default async function CentroDeMando() {
  const r = await motor();
  const top = r.hallazgos.slice(0, 5);
  const fuga = r.fugaMasCara;

  return (
    <>
      <Titulo sub={`Estado de la cuenta al ${r.hoy}. Todo lo que hay abajo está ordenado por plata.`}>Centro de Mando</Titulo>

      {r.lote.meta.advertencias.map((a) => (
        <div key={a} className="mb-3">
          <Aviso tono="neutro">{a}</Aviso>
        </div>
      ))}

      <Grid cols={6}>
        {r.maestras.map((m) => {
          const d = m.valorReciente !== undefined ? delta(m.valorReciente ?? null, m.valorPrevio) : undefined;
          return <Kpi key={m.id} etiqueta={m.nombre} valor={m.valor} unidad={m.unidad} delta={d} tono={tonoPorDelta(d, m.mejorEs)} ayuda={`${m.formula} — ${m.porQueImporta}`} />;
        })}
      </Grid>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel titulo="Plata en riesgo" ayuda="Suma de los hallazgos que se pudieron valorizar" className="xl:col-span-1">
          <div className="num text-3xl font-semibold text-mal">{cop(r.plataEnRiesgoTotal)}</div>
          <p className="mt-1 text-xs text-texto-3">
            {r.hallazgos.length} hallazgos abiertos · {r.hallazgos.filter((h) => h.plataEnRiesgo === null).length} sin valorizar (se muestran, no se inventan)
          </p>
          {fuga && (
            <div className="mt-4 border-t border-borde pt-3">
              <div className="text-[11px] uppercase tracking-wider text-texto-3">Fuga más cara del embudo</div>
              <div className="mt-1 text-sm text-texto">{ETIQUETA_PASO[fuga.paso]}</div>
              <div className="num text-xl font-semibold text-ojo">{cop(fuga.fugaCOP)}</div>
              <div className="text-xs text-texto-3">
                {fuga.perdidos} personas perdidas · tasa de paso {pct(fuga.tasaPaso, 0)} · {METODO_VALORIZACION[fuga.metodoValorizacion]}
              </div>
              <Link href="/embudo" className="mt-2 inline-block text-xs text-acento hover:underline">
                Ver el embudo completo →
              </Link>
            </div>
          )}
        </Panel>

        <Panel titulo="Qué hacer esta semana" ayuda="Los cinco hallazgos que más plata mueven" className="xl:col-span-2">
          {top.length === 0 ? (
            <Vacio mensaje="Sin hallazgos. O la cuenta está impecable, o faltan datos: revisa Fuentes." />
          ) : (
            <ol className="space-y-3">
              {top.map((h, i) => (
                <li key={h.reglaId} className="flex gap-3">
                  <div className="num w-6 shrink-0 text-right text-lg font-semibold text-texto-3">{i + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-texto">{h.titulo}</span>
                      <Etiqueta tono={h.severidad === "alta" ? "mal" : h.severidad === "media" ? "ojo" : "neutro"}>{ETIQUETA_AREA[h.area]}</Etiqueta>
                    </div>
                    <div className="mt-0.5 text-xs text-texto-2">{h.acciones[0]}</div>
                    <div className="mt-0.5 text-[11px] text-texto-3">{NOMBRE_REGLA[h.reglaId]}</div>
                  </div>
                  <div className="num shrink-0 text-right text-sm font-semibold text-mal">{cop(h.plataEnRiesgo)}</div>
                </li>
              ))}
            </ol>
          )}
          <Link href="/diagnostico" className="mt-3 inline-block text-xs text-acento hover:underline">
            Ver los {r.hallazgos.length} hallazgos con evidencia →
          </Link>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel titulo="Próximo experimento" ayuda="La oportunidad con mejor relación impacto × confianza / esfuerzo">
          {r.oportunidades[0] ? (
            <div>
              <div className="text-sm font-medium text-texto">{r.oportunidades[0].titulo}</div>
              <p className="mt-1 text-xs text-texto-2">{r.oportunidades[0].hipotesis}</p>
              <p className="mt-2 text-[11px] text-texto-3">
                Corte: {r.oportunidades[0].prueba.criterioCorte}
              </p>
              <Link href="/oportunidades" className="mt-2 inline-block text-xs text-acento hover:underline">
                Ver todas las oportunidades →
              </Link>
            </div>
          ) : (
            <Vacio />
          )}
        </Panel>
        <Panel titulo="Radar de mercado" ayuda="Lo único observable y honesto: cuánto tiempo lleva un anuncio al aire">
          <div className="grid grid-cols-3 gap-3">
            <Kpi etiqueta="Competidores activos" valor={r.radar.competidoresActivos} />
            <Kpi etiqueta="Anuncios de 60+ días" valor={r.radar.ganadores.length} />
            <Kpi etiqueta="Espacios vacíos" valor={r.radar.espaciosVacios.length} tono="acento" />
          </div>
          <Link href="/competencia" className="mt-3 inline-block text-xs text-acento hover:underline">
            Ver el radar →
          </Link>
        </Panel>
      </div>
    </>
  );
}
