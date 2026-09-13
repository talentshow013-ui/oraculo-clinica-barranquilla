import { motor } from "@/lib/datos";
import { num, pct } from "@/lib/format";
import { diasEntre } from "@/lib/format/fechas";
import { FUENTES_PUBLICAS } from "@/lib/format/etiquetas";
import { Aviso, Etiqueta, Grid, Kpi, Panel, Titulo } from "@/components/ui";

export default async function Fuentes() {
  const r = await motor();
  const dias = diasEntre(r.lote.meta.desde, r.lote.meta.hasta);
  const cobertura = r.serie.length / dias;
  const conVentas = new Set(r.lote.embudo.filter((x) => x.paso === "venta" || x.paso === "cita_asistida").map((x) => x.fecha)).size;

  return (
    <>
      <Titulo sub="De dónde vienen los datos, hasta cuándo llegan y qué falta. Un panel viejo o con huecos decide mal.">Estado de los datos</Titulo>

      <Grid cols={4}>
        <Kpi etiqueta="Cobertura del periodo" valor={cobertura} unidad="porcentaje" tono={cobertura < 1 ? "ojo" : "bien"} ayuda="Días con datos / días del rango" />
        <Kpi etiqueta="Días sin datos" valor={r.contexto.huecos.length} tono={r.contexto.huecos.length ? "mal" : "bien"} />
        <Kpi etiqueta="Días con agenda y ventas" valor={conVentas} nota={`de ${num(dias)} del periodo`} />
        <Kpi etiqueta="Última actualización" valor={r.lote.meta.generadoEn.slice(0, 10)} />
      </Grid>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel titulo="Conexiones">
          <ul className="space-y-2">
            {(r.fuentes.length ? r.fuentes : [{ id: "actual", etiquetaPublica: r.lote.meta.origen === "seed" ? "Datos de demostración" : FUENTES_PUBLICAS.meta, conectado: true, ultimaActualizacion: r.lote.meta.generadoEn, detalle: null }]).map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 rounded border border-borde bg-superficie-2 p-3">
                <div>
                  <div className="text-sm text-texto">{f.etiquetaPublica}</div>
                  {f.detalle && <div className="text-xs text-texto-3">{f.detalle}</div>}
                  {f.ultimaActualizacion && <div className="num text-[11px] text-texto-3">Actualizado: {f.ultimaActualizacion.slice(0, 16).replace("T", " ")}</div>}
                </div>
                <Etiqueta tono={f.conectado ? "bien" : "mal"}>{f.conectado ? "Conectada" : "Sin conexión"}</Etiqueta>
              </li>
            ))}
            {r.lote.meta.origen === "seed" && (
              <>
                <li className="flex items-start justify-between gap-3 rounded border border-dashed border-borde p-3">
                  <div>
                    <div className="text-sm text-texto">{FUENTES_PUBLICAS.meta}</div>
                    <div className="text-xs text-texto-3">Se conecta cuando la clínica entregue los accesos.</div>
                  </div>
                  <Etiqueta>Pendiente</Etiqueta>
                </li>
                <li className="flex items-start justify-between gap-3 rounded border border-dashed border-borde p-3">
                  <div>
                    <div className="text-sm text-texto">{FUENTES_PUBLICAS.clinica}</div>
                    <div className="text-xs text-texto-3">Citas y procedimientos, sin datos de pacientes. Se registra cada semana.</div>
                  </div>
                  <Etiqueta>Pendiente</Etiqueta>
                </li>
                <li className="flex items-start justify-between gap-3 rounded border border-dashed border-borde p-3">
                  <div>
                    <div className="text-sm text-texto">{FUENTES_PUBLICAS.radar}</div>
                    <div className="text-xs text-texto-3">Anuncios públicos de 6 a 10 competidores del radio.</div>
                  </div>
                  <Etiqueta>Pendiente</Etiqueta>
                </li>
              </>
            )}
          </ul>
        </Panel>

        <Panel titulo="Calidad de los datos">
          <div className="space-y-2">
            {r.contexto.huecos.length > 0 ? (
              <Aviso tono="mal" titulo={`${r.contexto.huecos.length} días sin datos`}>
                {r.contexto.huecos.join(", ")}. Un hueco puede simular una caída que nunca ocurrió.
              </Aviso>
            ) : (
              <Aviso tono="bien">Sin huecos en el periodo.</Aviso>
            )}
            {r.lote.meta.advertencias.map((a) => (
              <Aviso key={a} tono="neutro">
                {a}
              </Aviso>
            ))}
            <Aviso tono="neutro">
              Segmentos ocultos por privacidad: {num(r.privacidad.segmentosOcultos)} (cruces con menos de {r.privacidad.k} personas). Cobertura de agenda y ventas: {pct(conVentas / dias, 0)}.
            </Aviso>
            <Aviso tono="neutro">Ventana de atribución de la plataforma: {r.lote.insights[0]?.ventanaAtribucion ?? "—"}. Cambiarla cambia los números.</Aviso>
          </div>
        </Panel>
      </div>
    </>
  );
}
