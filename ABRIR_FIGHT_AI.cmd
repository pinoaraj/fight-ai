@echo off
setlocal
cd /d "%~dp0"
title Fight AI
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ABRIR_FIGHT_AI.ps1"
if errorlevel 1 (
  echo.
  echo Fight AI no pudo abrirse. Revisa el mensaje anterior.
  pause
  exit /b 1
)
endlocal
