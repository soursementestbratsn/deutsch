# Проверить весь проект: JS-синтаксис, контент, ссылки.
#   .\Проверить-контент.ps1
# Ничего не меняет — только отчёт.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$env:PYTHONIOENCODING = "utf-8"

Write-Host "→ JS-синтаксис и ссылки" -ForegroundColor Cyan
python scripts/check_js.py
$ok1 = $LASTEXITCODE -eq 0

Write-Host "`n→ Контент (слова, уроки, задания)" -ForegroundColor Cyan
python scripts/check_content.py
$ok2 = $LASTEXITCODE -eq 0

if ($ok1 -and $ok2) { Write-Host "`n✓ Всё чисто" -ForegroundColor Green }
else { Write-Host "`n! Есть замечания выше" -ForegroundColor Yellow }
