# Reglas de diagnóstico — las 26

**Por qué determinista y no generativo:** un panel que le dice al cliente "estás perdiendo 130
millones" tiene que poder responder *por qué* con precisión y dar la misma respuesta mañana. Una
regla en código se audita línea por línea, se versiona y se discute. Una explicación generada
cambia entre ejecuciones y no se puede defender en una reunión.

Cada hallazgo responde en orden: **qué pasa** (título en lenguaje de dueño), **cómo lo sabemos**
(evidencia exacta), **qué hago** (acciones concretas), **cuánta plata** (COP; `null` si no se puede
valorizar con honestidad). Se ordena por plata, no por severidad. Una regla que falla no tumba el
panel: el ejecutor la envuelve en try/catch y la registra.

Ventanas: "reciente" = últimos 14 días; "anterior" = los 14 previos. Siempre del mismo tamaño.
Umbrales: `config/benchmarks.ts`, todos provisionales hasta calibrar con la historia del cliente.
Código: `lib/diagnostics/rules/*.ts`. Tests: `lib/diagnostics/rules.test.ts`.

| Id | Regla | Área | Dispara cuando | Plata en riesgo |
|---|---|---|---|---|
| R01 | Saturación de audiencia | entrega | frecuencia reciente ≥ umbral **y** tasa de clics de enlace cae ≥ 25 % vs anterior | gasto reciente × caída relativa |
| R02 | Presión de subasta | entrega | costo por mil sube ≥ 20 % con tasa de clics estable (±10 %) → no es el creativo | gasto reciente × (1 − CPM anterior / CPM reciente) |
| R03 | Concentración de inversión | entrega | índice de concentración (HHI) del gasto por anuncio ≥ 0,5 | una semana de gasto del anuncio principal |
| R04 | Portafolio creativo insuficiente | creativo | menos de 3 anuncios con gasto en la ventana reciente | — |
| R05 | Gancho débil | creativo | videos con señal y gancho < umbral | gasto × (1 − gancho/umbral) |
| R06 | El gancho promete lo que el cuerpo no entrega | creativo | gancho ≥ umbral **y** retención < umbral | gasto reciente de esos videos |
| R07 | Fatiga creativa | creativo | índice de fatiga ≥ 0,4 (caída de tasa de clics vs mejor semana, amplificada por alza de frecuencia) | gasto reciente × índice |
| R08 | Sin renovación creativa | creativo | > 21 días desde el último anuncio nuevo | — |
| R09 | Riesgo de política del sector salud | creativo | copy con antes/después, promesas absolutas, referencia negativa al cuerpo | gasto reciente de esos anuncios |
| R10 | Inversión fuera del radio | audiencia | > 10 % del gasto con ubicación fuera del área metropolitana | ese gasto (pérdida directa) |
| R11 | Segmento que consume sin producir | audiencia | un segmento de edad/género con ≥ 10 % del gasto de su dimensión y 0 resultados (solo cruces visibles, n ≥ 5) | gasto de esos segmentos |
| R12 | Franja horaria improductiva | audiencia | > 30 % del gasto fuera del horario de atención | gasto fuera de horario |
| R13 | Conjuntos compitiendo entre sí | audiencia | ≥ 2 conjuntos activos de la misma campaña con el mismo nombre normalizado (misma audiencia) | — |
| R14 | Cuello de botella en agenda | embudo | citas agendadas / leads calificados < 50 % (ventana reciente si tiene ≥ 20 citas; si no, periodo) | fuga del paso cita agendada |
| R15 | Inasistencia a citas | embudo | asistidas / agendadas < 70 % (misma ventana que R14) | perdidos × costo por cita agendada |
| R16 | Cierre bajo en consultorio | embudo | ventas / asistidas < 40 % | perdidos × margen (null sin calibrar) |
| R17 | Conversaciones sin responder | operación | respondidas / iniciadas < 85 % en la ventana reciente | sin responder × costo por conversación |
| R18 | Caída semanal en el embudo | embudo | citas asistidas (o conversaciones) reciente < anterior − 20 %, ventanas iguales | perdidos × costo unitario anterior |
| R19 | CAC por encima del margen | economía | CAC / margen > 1 (requiere calibración) | (CAC − margen) × ventas |
| R20 | Servicio vendido a pérdida | economía | margen ≤ 0 o CAC estimado del servicio > margen (requiere calibración) | (CAC − margen) × ventas del servicio |
| R21 | Presupuesto insuficiente para aprender | entrega | conjuntos activos con gasto diario < mínimo | gasto atrapado en aprendizaje |
| R22 | Retorno no verificable | datos | días con registros de agenda/ventas < 50 % del periodo | — (severidad alta) |
| R23 | Huecos en los datos | datos | hay fechas del rango sin filas | — |
| R24 | El mercado prueba más rápido | competencia | anuncios nuevos por semana por competidor > los propios | — |
| R25 | Clics que no llevan a ninguna parte | creativo | conversaciones / clics de enlace < 10 % | clics perdidos × costo por clic × déficit |
| R26 | La página no alcanza a cargar | operación | 1 − vistas de página / clics de enlace > 30 % | clics perdidos × costo por clic |

## Redacción esperada (R15)

> **39,8 % de las citas agendadas no se presentan.** Cada persona que no llega ya te costó toda la
> inversión de traerla, y además dejó un cupo vacío que nadie más pudo usar. Se pierde dos veces.
> Esta es, casi siempre, la fuga más cara de una clínica y la más barata de arreglar: es proceso,
> no pauta. → Confirmación 24 h antes + recordatorio 2 h antes · abono simbólico para separar
> cupo · agendar a menos de 72 h del contacto.

Si una explicación suena a manual de pauta, está mal escrita.

## Trampas que ya se pagaron

- **Ventanas desiguales**: comparar 7 días contra 28 produce caídas que no existen. Toda
  comparación usa ventanas del mismo tamaño (`ventanasIguales`, con test).
- **Diluir cuotas mezclando dimensiones** (R11): la cuota del 65+ se calcula contra el total de
  *edad*, no contra edad + género. Con test.
- **Evaluar agenda sobre 180 días**: una caída de 25 días se diluye. R14/R15/R16 miran la
  ventana reciente y caen al periodo completo solo si no hay señal.
- **k-anonimato con `nRegistros` mal definido**: si se ata a resultados, los segmentos con 0
  resultados se ocultan y R10/R11 se ciegan. `nRegistros` son personas del segmento.
