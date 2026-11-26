# -*- coding: utf-8 -*-
"""
dq.phonetics — точное немецкое произношение: IPA, слоги, русская транскрипция.

Что умеет:
  describe("Entschuldigung") →
      ipa:        ˈɛntʃʊldɪɡʊŋ        (международный фонетический алфавит, Duden)
      syllables:  En-tschul-di-gung   (деление для доски/карточки)
      ru:         энт-ШУЛЬ-ди-гунг    (русскими буквами, ударение заглавными)
      ruSil:      [энт, ШУЛЬ, ди, гунг]
      stress:     2                   (какой слог ударяется)

Приоритет источников:
  1. pronunciation.json  — собранный словарь (выверенный IPA из Wiktionary/seed);
  2. rules               — фонетизатор по правилам немецкого языка (контекстный:
                           ch → [ç]/[x], sp/st в начале → [ʃp]/[ʃt], -er → [ɐ],
                           -ig → [ɪç], eu → [ɔʏ], ie → [iː] и т. д.).

Для русской транскрипции IPA конвертируется в русские звуки (см. IPA→RU),
а не транслитерируется по буквам — поэтому «Vater» = «ФА-та», а не «ватер».

Модуль чистый (без tkinter/веба) и используется и вебом (через API), и Tk.
"""
import json
import os
import re

from .core import BASE_DIR

PRON_FILE = os.path.join(BASE_DIR, "content", "pronunciation.json")

# --------------------------------------------------------------------------- #
#  СЛОВАРЬ
# --------------------------------------------------------------------------- #
_INDEX = None
_META = {}


