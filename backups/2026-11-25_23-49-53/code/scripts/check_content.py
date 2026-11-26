# -*- coding: utf-8 -*-
"""Проверка контента Deutsch Quest: слова, задания, курс, фронт.

    python scripts/check_content.py

Понимает обе схемы заданий:
  * плоскую (wortschatz-themen / zeitformen): task = {type, q, options, answer}
  * групповую (a1-test): task = {type, items:[{before, after, answers} | {prefix, answers}]}
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ISSUES: list[str] = []


def issue(kind: str, text: str) -> None:
    ISSUES.append(f"[{kind}] {text}")


def read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


# ------------------------------------------------------------------ слова
def check_words() -> dict:
    path = os.path.join(ROOT, "content", "words.txt")
    groups: dict[str, list[tuple[str, str]]] = {}
    cur = None
    for n, raw in enumerate(read(path).splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("//"):
            continue
        if line.startswith("#"):
            cur = line.lstrip("#").strip()
            if cur in groups:
                issue("words", f"строка {n}: группа «{cur}» объявлена дважды")
            groups.setdefault(cur, [])
            continue
        sep = next((s for s in ("=", "|", "->", "\t") if s in line), None)
        if not sep or cur is None:
            issue("words", f"строка {n}: нет разделителя «de = ru» или слово вне группы")
            continue
        de, ru = [p.strip() for p in line.split(sep, 1)]
        if not de or not ru:
            issue("words", f"строка {n}: пустая часть у «{line}»")
        if not re.search(r"[A-Za-zÄÖÜäöüß]", de):
            issue("words", f"строка {n}: в немецкой части нет латиницы: «{de}»")
        groups[cur].append((de, ru))

    # дубли внутри одной группы (между разными — это нормально: расширение темы)
    for g, arr in groups.items():
        if not arr:
            issue("words", f"группа «{g}» пустая")
        seen: set[str] = set()
        for de, ru in arr:
            # регистр важен: «sie» (она) и «Sie» (Вы) — разные слова
            if de in seen:
                issue("words", f"дубль «{de}» в «{g}»")
            seen.add(de)
    return groups


# ------------------------------------------------------------------ задания
def _check_item(where: str, item: dict) -> None:
    answers = item.get("answers") or ([item["answer"]] if item.get("answer") else [])
    if not answers:
        issue("worksheet", f"{where}: пункт без ответа: {json.dumps(item, ensure_ascii=False)[:80]}")
    options = item.get("options")
    if options is not None:
        if len(options) < 2:
            issue("worksheet", f"{where}: {len(options)} вариантов")
        if item.get("answer") and item["answer"] not in options:
            issue("worksheet", f"{where}: ответа нет среди вариантов: {item['answer']!r}")


def check_worksheets() -> int:
    n_tasks = 0
    for path in sorted(glob.glob(os.path.join(ROOT, "worksheets", "*.json"))):
        name = os.path.basename(path)
        try:
            data = json.loads(read(path))
        except Exception as exc:
            issue("worksheet", f"{name}: не JSON ({exc})")
            continue
        if "sections" in data and "variants" not in data:
            continue                         # таблицы — не задание
        for v in data.get("variants") or []:
            vname = v.get("name") or "?"
            for t in v.get("tasks") or []:
                ttype = t.get("type")
                if ttype not in ("gap", "sentence", "choice"):
                    issue("worksheet", f"{name}/{vname}: неизвестный тип «{ttype}»")
                    continue
                n_tasks += 1
                for item in t.get("items") or [t]:
                    _check_item(f"{name}/{vname}/{t.get('title') or ttype}", item)
    return n_tasks


# ------------------------------------------------------------------ курс
def check_course() -> None:
    files = sorted(glob.glob(os.path.join(ROOT, "web", "course", "lessons-*.js")))
    if not files:
        issue("course", "нет web/course/lessons-*.js (python scripts/build_course.py)")
        return
    total, nums, words = 0, [], 0
    for path in files:
        src = read(path)
        m = re.search(r"concat\((.*)\);\s*$", src, re.S)
        if not m:
            issue("course", f"{os.path.basename(path)}: нет concat(...)")
            continue
        try:
            data = json.loads(m.group(1))
        except Exception as exc:
            issue("course", f"{os.path.basename(path)}: битый JSON ({exc})")
            continue
        for lesson in data:
            total += 1
            nums.append(lesson.get("n"))
            words += len(lesson.get("words") or [])
            if len(lesson.get("words") or []) < 8:
                issue("course", f"урок {lesson.get('id')}: всего {len(lesson.get('words'))} слов")
            if not (lesson.get("rule") or {}).get("body"):
                issue("course", f"урок {lesson.get('id')}: нет текста правила")
            for t in lesson.get("tasks") or []:
                if t.get("type") == "choice":
                    if t.get("answer") not in (t.get("options") or []):
                        issue("course", f"урок {lesson.get('id')}: ответа нет среди вариантов")
                elif not t.get("answer"):
                    issue("course", f"урок {lesson.get('id')}: задание без ответа")
            for w in lesson.get("words") or []:
                if not isinstance(w, list) or len(w) != 2 or not all(w):
                    issue("course", f"урок {lesson.get('id')}: битая пара {w!r}")
    if sorted(nums) != list(range(1, len(nums) + 1)):
        issue("course", f"нумерация уроков не подряд: {nums}")
    print(f"  курс: уроков {total}, слов {words}")


# ------------------------------------------------------------------ фронт
def check_front() -> None:
    html = read(os.path.join(ROOT, "web", "index.html"))
    for m in re.finditer(r'(?:src|href)="([^"?]+\.(?:js|css))"', html):
        issue("front", f"у {m.group(1)} нет ?v= (браузер закэшет старое)")
    # все скрипты на месте
    web = os.path.join(ROOT, "web")
    for m in re.finditer(r'src="([^"?]+\.js)(?:\?v=\d+)?">', html):
        rel = m.group(1)
        if not os.path.isfile(os.path.join(web, rel)):
            issue("front", f"index.html ссылается на несуществующий {rel}")
    print("  фронт: index.html проверен")


def main() -> int:
    ap = argparse.ArgumentParser(description="проверка контента")
    ap.add_argument("--fix", action="store_true", help="вернуть 0 даже при замечаниях (dry-режим CI)")
    args = ap.parse_args()
    groups = check_words()
    print(f"  слова: {sum(len(v) for v in groups.values())} пар в {len(groups)} группах")
    print(f"  задания: {check_worksheets()} наборов/заданий")
    check_course()
    check_front()
    if not ISSUES:
        print("✓ Замечаний нет")
        return 0
    print(f"\nЗамечаний: {len(ISSUES)}")
    for i in ISSUES[:150]:
        print("  " + i)
    if len(ISSUES) > 150:
        print(f"  … и ещё {len(ISSUES) - 150}")
    return 0 if args.fix else 1


if __name__ == "__main__":
    sys.exit(main())
