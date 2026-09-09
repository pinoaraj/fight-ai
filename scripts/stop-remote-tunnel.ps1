$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".fight-ai-tunnel-pid")) { throw "No existe un PID de tunel guardado." }
$pidText = Get-Content ".fight-ai-tunnel-pid" | Select-Object -First 1
if ($pidText -notmatch '^\d+$') { throw "El PID del tunel no es valido." }
$tunnelPid = [int]$pidText
$process = Get-Process -Id $tunnelPid -ErrorAction SilentlyContinue
if (-not $process -or $process.ProcessName -notmatch '^cloudflared$') {
  throw "El PID guardado no corresponde a cloudflared; no se detendra ningun proceso."
}

Stop-Process -Id $tunnelPid -Force -ErrorAction Stop
$process.WaitForExit(5000) | Out-Null
Remove-Item ".fight-ai-tunnel-pid" -Force -ErrorAction SilentlyContinue
Remove-Item ".fight-ai-tunnel-url" -Force -ErrorAction SilentlyContinue
Write-Host "Enlace externo detenido. Fight AI local sigue funcionando." -ForegroundColor Green
