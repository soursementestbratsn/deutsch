# Пересобрать курс из слов словаря (24 урока).
#   .\Пересобрать-курс.ps1
# Меняете content/words.txt — запускаете этот скрипт и уроки обновляются.
# Можно править тексты уроков прямо в web/course/lessons-*.js — но тогда
# пересборка их перезапишет; постоянные правки — в scripts/build_course.py.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$env:PYTHONIOENCODING = "utf-8"
python scripts/build_course.py
