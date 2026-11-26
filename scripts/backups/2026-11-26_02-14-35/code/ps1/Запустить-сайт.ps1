# Запустить сайт (Deutsch Quest) и открыть браузер
# Двойной клик по этому файлу — или в терминале:  .\Запустить-сайт.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# уже запущен? тогда просто откроем вкладку
try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:8000/api/data"
    if ($r.StatusCode -eq 200) {
        Start-Process "http://127.0.0.1:8000/"
        Write-Host "Сайт уже запущен — открыл вкладку." -ForegroundColor Green
        exit 0
    }
}
catch { }

Write-Host "Запускаю Deutsch Quest на http://127.0.0.1:8000 ..." -ForegroundColor Cyan
python main.py
