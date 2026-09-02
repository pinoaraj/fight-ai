$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".env.local")) { throw "Falta .env.local." }
$envText = Get-Content ".env.local" -Raw
$createdPassword = $false
if ($envText -notmatch '(?m)^FIGHT_AI_REMOTE_USER=.+$') {
  Add-Content ".env.local" "`r`nFIGHT_AI_REMOTE_USER=fightai"
}
if ($envText -notmatch '(?m)^FIGHT_AI_REMOTE_PASSWORD=.+$') {
  $bytes = [byte[]]::new(18)
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $password = [Convert]::ToBase64String($bytes).Replace('+','A').Replace('/','B').TrimEnd('=')
  Add-Content ".env.local" "FIGHT_AI_REMOTE_PASSWORD=$password"
  $createdPassword = $true
  Write-Host "Se creo una contrasena remota en .env.local." -ForegroundColor Green
}

if ($createdPassword) {
  if (Test-Path ".fight-ai-port") {
    & (Join-Path $Root "scripts\stop-local.ps1")
  }
  & (Join-Path $Root "scripts\start-local.ps1")
} elseif (-not (Test-Path ".fight-ai-port")) {
  & (Join-Path $Root "scripts\start-local.ps1")
}

& (Join-Path $Root "scripts\start-remote-tunnel.ps1")
