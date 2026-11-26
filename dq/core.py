# обновлять agents.md
# -*- coding: utf-8 -*-
"""
dq.core — константы, утилиты, модели данных и загрузка словарей.

Модуль не зависит от tkinter и может использоваться отдельно
(например, для скриптов предзагрузки картинок и озвучки).
"""
import os
import re
import time
import json
import math
import random
import hashlib
import logging

LOGGER = logging.getLogger("dq")

# --------------------------------------------------------------------------- #
#  ПУТИ
# --------------------------------------------------------------------------- #
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(BASE_DIR, "audio_cache")
IMAGES_DIR = os.path.join(BASE_DIR, "images")
# данные-контент живут в content/ (словари, прогресс, транскрипция, кэш переводов)
CONTENT_DIR = os.path.join(BASE_DIR, "content")
STATS_FILE = os.path.join(CONTENT_DIR, "de_lernen_stats.json")
WORDS_FILE = os.path.join(CONTENT_DIR, "words.txt")
PHRASES_FILE = os.path.join(CONTENT_DIR, "phrases.txt")
NUMBERS_FILE = os.path.join(CONTENT_DIR, "numbers.txt")
IMAGE_CACHE_JSON = os.path.join(IMAGES_DIR, "image_cache.json")

# --------------------------------------------------------------------------- #
#  ТЕМЫ — Liquid Glass (iOS 26)
#
#  Каждая тема — это НЕ набор «панелей», а описание СРЕДЫ:
#    bg / bg2        — фон-обои (градиентная среда под всем интерфейсом)
#    backdrop        — узловые цвета динамического фона (для градиента)
#    panel / card    — базовая плотная поверхность контента (opaque, не стекло)
#    card2 / elev    — промежуточные уровни контента
#    glass           — REGULAR GLASS: rgba-оттенок стекла поверх фона
#    glass_clear     — CLEAR GLASS: почти прозрачный материал (для медиа/навигации)
#    tint            — тонкая цветовая примесь стекла (реагирует на акцент)
#    text / dim / faint — типографика (чистая иерархия, без glow)
#    line            — hairline-разделитель (не «рамка»)
#    spec            — цвет specular-блика (свет на кромке стекла)
#    shadow          — цвет очень мягкой separation-тени
#
#  ВАЖНО: значения material_* — это rgba-строки, которые Tkinter НЕ умеет,
#  поэтому widgets.py сам «запекает» их в сплошной цвет через hex_blend
#  относительно актуального фона. Так мы получаем настоящую полупрозрачность
#  и адаптацию оттенка к среде, работая в ограничениях Tk.
# --------------------------------------------------------------------------- #
THEMES = {
    "Ночь": {
        "bg": "#070C15", "bg2": "#101B2B",
        "backdrop": ("#070C15", "#111D2F", "#0C1423"),
        "panel": "#0E1728", "card": "#121F34", "card2": "#1A2A42", "elev": "#233554",
        "glass": "rgba(255,255,255,0.12)", "glass_clear": "rgba(255,255,255,0.08)",
        "tint": "rgba(110,160,255,0.12)",
        "text": "#F5F8FF", "dim": "#A9B9D7", "faint": "#7383A2",
        "line": "#2B3C5D", "hairline": "rgba(255,255,255,0.12)",
        "spec": "rgba(255,255,255,0.62)",
        "input": "#0D1728", "shadow": "#04070D",
    },
    "Графит": {
        "bg": "#151517", "bg2": "#212227",
        "backdrop": ("#151517", "#2A2D34", "#1B1D21"),
        "panel": "#1C1E22", "card": "#23262C", "card2": "#2D3037", "elev": "#3B4048",
        "glass": "rgba(255,255,255,0.10)", "glass_clear": "rgba(255,255,255,0.06)",
        "tint": "rgba(255,255,255,0.05)",
        "text": "#F5F5F7", "dim": "#B8BCC7", "faint": "#7B8190",
        "line": "#404754", "hairline": "rgba(255,255,255,0.10)",
        "spec": "rgba(255,255,255,0.56)",
        "input": "#1A1C20", "shadow": "#090B0F",
    },
    "Океан": {
        "bg": "#031922", "bg2": "#0A2A39",
        "backdrop": ("#031922", "#0C3445", "#072131"),
        "panel": "#072A3C", "card": "#0B3247", "card2": "#113F5D", "elev": "#1A517B",
        "glass": "rgba(200,235,255,0.12)", "glass_clear": "rgba(200,235,255,0.07)",
        "tint": "rgba(90,180,255,0.12)",
        "text": "#EAF9FF", "dim": "#A4C8D9", "faint": "#6E91A8",
        "line": "#1A4A66", "hairline": "rgba(255,255,255,0.10)",
        "spec": "rgba(255,255,255,0.55)",
        "input": "#052837", "shadow": "#010C13",
    },
    "Неон": {
        "bg": "#130B1D", "bg2": "#20133A",
        "backdrop": ("#130B1D", "#2B1847", "#1B1230"),
        "panel": "#1E1231", "card": "#29163F", "card2": "#362157", "elev": "#4A2B72",
        "glass": "rgba(240,225,255,0.12)", "glass_clear": "rgba(240,225,255,0.07)",
        "tint": "rgba(175,130,255,0.12)",
        "text": "#F7EEFF", "dim": "#C8B8E8", "faint": "#8F79B1",
        "line": "#4D2D74", "hairline": "rgba(255,255,255,0.10)",
        "spec": "rgba(255,255,255,0.56)",
        "input": "#180E2B", "shadow": "#09050E",
    },
    "Свет": {
        "bg": "#E9EEF5", "bg2": "#DDE7F2",
        "backdrop": ("#EEF2F7", "#D8E4F1", "#E8EDF4"),
        "panel": "#F4F6FA", "card": "#FAFBFD", "card2": "#E9EEF5", "elev": "#DCE4EE",
        "glass": "rgba(238,245,255,0.56)", "glass_clear": "rgba(238,245,255,0.36)",
        "tint": "rgba(70,125,210,0.07)",
        "text": "#182233", "dim": "#526176", "faint": "#77869A",
        "line": "#D3DCE8", "hairline": "rgba(36,55,82,0.12)",
        "spec": "rgba(255,255,255,0.72)",
        "input": "#FFFFFF", "shadow": "#AEB9C8",
    },
}

