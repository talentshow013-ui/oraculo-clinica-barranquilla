#!/usr/bin/env bash
# Radar de referentes (Medellín, Santa Marta, Cartagena, Miami, Los Ángeles, Houston, Nueva York):
# captura la Biblioteca de anuncios de Meta y rehace el radar del panel. Tarda unos 40 minutos.
# Cron: domingos 3:00 a. m. (hora de Bogotá). Lo instala instalar-vps.sh.
set -u
cd /home/oraculo/oraculo || exit 1
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"
mkdir -p reportes
{
  echo "== radar $(TZ=America/Bogota date '+%F %H:%M') =="
  npm run -s radar:referencias && echo "radar: al día" || echo "radar: FALLÓ (ver arriba)"
  # las imágenes nuevas de public/radar se sirven al reiniciar el panel
  sudo -n systemctl restart oraculo-panel && echo "panel: reiniciado"
} >>reportes/radar.log 2>&1
