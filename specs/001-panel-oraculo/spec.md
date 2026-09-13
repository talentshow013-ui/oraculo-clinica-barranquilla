# Feature Specification: Panel ORÁCULO

**Feature Branch**: `001-panel-oraculo`

**Created**: 2026-09-13

**Status**: Implemented

**Input**: User description: "Panel ORÁCULO completo según PROMPT_ORACULO_v2.md: contrato de datos, núcleo de cálculo, embudo de 8 pasos valorizado, laboratorio creativo, catálogo de 145 métricas, 26 reglas de diagnóstico, radar de competencia, oportunidades con ICE y memoria, 7 lentes de auditoría, privacidad k=5, seed determinista, adapters, verificación sin UI, app de 12 pantallas, skills de Claude Code, instalador Windows, README y docs, PROMPT-FRONTEND.md. Fases 0-5 con criterios de aceptación de §13."

**Documento funcional de referencia**: `PROMPT_ORACULO_v2.md` (secciones 2, 6, 7, 8, 10, 11, 13). Esta especificación resume lo que el usuario obtiene; el detalle de cada módulo se toma del prompt maestro sin repetirlo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El dueño ve dónde se pierde la plata (Priority: P1)

El dueño de la clínica abre el Centro de Mando y, en menos de un minuto, ve el estado de la cuenta (inversión, citas asistidas, retorno real, plata en riesgo), los hallazgos ordenados por pesos y la fuga más cara del embudo con la acción para cerrarla.

**Why this priority**: Es el producto. Sin esto el resto es decoración. El diferencial es valorizar cada fuga en COP y ordenar por plata, no por porcentaje.

**Independent Test**: Con los datos de demostración cargados, abrir el Centro de Mando y el Embudo: se ven las métricas maestras, los hallazgos ordenados por plata, y el paso con mayor fuga en pesos (inasistencia a citas) con su explicación y acciones.

**Acceptance Scenarios**:

1. **Given** el lote de demostración, **When** abro el Centro de Mando, **Then** veo métricas maestras, hallazgos ordenados por plata y ningún dato ausente mostrado como 0 (aparece `—`).
2. **Given** el embudo de 8 pasos, **When** abro Embudo, **Then** cada paso muestra cantidad, tasa de paso, costo unitario, perdidos y fuga en pesos; los pasos anteriores a cita asistida se valorizan al costo del paso anterior y desde cita asistida al margen unitario.
3. **Given** un ROAS de 4x con margen de 20 %, **When** veo Rendimiento, **Then** se muestra POAS 0,8 junto al ROAS con explicación de la diferencia.
4. **Given** días sin datos en el rango, **When** abro cualquier vista con series temporales, **Then** los huecos se muestran explícitamente y no como caídas.

---

### User Story 2 - Diagnóstico auditable y contrario cuando toca (Priority: P1)

El equipo abre Diagnóstico y encuentra hallazgos con título en lenguaje de dueño, evidencia exacta, acciones concretas y plata en riesgo. Si el equipo propone subir presupuesto a una campaña saturada, el panel ya lo contradijo con el dato.

**Why this priority**: El mandato 3 (analizar de verdad) y el carácter (llevar la contraria con evidencia) se cumplen aquí. Un hallazgo sin evidencia no sirve en una reunión.

**Independent Test**: Correr el motor sin interfaz sobre el seed: encuentra los patrones plantados (fatiga después del día 90, ~22 % fuera del radio, caída de asistencia en los últimos 25 días, segmento 65+ que no convierte, CPM creciente, ~50 % de pauta fuera de horario, 2 días de hueco, competidores con anuncios de 60+ días) y los imprime ordenados por plata.

**Acceptance Scenarios**:

1. **Given** el seed, **When** corre el motor, **Then** se producen hallazgos de al menos 8 de las 26 reglas, cada uno con título, explicación, evidencia, acciones y plata en riesgo.
2. **Given** una regla que lanza excepción, **When** corre el motor, **Then** las demás reglas se evalúan y el error queda registrado; el panel no se cae.
3. **Given** dos periodos de distinto tamaño, **When** se compara, **Then** el sistema rechaza la comparación o la normaliza a ventanas iguales.

