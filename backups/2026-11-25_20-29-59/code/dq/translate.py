# -*- coding: utf-8 -*-
"""
Перевод слов и фраз для карточки по нажатию (web/wordpop.js).

Ключевой принцип: перевод НЕ должен вешать интерфейс.
    1) сначала свои словари (words.txt, phrases.txt, уже переведённое в user_words.json);
    2) затем сеть — но с жёстким таймаутом и кэшем результата в файле;
    3) если сети нет — возвращаем None, карточка честно скажет «перевода нет».

Внешние источники (оба бесплатные, без ключа):
    • MyMemory   — для фраз и предложений (перевод контекста);
    • Wiktionary — немецкий викисловарь, словарная статья с русским переводом.

Хранение: user_words.json (рядом со статистикой) —
    {"words": {"laufen": {...}}, "phrases": {"…": {...}}}
Это ОТДЕЛЬНЫЙ файл, как просили: прогресс (de_lernen_stats.json) не засоряется,
а нажатые слова можно показать в приложении и учить.
"""
import json
import os
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from .core import BASE_DIR, CONTENT_DIR, load_words_with_groups, load_data_from_file, WORDS_FILE, PHRASES_FILE

USER_WORDS_FILE = os.path.join(CONTENT_DIR, "user_words.json")

_LOCK = threading.Lock()
_CACHE = {}          # (kind, query) -> dict | None  (в памяти, на время работы сервера)

MAX_WORD = 60        # длиннее — это не слово, а мусор из клика
MAX_PHRASE = 400     # длиннее — фразу не переводим
NET_TIMEOUT = 4.5    # секунд на один внешний запрос


# --------------------------------------------------------------------------- #
#  Файл пользовательских переводов
# --------------------------------------------------------------------------- #
def _blank():
    return {"words": {}, "phrases": {}}


