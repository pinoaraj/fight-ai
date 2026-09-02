$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".fight-ai-tunnel-url")) { throw "No hay un enlace externo activo." }
if (-not (Test-Path ".env.local")) { throw "Falta .env.local." }

$envText = Get-Content ".env.local" -Raw
$username = [regex]::Match($envText, '(?m)^FIGHT_AI_REMOTE_USER=(.+)$').Groups[1].Value.Trim()
$password = [regex]::Match($envText, '(?m)^FIGHT_AI_REMOTE_PASSWORD=(.+)$').Groups[1].Value.Trim()
if (-not $username -or -not $password) { throw "Las credenciales remotas no estan configuradas." }

Write-Host "Enlace:     $((Get-Content '.fight-ai-tunnel-url' | Select-Object -First 1).Trim())" -ForegroundColor Green
Write-Host "Usuario:    $username" -ForegroundColor Yellow
Write-Host "Contrasena: $password" -ForegroundColor Yellow
Write-Host "Envia el enlace y la contrasena por canales separados." -ForegroundColor DarkGray
