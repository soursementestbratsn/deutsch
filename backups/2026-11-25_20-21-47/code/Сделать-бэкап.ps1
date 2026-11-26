# Сделать снимок (бэкап) текущей версии проекта.
#   .\Сделать-бэкап.ps1                       → спросит, что вы хотели, и подпишет
#   .\Сделать-бэкап.ps1 "подпись"             → без вопросов
#   .\Сделать-бэкап.ps1 "подпись" "текст запроса"
#
# Куда пишется: папка backups/2026-11-22_18-40-12/ (code/ — полная копия, info/ — запрос,
# изменения, статистика). Расширение «История версий» доступно и на сайте: http://127.0.0.1:8000/backups

param(
    [string]$Label = "",
    [string]$Prompt = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not $Label) {
    $Label = Read-Host "Подпись этапа (например: '05: фикс настроек')"
    if (-not $Label) { $Label = "снимок" }
}
if (-not $Prompt) {
    $Prompt = Read-Host "Что вы хотели сделать? (можно пусто)"
}

$promptFile = Join-Path $env:TEMP "dq_prompt.txt"
Set-Content -Path $promptFile -Value $Prompt -Encoding UTF8

python scripts/backup.py now --label $Label --prompt-file $promptFile
Remove-Item $promptFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Все версии: " -NoNewline
Write-Host "http://127.0.0.1:8000/backups" -ForegroundColor Cyan -NoNewline
Write-Host "  (или .\Список-версий.ps1)"
