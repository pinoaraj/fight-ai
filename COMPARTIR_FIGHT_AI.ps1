$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

function Test-LocalFightAiReady {
  if (-not (Test-Path ".fight-ai-port")) { return $false }
  $portText = Get-Content ".fight-ai-port" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($portText -notmatch '^\d+$') { return $false }
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$portText/api/health" -TimeoutSec 3 -ErrorAction Stop
    return $health.service -eq "fight-ai-web" -and
      $health.localMode -eq $true -and
      $health.analysisReady -eq $true
  } catch {
    return $false
  }
}

function Invoke-FightAiScript([string]$Path, [string[]]$Arguments = @()) {
  $powershellExe = (Get-Command powershell.exe -ErrorAction Stop).Source
  & $powershellExe -NoProfile -ExecutionPolicy Bypass -File $Path @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo $Path (codigo $LASTEXITCODE)."
  }
}

if (-not (Test-Path ".env.local")) { throw "Falta .env.local." }
$envText = Get-Content ".env.local" -Raw
$createdPassword = $false
if ($envText -notmatch '(?m)^FIGHT_AI_REMOTE_USER=.+$') {
  Add-Content ".env.local" "`r`nFIGHT_AI_REMOTE_USER=fightai"
}
if ($envText -notmatch '(?m)^FIGHT_AI_REMOTE_PASSWORD=.+$') {
  $bytes = [byte[]]::new(18)
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $password = [Convert]::ToBase64String($bytes).Replace('+','A').Replace('/','B').TrimEnd('=')
  Add-Content ".env.local" "FIGHT_AI_REMOTE_PASSWORD=$password"
  $createdPassword = $true
  Write-Host "Se creo una contrasena remota en .env.local." -ForegroundColor Green
}

$localReady = Test-LocalFightAiReady
if ($createdPassword) {
  if ($localReady) {
    Invoke-FightAiScript (Join-Path $Root "scripts\stop-local.ps1")
  }
  Invoke-FightAiScript (Join-Path $Root "scripts\start-local.ps1")
} elseif (-not $localReady) {
  $startArguments = if (Test-Path ".next\BUILD_ID") { @("-SkipBuild") } else { @() }
  Invoke-FightAiScript (Join-Path $Root "scripts\start-local.ps1") $startArguments
}

Invoke-FightAiScript (Join-Path $Root "scripts\start-remote-tunnel.ps1")
