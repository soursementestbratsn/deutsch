# -*- coding: utf-8 -*-
"""
dq.media — озвучка (TTS) и картинки для слов.

Озвучка:
  1. **edge-tts** (Microsoft Neural, Katja/Conrad) — живой голос; кэш в audio_cache/neural/
  2. Google TTS (переводчик) — запасной вариант; кэш в audio_cache/<md5>.mp3
  3. фоновой потоковый плеер на winmm (Windows) / afplay (macOS) / mpg123 (Linux)

Картинки (по приоритету):
  1. локальные файлы в images/  (старые картинки остаются валидными)
  2. Wikipedia (de) — главное изображение статьи
  3. Wikimedia Commons — поиск по названию
  4. Openverse API — свободные фото (CC)
  5. если ничего не нашлось — рисуем простую ассоциативную картинку в PIL
     (emoji-глиф + подписи DE/RU), чтобы визуализация была всегда.

Все скачанные картинки сохраняются в images/ + карта соответствий в image_cache.json,
поэтому в следующий раз они берутся с диска мгновенно.
"""
import os
import io
import json
import queue
import random
import hashlib
import logging
import threading
import tempfile
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from .core import (CACHE_DIR, IMAGES_DIR, IMAGE_CACHE_JSON, LOGGER, get_audio_id,
                   sanitize_image_name, hex_blend, DQPair)

NEURAL_DIR = os.path.join(CACHE_DIR, "neural")   # живые голоса отдельно от Google-кэша

# Какие нейро-голоса использовать (Edge/azure). Женский — по умолчанию,
# мужской — по настройке voiceGender = "male".
# Доступные голоса (из edge_tts.list_voices()):
# de-DE: TanjaNeural (F), ChristophNeural (M)
# de-AT: IngridNeural (F), JonasNeural (M)
# de-CH: LeniNeural (F), JanNeural (M)
# ru-RU: SvetlanaNeural (F), DmitryNeural (M)
NEURAL_VOICES = {
    ("de", "female"): "de-DE-TanjaNeural",
    ("de", "male"): "de-DE-ChristophNeural",
    ("de", "female_at"): "de-AT-IngridNeural",
    ("de", "male_at"): "de-AT-JonasNeural",
    ("de", "female_ch"): "de-CH-LeniNeural",
    ("de", "male_ch"): "de-CH-JanNeural",
    ("ru", "female"): "ru-RU-SvetlanaNeural",
    ("ru", "male"): "ru-RU-DmitryNeural",
}

# Ключи для выбора варианта голоса (по умолчанию "standard")
VOICE_VARIANTS = {
    "de": ["standard", "austria", "swiss"],
    "ru": ["standard"],
}

# Немецкие аббревиатуры для расширения при озвучке
DE_ABBREVIATIONS = {
    "z.b.": "zum Beispiel",
    "z.b": "zum Beispiel",
    "zb.": "zum Beispiel",
    "usw.": "und so weiter",
    "usw": "und so weiter",
    "etc.": "et cetera",
    "etc": "et cetera",
    "d.h.": "das heißt",
    "d.h": "das heißt",
    "bzw.": "beziehungsweise",
    "bzw": "beziehungsweise",
    "u.a.": "unter anderem",
    "u.a": "unter anderem",
    "ca.": "circa",
    "ca": "circa",
    "ca..": "circa",
    "bspw.": "beispielsweise",
    "bspw": "beispielsweise",
    "ggf.": "gegebenenfalls",
    "ggf": "gegebenenfalls",
    "evtl.": "eventuell",
    "evtl": "eventuell",
    "inkl.": "inklusive",
    "inkl": "inklusive",
    "exkl.": "exklusive",
    "exkl": "exklusive",
    "min.": "minuten",
    "min": "minuten",
    "sek.": "sekunden",
    "sek": "sekunden",
    "std.": "stunden",
    "std": "stunden",
    "wo.": "wochen",
    "wo": "wochen",
    "mo.": "monate",
    "mo": "monate",
    "j.": "jahre",
    "j": "jahre",
    "nr.": "nummer",
    "nr": "nummer",
    "tel.": "telefon",
    "tel": "telefon",
    "fax.": "fax",
    "fax": "fax",
    "email": "e-mail",
    "e-mail": "e-mail",
    "bzw.": "beziehungsweise",
    "m.w.n.": "meines Wissens nach",
    "m.w.n": "meines Wissens nach",
    "i.e.": "id est",
    "i.e": "id est",
    "e.g.": "exempli gratia",
    "e.g": "exempli gratia",
}

# Регулярки для нормализации текста
import re
_NUM_RE = re.compile(r'\b\d+(?:[.,]\d+)?\b')
_ORDINAL_RE = re.compile(r'\b(\d+)(?:\.(?=\s|\.|,|$))')
_PHONE_RE = re.compile(r'(\+?\d[\d\s\-\(\)]{6,}\d)')

