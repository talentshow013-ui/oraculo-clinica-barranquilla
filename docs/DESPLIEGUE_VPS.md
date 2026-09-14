# Despliegue en VPS — todo vive en la nube, trabajando solo

Una sola máquina siempre encendida (VPS Ubuntu) con tres cosas adentro:

```
VPS
├── Claude Code  → el analista, con los conectores (Meta, Apify) autorizados una sola vez
├── Reloj        → 06:30 cada día: sincroniza, valida, corre el motor; lunes: informe semanal
└── Panel        → https://oraculo.<tu-dominio> con usuario y clave (+ Cloudflare Access)
```

Nadie prende ningún computador. Las credenciales de Meta/Apify las guarda Claude Code en el
perfil del usuario `oraculo` de la VPS (OAuth), nunca en el repositorio ni en `.env`.

## Qué se necesita

| Pieza | Para qué | Costo aprox. |
|---|---|---|
| VPS Hostinger **KVM 2** (Ubuntu 24.04) | donde vive todo | ~8–13 USD/mes |
| Suscripción Claude (Pro; Max si se queda corta) | el analista | 20 USD/mes (Max: 100) |
| Repositorio privado en GitHub | código; la VPS lo lee con llave de solo lectura | gratis |
| Cloudflare (túnel + Access) | HTTPS y candado por correo | gratis |
| Subdominio de un dominio que ya se tenga | la dirección del panel | gratis |
| Apify (opcional; la captura propia con Playwright es gratis) | radar de competencia | 0–29 USD/mes |
| Conector oficial de Meta (`mcp.facebook.com/ads`) | campañas | gratis |

Sin dominio propio también funciona (ver «Alternativa sin dominio»).

## Instalación (30 minutos, una vez)

1. Comprar la VPS. En el panel de Hostinger: Ubuntu 24.04, anotar IP y clave de root.
2. Entrar: `ssh root@<IP>`.
3. Bajar el instalador y correrlo con la URL SSH del repo privado:
   ```bash
   curl -fsSLO https://raw.githubusercontent.com/<usuario>/<repo>/main/deploy/instalar-vps.sh
   bash instalar-vps.sh git@github.com:<usuario>/<repo>.git
   ```
   (si el repo es privado, primero descargar el archivo por otra vía y subirlo con `scp`).
   El instalador imprime una llave pública: agregarla en GitHub → repo → Settings → Deploy keys
   (solo lectura) y presionar Enter. Al final muestra el usuario y la clave del panel.
4. Pasos manuales, como usuario `oraculo` (`sudo -iu oraculo`):
   1. `claude` → iniciar sesión con la suscripción (imprime un enlace; abrirlo en el navegador).
   2. `claude mcp add --transport http --client-id <META_APP_ID> meta-ads https://mcp.facebook.com/ads`
      y luego dentro de `claude`: `/mcp` → autorizar `meta-ads` y `apify`.
   3. `cd ~/oraculo && claude -p "/oraculo-sincronizar"` → primera sincronización real.
      Revisar `datos/lote.json` con `npm run validar-lote`.
   4. Túnel: `cloudflared tunnel login` → `cloudflared tunnel create oraculo` →
      `cloudflared tunnel route dns oraculo oraculo.<tu-dominio>` → crear `~/.cloudflared/config.yml`:
      ```yaml
      tunnel: oraculo
      credentials-file: /home/oraculo/.cloudflared/<id-del-tunel>.json
      ingress:
        - hostname: oraculo.<tu-dominio>
          service: http://localhost:3000
        - service: http_status:404
      ```
      y `sudo cloudflared service install`.
   5. Cloudflare Zero Trust → Access → Applications → «Oráculo» → política *Allow* con los correos
      autorizados (dueño, coordinadora, agencia). Gratis hasta 50 usuarios.

Desde ese momento: cada día 06:30 el reloj corre solo. Registro en `~/oraculo/reportes/diario.log`.

## Operación

- Ver el estado: `systemctl status oraculo-panel` · `tail -50 ~/oraculo/reportes/diario.log`.
- Correr el reloj a mano: `~/oraculo/deploy/oraculo-diario.sh`.
- Hablar con el analista: `sudo -iu oraculo`, `cd ~/oraculo`, `claude` → `/oraculo-pregunta …`.
- Actualizar código: `git push` al repo; el reloj lo toma en la próxima corrida (o `git pull && npm ci && npm run build && sudo systemctl restart oraculo-panel`).
- Cambiar clave del panel: editar `.env` y `sudo systemctl restart oraculo-panel`.
- El panel recuerda el último cálculo `ORACULO_CACHE_SEG` segundos (600): tras sincronizar, en
  máximo 10 minutos se ve lo nuevo sin reiniciar nada.

## Alternativa sin dominio (uso personal)

Tailscale (gratis para uso personal): `curl -fsSL https://tailscale.com/install.sh | sh && tailscale up`
en la VPS, y la app de Tailscale en el celular/PC de quien vaya a entrar. El panel queda en
`http://<nombre-de-la-vps>:3000/panel`, solo visible para esos dispositivos, sin abrir nada a
internet. El candado de usuario/clave sigue activo.

Lo que NO se recomienda: abrir el puerto 3000 al mundo por IP (`http://IP:3000`): sin HTTPS la
clave viaja en claro.

## Qué pasa si…

- **Se apaga la pauta:** el panel sigue mostrando la historia; las cifras recientes salen en «—»
  o cero real, y el diagnóstico avisa «La pauta está apagada». Nada se borra.
- **Falla la sincronización un día:** el panel sigue con los datos del día anterior; el registro
  lo dice. Al día siguiente se vuelve a intentar (trae desde la última fecha que tenía).
- **Se vence la sesión de Facebook:** `sudo -iu oraculo`, `claude` → `/mcp` → volver a autorizar.
- **La VPS se reinicia:** el panel y el túnel arrancan solos (servicios del sistema).
