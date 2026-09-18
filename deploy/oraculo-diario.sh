#!/usr/bin/env bash
# Reloj diario de Oráculo (corre como usuario `oraculo`, 06:30 America/Bogota, vía cron).
# 1) Trae código nuevo si lo hay.  2) Sincroniza datos con los conectores (Claude Code).
# 3) Valida el lote y corre el motor.  4) Los lunes, redacta el informe semanal.
# Nada aquí guarda credenciales: Claude Code usa las suyas (perfil del usuario `oraculo`).
set -u
export TZ=America/Bogota
export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
REPO="$HOME/oraculo"
LOG="$REPO/reportes/diario.log"
HOY="$(date +%F)"
cd "$REPO" || exit 1
mkdir -p reportes datos
exec >>"$LOG" 2>&1
echo "=== $(date '+%F %T') · inicio"

# 1) Código
ANTES="$(git rev-parse HEAD)"
git pull --ff-only --quiet || echo "aviso: no se pudo traer código nuevo (se sigue con el actual)"
if [ "$ANTES" != "$(git rev-parse HEAD)" ]; then
  echo "código nuevo: reinstalando y reconstruyendo"
  npm ci --no-audit --no-fund && npm run build && sudo -n systemctl restart oraculo-panel
fi

# 2) Datos (Claude Code sin interfaz; los conectores ya están autorizados en este perfil)
ESTADO=""
if command -v claude >/dev/null 2>&1; then
  if claude -p "/oraculo-sincronizar" --permission-mode bypassPermissions --max-turns 60 >"reportes/sincronizacion-$HOY.md" 2>&1; then
    echo "sincronización: ok"; ESTADO="Campañas: sincronizadas"
  else
    echo "sincronización: FALLÓ (ver reportes/sincronizacion-$HOY.md)"; ESTADO="Campañas: NO se pudieron sincronizar (se muestra lo de ayer)"
  fi
else
  echo "aviso: Claude Code no está instalado en esta máquina; no se sincronizó"; ESTADO="Campañas: sin sincronizar (falta Claude Code)"
fi

# 2b) Orgánico (Instagram y Facebook sin pauta): directo a Meta con el token de página del .env
if grep -q '^META_ORGANICO_TOKEN=.\+' .env 2>/dev/null; then
  if npm run -s organico:sincronizar >"reportes/organico-$HOY.log" 2>&1; then echo "orgánico: ok"; ESTADO="$ESTADO · Orgánico: al día"; else echo "orgánico: FALLÓ (ver reportes/organico-$HOY.log)"; ESTADO="$ESTADO · Orgánico: falló"; fi
else
  echo "orgánico: sin conectar (npm run organico:conectar -- <token>)"
fi

# 2d) Pauta de TikTok (solo lectura, token del .env)
if grep -q '^TIKTOK_ACCESS_TOKEN=.\+' .env 2>/dev/null; then
  if npm run -s tiktok:sincronizar >"reportes/tiktok-$HOY.log" 2>&1; then echo "tiktok: ok"; ESTADO="$ESTADO · TikTok: al día"; else echo "tiktok: FALLÓ (ver reportes/tiktok-$HOY.log)"; ESTADO="$ESTADO · TikTok: falló"; fi
else
  echo "tiktok: sin conectar (docs/CONEXION_TIKTOK.md)"
fi

# 2e) Pauta de Google Ads (solo lectura)
if grep -q '^GOOGLE_ADS_REFRESH_TOKEN=.\+' .env 2>/dev/null; then
  if npm run -s googleads:sincronizar >"reportes/googleads-$HOY.log" 2>&1; then echo "google ads: ok"; ESTADO="$ESTADO · Google Ads: al día"; else echo "google ads: FALLÓ (ver reportes/googleads-$HOY.log)"; ESTADO="$ESTADO · Google Ads: falló"; fi
else
  echo "google ads: sin conectar (docs/CONEXION_GOOGLE_ADS.md)"
fi

# 2c) Sitio web (Google Analytics 4): llave de solo lectura del .env
if grep -q '^GA4_PROPIEDAD_ID=.\+' .env 2>/dev/null; then
  if npm run -s web:sincronizar >"reportes/web-$HOY.log" 2>&1; then echo "sitio web: ok"; ESTADO="$ESTADO · Sitio web: al día"; else echo "sitio web: FALLÓ (ver reportes/web-$HOY.log)"; ESTADO="$ESTADO · Sitio web: falló"; fi
else
  echo "sitio web: sin conectar (docs/CONEXION_GA4.md)"
fi

# 3) Validar y correr el motor
if npm run -s validar-lote; then echo "lote: válido"; else echo "lote: INVÁLIDO — el panel sigue con el anterior"; fi
if npm run -s verificar -- --json >"reportes/ultimo.json" 2>/dev/null; then echo "motor: ok"; else echo "motor: FALLÓ"; fi

# 4) Lunes: informe semanal
if [ "$(date +%u)" = "1" ] && command -v claude >/dev/null 2>&1; then
  if claude -p "/oraculo-semana" --permission-mode bypassPermissions --max-turns 40 >"reportes/semana-$HOY.md" 2>&1; then
    echo "informe semanal: reportes/semana-$HOY.md"
  else
    echo "informe semanal: FALLÓ"
  fi
fi

# 5) Avisos por Telegram (si está configurado): resumen de la mañana y, los lunes, el informe
if grep -q '^TELEGRAM_BOT_TOKEN=.\+' .env 2>/dev/null && grep -q '^TELEGRAM_CHAT_ID=.\+' .env 2>/dev/null; then
  if npm run -s notificar -- --estado "$ESTADO" >/dev/null 2>"reportes/telegram-$HOY.log"; then echo "telegram: resumen enviado"; else echo "telegram: FALLÓ (ver reportes/telegram-$HOY.log)"; fi
  if [ "$(date +%u)" = "1" ] && [ -s "reportes/semana-$HOY.md" ]; then
    npm run -s notificar -- --archivo "reportes/semana-$HOY.md" >/dev/null 2>>"reportes/telegram-$HOY.log" && echo "telegram: informe semanal enviado"
  fi
else
  echo "telegram: sin configurar (TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en .env)"
fi

# Limpieza: conservar 60 días de registros
find reportes -name 'sincronizacion-*.md' -mtime +60 -delete 2>/dev/null
find reportes -name 'organico-*.log' -mtime +60 -delete 2>/dev/null
find reportes -name 'telegram-*.log' -mtime +60 -delete 2>/dev/null
find reportes -name 'web-*.log' -mtime +60 -delete 2>/dev/null
find reportes -name 'tiktok-*.log' -mtime +60 -delete 2>/dev/null
find reportes -name 'googleads-*.log' -mtime +60 -delete 2>/dev/null
echo "=== $(date '+%F %T') · fin"
