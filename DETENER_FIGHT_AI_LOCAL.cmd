@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-local.ps1"
if errorlevel 1 (
  echo.
  echo Fight AI no se detuvo porque no se pudo verificar con seguridad el proceso.
)
pause
