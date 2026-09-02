param([int]$TimeoutSeconds = 45)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw "Falta cloudflared. Instala Cloudflare Tunnel antes de compartir Fight AI."
}
if (-not (Test-Path ".fight-ai-port")) { throw "Fight AI local no esta iniciado." }
$portText = Get-Content ".fight-ai-port" | Select-Object -First 1
if ($portText -notmatch '^\d+$') { throw ".fight-ai-port no contiene un puerto valido." }
$port = [int]$portText

$localHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 5
if ($localHealth.service -ne "fight-ai-web" -or $localHealth.localMode -ne $true -or $localHealth.analysisReady -ne $true) {
  throw "El servidor local no paso el health exacto; no se abrira un tunel."
}

$envText = Get-Content ".env.local" -Raw
$usernameMatch = [regex]::Match($envText, '(?m)^FIGHT_AI_REMOTE_USER=(.+)$')
$passwordMatch = [regex]::Match($envText, '(?m)^FIGHT_AI_REMOTE_PASSWORD=(.+)$')
$username = if ($usernameMatch.Success) { $usernameMatch.Groups[1].Value.Trim() } else { "fightai" }
$password = if ($passwordMatch.Success) { $passwordMatch.Groups[1].Value.Trim() } else { "" }
if (-not $password) { throw "Falta FIGHT_AI_REMOTE_PASSWORD en .env.local." }

if ((Test-Path ".fight-ai-tunnel-url") -and (Test-Path ".fight-ai-tunnel-pid")) {
  $savedPid = Get-Content ".fight-ai-tunnel-pid" | Select-Object -First 1
  $savedUrl = Get-Content ".fight-ai-tunnel-url" | Select-Object -First 1
  if ($savedPid -match '^\d+$' -and (Get-Process -Id ([int]$savedPid) -ErrorAction SilentlyContinue)) {
    Write-Host "Enlace externo ya activo: $savedUrl" -ForegroundColor Green
    Write-Host "Usuario: $username" -ForegroundColor Yellow
    exit 0
  }
}

$stdoutPath = Join-Path $Root ".fight-ai-tunnel.out.log"
$stderrPath = Join-Path $Root ".fight-ai-tunnel.err.log"
$cloudflared = (Get-Command cloudflared).Source
$process = Start-Process -FilePath $cloudflared `
  -ArgumentList @("tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:$port") `
  -WorkingDirectory $Root `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -WindowStyle Hidden `
  -PassThru

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$publicUrl = $null
while ((Get-Date) -lt $deadline) {
  $process.Refresh()
  if ($process.HasExited) { break }
  $logs = ""
  if (Test-Path $stdoutPath) { $logs += Get-Content $stdoutPath -Raw -ErrorAction SilentlyContinue }
  if (Test-Path $stderrPath) { $logs += Get-Content $stderrPath -Raw -ErrorAction SilentlyContinue }
  $match = [regex]::Match($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
  if ($match.Success) { $publicUrl = $match.Value; break }
  Start-Sleep -Milliseconds 750
}

if (-not $publicUrl) {
  if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
  throw "Cloudflare Tunnel no entrego una URL. Revisa .fight-ai-tunnel.err.log."
}

$unauthorized = $null
try {
  Invoke-WebRequest -Uri "$publicUrl/api/health" -TimeoutSec 10 -ErrorAction Stop | Out-Null
  $unauthorized = 200
} catch {
  if ($_.Exception.Response) { $unauthorized = [int]$_.Exception.Response.StatusCode }
}
if ($unauthorized -ne 401) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "El enlace externo no exigio autenticacion (HTTP $unauthorized); el tunel fue detenido."
}

$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$username`:$password"))
$remoteHealth = Invoke-RestMethod -Uri "$publicUrl/api/health" -Headers @{ Authorization = "Basic $encoded" } -TimeoutSec 15
if ($remoteHealth.service -ne "fight-ai-web" -or $remoteHealth.analysisReady -ne $true) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "El health autenticado del tunel no corresponde a Fight AI."
}

Set-Content ".fight-ai-tunnel-url" $publicUrl -Encoding ascii
Set-Content ".fight-ai-tunnel-pid" $process.Id -Encoding ascii
Write-Host ""
Write-Host "Fight AI disponible fuera de tu red:" -ForegroundColor Green
Write-Host $publicUrl -ForegroundColor Green
Write-Host "Usuario: $username" -ForegroundColor Yellow
Write-Host "Contrasena: usa FIGHT_AI_REMOTE_PASSWORD de .env.local y enviala por un canal separado." -ForegroundColor Yellow
Write-Host "Este enlace es temporal y cambia cuando se reinicia el tunel." -ForegroundColor DarkGray
Write-Host "Limite de prueba: videos menores de 100 MB por el limite del proxy gratuito." -ForegroundColor DarkGray
