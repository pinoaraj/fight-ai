$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Desktop = [Environment]::GetFolderPath('Desktop')
if (-not $Desktop) { throw 'No se pudo localizar el Escritorio de Windows.' }

$Bat = Join-Path $Root 'TODO_FIGHT_AI.bat'
if (-not (Test-Path $Bat)) { throw 'No se encontro TODO_FIGHT_AI.bat en la carpeta del proyecto.' }

$ShortcutPath = Join-Path $Desktop 'Fight AI Beta.lnk'
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Bat
$Shortcut.WorkingDirectory = $Root
$Shortcut.Description = 'Inicia Fight AI Web, actualiza la app y habilita la beta externa segura.'
$Shortcut.WindowStyle = 1
$Shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$Shortcut.Save()

Write-Host ''
Write-Host 'Acceso directo creado correctamente:' -ForegroundColor Green
Write-Host $ShortcutPath -ForegroundColor Green
Write-Host ''
Write-Host 'Desde ahora haz doble clic en "Fight AI Beta" para:' -ForegroundColor Cyan
Write-Host '- actualizar web/mvp;'
Write-Host '- construir Fight AI;'
Write-Host '- iniciar el servidor local;'
Write-Host '- crear el enlace HTTPS externo;'
Write-Host '- abrir la beta en tu navegador.'