def _load():
    global _INDEX
    if _INDEX is not None:
        return _INDEX
    _INDEX = {}
    try:
        with open(PRON_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        _META.update({k: v for k, v in data.items() if k != "words"})
        for k, v in (data.get("words") or {}).items():
            if isinstance(v, str):
                _INDEX[k] = {"ipa": v}
            elif isinstance(v, dict) and v.get("ipa"):
                _INDEX[k] = v
    except FileNotFoundError:
        pass
    except Exception:
        pass
    return _INDEX


_ARTICLES = ("der", "die", "das", "ein", "eine", "dem", "den", "des")
_ART_IPA = {"der": "deːɐ̯", "die": "diː", "das": "das", "dem": "deːm",
            "den": "deːn", "des": "dɛs", "ein": "aɪ̯n", "eine": "ˈaɪ̯nə"}


def _key(word):
    return re.sub(r"\s+", " ", (word or "").strip().lower()).replace("ß", "ss")


def split_article(text):
    """'die Schule' → ('Schule', 'die')."""
    t = (text or "").strip()
    low = t.lower()
    for a in _ARTICLES:
        if low.startswith(a + " "):
            return t[len(a) + 1:], a
    return t, ""


# --------------------------------------------------------------------------- #
#  ПРАВИЛА: IPA
# --------------------------------------------------------------------------- #
# Порядок важен: длинные сочетания раньше коротких, умлауты — до согласных.
_IPA_RULES = [
    ("tsch", "tʃ"), ("dsch", "dʒ"), ("sch", "ʃ"), ("chs", "ks"),
    ("ck", "k"), ("ph", "f"), ("th", "t"), ("qu", "kv"), ("pf", "pf"),
    ("tz", "ts"), ("dt", "t"), ("ng", "ŋ"), ("ß", "s"), ("ss", "s"),
    ("eu", "ɔʏ"), ("äu", "ɔʏ"), ("ei", "aɪ"), ("ai", "aɪ"), ("ey", "aɪ"),
    ("ie", "iː"), ("ieh", "iː"),
    ("aa", "aː"), ("ee", "eː"), ("oo", "oː"),
    ("ä", "ɛ"), ("ö", "œ"), ("ü", "ʏ"),
    ("z", "ts"), ("v", "f"), ("w", "v"), ("j", "j"), ("x", "ks"),
]
_VOW_LONG = "aeiouäöü"
_BACK = set("aou")


def _is_start(text, i):
    return i == 0 or not text[i - 1].isalpha()


def ipa_rules(word):
    """IPA по правилам немецкой орфографии (без словаря)."""
    t = _key(word)
    out, i = [], 0
    n = len(t)
    while i < n:
        ch = t[i]
        nxt = t[i + 1:i + 2]
        # --- контекстные правила ---
        if t.startswith("sch", i):
            out.append("ʃ"); i += 3; continue
        if t.startswith("ch", i):
            prev = t[i - 1] if i else ""
            follow_s = t[i + 2:i + 3]
            if follow_s == "s":
                out.append("ks"); i += 3; continue
            out.append("x" if prev in _BACK else "ç"); i += 2; continue
        if t.startswith("ig", i) and i + 2 == n:
            out.append("ɪç"); i += 2; continue
        if t.startswith("sp", i) and _is_start(t, i):
            out.append("ʃp"); i += 2; continue
        if t.startswith("st", i) and _is_start(t, i):
            out.append("ʃt"); i += 2; continue
        if t.startswith("er", i) and i + 2 == n:
            out.append("ɐ"); i += 2; continue
        if t.startswith("en", i) and i + 2 == n:
            out.append("n̩"); i += 2; continue
        if ch == "s" and i > 0 and t[i - 1] in "aeiouäöü" and nxt in "aeiouäöüy":
            out.append("z"); i += 1; continue        # Sand-между гласными → [z]
        if ch == "s" and (i == 0 or t[i - 1] in "aeiouäöü"):
            out.append("z" if i == 0 else "s"); i += 1; continue
        if ch == "r" and (i + 1 == n or (nxt not in "aeiouäöü" and i > 0
                                         and t[i - 1] in "aeiouäöü")):
            out.append("ɐ̯" if i + 1 == n else "ʁ"); i += 1; continue
        if ch == "h" and i > 0 and t[i - 1] in _VOW_LONG and (
                i + 1 == n or t[i + 1] not in "aeiouäöü"):
            i += 1; continue                          # немое h (ah, eh…)
        if ch == "b" and i + 1 == n:
            out.append("p"); i += 1; continue          # Auslautverhärtung
        if ch == "d" and i + 1 == n:
            out.append("t"); i += 1; continue
        if ch == "g" and i + 1 == n:
            out.append("k"); i += 1; continue
        # --- длинные сочетания и гласные ---
        hit = False
        for a, b in _IPA_RULES:
            if t.startswith(a, i):
                out.append(b); i += len(a); hit = True; break
        if hit:
            continue
        # --- одиночные буквы ---
        single = {"a": "a", "e": "ɛ", "i": "ɪ", "o": "ɔ", "u": "ʊ", "y": "y",
                  "b": "b", "d": "d", "f": "f", "g": "ɡ", "k": "k", "l": "l",
                  "m": "m", "n": "n", "p": "p", "r": "ʁ", "s": "s", "t": "t",
                  "c": "k", "h": "h"}
        out.append(single.get(ch, ch))
        i += 1
    return "".join(out)


_STRESS_PREFIX_UNSTRESSED = ("be", "ge", "ver", "er", "ent", "emp", "zer", "inter")
_SEPARABLE = ("ab", "an", "auf", "aus", "bei", "ein", "mit", "nach", "vor", "zu",
              "weg", "zurück", "durch", "um", "über", "unter", "wieder", "fest", "los")


_IPA_VOWELS = set("aeiouyɛɪʊɔœøɐʌəɵɘʉɯɚɜ")


def _vowel_positions(ipa):
    """Индексы гласных IPA (с учётом дифтонгов: «aɪ̯» — одна вершина)."""
    pos, i = [], 0
    s = ipa or ""
    while i < len(s):
        if s[i] in "ˈˌ":
            i += 1
            continue
        if s[i] in _IPA_VOWELS:
            pos.append(i)
            j = i + 1
            while j < len(s) and (s[j] in "ɪʊʏ̯" or s[j] in _DIACRITICS):
                j += 1
            i = j
            continue
        i += 1
    return pos


_ONSETS = ("ʃʁ", "ʃp", "ʃt", "ʃ", "ts", "tʃ", "pf", "kv", "kn", "ɡʁ", "bʁ", "tʁ",
           "dʁ", "fʁ", "kʁ", "pʁ", "pl", "bl", "kl", "ɡl", "fl", "ʃl", "ʃm", "ʃn")


def _onset_start(ipa, idx):
    """Начало слога перед гласной idx: отодвигаемся через допустимую группу согласных."""
    j = idx
    while j > 0 and ipa[j - 1] not in _IPA_VOWELS and ipa[j - 1] not in "ˈˌ" and ipa[j - 1] != " ":
        j -= 1
    cluster = ipa[j:idx]
    for on in _ONSETS:
        if cluster.endswith(on):
            return j + cluster.rfind(on)
    return idx - 1 if idx > j else j


def add_stress_ipa(ipa):
    """Ставим ˈ ПЕРЕД СОГЛАСНЫМИ ударного слога (как в словарях).

    Wasser → ˈvasɐ, Schule → ˈʃuːlə, Entschuldigung → ɛntˈʃʊldɪɡʊŋ.
    """
    if not ipa or "ˈ" in ipa or "ˌ" in ipa:
        return ipa
    pos = _vowel_positions(ipa)
    if not pos:
        return ipa
    head = re.match(r"^(be|ge|ver|er|ent|emp|zer)", ipa.lower())
    idx = pos[1] if head and len(pos) > 1 else pos[0]
    at = _onset_start(ipa, idx)
    return ipa[:at] + "ˈ" + ipa[at:]


# --------------------------------------------------------------------------- #
#  СЛОГИ
# --------------------------------------------------------------------------- #
def syllables(word):
    """Деление на слоги: корень по немецким правилам (согласная закрывает слог)."""
    t = (word or "").strip()
    if not t or " " in t:
        return []
    plain = t.replace("ß", "ss")
    low = plain.lower()
    nuclei, i = [], 0
    diphthongs = ("ei", "ai", "au", "eu", "äu", "ie", "aa", "ee", "oo")
    while i < len(low):
        if low[i] in "aeiouäöüy":
            size = 1
            for d in diphthongs:
                if low.startswith(d, i):
                    size = len(d)
                    break
            # h, удлиняющая гласную (ah/eh/oh/uh/äh/öh/üh), остаётся в слоге
            if i + size < len(low) and low[i + size] == "h" and (
                    i + size + 1 == len(low) or low[i + size + 1] not in "aeiouäöü"):
                size += 1
            nuclei.append((i, i + size))
            i += size
        else:
            i += 1
    if len(nuclei) <= 1:
        return [t]
    cuts = []
    for k in range(len(nuclei) - 1):
        end_prev = nuclei[k][1]
        start_next = nuclei[k + 1][0]
        between = start_next - end_prev
        if between <= 1:
            cuts.append(start_next)
        else:
            # «…V C C V…» → перед последней согласной: Was|ser, En|tschul…
            cuts.append(start_next - 1)
    # «sch/tch/dsch/ch» неделимы — ерез не резать НИКОГДА (En|t|schul → En|tschul):
    # сдвигаем разрез вправо, к началу кластера
    CLUSTERS = ("sch", "tch", "dsch", "ch")
    safe = []
    for c in cuts:
        for _ in range(4):
            moved = False
            for cl in CLUSTERS:
                j = low.rfind(cl, max(0, c - len(cl) + 1), c + 1)
                if j != -1 and j < c < j + len(cl):
                    c = j + len(cl)
                    moved = True
            if not moved:
                break
        # «ck» стал «kk» при замене? нет: оставляем разрез перед k, слог получает k
        safe.append(min(c, len(low) - 1))
    # «ck» и удвоенные согласные: Was|ser, Zu|cker — разрез между парой
    safe = [c for c in safe if c > 0]
    parts, prev = [], 0
    for c in sorted(set(safe)):
        if c > prev:
            parts.append(plain[prev:c])
            prev = c
    parts.append(plain[prev:])
    return [p for p in parts if p]


# --------------------------------------------------------------------------- #
#  IPA → РУССКИЕ БУКВЫ
# --------------------------------------------------------------------------- #
# Диакритика, которая должна идти ПОСЛЕ своего звука: «aʊ̯» → «ау», не «аур»
_DIACRITICS = "\u032f\u0329\u0303\u031f\u0325\u030c\u02b0\u031e\u0320\u0308\u0339"

_IPA_RU = [
    ("tʃ", "ч"), ("dʒ", "дж"), ("ʃ", "ш"), ("ʒ", "ж"), ("ts", "ц"),
    ("aɪ̯", "ай"), ("aʊ̯", "ау"), ("ɔʏ̯", "ой"),
    ("aɪ", "ай"), ("aʊ", "ау"), ("ɔʏ", "ой"),
    ("eː", "э"), ("iː", "и"), ("oː", "о"), ("uː", "у"),
    ("aː", "а"), ("ɛː", "э"), ("yː", "ю"), ("øː", "ё"),
    ("ʔ", ""),
    ("a", "а"), ("e", "э"), ("ɛ", "э"), ("i", "и"), ("ɪ", "и"),
    ("o", "о"), ("ɔ", "о"), ("u", "у"), ("ʊ", "у"),
    ("y", "ю"), ("ʏ", "ю"), ("œ", "ё"), ("ø", "ё"), ("ə", "е"),
    ("ɐ̯", "р"), ("ɐ", "а"), ("ʁ", "р"), ("r", "р"),
    ("n̩", "н"), ("m̩", "м"), ("l̩", "л"), ("ŋ", "нг"),
    ("ç", "х"), ("x", "х"), ("ʃ", "ш"), ("h", "х"),
    ("ɵ", "ё"), ("ɘ", "э"), ("ʉ", "ю"), ("ɯ", "ы"), ("ɚ", "а"), ("ɜ", "ё"),
    ("v", "в"), ("f", "ф"), ("z", "з"), ("s", "с"), ("b", "б"), ("p", "п"),
    ("d", "д"), ("t", "т"), ("ɡ", "г"), ("g", "г"), ("k", "к"),
    ("m", "м"), ("n", "н"), ("l", "л"), ("j", "й"),
    ("ː", ""), (" ", " "), ("-", "-"),
]

# IPA, где ударение ставится перед согласными слога: «ˈʃʊl» — «ш» уже в ударном
_PROSODIC = set("ʃʧʒɧts")


_RU_VOWELS = set("аеёиоуыэюя")


class _RuSink:
    """Русская запись + границы слогов.

    Слог — от гласной до следующей гласной: «Ва-сэр», «Эн-тшУ-лди-гунг».
    Для «…V C V…» согласный уходит к следующему слогу (Ка-цэ, а не Кац-э).
    Ударный слог (после ˈ) — заглавными.
    """

    def __init__(self):
        self.chars = []          # [(символ, слог)]
        self.stress_at = None
        self.pending_stress = False
        self.syl = 0
        self.last_vowel = None   # индекс гласной текущего слога
        self.run = []            # согласные после неё (индексы в chars)

    def _open(self, carry):
        """Начать новый слог; `carry` согласных переезжает в него."""
        self.syl += 1
        for i in self.run[-carry:] if carry else []:
            self.chars[i] = (self.chars[i][0], self.syl)
        self.run = []

    def emit(self, ch, is_vowel):
        if ch == " ":
            self.chars.append((" ", self.syl))
            self.pending_stress = False
            self.syl += 1
            self.last_vowel = None
            self.run = []
            return
        if not ch:
            return
        is_vowel = bool(is_vowel) and ch[0] in _RU_VOWELS
        if is_vowel:
            if self.last_vowel is not None:
                # C·V → согласный к новому слогу; C·C·V → последний к новому
                self._open(1 if len(self.run) == 1 else (1 if self.run else 0))
            if self.pending_stress:
                self.stress_at = len(self.chars)
                self.pending_stress = False
            self.last_vowel = len(self.chars)
            self.chars.append((ch, self.syl))
        else:
            self.chars.append((ch, self.syl))
            if self.last_vowel is not None:
                self.run.append(len(self.chars) - 1)

    def text(self, stress=False):
        out = []
        for idx, (ch, _s) in enumerate(self.chars):
            if stress and idx == self.stress_at:
                ch = ch.upper()
            out.append(ch)
        return "".join(out)

    def syl_list(self, stress=False):
        buckets = {}
        for idx, (ch, s) in enumerate(self.chars):
            if stress and idx == self.stress_at:
                ch = ch.upper()
            buckets.setdefault(s, []).append(ch)
        out = []
        for k in sorted(buckets):
            s = "".join(buckets[k]).strip()
            if not s:
                continue
            # слог может оказаться без гласной (n̩, r после гласной) — приклеиваем к соседу
            if out and not any(c.lower() in _RU_VOWELS for c in s):
                out[-1] += s
            else:
                out.append(s)
        return out


def _ru_sink(ipa):
    s = ipa or ""
    sink = _RuSink()
    i = 0
    while i < len(s):
        if s[i] in "ˈˌ":
            sink.pending_stress = s[i] == "ˈ"
            i += 1
            continue
        hit = None
        for a, b in _IPA_RU:
            if s.startswith(a, i):
                hit = (a, b)
                break
        if hit:
            a, b = hit
            sink.emit(b, bool(b) and b[0] in _RU_VOWELS)
            i += len(a)
            while i < len(s) and s[i] in _DIACRITICS:
                i += 1
            continue
        ch = s[i]
        if ch in _RU_VOWELS:              # неизвестный гласный (ə, ɵ…) — «э»
            sink.emit("э", True)
        elif ch.isalpha() or ch in "ʀɻɽɹl̥":    # неизвестный согласный — пропускаем
            pass
        i += 1
    return sink


def ipa_to_russian(ipa):
    """«ˈvasɐ» → «ВАса» (без ударения; слоги — в describe())."""
    return _ru_sink(ipa).text(stress=False)


def ipa_to_russian_syllables(ipa):
    """Слоги из самого IPA: «ɛntˈʃʊldɪɡʊŋ» → [энт, ШУЛ, ди, гунг]."""
    return _ru_sink(ipa).syl_list(stress=True)


# --------------------------------------------------------------------------- #
#  ПУБЛИЧНОЕ API
# --------------------------------------------------------------------------- #
def is_german(text):
    """Первое слово латиницей (немецкое), а не кириллицей/цифрами."""
    first = (text or "").strip()[:1]
    return bool(first) and bool(re.match(r"[A-Za-zÄÖÜäöüß]", first))


def _cached(w):
    """Запись из словаря (по точному ключу и без артикля)."""
    idx = _load()
    hit = idx.get(_key(w))
    if hit:
        return hit
    plain, _a = split_article(w)
    return idx.get(_key(plain))


def ipa_of(word):
    """IPA слова (с ударением). Пустая строка, если не получилось."""
    w, art = split_article(word)
    if not w:
        return ""
    head = (_ART_IPA.get(art.lower(), "") + " ") if art else ""
    if " " in w.strip():
        parts = [ipa_of(p) for p in w.split() if p]
        return (head + " ".join(p for p in parts if p)).strip()
    data = _cached(w)
    if data and data.get("ipa"):
        return head + add_stress_ipa(data["ipa"])
    return head + add_stress_ipa(ipa_rules(w))


def syllables_of(word):
    w = split_article(word)[0]
    if not w:
        return []
    data = _cached(w)
    if data and data.get("syl"):
        return [p for p in data["syl"].split("-") if p]
    return syllables(w)


def stress_of(word):
    """Индекс ударного слога (эвристика для немецкого)."""
    syl = syllables_of(word)
    if len(syl) <= 1:
        return 0
    low = [s.lower() for s in syl]
    if low[0] in _SEPARABLE and len(low) > 1:
        return 0
    if low[0] in _STRESS_PREFIX_UNSTRESSED and len(low) > 1:
        return 1
    if low[-1] in ("ung", "heit", "keit", "schaft", "tion", "sion", "tät", "ie", "ei",
                   "iv", "ent", "ant", "ismus") and len(low) > 2:
        return len(low) - 2 if low[-1] in ("ung", "heit", "keit", "schaft", "tät", "ei") else 0
    return 0


def describe(word):
    """Полная карточка произношения — то, что показывается рядом со словом."""
    w, art = split_article(word)
    if not w:
        return {"word": "", "article": "", "ipa": "", "syllables": [], "ru": "",
                "ruSyl": [], "stress": 0, "german": False}
    syl = syllables_of(w)
    ipa = ipa_of(word)
    # русскую запись считаем по IPA БЕЗ артикля; артикль добавляем строкой
    art_ipa = _ART_IPA.get(art.lower(), "") if art else ""
    core_ipa = ipa
    if art_ipa and ipa.startswith(art_ipa):
        core_ipa = ipa[len(art_ipa):].strip()
    art_ru = {"der": "дэр", "die": "ди", "das": "дас", "dem": "дэм", "den": "дэн",
              "des": "дэс", "ein": "айн", "eine": "АЙ-не"}.get(art.lower(), "")
    ru_syl = ipa_to_russian_syllables(core_ipa) if core_ipa else []
    if ru_syl and not any(p[:1].isupper() for p in ru_syl):
        # ударение не пришло из IPA (нет ˈ) — ставим эвристикой по слогам
        st = stress_of(w)
        ru_syl = list(ru_syl)
        ru_syl[min(st, len(ru_syl) - 1)] = ru_syl[min(st, len(ru_syl) - 1)].upper()
    ru = "-".join(ru_syl)
    if art and art_ru:
        ru = art_ru + " " + ru
    return {
        "word": w,
        "article": art,
        "ipa": ipa,
        "syllables": syl,
        "ru": ru,
        "ruSyl": ru_syl,
        "stress": stress_of(w),
        "german": is_german(w),
    }


def _split_ru(text, count):
    """Делит русскую строку на ~count кусков по гласным (не идеально — для подсказки)."""
    text = (text or "").strip()
    if count <= 1 or not text:
        return [text] if text else []
    vowels = "аеёиоуыэюяАЕЁИОУЫЭЮЯ"
    if len(text) < count:
        return [text]
    # каждая гласная — потенциальная вершина слога: режем ПЕРЕД согласной,
    # открывающей следующий слог (а не по приблизительной длине — так честнее)
    idx = [i for i, ch in enumerate(text) if ch in vowels]
    if len(idx) >= count:
        anchors = idx[:count]
        anchors[0] = 0
        out = []
        for k, a in enumerate(anchors):
            start = a
            # согласный кластер перед гласной оставляем в следующем слоге
            while start > 0 and start > (anchors[k - 1] if k else 0) and text[start - 1] in vowels:
                start -= 1
            out.append(start)
        cuts, out = sorted(set(out))[1:], []
        prev = 0
        for c in cuts:
            out.append(text[prev:c])
            prev = c
        out.append(text[prev:])
        return [p for p in out if p]
    seg, out = len(text) / count, []
    prev = 0
    for k in range(1, count):
        cut = int(round(seg * k))
        for shift in (0, 1, -1, 2, -2):
            c = cut + shift
            if prev < c < len(text) and text[c] in vowels:
                cut = c
                break
        out.append(text[prev:cut])
        prev = cut
    out.append(text[prev:])
    return [p for p in out if p]


def describe_text(text):
    """Список карточек для фразы: «Ich verstehe nicht.» → [describe, …]."""
    words = re.findall(r"[A-Za-zÄÖÜäöüß0-9]+", text or "")
    return [describe(w) for w in words]


def to_russian(text):
    """Русская транскрипция любой фразы (артикль — отдельно)."""
    w, art = split_article(text)
    if " " in w.strip() and not art:
        return " ".join(describe(p)["ru"] for p in w.split() if p)
    return describe(text)["ru"]


if __name__ == "__main__":
    import sys as _sys
    for arg in _sys.argv[1:] or ["Wasser", "Entschuldigung", "die Schule", "Bäume",
                                 "Straße", "fünf", "Mädchen", "ich", "Tisch"]:
        d = describe(arg)
        print(("%s -> /%s/ | %s | %s" % (d["word"], d["ipa"],
                                         "-".join(d["syllables"]), d["ru"]))
              .encode("ascii", "backslashreplace").decode("ascii"))
