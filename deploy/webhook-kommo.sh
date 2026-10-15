#!/bin/bash
# Prepara en la VPS la dirección secreta del webhook de Kommo (se corre una vez; si ya existe, la conserva).
# NO imprime el secreto: deja la dirección completa en entregables/webhook-kommo.txt (modo 600, fuera de git).
#   sudo -u oraculo bash /home/oraculo/oraculo/deploy/webhook-kommo.sh
# Después reiniciar el panel: systemctl restart oraculo-panel
set -e
cd /home/oraculo/oraculo
if ! grep -q '^KOMMO_WEBHOOK_SECRETO=.' .env 2>/dev/null; then
  printf '\nKOMMO_WEBHOOK_SECRETO=%s\n' "$(openssl rand -hex 24)" >> .env
  echo "✓ secreto nuevo creado en .env"
else
  echo "· el secreto ya existía; se conserva"
fi
# llave para cifrar el texto de las conversaciones (datos/chats/): sin ella no se guarda texto
if ! grep -q '^CHATS_LLAVE=.' .env 2>/dev/null; then
  printf 'CHATS_LLAVE=%s\n' "$(openssl rand -hex 32)" >> .env
  echo "✓ llave de cifrado de chats creada (si se pierde, los chats guardados no se pueden leer)"
fi
mkdir -p entregables
S="$(grep '^KOMMO_WEBHOOK_SECRETO=' .env | tail -1 | cut -d= -f2-)"
umask 077
printf 'https://oraculo.vivantemedicinaestetica.com/api/kommo/webhook/%s\n' "$S" > entregables/webhook-kommo.txt
echo "✓ dirección completa en entregables/webhook-kommo.txt"
