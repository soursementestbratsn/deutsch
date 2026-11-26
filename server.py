# обновлять agents.md
# -*- coding: utf-8 -*-
"""
Deutsch Quest — веб-версия (локальный сервер).

    python server.py            → http://127.0.0.1:8000/
    python server.py --port 9000 --no-browser

Интерфейс — статические файлы web/ (HTML + CSS + JS), запускается в браузере.
Сервер нужен только для чтения словарей (words.txt, phrases.txt, numbers.txt)
и сохранения прогресса (de_lernen_stats.json). Внешних зависимостей нет.
"""
import argparse
import ast
import json
import os
import re
import sys
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote, parse_qs

from dq.core import (BASE_DIR, WORDS_FILE, PHRASES_FILE, NUMBERS_FILE,
                     load_words_with_groups, load_data_from_file, load_stats, save_stats,
                     number_to_german, number_to_russian_text, phone_to_german,
                     random_phone)
from dq import phonetics
from dq import translate as tr
from dq import word_photos as photos
from dq.media import neural_path_for

# наша система версий (scripts/backup.py) — не должна ломать сайт, если её нет
try:
    import sys as _sys
    _sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))
    import backup as _bak
    from server_backups import _html_page, _render_versions_list, _render_version_detail
except Exception:          # pragma: no cover
    _bak = None
    _html_page = _render_versions_list = _render_version_detail = None

# --- Auth config ---
# Secret token for remote access to /backups and /stats (set via env var)
# If not set, only localhost/127.0.0.1 can access these endpoints
ADMIN_TOKEN = os.environ.get("DEUTSCH_QUEST_ADMIN_TOKEN", "")
# Stats file per user: content/de_lernen_stats_<user>.json
STATS_DIR = os.path.join(BASE_DIR, "content")

WEB_DIR = os.path.join(BASE_DIR, "web")
IMAGES_DIR = os.path.join(BASE_DIR, "images")
WORKSHEETS_DIR = os.path.join(BASE_DIR, "worksheets")

# mp3 из audio_cache — «живой» голос для слов (браузерный синтез — запасной вариант)
AUDIO_DIR = os.path.join(BASE_DIR, "audio_cache")
NEURAL_DIR = os.path.join(AUDIO_DIR, "neural")


# Первый блок words.txt называется «Все» — в интерфейсе зовём его понятнее.
CORE_GROUP = "Основные слова"


def _num_word(n):
    """1001 → «eintausendeins» (без пробела после tausend — как в numbers.txt)."""
    return number_to_german(n).replace(" tausend", "tausend")


def number_pair(n):
    ru = str(n)
    if n >= 1000:
        ru = number_to_russian_text(n)
    return (_num_word(n), ru)


# --------------------------------------------------------------------------- #
#  ДАННЫЕ
# --------------------------------------------------------------------------- #
def _short_title(name):
    """«Здания и городские объекты (Gebäude und Orte in der Stadt)» → «Здания и городские объекты»."""
    short = re.sub(r"\s*\([^)]*\)\s*$", "", name).strip()
    return short or name


def _make_key(title):
    """Короткий стабильный ключ группы: 'w:werkzeuge', 'w:godz'…

    Ключ НЕ зависит от полного текста заголовка, поэтому правка словаря
    (или переименование «(Werkzeuge)» → «») не теряет выбор пользователя.
    """
    table = str.maketrans({"ä": "a", "ö": "o", "ü": "u", "ß": "ss"})
    slug = title.lower().translate(table)
    slug = re.sub(r"[^\w\s-]", "", slug, flags=re.UNICODE)
    slug = re.sub(r"[\s+]+", "_", slug).strip("_")
    return "w:" + (slug[:48] or "group")


def _words_grouped():
    grouped = load_words_with_groups(WORDS_FILE)
    out = {}
    for name, items in grouped.items():
        if not items:
            continue  # заглушка «Все» без содержимого не нужна
        title = CORE_GROUP if name == "Все" else _short_title(name)
        out.setdefault(title, []).extend(items)
    return out


def _all_word_groups():
    return {_make_key(title): title for title in _words_grouped()}


def _stats():
    stats = load_stats()
    # чистим мусорные ключи, но сохраняем всё, что умеет панель настроек
    # (иначе стекло/голос/цели и все новые переключатели молча терялись при загрузке)
    ui = stats.get("ui")
    if isinstance(ui, dict):
        allowed_ui = {
            # вид
            "theme", "accent", "backdrop", "density", "motion", "glass",
            "fontSize", "radius", "reduceGlow", "compactSidebar", "highContrast",
            "glassDepth", "lightAngle", "chromatic", "shapeMorph", "accentGlow", "glassTint", "parallax", "highContrastGlass",
            # озвучка
            "soundTone", "confetti", "answerGlow", "haptics",
            "serverVoice", "voiceGender", "voiceRate", "autoSay", "showPron",
            "showPronAnswer", "readRu", "slowFirstAnswer", "pronBrowse",
            # учёба
            "noRepeat", "tolerance", "srs", "autoNext", "dailyGoal", "sessionGoal",
            "typoStreakFreeze", "showArticle", "showPlural", "showRelated",
            "nlGerman", "wordOfDay", "gamify", "smartRepeat", "srsCap",
            "goalLevel", "studyTimer", "focusMusic", "breakReminder",
            "mistakeOnly", "reverseOnMistake", "autoCards", "shadowing",
            "typingPractice", "greeting",
            # словари и фото слов
            "articles", "wordPhotos", "photoMax",
# звук
            "sound", "soundVolume", "soundEffects",
            "soundTone", "confetti", "answerGlow", "haptics",
        }
        stats["ui"] = {k: v for k, v in ui.items() if k in allowed_ui}
    all_keys = [g[0] for g in build_groups()]
    saved = stats.get("enabled_groups")
    valid = []
    if isinstance(saved, list):
        titles = _all_word_groups()
        for key in saved:
            if key in all_keys:
                valid.append(key)
            elif isinstance(key, str) and key.startswith("w:"):
                # старый ключ с полным заголовком → новый короткий ключ
                legacy = key[2:]
                for t in titles.values():
                    if t == legacy or t == _short_title(legacy) or _make_key(t) == key:
                        valid.append(_make_key(t))
                        break
    valid = list(dict.fromkeys(valid))
    stats["enabled_groups"] = valid
    words = stats.get("enabled_words")
    if words is None:
        words = []
    elif not isinstance(words, list):
        words = []
    words = [str(w) for w in words if isinstance(w, str) and w.strip()][:2000]
    stats["enabled_words"] = words
    # нет сохранённого выбора — интерфейс один раз предложит отметить группы
    stats["needs_choice"] = not bool(valid) and not bool(words)
    return stats