# Плотный «regular glass» — когда под элементом насыщенный контент, но текст
# обязан читаться (toolbar, navigation, alert, кнопки с текстом).
GLASS_REGULAR = "rgba(255,255,255,0.16)"
# «Clear glass» — почти прозрачный материал для навигации поверх медиа.
GLASS_CLEAR = "rgba(255,255,255,0.07)"

ACCENT_NAMES = ["Мята", "Лайм", "Небо", "Фиолет", "Коралл", "Янтарь"]
ACCENTS = {
    "Мята":    ("#2EE6A8", "#7BFFD0"),
    "Лайм":    ("#B4F24B", "#D8FF85"),
    "Небо":    ("#3FA9FF", "#8FD0FF"),
    "Фиолет":  ("#A98BFF", "#CFC0FF"),
    "Коралл":  ("#FF6B6B", "#FFA3A3"),
    "Янтарь":  ("#FFB020", "#FFD27A"),
}

# Радиусы — разные уровни, не один на всё (форма следует за содержимым).
RADIUS = {
    "capsule": 999,   # 50% — pill/capsule
    "xl": 26,         # большие floating-контейнеры
    "lg": 22,         # крупные панели / карточки контента
    "md": 16,         # средние controls
    "sm": 12,         # маленькие элементы
    "xs": 10,         # тайлы/иконки
}

STATUS_COLORS = {
    "ok": "#2EE6A8", "bad": "#FF5C7A", "warn": "#FFC44D", "info": "#3FA9FF",
}

MODES = [
    ("Все вместе", "Всё"),
    ("Заучивание по группам", "Группы"),
    ("Числа", "Числа"),
    ("Телефоны", "Телефоны"),
    ("Школьные фразы", "Фразы"),
    ("Слова (Duolingo)", "Слова"),
    ("Грамматика", "Грамматика"),
    ("Слушание", "Слух"),
    ("Избранное", "★ Избранное"),
    ("ОШИБКИ", "↺ Ошибки"),
]

