#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Уборка мусора разработки в корне проекта «Deutsch Quest».

Безопасно: по умолчанию только показывает, что удалит (--dry).
Удаляет ТОЛЬКО известные QA-артефакты из белого списка ниже.

    python scripts/cleanup.py            # показать список (dry-run)
    python scripts/cleanup.py --apply    # реально удалить

Что удаляется:
  * _*.png, _*.jpg            — скриншоты проверок
  * _*.mjs, _*.cjs, _*.ps1    — одноразовые QA/сборочные скрипты
  * _*.json                   — пробы/выгрузки (кроме живых файлов проекта)
  * _dbg_*, _probe_*, _tmp_*, _shot_*, _flow*  любых расширений
  * temp_*.mp3, shotlog.txt, __pycache__/
  * .pytest_cache, .mypy_cache, *.pyc

Что НЕ трогается никогда: web/, dq/, worksheets/, images/, audio_cache/, content/,
scripts/, tests/, _черновики/ (там лежат словари, прогресс, черновики).
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# файлы, которые НЕ трогаем никогда (лежат в content/, tests/, web/ — вне зоны удаления)
LIVE_DIRS = {"web", "dq", "worksheets", "images", "audio_cache", "content", "tests", "scripts",
             "pronunciations", "_черновики", "node_modules"}

# живые файлы, даже если совпали по шаблону
KEEP = {
    "de_lernen_stats.json",
    "user_words.json",
    "image_cache.json",
    "pronunciation.json",
    "_smoke_via_eval.py",
    "_smoke_via_eval.mjs",
}
# ВСЕ файлы и папки с «_» в корне — только если это НЕ мусор QA:
# документация (*.md), черновики и снимки версий не удаляются никогда

KEEP_PREFIX = ("_smoke_via_eval",)

PATTERNS = (
    "_*.png", "_*.jpg", "_*.jpeg", "_*.gif", "_*.webp",
    "_*.mjs", "_*.cjs", "_*.ps1", "_*.bat",
    "_*.json", "_*.mp3", "_*.wav", "_*.html", "_*.txt",
    "_dbg_*", "_probe_*", "_tmp_*", "_shot_*", "_flow*", "_qa*",
    "_train_*", "_smoke_*",
    "temp_*.mp3", "temp_*.wav", "shotlog.txt", "*.error.log",
)

DIR_PATTERNS = ("__pycache__", ".pytest_cache", ".mypy_cache")


def _protected(path: Path) -> bool:
    """Файл лежит в защищённой папке или это постоянный файл документации."""
    parts = path.relative_to(ROOT).parts
    if parts[0] in LIVE_DIRS and len(parts) > 1:
        return True
    # файлы документации могут начинаться с «_» — их не трогаем
    name = path.name
    if name.startswith("_") and name.endswith(".md"):
        return True
    return False


def collect():
    files: list[Path] = []
    dirs: list[Path] = []

    for pat in PATTERNS:
        for p in ROOT.glob(pat):
            if not p.is_file():
                continue
            name = p.name
            if name in KEEP or name.startswith(KEEP_PREFIX):
                continue
            # документация и черновики с «_» — не мусор
            if name.lower().endswith((".md", ".txt")):
                continue
            if p not in files:
                files.append(p)

    for pat in DIR_PATTERNS:
        for p in ROOT.rglob(pat):
            if p.is_dir() and not {".venv", ".git"} & set(p.parts) and not any(part in LIVE_DIRS for part in p.relative_to(ROOT).parts[:-1]):
                dirs.append(p)

    for p in ROOT.rglob("*.pyc"):
        if ".venv" not in p.parts and ".git" not in p.parts and p.is_file():
            files.append(p)

    # не даём удалить то, что в защищённых папках / тестовые скрипты
    files = [p for p in files if not _protected(p)]
    return sorted(set(files)), sorted(set(dirs))


def main() -> int:
    ap = argparse.ArgumentParser(description="удалить мусор разработки")
    ap.add_argument("--apply", action="store_true", help="реально удалить (по умолчанию dry-run)")
    ap.add_argument("--dry", action="store_true", help="только показать список (по умолчанию)")
    args = ap.parse_args()

    files, dirs = collect()
    if not files and not dirs:
        print("Чисто: удалять нечего.")
        return 0

    total = 0
    for f in files:
        total += f.stat().st_size
        print(f"{'удаляю' if args.apply else 'найден'}  {f.relative_to(ROOT)}")
    for d in dirs:
        print(f"{'удаляю' if args.apply else 'найден'}  {d.relative_to(ROOT)}/")

    print(f"\nфайлов: {len(files)}, папок: {len(dirs)}, ~{total / 1024:.0f} КБ")

    if not args.apply:
        print("\nЭто dry-run. Чтобы удалить: python scripts/cleanup.py --apply")
        return 0

    for f in files:
        try:
            f.unlink()
        except OSError as e:
            print(f"  ! не удалось {f.name}: {e}")
    for d in dirs:
        shutil.rmtree(d, ignore_errors=True)

    print("\nГотово.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
