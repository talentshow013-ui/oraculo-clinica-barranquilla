# Escuela de marketing de Oráculo — lo que piensan los referentes y cómo se aplica a la clínica

**Lectura obligatoria del agente al inicio de cada sesión** (lo exige `CLAUDE.md`). Aquí están las
ideas centrales de los 20 referentes de la mesa, traducidas a decisiones para una clínica estética
en Barranquilla. Son marcos de pensamiento: se combinan con el criterio propio de la IA y con los
datos del motor. **Ningún referente aporta cifras**: las cifras salen solo del motor.

## Cómo usar esta escuela
Ante cualquier pregunta del cliente, la mesa pasa por tres filtros en este orden:
1. **Dato** (motor): ¿qué dicen los números de la cuenta?
2. **Escuela** (este archivo): ¿qué principio aplica y qué diría el referente?
3. **Criterio de la IA**: ¿qué falta que ningún referente cubre para este caso concreto?
La recomendación final siempre trae dato + regla + riesgo en pesos + alternativa.

---

## 1. Alex Hormozi — la oferta manda
- **Ecuación de valor**: valor = (resultado soñado × probabilidad percibida) ÷ (tiempo × esfuerzo).
  Un anuncio no vende «criolipólisis»: vende «menos cintura en 3 sesiones, sin cirugía ni reposo».
- **Grand slam offer**: apilar bonos, garantía, escasez y urgencia hasta que decir que no sea tonto.
  Ejemplo para la clínica: valoración gratis + plan por escrito + primera sesión con descuento si se agenda hoy.
- **Regla de los 3 ingresos**: subir precio, subir frecuencia (recurrencia del tratamiento), subir
  vida del cliente (siguiente tratamiento). Por eso el motor lleva `recurrenciaMeses` por servicio.
- **LTV/CAC ≥ 3**: si una paciente vale $ X en 12 meses, se puede pagar hasta X/3 por traerla.
- Aplicación: antes de pedir «más leads», revisar la oferta que ve el lead. Leads baratos con oferta
  débil son plata quemada en el WhatsApp.

## 2. Leila Hormozi — la operación sostiene el marketing
- La pauta trae gente; **la operación la convierte y la retiene**. Tiempo de respuesta, guion de
  WhatsApp, agenda sin huecos y seguimiento son marketing.
- Mide «velocidad de respuesta» y «tasa de asistencia a la cita»: si caen, no toques la pauta.
- Aplicación: el motor pide que la clínica anote resultados por campaña; sin eso, la mesa no puede
  saber si el problema es el anuncio o el mostrador.

## 3. Gary Vaynerchuk — atención primero, orgánico primero
- La atención es la moneda; se compra con pauta o se gana con volumen orgánico.
- **Documenta, no crees**: el día a día de la clínica (antes/después con consentimiento, la doctora
  explicando, preguntas reales de pacientes) es contenido infinito.
- **Jab, jab, jab, right hook**: tres piezas que dan valor por una que pide.
- Aplicación: la pestaña Orgánico existe para esto; lo que gana orgánico merece pauta.

## 4. Seth Godin — a quién le hablas
- **«Personas como nosotros hacen cosas como esta»**: el anuncio debe hacer sentir a la paciente
  que es de su tribu (mamás de 35 en el norte de Barranquilla, no «mujeres 18-65»).
- **Mínimo público viable**: mejor ser imprescindible para pocas que opcional para todas.
- **Vaca púrpura**: lo notable se comparte solo; lo promedio necesita cada vez más pauta.
- Aplicación: los públicos «amplios» que ganan en Meta no contradicen esto: el mensaje sigue siendo
  para una tribu; el algoritmo la encuentra.

## 5. Russell Brunson — el embudo y la historia
- **Escalera de valor**: gratis (valoración) → barato (limpieza, peeling) → medio (toxina, ácido)
  → alto (Lipoz, Hifu, paquetes). Cada anuncio debe saber en qué peldaño entra la paciente.
- **Epiphany bridge**: la historia de una paciente que dudaba y cambió; la gente compra historias.
- **Un embudo, una promesa**: un anuncio → una landing/WhatsApp → una oferta. No mezclar.
- Aplicación: el motor mide fuga en cada paso del embudo; Brunson dice dónde meter la historia.

## 6. Sabri Suby — respuesta directa moderna
- **Halo strategy**: hablar del problema con más fuerza que la competencia, con prueba y con oferta.
- Anuncio largo que vende > anuncio corto que gusta. El copy debe agotar objeciones.
- **Godfather offer**: la que no se puede rechazar (garantía + bono + límite).
- Aplicación: los copys de la Biblioteca se juzgan por «¿qué objeción quita?», no por creatividad.

## 7. Codie Sanchez — economía unitaria antes que marca
- Primero que cada tratamiento deje margen; después la marca. Sin margen, la pauta escala pérdidas.
- Pregunta obligatoria: **¿cuánto dejo por paciente después de insumos y tiempo de sala?**
- Aplicación: `config/cliente.ts` (ticket, costo directo, recurrencia) es lo que hace que la mesa
  pueda decir «este anuncio es caro» con base y no con intuición.

## 8. Rory Sutherland — la psicología del valor
- El valor está en la percepción: el mismo tratamiento vale más con mejor explicación, mejor sala y
  mejor seguimiento. **Cambiar la percepción es más barato que cambiar el producto.**
- **Costly signaling**: lo que cuesta esfuerzo comunica seriedad (la doctora en cámara, el plan
  escrito, la llamada de seguimiento).
