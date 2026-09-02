@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0COMPARTIR_FIGHT_AI.ps1"
if errorlevel 1 (
  echo.
  echo No se pudo crear el enlace externo seguro.
)
pause
