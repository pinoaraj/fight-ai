param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
Set-Location $Root

function Get-ReadyPort {
  if (-not (Test-Path '.fight-ai-port')) { return $null }
  $value = Get-Content '.fight-ai-port' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($value -notmatch '^\d+$') { return $null }
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$value/api/health" -TimeoutSec 3
    if ($health.service -eq 'fight-ai-web' -and $health.localMode -eq $true -and $health.analysisReady -eq $true) {
      return [int]$value
    }
  } catch { }
  return $null
}

function Open-FightAi([int]$Port) {
  $url = "http://localhost:$Port"
  Write-Host "Fight AI listo: $url" -ForegroundColor Green
  if (-not $NoBrowser) { Start-Process $url }
}

if (-not (Test-Path '.fight-ai-build-sha')) {
  $revision = (& git rev-parse HEAD 2>$null | Select-Object -First 1)
  if ($revision -match '^[a-f0-9]{40}$') { Set-Content '.fight-ai-build-sha' $revision.Trim() -Encoding ascii }
}

$readyPort = Get-ReadyPort
if ($readyPort) {
  Open-FightAi $readyPort
  exit 0
}

if (-not (Test-Path '.env.local')) {
  throw 'Falta .env.local. Ejecuta una vez INSTALAR_Y_INICIAR_FIGHT_AI.cmd para configurar Gemini.'
}
$envText = Get-Content '.env.local' -Raw
if ($envText -match 'REEMPLAZA_CON_TU_API_KEY' -or $envText -notmatch '(?m)^GEMINI_API_KEY=.+$') {
  throw 'Gemini no está configurado. Ejecuta INSTALAR_Y_INICIAR_FIGHT_AI.cmd.'
}

if (-not (Test-Path '.next\BUILD_ID')) {
  Write-Host 'Preparando Fight AI por primera vez...' -ForegroundColor Cyan
  if (-not (Test-Path 'node_modules')) {
    npm install
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
  }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo construir Fight AI.' }
  $revision = (& git rev-parse HEAD 2>$null | Select-Object -First 1)
  if ($revision -match '^[a-f0-9]{40}$') { Set-Content '.fight-ai-build-sha' $revision.Trim() -Encoding ascii }
}

& (Join-Path $Root 'scripts\start-local.ps1') -SkipBuild
if ($LASTEXITCODE -ne 0) { throw 'Fight AI no pudo iniciar.' }
$readyPort = Get-ReadyPort
if (-not $readyPort) { throw 'Fight AI inició, pero no superó la comprobación final de salud.' }
Open-FightAi $readyPort
