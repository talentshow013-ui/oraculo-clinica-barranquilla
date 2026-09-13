# Contrato: firmas públicas de `lib/`

La interfaz solo importa desde `lib/datos.ts`, `lib/format`, y tipos de `lib/adapters/types.ts`.

```ts
// lib/datos.ts
obtenerLote(): Promise<LoteDatos>
correrMotor(lote?: LoteDatos): Promise<ResultadoMotor>
ResultadoMotor = {
  lote, agregadoTotal, serieDiaria, embudo: PasoEmbudo[], negocio: MetricasNegocio,
  creativos: EvaluacionCreativo[], hallazgos: Hallazgo[] /* ordenados por plata */,
  erroresReglas: {reglaId, mensaje}[], oportunidades: Oportunidad[], radar: ResultadoRadar,
  lentes: ResultadoLente[], catalogo: MetricaCatalogo[], privacidad: {segmentosOcultos: number, k: number},
  fuentes: EstadoFuente[]
}
```

```ts
// lib/metrics/core.ts
razon(num: number|null, den: number|null): number|null
sumaNullable(valores: (number|null)[]): number|null
agregar(filas: InsightRow[]): Agregado
ventanasIguales(a: Rango, b: Rango): boolean
// derivadas: cpm(a), cpc(a), ctr(a), ctrEnlace(a), frecuencia(a), cpa(a), roas(a), hookRate(a), holdRate(a), ... → number|null
```

```ts
// lib/metrics/funnel.ts
construirEmbudo(registros: RegistroEmbudo[], agregado: Agregado, cliente: ConfigCliente): PasoEmbudo[]
fugaMasCara(pasos): PasoEmbudo|null
showRate, cierreEnConsultorio, costoCitaAsistida, cac, poas, roasReal, ratioCacMargen, ltv → number|null
```

```ts
// lib/diagnostics/engine.ts
ejecutarReglas(ctx: ContextoDiagnostico, reglas: Regla[]): { hallazgos: Hallazgo[], errores: ErrorRegla[] }
Regla = { id, area, evaluar(ctx): Hallazgo|null }
```

Garantías: puro, sin I/O, sin dependencias de React/Next, sin `Infinity`/`NaN` en salidas numéricas.
