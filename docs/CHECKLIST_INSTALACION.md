# Checklist de instalación — para la llamada con el cliente

Todo lo que hay que tener y hacer, en orden. Marca cada línea.

## A. Pedir HOY (antes de la llamada), para no perder tiempo mañana

- [ ] **VPS comprada** en Hostinger: plan KVM 2, Ubuntu 24.04. Necesito la **IP** y la **clave de root**.
      Si mañana no está: se instala en el PC de la coordinadora (`instalar.ps1`) y se pasa a la VPS después; es el mismo repo.
- [ ] **Cuenta Claude con suscripción** (Pro mínimo): correo y clave a la mano para iniciar sesión.
- [ ] **Quién autoriza Meta**: un usuario de Facebook que sea **administrador** de las cuentas
      publicitarias en el Business Manager de la clínica. Debe estar en la llamada.
- [ ] **Las cuentas publicitarias reales**: nombre e id (`act_…`) de cada una. Hoy en el sistema hay
      tres de ejemplo ("Vivante Riomar / Norte / Médicos"): se reemplazan por las reales.
- [ ] **App ID de Meta** (de la agencia, developers.facebook.com). Sin esto no se conecta el conector.
- [ ] **Nada de planillas.** La agenda se registra en el panel (pantalla «Agenda semanal»): cinco
      números cada lunes. Solo hay que decidir **quién** lo va a hacer (normalmente la coordinadora).
- [ ] **Precios y costos** de los 6–8 servicios principales (ticket y costo directo) para calibrar;
      mientras no estén, el panel muestra «—» en retorno sobre margen.
- [ ] **6 a 10 páginas de Facebook de competidores** (nombre o enlace) para el radar.

## B. Durante la llamada (con VPS) — 30 a 40 minutos

1. **Yo entro a la VPS** (`ssh root@IP`) y corro el instalador:
   `bash instalar-vps.sh git@github.com:talentshow013-ui/oraculo-clinica-barranquilla.git`
   → imprime una llave; la agrego en GitHub (Deploy keys) y sigue. Deja el panel, el reloj y el candado.
2. **Iniciar sesión en Claude** (ellos): `claude` muestra un enlace → lo abren en su navegador con
   su cuenta → listo.
3. **Conectar Meta** (ellos): `claude mcp add --transport http --client-id <APP_ID> meta-ads https://mcp.facebook.com/ads`
   → dentro de `claude`, `/mcp` → autorizar con el Facebook del administrador → aceptar permisos.
4. **Conectar Apify** (opcional, gratis): en `/mcp` autorizar `apify` con una cuenta de Apify.
5. **Cuentas reales**: edito `config/cliente.ts` con los `act_…` y nombres reales. Subo el cambio.
6. **Primera sincronización**: `claude -p "/oraculo-sincronizar"` → revisamos `npm run validar-lote`.
   (Primera vez con datos reales: es normal ajustar el mapeo de campos; lo hago en la llamada.)
7. **Radar**: `npm run radar:capturar -- --q "clínica estética barranquilla"` y las páginas de competidores.
8. **La puerta**: Cloudflare túnel a `oraculo.<dominio>` + Access con sus correos
   (o Tailscale si no quieren dominio). Probar desde el celular del cliente.
9. **Entregar**: usuario y clave del panel; mostrarles Centro de mando → Diagnóstico → Campañas → Radar
   y **registrar juntos la semana pasada en Agenda semanal** (así aprenden el ritual de los lunes).
   Guion: `docs/GUIA_PANTALLAS.md`.

## C. Si mañana NO hay VPS (instalar en el PC de la coordinadora)

1. Instalar Node.js LTS (nodejs.org) y Git; instalar Claude Code: `npm install -g @anthropic-ai/claude-code`.
2. `git clone https://github.com/talentshow013-ui/oraculo-clinica-barranquilla` (hay que darle acceso
   al repo privado o pasarle el zip).
3. Doble clic en `instalar.ps1` → abre el panel con datos de demostración.
4. Pasos 2, 3, 5, 6, 7 de la sección B, en su PC (`claude` desde la carpeta del proyecto).
5. En `.env`: `ORACULO_FUENTE=archivo`. Ritual: cada lunes `/oraculo-sincronizar` y `/oraculo-semana`.

## D. Qué NO hacer en la llamada

- No pedir ni copiar tokens, claves de API ni contraseñas de Facebook: todo entra por "iniciar sesión".
- No abrir el puerto de la VPS al mundo sin la puerta (Cloudflare/Tailscale).
- No cargar nombres de pacientes en ningún lado: la Agenda semanal solo acepta cantidades.

## E. Después de la llamada

- `npm run doctor` en la máquina: todo debe decir OK.
- Ver que el reloj corra al día siguiente: `tail -30 ~/oraculo/reportes/diario.log`.
- Calibrar tickets en `config/cliente.ts` cuando pasen los precios.
