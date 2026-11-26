# -*- coding: utf-8 -*-
"""Фото к словам.

Пользователь кидает картинку и выбирает немецкое слово — картинка
показывается везде, где встречается это слово.

Хранение:
    content/word_photos.json      {"haus": {"file": "haus_1732011222.jpg", "at": …, "w": 640, "h": 480}}
    content/word_photos/<file>    сам файл (ужимается до SIDE px по длинной стороне)

Ключ слова (slot) — немецкая часть без артикля, в нижнем регистре:
«das Haus» → «haus», «die Häuser» → «häuser». Так фото привязано
к слову, а не к варианту записи в словаре.
"""
import json
import os
import re
import threading
import time

from dq.core import CONTENT_DIR

PHOTO_DIR = os.path.join(CONTENT_DIR, "word_photos")
INDEX_FILE = os.path.join(CONTENT_DIR, "word_photos.json")

SIDE = 720            # длинная сторона после ресайза, px
MAX_BYTES = 12 * 1024 * 1024   # больше — не принимаем (base64 раздувает)

_LOCK = threading.Lock()
_CACHE = {"mtime": None, "data": {}}

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"}


def slot(word):
    """Нормализованный ключ слова: без артикля, нижний регистр."""
    s = str(word or "").strip().lower()
    s = re.sub(r"^(der|die|das|ein|eine)\s+", "", s)
    s = s.strip(" .,;:!?„“\"'")
    return s


def _load():
    try:
        mtime = os.path.getmtime(INDEX_FILE)
    except OSError:
        mtime = None
    if _CACHE["mtime"] == mtime:
        return _CACHE["data"]
    data = {}
    if mtime is not None:
        try:
            with open(INDEX_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
            if isinstance(raw, dict):
                data = {k: v for k, v in raw.items() if isinstance(v, dict) and v.get("file")}
        except Exception:
            data = {}
    _CACHE["mtime"] = mtime
    _CACHE["data"] = data
    return data


def _save(data):
    os.makedirs(CONTENT_DIR, exist_ok=True)
    tmp = INDEX_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, INDEX_FILE)
    try:
        _CACHE["mtime"] = os.path.getmtime(INDEX_FILE)
    except OSError:
        _CACHE["mtime"] = None
    _CACHE["data"] = data


def map():
    """{ключ: {file, at, w, h}} — для интерфейса."""
    return dict(_load())


def get(word):
    return _load().get(slot(word))


def url(word):
    e = get(word)
    return ("/photos/" + e["file"]) if e else None


def _slug(word):
    """Безопасное имя файла из ключа слова."""
    table = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})
    s = slot(word).translate(table)
    s = re.sub(r"[^a-z0-9_-]+", "-", s).strip("-")
    return (s or "wort")[:40]


def _shrink(blob):
    """Ужать картинку через pillow, если он есть. Иначе — как есть."""
    try:
        from io import BytesIO
        from PIL import Image
    except Exception:
        return blob, ".jpg", None, None
    try:
        im = Image.open(BytesIO(blob))
        im.load()
        w, h = im.size
        if max(w, h) > SIDE:
            k = SIDE / float(max(w, h))
            im = im.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
            w, h = im.size
        if im.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", im.size, (255, 255, 255))
            im2 = im.convert("RGBA")
            bg.paste(im2, mask=im2.split()[-1])
            im = bg
        elif im.mode != "RGB":
            im = im.convert("RGB")
        out = BytesIO()
        im.save(out, "JPEG", quality=86, optimize=True, progressive=True)
        return out.getvalue(), ".jpg", w, h
    except Exception:
        return blob, ".jpg", None, None


def save(word, blob):
    """Сохранить фото к слову. Возвращает запись индекса."""
    key = slot(word)
    if not key:
        raise ValueError("пустое слово")
    if len(blob) > MAX_BYTES:
        raise ValueError("картинка слишком большая (больше 12 МБ)")
    data, ext, w, h = _shrink(blob)
    os.makedirs(PHOTO_DIR, exist_ok=True)
    with _LOCK:
        idx = dict(_load())
        old = idx.get(key)
        name = "%s_%d%s" % (_slug(key), int(time.time() * 1000) % 10 ** 9, ext)
        with open(os.path.join(PHOTO_DIR, name), "wb") as f:
            f.write(data)
        entry = {"file": name, "at": int(time.time() * 1000)}
        if w and h:
            entry["w"], entry["h"] = int(w), int(h)
        idx[key] = entry
        _save(idx)
        if old and old.get("file") and old["file"] != name:
            try:
                os.remove(os.path.join(PHOTO_DIR, old["file"]))
            except OSError:
                pass
    return entry


def remove(word):
    key = slot(word)
    with _LOCK:
        idx = dict(_load())
        old = idx.pop(key, None)
        if not old:
            return False
        _save(idx)
        try:
            os.remove(os.path.join(PHOTO_DIR, old.get("file") or ""))
        except OSError:
            pass
    return True
