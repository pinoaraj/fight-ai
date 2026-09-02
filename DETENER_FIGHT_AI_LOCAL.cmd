@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$port=3000; if(Test-Path '.fight-ai-port'){ $raw=Get-Content '.fight-ai-port' -ErrorAction SilentlyContinue; if($raw -match '^\d+$'){ $port=[int]$raw } }; Write-Host ('Deteniendo Fight AI Web en puerto ' + $port + '...'); $p=(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); if($p){$p|ForEach-Object{Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue}; Write-Host 'Fight AI detenido.' -ForegroundColor Green}else{Write-Host 'No habia un servidor Fight AI escuchando en ese puerto.' -ForegroundColor Yellow}"
pause
