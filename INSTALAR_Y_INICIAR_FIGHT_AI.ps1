param(
  [string]$InstallDir = "$env:USERPROFILE\fight-ai",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/pinoaraj/fight-ai.git"
$Branch = "web/mvp"

function Banner($Text) {
  Write-Host ""
  Write-Host "==================================================" -ForegroundColor Cyan
  Write-Host " $Text" -ForegroundColor Cyan
  Write-Host "==================================================" -ForegroundColor Cyan
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}

function Ensure-Command($Name, $WingetId, $Label) {
  if (Get-Command $Name -ErrorAction SilentlyContinue) { return }
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "Falta $Label y tampoco encontramos winget para instalarlo automaticamente."
  }
  Write-Host "[INSTALANDO] $Label..." -ForegroundColor Yellow
  winget install --id $WingetId --exact --accept-package-agreements --accept-source-agreements
  Refresh-Path
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Label se instalo, pero Windows aun no lo ve en PATH. Cierra esta ventana y vuelve a ejecutar INSTALAR_Y_INICIAR_FIGHT_AI.cmd."
  }
}

Banner "Fight AI Web - instalacion y arranque local"

Ensure-Command "git" "Git.Git" "Git"
Ensure-Command "node" "OpenJS.NodeJS.LTS" "Node.js LTS"
Ensure-Command "ffmpeg" "Gyan.FFmpeg" "FFmpeg"

if (Test-Path (Join-Path $InstallDir ".git")) {
  Write-Host "[1/5] Repo encontrado: $InstallDir" -ForegroundColor Green
  Set-Location $InstallDir
  git fetch origin
  git checkout $Branch
  git pull --ff-only origin $Branch
} else {
  if (Test-Path $InstallDir) {
    $items = Get-ChildItem -Force $InstallDir -ErrorAction SilentlyContinue
    if ($items) {
      throw "La carpeta $InstallDir existe pero no es un repo Fight AI. Renombrala o usa otro destino."
    }
  }
  Write-Host "[1/5] Clonando Fight AI en $InstallDir..." -ForegroundColor Cyan
  git clone --branch $Branch --single-branch $RepoUrl $InstallDir
  Set-Location $InstallDir
}

Write-Host "[2/5] Verificando configuracion local..." -ForegroundColor Cyan
if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.local.example" ".env.local"
}

$envText = Get-Content ".env.local" -Raw
$needsKey = $envText -match "REEMPLAZA_CON_TU_API_KEY" -or $envText -notmatch "(?m)^GEMINI_API_KEY=.+$"
if ($needsKey) {
  Write-Host ""
  Write-Host "Falta tu GEMINI_API_KEY." -ForegroundColor Yellow
  Write-Host "Se abrira .env.local en Bloc de notas." -ForegroundColor Yellow
  Write-Host "Reemplaza REEMPLAZA_CON_TU_API_KEY por tu clave, guarda y cierra Bloc de notas." -ForegroundColor Yellow
  Start-Process notepad.exe -ArgumentList (Join-Path $InstallDir ".env.local") -Wait
  $envText = Get-Content ".env.local" -Raw
  if ($envText -match "REEMPLAZA_CON_TU_API_KEY" -or $envText -notmatch "(?m)^GEMINI_API_KEY=.+$") {
    throw "GEMINI_API_KEY sigue sin estar configurada en .env.local."
  }
}

Write-Host "[3/5] Instalando/actualizando dependencias..." -ForegroundColor Cyan
npm install

if (-not $SkipBuild) {
  Write-Host "[4/5] Construyendo Fight AI Web..." -ForegroundColor Cyan
  npm run build
} elseif (-not (Test-Path ".next\BUILD_ID")) {
  throw "No existe un build previo. Ejecuta sin -SkipBuild."
} else {
  Write-Host "[4/5] Usando build existente." -ForegroundColor DarkGray
}

$localIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.IPAddress -notlike "169.254.*" -and
    $_.InterfaceAlias -notmatch "vEthernet|WSL|Loopback"
  } |
  Sort-Object InterfaceMetric |
  Select-Object -First 1 -ExpandProperty IPAddress

Banner "Fight AI listo"
Write-Host "PC:       http://localhost:3000" -ForegroundColor Green
if ($localIp) {
  Write-Host "Telefono: http://$($localIp):3000" -ForegroundColor Green
  Write-Host "          (PC y telefono deben estar en la misma Wi-Fi/LAN)" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "El servidor quedara abierto en esta ventana. Ctrl+C para detener." -ForegroundColor DarkGray
Write-Host "[5/5] Iniciando servidor..." -ForegroundColor Cyan

$env:FIGHT_AI_RUNTIME = "local"
npm run start -- -H 0.0.0.0 -p 3000
