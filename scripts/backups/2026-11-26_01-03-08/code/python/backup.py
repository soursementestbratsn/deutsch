# -*- coding: utf-8 -*-
"""Deutsch Quest — система «версий» (бэкапов).

Каждый бэкап — это ПОЛНАЯ КОПИЯ проекта (без тяжёлых кэшей) в одной папке
`backups/2026-11-22_18-40-12/` плюс человекочитаемая папка `info/`:

    backups/<ID>/
        code/            копия проекта: web/, dq/, content/, worksheets/, *.py, *.md …
        info/prompt.md   ваш запрос на этот этап
        info/changes.md  что и в каких файлах изменилось (diff-статистика)
        info/stats.json  данные на момент снимка: прогресс, XP, слов в словаре…
        info/FILES.txt   полный список файлов снимка (для поиска)

Плюс общий `backups/index.json` — лента всех версий.

Зачем: перед/после любой правки можно откатить один файл или всё целиком.
Бэкапы лежат ТОЛЬКО на этом компьютере, в папке проекта.

Использование (обычно вызывает только PowerShell-скрипт «Сделать-бэкап.ps1»
и агент в конце каждой задачи):

    python scripts/backup.py list
    python scripts/backup.py now --label "00: старт" --prompt-file prompt.txt
    python scripts/backup.py restore <ID> [--with-stats] [--file web/dq.js]
    python scripts/backup.py stats            # сводка по проекту
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKUPS = ROOT / "backups"

# что НЕ копируем: локальное окружение, кэши, старые версии и сам мусор
SKIP_DIRS = {
    ".venv", "backups", "node_modules", "__pycache__", ".git", ".idea", ".vscode",
    "audio_cache", "images", "dist", "build", ".pytest_cache", ".mypy_cache",
}
SKIP_FILES = {"prompt.txt"}          # временный файл запроса (живёт минуту)
SKIP_SUFFIXES = {".pyc", ".pyo", ".log", ".tmp", ".bak"}

# статистика внутри info/stats.json — какие поля прогресса показывать
STAT_FIELDS = ("answered", "correct", "xp", "best_streak", "daily_answers",
               "day_streak", "last_study_day", "today")


# --------------------------------------------------------------- утилиты
def _now() -> dt.datetime:
    return dt.datetime.now()


def _id_of(moment: dt.datetime) -> str:
    return moment.strftime("%Y-%m-%d_%H-%M-%S")


def _read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


# --------------------------------------------------------------- выбор файлов
def project_files() -> list[Path]:
    """Все файлы проекта, которые попадают в снимок."""
    out: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        here = Path(dirpath)
        rel_parts = here.relative_to(ROOT).parts
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        if rel_parts and rel_parts[0] in SKIP_DIRS:
            continue
        for name in filenames:
            if name in SKIP_FILES or name.startswith("~$"):
                continue
            if Path(name).suffix.lower() in SKIP_SUFFIXES:
                continue
            out.append(here / name)
    return sorted(out)


# --------------------------------------------------------------- статистика
def project_stats() -> dict:
    """Короткая сводка «что было на момент снимка»."""
    stats: dict = {}
    content = ROOT / "content"
    prog = _read_json(content / "de_lernen_stats.json")
    # прогресс читаем сырым: _stats() с сервера режет ключи, а в снимке нужны все
    raw = _read_json(content / "de_lernen_stats.json")
    prog = raw
    stats["прогресс"] = {k: prog.get(k) for k in STAT_FIELDS if k in prog}
    if "srs" in prog:
        stats["слов в повторении"] = len((prog.get("srs") or {}).get("box") or {})
    stats["настроек"] = len(prog.get("ui") or {})

    words = content / "words.txt"
    if words.exists():
        text = words.read_text(encoding="utf-8", errors="replace").splitlines()
        stats["груп слов"] = sum(1 for l in text if l.strip().startswith("#"))
        stats["пар слов"] = sum(1 for l in text if "=" in l and not l.strip().startswith("#"))

    stats["заданий (файлов)"] = len(list((ROOT / "worksheets").glob("*.json")))
    web = ROOT / "web"
    stats["файлов веба"] = len([p for p in web.rglob("*") if p.is_file()]) if web.exists() else 0
    stats["строк кода"] = _count_lines()
    return stats


def _count_lines() -> int:
    total = 0
    for p in project_files():
        if p.suffix.lower() in {".py", ".js", ".css", ".html", ".md", ".json", ".txt", ".ps1"}:
            try:
                total += sum(1 for _ in p.open("r", encoding="utf-8", errors="replace"))
            except OSError:
                pass
    return total


# --------------------------------------------------------------- изменения
def _git_avail() -> bool:
    """git есть И проект — git-репозиторий (только тогда можно строить diff --no-index)."""
    return (ROOT / ".git").exists()


def changes_since(prev_id: str | None) -> list[dict]:
    """Что изменилось относительно предыдущего бэкапа.

    Сравниваем содержимое (sha1), а не размер — так изменения того же объёма тоже видны.
    """
    if not prev_id:
        return []
    prev = BACKUPS / prev_id / "code"
    if not prev.exists():
        return []
    old = {p.relative_to(prev).as_posix() for p in prev.rglob("*") if p.is_file()}
    rows: list[dict] = []
    for path in project_files():
        rel = _rel(path)
        back = prev / rel
        if rel not in old:
            rows.append({"файл": rel, "что": "новый"})
        elif _hash(path) != _hash(back):
            rows.append({"файл": rel, "что": "изменён"})
    cur = {_rel(p) for p in project_files()}
    for rel in sorted(old - cur):
        rows.append({"файл": rel, "что": "удалён"})
    return sorted(rows, key=lambda r: r["файл"])


def _hash(path: Path) -> str:
    try:
        return hashlib.sha1(path.read_bytes()).hexdigest()
    except OSError:
        return ""


def _diff_stat(prev_id: str | None) -> str:
    if not prev_id or not _git_avail():
        return ""
    prev = BACKUPS / prev_id / "code"
    try:
        r = subprocess.run(
            ["git", "diff", "--no-index", "--stat", str(prev), str(ROOT)],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        return (r.stdout or "").strip()
    except Exception:
        return ""


# --------------------------------------------------------------- создание
def make_backup(prompt: str = "", label: str = "") -> dict:
    BACKUPS.mkdir(parents=True, exist_ok=True)
    index = _read_json(BACKUPS / "index.json") or {"versions": []}
    versions = index.get("versions", [])
    prev_id = versions[-1]["id"] if versions else None

    moment = _now()
    bid = _id_of(moment)
    n = 2
    while (BACKUPS / bid).exists():          # два бэкапа в одну секунду
        bid = f"{_id_of(moment)}_{n}"
        n += 1

    dest = BACKUPS / bid
    code = dest / "code"
    code.mkdir(parents=True, exist_ok=True)

    files = project_files()
    for src in files:
        target = code / src.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, target)

    info = dest / "info"
    info.mkdir(parents=True, exist_ok=True)
    (info / "prompt.md").write_text(
        (prompt or "(запрос не указан)").strip() + "\n", encoding="utf-8")

    changes = changes_since(prev_id)
    diff = _diff_stat(prev_id)
    main_files = list(dict.fromkeys(r["файл"] for r in changes))[:25]
    lines = [f"# Изменения: {bid}", ""]
    if label:
        lines += [f"**Этап:** {label}", ""]
    lines += [f"**Предыдущая версия:** `{prev_id or '— (это первая)'}`", ""]
    if changes:
        lines.append(f"Изменено файлов: **{len(changes)}**")
        lines.append("")
        lines.append("| Файл | Что |")
        lines.append("|---|---|")
        for r in changes:
            lines.append(f"| `{r['файл']}` | {r['что']} |")
    elif prev_id:
        lines.append("Изменений относительно предыдущей версии нет — это снимок «как есть».")
    else:
        lines.append("Это первая версия: снимок всего проекта целиком.")
    if diff:
        lines += ["", "```", diff, "```"]
    (info / "changes.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    pstats = project_stats()
    _write_json(info / "stats.json", pstats)
    (info / "FILES.txt").write_text(
        "\n".join(_rel(p) for p in files) + "\n", encoding="utf-8")

    total = sum(p.stat().st_size for p in code.rglob("*") if p.is_file())
    entry = {
        "id": bid,
        "at": moment.isoformat(timespec="seconds"),
        "label": label or f"версия {len(versions) + 1}",
        "prompt": (prompt or "").strip(),
        "prev": prev_id,
        "files": len(files),
        "changed": len(changes),
        "size": total,
        "stats": pstats,
        "changes": changes[:400],
    }
    versions.append(entry)
    _write_json(BACKUPS / "index.json", {"versions": versions})
    # читаемая заметка «что, зачем и что изменилось» — рядом с code/ и info/
    try:
        (dest / "ЗАМЕТКА.md").write_text(make_note(entry, main_files, prompt), encoding="utf-8")
    except Exception as exc:      # заметка не должна ломать сам снимок
        print("  ! заметка:", exc)
    return entry


def wrap_md(text: str, width: int = 88) -> str:
    """Мягкая переноска длинных строк (для читаемости info/prompt.md)."""
    out: list[str] = []
    for line in (text or "").splitlines():
        line = line.rstrip()
        if not line:
            out.append("")
            continue
        if line.startswith(("#", "|", "`", "```", "  ", "-", "*", ">")) or "http" in line:
            out.append(line)
            continue
        while len(line) > width:
            cut = line.rfind(" ", 0, width)
            if cut <= 0:
                cut = width
            out.append(line[:cut])
            line = line[cut:].lstrip()
        out.append(line)
    return "\n".join(out)


def make_note(entry: dict, main_files: list[str], prompt: str) -> str:
    """Человекочитаемая заметка о версии: что изменилось и как откатиться."""
    st = entry.get("stats") or {}
    prog = st.get("прогресс") or {}
    lines = [f"# {entry['id']} — {entry.get('label', '')}", ""]
    if prompt:
        lines += ["## Ваш запрос", "", wrap_md(prompt.strip()), ""]
    lines += ["## Данные на момент снимка", ""]
    if prog:
        for k, val in prog.items():
            lines.append(f"- {k}: **{val}**")
    for k, val in st.items():
        if k != "прогресс":
            lines.append(f"- {k}: {val}")
    lines += ["", "## Что изменилось", ""]
    changes = entry.get("changes") or []
    if changes:
        lines += ["| Файл | Что |", "|---|---|"]
        for ch in changes:
            lines.append(f"| `{ch.get('файл')}` | {ch.get('что')} |")
    else:
        lines.append("Изменений нет — тот же код, что и в предыдущей версии.")
    if main_files:
        lines += ["", "## Главные файлы версии", ""]
        for f in main_files:
            lines.append(f"- `{f}`")
    lines += ["", "## Откат", "",
              f"- весь код: `python scripts/backup.py restore {entry['id']}` (прогресс не трогается)",
              "- вместе с прогрессом: добавить `--with-stats` или кнопка на странице /backups",
              f"- один файл: `python scripts/backup.py restore {entry['id']} --file web/dq.js`", ""]
    return "\n".join(lines)



# --------------------------------------------------------------- чтение
def load_index() -> list[dict]:
    return (_read_json(BACKUPS / "index.json") or {}).get("versions", [])


def find(version_id: str) -> dict | None:
    for v in load_index():
        if v["id"] == version_id:
            return v
    return None


def version_dir(version_id: str) -> Path:
    """Папка версии — только из индекса (защита от ../ в имени)."""
    v = find(version_id)
    if not v:
        raise SystemExit(f"нет такой версии: {version_id}")
    return BACKUPS / v["id"]


def read_info(version_id: str) -> dict:
    d = version_dir(version_id) / "info"
    out = {"prompt": "", "changes": "", "stats": {}}
    for key, name in (("prompt", "prompt.md"), ("changes", "changes.md")):
        p = d / name
        if p.exists():
            out[key] = p.read_text(encoding="utf-8", errors="replace")
    sp = d / "stats.json"
    if sp.exists():
        out["stats"] = _read_json(sp)
    return out


def project_diff(prev_id: str | None) -> str:
    """Текстовый diff между предыдущей версией и текущими файлами (если есть git)."""
    return _diff_stat(prev_id)


def read_note(version_id: str) -> str:
    """ЗАМЕТКА.md версии (если есть)."""
    p = version_dir(version_id) / "ЗАМЕТКА.md"
    return p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""


# --------------------------------------------------------------- восстановление
def restore(version_id: str, with_stats: bool = False, only: str = "") -> list[str]:
    """Возвращает список восстановленных файлов."""
    src = version_dir(version_id) / "code"
    if not src.exists():
        raise SystemExit("в этой версии нет папки code/")
    done: list[str] = []
    if only:
        p = (src / only).resolve()
        if not str(p).startswith(str(src.resolve())):
            raise SystemExit("путь вне снимка")
        if not p.is_file():
            raise SystemExit(f"в версии нет файла: {only}")
        target = ROOT / only
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, target)
        return [only]

    for p in src.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(src)
        if not with_stats and rel.as_posix() == "content/de_lernen_stats.json":
            continue                         # прогресс по умолчанию не трогаем
        target = ROOT / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, target)
        done.append(rel.as_posix())
    return done


# --------------------------------------------------------------- CLI
def _summary(v: dict) -> str:
    pr = (v.get("stats") or {}).get("прогресс") or {}
    bits = [f"{v['id']}", f"| {v.get('label', '')}"]
    if pr:
        bits.append(f"| ответов {pr.get('answered', 0)}, XP {pr.get('xp', 0)}")
    bits.append(f"| файлов {v.get('files', 0)}, изменено {v.get('changed', 0)}")
    return " ".join(bits)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="версии проекта Deutsch Quest")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="список версий")

    p_now = sub.add_parser("now", help="сделать снимок")
    p_now.add_argument("--label", default="", help="подпись этапа")
    p_now.add_argument("--prompt", default="", help="текст запроса")
    p_now.add_argument("--prompt-file", default="", help="файл с текстом запроса")

    p_rs = sub.add_parser("restore", help="вернуть файлы из версии")
    p_rs.add_argument("id")
    p_rs.add_argument("--with-stats", action="store_true", help="вернуть и прогресс")
    p_rs.add_argument("--file", default="", help="только один файл (путь относительно проекта)")

    sub.add_parser("stats", help="сводка проекта сейчас")

    args = ap.parse_args(argv)

    if args.cmd == "list":
        vs = load_index()
        if not vs:
            print("версий пока нет. Сделайте первую: .\\Сделать-бэкап.ps1 \"начало\"")
            return 0
        for v in reversed(vs):
            print(_summary(v))
        return 0

    if args.cmd == "stats":
        print(json.dumps(project_stats(), ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "now":
        prompt = args.prompt
        if args.prompt_file and Path(args.prompt_file).exists():
            prompt = Path(args.prompt_file).read_text(encoding="utf-8", errors="replace")
        entry = make_backup(prompt=prompt, label=args.label)
        print(f"✓ версия {entry['id']} — {entry['label']}")
        print(f"  файлов: {entry['files']}, изменено: {entry['changed']}, "
              f"размер: {entry['size'] / 1024:.0f} КБ")
        print(f"  папка: {entry['id']}")
        return 0

    if args.cmd == "restore":
        done = restore(args.id, with_stats=args.with_stats, only=args.file)
        print(f"восстановлено файлов: {len(done)}")
        for f in done[:40]:
            print(" ", f)
        if len(done) > 40:
            print(f"  … и ещё {len(done) - 40}")
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
