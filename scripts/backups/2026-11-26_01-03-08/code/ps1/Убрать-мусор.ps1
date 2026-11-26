# Убрать мусор разработки (dry-run). С флагом -Apply — реально удалить.
#   .\Убрать-мусор.ps1            показать, что будет удалено
#   .\Убрать-мусор.ps1 -Apply     удалить

param([switch]$Apply)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if ($Apply) { python scripts/cleanup.py --apply } else { python scripts/cleanup.py --dry }