# --- Auth helpers ---
def _client_ip(handler):
    """Get client IP from request."""
    # Check X-Forwarded-For header (Fly.io proxy)
    forwarded = handler.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return handler.client_address[0]


def _is_local_request(handler):
    """Check if request is from localhost."""
    ip = _client_ip(handler)
    return ip in ("127.0.0.1", "::1", "localhost")


def _check_admin_auth(handler):
    """Check if request is authorized for admin endpoints (/backups, /stats).
    Allows: localhost, or valid admin token in Authorization header or ?token= query.
    """
    if _is_local_request(handler):
        return True
    if not ADMIN_TOKEN:
        return False  # No token configured, only localhost allowed
    # Check Authorization: Bearer <token>
    auth = handler.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:].strip()
        if token == ADMIN_TOKEN:
            return True
    # Check ?token= query param
    qs = parse_qs(urlparse(handler.path).query)
    token = (qs.get("token") or [""])[0]
    if token == ADMIN_TOKEN:
        return True
    return False


def _send_unauthorized(handler):
    """Send 401 Unauthorized response."""
    handler.send_response(401)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("WWW-Authenticate", 'Bearer realm="Deutsch Quest Admin"')
    handler.end_headers()
    handler.wfile.write(json.dumps({"error": "Unauthorized", "message": "Admin access required. Provide token via Authorization header or ?token= query."}).encode("utf-8"))


# --- Per-user stats ---
def _get_user_id(handler):
    """Extract user ID from request (session cookie, header, or IP fallback)."""
    # Check X-User-ID header (set by frontend after login)
    user_id = handler.headers.get("X-User-ID")
    if user_id:
        return user_id
    # Check cookie
    cookie = handler.headers.get("Cookie", "")
    for part in cookie.split(";"):
        part = part.strip()
        if part.startswith("dq_user="):
            return part[8:]
    # Fallback: use IP-based hash for anonymous users
    ip = _client_ip(handler)
    import hashlib
    return "anon_" + hashlib.md5(ip.encode()).hexdigest()[:12]


def _stats_file_for_user(user_id):
    """Get stats file path for a user."""
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "_", user_id)
    return os.path.join(STATS_DIR, f"de_lernen_stats_{safe_id}.json")


def _load_user_stats(user_id):
    """Load stats for a specific user."""
    path = _stats_file_for_user(user_id)
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    # Migrate from legacy stats file if this is a new user
    from dq.core import load_stats, DEFAULT_STATS
    legacy_stats = load_stats()
    if legacy_stats and (legacy_stats.get("answered", 0) > 0 or legacy_stats.get("xp", 0) > 0 or legacy_stats.get("enabled_groups")):
        # Only migrate if legacy has meaningful data
        migrated = dict(legacy_stats)
        # Save as new user stats
        _save_user_stats(user_id, migrated)
        return migrated
    # Return default stats structure
    return dict(DEFAULT_STATS)


def _save_user_stats(user_id, stats):
    """Save stats for a specific user."""
    path = _stats_file_for_user(user_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)


def _stats():
    """Legacy function - loads stats for the default user (backwards compat)."""
    # For backwards compatibility, use the default stats file
    from dq.core import load_stats
    return load_stats()


def build_groups():
    """Список групп: (key, label, hint, items)."""
    groups = []
    for title, items in _words_grouped().items():
        key = _make_key(title)
        groups.append((key, title, f"{len(items)} слов", items))

    numbers = [(word, num) for num, word in load_data_from_file(NUMBERS_FILE)
               if num.isdigit()]
    if numbers:
        groups.append(("Числа", "Числа", f"{len(numbers)} чисел · 1…10 000", numbers))

    pairs = load_data_from_file(PHRASES_FILE)
    if pairs:
        groups.append(("Школьные фразы", "Школьные фразы", f"{len(pairs)} фраз", pairs))

    groups.append(("Телефоны", "Телефоны", "случайные номера", [("_", "_")]))
    return groups





def _random_numbers(count=40):
    import random
    rng = random.Random()
    return [number_pair(n) for n in (rng.randint(1, 9999) for _ in range(count))]


def _random_phones(count=8):
    import random
    rng = random.Random()
    out = []
    for _ in range(count):
        raw = random_phone(rng)
        out.append((phone_to_german(raw), raw))
    return out


def _pairs_for_keys(keys, limit=20, due_only=False):
    """Случайно перемешанные пары из выбранных групп (мультивыбор).

    Порядок «по кругу»: каждая выбранная группа представлена равномерно.
    Числа и телефоны — отдельные виды вопросов, их варианты ответа не должны
    смешиваться (иначе в вопросе-числе все варианты — телефоны).
    """
    import random
    rng = random.Random()
    groups = {g[0]: g for g in build_groups()}
    due = set((_stats().get("srs") or {}).get("due") or []) if due_only else None
    buckets = []
    for key in keys:
        group = groups.get(key)
        if not group:
            continue
        items = [] if key == "Телефоны" else list(group[3])
        if due:
            items = [p for p in items if p[0] in due]
            if not items:
                continue
        if key == "Числа":
            items += _random_numbers(30)
        elif key == "Телефоны":
            items = _random_phones(8)
        if items:
            buckets.append(items)
    if not buckets:
        return []
    rounds = (limit + len(buckets) - 1) // len(buckets)
    pool = []
    for _ in range(rounds):
        order = buckets[:]
        rng.shuffle(order)
        for items in order:
            pool.append(rng.choice(items))
    rng.shuffle(pool)

    # не показывать один и тот же вопрос два раза подряд
    for i in range(1, len(pool)):
        if pool[i] == pool[i - 1]:
            for j in range(i + 1, len(pool)):
                if pool[j] != pool[i]:
                    pool[i], pool[j] = pool[j], pool[i]
                    break
    return pool[:limit]


def _due_counts(groups, stats_):
    """Сколько вопросов в каждой группе пора повторить (интервальное повторение)."""
    due = set((stats_.get("srs") or {}).get("due") or [])
    if not due:
        return {}
    out = {}
    for key, _label, _hint, items in groups:
        n = sum(1 for de, _ru in items if de in due)
        if n:
            out[key] = n
    return out


def build_api(user_id=None):
    if user_id is None:
        stats_ = _stats()
    else:
        stats_ = _load_user_stats(user_id)
    groups = []
    all_groups = build_groups()
    due = _due_counts(all_groups, stats_)
    for key, label, hint, items in all_groups:
        if key == "Числа":
            hint = f"{len(items)} чисел · 1…10 000 + случайные"
        groups.append({"key": key, "label": label, "hint": hint, "count": len(items),
                       "due": due.get(key, 0)})
    return {"groups": groups, "stats": stats_, "dueTotal": sum(due.values()),
            "pron": {"words": len(phonetics._load())},
            "photos": photos.map()}


