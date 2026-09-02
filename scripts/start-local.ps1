param(
  [switch]$SkipBuild,
  [int[]]$PortCandidates = @(8787, 8788, 8790, 8899, 3002, 3003),
  [int]$HealthTimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Banner($Text) {
  Write-Host ""
  Write-Host "==========================================" -ForegroundColor Cyan
  Write-Host " $Text" -ForegroundColor Cyan
  Write-Host "==========================================" -ForegroundColor Cyan
  Write-Host ""
}

function Require-Command($Name, $InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Falta $Name. $InstallHint"
  }
}

function Test-PortListening([int]$Port) {
  try {
    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return [bool]($listeners | Where-Object { $_.Port -eq $Port } | Select-Object -First 1)
  } catch {
    try {
      $client = [System.Net.Sockets.TcpClient]::new()
      $result = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
      $connected = $result.AsyncWaitHandle.WaitOne(350)
      if ($connected) { $client.EndConnect($result) }
      $client.Dispose()
      return $connected
    } catch {
      return $false
    }
  }
}

function Get-FightAiHealth([int]$Port) {
  try {
    return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 3 -ErrorAction Stop
  } catch {
    return $null
  }
}

function Test-ValidFightAiHealth($Health) {
  return $null -ne $Health -and
    $Health.service -eq "fight-ai-web" -and
    $Health.localMode -eq $true -and
    $Health.analysisReady -eq $true
}

function Get-LocalIPv4 {
  try {
    return Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.InterfaceAlias -notmatch "vEthernet|WSL|Loopback"
      } |
      Sort-Object InterfaceMetric |
      Select-Object -First 1 -ExpandProperty IPAddress
  } catch {
    return [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
      Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and $_.IPAddressToString -notlike "127.*" } |
      Select-Object -First 1 -ExpandProperty IPAddressToString
  }
}

function Show-Ready([int]$Port, $ProcessId) {
  $localIp = Get-LocalIPv4
  Write-Banner "Fight AI listo"
  Write-Host "Health verificado: service=fight-ai-web, localMode=true, analysisReady=true" -ForegroundColor Green
  Write-Host "PC:       http://localhost:$Port" -ForegroundColor Green
  if ($localIp) {
    Write-Host "Telefono: http://$($localIp):$Port" -ForegroundColor Green
    Write-Host "          (telefono y PC deben estar en la misma Wi-Fi/LAN)" -ForegroundColor DarkGray
  }
  if ($ProcessId) { Write-Host "Proceso:   $ProcessId" -ForegroundColor DarkGray }
  Write-Host ""
  Write-Host "Si el telefono no abre la pagina:" -ForegroundColor Yellow
  Write-Host "- permite Node.js en Firewall de Windows solo para redes privadas;" -ForegroundColor Yellow
  Write-Host "- confirma que la red de Windows sea Privada y que ambos equipos usen la misma Wi-Fi;" -ForegroundColor Yellow
  Write-Host "- no abras ni redirijas este puerto en el router." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Para detener exclusivamente este servidor usa DETENER_FIGHT_AI_LOCAL.cmd." -ForegroundColor DarkGray
}

Write-Banner "Fight AI Web - Servidor local en tu PC"

Require-Command "node" "Instala Node.js 20+ antes de iniciar Fight AI."
Require-Command "npm" "npm debe venir con Node.js."
Require-Command "ffmpeg" "Instala FFmpeg y agrega ffmpeg.exe al PATH de Windows."

if (-not (Test-Path ".env.local")) {
  if (Test-Path ".env.local.example") {
    Copy-Item ".env.local.example" ".env.local"
  }
  Write-Host "[ACCION NECESARIA] Se creo .env.local." -ForegroundColor Yellow
  Write-Host "Abre .env.local, pega tu GEMINI_API_KEY y vuelve a ejecutar este archivo." -ForegroundColor Yellow
  exit 1
}

