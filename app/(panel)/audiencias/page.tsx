import { motor } from "@/lib/datos";
import { cop, num, pct } from "@/lib/format";
import { AVISO_DESGLOSES } from "@/lib/format/etiquetas";
import { AVISO_PANEL } from "@/lib/privacy";
import type { BreakdownRow } from "@/lib/adapters/types";
import { razon } from "@/lib/metrics/core";
import { Aviso, Barra, Celda, Grid, Kpi, Panel, Tabla, Th, Titulo, Vacio } from "@/components/ui";

function agrupar(filas: BreakdownRow[]) {
  const m = new Map<string, { gasto: number; impresiones: number; clicsEnlace: number; resultados: number; n: number }>();
  for (const f of filas) {
    const a = m.get(f.valor) ?? { gasto: 0, impresiones: 0, clicsEnlace: 0, resultados: 0, n: 0 };
    a.gasto += f.gasto;
    a.impresiones += f.impresiones;
    a.clicsEnlace += f.clicsEnlace;
    a.resultados += f.resultados;
    a.n += f.nRegistros;
    m.set(f.valor, a);
  }
  const total = [...m.values()].reduce((s, a) => s + a.gasto, 0);
  return [...m.entries()]
    .map(([valor, a]) => ({ valor, ...a, cuota: total > 0 ? a.gasto / total : null, cpa: razon(a.gasto, a.resultados) }))
    .sort((a, b) => b.gasto - a.gasto);
}

function TablaSegmentos({ titulo, ayuda, filas, ordenar }: { titulo: string; ayuda?: string; filas: ReturnType<typeof agrupar>; ordenar?: boolean }) {
  const lista = ordenar ? [...filas].sort((a, b) => Number(a.valor) - Number(b.valor)) : filas;
  const maxCuota = Math.max(0, ...filas.map((f) => f.cuota ?? 0));
  const cpas = filas.map((f) => f.cpa).filter((x): x is number => x !== null);
  const mediana = cpas.length ? [...cpas].sort((a, b) => a - b)[Math.floor(cpas.length / 2)]! : null;
  return (
    <Panel titulo={titulo} ayuda={ayuda}>
      {lista.length === 0 ? (
        <Vacio mensaje="La fuente no entregó este desglose." />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <Th>Segmento</Th>
              <Th alinear="right">Inversión</Th>
              <Th>Cuota</Th>
              <Th alinear="right">Resultados</Th>
              <Th alinear="right">Costo por resultado</Th>
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.valor}>
                <Celda>{f.valor}</Celda>
                <Celda alinear="right">{cop(f.gasto)}</Celda>
                <Celda className="w-40">
                  <Barra valor={f.cuota === null || maxCuota === 0 ? null : f.cuota / maxCuota} tono="acento" etiqueta={pct(f.cuota)} />
                </Celda>
                <Celda alinear="right" tono={f.resultados === 0 && f.gasto > 0 ? "mal" : undefined}>{num(f.resultados)}</Celda>
                <Celda alinear="right" tono={f.cpa !== null && mediana !== null ? (f.cpa > mediana * 1.5 ? "mal" : f.cpa < mediana * 0.7 ? "bien" : undefined) : f.gasto > 0 && f.resultados === 0 ? "mal" : undefined}>
                  {f.cpa === null && f.gasto > 0 && f.resultados === 0 ? "sin resultados" : cop(f.cpa)}
                </Celda>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </Panel>
  );
}

export default async function Audiencias() {
  const r = await motor();
  const vis = r.contexto.desglosesVisibles;
  const por = (dim: BreakdownRow["dimension"]) => agrupar(vis.filter((d) => d.dimension === dim));
  const zonas = por("ubicacion");
  const validas = new Set(r.cliente.zonasValidas.map((z) => z.toLowerCase()));
  const fuera = zonas.filter((z) => !validas.has(z.valor.toLowerCase()));
  const gastoZonas = zonas.reduce((s, z) => s + z.gasto, 0);
  const fueraFraccion = gastoZonas > 0 ? fuera.reduce((s, z) => s + z.gasto, 0) / gastoZonas : null;
  const horas = por("hora");
  const { inicio, fin } = r.cliente.horarioAtencion;
  const gastoHoras = horas.reduce((s, h) => s + h.gasto, 0);
  const fueraHorario = gastoHoras > 0 ? horas.filter((h) => Number(h.valor) < inicio || Number(h.valor) >= fin).reduce((s, h) => s + h.gasto, 0) / gastoHoras : null;

  return (
    <>
      <Titulo sub="Edad, zona, plataforma y franja horaria. Dónde se gasta y qué produce cada segmento.">Audiencias</Titulo>

      <div className="mb-3 space-y-2">
        <Aviso tono="neutro">{AVISO_DESGLOSES}</Aviso>
        <Aviso tono="acento">
          {AVISO_PANEL} {r.privacidad.segmentosOcultos > 0 ? `En este periodo se ocultaron ${r.privacidad.segmentosOcultos} cruces por tener menos de ${r.privacidad.k} personas.` : `En este periodo no hubo que ocultar ningún cruce.`}
        </Aviso>
      </div>

      <Grid cols={4}>
        <Kpi etiqueta="Inversión fuera del radio" valor={fueraFraccion} unidad="porcentaje" tono={fueraFraccion !== null && fueraFraccion > r.benchmarks.fueraRadioMaximo.valor ? "mal" : "bien"} ayuda="Gasto en municipios fuera del área metropolitana" />
        <Kpi etiqueta="Plata fuera del radio" valor={fuera.reduce((s, z) => s + z.gasto, 0)} unidad="cop" tono="mal" />
        <Kpi etiqueta="Inversión fuera de horario" valor={fueraHorario} unidad="porcentaje" tono={fueraHorario !== null && fueraHorario > r.benchmarks.fueraHorarioMaximo.valor ? "mal" : "bien"} ayuda={`Horario de atención ${inicio}:00–${fin}:00`} />
        <Kpi etiqueta="Segmentos ocultos" valor={r.privacidad.segmentosOcultos} ayuda={`Cruces con menos de ${r.privacidad.k} personas`} />
      </Grid>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TablaSegmentos titulo="Por zona" ayuda={`Radio útil: ${r.cliente.zonasValidas.join(", ")}`} filas={zonas} />
        <TablaSegmentos titulo="Por edad" filas={por("edad")} />
        <TablaSegmentos titulo="Por género" filas={por("genero")} />
        <TablaSegmentos titulo="Por plataforma y ubicación" filas={por("plataforma")} />
      </div>
      <div className="mt-4">
        <TablaSegmentos titulo="Por franja horaria (últimos 28 días)" ayuda="Pauta que corre cuando nadie contesta produce conversaciones frías" filas={horas} ordenar />
      </div>
    </>
  );
}
