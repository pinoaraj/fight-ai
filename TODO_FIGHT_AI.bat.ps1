param([switch]$SkipUpdate)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

function Banner([string]$Text) {
  Write-Host ""
  Write-Host "====================================================" -ForegroundColor Cyan
  Write-Host " $Text" -ForegroundColor Cyan
  Write-Host "====================================================" -ForegroundColor Cyan
}

function Run-Ps([string]$Path, [string[]]$Arguments = @()) {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Path @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Fallo $Path (codigo $LASTEXITCODE)." }
}

function Stop-StaleTunnelSafely {
  if (-not (Test-Path ".fight-ai-tunnel-pid")) { return }
  $raw = Get-Content ".fight-ai-tunnel-pid" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($raw -notmatch '^\d+$') {
    Remove-Item ".fight-ai-tunnel-pid",".fight-ai-tunnel-url" -Force -ErrorAction SilentlyContinue
    return
  }
  $p = Get-Process -Id ([int]$raw) -ErrorAction SilentlyContinue
  if ($p -and $p.ProcessName -match '^cloudflared$') {
    Run-Ps (Join-Path $Root "scripts\stop-remote-tunnel.ps1")
  } elseif (-not $p) {
    Remove-Item ".fight-ai-tunnel-pid",".fight-ai-tunnel-url" -Force -ErrorAction SilentlyContinue
  } else {
    throw "El PID de tunel guardado pertenece a otro proceso. No se tocara."
  }
}

function Stop-LocalIfVerified {
  if (-not (Test-Path ".fight-ai-port")) { return }
  $portRaw = Get-Content ".fight-ai-port" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($portRaw -notmatch '^\d+$') { return }
  try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:$portRaw/api/health" -TimeoutSec 3
    if ($h.service -eq "fight-ai-web" -and $h.localMode -eq $true) {
      Run-Ps (Join-Path $Root "scripts\stop-local.ps1")
    }
  } catch { }
}

function Update-RepoSafely {
  if ($SkipUpdate) { return }
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Git no esta disponible." }

  git fetch origin web/mvp
  if ($LASTEXITCODE -ne 0) { throw "No se pudo hacer git fetch." }

  git checkout web/mvp
  if ($LASTEXITCODE -ne 0) { throw "No se pudo cambiar a web/mvp." }

  $trackedDirty = @(& git status --porcelain --untracked-files=no)
  if ($trackedDirty.Count -gt 0) {
    $onlyLock = $true
    foreach ($line in $trackedDirty) {
      if ($line -notmatch 'package-lock\.json$') { $onlyLock = $false; break }
    }
    if ($onlyLock) {
      Write-Host "[LIMPIEZA] Restaurando solo package-lock.json generado por npm." -ForegroundColor DarkGray
      git restore -- package-lock.json
      if ($LASTEXITCODE -ne 0) { throw "No se pudo restaurar package-lock.json." }
    } else {
      Write-Host "Hay cambios locales rastreados que no voy a borrar:" -ForegroundColor Yellow
      $trackedDirty | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
      throw "Guarda o confirma esos cambios antes de actualizar automaticamente."
    }
  }

  git pull --ff-only origin web/mvp
  if ($LASTEXITCODE -ne 0) { throw "git pull fallo; no se hizo reset ni se descartaron cambios." }
}

Banner "Fight AI - TODO AUTOMATICO"

if (-not (Test-Path ".env.local")) { throw "Falta .env.local. Ejecuta primero INSTALAR_Y_INICIAR_FIGHT_AI.cmd." }

Write-Host "[1/6] Cerrando enlace externo anterior si existe..." -ForegroundColor Cyan
Stop-StaleTunnelSafely

Write-Host "[2/6] Deteniendo solo Fight AI local verificado..." -ForegroundColor Cyan
Stop-LocalIfVerified

Write-Host "[3/6] Actualizando web/mvp sin destruir cambios locales..." -ForegroundColor Cyan
Update-RepoSafely

Write-Host "[4/6] Instalando dependencias y construyendo..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install fallo." }
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build fallo." }
$sha = (& git rev-parse HEAD | Select-Object -First 1).Trim()
Set-Content ".fight-ai-build-sha" $sha -Encoding ascii

Write-Host "[5/6] Iniciando Fight AI y verificando health..." -ForegroundColor Cyan
Run-Ps (Join-Path $Root "scripts\start-local.ps1") @("-SkipBuild")

Write-Host "[6/6] Creando enlace HTTPS externo seguro..." -ForegroundColor Cyan
Run-Ps (Join-Path $Root "scripts\start-remote-tunnel.ps1")

Banner "BETA LISTA"
Run-Ps (Join-Path $Root "scripts\show-remote-access.ps1")
Write-Host ""
Write-Host "Version: $sha" -ForegroundColor DarkGray

if (Test-Path ".fight-ai-tunnel-url") {
  $publicUrl = (Get-Content ".fight-ai-tunnel-url" -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if ($publicUrl -match '^https://') {
    Write-Host "Abriendo Fight AI Beta en el navegador..." -ForegroundColor Green
    Start-Process $publicUrl
  }
}

Write-Host "Para cerrar solo el acceso externo usa DETENER_ENLACE_EXTERNO.cmd." -ForegroundColor DarkGray
Write-Host "Para detener Fight AI local usa DETENER_FIGHT_AI_LOCAL.cmd." -ForegroundColor DarkGray
