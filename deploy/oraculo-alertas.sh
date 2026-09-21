#!/usr/bin/env bash
# Alertas de la clínica por Telegram, tres veces al día (6:00, 12:00, 18:00; cron lo instala instalar-vps.sh).
# Primero trae la pauta de Meta y Google en vivo (para que el mediodía y la tarde tengan el día de hoy),
# luego evalúa los umbrales (lib/notificaciones/alertas.ts) y manda el estado de todo lo activo.
set -u
cd /home/oraculo/oraculo || exit 1
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"
HOY=$(TZ=America/Bogota date +%F)
mkdir -p reportes
{
  echo "== alertas $(TZ=America/Bogota date '+%F %H:%M') =="
  if command -v claude >/dev/null 2>&1; then
    claude -p "/oraculo-sincronizar" --permission-mode bypassPermissions --max-turns 60 >"reportes/sincronizacion-alertas-$HOY.md" 2>&1 && echo "meta: al día" || echo "meta: falló la sincronización (se usa lo último)"
  fi
  grep -q '^GOOGLE_ADS_REFRESH_TOKEN=.\+' .env 2>/dev/null && { npm run -s googleads:sincronizar >/dev/null 2>&1 && echo "google ads: al día" || echo "google ads: falló"; }
  if grep -q '^TELEGRAM_BOT_TOKEN=.\+' .env 2>/dev/null && grep -q '^TELEGRAM_CHAT_ID=.\+' .env 2>/dev/null; then
    npm run -s notificar -- --alertas && echo "telegram: alertas enviadas" || echo "telegram: FALLÓ"
  else
    echo "telegram: sin configurar"
  fi
} >>"reportes/alertas.log" 2>&1
