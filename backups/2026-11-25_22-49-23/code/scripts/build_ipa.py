# -*- coding: utf-8 -*-
"""
Собирает словарь IPA (pronunciation.json) для ВСЕХ немецких слов приложения.

    python scripts/build_ipa.py              # слова из словарей (+ сеть, если нужно)
    python scripts/build_ipa.py --offline    # только seed + правила, без сети
    python scripts/build_ipa.py --check      # отчёт: что не покрыто
    python scripts/build_ipa.py --redo       # перезаписать даже существующие записи

Источники (в порядке приоритета):
  1. pronunciations/ipa_seed.py — выверенный вручную словарь частых слов;
  2. English Wiktionary (en.wiktionary.org): «немецкий={{IPA|de|…}}» — самый полный;
  3. de.wiktionary.org: {{Lautschrift|de|…}};
  4. dq.phonetics.ipa_rules — правила немецкой орфографии (всегда дают результат).

Правила перезаписываются seed-ом и Wiktionary: если в файле уже лежит IPA,
полученный из сети, --offline его НЕ портит (это проверяется полем "src").
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from dq.core import (WORDS_FILE, PHRASES_FILE, NUMBERS_FILE,  # noqa: E402
                     load_words_with_groups, load_data_from_file)
from dq import phonetics  # noqa: E402
from pronunciations import ipa_seed  # noqa: E402

OUT = os.path.join(ROOT, "content", "pronunciation.json")
UA = "DeutschQuest/1.1 (personal German learning app)"
RANK = {"seed": 4, "wiktionary": 3, "rules": 1}


def _get(url, timeout=8):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def _json(url):
    return json.loads(_get(url))


def en_wiktionary_ipa(word):
    """IPA из en.wiktionary: секция ==German== → {{IPA|de|/ˈvasɐ/}} + переносы {{hyph}}."""
    url = "https://en.wiktionary.org/w/api.php?" + urllib.parse.urlencode({
        "action": "parse", "page": word, "prop": "wikitext", "format": "json",
        "formatversion": 2, "redirects": 1,
    })
    try:
        data = _json(url)
        wt = (data.get("parse") or {}).get("wikitext") or ""
        if isinstance(wt, dict):
            wt = wt.get("*") or ""
    except Exception:
        return None, None
    sec = ""
    i = wt.find("==German==")
    if i >= 0:
        sec = wt[i:]
        m = re.search(r"\n==[^=W][^=]*==", sec)
        if m:
            sec = sec[:m.start()]
    if not sec:
        return None, None
    ipa = syl = None
    found = []
    for m in re.finditer(r"\{\{IPA\|de\|([^}|]+)", sec):
        cand = m.group(1).strip()
        if cand:
            found.append(cand)
    if found:
        # предпочитаем фонематическую запись /…/ фонетической […] и берём первую
        ipa = next((c.strip("/[]") for c in found if c.startswith("/")), found[0].strip("/[]"))
    m = re.search(r"\{\{hyph\|de\|([^}|]+)", sec)
    if m:
        syl = "-".join(p.strip() for p in m.group(1).split("|") if p.strip())
    return ipa, syl


def online_ipa(word):
    """Сеть: en.wiktionary, затем de.wiktionary. Возвращает (ipa|None, syl|None)."""
    ipa, syl = en_wiktionary_ipa(word)
    if ipa:
        return ipa, syl
    return de_wiktionary_ipa(word), None


def de_wiktionary_ipa(word):
    try:
        data = _json("https://de.wiktionary.org/w/api.php?" + urllib.parse.urlencode({
            "action": "query", "prop": "revisions", "rvprop": "content",
            "rvslots": "main", "format": "json", "formatversion": 2,
            "titles": word, "redirects": 1,
        }))
    except Exception:
        return None
    for page in (data.get("query") or {}).get("pages") or []:
        for rev in page.get("revisions") or []:
            text = ((rev.get("slots") or {}).get("main") or {}).get("content") or ""
            for m in re.finditer(r"\{\{Lautschrift\|de\|([^|}]+)", text):
                return m.group(1).strip().strip("/[]")
    return None


def collect_words():
    words, seen = [], set()

    def add(w):
        w = (w or "").strip()
        if not w or len(w) < 2 or w.lower() in seen:
            return
        if not re.search(r"[A-Za-zÄÖÜäöüß]", w):
            return
        seen.add(w.lower())
        words.append(w)

    def add_phrase(de):
        """Фраза идёт цельно + каждое слово отдельно (для озвучки по словам)."""
        add(de)
        if " " in de.strip():
            for part in re.findall(r"[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*", de):
                add(part)

    for arr in load_words_with_groups(WORDS_FILE).values():
        for de, _ru in arr:
            add_phrase(de)
    for de, _ru in load_data_from_file(PHRASES_FILE):
        add_phrase(de)
    for de, _n in load_data_from_file(NUMBERS_FILE):
        add_phrase(de)
    return words


def ipa_for(word, online, seen_keys):
    """Лучший IPA для слова. Возвращает (ipa, src)."""
    w, _art = phonetics.split_article(word)
    seed = ipa_seed.get(w)
    if seed:
        return seed, "seed"
    if online:
        net, _syl = en_wiktionary_ipa(w)
        if not net:
            net = de_wiktionary_ipa(w)
        if net:
            return net, "wiktionary"
    return phonetics.ipa_rules(w), "rules"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--redo", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    old = {}
    if os.path.exists(OUT):
        try:
            with open(OUT, "r", encoding="utf-8") as f:
                old = json.load(f).get("words") or {}
        except Exception:
            old = {}

    words = collect_words()
    if args.limit:
        words = words[:args.limit]

    if args.check:
        missing = [w for w in words if w.lower() not in old]
        weak = [k for k, v in old.items() if v.get("src") in (None, "rules")][:40]
        seeded = sum(1 for w in words if ipa_seed.get(phonetics.split_article(w)[0]))
        print("слов: %d · в файле: %d · из seed: %d · по правилам: %d · нет: %d"
              % (len(words), len(old), seeded, len(weak), len(missing)))
        for w in (missing or weak)[:30]:
            print("  -", w.encode("ascii", "backslashreplace").decode())
        return

    out = dict(old)
    added = net = 0
    for i, w in enumerate(words, 1):
        key = w.strip().lower()
        prev = out.get(key) or {}
        if prev.get("ipa") and not args.redo and RANK.get(prev.get("src"), 0) >= 3:
            continue                    # уже точное — не трогаем
        base, _art = phonetics.split_article(w)
        seed = ipa_seed.get(base)
        if seed:
            ipa, src, net_syl = seed, "seed", None
        elif not args.offline:
            net_ipa, net_syl = online_ipa(base)
            ipa, src = (net_ipa, "wiktionary") if net_ipa else (phonetics.ipa_rules(base), "rules")
            if ipa:
                time.sleep(0.12)         # вежливо к серверам Wiktionary
        else:
            ipa, src, net_syl = phonetics.ipa_rules(base), "rules", None
        if prev.get("ipa") and RANK.get(prev.get("src"), 0) > RANK.get(src, 0):
            continue                    # новое хуже сохранённого
        d = phonetics.describe(w)
        out[key] = {
            "ipa": ipa,
            "syl": net_syl or "-".join(phonetics.syllables(base)),
            "ru": d["ru"],
            "src": src,
        }
        added += 1
        net += src == "wiktionary"
        if i % 50 == 0:
            print("  %d/%d" % (i, len(words)))

    data = {"meta": {"version": 2, "words": len(out),
                     "sources": ["seed", "en.wiktionary", "de.wiktionary", "rules"]},
            "words": out}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1, sort_keys=True)
    print("добавлено %d (из сети %d), всего %d → %s"
          % (added, net, len(out), OUT))


if __name__ == "__main__":
    main()
