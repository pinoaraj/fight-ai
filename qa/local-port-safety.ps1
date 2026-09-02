$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$fixture = $null
try {
  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $fixture = Start-Process -FilePath $nodePath `
    -ArgumentList @((Join-Path $Root "qa\foreign-port-fixture.mjs"), "8787") `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -PassThru

  $fixtureReady = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
      $foreign = Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/health" -TimeoutSec 1
      if ($foreign.service -eq "foreign-medical-app") { $fixtureReady = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 250
  }
  if (-not $fixtureReady) { throw "La aplicacion ajena de prueba no inicio en 8787." }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\start-local.ps1") `
    -SkipBuild -HealthTimeoutSeconds 30
  if ($LASTEXITCODE -ne 0) { throw "start-local.ps1 fallo en la prueba de fallback." }

  $selectedPort = (Get-Content ".fight-ai-port" | Select-Object -First 1).Trim()
  if ($selectedPort -ne "8788") { throw "Se esperaba fallback a 8788; se selecciono $selectedPort." }
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8788/api/health" -TimeoutSec 3
  if ($health.service -ne "fight-ai-web" -or $health.localMode -ne $true -or $health.analysisReady -ne $true) {
    throw "El servidor seleccionado no paso el contrato exacto de health."
  }

  $externalStatus = $null
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:8788/api/health" -Headers @{ Host = "preview.trycloudflare.com" } -TimeoutSec 3 -ErrorAction Stop | Out-Null
    $externalStatus = 200
  } catch {
    if ($_.Exception.Response) { $externalStatus = [int]$_.Exception.Response.StatusCode }
  }
  if ($externalStatus -ne 503) { throw "Un host externo sin contrasena debia fallar cerrado con HTTP 503; recibio $externalStatus." }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\stop-local.ps1")
  if ($LASTEXITCODE -ne 0) { throw "stop-local.ps1 rechazo el servidor Fight AI verificado." }

  $foreignAfterStop = Invoke-RestMethod -Uri "http://127.0.0.1:8787/api/health" -TimeoutSec 3
  if ($foreignAfterStop.service -ne "foreign-medical-app") {
    throw "La parada de Fight AI afecto la aplicacion ajena en 8787."
  }

  Write-Host "PASS: 8787 ocupado -> Fight AI verificado en 8788 -> parada segura sin afectar 8787." -ForegroundColor Green
} finally {
  if ($fixture -and -not $fixture.HasExited) {
    Stop-Process -Id $fixture.Id -Force -ErrorAction SilentlyContinue
  }
}