DIRECTIONS = {
    "DE ➔ RU (Вопрос на немецком)": ("DE → RU", "de"),
    "RU ➔ DE (Вопрос на русском)": ("RU → DE", "ru"),
}

ANIMATION_LEVELS = ("Мгновенно", "Плавно", "Без эффектов")

# --------------------------------------------------------------------------- #
#  МОДЕЛЬ ДАННЫХ
# --------------------------------------------------------------------------- #
class DQPair:
    """Пара «немецкое ↔ русское» с контекстом для игр и визуализации.

    Поля:
      de      — немецкая сторона
      ru      — русская сторона
      group   — группа словаря ("Все", "Инструменты", "Числа", "Грамматика"…)
      kind    — "word" | "phrase" | "number" | "phone" | "grammar"
      image   — подсказка для поиска картинки в Wikipedia/Commons (обычно de)
      audio   — что именно озвучивать на немецком
      numeric — числовое значение (для чисел/телефонов), иначе None
      meta    — необязательный словарь с {de_template, ru_template, hint…}
    """

    __slots__ = ("de", "ru", "group", "kind", "image", "audio", "numeric", "meta")

    def __init__(self, de, ru, group="Все", kind="word", image=None,
                 audio=None, numeric=None, meta=None):
        self.de = de
        self.ru = ru
        self.group = group
        self.kind = kind
        self.image = image or de
        self.audio = audio or de
        self.numeric = numeric
        self.meta = meta

    @property
    def key(self):
        return (self.de, self.ru)

    def __iter__(self):
        """Чтобы распаковка `de, ru = pair` продолжала работать."""
        return iter((self.de, self.ru))

    def __repr__(self):
        return f"DQPair({self.de!r}, {self.ru!r}, kind={self.kind!r})"


# --------------------------------------------------------------------------- #
#  УТИЛИТЫ ЧИСЕЛ / ТЕЛЕФОНОВ
# --------------------------------------------------------------------------- #
_ONES = ["", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun",
         "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn",
         "siebzehn", "achtzehn", "neunzehn"]
_TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig",
         "achtzig", "neunzig"]


def _below100(num):
    if num < 20:
        return _ONES[num]
    t, o = divmod(num, 10)
    if o == 0:
        return _TENS[t]
    if t == 1:
        return "ein" + _TENS[t][2:]
    return _ONES[o] + _TENS[t]


def _below1000(num):
    h, r = divmod(num, 100)
    result = ""
    if h:
        if h == 1:
            result = "einhundert"
        else:
            result = _below100(h) + "hundert"
    if r:
        result = (result + " " + _below100(r)) if result else _below100(r)
    return result.strip()


def number_to_german(n):
    n = int(n)
    if n == 0:
        return "null"
    th, r = divmod(n, 1000)
    result = ""
    if th:
        if th == 1:
            result = "eintausend"
        else:
            result = _below1000(th) + "tausend"
    if r:
        result = (result + " " + _below1000(r)) if result else _below1000(r)
    return result.strip()


def number_to_russian_text(n):
    """Русское прочтение числа прописью (для диктанта «услышал — напиши»)."""
    n = int(n)
    ones = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"]
    teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
             "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"]
    tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят",
            "семьдесят", "восемьдесят", "девяносто"]
    hunds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот",
             "семьсот", "восемьсот", "девятьсот"]

    def below1000(x):
        h, rest = divmod(x, 100)
        parts = []
        if h:
            parts.append(hunds[h])
        if rest:
            if rest < 10:
                parts.append(ones[rest])
            elif rest < 20:
                parts.append(teens[rest - 10])
            else:
                t, o = divmod(rest, 10)
                parts.append(tens[t])
                if o:
                    parts.append(ones[o])
        return " ".join(parts)

    if n == 0:
        return "ноль"
    th, r = divmod(n, 1000)
    parts = []
    if th:
        if th == 1:
            parts.append("одна тысяча")
        elif th == 2:
            parts.append("две тысячи")
        elif 3 <= th <= 4:
            parts.append(below1000(th) + " тысячи")
        else:
            parts.append(below1000(th) + " тысяч")
    if r:
        parts.append(below1000(r))
    return " ".join(parts)