# --------------------------------------------------------------------------- #
#  ФОТО К СЛОВАМ (content/word_photos/ + content/word_photos.json)
#
#  Пользователь кидает картинку и выбирает слово — фото показывается везде,
#  где встречается это слово (тренажёр, список, «Мои слова», карточки).
#  Нужен pillow для ресайза; без него файл всё равно сохраняется как есть.
# --------------------------------------------------------------------------- #
def _vocab_index():
    """Все слова из словаря: {ключ: {de, ru, group, groupKey}}.

    Ключ — немецкая часть без артикля в нижнем регистре: «das Haus» и
    «Haus» — одно и то же слово (фото привязывается к слову, а не к варианту).
    """
    from dq.word_photos import slot
    out = {}
    for key, label, _hint, items in build_groups():
        if key in ("Числа", "Телефоны"):
            continue
        for de, ru in items:
            k = slot(de)
            if not k:
                continue
            cur = out.get(k)
            if cur is None:
                out[k] = {"de": de, "ru": ru, "group": label, "groupKey": key}
    return out


def _vocab_payload():
    idx = _vocab_index()
    groups = {}
    for key, label, hint, items in build_groups():
        if key in ("Числа", "Телефоны"):
            continue
        groups[key] = {"label": label, "hint": hint}
    return {"words": list(idx.values()), "groups": groups,
            "photos": photos.map(), "stats": {"total": len(idx)}}


def _pairs_for_words(words, limit=800):
    """Пары только из выбранных слов (поиск по всем группам словаря)."""
    from dq.word_photos import slot
    wanted = set()
    for w in words or []:
        s = slot(str(w))
        if s:
            wanted.add(s)
    if not wanted:
        return []
    out = []
    seen = set()
    for _key, _label, _hint, items in build_groups():
        for de, ru in items:
            s = slot(de)
            if s in wanted and s not in seen:
                seen.add(s)
                out.append((de, ru))
    import random
    random.Random().shuffle(out)
    return out[:limit]


import base64 as _b64


def handle_photo(data):
    """Сохранить фото к слову. data — base64 (data:image/...;base64,... или голый)."""
    word = str(data.get("word") or "").strip()
    raw = data.get("data") or data.get("image") or ""
    if not word:
        return {"ok": False, "error": "не указано слово"}
    if not isinstance(raw, str) or not raw:
        return {"ok": False, "error": "нет картинки"}
    m = re.match(r"^data:image/[\w.+-]+;base64,(.*)$", raw, re.S)
    if m:
        raw = m.group(1)
    try:
        blob = _b64.b64decode(raw, validate=False)
    except Exception:
        return {"ok": False, "error": "битая картинка"}
    if len(blob) < 100:
        return {"ok": False, "error": "файл пустой"}
    try:
        entry = photos.save(word, blob)
    except Exception as exc:
        print("  ! фото:", exc, file=sys.stderr)
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "photo": entry, "photos": photos.map()}


# --------------------------------------------------------------------------- #
#  ЗАДАНИЯ / ТЕСТЫ (worksheets/*.json)
#
#  Один файл — один набор занятий. Внутри: метаданные + список вариантов,
#  каждый вариант — словарик и список заданий. Тип задания отвечает только
#  за вид упражнения; новые наборы добавляются простым копированием JSON.
# --------------------------------------------------------------------------- #
def _worksheet_files():
    if not os.path.isdir(WORKSHEETS_DIR):
        return []
    return sorted(os.path.join(WORKSHEETS_DIR, n) for n in os.listdir(WORKSHEETS_DIR)
                  if n.endswith(".json"))


