#!/usr/bin/env bash
# Oráculo · instalador para VPS (Ubuntu 22.04 / 24.04). Ejecutar como root:
#   bash instalar-vps.sh git@github.com:<usuario>/<repo>.git
# Qué hace: usuario `oraculo`, Node 22, Claude Code, cloudflared, clona el repo (llave de despliegue
# de solo lectura), construye el panel, lo deja como servicio, programa el reloj de las 06:30 y
# crea el candado (usuario/clave) del panel. Al final imprime los pasos manuales (inicios de sesión).
set -euo pipefail
REPO_URL="${1:-}"
[ -n "$REPO_URL" ] || { echo "Uso: bash instalar-vps.sh <url-ssh-del-repo>"; exit 1; }
[ "$(id -u)" = "0" ] || { echo "Ejecutar como root"; exit 1; }

paso() { echo; echo "[$1] $2"; }

paso 1 "Sistema: zona horaria Bogotá, paquetes base"
timedatectl set-timezone America/Bogota
apt-get update -qq
apt-get install -y -qq git curl ca-certificates gnupg cron unzip lsb-release >/dev/null

paso 2 "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v

paso 3 "Usuario oraculo"
id oraculo >/dev/null 2>&1 || adduser --disabled-password --gecos "Oraculo" oraculo
# Solo puede reiniciar su propio servicio (lo usa el reloj cuando llega código nuevo).
echo "oraculo ALL=(root) NOPASSWD: /usr/bin/systemctl restart oraculo-panel" >/etc/sudoers.d/oraculo
chmod 440 /etc/sudoers.d/oraculo

paso 4 "Llave de despliegue (solo lectura) para GitHub"
sudo -u oraculo bash -c 'mkdir -p ~/.ssh && chmod 700 ~/.ssh; [ -f ~/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C oraculo-vps -q; ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null'
if [ "${ORACULO_SIN_PAUSA:-}" = "1" ]; then
  echo "  llave ya registrada en GitHub por instalar-desde-aqui.sh"
else
  echo
  echo "  >>> Copia esta llave PUBLICA en GitHub -> repo -> Settings -> Deploy keys (solo lectura):"
  echo
  cat /home/oraculo/.ssh/id_ed25519.pub
  echo
  read -r -p "  Cuando la hayas agregado, presiona Enter para continuar... " _
fi

paso 5 "Código"
sudo -u oraculo bash -c "cd ~ && if [ -d oraculo/.git ]; then cd oraculo && git pull --ff-only; else git clone '$REPO_URL' oraculo; fi"

paso 6 "Claude Code (el analista) y cloudflared (la puerta)"
sudo -u oraculo bash -c 'mkdir -p ~/.npm-global && npm config set prefix ~/.npm-global; grep -q npm-global ~/.profile || echo "export PATH=\$HOME/.npm-global/bin:\$PATH" >> ~/.profile; export PATH=$HOME/.npm-global/bin:$PATH; npm install -g @anthropic-ai/claude-code >/dev/null 2>&1; claude --version'
if ! command -v cloudflared >/dev/null; then
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" >/etc/apt/sources.list.d/cloudflared.list
  apt-get update -qq && apt-get install -y -qq cloudflared >/dev/null
fi
cloudflared --version

paso 7 "Panel: dependencias, configuración y construcción"
CLAVE="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16)"
sudo -u oraculo env CLAVE="$CLAVE" bash -c 'cd ~/oraculo && npm ci --no-audit --no-fund >/dev/null && if [ ! -f .env ]; then cp .env.example .env; sed -i "s/^ORACULO_FUENTE=.*/ORACULO_FUENTE=archivo/" .env; sed -i "s/^ORACULO_USUARIO=.*/ORACULO_USUARIO=clinica/" .env; sed -i "s/^ORACULO_CLAVE=.*/ORACULO_CLAVE=$CLAVE/" .env; fi; npm run seed >/dev/null; npm run build >/dev/null; mkdir -p reportes datos'

paso 8 "Servicio del panel y reloj diario"
cp /home/oraculo/oraculo/deploy/oraculo-panel.service /etc/systemd/system/oraculo-panel.service
systemctl daemon-reload
systemctl enable --now oraculo-panel >/dev/null
chmod +x /home/oraculo/oraculo/deploy/oraculo-diario.sh
sudo -u oraculo bash -c '( crontab -l 2>/dev/null | grep -v oraculo-diario ; echo "30 6 * * * /home/oraculo/oraculo/deploy/oraculo-diario.sh" ) | crontab -'
sleep 3
curl -s -o /dev/null -w "  panel local: HTTP %{http_code} (401 = candado activo, correcto)\n" http://127.0.0.1:3000/panel

CLAVE_FINAL="$(grep ^ORACULO_CLAVE /home/oraculo/oraculo/.env | cut -d= -f2)"
echo
echo "====================================================================="
echo "  ORACULO instalado. Panel: http://127.0.0.1:3000/panel (solo dentro de la VPS por ahora)"
echo "  Usuario del panel: clinica   Clave: $CLAVE_FINAL"
echo "  (cambiala en /home/oraculo/oraculo/.env y reinicia: systemctl restart oraculo-panel)"
echo
echo "  PASOS MANUALES (una sola vez, como usuario oraculo:  sudo -iu oraculo):"
echo "  1) claude            -> inicia sesion con la suscripcion (abre un enlace; pegalo en tu navegador)"
echo "  2) claude mcp add --transport http meta_ads https://mcp.facebook.com/ads"
echo "     claude -> /mcp   -> autorizar meta_ads (Facebook) y apify (ya declarado en .mcp.json)"
echo "  3) cd ~/oraculo && claude -p \"/oraculo-sincronizar\"   -> primera sincronizacion real"
echo "  4) cloudflared tunnel login && cloudflared tunnel create oraculo"
echo "     cloudflared tunnel route dns oraculo oraculo.<tu-dominio>"
echo "     (config en ~/.cloudflared/config.yml -> ingress a http://localhost:3000)"
echo "     sudo cloudflared service install   -> el panel queda en https://oraculo.<tu-dominio>"
echo "  5) Cloudflare Zero Trust -> Access -> aplicacion Oraculo -> politica: correos autorizados."
echo "  Guia completa: docs/DESPLIEGUE_VPS.md"
echo "====================================================================="
