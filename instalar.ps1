# Oráculo — instalador para Windows
# Uso: clic derecho → "Ejecutar con PowerShell", o desde una terminal:  .\instalar.ps1
# Qué hace: verifica Node, instala dependencias, genera los datos de demostración,
# prepara el archivo de configuración y abre el panel en el navegador.

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

function Paso($n, $texto) { Write-Host ""; Write-Host "[$n/5] $texto" -ForegroundColor Cyan }
function Ok($texto) { Write-Host "  OK  $texto" -ForegroundColor Green }
function Falla($texto) { Write-Host "  ERROR  $texto" -ForegroundColor Red; Write-Host ""; Read-Host "Presiona Enter para salir"; exit 1 }

Write-Host "=============================================" -ForegroundColor DarkGray
Write-Host "  ORÁCULO · Inteligencia de marketing" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor DarkGray

Paso 1 "Verificando Node.js (se necesita la versión 20 o superior)"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Falla "Node.js no está instalado. Descárgalo de https://nodejs.org (versión LTS), instálalo y vuelve a ejecutar este archivo." }
$version = (& node --version).TrimStart("v")
$mayor = [int]($version.Split(".")[0])
if ($mayor -lt 20) { Falla "Node.js $version es muy antiguo. Instala la versión LTS desde https://nodejs.org" }
Ok "Node.js $version"

Paso 2 "Instalando dependencias (puede tardar 1-3 minutos la primera vez)"
& npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { Falla "npm install falló. Revisa la conexión a internet y vuelve a intentar." }
Ok "Dependencias instaladas"

Paso 3 "Preparando la configuración"
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Ok "Archivo .env creado (modo demostración)"
} else {
  Ok "Archivo .env ya existía; no se tocó"
}
if (-not (Test-Path "datos\experimentos.json")) {
  Set-Content -Path "datos\experimentos.json" -Value "[]" -Encoding utf8
}

Paso 4 "Generando datos de demostración y verificando el motor"
& npm run seed --silent
if ($LASTEXITCODE -ne 0) { Falla "No se pudieron generar los datos de demostración." }
& npm run verificar --silent | Select-Object -First 12
if ($LASTEXITCODE -ne 0) { Falla "La verificación del motor reportó errores." }
Ok "Motor verificado"

Write-Host ""
Write-Host "[extra] Radar de competencia: intentando instalar el navegador (Chromium) para capturar la Biblioteca de anuncios" -ForegroundColor Cyan
& npx playwright install chromium 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  Aviso: no se pudo descargar Chromium ahora. El panel funciona igual; el radar se puede instalar después con: npx playwright install chromium" -ForegroundColor Yellow } else { Ok "Chromium listo para el radar" }

Paso 5 "Abriendo el panel"
Write-Host "  El panel quedará en http://localhost:3000/panel" -ForegroundColor White
Write-Host "  Para cerrarlo: presiona Ctrl+C en esta ventana." -ForegroundColor DarkGray
Start-Job -ScriptBlock { Start-Sleep -Seconds 6; Start-Process "http://localhost:3000/panel" } | Out-Null
& npm run dev
