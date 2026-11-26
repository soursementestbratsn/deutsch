# -*- coding: utf-8 -*-
"""Синтаксис всех JS через node --check + проверка дублей id в index.html.

    python scripts/check_js.py
"""
from __future__ import annotations

import glob
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BAD: list[str] = []


def node() -> str | None:
    for exe in ("node", "node.exe"):
        p = shutil.which(exe)
        if p:
            return p
    return None


def check_syntax(node_exe: str, files: list[str]) -> None:
    for path in files:
        rel = os.path.relpath(path, ROOT).replace("\\", "/")
        r = subprocess.run([node_exe, "--check", path], capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        if r.returncode != 0:
            msg = (r.stderr or r.stdout or "").strip().splitlines()
            where = next((l for l in msg if "SyntaxError" in l or "^" in l), msg[0] if msg else "?")
            BAD.append(f"{rel}: {where.strip()[:140]}")


def check_dup_ids() -> None:
    src = open(os.path.join(ROOT, "web", "index.html"), encoding="utf-8").read()
    seen: dict[str, int] = {}
    for m in re.finditer(r'\bid="([^"]+)"', src):
        seen[m.group(1)] = seen.get(m.group(1), 0) + 1
    for k, v in seen.items():
        if v > 1:
            BAD.append(f"index.html: id=\"{k}\" повторяется {v} раза")


def check_versions() -> None:
    src = open(os.path.join(ROOT, "web", "index.html"), encoding="utf-8").read()
    for m in re.finditer(r'(?:src|href)="([^"?]+\.(?:js|css))"', src):
        BAD.append(f"index.html: у {m.group(1)} нет ?v= (браузер закэширует старое)")
    for m in re.finditer(r'src="([^"?]+\.js)(?:\?v=\d+)?">', src):
        if not os.path.isfile(os.path.join(ROOT, "web", m.group(1))):
            BAD.append(f"index.html: ссылка на несуществующий {m.group(1)}")


def main() -> int:
    node_exe = node()
    files = [p for p in glob.glob(os.path.join(ROOT, "web", "**", "*.js"), recursive=True)
             if "node_modules" not in p]
    if node_exe:
        check_syntax(node_exe, files)
        print(f"  JS-файлов через node --check: {len(files)}")
    else:
        print("  node не найден — проверка синтаксиса пропущена")
    check_dup_ids()
    check_versions()
    if not BAD:
        print("✓ Синтаксис и ссылки в порядке")
        return 0
    print(f"\nПроблем: {len(BAD)}")
    for b in BAD:
        print("  " + b)
    return 1


if __name__ == "__main__":
    sys.exit(main())
