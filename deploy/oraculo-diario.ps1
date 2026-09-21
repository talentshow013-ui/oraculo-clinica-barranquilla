# Reloj diario de ORÁCULO para un PC con Windows (la versión Linux es oraculo-diario.sh).
# Trae todos los datos una vez al día para que el agente responda en segundos desde lo local
# y NUNCA tenga que ir a buscar nada en medio de una pregunta.
# Se registra una vez con: powershell -ExecutionPolicy Bypass -File deploy\instalar-reloj-windows.ps1
param([string]$Carpeta = (Split-Path -Parent $PSScriptRoot))
Set-Location $Carpeta
$hoy = Get-Date -Format 'yyyy-MM-dd'
New-Item -ItemType Directory -Force reportes | Out-Null
"== $hoy $(Get-Date -Format 'HH:mm') ==" | Out-File -Append -Encoding utf8 reportes\reloj.log

git pull --ff-only -q 2>&1 | Out-File -Append -Encoding utf8 reportes\reloj.log

# Meta (pauta): por el conector de Claude Code
if (Get-Command claude -ErrorAction SilentlyContinue) {
  claude -p "/oraculo-sincronizar" --permission-mode bypassPermissions --max-turns 60 2>&1 | Out-File -Encoding utf8 "reportes\sincronizacion-$hoy.md"
  "meta: listo" | Out-File -Append -Encoding utf8 reportes\reloj.log
}
# Las demás fuentes: scripts propios (cada uno se salta solo si falta su llave en .env)
foreach ($s in 'organico:sincronizar', 'tiktok:sincronizar', 'googleads:sincronizar', 'kommo:sincronizar', 'web:sincronizar') {
  npm run -s $s 2>&1 | Out-File -Encoding utf8 "reportes\$($s.Split(':')[0])-$hoy.log"
  "$s : $(if ($LASTEXITCODE -eq 0) { 'ok' } else { 'sin conectar o falló (ver reportes)' })" | Out-File -Append -Encoding utf8 reportes\reloj.log
}
npm run -s verificar -- --json 2>$null | Out-File -Encoding utf8 reportes\ultimo.json
"motor: ok" | Out-File -Append -Encoding utf8 reportes\reloj.log