---

### User Story 3 - Laboratorio creativo y radar de mercado (Priority: P2)

El equipo ve qué creativo escalar, cuál arreglar (gancho u oferta), cuál matar y cuál aún no tiene señal. En Radar de mercado ve qué anuncios de la competencia llevan 60+ días, el mapa de ángulos saturados y los espacios vacíos (servicio × ángulo × consciencia) donde nadie pauta.

**Why this priority**: Mandatos 1 (escalar) y 2 (competir). Genera las hipótesis del próximo ciclo.

**Independent Test**: Con el seed, Creativos muestra los 5 cuadrantes incluido `sin_senal`, con índice de fatiga y fórmula visible; Competencia muestra longevidad, cadencia y al menos un espacio vacío; ningún competidor muestra gasto o retorno estimado.

**Acceptance Scenarios**:

1. **Given** un creativo con CTR cayendo y frecuencia subiendo, **When** se calcula fatiga, **Then** el índice es mayor que con frecuencia estable.
2. **Given** un creativo con pocos datos, **When** se clasifica, **Then** cae en `sin_senal` y no se decide.
3. **Given** anuncios de competencia, **When** abro Radar, **Then** el alcance aparece como `—` cuando la fuente no lo expone; nunca un estimado.

---

### User Story 4 - Oportunidades con criterio de corte y memoria (Priority: P2)

El equipo recibe hipótesis priorizadas por ICE, cada una con dato de origen, presupuesto, duración, métrica de éxito y criterio de corte. Lo ya probado y perdido aparece marcado y con confianza reducida.

**Why this priority**: Mandato 4 (mejorar cada día). Sin memoria el sistema propone lo mismo cada mes.

**Independent Test**: Registrar un experimento perdido en el archivo de experimentos; al regenerar oportunidades, la hipótesis equivalente aparece marcada como ya probada.

**Acceptance Scenarios**:

1. **Given** hallazgos y espacios vacíos, **When** abro Oportunidades, **Then** cada una tiene hipótesis "si X → Y porque Z", datos de origen y prueba con criterio de corte.
2. **Given** un experimento registrado como perdido, **When** se generan oportunidades, **Then** la equivalente baja de prioridad y se marca.

---

### User Story 5 - La coordinadora instala, actualiza y reporta (Priority: P2)

La coordinadora clona el repositorio, ejecuta el instalador, abre el panel; cada semana ejecuta el comando de sincronización en su asistente de código y el de informe semanal, y entrega al dueño el Resumen para dirección.

**Why this priority**: Sin operación simple el sistema no se usa.

**Independent Test**: En un equipo Windows limpio con Node instalado, seguir el README de 5 pasos y llegar al panel con datos de demostración en menos de 10 minutos.

**Acceptance Scenarios**:

1. **Given** un clon nuevo, **When** ejecuto el instalador, **Then** se instalan dependencias, se genera el seed y se abre el panel.
2. **Given** un lote real en `datos/lote.json`, **When** cambio la fuente activa a archivo, **Then** el panel lo muestra sin modificar ningún componente; si el lote no cumple el contrato, la carga falla con mensaje claro.
3. **Given** el motor ya corrió, **When** ejecuto el skill de informe semanal, **Then** se redacta un informe que cita cada cifra a su métrica y regla, sin inventar números.

---

### User Story 6 - Privacidad garantizada por diseño (Priority: P1)

Nadie puede cargar datos identificables de pacientes; los cruces pequeños se ocultan y el panel explica cuántos y por qué.

**Why this priority**: Datos de salud, Ley 1581 de 2012. Un incidente destruye el proyecto.

**Independent Test**: Intentar cargar un registro con un campo `telefono`: la carga falla con error que cita la ley. Un desglose con `nRegistros` 3 aparece enmascarado y el contador de segmentos ocultos lo refleja.

**Acceptance Scenarios**:

1. **Given** un objeto con campo prohibido, **When** se valida la ingesta, **Then** lanza error y no carga nada.
2. **Given** desgloses con `nRegistros < 5`, **When** se muestran, **Then** se ocultan y el aviso indica cuántos.