def _load_worksheet(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        print(f"  ! задание {os.path.basename(path)} не прочитано: {exc}", file=sys.stderr)
        return None
    if not isinstance(data, dict):
        return None
    # В файле либо задания (variants), либо таблицы (sections)
    if not data.get("variants") and not data.get("sections"):
        print(f"  ! в {os.path.basename(path)} нет ни variants, ни sections", file=sys.stderr)
        return None
    data.setdefault("variants", [])
    data.setdefault("id", os.path.splitext(os.path.basename(path))[0])
    data.setdefault("title", data["id"])
    data.setdefault("level", "A1–A2")
    data.setdefault("subtitle", "")
    data.setdefault("order", 100)
    for v in data["variants"]:
        v.setdefault("name", "Вариант")
        v.setdefault("vocab", [])
        v.setdefault("tasks", [])
    return data


def worksheets_index():
    """Все наборы + краткое описание (без заданий — быстро отдать на клиент)."""
    out = []
    # персональный лист ошибок собирается на лету (web/ideas.js → «Моя контрольная»)
    try:
        personal = personal_worksheet()
        if personal:
            out.append(_ws_summary(personal))
    except Exception as exc:
        print("  ! персональный лист:", exc, file=sys.stderr)
    for path in _worksheet_files():
        data = _load_worksheet(path)
        if not data:
            continue
        if not data["variants"]:
            continue   # справочные таблицы — не задание, в каталог не попадают
        out.append(_ws_summary(data))
    out.sort(key=lambda w: (w["order"], w["title"]))
    return out


def _ws_summary(data):
    return {
        "id": data["id"], "title": data["title"], "level": data["level"],
        "subtitle": data["subtitle"], "order": data["order"],
        "variantCount": len(data["variants"]),
        "taskCount": sum(len(v["tasks"]) for v in data["variants"]),
        "vocabCount": sum(len(v["vocab"]) for v in data["variants"]),
        # шпаргалка набора — доступна ещё на экране каталога (web/worksheets.js)
        "globalHelp": data.get("globalHelp") if isinstance(data.get("globalHelp"), dict) else None,
    }


def personal_worksheet():
    """Идея «Моя контрольная»: 10 заданий из ошибок и слов в повторении.

    Собирается из de_lernen_stats.json, никаких файлов не пишет — просто
    ещё один набор в каталоге заданий, который сам обновляется каждую сессию.
    """
    stats = _stats()
    mistakes = stats.get("mistakes") if isinstance(stats.get("mistakes"), list) else []
    box = (stats.get("srs") or {}).get("box") or {}
    # Ошибка в файле могла сохраниться строкой ('[\'der Fluss\', \'река\']'),
    # а не парой: раньше такие записи валили весь список заданий.
    def _pair(m):
        if isinstance(m, dict):
            return (m.get("de") or "", m.get("ru") or "")
        if isinstance(m, (list, tuple)) and len(m) >= 2:
            return (m[0] or "", m[1] or "")
        if isinstance(m, str):
            try:
                v = ast.literal_eval(m)
            except (ValueError, SyntaxError):
                return ("", "")
            if isinstance(v, (list, tuple)) and len(v) >= 2:
                return (str(v[0] or ""), str(v[1] or ""))
        return ("", "")

    ru = {_pair(m)[0]: _pair(m)[1] for m in mistakes if _pair(m)[0] and _pair(m)[1]}
    pool = []
    seen = set()
    for m in reversed(mistakes):
        de = _pair(m)[0]
        if de and de not in seen:
            seen.add(de)
            pool.append(de)
    for de, b in box.items():
        if de not in seen and isinstance(b, dict) and (b.get("b") or 0) < 2:
            seen.add(de)
            pool.append(de)
    pool = pool[:12]
    if len(pool) < 3:
        return None

    words = load_words_with_groups(WORDS_FILE)
    meaning = {de: r for arr in words.values() for de, r in arr}
    tasks = []
    for de in pool:
        kinds = [k for k in ("der", "die", "das") if de.startswith(k + " ")]
        if kinds:
            clean = de[len(kinds[0]) + 1:]
            tasks.append({"type": "choice", "q": f"Артикль к «{clean}»",
                          "options": ["der", "die", "das"], "answer": kinds[0]})
        else:
            tr_ru = ru.get(de) or meaning.get(de) or ""
            if not tr_ru:
                continue
            tasks.append({"type": "sentence", "q": f"Напишите по-немецки: {tr_ru}",
                          "prefix": "", "answer": de})
    if not tasks:
        return None
    return {
        "id": "moi-oshibki",
        "title": "Моя контрольная (10 ошибок)",
        "subtitle": "Собрано из ваших ошибок и слов в повторении — обновляется само",
        "level": "A1–B1", "order": 1,
        "variants": [{"name": "Сегодняшний набор", "vocab": [], "tasks": tasks}],
    }


def worksheet_by_id(wid):
    if wid == "moi-oshibki":
        return personal_worksheet()   # персональный лист — генерируется на лету
    for path in _worksheet_files():
        data = _load_worksheet(path)
        if data and data["id"] == wid:
            return data
    return None


def handle_worksheet_result(payload, user_id):
    """Итог проверки задания: прогресс + XP (как за обычную тренировку)."""
    stats = _load_user_stats(user_id)
    ws = stats.setdefault("worksheets", {})
    wid = str(payload.get("id") or "")
    vidx = str(payload.get("variant", 0))
    if not wid:
        return {"ok": False, "stats": stats}
    try:
        total = int(payload.get("total") or 0)
        correct = int(payload.get("correct") or 0)
    except (TypeError, ValueError):
        total = correct = 0
    prev = ws.get(wid) if isinstance(ws.get(wid), dict) else {}
    best = max(int(prev.get("best") or 0), correct)
    ws[wid] = {"best": best, "total": total,
               "attempts": int(prev.get("attempts") or 0) + 1,
               "last": {vidx: correct}, "last_day": time.strftime("%Y-%m-%d")}
    if total:
        stats["xp"] = int(stats.get("xp") or 0) + correct * 2
    _save_user_stats(user_id, stats)
    return {"ok": True, "stats": stats}


# --------------------------------------------------------------------------- #
#  ПРОИЗНОШЕНИЕ (IPA, слоги, русская транскрипция)
# --------------------------------------------------------------------------- #
_PRON_CACHE = {}
_PRON_LOCK = threading.Lock()


def pron_entry(word):
    """Карточка произношения слова (с кэшем — считается по правилам, если нет словаря)."""
    key = str(word or "").strip().lower()
    if not key:
        return None
    with _PRON_LOCK:
        hit = _PRON_CACHE.get(key)
    if hit is not None:
        return hit
    d = phonetics.describe(word)
    if not d.get("ipa"):
        return None
    with _PRON_LOCK:
        _PRON_CACHE[key] = d
    return d


def handle_pron(payload, user_id):
    words = payload.get("words")
    if not isinstance(words, list):
        words = []
    out = {}
    for w in words[:200]:
        d = pron_entry(w)
        if d:
            out[str(w).strip().lower()] = d
    return {"words": out}


def audio_file_for(text, lang="de"):
    """Путь к mp3 в audio_cache. Слова с артиклем ищутся и без него:
    «der Strom» → кэш по «Strom» (так озвучка не дублируется).
    """
    from dq.core import get_audio_id, CACHE_DIR
    text = str(text).strip().lower()
    keys = ["%s_%s" % (lang, text)]
    first = text.split()
    if len(first) == 2 and first[0] in ("der", "die", "das", "ein", "eine"):
        keys.append("%s_%s" % (lang, first[1]))
    for key in keys:
        path = os.path.join(CACHE_DIR, get_audio_id(key) + ".mp3")
        if os.path.isfile(path):
            return path
    return None


def handle_save(payload, user_id):
    stats = _load_user_stats(user_id)
    allowed = {
        "answered": int, "correct": int, "best_streak": int, "xp": int,
        "daily_answers": int, "session_goal": int, "daily_goal": int,
        "theme": str, "accent": str, "enabled_groups": list, "mode": str,
        "input_type": str, "direction": str, "needs_choice": bool,
        "typing_lang": str, "typing_source": str, "sentence_distractors": bool,
        "ui": dict, "worksheets": dict, "games": dict, "history": dict,
        "words": dict, "srs": dict, "goals_day": str, "review_target": int,
        # ошибки и «мои слова» — раньше терялись при сохранении
        "mistakes": list, "favorites": list, "history": dict,
        # словарь: какие слова спрашивать вместо целых групп (пустой список = все)
        "enabled_words": list,
        # голосовые настройки (source: "voiceGender", "voiceVariant")
        "voiceGender": str, "voiceVariant": str,
    }
    for key, typ in allowed.items():
        if key not in payload:
            continue
        value = payload[key]
        try:
            if typ is bool:
                value = bool(value)
            elif typ is int:
                value = int(value)
            elif typ is list:
                if not isinstance(value, list):
                    continue
                value = [str(v) for v in value]
            elif typ is dict:
                if not isinstance(value, dict):
                    continue
            else:
                value = str(value)
        except (TypeError, ValueError):
            continue
        stats[key] = value
    _save_user_stats(user_id, stats)
    return {"ok": True, "stats": stats}


def handle_reset(user_id):
    stats = _load_user_stats(user_id)
    stats.update({"answered": 0, "correct": 0, "best_streak": 0, "xp": 0,
                  "daily_answers": 0})
    _save_user_stats(user_id, stats)
    return {"ok": True, "stats": stats}


# --------------------------------------------------------------------------- #
#  HTTP
# --------------------------------------------------------------------------- #
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def log_message(self, fmt, *args):
        if "404" in (fmt % args) or "tts" in str(args[0] if args else "").lower():
            sys.stderr.write("  ! %s\n" % (fmt % args))

    # -------------------------------------------------------------- #
    def _json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    protocol_version = "HTTP/1.1"   # keep-alive: 10 файлов не переподключаются каждый раз

    def end_headers(self):
        # статика кэшируется надолго (в URL есть ?v=), HTML — всегда свежий
        path = getattr(self, 'path', '')
        if path:
            path = unquote(urlparse(path).path)
        else:
            path = ''
        if path.startswith("/api/"):
            cache = None
        elif path.endswith(".html") or path in ("/", "/dq"):
            cache = "no-cache"
        elif path.endswith(".js") or path.endswith(".css"):
            cache = "no-cache"
        else:
            cache = "public, max-age=86400"
        if cache:
            self.send_header("Cache-Control", cache)
        super().end_headers()

    # Без `; charset=utf-8`: иначе mimetypes не узнаёт расширение и отдаёт
    # JS как text/plain — браузер тогда не исполняет новый файл.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
    }

    def guess_type(self, path):
        """Отдаём все текстовые файлы как UTF-8 (кириллица иначе ломается)."""
        ext = os.path.splitext(str(path))[1].lower()
        for known, mime in self.extensions_map.items():
            if known == ext:
                return mime
        return super().guess_type(path)

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            return json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return {}

    def send_head(self):
        """Статика с ?v=12 (версия для кэша) — файл всё равно ищем по чистому имени.

        SimpleHTTPRequestHandler берёт self.path ЦЕЛИКОМ (с query), поэтому
        /theme.js?v=52 превращался в «файл theme.js?v=52» → 404, и ни один
        модуль (theme/settings/dq/games) не загружался.
        """
        if "?" in self.path:
            clean = urlparse(self.path).path
            if not clean.startswith("/api/"):
                self.path = clean
        return super().send_head()

    def do_HEAD(self):
        # ?v=… — версия для кэша, а НЕ имя файла: HEAD спрашивается для тех же
        # адресов, что GET, и без этой строки сервер искал бы «theme.js?v=52»
        self.path = unquote(urlparse(self.path).path)
        return super().do_HEAD()

    # -------------------------------------------------------------- #
    def do_GET(self):
        path = unquote(urlparse(self.path).path)

        if path in ("/", "/index.html", "/dq"):
            self.path = "/index.html"
            return super().do_GET()

        # -------- changelog page --------
        if path in ("/changelog", "/changelog.html"):
            self.path = "/changelog.html"
            return super().do_GET()

        # -------- backups index as JSON (for changelog page) --------
        if path == "/api/backups/index":
            versions = _bak.load_index() if _bak else []
            self._json({"versions": versions})
            return
            versions = _bak.load_index() if _bak else []
            self._json({"versions": versions})
            return

        # -------- история версий (scripts/backup.py + server_backups.py) --------
        if path in ("/backups", "/backups/", "/versions"):
            if not _check_admin_auth(self):
                return _send_unauthorized(self)
            try:
                versions = list(reversed(_bak.load_index())) if _bak else []
                return self._html("История версий", _render_versions_list(versions))
            except Exception as e:
                import traceback
                traceback.print_exc()
                return self._json({"error": str(e)}, 500)
        if path.startswith("/backups/"):
            if not _check_admin_auth(self):
                return _send_unauthorized(self)
            return self._version_route(path[len("/backups/"):])

        if path == "/api/data":
            user_id = _get_user_id(self)
            return self._json(build_api(user_id))

        # -------- auth: me (GET) --------
        if path == "/api/auth/me":
            user_id = _get_user_id(self)
            stats = _load_user_stats(user_id)
            return self._json({"user_id": user_id, "stats": stats})

        # -------- admin: list all users (requires admin auth) --------
        if path == "/api/admin/users":
            if not _check_admin_auth(self):
                return _send_unauthorized(self)
            users = []
            if os.path.isdir(STATS_DIR):
                for fname in os.listdir(STATS_DIR):
                    if fname.startswith("de_lernen_stats_") and fname.endswith(".json"):
                        user_id = fname[len("de_lernen_stats_"):-5]
                        stats = _load_user_stats(user_id)
                        # Also load user words
                        from dq.translate import load_user_words
                        uw = load_user_words()
                        users.append({
                            "user_id": user_id,
                            "stats": stats,
                            "words_count": len(uw.get("words", {})),
                            "phrases_count": len(uw.get("phrases", {})),
                        })
            return self._json({"users": users})

        # -------- admin: get full user data (requires admin auth) --------
        if path.startswith("/api/admin/user/"):
            if not _check_admin_auth(self):
                return _send_unauthorized(self)
            user_id = unquote(path[len("/api/admin/user/"):])
            stats = _load_user_stats(user_id)
            from dq.translate import load_user_words
            uw = load_user_words()
            # Also load user photos
            from dq.word_photos import map as photo_map
            photos = photo_map()
            return self._json({
                "user_id": user_id,
                "stats": stats,
                "user_words": uw,
                "photos": photos,
            })

        # -------- экспорт прогресса: получаем файл с данными (страховка) --------
        if path == "/api/export":
            self._export_stats()
            return

        if path == "/api/pairs":
            user_id = _get_user_id(self)
            qs = parse_qs(urlparse(self.path).query)
            keys = []
            for part in qs.get("keys", []):
                keys.extend(k.strip() for k in part.split(",") if k.strip())
            if not keys:
                keys = _load_user_stats(user_id)["enabled_groups"]
            due_only = (qs.get("due") or [""])[0] in ("1", "true", "yes")
            only_words = []
            for part in qs.get("words", []):
                only_words.extend(w.strip() for w in part.split(",") if w.strip())
            if only_words:
                pairs = _pairs_for_words(only_words)
                by_group = {}
                pron = {}
                for de, _ru in pairs[:40]:
                    if phonetics.is_german(de):
                        d = pron_entry(de)
                        if d:
                            pron[de.lower()] = d
                return self._json({"pairs": pairs, "byGroup": by_group, "pron": pron})
            by_group = {}
            for key in keys:
                by_group[key] = _pairs_for_keys([key], limit=400, due_only=due_only)
            pairs = _pairs_for_keys(keys, due_only=due_only)
            # транскрипция идёт вместе со словами — карточка появляется без запроса
            pron = {}
            for de, _ru in pairs[:40]:
                if phonetics.is_german(de):
                    d = pron_entry(de)
                    if d:
                        pron[de.lower()] = d
            return self._json({"pairs": pairs, "byGroup": by_group, "pron": pron})

        # -------- словарь: все слова + фото + выбор слов --------
        if path == "/api/vocab":
            return self._json(_vocab_payload())

        # -------- фото к словам (content/word_photos/) --------
        if path == "/photos/" or path.startswith("/photos/"):
            name = os.path.basename(path[len("/photos/"):])
            full = os.path.abspath(os.path.join(photos.PHOTO_DIR, name))
            if name and full.startswith(os.path.abspath(photos.PHOTO_DIR)) and os.path.isfile(full):
                self.path = name
                self.directory = photos.PHOTO_DIR
                return super().do_GET()
            return self.send_error(404)

