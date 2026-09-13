import { motor } from "@/lib/datos";
import { indice, num, pct } from "@/lib/format";
import { ETIQUETA_ANGULO, NIVEL_CONSCIENCIA } from "@/lib/format/etiquetas";
import { Aviso, Barra, Celda, Etiqueta, Grid, Kpi, Panel, Tabla, Th, Titulo, Vacio } from "@/components/ui";

export default async function Competencia() {
  const r = await motor();
  const radar = r.radar;
  const nombreServicio = (id: string | null) => r.cliente.servicios.find((s) => s.id === id)?.nombre ?? id ?? "—";

  return (
    <>
      <Titulo sub="No existe forma pública de ver cuánto invierte un competidor. Lo único observable y honesto es cuánto tiempo lleva un anuncio al aire: nadie sostiene 60 días una pieza que no deja plata.">
        Radar de mercado
      </Titulo>

      <Grid cols={6}>
        <Kpi etiqueta="Competidores activos" valor={radar.competidoresActivos} />
        <Kpi etiqueta="Anuncios activos" valor={radar.anunciosActivos} />
        <Kpi etiqueta="Ganadores probados (60+ días)" valor={radar.ganadores.length} tono="acento" />
        <Kpi etiqueta="Nuevos por semana (mercado)" valor={radar.cadencia.total} unidad="numero" />
        <Kpi etiqueta="Nuevos por semana (cuenta)" valor={radar.cadenciaPropia} unidad="numero" tono={radar.cadenciaPropia < radar.cadencia.total / Math.max(1, radar.perfiles.length) ? "mal" : "bien"} />
        <Kpi etiqueta="Participación de voz" valor={radar.participacionVoz} unidad="porcentaje" />
      </Grid>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel titulo="Ganadores probados" ayuda="Se copia la estructura, nunca el texto" className="xl:col-span-2">
          {radar.ganadores.length === 0 ? (
            <Vacio mensaje="Ningún anuncio de competencia supera los 60 días." />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Anunciante</Th>
                  <Th>Estructura</Th>
                  <Th alinear="right">Días</Th>
                  <Th alinear="right">Variantes</Th>
                  <Th alinear="right">Longevidad</Th>
                  <Th alinear="right">Alcance</Th>
                </tr>
              </thead>
              <tbody>
                {radar.ganadores.slice(0, 12).map((a) => (
                  <tr key={a.anuncioId}>
                    <Celda>
                      <div className="text-texto">{a.nombreAnunciante}</div>
                      <div className="max-w-xs truncate text-[11px] text-texto-3" title={a.copy}>
                        {a.copy}
                      </div>
                    </Celda>
                    <Celda>
                      <div className="flex flex-wrap gap-1">
                        <Etiqueta>{ETIQUETA_ANGULO[a.anguloDetectado]}</Etiqueta>
                        <Etiqueta>{a.tipoMedia}</Etiqueta>
                        <Etiqueta>{nombreServicio(a.servicioDetectado)}</Etiqueta>
                        {a.usaPrecio && <Etiqueta tono="ojo">precio</Etiqueta>}
                        {a.usaTestimonio && <Etiqueta tono="acento">testimonio</Etiqueta>}
                        {a.usaProfesional && <Etiqueta tono="acento">profesional</Etiqueta>}
                      </div>
                    </Celda>
                    <Celda alinear="right">{num(a.diasCorriendo)}</Celda>
                    <Celda alinear="right">{num(a.variantesDelConcepto)}</Celda>
                    <Celda alinear="right">{indice(a.puntuacionLongevidad)}</Celda>
                    <Celda alinear="right">{a.alcanceRango ? `${num(a.alcanceRango.min)}–${num(a.alcanceRango.max)}` : "—"}</Celda>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
          <p className="mt-2 text-[11px] text-texto-3">El alcance solo aparece cuando la fuente lo entrega. Nunca se estima.</p>
        </Panel>

        <Panel titulo="Mapa de ángulos" ayuda="Entrar en un ángulo saturado es pagar más por decir lo mismo">
          <div className="space-y-2">
            {radar.mapaAngulos
              .filter((a) => a.anuncios > 0)
              .sort((a, b) => b.anuncios - a.anuncios)
              .map((a) => (
                <div key={a.angulo}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-texto">
                      {ETIQUETA_ANGULO[a.angulo]} {a.saturado && <Etiqueta tono="mal">saturado</Etiqueta>}
                    </span>
                    <span className="num text-texto-3">
                      {a.anuncios} anuncios · {a.competidores} competidores
                    </span>
                  </div>
                  <Barra valor={a.competidores / Math.max(1, radar.perfiles.length)} tono={a.saturado ? "mal" : "acento"} />
                </div>
              ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel titulo="Espacios vacíos" ayuda="Combinaciones servicio × ángulo × nivel de consciencia que ningún competidor observado está atacando. Ahí la subasta es barata y el mensaje es nuevo.">
          {radar.espaciosVacios.length === 0 ? (
            <Vacio mensaje="No hay espacios vacíos: el mercado cubre todas las combinaciones." />
          ) : (
            <>
              <div className="mb-2">
                <Aviso tono="acento">{radar.espaciosVacios.length} combinaciones libres. Se muestran las primeras 24; las demás alimentan Oportunidades.</Aviso>
              </div>
              <Tabla>
                <thead>
                  <tr>
                    <Th>Servicio</Th>
                    <Th>Ángulo</Th>
                    <Th>A quién le habla</Th>
                  </tr>
                </thead>
                <tbody>
                  {radar.espaciosVacios.slice(0, 24).map((e) => (
                    <tr key={`${e.servicio}-${e.angulo}-${e.nivelConsciencia}`}>
                      <Celda>{nombreServicio(e.servicio)}</Celda>
                      <Celda>{ETIQUETA_ANGULO[e.angulo]}</Celda>
                      <Celda>{NIVEL_CONSCIENCIA[e.nivelConsciencia]}</Celda>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </>
          )}
        </Panel>

        <Panel titulo="Competidores" ayuda="Salidas rápidas (menos de 14 días) significan que les fue mal: se aprende de su fracaso gratis">
          <Tabla>
            <thead>
              <tr>
                <Th>Competidor</Th>
                <Th alinear="right">Activos</Th>
                <Th alinear="right">Ganadores</Th>
                <Th alinear="right">Máx. días</Th>
                <Th alinear="right">Con precio</Th>
                <Th>Ángulos</Th>
              </tr>
            </thead>
            <tbody>
              {radar.perfiles
                .sort((a, b) => b.anunciosActivos - a.anunciosActivos)
                .map((p) => (
                  <tr key={p.competidorId}>
                    <Celda>{p.nombre}</Celda>
                    <Celda alinear="right">{num(p.anunciosActivos)}</Celda>
                    <Celda alinear="right">{num(p.ganadores)}</Celda>
                    <Celda alinear="right">{num(p.diasMaximo)}</Celda>
                    <Celda alinear="right">{num(p.usaPrecio)}</Celda>
                    <Celda>
                      <div className="text-[11px] text-texto-3">{p.angulos.map((a) => ETIQUETA_ANGULO[a]).join(", ")}</div>
                    </Celda>
                  </tr>
                ))}
            </tbody>
          </Tabla>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Kpi etiqueta="Entradas (4 sem.)" valor={radar.movimientos.entradas.length} />
            <Kpi etiqueta="Salidas (4 sem.)" valor={radar.movimientos.salidas.length} />
            <Kpi etiqueta="Salidas rápidas" valor={radar.movimientos.salidasRapidas.length} tono="ojo" />
          </div>
          <p className="mt-2 text-[11px] text-texto-3">
            {pct(radar.usoPrecio, 0)} de los anuncios del mercado muestran precio · {pct(radar.usoTestimonio, 0)} usan testimonio.
          </p>
        </Panel>
      </div>
    </>
  );
}
