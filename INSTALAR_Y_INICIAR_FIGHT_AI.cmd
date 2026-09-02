@echo off
setlocal
title Fight AI Web - Instalador Local
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALAR_Y_INICIAR_FIGHT_AI.ps1"
if errorlevel 1 (
  echo.
  echo Fight AI no pudo completar la instalacion o el arranque.
  echo Revisa el mensaje anterior y vuelve a ejecutar este archivo.
  pause
)
endlocal