---

### Edge Cases

- Fuente que retira un campo (p. ej. alcance orgánico): el valor es `null`, la UI muestra `—`, nada se rompe.
- Denominador 0 o ausente: la razón es `null`, nunca Infinity/NaN.
- Rango con huecos: se listan en `meta.huecos` y se muestran.
- Creativo con menos datos que el mínimo: `sin_senal`, no se decide.
- Regla que lanza excepción: se registra, las demás siguen.
- Seed que omite un campo del contrato: la validación falla ruidosamente; se corrige el seed, no el contrato.
- Desgloses que no suman al total (deduplicación de alcance): la UI lo advierte.
- Ventana de atribución: se muestra siempre; cambiarla cambia los números.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST definir un contrato de datos único (InsightRow, BreakdownRow, RegistroEmbudo, Creativo, AnuncioCompetidor, LoteDatos, FuenteDatos, Experimento) con las reglas de nulabilidad de §6 y validarlo en cada carga.
- **FR-002**: El sistema MUST agregar solo campos crudos y recalcular toda razón desde sumas; MUST NOT exponer función que promedie razones; MUST incluir el test 91/1000 = 9,1 %.
- **FR-003**: El sistema MUST devolver `null` (mostrado como `—`) para datos ausentes y para razones con denominador 0 o ausente.
- **FR-004**: El sistema MUST construir el embudo de 8 pasos con cantidad, tasa de paso, tasa acumulada, costo unitario, perdidos, fuga en COP y valor en COP; valorización según §7.2; funciones showRate, cierreEnConsultorio, costoCitaAsistida, cac, poas, roasReal, ratioCacMargen, ltv, fugaMasCara.
- **FR-005**: El sistema MUST calcular índice de fatiga (0-1, fórmula visible) y clasificar creativos en escalar / arreglar_gancho / arreglar_oferta / matar / sin_senal.
- **FR-006**: El sistema MUST declarar 145 métricas en 12 familias con id, nombre, familia, unidad, fórmula, porQueImporta, mejorEs, derivada, fuentes y ~18 maestras; ninguna con benchmark quemado.
- **FR-007**: El sistema MUST implementar las 26 reglas de diagnóstico de §7.5 como funciones deterministas; cada hallazgo con título, explicación, evidencia, acciones y plata en riesgo; ordenados por plata; ejecutor tolerante a fallos.
- **FR-008**: El sistema MUST implementar el radar (puntuación de longevidad, ganadores probados 60+ días, cadencia, entradas/salidas, mapa de ángulos, espacios vacíos, participación de voz) y el clasificador determinista de 14 ángulos con señales visibles y `riesgoPolitica`.
- **FR-009**: El sistema MUST generar oportunidades con hipótesis, basadaEn, prueba con criterio de corte, priorización ICE, tres orígenes y filtro de ya probadas alimentado por un registro de experimentos.
- **FR-010**: El sistema MUST aplicar 7 lentes de auditoría con fuente citada, cada criterio ligado a un dato del panel y una acción si falla.
- **FR-011**: El sistema MUST implementar privacidad: k=5, enmascarar, filtrarPorK, campos prohibidos, ErrorDatoSensible, validarSinPII, pseudonimizar (SHA-256 con sal), AVISO_PANEL.
- **FR-012**: El sistema MUST formatear COP sin decimales en es-CO, porcentajes con coma decimal, y operar fechas en America/Bogota; toda comparación de periodos MUST usar ventanas iguales.
- **FR-013**: El sistema MUST generar 180 días deterministas de demostración con los patrones plantados de §11 y validarlos con el mismo contrato.
- **FR-014**: El sistema MUST ofrecer dos fuentes intercambiables (demostración y archivo local) seleccionables por configuración, sin cambios en la interfaz.
- **FR-015**: El sistema MUST proveer un comando de verificación sin interfaz que corra el motor completo e imprima hallazgos ordenados por plata.
- **FR-016**: La interfaz MUST tener las pantallas de §5 (Centro de Mando, Diagnóstico, Oportunidades, Embudo, Rendimiento, Creativos, Audiencias, Competencia, Biblioteca, Consejo, Métricas, Informe, Fuentes) con sidebar de 4 grupos, tema oscuro de §10, primitivas propias, sin jerga técnica visible, `—` para ausentes, advertencia de desgloses y ventana de atribución visible.
- **FR-017**: El sistema MUST incluir skills de Claude Code: `oraculo-sincronizar` (fase 2: fuente oficial → lote local), `oraculo-semana` (informe de dirección que cita métrica y regla) y `oraculo-pregunta` (respuesta con datos, discrepando con evidencia).
- **FR-018**: El sistema MUST incluir instalador Windows, README de 5 pasos para la coordinadora, docs técnicos (CONTRATO_DATOS, CONEXION_MCP, REGLAS_DIAGNOSTICO, CUMPLIMIENTO) y PROMPT-FRONTEND.md para el agente de diseño.
- **FR-019**: La configuración del cliente (servicios, tickets, márgenes, radio, cupos, horario) y los umbrales (con origen) MUST vivir en archivos de configuración editables; tickets y costos en cero hasta la reunión 1.