$envText = Get-Content ".env.local" -Raw
if ($envText -match "REEMPLAZA_CON_TU_API_KEY" -or $envText -notmatch "(?m)^GEMINI_API_KEY=.+") {
  Write-Host "[ERROR] GEMINI_API_KEY no esta configurada en .env.local." -ForegroundColor Red
  exit 1
}

$env:FIGHT_AI_RUNTIME = "local"

if (-not (Test-Path "node_modules")) {
  Write-Host "[1/3] Instalando dependencias..." -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install fallo." }
}

if (-not $SkipBuild) {
  Write-Host "[2/3] Construyendo Fight AI Web..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "El build de Fight AI fallo." }
} elseif (-not (Test-Path ".next\BUILD_ID")) {
  throw "No existe un build previo. Ejecuta sin -SkipBuild."
} else {
  Write-Host "[2/3] Usando build existente." -ForegroundColor DarkGray
}

if (Test-Path ".fight-ai-port") {
  $existingPortText = Get-Content ".fight-ai-port" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existingPortText -match '^\d+$') {
    $existingPort = [int]$existingPortText
    $existingHealth = Get-FightAiHealth $existingPort
    if (Test-ValidFightAiHealth $existingHealth) {
      $existingPid = if (Test-Path ".fight-ai-pid") { Get-Content ".fight-ai-pid" -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
      Write-Host "[3/3] Fight AI ya estaba ejecutandose y paso health." -ForegroundColor Green
      Show-Ready $existingPort $existingPid
      exit 0
    }
  }
}

$nodePath = (Get-Command node).Source
$nextPath = Join-Path $Root "node_modules\next\dist\bin\next"
if (-not (Test-Path $nextPath)) { throw "No encontramos Next.js en node_modules. Ejecuta npm install." }

Write-Host "[3/3] Buscando puerto dedicado e iniciando servidor..." -ForegroundColor Cyan
$attemptErrors = @()
foreach ($port in $PortCandidates) {
  if (Test-PortListening $port) {
    Write-Host "[OCUPADO] $port ya tiene otro listener; probando el siguiente." -ForegroundColor Yellow
    continue
  }

  $stdoutPath = Join-Path $Root ".fight-ai-server-$port.out.log"
  $stderrPath = Join-Path $Root ".fight-ai-server-$port.err.log"
  Write-Host "[PROBANDO] Puerto $port..." -ForegroundColor Cyan
  $server = Start-Process -FilePath $nodePath `
    -ArgumentList @("`"$nextPath`"", "start", "-H", "0.0.0.0", "-p", "$port") `
    -WorkingDirectory $Root `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -WindowStyle Hidden `
    -PassThru

  $deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
  $ready = $false
  $wrongService = $false
  while ((Get-Date) -lt $deadline) {
    $server.Refresh()
    if ($server.HasExited) { break }
    $health = Get-FightAiHealth $port
    if ($null -ne $health) {
      if (Test-ValidFightAiHealth $health) {
        $ready = $true
        break
      }
      if ($health.service -ne "fight-ai-web") {
        $wrongService = $true
        break
      }
    }
    Start-Sleep -Milliseconds 750
  }

  if ($ready) {
    Set-Content -Path ".fight-ai-port" -Value $port -Encoding ascii
    Set-Content -Path ".fight-ai-pid" -Value $server.Id -Encoding ascii
    Show-Ready $port $server.Id
    exit 0
  }

  $server.Refresh()
  if (-not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    $server.WaitForExit(5000) | Out-Null
  }
  $reason = if ($wrongService) { "respondio otra aplicacion" } elseif ($server.HasExited) { "Next.js termino antes de pasar health" } else { "health no estuvo listo" }
  $attemptErrors += "$port`: $reason"
  Write-Host "[FALLO] Puerto $port no fue validado ($reason). Probando el siguiente." -ForegroundColor Yellow
}

throw "Fight AI no pudo iniciar en los puertos dedicados. $($attemptErrors -join '; '). Revisa .fight-ai-server-<puerto>.err.log."
