$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Get-FightAiHealth([int]$Port) {
  try {
    return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 3 -ErrorAction Stop
  } catch {
    return $null
  }
}

if (-not (Test-Path ".fight-ai-port")) {
  throw "No existe .fight-ai-port. No se detendra ningun proceso para evitar afectar otra aplicacion."
}

$portText = Get-Content ".fight-ai-port" -ErrorAction Stop | Select-Object -First 1
if ($portText -notmatch '^\d+$') {
  throw ".fight-ai-port no contiene un puerto valido. No se detendra ningun proceso."
}
$port = [int]$portText

$health = Get-FightAiHealth $port
if ($null -eq $health -or
    $health.service -ne "fight-ai-web" -or
    $health.localMode -ne $true -or
    $health.analysisReady -ne $true) {
  throw "El puerto $port no responde como Fight AI local listo. No se detendra ningun proceso."
}

if (-not (Test-Path ".fight-ai-pid")) {
  throw "Falta .fight-ai-pid. El health es valido, pero no se puede confirmar el proceso propietario de forma segura."
}
$pidText = Get-Content ".fight-ai-pid" -ErrorAction Stop | Select-Object -First 1
if ($pidText -notmatch '^\d+$') {
  throw ".fight-ai-pid no contiene un PID valido. No se detendra ningun proceso."
}
$serverPid = [int]$pidText

$listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
  Where-Object { $_.OwningProcess -eq $serverPid } |
  Select-Object -First 1
if (-not $listener) {
  throw "El PID guardado ($serverPid) no es el listener verificado del puerto $port. No se detendra ningun proceso."
}

$process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if (-not $process -or $process.ProcessName -notmatch '^node$') {
  throw "El PID $serverPid no corresponde al proceso Node.js esperado. No se detendra ningun proceso."
}

Write-Host "Deteniendo Fight AI Web verificado en puerto $port (PID $serverPid)..." -ForegroundColor Cyan
Stop-Process -Id $serverPid -Force -ErrorAction Stop
$process.WaitForExit(5000) | Out-Null

Remove-Item ".fight-ai-port" -Force -ErrorAction SilentlyContinue
Remove-Item ".fight-ai-pid" -Force -ErrorAction SilentlyContinue
Write-Host "Fight AI detenido. No se tocaron otros puertos ni procesos." -ForegroundColor Green
