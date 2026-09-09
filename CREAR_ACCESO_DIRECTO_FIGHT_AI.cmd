@echo off
setlocal
cd /d "%~dp0"
title Fight AI - Crear acceso directo
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0CREAR_ACCESO_DIRECTO_FIGHT_AI.ps1"
if errorlevel 1 (
  echo.
  echo No se pudo crear el acceso directo de Fight AI.
  pause
  exit /b 1
)
echo.
echo Listo. Busca "Fight AI Beta" en tu Escritorio.
pause
endlocal
