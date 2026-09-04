@echo off
setlocal
cd /d "%~dp0"
title Fight AI - Todo automatico
echo.
echo Fight AI: actualizando, construyendo, iniciando servidor y enlace externo...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0TODO_FIGHT_AI.bat.ps1"
if errorlevel 1 (
  echo.
  echo ====================================================
  echo  Fight AI NO pudo completar el arranque automatico.
  echo  Revisa el error mostrado arriba.
  echo ====================================================
  pause
  exit /b 1
)
echo.
echo Puedes dejar Fight AI funcionando y cerrar esta ventana.
pause
endlocal