### Key Entities

- **InsightRow**: una entidad (cuenta/campaña/conjunto/anuncio) × un día; entrega, interacción, video, mensajería, resultado; 5 campos obligatorios, el resto nullable.
- **BreakdownRow**: InsightRow + dimensión + valor + nRegistros (para privacidad).
- **RegistroEmbudo**: fecha, campaña, fuente atribuida, paso (8), cantidad, valor COP, servicio, sede, nRegistros. Sin PII posible.
- **Creativo**: pieza publicitaria con formato, copy, ángulo detectado, nivel de consciencia, señales.
- **AnuncioCompetidor**: anuncio observado en el mercado con longevidad y ángulo; alcance nullable, nunca estimado.
- **LoteDatos**: conjunto completo + meta (rango, origen, huecos, advertencias).
- **Experimento**: hipótesis probada, fechas, resultado (ganó/perdió/sin señal), aprendizaje.
- **Hallazgo**: salida de una regla: título, explicación, evidencia, acciones, plata en riesgo, área, severidad.
- **Oportunidad**: hipótesis con prueba, ICE y origen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El dueño identifica la fuga más cara y su acción en menos de 60 segundos desde que abre el panel.
- **SC-002**: 100 % de los datos ausentes se muestran como `—`; cero ceros falsos en las pantallas con el lote de demostración.
- **SC-003**: El motor encuentra los 8 patrones plantados en el seed en la verificación sin interfaz.
- **SC-004**: Mínimo 20 pruebas automatizadas del núcleo pasando, incluidas: null≠0, 9,1 % vs 5,5 %, fuga al margen después de cita asistida, POAS 0,8 con ROAS 4x, razón nunca Infinity, PII rechazada, k=5.
- **SC-005**: Cero términos técnicos (API, MCP, endpoint, Zod, LLM) en texto visible al cliente, verificado por búsqueda automatizada.
- **SC-006**: Conectar un lote real no requiere cambiar ningún archivo de interfaz.
- **SC-007**: Una persona no técnica llega al panel con datos en menos de 10 minutos siguiendo el README.
- **SC-008**: Todas las rutas cargan sin error con el lote de demostración.

## Assumptions

- Fase 1 usa exclusivamente datos de demostración y archivo local; la conexión en vivo (Meta/TikTok/Apify) es Fase 2 y depende de accesos que el cliente entregará después.
- Los tickets, costos directos y márgenes reales se calibran en la reunión 1; hasta entonces van en cero y las métricas de negocio dependientes muestran `—` o se marcan como no calibradas.
- Una sola sede y un solo usuario (sin autenticación) en v1.
- El asistente de código de la coordinadora es Claude Code con su propia suscripción; los skills del proyecto se distribuyen en el repositorio.
- El agente de diseño mejorará la estética sobre la interfaz funcional entregada, respetando `lib/` y el contrato.
- Los benchmarks iniciales se declaran con origen y se tratan como umbrales provisionales hasta calibrar con historia del cliente.
