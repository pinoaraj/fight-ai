param(
  [string]$InstallDir = "$env:USERPROFILE\fight-ai",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/pinoaraj/fight-ai.git"
$Branch = "web/mvp"

function Banner($Text) {
  Write-Host ""
  Write-Host "==================================================" -ForegroundColor Cyan
  Write-Host " $Text" -ForegroundColor Cyan
  Write-Host "==================================================" -ForegroundColor Cyan
}

function Refresh-Path {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}

function Ensure-Command($Name, $WingetId, $Label) {
  if (Get-Command $Name -ErrorAction SilentlyContinue) { return }
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "Falta $Label y tampoco encontramos winget para instalarlo automaticamente."
  }
  Write-Host "[INSTALANDO] $Label..." -ForegroundColor Yellow
  winget install --id $WingetId --exact --accept-package-agreements --accept-source-agreements
  Refresh-Path
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Label se instalo, pero Windows aun no lo ve en PATH. Cierra esta ventana y vuelve a ejecutar INSTALAR_Y_INICIAR_FIGHT_AI.cmd."
  }
}

Banner "Fight AI Web - instalacion y arranque local"

Ensure-Command "git" "Git.Git" "Git"
Ensure-Command "node" "OpenJS.NodeJS.LTS" "Node.js LTS"
Ensure-Command "ffmpeg" "Gyan.FFmpeg" "FFmpeg"

if (Test-Path (Join-Path $InstallDir ".git")) {
  Write-Host "[1/5] Repo encontrado: $InstallDir" -ForegroundColor Green
  Set-Location $InstallDir
  $origin = (git remote get-url origin 2>$null).Trim()
  if ($LASTEXITCODE -ne 0 -or $origin -notmatch '(^|[/:])pinoaraj/fight-ai(?:\.git)?$') {
    throw "El repo existente no tiene pinoaraj/fight-ai como origin. No se modificara automaticamente."
  }

  $trackedChanges = git status --porcelain --untracked-files=no
  if ($LASTEXITCODE -ne 0) { throw "No se pudo revisar el estado Git local." }
  $currentBranch = (git branch --show-current).Trim()
  if ($trackedChanges) {
    if ($currentBranch -ne $Branch) {
      throw "Hay cambios locales rastreados en $currentBranch. Guardalos antes de cambiar a $Branch; no se destruyo nada."
    }
    Write-Host "[AVISO] Hay cambios locales rastreados. Se conservaran y se omitira la actualizacion Git automatica." -ForegroundColor Yellow
  } else {
    git fetch origin $Branch
    if ($LASTEXITCODE -ne 0) { throw "git fetch fallo; el repo local no fue sobrescrito." }
    if ($currentBranch -ne $Branch) {
      git checkout $Branch
      if ($LASTEXITCODE -ne 0) { throw "No se pudo cambiar de forma segura a $Branch." }
    }
    git pull --ff-only origin $Branch
    if ($LASTEXITCODE -ne 0) { throw "git pull --ff-only fallo; revisa si la rama local divergio. No se hizo reset." }
  }
} else {
  if (Test-Path $InstallDir) {
    $items = Get-ChildItem -Force $InstallDir -ErrorAction SilentlyContinue
    if ($items) {
      throw "La carpeta $InstallDir existe pero no es un repo Fight AI. Renombrala o usa otro destino."
    }
  }
  Write-Host "[1/5] Clonando Fight AI en $InstallDir..." -ForegroundColor Cyan
  git clone --branch $Branch --single-branch $RepoUrl $InstallDir
  if ($LASTEXITCODE -ne 0) { throw "No se pudo clonar pinoaraj/fight-ai." }
  Set-Location $InstallDir
}

Write-Host "[2/5] Verificando configuracion local..." -ForegroundColor Cyan
if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.local.example" ".env.local"
}

$envText = Get-Content ".env.local" -Raw
$needsKey = $envText -match "REEMPLAZA_CON_TU_API_KEY" -or $envText -notmatch "(?m)^GEMINI_API_KEY=.+$"
if ($needsKey) {
  Write-Host ""
  Write-Host "Falta tu GEMINI_API_KEY." -ForegroundColor Yellow
  Write-Host "Se abrira .env.local en Bloc de notas." -ForegroundColor Yellow
  Write-Host "Reemplaza REEMPLAZA_CON_TU_API_KEY por tu clave, guarda y cierra Bloc de notas." -ForegroundColor Yellow
  Start-Process notepad.exe -ArgumentList (Join-Path $InstallDir ".env.local") -Wait
  $envText = Get-Content ".env.local" -Raw
  if ($envText -match "REEMPLAZA_CON_TU_API_KEY" -or $envText -notmatch "(?m)^GEMINI_API_KEY=.+$") {
    throw "GEMINI_API_KEY sigue sin estar configurada en .env.local."
  }
}

Write-Host "[3/5] Instalando/actualizando dependencias..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install fallo." }

if (-not $SkipBuild) {
  Write-Host "[4/5] Construyendo Fight AI Web..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "El build de Fight AI fallo." }
} elseif (-not (Test-Path ".next\BUILD_ID")) {
  throw "No existe un build previo. Ejecuta sin -SkipBuild."
} else {
  Write-Host "[4/5] Usando build existente." -ForegroundColor DarkGray
}

Write-Host "[5/5] Iniciando y verificando el servidor local..." -ForegroundColor Cyan
& (Join-Path $InstallDir "scripts\start-local.ps1") -SkipBuild
if ($LASTEXITCODE -ne 0) { throw "Fight AI no pudo iniciar ni pasar /api/health." }
