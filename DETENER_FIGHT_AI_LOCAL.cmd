@echo off
echo Deteniendo Fight AI Web en puerto 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); if($p){$p|ForEach-Object{Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue}; Write-Host 'Fight AI detenido.' -ForegroundColor Green}else{Write-Host 'No habia un servidor Fight AI escuchando en el puerto 3000.' -ForegroundColor Yellow}"
pause