def digit_to_german(digit):
    """Одна цифра по-немецки: 'null'…'neun'."""
    return _ONES[int(digit)].replace("ein", "eins") if int(digit) == 1 else _ONES[int(digit)]


def phone_to_german(digits):
    """Телефон проговаривается по цифрам, как в жизни."""
    return " ".join(digit_to_german(d) for d in digits if d.isdigit())


def phone_to_russian(digits):
    digits = [d for d in digits if d.isdigit()]
    names = {"0": "ноль", "1": "один", "2": "два", "3": "три", "4": "четыре",
             "5": "пять", "6": "шесть", "7": "семь", "8": "восемь", "9": "девять"}
    return " ".join(names[d] for d in digits)


def random_phone(rng=random, groups=(4, 3, 4)):
    """Немецкий вид: 0176 1234567 / 0151 987 65 43 — генерируем группами."""
    prefix = rng.choice(["0151", "0152", "0157", "0160", "0170", "0171", "0176", "0178",
                         "0211", "030", "089", "0711"])
    body = "".join(rng.choice("0123456789") for _ in range(sum(groups)))
    chunks, i = [], 0
    for g in groups:
        chunks.append(body[i:i + g])
        i += g
    return prefix + " " + " ".join(chunks)


# --------------------------------------------------------------------------- #
#  ПРОИЗНОШЕНИЕ (приблизительная русская транскрипция)
# --------------------------------------------------------------------------- #
def convert_de_to_ru_phonetics(text):
    t = text.lower().strip()
    rules = [
        ("sch", "ш"), ("ch", "х"), ("ei", "ай"), ("ie", "и"), ("ah", "а"),
        ("eu", "ой"), ("äu", "ой"), ("z", "ц"), ("s", "с"), ("v", "ф"),
        ("w", "в"), ("j", "й"), ("ß", "с"), ("ä", "э"), ("ö", "э"),
        ("ü", "э"), ("a", "а"), ("o", "о"), ("u", "у"), ("e", "э"),
        ("i", "и"), ("r", "р"),
    ]
    t = t.replace("-", " ").replace("'", "")
    out = []
    i = 0
    while i < len(t):
        for a, b in rules:
            if t.startswith(a, i):
                out.append(b)
                i += len(a)
                break
        else:
            if t[i] == " ":
                out.append(" ")
            i += 1
    return " ".join("".join(out).split())


# --------------------------------------------------------------------------- #
#  ПРОЧИЕ УТИЛИТЫ
# --------------------------------------------------------------------------- #
def get_audio_id(text):
    return hashlib.md5(text.strip().lower().encode("utf-8")).hexdigest()[:12]


def sanitize_image_name(text):
    """'der Hammer' -> 'der_hammer' (как лежат файлы в images/)."""
    name = text.lower().strip()
    for a, b in (("ä", "a"), ("ö", "o"), ("ü", "u"), ("ß", "ss")):
        name = name.replace(a, b)
    name = re.sub(r"[^\w\s-]", "", name, flags=re.UNICODE)
    return re.sub(r"[\s]+", "_", name).strip("_")


def _split_pair(line):
    """Поддерживает разделители '=', '|', '->' и табуляцию."""
    for sep in ("\t", "->", "|", "="):
        if sep in line:
            a, b = line.split(sep, 1)
            a, b = a.strip(), b.strip()
            if a and b:
                return a, b
    return None


