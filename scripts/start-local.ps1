param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Fight AI Web - Servidor local en tu PC" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

function Find-FreePort {
  param([int[]]$Candidates = @(8787,8788,8790,8899,3002,3003))
  foreach ($candidate in $Candidates) {
    $busy = Get-NetTCPConnection -State Listen -LocalPort $candidate -ErrorAction SilentlyContinue
    if (-not $busy) { return $candidate }
  }
  throw "No encontramos un puerto libre para Fight AI."
}

function Require-Command($Name, $InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Falta $Name." -ForegroundColor Red
    Write-Host $InstallHint -ForegroundColor Yellow
    exit 1
  }
}

Require-Command "node" "Instala Node.js 20+ antes de iniciar Fight AI."
Require-Command "npm" "npm debe venir con Node.js."
Require-Command "ffmpeg" "Instala FFmpeg y agrega ffmpeg.exe al PATH de Windows."

if (-not (Test-Path ".env.local")) {
  if (Test-Path ".env.local.example") {
    Copy-Item ".env.local.example" ".env.local"
  }
  Write-Host "[ACCION NECESARIA] Se creo .env.local." -ForegroundColor Yellow
  Write-Host "Abre .env.local, pega tu GEMINI_API_KEY y vuelve a ejecutar este archivo." -ForegroundColor Yellow
  exit 1
}

$EnvText = Get-Content ".env.local" -Raw
if ($EnvText -match "REEMPLAZA_CON_TU_API_KEY" -or $EnvText -notmatch "(?m)^GEMINI_API_KEY=.+") {
  Write-Host "[ERROR] GEMINI_API_KEY no esta configurada en .env.local." -ForegroundColor Red
  exit 1
}

$env:FIGHT_AI_RUNTIME = "local"

if (-not (Test-Path "node_modules")) {
  Write-Host "[1/3] Instalando dependencias..." -ForegroundColor Cyan
  npm install
}

if (-not $SkipBuild) {
  Write-Host "[2/3] Construyendo Fight AI Web..." -ForegroundColor Cyan
  npm run build
} else {
  if (-not (Test-Path ".next/BUILD_ID")) {
    Write-Host "[ERROR] No existe un build previo. Ejecuta sin -SkipBuild." -ForegroundColor Red
    exit 1
  }
  Write-Host "[2/3] Usando build existente." -ForegroundColor DarkGray
}

$Port = Find-FreePort
Set-Content -Path ".fight-ai-port" -Value $Port -Encoding ascii

$LocalIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.InterfaceAlias -notmatch "vEthernet|WSL|Loopback"
  } |
  Sort-Object InterfaceMetric |
  Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host ""
Write-Host "[3/3] Iniciando servidor..." -ForegroundColor Green
Write-Host "PC:       http://localhost:$Port" -ForegroundColor Green
if ($LocalIp) {
  Write-Host "Telefono: http://$($LocalIp):$Port" -ForegroundColor Green
  Write-Host "          (telefono y PC deben estar en la misma Wi-Fi/LAN)" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "Los videos se procesan temporalmente en este PC y los archivos temporales se eliminan al terminar." -ForegroundColor DarkGray
Write-Host "Presiona Ctrl+C para detener el servidor." -ForegroundColor DarkGray
Write-Host ""

npm run start -- -H 0.0.0.0 -p $Port
