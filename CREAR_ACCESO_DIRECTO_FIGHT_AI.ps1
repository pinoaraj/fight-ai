$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Desktop = [Environment]::GetFolderPath('Desktop')
if (-not $Desktop) { throw 'No se pudo localizar el Escritorio de Windows.' }

$Bat = Join-Path $Root 'TODO_FIGHT_AI.bat'
if (-not (Test-Path $Bat)) { throw 'No se encontro TODO_FIGHT_AI.bat en la carpeta del proyecto.' }

function New-FightAiIcon([string]$Path) {
  Add-Type -AssemblyName System.Drawing

  $bitmap = New-Object System.Drawing.Bitmap 256,256
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  try {
    $background = [System.Drawing.Color]::FromArgb(9,11,15)
    $gold = [System.Drawing.Color]::FromArgb(215,168,74)
    $white = [System.Drawing.Color]::FromArgb(245,247,249)
    $graphics.Clear($background)

    $goldPen = New-Object System.Drawing.Pen($gold, 12)
    $rect = New-Object System.Drawing.Rectangle 18,18,220,220
    $graphics.DrawRoundedRectangle($goldPen, $rect, 36) 2>$null
  } catch {
    # DrawRoundedRectangle is not available on every Windows/System.Drawing build.
    $goldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(215,168,74), 12)
    $graphics.DrawRectangle($goldPen, 22,22,212,212)
  }

  try {
    $font = New-Object System.Drawing.Font('Segoe UI', 82, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel))
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245,247,249))
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString('FA', $font, $brush, (New-Object System.Drawing.RectangleF 0,0,256,242), $format)

    $subFont = New-Object System.Drawing.Font('Segoe UI', 19, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel))
    $goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(215,168,74))
    $subFormat = New-Object System.Drawing.StringFormat
    $subFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString('FIGHT AI', $subFont, $goldBrush, (New-Object System.Drawing.RectangleF 0,194,256,40), $subFormat)

    $handle = $bitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($handle)
    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create)
    try { $icon.Save($stream) } finally { $stream.Dispose(); $icon.Dispose() }
  } finally {
    if ($goldPen) { $goldPen.Dispose() }
    if ($font) { $font.Dispose() }
    if ($brush) { $brush.Dispose() }
    if ($format) { $format.Dispose() }
    if ($subFont) { $subFont.Dispose() }
    if ($goldBrush) { $goldBrush.Dispose() }
    if ($subFormat) { $subFormat.Dispose() }
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$IconPath = Join-Path $Root 'FightAI-Beta.ico'
try {
  New-FightAiIcon $IconPath
} catch {
  Write-Host 'No se pudo generar el icono personalizado; se usara un icono de Windows.' -ForegroundColor Yellow
  $IconPath = "$env:SystemRoot\System32\shell32.dll"
}

$ShortcutPath = Join-Path $Desktop 'Fight AI Beta.lnk'
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Bat
$Shortcut.WorkingDirectory = $Root
$Shortcut.Description = 'Inicia Fight AI Web, actualiza la app y habilita la beta externa segura.'
$Shortcut.WindowStyle = 1
$Shortcut.IconLocation = if ($IconPath -like '*.ico') { "$IconPath,0" } else { "$IconPath,220" }
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
Write-Host ''
Write-Host 'El acceso directo usa el icono Fight AI generado localmente.' -ForegroundColor DarkGray