def load_data_from_file(filename):
    """Строки вида 'немецкий = русский'. Без разделителя — заголовок/мусор."""
    result = []
    if not os.path.exists(filename):
        return result
    with open(filename, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            pair = _split_pair(line)
            if pair:
                result.append(pair)
    return result


def load_words_with_groups(filename=WORDS_FILE):
    """Группы слов: строка без разделителя (или #комментарий) — заголовок группы."""
    grouped = {}
    if not os.path.exists(filename):
        return grouped
    current = "Все"
    grouped.setdefault(current, [])
    with open(filename, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line:
                continue
            if line.startswith("#"):
                current = line.lstrip("#").strip() or current
                grouped.setdefault(current, [])
                continue
            pair = _split_pair(line)
            if pair:
                grouped.setdefault(current, []).append(pair)
            else:
                current = line
                grouped.setdefault(current, [])
    return grouped


def hex_blend(a, b, amount):
    a = a.lstrip("#")
    b = b.lstrip("#")
    try:
        ar, ag, ab = (int(a[i:i + 2], 16) for i in (0, 2, 4))
        br, bg, bb = (int(b[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return a
    r = round(ar + (br - ar) * amount)
    g = round(ag + (bg - ag) * amount)
    bl = round(ab + (bb - ab) * amount)
    return f"#{max(0,min(255,r)):02x}{max(0,min(255,g)):02x}{max(0,min(255,bl)):02x}"


# --------------------------------------------------------------------------- #
#  LIQUID GLASS — «запекание» полупрозрачных материалов в цвет для Tk
#
#  Tkinter не умеет alpha и настоящий backdrop-blur. Мы воспроизводим
#  поведение стекла тремя приёмами:
#    1. material_color() — накладывает rgba-стекло на цвет ПОД элементом,
#       из-за чего оттенок стекла зависит от фона (как у Apple);
#    2. layered_surface() — имитирует глубину: под поверхностью лежит
#       затемнённый blurred-«фон» + сама стеклянная плитка;
#    3. specular() — тонкий световой блик у кромки (не белая рамка).
# --------------------------------------------------------------------------- #
def parse_rgba(color):
    """'rgba(255,255,255,0.14)' → (255, 255, 255, 0.14). Иначе None."""
    if not color or not isinstance(color, str):
        return None
    s = color.strip().lower()
    if not s.startswith("rgba(") or not s.endswith(")"):
        return None
    try:
        parts = [p.strip() for p in s[5:-1].split(",")]
        r, g, b = (int(round(float(x))) for x in parts[:3])
        a = float(parts[3])
    except Exception:
        return None
    return max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)), max(0.0, min(1.0, a))


def material_color(glass, backdrop, tint=None):
    """Цвет «стекла» поверх фона.

    glass     — rgba-спецификация стекла (THEMES[...]['glass'] и т.п.)
                ИЛИ уже готовый hex-цвет.
    backdrop  — цвет фона ПОД элементом (то, что стекло пропускает).
    tint      — необязательный rgba-оттенок, придающий материалу холодный/
                тёплый подтон (Apple: цвет стекла определяется содержимым).

    Результат — hex-цвет: плотность стекла сохранена, оттенок подмешан
    от фона. Так одна и та же панель выглядит по-разному на светлом и
    тёмном фоне.
    """
    rgba = parse_rgba(glass)
    if rgba is None:
        return glass if isinstance(glass, str) else backdrop
    r, g, b, a = rgba
    base = hex_blend(backdrop, f"#{r:02x}{g:02x}{b:02x}", a)
    if tint:
        tr = parse_rgba(tint)
        if tr:
            base = hex_blend(base, f"#{tr[0]:02x}{tr[1]:02x}{tr[2]:02x}", tr[3])
    return base


def specular(color, strength=0.5):
    """Тонкий specular-блик: мягкий светлый оттенок той же поверхности.

    Это НЕ белая обводка — результат почти совпадает с поверхностью,
    отличается лишь на несколько процентов яркости.
    """
    return hex_blend(color, "#FFFFFF", max(0.0, min(1.0, strength)))


def deepen(color, strength=0.35):
    """Мягко затемнённая версия цвета — для «дна» стекла и separation."""
    return hex_blend(color, "#000000", max(0.0, min(1.0, strength)))


def backdrop_gradient(theme, w, h, steps=48):
    """Вертикальный градиент среды приложения (обои под всем интерфейсом).

    Возвращает список (y, color) для отрисовки на Canvas — даёт ощущение
    пространства вместо скучного однотонного фона.
    """
    key = "backdrop"
    stops = theme.get(key) or (theme.get("bg", "#0A0E18"), theme.get("bg2", "#131A2C"),
                               theme.get("bg", "#0A0E18"))
    if len(stops) < 2:
        color = stops[0] if stops else theme.get("bg", "#0A0E18")
        return [(0, color), (h, color)]
    out = []
    n = max(2, steps)
    for i in range(n + 1):
        t = i / n
        # тянемся по всем узлам: A → B → C
        seg = t * (len(stops) - 1)
        idx = min(int(seg), len(stops) - 2)
        local = seg - idx
        color = hex_blend(stops[idx], stops[idx + 1], local)
        out.append((int(h * t), color))
    return out


def lerp_color(c1, c2, t):
    """Простая интерполяция двух hex-цветов (для динамических состояний)."""
    return hex_blend(c1, c2, t)


def normalize_answer(text):
    """Сравнение ответов: без пунктуации, регистра и лишних пробелов."""
    text = text.strip().lower()
    text = text.replace("ß", "ss")
    for ch in (".", ",", "?", "!", ";", ":", "-", "’", "'", "\""):
        text = text.replace(ch, " ")
    return " ".join(text.split())


def similarity(a, b):
    """Коэффициент похожести 0..1 (Левенштейн) — для подсказок «почти верно»."""
    a, b = normalize_answer(a), normalize_answer(b)
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return 1 - prev[-1] / max(len(a), len(b))


def is_typo_match(user, expected, max_distance=2):
    """«Примерно правильно»: 1–2 опечатки в слове простительны.

    Допуск растёт с длиной слова, чтобы короткие ответы не совпадали случайно:
    до 3 букв — 0 ошибок, до 6 — 1, длиннее — 2. Для фраз разрешаем ошибку
    только в одном слове и только если все короткие слова (≤3 буквы) совпали.
    """
    u, e = normalize_answer(user), normalize_answer(expected)
    if not u or not e:
        return False
    if u == e:
        return True
    uw, ew = u.split(), e.split()

    if len(ew) > 1:
        # многословный ответ: каждое слово должно совпасть точно или содержать
        # допустимую опечатку (по длине слова); менять целое слово нельзя
        if len(uw) != len(ew):
            return False
        for a, b in zip(uw, ew):
            wlen = max(len(a), len(b))
            if wlen <= 2:
                if a != b:
                    return False
                continue
            wl = 1 if wlen <= 6 else max_distance
            if _edit_distance(a, b) > wl:
                return False
        return True

    # одно слово
    if len(uw) != 1:
        return False
    base = max(len(e), len(u))
    if base <= 2:
        return False
    limit = 1 if base <= 6 else max_distance
    return _edit_distance(u, e) <= limit


def _edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def looks_numeric(text):
    """Строка — это только цифры/телефон (не слово). Для отбора отвлекающих."""
    cleaned = "".join(ch for ch in (text or "") if not ch.isspace())
    if not cleaned:
        return False
    return all(ch.isdigit() or ch in "-+/()" for ch in cleaned)


def confusing_distractors(correct, candidates, count=3, rng=None):
    """Выбирает count «похожих» неверных вариантов, чтобы не угадывать вслепую.

    Правила:
      * строки только из цифр никогда не соседствуют со словами;
      * варианты той же длины и с той же первой буквой предпочтительнее
        (похожи на ответ — надо реально знать слово);
      * если кандидатов мало, добираем чем угодно подходящего типа.
    """
    rng = rng or random
    correct_norm = normalize_answer(correct)
    c_num = looks_numeric(correct)
    want_len = len(correct_norm)
    first = correct_norm[:1]

    pool = []
    seen = {correct_norm}
    for cand in candidates:
        key = normalize_answer(cand)
        if not key or key in seen:
            continue
        if looks_numeric(cand) != c_num:
            continue  # не мешаем слова и числа
        seen.add(key)
        pool.append(cand)
    if not pool:
        return []

    def score(cand):
        key = normalize_answer(cand)
        s = 0
        s += 3 if key[:1] == first else 0
        d = abs(len(key) - want_len)
        s += max(0, 2 - d)
        # похожесть текстом тоже учитываем (близкие слова сложнее различать)
        s += int(similarity(key, correct_norm) * 4)
        return -s

    pool.sort(key=score)
    # из наиболее похожих берём немного наугад, чтобы порядок не был предсказуемым
    head = pool[:max(count * 2, count)]
    rng.shuffle(head)
    picked = head[:count]
    if len(picked) < count:
        rest = [c for c in pool if c not in picked]
        rng.shuffle(rest)
        picked += rest[:count - len(picked)]
    return picked


def set_dpi_awareness():
    if os.name != "nt":
        return
    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        try:
            import ctypes
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


# --------------------------------------------------------------------------- #
#  СТАТИСТИКА
# --------------------------------------------------------------------------- #
DEFAULT_STATS = {
    "answered": 0, "correct": 0, "best_streak": 0, "daily_answers": 0,
    "last_day": "", "theme": "Ночь", "accent": "Мята",
    "animations": True, "animation_level": "Плавно",
    "favorite_group": "", "day_streak": 0, "last_study_day": "", "xp": 0,
    "mode": "Все вместе", "input_type": "Выбор вариантов",
    "direction": "DE ➔ RU (Вопрос на немецком)",
    "daily_goal": 10, "session_goal": 10, "hearts": 5,
    "favorites": [], "mistakes": [],
    "auto_images": True, "auto_images_limit": 250, "online_images": False,
    "listen_lang": "de",
    "enabled_groups": [],
    "enabled_words": [],
    "needs_choice": True,
    "games": {"speed": 0, "anagram": 0, "pairs": 0, "quiz": 0, "best_speed": 0,
              "listen": 0, "typing": 0, "images": 0, "sentence": 0},
    "grammar": {"asked": 0, "correct": 0, "sentences": 0},
    # интервальное повторение: box[de] = {b: ящик, n: верных подряд, last: дата}
    "srs": {"box": {}, "due": []},
    # закладки по словам: {regel: {n, ok}, fehler: {n}}
    "words": {},
}


def load_stats(path=STATS_FILE):
    stats = dict(DEFAULT_STATS)
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                stats.update(json.load(f))
    except Exception:
        LOGGER.warning("Не удалось прочитать статистику", exc_info=True)

    today = time.strftime("%Y-%m-%d")
    if stats.get("last_day") != today:
        stats["daily_answers"] = 0
        stats["last_day"] = today

    if not isinstance(stats.get("games"), dict):
        stats["games"] = dict(DEFAULT_STATS["games"])
    else:
        merged = dict(DEFAULT_STATS["games"])
        merged.update(stats["games"])
        stats["games"] = merged
    if not isinstance(stats.get("grammar"), dict):
        stats["grammar"] = dict(DEFAULT_STATS["grammar"])
    else:
        merged_g = dict(DEFAULT_STATS["grammar"])
        merged_g.update(stats["grammar"])
        stats["grammar"] = merged_g
    for key in ("favorites", "mistakes"):
        if not isinstance(stats.get(key), list):
            stats[key] = []
    if not isinstance(stats.get("srs"), dict) or "box" not in stats["srs"]:
        stats["srs"] = {"box": {}, "due": []}
    if not isinstance(stats.get("words"), dict):
        stats["words"] = {}
    return stats


def save_stats(stats, path=STATS_FILE):
    try:
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except Exception:
        LOGGER.warning("Не удалось сохранить статистику", exc_info=True)


# --------------------------------------------------------------------------- #
#  ГЕНЕРАЦИЯ СОСТАВНЫХ ЧИСЕЛ (для режима «Числа»)
# --------------------------------------------------------------------------- #
def random_number_pairs(count=200, rng=random):
    pairs = []
    for _ in range(count):
        n = rng.randint(1, 9999)
        pairs.append(DQPair(number_to_german(n), str(n), "Числа", "number", numeric=n))
    return pairs


def random_phone_pairs(count=60, rng=random):
    pairs = []
    for _ in range(count):
        raw = random_phone(rng)
        pairs.append(DQPair(phone_to_german(raw), raw, "Телефоны", "phone"))
    return pairs