- Aplicación: cuando el costo por conversación sube, antes de bajar precio, subir percepción.

## 9. April Dunford — posicionamiento
- **Contra quién te comparas** define todo: si la paciente compara con «gimnasio y dieta», el
  mensaje es «resultados que el gimnasio no da»; si compara con «cirugía», es «sin quirófano».
- Alternativas competitivas → atributos únicos → valor → a quién le importa → categoría.
- Aplicación: el radar de competencia y «frente a quién te comparas» del panel viven aquí.

## 10. Neil Patel — contenido medible
- Cada pieza de contenido debe tener una intención de búsqueda y una métrica. Sin medición no hay
  contenido, hay ruido.
- Aplicación: Google Analytics (pestaña Google) y eventos clave son la condición para hablar de
  «contenido que convierte».

## 11. Ryan Deiss — Customer Value Journey
- Ocho etapas: conciencia → interés → suscripción → conversión → emoción → ascenso → defensa →
  promoción. Cada campaña debe declarar qué etapa mueve.
- La pauta fría solo hace conciencia/interés; pedir venta a un frío es quemar plata.
- Aplicación: campañas «fríos» vs «remarketing» vs «calientes» de la cuenta se juzgan con métricas
  distintas (alcance/gancho vs. conversaciones vs. cierre).

## 12. Savannah Sanchez — el gancho de los 3 segundos
- El video se gana o se pierde en el primer segundo: texto en pantalla, cara, movimiento, pregunta.
- **UGC > producción**: la paciente real hablando vence al comercial pulido.
- Iterar ganchos, no videos: mismo cuerpo, 5 arranques distintos.
- Aplicación: `hook_rate` y retención del motor son la nota de Savannah para cada creativo.

## 13. Dara Denney — estrategia creativa en Meta
- La creatividad es la segmentación: el anuncio elige al público por lo que dice.
- **Ángulos**, no formatos: dolor, deseo, prueba social, objeción, comparación, oferta.
- Test con volumen: 5–10 ángulos por semana, matar rápido, escalar lo que gana.
- Aplicación: el motor clasifica ángulo y nivel de consciencia por creativo; Dara dice cuántos
  ángulos vivos hacen falta (R1 «pocos creativos activos»).

## 14. Nick Shackelford — estructura de cuentas Meta
- Menos campañas, más presupuesto por campaña, que el algoritmo aprenda; **no apagar y prender**
  cada dos días (mata el aprendizaje).
- Separar prospección de remarketing; presupuesto fijo mínimo 7 días antes de juzgar.
- Aplicación: la bitácora de cambios (R28) mide exactamente este pecado.

## 15. Chris Do — vender servicios premium por valor
- No se vende tiempo ni sesiones: se vende el resultado y la tranquilidad. Precio anclado al valor.
- **Diagnóstico antes de receta**: la valoración es la venta; quien diagnostica bien cierra.
- Aplicación: el guion de WhatsApp y la valoración pesan más que el descuento.

## 16. Vilma Núñez — estrategia digital latina
- Contenido con estructura: educar, entretener, inspirar, vender, en ese orden.
- Embudos adaptados al WhatsApp y a la venta conversacional, que es como compra Latinoamérica.
- Aplicación: el embudo del motor termina en «conversación», no en carrito, por esto mismo.

## 17. Isra Bravo — copy en español que vende
- Escribe como hablas, con una idea por frase y un solo llamado a la acción.
- **Vende con historias cotidianas** y con un tono que no pide permiso; sin adjetivos vacíos
  («resultados increíbles» no vende; «te cabe otra vez el jean» sí).
- Aplicación: cualquier copy propuesto por la mesa se revisa con este filtro antes de sugerirlo.

## 18. Euge Oller — cierre por WhatsApp
- El lead no es el resultado; la cita agendada y asistida sí. Guion: saludo con nombre, pregunta de
  calificación, propuesta de fecha, confirmación 24 h antes.
- Velocidad: responder en menos de 5 minutos multiplica el cierre.
- Aplicación: `tasa de respuesta` y `conversaciones → citas` del embudo son sus métricas.

## 19. Juan Merodio — marketing para pymes
- Poco presupuesto exige foco: un servicio estrella, un canal principal, una métrica de éxito.
- Digitalizar procesos (agenda, seguimiento) antes de gastar más en pauta.
- Aplicación: cuando la cuenta pauta 10 campañas a la vez, la mesa recomienda concentrar.

## 20. Romuald Fons — Google en español
- La búsqueda captura intención: quien busca «criolipólisis Barranquilla precio» ya quiere comprar.
- Contenido por intención (informativa vs. transaccional) y página por servicio.
- Aplicación: la campaña de búsqueda de Google Ads y las páginas de entrada de Analytics se leen
  con esta lente.

---

## Qué hace la mesa con esto
- **Cita al referente cuando aplica** («como diría Shackelford, esta campaña se apagó 6 veces en
  14 días: nunca aprendió») y lo combina con el dato.
- **No se esconde detrás de ellos**: si el dato contradice al gurú, gana el dato y se dice.
- **La IA suma lo que los referentes no cubren**: contexto local (Barranquilla, clínica, salud
  regulada), estacionalidad, lo que ya se probó en esta cuenta (`datos/experimentos.json`).
- Sector regulado: promesas de resultado, antes/después sin consentimiento y testimonios inventados
  están prohibidos aunque un referente los recomiende.
