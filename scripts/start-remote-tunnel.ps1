param([int]$TimeoutSeconds = 45)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
}
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

$publicHost = ([uri]$publicUrl).Host
$publicIp = $null
$dnsDeadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $dnsDeadline -and -not $publicIp) {
  $publicIp = Resolve-DnsName $publicHost -Server 1.1.1.1 -Type A -DnsOnly -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress } |
    Select-Object -First 1 -ExpandProperty IPAddress
  if (-not $publicIp) { Start-Sleep -Seconds 1 }
}
if (-not $publicIp) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "El hostname del tunel no aparecio en DNS publico; el tunel fue detenido."
}

$unauthorized = & curl.exe --silent --show-error --output NUL --write-out "%{http_code}" `
  --resolve "$publicHost`:443:$publicIp" "$publicUrl/api/health"
if ($LASTEXITCODE -eq 0 -and $unauthorized -match '^\d{3}$') { $unauthorized = [int]$unauthorized } else { $unauthorized = $null }
if ($unauthorized -ne 401) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "El enlace externo no exigio autenticacion (HTTP $unauthorized); el tunel fue detenido."
}

$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$username`:$password"))
$remoteBody = & curl.exe --silent --show-error --resolve "$publicHost`:443:$publicIp" `
  --header "Authorization: Basic $encoded" "$publicUrl/api/health"
$remoteHealth = if ($LASTEXITCODE -eq 0) { $remoteBody | ConvertFrom-Json } else { $null }
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