# Аббревиатуры: строим паттерны без \b для тех, что содержат точки
_ABBR_KEYS = sorted(DE_ABBREVIATIONS.keys(), key=len, reverse=True)
_ABBR_PATTERNS = []
for k in _ABBR_KEYS:
    if '.' in k:
        # Аббревиатуры с точками: z.B. -> z\.B\. (обязательная точка в конце паттерна)
        # Используем lookbehind/lookahead для границ слова
        pattern = re.escape(k)
        _ABBR_PATTERNS.append(r'(?<!\w)' + pattern + r'(?!\w)')
    else:
        # Обычные слова: \bслово\b
        _ABBR_PATTERNS.append(r'\b' + re.escape(k) + r'\b')
_ABBR_RE = re.compile('|'.join(_ABBR_PATTERNS), re.IGNORECASE)

# --------------------------------------------------------------------------- #
#  ТЕКСТОВАЯ НОРМАЛИЗАЦИЯ ДЛЯ TTS
# --------------------------------------------------------------------------- #

def _expand_abbreviations(text):
    """Расширяет немецкие аббревиатуры в полном виде."""
    def repl(match):
        matched = match.group(0)
        key = matched.lower()
        # Находим соответствующий ключ в словаре (с или без точки)
        dict_key = key if key in DE_ABBREVIATIONS else key.rstrip('.')
        expanded = DE_ABBREVIATIONS.get(dict_key, matched)
        # Если в оригинале была точка, а в расширении её нет — не добавляем
        # (точка уже обработана как часть аббревиатуры)
        return expanded
    return _ABBR_RE.sub(repl, text)


def _number_to_words_de(num_str):
    """Конвертирует число в немецкие слова (базовая реализация)."""
    num_str = num_str.replace(',', '.')
    try:
        if '.' in num_str:
            # Десятичное число
            parts = num_str.split('.')
            whole = int(parts[0])
            frac = parts[1]
            frac_words = ' '.join(_digit_to_de(int(d)) for d in frac)
            return f"{_number_to_german(whole)} komma {frac_words}"
        else:
            return _number_to_german(int(num_str))
    except (ValueError, IndexError):
        return num_str


def _digit_to_de(d):
    """Цифра в немецкое слово."""
    digits = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"]
    return digits[d] if 0 <= d < 10 else str(d)


