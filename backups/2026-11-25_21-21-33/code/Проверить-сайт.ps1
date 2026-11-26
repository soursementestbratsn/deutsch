# Проверка сайта в настоящем (headless) браузере: ошибки консоли, битые запросы, скриншот.
#   .\Проверить-сайт.ps1
# Нужен node + patchright (npm i --no-save patchright); браузер запускается в tests/.

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# если сайт не запущен — поднимаем на временном порту
$port = 8777
try {
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:$port/api/data" | Out-Null
}
catch {
    Start-Process python -ArgumentList "server.py --port $port --no-browser" -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

node tests/_smoke_via_eval.mjs "http://127.0.0.1:$port/"
