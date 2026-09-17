# Conectar Google Analytics 4 (sitio web) — una sola vez, solo lectura

Oráculo lee el sitio web desde Google Analytics con una **cuenta de servicio** de Google que solo
puede leer (rol «Lector» en la propiedad). No pide contraseñas de nadie, no puede cambiar nada y la
llave vive fuera del repositorio (`datos/ga4-credenciales.json`, gitignored).

## Lo que se necesita (15 minutos, con quien administra Google Analytics de la clínica)

1. **Id de la propiedad GA4**: en analytics.google.com → Administrar → Detalles de la propiedad →
   «ID de la propiedad» (número, p. ej. `123456789`).
2. **Cuenta de servicio** (la crea la agencia una vez, sirve para todos los clientes):
   - console.cloud.google.com → un proyecto (p. ej. «Oráculo») → APIs y servicios → Biblioteca →
     habilitar **Google Analytics Data API**.
   - IAM y administración → Cuentas de servicio → Crear (nombre `oraculo-lector`) → sin roles →
     Claves → Agregar clave → JSON → se descarga un archivo.
   - Ese archivo se guarda como `datos/ga4-credenciales.json` en el PC/VPS donde corre Oráculo.
3. **Darle acceso de lectura**: en Google Analytics → Administrar → Gestión de acceso a la
   propiedad → Agregar usuarios → pegar el correo de la cuenta de servicio (termina en
   `.iam.gserviceaccount.com`) → rol **Lector** (Viewer).
4. En `.env`:
   ```
   GA4_PROPIEDAD_ID=123456789
   GA4_CREDENCIALES=datos/ga4-credenciales.json
   ```
5. Primera carga: `npm run web:sincronizar -- --dias 90`. Después, el reloj diario lo hace solo.
6. Panel → desplegable **Pauta / Orgánico / Google** → **Google**.

## Qué se trae
Por día: sesiones, usuarios, usuarios nuevos, sesiones con interacción, duración media y eventos
clave por **canal** y **fuente/medio**; páginas de entrada; eventos (cuáles son clave); ciudades.
Google guarda 14 meses por defecto.

## Los eventos clave son la pieza que más vale
Sin eventos clave («clic a WhatsApp», «formulario enviado») Google solo cuenta visitas, y una visita
no es un contacto. En Google Analytics → Administrar → Eventos → marcar como **evento clave** los
que representen un contacto. Si el sitio no dispara ese evento al pulsar el botón de WhatsApp, hay
que agregarlo (Google Tag Manager o una línea en el botón). Oráculo avisa si no encuentra ninguno.

## Si algo falla
- «Google no dio token»: la llave JSON no es de cuenta de servicio o está corrupta.
- «(403) … does not have sufficient permissions»: falta el paso 3 (rol Lector).
- «(404) … not found»: el id de la propiedad está mal (es el numérico, no el «G-XXXX»).
- «Field city is not a valid dimension»: raro; se anota como aviso y el resto sigue.