def _number_to_german(n):
    """Конвертирует целое число в немецкое число (упрощённо, до миллионов)."""
    if n == 0:
        return "null"
    if n < 0:
        return "minus " + _number_to_german(-n)
    
    units = ["", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"]
    teens = ["zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"]
    tens = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"]
    
    if n < 10:
        return units[n]
    if n < 20:
        return teens[n - 10]
    if n < 100:
        ten = n // 10
        unit = n % 10
        if unit == 0:
            return tens[ten]
        return units[unit] + "und" + tens[ten]
    if n < 1000:
        hundred = n // 100
        rest = n % 100
        prefix = units[hundred] + "hundert" if hundred > 1 else "einhundert"
        return prefix + (_number_to_german(rest) if rest else "")
    if n < 1_000_000:
        thousand = n // 1000
        rest = n % 1000
        prefix = _number_to_german(thousand) + "tausend"
        return prefix + (_number_to_german(rest) if rest else "")
    if n < 1_000_000_000:
        million = n // 1_000_000
        rest = n % 1_000_000
        prefix = _number_to_german(million) + ("millionen" if million > 1 else "million")
        return prefix + (_number_to_german(rest) if rest else "")
    return str(n)


def _ordinal_to_german(n):
    """Порядковое число в немецкое (1. -> erste, 2. -> zweite, etc.)."""
    ordinals = {
        1: "erste", 2: "zweite", 3: "dritte", 4: "vierte", 5: "fünfte",
        6: "sechste", 7: "siebte", 8: "achte", 9: "neunte", 10: "zehnte",
        11: "elfte", 12: "zwölfte", 13: "dreizehnte", 14: "vierzehnte", 15: "fünfzehnte",
        16: "sechzehnte", 17: "siebzehnte", 18: "achtzehnte", 19: "neunzehnte", 20: "zwanzigste",
    }
    if n in ordinals:
        return ordinals[n]
    if n < 100:
        return _number_to_german(n) + "ste"
    return _number_to_german(n) + "ste"


def normalize_text_for_tts(text, lang="de"):
    """Подготавливает текст к озвучке: раскрывает аббревиатуры, числа, порядковые."""
    if not text:
        return text
    text = text.strip()
    
    if lang == "de":
        # 1. Телефоны — читаем по цифрам (ДО аббревиатур и чисел!)
        text = _PHONE_RE.sub(lambda m: ' '.join(_digit_to_de(int(d)) for d in m.group(1) if d.isdigit()), text)
        # 2. Аббревиатуры
        text = _expand_abbreviations(text)
        # 3. Порядковые числа (1., 2., etc.) — до обычных чисел!
        text = _ORDINAL_RE.sub(lambda m: _ordinal_to_german(int(m.group(1))), text)
        # 4. Обычные числа (кардинальные)
        text = _NUM_RE.sub(lambda m: _number_to_words_de(m.group(0)), text)
    
    # Убираем лишние пробелы
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def build_ssml(text, lang="de", voice_name=None, slow=False, rate=None, pitch=None, volume=None):
    """Строит SSML для edge-tts с продийными улучшениями."""
    if not text:
        return ""
    
    # Нормализуем текст
    norm_text = normalize_text_for_tts(text, lang)
    
    # Определяем голос
    if not voice_name:
        voice_name = NEURAL_VOICES.get((lang, "female"), "de-DE-TanjaNeural")
    
    # Экранируем XML-спецсимволы в тексте
    import html
    safe_text = html.escape(norm_text)
    
    # Добавляем паузы на знаках препинания для естественности
    # Заменяем знаки препинания на себя + <break>
    safe_text = safe_text.replace('. ', '. <break time="300ms"/> ')
    safe_text = safe_text.replace(', ', ', <break time="200ms"/> ')
    safe_text = safe_text.replace('; ', '; <break time="250ms"/> ')
    safe_text = safe_text.replace(': ', ': <break time="250ms"/> ')
    safe_text = safe_text.replace('! ', '! <break time="300ms"/> ')
    safe_text = safe_text.replace('? ', '? <break time="300ms"/> ')
    safe_text = safe_text.replace('— ', '— <break time="300ms"/> ')
    safe_text = safe_text.replace('– ', '– <break time="300ms"/> ')
    
    # Базовые настройки продии
    rate_val = rate or ("-25%" if slow else "+0%")
    pitch_val = pitch or ("-2Hz" if slow else "+0Hz")
    volume_val = volume or "+0%"
    
    # Строим SSML
    ssml = f'<speak version="1.0" xml:lang="{lang}-{lang.upper()}">'
    ssml += f'<voice name="{voice_name}">'
    ssml += f'<prosody rate="{rate_val}" pitch="{pitch_val}" volume="{volume_val}">'
    ssml += safe_text
    ssml += '</prosody>'
    ssml += '</voice>'
    ssml += '</speak>'
    
    return ssml

try:
    from PIL import Image, ImageDraw, ImageFont, ImageTk
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

USER_AGENT = "DeutschQuest/1.0 (educational vocabulary trainer)"

IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif")

# Слова, для которых мы УЖЕ пробовали искать картинку в интернете.
# Гарантирует, что одно слово не скачивается по два раза (и из тренажёра,
# и из игр, и из фоновой предзагрузки).
_ONLINE_TRIED = set()
_ONLINE_LOCK = threading.Lock()


def _mark_online_tried(de_text):
    """True — если слово ещё не пробовали искать в сети (и помечает его)."""
    key = (de_text or "").strip().lower()
    if not key:
        return False
    with _ONLINE_LOCK:
        if key in _ONLINE_TRIED:
            return False
        _ONLINE_TRIED.add(key)
    return True


def _forget_online_tried(de_text):
    """Снимает пометку, чтобы можно было поискать «другую картинку» ещё раз."""
    key = (de_text or "").strip().lower()
    with _ONLINE_LOCK:
        _ONLINE_TRIED.discard(key)

# --------------------------------------------------------------------------- #
#  ОЗВУЧКА
# --------------------------------------------------------------------------- #
def _audio_key(text, lang="de", slow=False, gender="female", voice_variant="standard"):
    """Имя файла нейро-кэша: слово + параметры произношения."""
    raw = f"{lang}|{gender}|{voice_variant}|{'s' if slow else 'n'}|{text.strip().lower()}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:16] + ".mp3"


def neural_path_for(text, lang="de", slow=False, gender="female", voice_variant="standard"):
    """Путь к закэшированной нейро-озвучке (без сети) или None."""
    path = os.path.join(NEURAL_DIR, _audio_key(text, lang, slow, gender, voice_variant))
    return path if os.path.isfile(path) and os.path.getsize(path) > 1000 else None


_NEURAL_LOCK = threading.Lock()
_NEURAL_FAIL = 0          # подряд неудачных синтезов (сеть недоступна)


def download_neural_audio(text, lang="de", slow=False, gender="female", voice_variant="standard"):
    """Синтез нейро-голосом edge-tts с кэшем. Возвращает путь или None.

    Edge-серверу нужен websockets-клиент, поэтому синтез идёт в отдельном
    asyncio-loop'е (не трогает Tk/сервер); «медленно» — rate -25%.
    Использует SSML для лучшей продии: паузы, нормализация чисел/аббревиатур.
    """
    global _NEURAL_FAIL
    if not text or _NEURAL_FAIL >= 8:       # сеть явно недоступна — не тормозим запросы
        return None
    os.makedirs(NEURAL_DIR, exist_ok=True)
    filepath = neural_path_for(text, lang, slow, gender, voice_variant)
    if filepath:
        return filepath
    try:
        import edge_tts
    except ImportError:
        return None
    
    # Выбираем голос с учётом варианта (standard, austria, swiss)
    voice_key = (lang, gender)
    if lang == "de" and voice_variant != "standard":
        suffix = "at" if voice_variant == "austria" else "ch"
        voice_key = (lang, f"{gender}_{suffix}")
    voice = NEURAL_VOICES.get(voice_key) or NEURAL_VOICES.get((lang, gender)) or NEURAL_VOICES[(lang, "female")]
    
    # Генерируем SSML с нормализацией текста и продией
    ssml = build_ssml(text, lang=lang, voice_name=voice, slow=slow)
    if not ssml:
        return None
    
    temp = None
    try:
        async def _run():
            # Передаём SSML как текст — edge-tts его распознает
            c = edge_tts.Communicate(ssml, voice)
            tmp = os.path.join(NEURAL_DIR, f"tmp_{os.getpid()}_{threading.get_ident()}.mp3")
            await c.save(tmp)
            return tmp
        # собственный loop в отдельном потоке — чтобы не спорить с чужим asyncio
        import asyncio
        tmp_out = None
        try:
            loop = asyncio.new_event_loop()
            try:
                tmp_out = loop.run_until_complete(_run())
            finally:
                loop.close()
        except RuntimeError:
            tmp_out = asyncio.run(_run())
        if not tmp_out or not os.path.isfile(tmp_out) or os.path.getsize(tmp_out) < 1000:
            raise ValueError("empty neural audio")
        with _NEURAL_LOCK:
            filepath = os.path.join(NEURAL_DIR, _audio_key(text, lang, slow, gender, voice_variant))
            os.replace(tmp_out, filepath)
        _NEURAL_FAIL = 0
        return filepath
    except Exception:
        with _NEURAL_LOCK:
            _NEURAL_FAIL = min(20, _NEURAL_FAIL + 1)
        LOGGER.debug("neural tts failed for %r", text, exc_info=True)
        return None
    finally:
        if tmp_out:
            try:
                os.remove(tmp_out)
            except OSError:
                pass


def download_single_audio(text, lang="de"):
    """Скачивает mp3 с Google TTS в кэш. Возвращает путь или None."""
    if not text:
        return None
    os.makedirs(CACHE_DIR, exist_ok=True)
    key = f"{lang}_{text}"
    filepath = os.path.join(CACHE_DIR, f"{get_audio_id(key)}.mp3")
    if os.path.isfile(filepath) and os.path.getsize(filepath) > 0:
        return filepath
    temp_path = None
    try:
        url = ("https://translate.google.com/translate_tts?ie=UTF-8&q="
               + urllib.parse.quote(text) + f"&tl={lang}&client=tw-ob")
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=8) as response:
            audio_data = response.read()
        if not audio_data:
            raise ValueError("empty audio")
        with tempfile.NamedTemporaryFile(dir=CACHE_DIR, suffix=".part", delete=False) as out:
            temp_path = out.name
            out.write(audio_data)
        os.replace(temp_path, filepath)
        return filepath
    except Exception:
        LOGGER.debug("Не удалось скачать аудио для %r", text, exc_info=True)
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
        return None


