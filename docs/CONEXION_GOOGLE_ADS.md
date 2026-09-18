# Conectar Google Ads (pauta) — una sola vez, solo lectura

Oráculo lee Google Ads con la Google Ads API. Google pide tres cosas: un **token de desarrollador**
(lo da una cuenta administradora de Google Ads), un **cliente OAuth** (en Google Cloud, el mismo
proyecto donde se creó la llave de Analytics) y el **permiso** de la persona que administra la cuenta
de Google Ads de la clínica. Nada escribe en Google Ads: solo consultas de informes.

## 1. Token de desarrollador (cuenta administradora, 10 min + espera de Google)

1. https://ads.google.com/home/tools/manager-accounts/ → **Crear una cuenta de administrador**
   (gratis; puede ser de la agencia o de la clínica). Si ya existe una, úsala.
2. Dentro de la cuenta administradora: **Herramientas → Configuración → Centro de API** → aceptar
   términos → aparece el **Token de desarrollador**. Cópialo.
3. Ese token nace en «acceso de prueba» (solo cuentas de prueba). Pide **acceso básico** en el
   mismo Centro de API (formulario corto: uso interno, informes de nuestra propia cuenta, solo
   lectura). Google responde en 1–3 días hábiles. Mientras, el resto se puede dejar listo.
4. Vincula la cuenta de Google Ads de la clínica a la administradora: en la administradora →
   **Cuentas → + → Vincular cuenta existente** → id de la cuenta de la clínica → la clínica acepta
   la invitación en su Google Ads. (Si el Google que autoriza en el paso 3 ya administra directamente
   la cuenta de la clínica, este paso no es necesario.)

## 2. Cliente OAuth (Google Cloud, 5 min)

1. https://console.cloud.google.com → proyecto **My First Project** (el de Analytics) → **APIs y
   servicios → Biblioteca** → buscar `Google Ads API` → **Habilitar**.
2. **APIs y servicios → Pantalla de consentimiento de OAuth** → tipo *Externo* → nombre «Oráculo»,
   correo de contacto → Guardar. En **Usuarios de prueba** agrega el Google que administra Google Ads.
3. **Credenciales → + Crear credenciales → ID de cliente de OAuth** → tipo **Aplicación de
   escritorio** → nombre «Oráculo» → Crear. Copia **ID de cliente** y **Secreto de cliente**.

## 3. Conectar (PC o VPS, 2 min)

En `.env`:
```
GOOGLE_ADS_DEVELOPER_TOKEN=<token de desarrollador>
GOOGLE_ADS_CLIENT_ID=<id de cliente OAuth>
GOOGLE_ADS_CLIENT_SECRET=<secreto>
GOOGLE_ADS_LOGIN_CUSTOMER_ID=<id de la cuenta administradora, sin guiones; solo si se entra por ella>
```
Luego:
```bash
npm run googleads:conectar          # abre el permiso de Google; entra con el Google que administra Google Ads
npm run googleads:sincronizar -- --dias 90
```
El primer comando guarda `GOOGLE_ADS_REFRESH_TOKEN` y, si solo hay una cuenta, `GOOGLE_ADS_CUSTOMER_ID`
(si hay varias, las lista y se pone la de la clínica a mano). Desde ahí el reloj diario sincroniza
solo; la cuenta aparece en el panel como **«Google Ads · <id>»** en el selector de cuenta, con las
mismas pantallas que Meta.

Lo que se trae por día y por campaña / grupo / anuncio: costo, impresiones, clics, conversiones,
interacciones, reproducciones de video; y títulos, descripciones y URL final de cada anuncio.
Alcance, frecuencia y desgloses por edad/hora/ciudad de Google Ads no se traen todavía («—»).

## Si algo falla
- «DEVELOPER_TOKEN_NOT_APPROVED» / «not approved»: el token sigue en modo prueba; falta el acceso
  básico del paso 1.3.
- «USER_PERMISSION_DENIED»: el Google que autorizó no tiene acceso a esa cuenta, o falta
  `GOOGLE_ADS_LOGIN_CUSTOMER_ID` cuando se entra por la administradora.
- «invalid_grant» al sincronizar: el permiso se revocó; repite `npm run googleads:conectar`.
- Versión de API retirada (error «version … is deprecated»): poner `GOOGLE_ADS_API_VERSION=v23` (o
  la vigente) en `.env`.
