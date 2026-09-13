import { motor } from "@/lib/datos";
import { cop, num, pct, ratio } from "@/lib/format";
import { ETIQUETA_PASO, METODO_VALORIZACION } from "@/lib/format/etiquetas";
import { Aviso, Barra, Celda, Grid, Kpi, Panel, Tabla, Th, Titulo } from "@/components/ui";

export default async function Embudo() {
  const r = await motor();
  const maxFuga = Math.max(0, ...r.embudo.map((p) => p.fugaCOP ?? 0));
  const porFuga = [...r.embudo].filter((p) => p.fugaCOP !== null).sort((a, b) => (b.fugaCOP ?? 0) - (a.fugaCOP ?? 0));

  return (
    <>
      <Titulo sub="Los 8 pasos desde que alguien ve el anuncio hasta que vuelve a comprar. Cada fuga está en pesos: un 10 % en el paso 6 puede valer más que un 40 % en el paso 2.">
        Embudo
      </Titulo>

      {!r.negocio.calibrado && (
        <div className="mb-3">
          <Aviso tono="ojo" titulo="Las fugas después de la valoración no se pueden valorizar todavía">
            Sin ticket y costo por procedimiento, el margen es desconocido y esas fugas se muestran como “—”. Se calibran en la reunión con la clínica.
          </Aviso>
        </div>
      )}

      <Grid cols={4}>
        <Kpi etiqueta="Asistencia a citas" valor={r.negocio.showRate} unidad="porcentaje" tono={r.negocio.showRate !== null && r.negocio.showRate < r.benchmarks.showRateMinimo.valor ? "mal" : "bien"} />
        <Kpi etiqueta="Cierre en consultorio" valor={r.negocio.cierreEnConsultorio} unidad="porcentaje" />
        <Kpi etiqueta="Costo por cita asistida" valor={r.negocio.costoCitaAsistida} unidad="cop" />
        <Kpi etiqueta="Costo por paciente nuevo (CAC)" valor={r.negocio.cac} unidad="cop" />
      </Grid>

      <div className="mt-4">
        <Panel titulo="Los 8 pasos" ayuda="Cantidad, tasa de paso, costo por persona en ese paso, perdidos y fuga en pesos">
          <Tabla>
            <thead>
              <tr>
                <Th>Paso</Th>
                <Th alinear="right">Personas</Th>
                <Th alinear="right">Tasa de paso</Th>
                <Th alinear="right">Acumulada</Th>
                <Th alinear="right">Costo por persona</Th>
                <Th alinear="right">Perdidos</Th>
                <Th alinear="right">Fuga en pesos</Th>
                <Th>Fuga relativa</Th>
              </tr>
            </thead>
            <tbody>
              {r.embudo.map((p) => (
                <tr key={p.paso} title={METODO_VALORIZACION[p.metodoValorizacion]}>
                  <Celda>
                    <span className="text-texto-3">{p.orden}.</span> {ETIQUETA_PASO[p.paso]}
                  </Celda>
                  <Celda alinear="right">{num(p.cantidad)}</Celda>
                  <Celda alinear="right">{pct(p.tasaPaso)}</Celda>
                  <Celda alinear="right">{pct(p.tasaAcumulada, 2)}</Celda>
                  <Celda alinear="right">{cop(p.costoUnitario)}</Celda>
                  <Celda alinear="right">{p.perdidos === null ? "—" : num(p.perdidos)}</Celda>
                  <Celda alinear="right" tono={p.fugaCOP !== null && p === porFuga[0] ? "mal" : undefined}>
                    {cop(p.fugaCOP)}
                  </Celda>
                  <Celda className="w-48">
                    <Barra valor={p.fugaCOP === null || maxFuga === 0 ? null : p.fugaCOP / maxFuga} tono={p === porFuga[0] ? "mal" : "ojo"} />
                  </Celda>
                </tr>
              ))}
            </tbody>
          </Tabla>
          <p className="mt-2 text-[11px] text-texto-3">
            Antes de la valoración, cada persona perdida vale lo que costó traerla. Desde la valoración, vale el margen que dejó de ganar. Ver el anuncio no es un contacto: ese paso no se valoriza.
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel titulo="Fugas ordenadas por plata">
          <ol className="space-y-2">
            {porFuga.map((p, i) => (
              <li key={p.paso} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="num text-texto-3">{i + 1}.</span> {ETIQUETA_PASO[p.paso]} <span className="text-texto-3">· {pct(p.tasaPaso, 0)} pasan</span>
                </span>
                <span className={`num font-semibold ${i === 0 ? "text-mal" : "text-texto"}`}>{cop(p.fugaCOP)}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel titulo="Economía del paciente">
          <div className="grid grid-cols-2 gap-3">
            <Kpi etiqueta="Ingresos de caja" valor={r.negocio.ingresosCaja} unidad="cop" />
            <Kpi etiqueta="Retorno real" valor={r.negocio.roasReal} unidad="ratio" ayuda="Ingresos de caja / inversión" />
            <Kpi etiqueta="Retorno sobre margen (POAS)" valor={r.negocio.poas} unidad="ratio" nota={r.negocio.poas === null ? "Requiere ticket y costo calibrados" : undefined} />
            <Kpi etiqueta="CAC sobre margen" valor={r.negocio.ratioCacMargen} unidad="ratio" nota={r.negocio.ratioCacMargen === null ? "Requiere margen calibrado" : undefined} />
            <Kpi etiqueta="Valor de vida del paciente" valor={r.negocio.ltv} unidad="cop" />
            <Kpi etiqueta="Valor de vida sobre CAC" valor={r.negocio.ltvSobreCac} unidad="ratio" />
          </div>
          <p className="mt-3 text-[11px] text-texto-3">
            Un retorno de {ratio(4)} con 20 % de margen es un POAS de {ratio(0.8)}: pérdida. Por eso se muestran los dos.
          </p>
        </Panel>
      </div>
    </>
  );
}