def audio_path_for(text, lang="de"):
    """Путь к уже закэшированному файлу (без сети) или None."""
    if not text:
        return None
    path = os.path.join(CACHE_DIR, f"{get_audio_id(f'{lang}_{text}')}.mp3")
    if os.path.isfile(path) and os.path.getsize(path) > 0:
        return path
    return None


def ensure_audio_cached_parallel(items, progress_callback=None, max_workers=6):
    """items — список (text, lang). Прогресс: progress_callback(done, total)."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    pending = [(t, l) for t, l in items if t and not audio_path_for(t, l)]
    total = len(pending)
    if not total:
        if progress_callback:
            progress_callback(1, 1)
        return
    lock = threading.Lock()
    state = {"done": 0}

    def task(pair):
        text, lang = pair
        download_single_audio(text, lang)
        with lock:
            state["done"] += 1
            done = state["done"]
        if progress_callback:
            try:
                progress_callback(done, total)
            except Exception:
                pass

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        list(pool.map(task, pending))


def _beep(success):
    """Короткий мягкий тон «верно/неверно».

    Не используем winsound.Beep: он блокирует поток и звучит резко. Здесь —
    тихие плавные тоны через встроенные системные средства.
    """
    try:
        import winsound
        if success:
            winsound.Beep(784, 60)
            winsound.Beep(1047, 80)
        else:
            winsound.Beep(262, 120)
    except Exception:
        # на не-Windows — тихо игнорируем (без «случайных» звуков)
        pass


class AudioPlayer:
    """Один рабочий поток + «поколение» запросов.

    Проблема старой версии: озвучка скачивалась в фоновых потоках и потом
    ставилась в очередь в непредсказуемом порядке — звуки накладывались и
    срабатывали «сами» позже (казалось, что звук идёт впустую).

    Теперь:
      * всё воспроизведение — строго по очереди в одном потоке;
      * у каждого запроса есть generation (generation_id); при смене вопроса
        вызывается cancel_pending() — устаревшие запросы молча отбрасываются;
      * эффект «верно/неверно» вытесняет очередь речи (задержка не нужна);
      * stop() полностью очищает очередь и глушит текущий звук.
    """

    def __init__(self):
        self.items = queue.Queue()
        self._lock = threading.Lock()
        self._gen = 0
        self._current_proc = None
        self._text_pending = {}
        self.worker = threading.Thread(target=self._run, daemon=True)
        self.worker.start()

    # -- управление поколениями ----------------------------------------- #
    def new_generation(self):
        """Начинает новое «поколение»: всё, что ещё в очереди, устаревает."""
        with self._lock:
            self._gen += 1
            return self._gen

    def cancel_pending(self):
        """Гасит очередь и текущую речь при смене вопроса или экрана."""
        self.new_generation()
        while True:
            try:
                self.items.get_nowait()
            except queue.Empty:
                break
        self._interrupt_current()

    def _interrupt_current(self):
        with self._lock:
            proc = self._current_proc
            if proc is None:
                return
            if proc == "mci":
                import ctypes
                ctypes.windll.winmm.mciSendStringW("stop dq_audio", None, 0, 0)
                return
            try:
                proc.terminate()
            except Exception:
                LOGGER.debug("Не удалось остановить текущий звук", exc_info=True)

    def stop(self):
        """Полная остановка: чистим очередь и глушим текущий процесс."""
        self.cancel_pending()

    # -- постановка в очередь ------------------------------------------- #
    def play_mp3(self, filepath, interrupt=False):
        if not filepath:
            return
        if interrupt:
            self.cancel_pending()
        with self._lock:
            gen = self._gen
        self.items.put(("mp3", filepath, gen))

    def play_text(self, text, lang="de", interrupt=False):
        """Озвучить текст: из кэша — сразу, иначе скачать и поставить в очередь."""
        if not text:
            return
        if interrupt:
            self.cancel_pending()
        with self._lock:
            gen = self._gen
        path = audio_path_for(text, lang)
        if path:
            self.items.put(("mp3", path, gen))
            return
        with self._lock:
            key = (lang, text)
            if key in self._text_pending:
                self._text_pending[key].append(gen)
                return
            self._text_pending[key] = [gen]

        def work():
            try:
                got = download_single_audio(text, lang)
            finally:
                with self._lock:
                    request_gens = self._text_pending.pop(key, [])
                    current_gen = self._gen
                if got and current_gen in request_gens:
                    self.items.put(("mp3", got, current_gen))

        threading.Thread(target=work, daemon=True).start()

    def play_effect(self, success=True):
        """Короткий эффект прерывает предыдущую реплику и занимает её место."""
        self.cancel_pending()
        with self._lock:
            gen = self._gen
        self.items.put(("effect", success, gen))

    def _drop_pending_keep_now(self):
        """Удаляет ещё не сыгранную РЕЧЬ из очереди, не трогая текущий звук.

        Короткие эффекты сохраняем — они должны прозвучать поверх/после.
        """
        kept = []
        while True:
            try:
                kept.append(self.items.get_nowait())
            except queue.Empty:
                break
        for item in kept:
            if item[0] == "effect":
                self.items.put(item)

    # -- само воспроизведение ------------------------------------------- #
    def _play_mp3(self, filepath, generation):
        if not filepath or not os.path.isfile(filepath) or os.path.getsize(filepath) == 0:
            return
        alias = "dq_audio"
        try:
            if os.name == "nt":
                import ctypes
                winmm = ctypes.windll.winmm
                winmm.mciSendStringW(f"close {alias}", None, 0, 0)  # на всякий случай
                winmm.mciSendStringW(f'open "{filepath}" type mpegvideo alias {alias}',
                                     None, 0, 0)
                with self._lock:
                    if generation != self._gen:
                        winmm.mciSendStringW(f"close {alias}", None, 0, 0)
                        return
                    self._current_proc = "mci"
                    winmm.mciSendStringW(f"play {alias}", None, 0, 0)
                while True:
                    with self._lock:
                        if generation != self._gen:
                            break
                    mode = ctypes.create_unicode_buffer(32)
                    result = winmm.mciSendStringW(
                        f"status {alias} mode", mode, len(mode), 0)
                    if result or mode.value != "playing":
                        break
                    threading.Event().wait(0.05)
                winmm.mciSendStringW(f"close {alias}", None, 0, 0)
            else:
                import subprocess
                import sys
                if sys.platform == "darwin":
                    proc = subprocess.Popen(["afplay", filepath])
                else:
                    proc = subprocess.Popen(["mpg123", "-q", filepath])
                with self._lock:
                    self._current_proc = proc
                    stale = generation != self._gen
                if stale:
                    proc.terminate()
                proc.wait()
        except Exception:
            LOGGER.debug("playback failed", exc_info=True)
        finally:
            with self._lock:
                self._current_proc = None

    def _run(self):
        while True:
            item = self.items.get()
            kind, value = item[0], item[1]
            gen = item[2] if len(item) >= 3 else None
            # устаревшие запросы (после смены поколения) не играем
            with self._lock:
                if gen is not None and gen != self._gen:
                    continue
            try:
                if kind == "mp3":
                    self._play_mp3(value, gen)
                else:
                    _beep(value)
            except Exception:
                LOGGER.debug("audio worker error", exc_info=True)


AUDIO_PLAYER = AudioPlayer()


# --------------------------------------------------------------------------- #
#  КАРТИНКИ — ПОИСК В ИНТЕРНЕТЕ
# --------------------------------------------------------------------------- #
def _http_json(url, timeout=8):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8", "replace"))


def _http_bytes(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _clean_query(query):
    """Убираем артикли — по ним Wikipedia ничего не находит."""
    q = query.strip()
    for art in ("der ", "die ", "das ", "ein ", "eine ", "den ", "dem ", "des "):
        if q.lower().startswith(art):
            q = q[len(art):]
            break
    return q.strip() or query.strip()


def fetch_wikipedia_image(query, lang="de"):
    q = _clean_query(query)
    if not q:
        return None
    url = (f"https://{lang}.wikipedia.org/w/api.php?action=query&format=json"
           "&prop=pageimages&piprop=thumbnail&pithumbsize=700&redirects=1&titles="
           + urllib.parse.quote(q))
    try:
        data = _http_json(url)
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            thumb = page.get("thumbnail")
            if thumb and thumb.get("source"):
                return _http_bytes(thumb["source"])
    except Exception:
        LOGGER.debug("wikipedia image failed: %s", q, exc_info=True)
    return None


def fetch_commons_image(query):
    q = _clean_query(query)
    if not q:
        return None
    url = ("https://commons.wikimedia.org/w/api.php?action=query&format=json"
           "&generator=search&gsrnamespace=6&gsrlimit=8&prop=imageinfo"
           "&iiprop=url|size|mime&iiurlwidth=700&gsrsearch="
           + urllib.parse.quote(f"filetype:bitmap {q}"))
    try:
        data = _http_json(url)
        pages = list((data.get("query", {}).get("pages") or {}).values())
        # сначала картинки, у которых в названии есть само слово
        ql = q.lower()
        pages.sort(key=lambda p: (ql not in p.get("title", "").lower()))
        for page in pages:
            info = (page.get("imageinfo") or [{}])[0]
            mime = info.get("mime", "")
            if not mime.startswith("image/"):
                continue
            src = info.get("thumburl") or info.get("url")
            if src:
                data_bytes = _http_bytes(src)
                if data_bytes:
                    return data_bytes
    except Exception:
        LOGGER.debug("commons image failed: %s", q, exc_info=True)
    return None


def fetch_openverse_image(query):
    """Openverse — фото под свободными лицензиями."""
    q = _clean_query(query)
    if not q:
        return None
    url = ("https://api.openverse.org/v1/images/?page_size=5&mature=false"
           "&license_type=commercial&q=" + urllib.parse.quote(q))
    try:
        data = _http_json(url)
        for item in data.get("results", []):
            for key in ("thumbnail", "url"):
                src = item.get(key)
                if not src:
                    continue
                try:
                    blob = _http_bytes(src)
                    if blob:
                        return blob
                except Exception:
                    continue
    except Exception:
        LOGGER.debug("openverse image failed: %s", q, exc_info=True)
    return None


# --------------------------------------------------------------------------- #
#  КАРТИНКИ — ОФЛАЙН-ГЕНЕРАЦИЯ (ассоциация + подписи)
# --------------------------------------------------------------------------- #
_EMOJI_FONT_CANDIDATES = (
    r"C:\Windows\Fonts\seguiemj.ttf",
    "/System/Library/Fonts/Apple Color Emoji.ttc",
    "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
)

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


def _load_font(size, emoji=False):
    paths = []
    if emoji:
        paths.extend(_EMOJI_FONT_CANDIDATES)
    paths.extend([
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ])
    for path in paths:
        if path and os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    try:
        return ImageFont.load_default()
    except Exception:
        return None


def _emoji_for(de_text, ru_text=""):
    """Ищем подходящий emoji-глиф по немецкому/русскому слову."""
    low_de = (de_text or "").lower()
    low_ru = (ru_text or "").lower()
    for glyph, de_key, ru_key in EMOJI_HINTS:
        if de_key.lower() in low_de or (ru_key and ru_key in low_ru):
            return glyph
    return "💠"


def generate_simple_image(de_text, ru_text="", size=(640, 400),
                          bg="#151E30", accent="#2EE6A8", show_text=True):
    """Простая ассоциативная картинка: emoji-глиф (+ подписи).

    show_text=False — только картинка-ассоциация без слова/перевода.
    Нужно для игры «Слова по картинкам», где подпись была бы спойлером.
    """
    if not HAS_PIL:
        return None
    img = Image.new("RGB", size, bg)
    draw = ImageDraw.Draw(img)
    w, h = size
    # мягкий круг-подложка
    pad = int(min(w, h) * 0.16)
    draw.ellipse((pad, pad, w - pad, h - pad),
                 fill=hex_blend(bg, accent, 0.16))
    glyph = _emoji_for(de_text, ru_text)

    def center(text, font, y, fill):
        if font is None:
            return
        try:
            box = draw.textbbox((0, 0), text, font=font)
            tw = box[2] - box[0]
        except Exception:
            tw = len(text) * 8
        draw.text(((w - tw) / 2, y), text, font=font, fill=fill)

    if show_text:
        center(glyph, _load_font(int(h * 0.42), emoji=True), h * 0.10, "#FFFFFF")
        center(de_text, _load_font(int(h * 0.115)), h * 0.62, accent)
        if ru_text:
            center(ru_text, _load_font(int(h * 0.085)), h * 0.78, "#C7D2E5")
    else:
        # только крупный глиф по центру, без подписей
        center(glyph, _load_font(int(h * 0.62), emoji=True), h * 0.16, "#FFFFFF")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# --------------------------------------------------------------------------- #
#  ХРАНИЛИЩЕ КАРТИНОК
# --------------------------------------------------------------------------- #
class ImageStore:
    """Кэш картинок: локальные файлы, скачанные из сети и сгенерированные."""

    def __init__(self, images_dir=IMAGES_DIR, index_file=IMAGE_CACHE_JSON, app_bg="#151E30",
                 accent="#2EE6A8"):
        self.dir = images_dir
        self.index_file = index_file
        self.app_bg = app_bg
        self.accent = accent
        self.index = {}
        self._lock = threading.Lock()
        self._tk_cache = {}   # (path, max_w, max_h) -> PhotoImage (держит ссылку)
        self._pil_cache = {}  # path -> PIL.Image
        os.makedirs(self.dir, exist_ok=True)
        self._load_index()

    # -- индекс --------------------------------------------------------- #
    def _load_index(self):
        try:
            if os.path.exists(self.index_file):
                with open(self.index_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    self.index = data
        except Exception:
            LOGGER.warning("Не удалось прочитать image_cache.json", exc_info=True)

    def save_index(self):
        try:
            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump(self.index, f, ensure_ascii=False, indent=2)
        except Exception:
            LOGGER.warning("Не удалось сохранить image_cache.json", exc_info=True)

    @staticmethod
    def _key(de_text):
        return de_text.strip().lower()

    # -- пути ----------------------------------------------------------- #
    def find_file(self, de_text):
        """Локальный файл: индекс → стандартное имя → поиск по префиксу."""
        key = self._key(de_text)
        rel = self.index.get(key)
        if rel:
            path = os.path.join(self.dir, rel)
            if os.path.exists(path):
                return path
        base = sanitize_image_name(de_text)
        if base:
            for ext in IMAGE_EXTS:
                path = os.path.join(self.dir, base + ext)
                if os.path.exists(path):
                    return path
        # «die Zange» в файле может лежать как «zange.png» / «die_zange.jpg»
        clean = sanitize_image_name(_clean_query(de_text))
        if clean and clean != base:
            for ext in IMAGE_EXTS:
                path = os.path.join(self.dir, clean + ext)
                if os.path.exists(path):
                    return path
        return None

    def _target_path(self, de_text, ext=".png"):
        base = sanitize_image_name(de_text) or hashlib.md5(
            de_text.encode("utf-8")).hexdigest()[:10]
        path = os.path.join(self.dir, base + ext)
        i = 2
        while os.path.exists(path) and i < 50:
            alt = os.path.join(self.dir, f"{base}_{i}{ext}")
            if not os.path.exists(alt):
                path = alt
                break
            i += 1
        return path

    def save_bytes(self, de_text, blob, ext=".png"):
        with self._lock:
            path = self._target_path(de_text, ext)
            with open(path, "wb") as f:
                f.write(blob)
            self.index[self._key(de_text)] = os.path.basename(path)
            self.save_index()
        self._pil_cache.pop(path, None)
        return path

    # -- загрузка ------------------------------------------------------- #
    def generate_local(self, de_text, ru_text=""):
        """Мгновенная офлайн-картинка (PIL): смысл слова + подписи. Без сети."""
        blob = generate_simple_image(de_text, ru_text, bg=self.app_bg, accent=self.accent)
        if not blob:
            return None
        try:
            return self.save_bytes(de_text, blob, ".png")
        except Exception:
            LOGGER.debug("Не удалось сохранить сгенерированную картинку", exc_info=True)
            return None

    def fetch_online(self, de_text):
        """Ищет картинку в интернете (Wikipedia → Commons → Openverse).

        Каждое слово ищется в сети РОВНО ОДИН РАЗ за запуск, поэтому картинки
        больше не качаются по два раза из тренажёра и игр одновременно.
        """
        found = self.find_file(de_text)
        if found:
            return found
        if not _mark_online_tried(de_text):
            return None
        for fetcher in (fetch_wikipedia_image, fetch_commons_image, fetch_openverse_image):
            try:
                blob = fetcher(de_text)
            except Exception:
                blob = None
            if blob:
                try:
                    path = self.save_bytes(de_text, blob, ".png")
                    if self._open_pil(path) is not None:
                        return path
                    os.remove(path)
                except Exception:
                    LOGGER.debug("Не удалось сохранить картинку для %r", de_text,
                                 exc_info=True)
        return None

    def ensure_image(self, de_text, ru_text="", allow_network=False, generate=True):
        """Возвращает путь к картинке слова.

        По умолчанию работает ОФЛАЙН: мгновенно рисует простую ассоциацию
        (PIL), а не ждёт медленный поиск в интернете. Сеть включается только
        явно (`allow_network=True`) — например, кнопкой «другая картинка».
        """
        found = self.find_file(de_text)
        if found:
            return found
        if allow_network:
            fetched = self.fetch_online(de_text)
            if fetched:
                return fetched
        if generate:
            return self.generate_local(de_text, ru_text)
        return None

    def prefetch(self, pairs, limit=None, progress=None, stop_event=None):
        """Фоновая предзагрузка картинок для списка DQPair (или (de, ru))."""
        todo = []
        for item in pairs:
            if isinstance(item, DQPair):
                de, ru = item.de, item.ru
            else:
                de, ru = item[0], item[1]
            if not self.find_file(de):
                todo.append((de, ru))
        if limit:
            todo = todo[:limit]
        total = len(todo)
        if progress:
            progress(0, total)
        for i, (de, ru) in enumerate(todo, 1):
            if stop_event is not None and stop_event.is_set():
                break
            # фоновая предзагрузка — офлайн: мгновенно рисуем картинку,
            # чтобы никогда ничего не ждать и не уходить в сеть зря
            self.ensure_image(de, ru, allow_network=False)
            if progress:
                progress(i, total)
        return total

    # -- отрисовка ------------------------------------------------------ #
    def _open_pil(self, path):
        if not HAS_PIL or not path or not os.path.exists(path):
            return None
        if path in self._pil_cache:
            return self._pil_cache[path]
        try:
            img = Image.open(path)
            img.load()
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
            self._pil_cache[path] = img
            return img
        except Exception:
            LOGGER.debug("Не открылась картинка %s", path, exc_info=True)
            return None

    def photo(self, path, max_w=560, max_h=170):
        """PIL.Image → ImageTk.PhotoImage, уменьшенный до max_w×max_h."""
        if not HAS_PIL or not path:
            return None
        cache_key = (path, max_w, max_h)
        if cache_key in self._tk_cache:
            return self._tk_cache[cache_key]
        img = self._open_pil(path)
        if img is None:
            return None
        try:
            copy = img.copy()
            copy.thumbnail((max_w, max_h))
            photo = ImageTk.PhotoImage(copy)
        except Exception:
            LOGGER.debug("Не удалось сделать PhotoImage", exc_info=True)
            return None
        self._tk_cache.clear()  # храним только свежие — экономим память
        self._tk_cache[cache_key] = photo
        return photo

    def hint_colors(self, path):
        """Средний цвет картинки — для цветного фона превью."""
        img = self._open_pil(path)
        if img is None:
            return None
        try:
            small = img.convert("RGB").resize((1, 1))
            r, g, b = small.getpixel((0, 0))
            return f"#{r:02x}{g:02x}{b:02x}"
        except Exception:
            return None


# --------------------------------------------------------------------------- #
#  АВТОЗАГРУЗКА «ПРИ ВХОДЕ»
# --------------------------------------------------------------------------- #
def prepare_media(items, on_progress=None, stop_event=None, want_images=True,
                  image_limit=250, image_store=None):
    """Готовит озвучку (и, при желании, картинки) для списка (text, lang) и DQPair.

    Вызывается в фоне при входе в приложение. on_progress(phase, done, total).
    """
    texts = []
    seen = set()
    for it in items.get("texts", []):
        if it not in seen:
            seen.add(it)
            texts.append(it)

    def audio_cb(done, total):
        if on_progress:
            on_progress("audio", done, total)

    ensure_audio_cached_parallel(texts, audio_cb)

    if want_images and image_store is not None and not (stop_event and stop_event.is_set()):
        pairs = items.get("pairs", [])

        def img_cb(done, total):
            if on_progress:
                on_progress("images", done, total)

        image_store.prefetch(pairs, limit=image_limit, progress=img_cb,
                             stop_event=stop_event)