# -------- задания / тесты --------
        if path == "/api/worksheets":
            user_id = _get_user_id(self)
            return self._json({"worksheets": worksheets_index(),
                                     "progress": _load_user_stats(user_id).get("worksheets", {})})
        if path == "/api/tables":
            data = worksheet_by_id("grammatik-tables")
            if not data:
                return self._json({"error": "not found", "sections": []}, 404)
            return self._json(data)

        if path.startswith("/api/worksheet/"):
            wid = unquote(path[len("/api/worksheet/"):])
            data = worksheet_by_id(wid)
            if not data:
                return self._json({"error": "not found"}, 404)
            return self._json(data)

        # -------- данные мини-игр --------
        if path == "/api/game/sentences":
            return self._json(game_sentences())
        if path == "/api/game/emoji":
            return self._json(game_data())
        if path == "/api/game/phones":
            return self._json({"phones": game_phones()})
        if path == "/api/game/numbers":
            return self._json({"numbers": game_numbers()})

        # -------- перевод / «Мои слова» --------
        if path == "/api/tr/history":
            qs = parse_qs(urlparse(self.path).query)
            kind = (qs.get("kind") or [""])[0] or None
            return self._json({"items": tr.history(kind=kind), "stats": tr.stats()})
        if path == "/api/tr/lookup":
            qs = parse_qs(urlparse(self.path).query)
            text = (qs.get("text") or [""])[0][:500]
            kind = "phrase" if (qs.get("kind") or [""])[0] == "phrase" else "word"
            net = (qs.get("net") or ["1"])[0] not in ("0", "false", "no")
            try:
                res = tr.lookup(text, kind=kind, allow_net=net)
            except Exception as exc:
                print("  ! перевод:", exc, file=sys.stderr)
                res = None
            return self._json({"result": res, "text": text, "kind": kind})

        # -------- произношение / озвучка --------
        if path == "/api/pron":
            qs = parse_qs(urlparse(self.path).query)
            words = [w for part in qs.get("words", []) for w in part.split("|") if w.strip()]
            return self._json(handle_pron({"words": words}))

        if path == "/api/tts":
            qs = parse_qs(urlparse(self.path).query)
            text = (qs.get("text") or [""])[0]
            lang = (qs.get("lang") or ["de"])[0]
            try:
                return self._serve_tts(text, lang, qs)
            except Exception:
                import traceback
                traceback.print_exc()
                return self.send_error(500)

        if path == "/api/tts/prefetch":
            # Trigger background prefetch of common words
            if self.command not in ("GET", "POST"):
                return self._json({"ok": False, "error": "GET or POST required"}, 405)
            try:
                from dq.media import download_neural_audio
                import threading
                def prefetch():
                    common = ["der", "die", "das", "und", "oder", "aber", "ich", "du", "er", "sie", "es", "wir", "ihr", "Sie",
                              "haben", "sein", "werden", "können", "müssen", "sollen", "wollen", "dürfen", "mögen",
                              "gehen", "kommen", "machen", "sagen", "sehen", "nehmen", "geben", "sprechen", "lesen", "schreiben",
                              "gut", "schlecht", "groß", "klein", "viel", "wenig", "neu", "alt", "jung", "schön",
                              "heute", "morgen", "gestern", "jetzt", "hier", "dort", "ja", "nein", "bitte", "danke"]
                    for word in common:
                        try:
                            download_neural_audio(word, "de", voice_variant="standard")
                        except Exception:
                            pass
                threading.Thread(target=prefetch, daemon=True).start()
                return self._json({"ok": True, "message": "Prefetch started in background"})
            except Exception as e:
                return self._json({"ok": False, "error": str(e)}, 500)

        if path.startswith("/images/"):
            rel = path[len("/images/"):]
            full = os.path.abspath(os.path.join(IMAGES_DIR, rel))
            if full.startswith(os.path.abspath(IMAGES_DIR)) and os.path.isfile(full):
                self.path = rel                     # ОТНОСИТЕЛЬНО IMAGES_DIR
                self.directory = IMAGES_DIR
                return super().do_GET()
            return self.send_error(404)

        if path.startswith("/audio/"):
            rel = unquote(path[len("/audio/"):])          # может быть «neural/<file>»
            if "/" in rel or "\\" in rel or ".." in rel:
                sub, name = rel.replace("\\", "/").rsplit("/", 1)
            else:
                sub, name = "", rel
            base = NEURAL_DIR if sub == "neural" else AUDIO_DIR
            full = os.path.abspath(os.path.join(base, os.path.basename(name)))
            if full.startswith(os.path.abspath(base)) and os.path.isfile(full):
                # directory уже NEURAL_DIR — путь должен быть ОТНОСИТЕЛЬНО него
                self.path = os.path.basename(name)
                self.directory = base
                return super().do_GET()
            return self.send_error(404)

        if path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return

        # статика: "?v=7" — только для кэша браузера, файл ищем по чистому имени
        if "?" in self.path:
            self.path = path
        return super().do_GET()

    def _serve_tts(self, text, lang="de", qs=None):
        """Озвучка: нейро-голос (edge-tts) → mp3 из кэша → Google TTS (запасной).

        Неблокирующая защита от спама: не более 4 параллельных скачиваний.
        """
        qs = qs or {}
        text = (text or "").strip()
        lang = "ru" if lang == "ru" else "de"
        slow = (qs.get("slow") or [""])[0] in ("1", "true", "yes")
        gender = (qs.get("gender") or ["female"])[0]
        if gender not in ("female", "male"):
            gender = "female"
        voice_variant = (qs.get("voice_variant") or ["standard"])[0]
        if voice_variant not in ("standard", "austria", "swiss"):
            voice_variant = "standard"
        if not text or len(text) > 180:
            return self.send_error(400)
        path = neural_path_for(text, lang, slow=bool(slow), gender=gender, voice_variant=voice_variant) or audio_file_for(text, lang)
        if not path:
            try:
                from dq.media import download_neural_audio, download_single_audio
                if _TTS_SLOTS.acquire(timeout=6):
                    try:
                        # 1) живой нейро-голос, 2) Google TTS как запасной вариант
                        path = download_neural_audio(text, lang, slow=bool(slow), gender=gender, voice_variant=voice_variant) \
                            or download_single_audio(text, lang)
                    finally:
                        _TTS_SLOTS.release()
                else:
                    path = None
            except Exception:
                path = None
        if not path or not os.path.isfile(path):
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        rel = os.path.basename(path)
        # нейро-файлы лежат в audio_cache/neural/, гугловые — в audio_cache/
        is_neural = "neural" in os.path.normpath(path).split(os.path.sep)
        self.directory = NEURAL_DIR if is_neural else AUDIO_DIR
        self.path = rel                     # ОТНОСИТЕЛЬНО directory — иначе 404
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        payload = self._read_json()
        user_id = _get_user_id(self)
        
        if path == "/api/save":
            return self._json(handle_save(payload, user_id))
        if path == "/api/reset":
            return self._json(handle_reset(user_id))
        if path == "/api/game/record":
            return self._json(handle_game_record(payload, user_id))
        if path == "/api/worksheet/result":
            return self._json(handle_worksheet_result(payload, user_id))
        if path == "/api/pron":
            return self._json(handle_pron(payload, user_id))
        if path == "/api/photo":
            return self._json(handle_photo(payload, user_id))
        if path == "/api/photo/delete":
            ok = photos.remove(str(payload.get("word") or ""))
            return self._json({"ok": ok, "photos": photos.map()})

        # -------- перевод по клику (web/wordpop.js) --------
        if path == "/api/tr/lookup":
            text = str(payload.get("text") or "")[:500]
            kind = "phrase" if payload.get("kind") == "phrase" else "word"
            net = payload.get("net") is not False
            rev = payload.get("rev") is True          # True — переводим С русского НА немецкий
            try:
                res = tr.lookup_back(text, kind=kind, allow_net=net) if rev else \
                    tr.lookup(text, kind=kind, allow_net=net)
            except Exception as exc:
                print("  ! перевод:", exc, file=sys.stderr)
                res = None
            return self._json({"result": res, "text": text, "kind": kind, "rev": rev})
        if path == "/api/tr/learned":
            ok = tr.mark_learned(str(payload.get("key") or ""), bool(payload.get("value", True)))
            return self._json({"ok": ok})
        if path == "/api/tr/forget":
            ok = tr.forget(str(payload.get("key") or ""))
            return self._json({"ok": ok})

        # -------- add custom word/phrase (user's own vocabulary) --------
        if path == "/api/tr/add":
            text = str(payload.get("text") or "").strip()
            ru = str(payload.get("ru") or "").strip()
            kind = "phrase" if payload.get("kind") == "phrase" or " " in text else "word"
            if not text or not ru:
                return self._json({"ok": False, "error": "text and ru required"})
            # Save directly to user_words.json
            from dq.translate import load_user_words, save_user_words, key_of
            data = load_user_words()
            bucket = data[kind + "s"]
            k = key_of(text)
            entry = bucket.get(k) or {}
            entry["text"] = text
            entry["ru"] = ru
            entry["source"] = "user"
            entry["kind"] = kind

        # -------- TTS prefetch --------
        if path == "/api/tts/prefetch":
            try:
                from dq.media import download_neural_audio
                import threading
                def prefetch():
                    common = ["der", "die", "das", "und", "oder", "aber", "ich", "du", "er", "sie", "es", "wir", "ihr", "Sie",
                              "haben", "sein", "werden", "können", "müssen", "sollen", "wollen", "dürfen", "mögen",
                              "gehen", "kommen", "machen", "sagen", "sehen", "nehmen", "geben", "sprechen", "lesen", "schreiben",
                              "gut", "schlecht", "groß", "klein", "viel", "wenig", "neu", "alt", "jung", "schön",
                              "heute", "morgen", "gestern", "jetzt", "hier", "dort", "ja", "nein", "bitte", "danke"]
                    for word in common:
                        try:
                            download_neural_audio(word, "de", voice_variant="standard")
                        except Exception:
                            pass
                threading.Thread(target=prefetch, daemon=True).start()
                return self._json({"ok": True, "message": "Prefetch started in background"})
            except Exception as e:
                return self._json({"ok": False, "error": str(e)}, 500)
            entry["hits"] = int(entry.get("hits") or 0)
            entry["first"] = entry.get("first") or time.strftime("%Y-%m-%dT%H:%M:%S")
            entry["last"] = time.strftime("%Y-%m-%dT%H:%M:%S")
            entry["learned"] = False
            bucket[k] = entry
            save_user_words(data)
            return self._json({"ok": True, "key": k, "entry": entry})

        # -------- версии: создать снимок / откатить (scripts/backup.py) --------
        if path == "/api/backup/now":
            if not _bak:
                return self._json({"ok": False, "error": "backup.py не найден"}, 500)
            entry = _bak.make_backup(prompt=str(payload.get("prompt") or ""),
                                     label=str(payload.get("label") or ""))
            return self._json({"ok": True, "version": entry})
        if path == "/api/backup/restore":
            if not _bak:
                return self._json({"ok": False, "error": "backup.py не найден"}, 500)
            try:
                done = _bak.restore(str(payload.get("id") or ""),
                                    with_stats=bool(payload.get("withStats")),
                                    only=str(payload.get("file") or ""))
            except SystemExit as exc:
                return self._json({"ok": False, "error": str(exc)}, 400)
            return self._json({"ok": True, "restored": done})

        # -------- импорт прогресса (экспорт — GET /api/export) --------
        if path == "/api/import":
            user_id = _get_user_id(self)
            data = payload.get("stats") if isinstance(payload.get("stats"), dict) else payload
            if not isinstance(data, dict) or not data:
                return self._json({"ok": False, "error": "пустой файл"}, 400)
            allowed = {"answered", "correct", "xp", "best_streak", "daily_answers",
                       "history", "srs", "mistakes", "worksheets", "games", "ui",
                       "enabled_groups", "favorites", "words", "day_streak", "last_study_day"}
            keep = _load_user_stats(user_id)
            for k in allowed:
                if k in data:
                    keep[k] = data[k]
            _save_user_stats(user_id, keep)
            return self._json({"ok": True, "stats": _load_user_stats(user_id)})

        # -------- auth: login / me --------
        if path == "/api/auth/login":
            # Simple login: generate or use provided username, set cookie
            username = str(payload.get("username") or "").strip()
            if not username:
                # Generate anonymous ID based on IP
                username = _get_user_id(self)
            # Set cookie
            import hashlib
            session_token = hashlib.md5(f"{username}{time.time()}".encode()).hexdigest()[:32]
            user_id = f"user_{username}"
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", f"dq_user={user_id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "user_id": user_id, "username": username}).encode("utf-8"))
            return

        if path == "/api/auth/me":
            user_id = _get_user_id(self)
            stats = _load_user_stats(user_id)
            return self._json({"user_id": user_id, "stats": stats})

        return self.send_error(404)

    # -------------------------------------------------------------- #
    #   ВЕРСИИ: страницы /backups и /backups/<ID> (вёрстка в server_backups.py)
    # -------------------------------------------------------------- #
    def _html(self, title, body):
        raw = _html_page(title, body).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _export_stats(self):
        """GET /api/export: отдать весь прогресс файлом (кнопка «Скачать прогресс»)."""
        user_id = _get_user_id(self)
        body = json.dumps(_load_user_stats(user_id), ensure_ascii=False, indent=2).encode("utf-8")
        day = time.strftime("%Y-%m-%d")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="deutsch-quest-{day}.json"')
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _version_route(self, rest):
        vid, _, action = rest.partition("/")
        if not _bak or not _bak.find(vid):
            return self.send_error(404, "version not found")
        if action == "restore":
            qs = parse_qs(urlparse(self.path).query)
            with_stats = qs.get("stats", ["0"])[0] in ("1", "true")
            try:
                done = _bak.restore(vid, with_stats=with_stats)
            except SystemExit as exc:
                return self._html("Ошибка", f"<p>{exc}</p>")
            port = self.server.server_address[1]
            body = ("<h1>Файлы возвращены</h1>"
                    f"<p>Версия <b>{vid}</b>: восстановлено файлов — <b>{len(done)}</b>."
                    + (" Прогресс тоже возвращён." if with_stats else " Прогресс не тронут.")
                    + f"</p><p><a href='/backups'>← ко всем версиям</a> · "
                    f"<a href='http://127.0.0.1:{port}/'>открыть сайт</a></p>")
            return self._html("Восстановлено", body)
        return self._html(f"Версия {vid}",
                          _render_version_detail(_bak.find(vid), _bak.read_info(vid)))


