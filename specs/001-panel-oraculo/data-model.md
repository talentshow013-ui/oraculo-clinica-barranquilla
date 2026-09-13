# Data Model: Panel ORÁCULO

Fuente normativa: `PROMPT_ORACULO_v2.md` §6. Todo vive en `lib/adapters/types.ts` como esquemas
Zod; los tipos TS se derivan con `z.infer`. Aquí se documentan campos, nulabilidad y relaciones.

## Convenciones

- Fechas: `string` `YYYY-MM-DD` en hora local Bogotá.
- Dinero: `number` en COP, sin decimales.
- `null` = dato no disponible. `0` = medido y fue cero.
- Esquemas agregados (`RegistroEmbudo`, `BreakdownRow`) son `.strict()`: cualquier campo extra rompe la carga.

## InsightRow — entidad × día

| Grupo | Campos | Nulabilidad |
|---|---|---|
| Identidad | `fuente` (meta\|tiktok\|radar\|clinica), `fecha`, `nivel` (cuenta\|campana\|conjunto\|anuncio), `id`, `nombre`, `padreId`, `cuentaId`, `objetivo`, `estado` (activo\|pausado\|archivado\|en_revision\|rechazado) | `padreId`, `objetivo` nullable; resto obligatorio |
| Entrega | `gasto`, `impresiones`, `alcance`, `frecuencia`, `subastasGanadas`, `pujaPromedio` | `gasto`, `impresiones` obligatorios ≥ 0; resto nullable |
| Interacción | `clics`, `clicsEnlace`, `clicsUnicos`, `interacciones`, `reacciones`, `comentarios`, `compartidos`, `guardados`, `visitasPerfil`, `seguidoresNuevos`, `vistasLandingPage` | `clics`, `clicsEnlace` obligatorios ≥ 0; resto nullable |
| Video | `reproducciones`, `reproducciones2s`, `reproducciones3s`, `reproducciones6s`, `reproduccionesThru`, `p25`, `p50`, `p75`, `p95`, `p100`, `tiempoReproduccionTotal`, `duracionCreativoSeg` | todos nullable |
| Mensajería | `conversacionesIniciadas`, `conversacionesRespondidas` | nullable |
| Resultado | `resultados`, `tipoResultado`, `valorConversion`, `ventanaAtribucion` | `resultados` obligatorio ≥ 0; `ventanaAtribucion` obligatorio (string, p. ej. `7d_click_1d_view`); resto nullable |

Relaciones: `padreId` → `id` del nivel superior. `cuentaId` agrupa todo.

## BreakdownRow

`InsightRow` (mismos campos) + `dimension` (edad\|genero\|edad_genero\|ubicacion\|pais\|plataforma\|ubicacion_anuncio\|dispositivo\|hora\|dia_semana) + `valor: string` + `nRegistros: number` (obligatorio, ≥ 0).

Regla UI: los desgloses no suman al total; se muestra advertencia.

## RegistroEmbudo (agregado, sin PII)

`fecha`, `campanaId` (nullable), `fuenteAtribuida` (meta\|tiktok\|organico\|referido\|directo\|desconocido), `paso`, `cantidad` ≥ 0, `valorCOP` (nullable), `servicio` (nullable), `sede` (nullable), `nRegistros` ≥ 0.

`paso` ∈ `impresion → clic → conversacion → lead_calificado → cita_agendada → cita_asistida → venta → recompra` (orden 1..8).

Esquema `.strict()`. Campos prohibidos (validados también por `validarSinPII`): nombre, apellido, cedula, documento, telefono, celular, email, correo, direccion, historia, diagnostico, pacienteId.

## Creativo

`id`, `anuncioId`, `formato` (imagen\|video\|carrusel\|coleccion), `urlMiniatura` (nullable), `copyPrincipal`, `titular` (nullable), `descripcion` (nullable), `cta` (nullable), `urlDestino` (nullable), `fechaPrimerGasto`, `diasActivo`, `servicio` (nullable), `anguloDetectado` (14 valores), `nivelConsciencia` (1-5), `confianzaClasificacion` (0-1), `senalesDeteccion: string[]`.

