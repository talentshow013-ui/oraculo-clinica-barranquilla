#!/usr/bin/env bash
# Oráculo · instalar la VPS del cliente DESDE ESTE PC, en un solo comando.
#   bash deploy/instalar-desde-aqui.sh <IP-de-la-VPS> [usuario-ssh=root]
# Requisitos aquí: ssh (con la llave ~/.ssh/oraculo_vps ya cargada en la VPS al crearla) y `gh` con sesión.
# Qué hace:
#   1) Sube el instalador a la VPS y crea el usuario `oraculo` con su llave de despliegue.
#   2) Registra esa llave en GitHub (solo lectura) con `gh`, sin tocar el navegador.
#   3) Corre el instalador completo (Node, Claude Code, cloudflared, panel, servicio, reloj).
#   4) Imprime lo único que falta: los 3 inicios de sesión de la clínica (Claude, Facebook, Cloudflare).
set -euo pipefail
IP="${1:-}"; USUARIO="${2:-root}"
[ -n "$IP" ] || { echo "Uso: bash deploy/instalar-desde-aqui.sh <IP> [usuario]"; exit 1; }
AQUI="$(cd "$(dirname "$0")/.." && pwd)"
LLAVE="$HOME/.ssh/oraculo_vps"
SSH="ssh -i $LLAVE -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 $USUARIO@$IP"
REPO_SSH="git@github.com:talentshow013-ui/oraculo-clinica-barranquilla.git"
REPO_GH="talentshow013-ui/oraculo-clinica-barranquilla"

echo "[1/4] Probando acceso a $IP"
$SSH 'echo "  conectado a $(hostname) · $(lsb_release -ds 2>/dev/null || cat /etc/os-release | head -1)"'

echo "[2/4] Usuario oraculo y llave de despliegue"
$SSH 'id oraculo >/dev/null 2>&1 || adduser --disabled-password --gecos Oraculo oraculo >/dev/null; sudo -u oraculo bash -c "mkdir -p ~/.ssh && chmod 700 ~/.ssh; [ -f ~/.ssh/id_ed25519 ] || ssh-keygen -t ed25519 -N \"\" -f ~/.ssh/id_ed25519 -C oraculo-vps -q; ssh-keyscan -H github.com >> ~/.ssh/known_hosts 2>/dev/null"; cat /home/oraculo/.ssh/id_ed25519.pub' > "$AQUI/.vps-deploy-key.pub"
if gh repo deploy-key list -R "$REPO_GH" 2>/dev/null | grep -q "oraculo-vps-$IP"; then
  echo "  la llave de esta VPS ya estaba en GitHub"
else
  gh repo deploy-key add "$AQUI/.vps-deploy-key.pub" -R "$REPO_GH" -t "oraculo-vps-$IP" >/dev/null
  echo "  llave registrada en GitHub (solo lectura)"
fi
rm -f "$AQUI/.vps-deploy-key.pub"

echo "[3/4] Instalación completa en la VPS (5-10 minutos)"
scp -i "$LLAVE" -o StrictHostKeyChecking=accept-new "$AQUI/deploy/instalar-vps.sh" "$USUARIO@$IP:/root/instalar-vps.sh" >/dev/null
$SSH "ORACULO_SIN_PAUSA=1 bash /root/instalar-vps.sh '$REPO_SSH'"

echo
echo "[4/4] Listo desde aquí. Lo que sigue lo hace la clínica en la llamada (cada paso imprime un enlace que ella abre):"
echo "   ssh -i $LLAVE $USUARIO@$IP"
echo "   sudo -iu oraculo"
echo "   claude                                   # 1) sesión de Claude (su suscripción)"
echo "   claude mcp add --transport http --client-id 4572635166299856 meta-ads https://mcp.facebook.com/ads"
echo "   claude   →  /mcp                          # 2) autorizar meta-ads y apify con su Facebook / su Apify"
echo "   cloudflared tunnel login                  # 3) su Cloudflare (o Tailscale si no quieren dominio)"
echo "   Guía: docs/DESPLIEGUE_VPS.md · Checklist: docs/CHECKLIST_INSTALACION.md"