_TTS_SLOTS = threading.BoundedSemaphore(4)


def serve(port=8000, open_browser=True, host="0.0.0.0"):
    ThreadingHTTPServer.allow_reuse_address = True
    ThreadingHTTPServer.daemon_threads = True
    httpd = ThreadingHTTPServer((host, port), Handler)
    if host in ("0.0.0.0", ""):
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            lan = s.getsockname()[0]
            s.close()
        except Exception:
            lan = "127.0.0.1"
        url = f"http://{lan}:{port}/"
    else:
        url = f"http://{host}:{port}/"
    print(f"Deutsch Quest (web) → {url}")
    print("Остановить: Ctrl+C")
    if open_browser and host in ("127.0.0.1", "localhost"):
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
    finally:
        httpd.server_close()


def main():
    parser = argparse.ArgumentParser(description="Deutsch Quest — веб-версия")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--host", default="0.0.0.0", help="адрес привязки (0.0.0.0 — для всех)")
    args = parser.parse_args()
    serve(args.port, open_browser=not args.no_browser, host=args.host)


# --------------------------------------------------------------------------- #
#  МИНИ-ИГРЫ
#
#  Всё, что умеет отдавать сервер: картинки-эмодзи, шаблоны предложений,
#  генерация телефонов и чисел. Логика раундов живёт в web/dq.js.
# --------------------------------------------------------------------------- #
EMOJI_HINTS = [
    ("🍎", "Apfel", "яблоко"), ("🍞", "Brot", "хлеб"), ("🥛", "Milch", "молоко"),
    ("💧", "Wasser", "вода"), ("🧀", "Käse", "сыр"), ("🍕", "Pizza", "пицца"),
    ("🥗", "Salat", "салат"), ("🍪", "Keks", "печенье"), ("🍬", "Zucker", "сахар"),
    ("🔨", "Hammer", "молоток"), ("🔧", "Schraubenschlüssel", "гаечный ключ"),
    ("🪚", "Säge", "пила"), ("✂️", "Schere", "ножницы"), ("🪛", "Schraubendreher", "отвёртка"),
    ("📏", "Lineal", "линейка"), ("🪑", "Stuhl", "стул"), ("🚪", "Tür", "дверь"),
    ("🪟", "Fenster", "окно"), ("🛏️", "Bett", "кровать"), ("🚗", "Auto", "машина"),
    ("🚲", "Fahrrad", "велосипед"), ("🚆", "Zug", "поезд"), ("✈️", "Flugzeug", "самолёт"),
    ("🏠", "Haus", "дом"), ("🏫", "Schule", "школа"), ("📚", "Buch", "книга"),
    ("✏️", "Stift", "ручка"), ("📱", "Handy", "телефон"), ("💻", "Computer", "компьютер"),
    ("☀️", "Sonne", "солнце"), ("🌙", "Mond", "луна"), ("⭐", "Stern", "звезда"),
    ("🌳", "Baum", "дерево"), ("🌸", "Blume", "цветок"), ("🐶", "Hund", "собака"),
    ("🐱", "Katze", "кошка"), ("🐦", "Vogel", "птица"), ("🐟", "Fisch", "рыба"),
    ("⏰", "Uhr", "часы"), ("🔑", "Schlüssel", "ключ"), ("💰", "Geld", "деньги"),
    ("❤️", "Herz", "сердце"), ("👨", "Mann", "мужчина"), ("👩", "Frau", "женщина"),
    ("👦", "Junge", "мальчик"), ("👧", "Mädchen", "девочка"), ("👨‍👩‍👧", "Familie", "семья"),
]


