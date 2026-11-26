# Показать все версии проекта (бэкапы) в консоли.
#   .\Список-версий.ps1
# Красивая версия с подробностями — на сайте: http://127.0.0.1:8000/backups

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

python scripts/backup.py list
Write-Host ""
Write-Host "Подробности и откат: " -NoNewline
Write-Host "http://127.0.0.1:8000/backups" -ForegroundColor Cyan -NoNewline
Write-Host "  (сайт должен быть запущен)"
