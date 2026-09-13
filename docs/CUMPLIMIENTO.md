# Cumplimiento — para revisar con el cliente

## 1. Datos personales y de salud (Ley 1581 de 2012 y Decreto 1377 de 2013)

Una clínica estética trata **datos sensibles** (salud, art. 5 de la Ley 1581). El panel se diseñó
para que **no exista dónde guardar un dato identificable de paciente**:

- El contrato de datos (`RegistroEmbudo`) es agregado: fecha, campaña, servicio, paso, cantidad.
  No tiene, ni puede tener, nombre, documento, teléfono, correo, dirección ni historia clínica.
  El esquema es estricto: un campo extra rompe la carga.
- El guardián de ingesta (`validarSinPII`) detiene cualquier carga que traiga una clave prohibida,
  citando la ley. Es más barato romper una importación que filtrar un dato de una paciente.
- Los cruces demográficos con menos de **5 personas** se ocultan (k-anonimato). Un cruce "1 paciente,
  mujer, 52 años, barrio X, criolipólisis" identifica a alguien aunque no aparezca su nombre.
- La única función de pseudonimización (SHA-256 con sal) existe para deduplicar recompras si algún
  día se necesita; no se usa en la fase 1 y nunca es reversible.

### Lo que el panel NO cubre y es obligación de la clínica

- Autorización previa, expresa e informada para tratar datos sensibles (art. 6 y 9).
- Política de tratamiento de datos publicada y aviso de privacidad (arts. 15-17, Decreto 1377).
- Registro Nacional de Bases de Datos ante la SIC cuando aplique (según activos/ingresos).
- Canal de atención de consultas y reclamos de titulares (arts. 14-15).
- Contratos de encargo con quien procese datos por cuenta de la clínica (agencia, software de agenda).
- Consentimiento explícito y por escrito de cualquier paciente que aparezca en un testimonio.

## 2. Publicidad de servicios de salud en Colombia

- La publicidad de servicios de salud está sujeta a la vigilancia de la **Superintendencia Nacional
  de Salud** y, en dispositivos/productos, del **INVIMA**. Los procedimientos estéticos deben
  realizarse por profesionales habilitados en servicios habilitados (Resolución 3100 de 2019).
- No se pueden prometer resultados garantizados ni presentar el procedimiento como exento de riesgo.
- Los mensajes deben identificar al profesional y su registro cuando se invoque autoridad médica.
- El clasificador `riesgoPolitica` y la regla **R09** detectan antes/después, promesas absolutas,
  referencias negativas al cuerpo del espectador y afirmaciones de pérdida de peso: son las
  señales que la plataforma rechaza y que además pueden constituir publicidad engañosa
  (Estatuto del Consumidor, Ley 1480 de 2011).

## 3. Políticas de la plataforma (Meta) para salud y belleza

- Prohibido el contenido de **antes y después**, las imágenes que hagan sentir mal a la persona con
  su cuerpo, las afirmaciones de resultados poco realistas y la referencia a atributos personales
  ("¿cansada de tu barriga?").
- Un rechazo no solo apaga el anuncio: **reinicia la fase de aprendizaje** de la campaña.
- El panel marca estos riesgos antes de publicar (R09). La decisión final es del equipo.

## 4. Datos que salen del equipo de la coordinadora

- **Ninguno.** El panel corre en el computador de la coordinadora. No hay servidor, no hay nube,
  no hay envío de datos a terceros. Los datos reales de campañas entran por el conector oficial de
  la plataforma bajo la sesión de la coordinadora y se guardan en `datos/lote.json` (excluido del
  repositorio por `.gitignore`).
- El repositorio en GitHub contiene código, documentación y datos de demostración sintéticos.
  **Nunca** debe subirse `datos/lote.json`, `.env` ni la planilla de agenda.

## 5. Checklist para la reunión 1

- [ ] Calibrar `config/cliente.ts`: tickets y costos directos por servicio (sin esto media pantalla
      muestra "—" a propósito), horario de atención, cupos diarios, municipios del radio.
- [ ] Cargar 60 días de agenda y ventas **agregados** (planilla sin datos de pacientes).
- [ ] Definir 6-10 competidores del radio real de captación.
- [ ] Confirmar que la política de tratamiento de datos y el aviso de privacidad están publicados.
- [ ] Confirmar consentimientos de los testimonios que se usen en pauta.
- [ ] Acordar quién ejecuta la sincronización semanal y el informe (`/oraculo-sincronizar`, `/oraculo-semana`).
