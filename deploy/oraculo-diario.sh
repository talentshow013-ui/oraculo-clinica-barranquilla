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
if command -v claude >/dev/null 2>&1; then
  if claude -p "/oraculo-sincronizar" --permission-mode bypassPermissions --max-turns 60 >"reportes/sincronizacion-$HOY.md" 2>&1; then
    echo "sincronización: ok"
  else
    echo "sincronización: FALLÓ (ver reportes/sincronizacion-$HOY.md)"
  fi
else
  echo "aviso: Claude Code no está instalado en esta máquina; no se sincronizó"
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

# Limpieza: conservar 60 días de registros
find reportes -name 'sincronizacion-*.md' -mtime +60 -delete 2>/dev/null
echo "=== $(date '+%F %T') · fin"
