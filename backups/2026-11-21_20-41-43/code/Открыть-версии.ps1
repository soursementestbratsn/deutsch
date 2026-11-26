# Открыть ОТДЕЛЬНЫЙ сайт «История версий» (независимо от основного сайта).
#   .\Открыть-версии.ps1
# Адрес: http://127.0.0.1:8001/ — список всех бэкапов с запросом и откатом.

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

try {
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:8001/api/versions" | Out-Null
    Start-Process "http://127.0.0.1:8001/"
    Write-Host "История версий уже запущена — открыл вкладку." -ForegroundColor Green
    exit 0
} catch { }

Write-Host "Запускаю сайт истории версий на http://127.0.0.1:8001 ..." -ForegroundColor Cyan
python server_versions.py
