@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-remote-tunnel.ps1"
if errorlevel 1 echo No se pudo verificar y detener el tunel.
pause
