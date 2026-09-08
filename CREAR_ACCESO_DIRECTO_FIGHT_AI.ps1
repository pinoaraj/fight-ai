$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Desktop = [Environment]::GetFolderPath('Desktop')
if (-not $Desktop) { throw 'No se pudo localizar el Escritorio de Windows.' }

$Launcher = Join-Path $Root 'ABRIR_FIGHT_AI.cmd'
if (-not (Test-Path $Launcher)) { throw 'No se encontro ABRIR_FIGHT_AI.cmd en la carpeta del proyecto.' }

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

$IconDirectory = Join-Path $env:LOCALAPPDATA 'FightAI'
New-Item -ItemType Directory -Path $IconDirectory -Force | Out-Null
$IconPath = Join-Path $IconDirectory 'FightAI-Beta-v3.ico'
try {
  $SourceIcon = Join-Path $Root 'assets\desktop\fight-ai-icon.png'
  if (Test-Path $SourceIcon) {
    Add-Type -AssemblyName System.Drawing
    $sourceBitmap = [System.Drawing.Bitmap]::FromFile($SourceIcon)
    try {
      # Explorer uses different icon sizes depending on DPI and view mode. A
      # single 256 px frame can fall back to the generic .cmd icon, so write a
      # standards-compatible multi-image ICO with a PNG frame for every common
      # Windows shell size.
      $frames = @()
      foreach ($size in @(16,20,24,32,40,48,64,96,128,256)) {
        $resized = New-Object System.Drawing.Bitmap $size,$size,([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $canvas = [System.Drawing.Graphics]::FromImage($resized)
        try {
          $canvas.Clear([System.Drawing.Color]::Transparent)
          $canvas.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
          $canvas.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $canvas.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $canvas.DrawImage($sourceBitmap, 0, 0, $size, $size)
          $pngStream = New-Object System.IO.MemoryStream
          try {
            $resized.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
            $frames += [pscustomobject]@{ Size = $size; Bytes = $pngStream.ToArray() }
          } finally { $pngStream.Dispose() }
        } finally { $canvas.Dispose(); $resized.Dispose() }
      }

      $stream = [System.IO.File]::Open($IconPath, [System.IO.FileMode]::Create)
      $writer = New-Object System.IO.BinaryWriter($stream)
      try {
        $writer.Write([UInt16]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]$frames.Count)
        $offset = 6 + (16 * $frames.Count)
        foreach ($frame in $frames) {
          $dimension = if ($frame.Size -eq 256) { [byte]0 } else { [byte]$frame.Size }
          $writer.Write($dimension)
          $writer.Write($dimension)
          $writer.Write([byte]0)
          $writer.Write([byte]0)
          $writer.Write([UInt16]1)
          $writer.Write([UInt16]32)
          $writer.Write([UInt32]$frame.Bytes.Length)
          $writer.Write([UInt32]$offset)
          $offset += $frame.Bytes.Length
        }
        foreach ($frame in $frames) { $writer.Write($frame.Bytes) }
      } finally { $writer.Dispose() }
    } finally { $sourceBitmap.Dispose() }
  } else {
    New-FightAiIcon $IconPath
  }
} catch {
  Write-Host 'No se pudo generar el icono personalizado; se usara un icono de Windows.' -ForegroundColor Yellow
  $IconPath = "$env:SystemRoot\System32\shell32.dll"
}

$ShortcutPath = Join-Path $Desktop 'Fight AI Beta.lnk'
if (Test-Path -LiteralPath $ShortcutPath) {
  Remove-Item -LiteralPath $ShortcutPath -Force
  Start-Sleep -Milliseconds 350
}
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Launcher
$Shortcut.WorkingDirectory = $Root
$Shortcut.Description = 'Abre Fight AI Web en este PC y reutiliza el servidor si ya está listo.'
$Shortcut.WindowStyle = 1
$Shortcut.IconLocation = if ($IconPath -like '*.ico') { "$IconPath,0" } else { "$IconPath,220" }
$Shortcut.Save()

# Refresh Explorer after switching to the versioned icon path.
$refresh = Join-Path $env:SystemRoot 'System32\ie4uinit.exe'
if (Test-Path $refresh) { Start-Process -FilePath $refresh -ArgumentList '-show' -WindowStyle Hidden -Wait }
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class FightAIShellRefresh {
  [DllImport("shell32.dll")]
  public static extern void SHChangeNotify(uint eventId, uint flags, IntPtr item1, IntPtr item2);
}
'@
[FightAIShellRefresh]::SHChangeNotify(0x08000000, 0x0000, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host ''
Write-Host 'Acceso directo creado correctamente:' -ForegroundColor Green
Write-Host $ShortcutPath -ForegroundColor Green
Write-Host ''
Write-Host 'Desde ahora haz doble clic en "Fight AI Beta" para iniciar o reutilizar' -ForegroundColor Cyan
Write-Host 'el servidor local y abrir la app en tu navegador.'
Write-Host 'Usa TODO_FIGHT_AI.bat solo cuando quieras actualizar y compartir externamente.'
Write-Host ''
Write-Host 'El acceso directo usa el icono Fight AI guardado en LocalAppData.' -ForegroundColor DarkGray