def game_sentences():
    """Шаблоны «Порядок слов» (те же, что в dq/grammar.py)."""
    from dq.grammar import TEMPLATES, DISTRACTOR_POOL
    out = []
    for t in TEMPLATES:
        item = {"parts": list(t["parts"]), "ru": t["ru"], "rule": t["rule"]}
        if t.get("number_range"):
            item["range"] = list(t["number_range"])
        elif t.get("allow_number") or any("{zahl}" in p for p in t["parts"]):
            item["range"] = [1, 99]
        out.append(item)
    return {"templates": out, "distractors": list(DISTRACTOR_POOL)}


def game_data():
    return {"emoji": [list(x) for x in EMOJI_HINTS]}


def game_phones(count=12):
    import random
    rng = random.Random()
    out = []
    for _ in range(count):
        raw = random_phone(rng)
        out.append({"raw": raw, "de": phone_to_german(raw)})
    return out


def game_numbers(count=16):
    import random
    rng = random.Random()
    return [{"n": n, "de": _num_word(n), "ru": rng_word(n)}
            for n in (rng.randint(1, 9999) for _ in range(count))]


def rng_word(n):
    return number_to_russian_text(n) if n >= 1000 else str(n)


def handle_game_record(payload, user_id):
    """Итог раунда: пишем в stats['games'] тот же ключ, что и в старом приложении."""
    stats = _load_user_stats(user_id)
    games = stats.setdefault("games", {})
    key = str(payload.get("key") or "")
    value = payload.get("value", 0)
    mode = payload.get("mode", "add")
    bonus_xp = int(payload.get("xp") or 0)
    if key:
        try:
            value = int(value)
        except (TypeError, ValueError):
            value = 0
        if mode == "max":
            games[key] = max(int(games.get(key) or 0), value)
        else:
            games[key] = int(games.get(key) or 0) + value
    if bonus_xp:
        stats["xp"] = int(stats.get("xp") or 0) + bonus_xp
    _save_user_stats(user_id, stats)
    return {"ok": True, "stats": stats}


if __name__ == "__main__":
    main()