Relación: `anuncioId` → `InsightRow.id` con `nivel = anuncio`.

## AnuncioCompetidor

`competidorId`, `nombreAnunciante`, `anuncioId`, `primeraVez`, `ultimaVez`, `diasCorriendo`, `activo`, `plataformas: string[]`, `copy`, `titular` (nullable), `cta` (nullable), `urlMedia` (nullable), `tipoMedia` (imagen\|video\|carrusel\|desconocido), `urlDestino` (nullable), `dominioDestino` (nullable), `alcanceRango` (`{min,max}` nullable — **nunca estimado**), `variantesDelConcepto` ≥ 1, `servicioDetectado` (nullable), `anguloDetectado`, `nivelConsciencia`, `usaPrecio`, `usaUrgencia`, `usaProfesional`, `usaTestimonio`, `usaGarantia` (booleans), `puntuacionLongevidad` (0-1).

## Competidor

`id`, `nombre`, `ciudad`, `serviciosConocidos: string[]`, `urlPagina` (nullable).

## Experimento (memoria)

`id`, `hipotesis`, `servicio` (nullable), `angulo` (nullable), `tipoPrueba` (creativo\|audiencia\|oferta\|proceso\|presupuesto), `inicio`, `fin` (nullable), `resultado` (gano\|perdio\|sin_senal\|en_curso), `metricaExito`, `aprendizaje` (nullable), `origenOportunidadId` (nullable).

## LoteDatos

```
{
  insights: InsightRow[],
  desgloses: BreakdownRow[],
  creativos: Creativo[],
  embudo: RegistroEmbudo[],
  competidores: Competidor[],
  anunciosCompetencia: AnuncioCompetidor[],
  experimentos: Experimento[],
  meta: { generadoEn, desde, hasta, origen (seed|archivo), huecos: string[], advertencias: string[] }
}
```

## FuenteDatos (interfaz)

```ts
interface FuenteDatos {
  readonly nombre: string;
  obtener(rango: { desde: string; hasta: string }): Promise<LoteDatos>;
  estado(): Promise<EstadoFuente[]>;
}
EstadoFuente = { id, etiquetaPublica, conectado: boolean, ultimaActualizacion: string|null, detalle: string|null }
```

## Tipos derivados del motor (no persistidos)

- **Agregado**: sumas de crudos + `dias`, `entidades`.
- **PasoEmbudo**: `paso`, `cantidad`, `tasaPaso`, `tasaAcumulada`, `costoUnitario`, `perdidos`, `fugaCOP`, `valorCOP` (todos nullable salvo `paso`, `cantidad`).
- **Hallazgo**: `reglaId`, `area`, `severidad` (alta\|media\|baja), `titulo`, `explicacion`, `evidencia: {etiqueta, valor}[]`, `acciones: string[]`, `plataEnRiesgo` (nullable), `metricas: string[]` (ids del catálogo).
- **Oportunidad**: `id`, `origen`, `hipotesis`, `basadaEn: string[]`, `prueba: {presupuestoCOP, duracionDias, metricaExito, criterioCorte}`, `impacto`, `confianza`, `esfuerzo`, `ice`, `yaProbada: boolean`, `servicio`, `angulo`.
- **MetricaCatalogo**: `id`, `nombre`, `familia` (12), `unidad`, `formula`, `porQueImporta`, `mejorEs` (mayor\|menor\|rango), `derivada`, `fuentes: string[]`, `maestra?`.
- **CuadranteCreativo**: escalar\|arreglar_gancho\|arreglar_oferta\|matar\|sin_senal.
- **EspacioVacio**: `servicio`, `angulo`, `nivelConsciencia`, `competidoresQueLoAtacan: number`.
- **ResultadoLente**: `lente`, `fuente`, `criterios: {criterio, datoPanel, cumple: boolean|null, accionSiFalla}[]`.
