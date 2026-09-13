import { motor } from "@/lib/datos";
import { cop, indice, num, pct } from "@/lib/format";
import { ETIQUETA_ANGULO, ETIQUETA_CUADRANTE, NIVEL_CONSCIENCIA } from "@/lib/format/etiquetas";
import { FORMULA_FATIGA, type Cuadrante } from "@/lib/metrics/creative";
import { Aviso, Celda, Etiqueta, Grid, Kpi, Panel, Tabla, Th, Titulo, type Tono } from "@/components/ui";

const TONO: Record<Cuadrante, Tono> = { escalar: "bien", arreglar_gancho: "ojo", arreglar_oferta: "ojo", matar: "mal", sin_senal: "neutro" };
const ORDEN: Cuadrante[] = ["escalar", "arreglar_gancho", "arreglar_oferta", "matar", "sin_senal"];

export default async function Creativos() {
  const r = await motor();
  const evals = [...r.creativos].sort((a, b) => b.agregado.gasto - a.agregado.gasto);
  const porCuadrante = ORDEN.map((c) => ({ c, n: evals.filter((e) => e.cuadrante === c).length }));
  const referencia = r.total.resultados > 0 ? r.total.gasto / r.total.resultados : null;

  return (
    <>
      <Titulo sub="Cada anuncio cae en un cuadrante según gancho (¿se detienen?) y costo por resultado (¿convierte?). “Esperar señal” no es un caso raro: matar un anuncio bueno por ruido cuesta más que esperar.">
        Laboratorio creativo
      </Titulo>

      <Grid cols={6}>
        {porCuadrante.map(({ c, n }) => (
          <Kpi key={c} etiqueta={ETIQUETA_CUADRANTE[c]} valor={n} tono={n > 0 ? TONO[c] : "neutro"} />
        ))}
        <Kpi etiqueta="Costo por resultado de referencia" valor={referencia} unidad="cop" ayuda="El de toda la cuenta: más barato que esto = convierte" />
      </Grid>

      <div className="mt-3">
        <Aviso tono="neutro" titulo="Cómo se calcula la fatiga">
          {FORMULA_FATIGA}
        </Aviso>
      </div>

      <div className="mt-4">
        <Panel titulo="Todos los anuncios" ayuda="Ordenados por inversión. Cada fila dice qué hacer.">
          <Tabla>
            <thead>
              <tr>
                <Th>Anuncio</Th>
                <Th>Ángulo</Th>
                <Th alinear="right">Inversión</Th>
                <Th alinear="right">Gancho</Th>
                <Th alinear="right">Retención</Th>
                <Th alinear="right">Costo por resultado</Th>
                <Th alinear="right">Fatiga</Th>
                <Th alinear="right">Días</Th>
                <Th>Decisión</Th>
              </tr>
            </thead>
            <tbody>
              {evals.map((e) => (
                <tr key={e.creativo.id}>
                  <Celda>
                    <div className="max-w-xs truncate text-texto" title={e.creativo.copyPrincipal}>
                      {e.creativo.copyPrincipal}
                    </div>
                    <div className="text-[11px] text-texto-3">
                      {e.creativo.formato} · {e.creativo.servicio ?? "—"} · consciencia {e.creativo.nivelConsciencia}: {NIVEL_CONSCIENCIA[e.creativo.nivelConsciencia as 1 | 2 | 3 | 4 | 5]}
                    </div>
                  </Celda>
                  <Celda>{ETIQUETA_ANGULO[e.creativo.anguloDetectado]}</Celda>
                  <Celda alinear="right">{cop(e.agregado.gasto)}</Celda>
                  <Celda alinear="right">{pct(e.hookRate)}</Celda>
                  <Celda alinear="right">{pct(e.holdRate)}</Celda>
                  <Celda alinear="right" tono={referencia !== null && e.costoResultado !== null ? (e.costoResultado <= referencia ? "bien" : "mal") : undefined}>
                    {cop(e.costoResultado)}
                  </Celda>
                  <Celda alinear="right" tono={e.fatiga.indice !== null && e.fatiga.indice >= r.benchmarks.indiceFatigaAlerta.valor ? "mal" : undefined}>
                    {indice(e.fatiga.indice)}
                  </Celda>
                  <Celda alinear="right">{num(e.diasActivo)}</Celda>
                  <Celda>
                    <Etiqueta tono={TONO[e.cuadrante]}>{ETIQUETA_CUADRANTE[e.cuadrante]}</Etiqueta>
                    <div className="mt-1 max-w-xs text-[11px] text-texto-3">{e.accion}</div>
                  </Celda>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Panel>
      </div>
    </>
  );
}