def load_user_words():
    try:
        with open(USER_WORDS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        data = {}
    if not isinstance(data, dict):
        data = {}
    data.setdefault("words", {})
    data.setdefault("phrases", {})
    return data


def save_user_words(data):
    tmp = USER_WORDS_FILE + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        os.replace(tmp, USER_WORDS_FILE)
    except Exception:
        pass


def key_of(text):
    return re.sub(r"\s+", " ", str(text or "")).strip().lower()


# --------------------------------------------------------------------------- #
#  Свои словари — всегда первыми (мгновенно и без сети)
# --------------------------------------------------------------------------- #
_DICT = None
_RDICT = None       # норм. русское слово → (de, ru) — для клика по-русски


def _rdict():
    """Обратный индекс: русское слово → (de, ru). Берётся из тех же словарей.

    «дом» → («das Haus», «дом»), «собака» → («der Hund», «собака»).
    Нужен для обратного перевода: клик по русскому слову → немецкое.
    """
    global _RDICT
    if _RDICT is not None:
        return _RDICT
    out = {}
    for de, ru in _dict().values():
        for part in re.split(r"[;,/]", str(ru or "")):
            # убираем пояснения в скобках: «дать (что-то)» → «дать»
            p = re.sub(r"\([^)]*\)", " ", part)
            k = key_of(p)
            if k:
                out.setdefault(k, (de, ru))
    _RDICT = out
    return out


def _dict():
    """{norm(de): (de, ru)} из words.txt + phrases.txt.

    «Wohnung» → ещё и «die Wohnung»: в словаре статья с артиклем, а в тексте
    слово стоит без него — ищем и в обратную сторону.
    """
    global _DICT
    if _DICT is not None:
        return _DICT
    out = {}
    for _title, items in load_words_with_groups(WORDS_FILE).items():
        for de, ru in items:
            _put(out, de, ru)
    for de, ru in load_data_from_file(PHRASES_FILE):
        _put(out, de, ru)
    _DICT = out
    return out


def _dict_find(word):
    """Точное совпадение, иначе — та же основа без артикля + снятие окончаний."""
    d = _dict()
    k = key_of(word)
    if k in d:
        return d[k]
    # в тексте слово без артикля, а в словаре — «die Wohnung»
    for de, ru in d.items():
        if de.startswith(("der ", "die ", "das ")) and de[4:] == k:
            return (de, ru)
    # формы: Hunde → Hund, spricht → sprechen
    for suf in ("en", "n", "e", "es", "er", "em", "s", "t", "st"):
        if k.endswith(suf) and len(k) - len(suf) >= 3:
            stem = k[:-len(suf)]
            for cand in (stem, stem + "e", stem + "en"):
                if cand in d:
                    return d[cand]
                for de, ru in d.items():
                    if de.startswith(("der ", "die ", "das ")) and de[4:] == cand:
                        return (de, ru)
    return None


def _put(out, de, ru):
    if not de or not ru:
        return
    k = key_of(de)
    out.setdefault(k, (de, ru))
    bare = re.sub(r"^(der|die|das)\s+", "", de, flags=re.I)
    if bare != de:
        out.setdefault(key_of(bare), (de, ru))


# --------------------------------------------------------------------------- #
#  Внешние источники
# --------------------------------------------------------------------------- #
def _get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "DeutschQuest/1.0 (local study app)"})
    with urllib.request.urlopen(req, timeout=NET_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def _mymemory(text, src="de", dst="ru"):
    q = urllib.parse.urlencode({"q": text, "langpair": "%s|%s" % (src, dst)})
    data = _get_json("https://api.mymemory.translated.net/get?" + q)
    resp = (data or {}).get("responseData") or {}
    tr = (resp.get("translatedText") or "").strip()
    if not tr or tr.lower() == text.lower():
        return None
    if "MYMEMORY WARNING" in tr.upper():
        return None
    return tr


def _wiktionary(word):
    """Русский перевод из немецкого Викисловаря.

    Формат статьи: строка словаря = `*{{ru}}: {{Üt|ru|бежать}}, {{Üt|ru|идти}}`
    (иногда ссылки `[[бежать]]`). Берём все такие строки из всего wikitext.
    Статья-заголовок — с большой буквы (Hund), но глаголы с маленькой.
    """
    found = []
    for title in dict.fromkeys([word.strip()[:1].upper() + word.strip()[1:], word.strip().lower()]):
        text = _wikitext(title)
        if not text:
            continue
        for line in text.splitlines():
            s = line.strip()
            if not s.startswith("*") or "{{ru" not in s:
                continue
            m = re.match(r"\*+\s*\{\{\s*ru\s*\}\}\s*:\s*(.+)$", s)
            if not m:
                continue
            for item in re.split(r"[,;]", m.group(1)):
                um = re.search(r"\{\{\s*Üt?\s*\|\s*ru\s*\|([^}|]+)", item)
                val = um.group(1) if um else item
                val = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", val)
                val = re.sub(r"\[\[([^\]]+)\]\]", r"\1", val)
                val = re.sub(r"\{\{[^}]*\}\}", "", val)
                val = re.sub(r"<[^>]+>", "", val).strip(" \t.*\u00a0")
                if val and re.search(r"[А-Яа-яЁё]", val) and len(val) < 40:
                    found.append(val)
        if found:
            break
    if not found:
        return None
    return "; ".join(dict.fromkeys(found[:4]))


def _wikitext(title):
    url = ("https://de.wiktionary.org/w/api.php?action=parse&format=json&prop=wikitext"
           "&redirects=1&page=" + urllib.parse.quote(title))
    try:
        data = _get_json(url)
    except Exception:
        return ""
    return ((data or {}).get("parse") or {}).get("wikitext", {}).get("*") or ""


def _lemma_candidates(word):
    w = (word or "").strip()
    if not w:
        return
    yield w
    low = w.lower()
    for suf, rep in (("en", ""), ("n", ""), ("e", ""), ("s", ""), ("es", ""),
                     ("er", ""), ("em", ""), ("st", ""), ("t", "")):
        if low.endswith(suf) and len(low) - len(suf) >= 3:
            yield low[:-len(suf)] + rep


def _plausible_word_translation(tr, src):
    """Похож ли ответ MyMemory на перевод ОДНОГО слова.

    Переводчик часто возвращает целую фразу («Сколько это стоит» на
    «Entschuldigung») — такое на карточке подставлять нельзя.
    """
    tr = (tr or "").strip(" \t.\"'")
    if not tr or not re.search(r"[А-Яа-яЁё]", tr):
        return False
    # длинные пояснения и предложения — не перевод слова
    if len(tr) > max(24, len(src) * 3 + 10):
        return False
    if any(ch in tr for ch in ".!?;:—") and tr.count(" ") >= 2:
        return False
    # больше 3 слов в переводе односложного слова — почти всегда мусор
    if len(src.split()) == 1 and len(tr.split()) > 3:
        return False
    return True


# --------------------------------------------------------------------------- #
#  Публичный API модуля
# --------------------------------------------------------------------------- #
def lookup(text, kind="word", allow_net=True, save=True):
    """Перевод слова/фразы. Возвращает dict или None.

    {text, kind, ru, source ("dict"|"wiktionary"|"mymemory"|"user"), lemma}
    """
    text = re.sub(r"\s+", " ", str(text or "")).strip(" \t\n.,!?;:\"'„“”()[]")
    if not text:
        return None
    kind = "phrase" if (kind == "phrase" or " " in text) else "word"
    if kind == "word" and len(text) > MAX_WORD:
        return None
    if kind == "phrase" and len(text) > MAX_PHRASE:
        return None

    ck = (kind, key_of(text))
    with _LOCK:
        if ck in _CACHE:
            return _CACHE[ck]

    result = None

    # 1) файл пользователя — самым первым: он же и «история нажатий»
    user = load_user_words()
    bucket = user[kind + "s"]
    saved = bucket.get(ck[1])
    # в файле перевод мог НЕ найтись в прошлый раз — это не повод не искать снова
    if saved and saved.get("ru"):
        result = dict(saved, source=saved.get("source") or "user", cached=True)

    # 2) свои словари — ВСЕГДА раньше сети (в них ровные, проверенные переводы)
    if result is None:
        hit = _dict_find(text)
        if hit:
            result = {"text": hit[0], "kind": kind, "ru": hit[1], "source": "dict", "lemma": hit[0]}

    # 3) сеть
    if result is None and allow_net:
        if kind == "phrase":
            try:
                tr = _mymemory(text)
            except Exception:
                tr = None
            if tr and re.search(r"[А-Яа-яЁё]", tr):
                result = {"text": text, "kind": kind, "ru": tr, "source": "mymemory", "lemma": text}
        else:
            # слова ищем в двух источниках ПАРАЛЛЕЛЬНО (медленная сеть не тормозит карточку)
            with ThreadPoolExecutor(max_workers=2) as pool:
                f_wiki = pool.submit(_wiktionary, text)
                f_mm = pool.submit(_mymemory, text)
                ru = None
                try:
                    ru = f_wiki.result(timeout=NET_TIMEOUT + 2)
                except Exception:
                    ru = None
                if ru:
                    result = {"text": text, "kind": kind, "ru": ru, "source": "wiktionary", "lemma": text}
                else:
                    try:
                        tr = f_mm.result(timeout=NET_TIMEOUT + 2)
                    except Exception:
                        tr = None
                    # MyMemory на отдельном слове часто отдаёт случайную фразу
                    # («Entschuldigung» → «Сколько это стоит»). Для одного слова
                    # принимаем ответ ТОЛЬКО если он короткий и без лишних слов.
                    if tr and _plausible_word_translation(tr, text):
                        result = {"text": text, "kind": kind, "ru": tr, "source": "mymemory", "lemma": text}

    # 4) записываем в файл (и найденное в сети, и «нажал, но не нашли»)
    if save:
        now = time.strftime("%Y-%m-%dT%H:%M:%S")
        with _LOCK:
            data = load_user_words()
            b = data[kind + "s"]
            prev = b.get(ck[1]) or {}
            entry = dict(prev)
            entry.setdefault("text", text)
            entry["hits"] = int(prev.get("hits") or 0) + 1
            entry["last"] = now
            entry.setdefault("first", prev.get("first") or now)
            if result:
                entry["ru"] = result["ru"]
                entry["source"] = result["source"]
                if result.get("lemma"):
                    entry["lemma"] = result["lemma"]
            else:
                entry.setdefault("ru", "")
                entry.setdefault("source", "none")
            entry["kind"] = kind
            b[ck[1]] = entry
            save_user_words(data)
        if result is None:
            # «не нашли» тоже кэшируем в памяти, чтобы не долбить сеть каждым кликом
            _CACHE[ck] = None
            return None
        result["hits"] = entry["hits"]

    with _LOCK:
        _CACHE[ck] = result
    return result


def lookup_back(text, kind="word", allow_net=True, save=True):
    """Обратный перевод: русский текст → немецкий.

    Возвращает {text, kind, de, ru, source ("dict"|"mymemory"), lemma}
    (в отличие от lookup, готовый ответ лежит в поле «de»).
    Сами нажатия всё равно пишутся в user_words.json — как и в прямой стороне.
    """
    text = re.sub(r"\s+", " ", str(text or "")).strip(" \t\n.,!?;:\"'„“”()[]")
    if not text:
        return None
    kind = "phrase" if (kind == "phrase" or " " in text) else "word"
    if kind == "word" and len(text) > MAX_WORD:
        return None
    if kind == "phrase" and len(text) > MAX_PHRASE:
        return None

    ck = ("back", kind, key_of(text))
    with _LOCK:
        if ck in _CACHE:
            return _CACHE[ck]

    result = None
    # 1) свои словари (обратный индекс)
    hit = _rdict().get(key_of(text))
    if hit:
        result = {"text": text, "kind": kind, "de": hit[0], "ru": hit[1],
                  "source": "dict", "lemma": hit[0]}

    # 2) сеть — только для фраз (по словам словаря почти всегда есть)
    if result is None and allow_net:
        try:
            tr = _mymemory(text, "ru", "de")
        except Exception:
            tr = None
        if tr and re.search(r"[A-Za-zÄÖÜäöüß]", tr):
            result = {"text": text, "kind": kind, "de": tr, "ru": text,
                      "source": "mymemory", "lemma": tr}

    # 3) запоминаем нажатие (обе стороны живут в одном файле)
    if save:
        with _LOCK:
            data = load_user_words()
            b = data[kind + "s"]
            entry = dict(b.get(ck[2]) or {})
            entry.setdefault("text", text)
            entry["hits"] = int(entry.get("hits") or 0) + 1
            entry["last"] = time.strftime("%Y-%m-%dT%H:%M:%S")
            entry.setdefault("first", entry["last"])
            entry["kind"] = kind
            entry.setdefault("ru", "")
            entry.setdefault("source", "none")
            b[ck[2]] = entry
            save_user_words(data)

    with _LOCK:
        _CACHE[ck] = result
    return result


def history(kind=None, limit=500):
    """Нажатые слова/фразы — для экрана «Мои слова»."""
    data = load_user_words()
    out = []
    for bucket, k in (("words", "word"), ("phrases", "phrase")):
        if kind and kind != k:
            continue
        for key, e in (data.get(bucket) or {}).items():
            if not isinstance(e, dict):
                continue
            out.append({
                "key": key, "kind": k,
                "text": e.get("text") or key,
                "ru": e.get("ru") or "",
                "source": e.get("source") or "",
                "hits": int(e.get("hits") or 0),
                "last": e.get("last") or "",
                "learned": bool(e.get("learned")),
            })
    out.sort(key=lambda x: x["last"], reverse=True)
    return out[:limit]


def mark_learned(key, value=True):
    data = load_user_words()
    for bucket in ("words", "phrases"):
        if key in data.get(bucket):
            data[bucket][key]["learned"] = bool(value)
            save_user_words(data)
            return True
    return False


def forget(key):
    data = load_user_words()
    removed = False
    for bucket in ("words", "phrases"):
        if key in data.get(bucket):
            del data[bucket][key]
            removed = True
    if removed:
        save_user_words(data)
        with _LOCK:
            for k in list(_CACHE):
                if k[1] == key:
                    _CACHE.pop(k, None)
    return removed


def stats():
    data = load_user_words()
    words = [e for e in (data.get("words") or {}).values() if isinstance(e, dict)]
    phrases = [e for e in (data.get("phrases") or {}).values() if isinstance(e, dict)]
    return {
        "words": len(words),
        "phrases": len(phrases),
        "learned": sum(1 for e in words + phrases if e.get("learned")),
        "withTranslation": sum(1 for e in words + phrases if e.get("ru")),
    }
