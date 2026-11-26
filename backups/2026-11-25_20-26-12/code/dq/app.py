# -*- coding: utf-8 -*-
"""
dq.app — приложение Deutsch Quest.

Структура:
    GermanQuestApp  — окно, роутер, оболочка (сайдбар/панель/статистика), данные
    Экраны:         тренировка, база слов, грамматика, прогресс, меню игр
    Игры:           классы на базе QuestionGame + классические (анаграммы, пары)

Новые игры (по запросу):
    • Слух (g_listen)      — слышишь слово и выбираешь/пишешь, что услышал
    • Диктант (g_typing)   — на слух написать слово/число/телефон: по-немецки или по-русски
    • Картинки (g_images)  — показывается картинка, нужно выбрать/написать слово
    • Порядок слов (g_sentence) — собрать предложение из кусочков (грамматика)
"""
import os
import time
import math
import json
import random
import threading
import tkinter as tk
from tkinter import messagebox

from .core import (THEMES, ACCENTS, ACCENT_NAMES, STATUS_COLORS, MODES, DIRECTIONS,
                   ANIMATION_LEVELS, DQPair, LOGGER, CACHE_DIR, IMAGES_DIR,
                   load_words_with_groups, load_data_from_file, load_stats, save_stats,
                   number_to_german, number_to_russian_text, phone_to_german,
                   phone_to_russian, convert_de_to_ru_phonetics, hex_blend,
                   normalize_answer, similarity, is_typo_match, confusing_distractors,
                   looks_numeric, get_audio_id, random_number_pairs,
                   random_phone_pairs, WORDS_FILE, PHRASES_FILE, NUMBERS_FILE,
                   RADIUS, GLASS_REGULAR, GLASS_CLEAR, material_color, specular,
                   deepen, backdrop_gradient)
from .media import (ImageStore, AUDIO_PLAYER, download_single_audio, audio_path_for,
                    prepare_media, HAS_PIL)
from .widgets import (RoundedCard, GlassPanel, Button, OptionTile, ProgressBar, Ring,
                      ScrollFrame, Toast, ChoiceRow, Badge, LetterSlots, ImagePreview,
                      strip_tags)
from .grammar import (GRAMMAR_LESSONS, build_sentence, sentences_as_pairs)
from .gamebase import QuestionGame, MediaMixin

try:
    import speech_recognition as sr
    HAS_SR = True
except ImportError:
    HAS_SR = False


class GermanQuestApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Deutsch Quest")
        self.root.geometry("1380x900")
        self.root.minsize(940, 660)
        self.root.configure(bg=THEMES["Ночь"]["bg"])

        self.font, self.font_display = self._pick_fonts()

        # -- данные и настройки ----------------------------------------- #
        self.stats = load_stats()
        self.theme_name = self.stats.get("theme", "Ночь")
        self.accent_name = self.stats.get("accent", "Мята")
        if self.theme_name not in THEMES:
            self.theme_name = "Ночь"
        if self.accent_name not in ACCENTS:
            self.accent_name = "Мята"
        self.theme = dict(THEMES[self.theme_name])
        self.accent, self.accent2 = ACCENTS[self.accent_name]
        self.animations_enabled = bool(self.stats.get("animations", True))
        self.animation_level = self.stats.get("animation_level", "Плавно")

        self.rng = random.Random()

        # словари
        self.grouped_words = load_words_with_groups(WORDS_FILE)
        self.phrases_raw = load_data_from_file(PHRASES_FILE)
        self.numbers_raw = load_data_from_file(NUMBERS_FILE)
        self.grammar_pairs = sentences_as_pairs()

        self.word_pairs = self._build_word_pairs()
        self.phrase_pairs = [DQPair(de, ru, "Школьные фразы", "phrase")
                             for de, ru in self.phrases_raw]
        self.number_pairs = [DQPair(word, str(num), "Числа", "number", numeric=int(num))
                             for num, word in self.numbers_raw if num.isdigit()]
        self.phone_pairs = random_phone_pairs(60, self.rng)

        first_group = next(iter(self.grouped_words), "Все")
        self.selected_group = self.stats.get("favorite_group") or first_group
        if self.selected_group not in self.grouped_words:
            self.selected_group = first_group
        self.mode = self.stats.get("mode", "Все вместе")
        if self.mode not in [m for m, _ in MODES]:
            self.mode = "Все вместе"
        self.input_type = self.stats.get("input_type", "Выбор вариантов")
        self.direction = self.stats.get("direction", "DE ➔ RU (Вопрос на немецком)")
        if self.direction not in DIRECTIONS:
            self.direction = "DE ➔ RU (Вопрос на немецком)"

        self.daily_goal = int(self.stats.get("daily_goal", 10))
        self.session_goal = int(self.stats.get("session_goal", 10))
        self.session_answered = 0
        self.session_correct = 0
        self.score = 0
        self.streak = 0
        self.best_streak_session = 0
        self.total = 0
        self.xp = int(self.stats.get("xp", 0))
        self.level = max(1, self.xp // 100 + 1)
        self.heart = 5

        # -- состояние тренажёра ---------------------------------------- #
        self.is_answering_blocked = False
        self.pending_next_after = None
        self.pending_timers = []
        self.current_de_text = ""
        self.current_pair = DQPair("", "")
        self.correct_answer = ""
        self.current_photo = None
        self.current_is_favorite = False
        self.current_image_path = None
        self.audio_pending = set()
        self.audio_pending_lock = threading.Lock()
        self.recognizer = sr.Recognizer() if HAS_SR else None
        self.listen_lang = self.stats.get("listen_lang", "de")

        self.anim_jobs = {}
        self.screen = None
        self.overlay = None
        self.game = None
        self._confetti_window = None

        # -- медиа ------------------------------------------------------ #
        self.images = ImageStore(app_bg=self.theme["card"], accent=self.accent)
        self.audio = AUDIO_PLAYER
        self._image_pending = set()
        self._image_lock = threading.Lock()
        self._media_stop = threading.Event()
        self.active_game_obj = None

        self.build_shell()
        self.bind_shortcuts()
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        self.root.bind("<Configure>", self.on_resize)
        self.root.bind_all("<KeyPress>", self.handle_key, add="+")
        self.go("train")
        self.prepare_media_on_start()

    # ================================================================== #
    #  ШРИФТЫ И СТАРТОВАЯ ПОДГОТОВКА
    # ================================================================== #
    def _pick_fonts(self):
        from tkinter import font as tkfont
        families = set(tkfont.families(self.root))
        for candidate in ("SF Pro Text", "Inter", "Segoe UI Variable Text", "Segoe UI",
                          "Helvetica Neue", "Arial"):
            if candidate in families:
                font = candidate
                break
        else:
            font = "TkDefaultFont"
        for candidate in ("SF Pro Display", "Inter Display", "Segoe UI Variable Display",
                          "Segoe UI", "Helvetica Neue"):
            if candidate in families:
                display = candidate
                break
        else:
            display = font
        return font, display

    def _build_word_pairs(self):
        pairs = []
        for group, arr in self.grouped_words.items():
            for de, ru in arr:
                pairs.append(DQPair(de, ru, group, "word"))
        return pairs

    # ================================================================== #
    #  ДАННЫЕ
    # ================================================================== #
    def all_pairs(self):
        return (self.word_pairs + self.phrase_pairs + self.number_pairs +
                self.phone_pairs + self.grammar_pairs)

    def dataset_for_mode(self, mode=None):
        """Возвращает список DQPair для текущего режима обучения."""
        mode = mode or self.mode
        if mode == "ОШИБКИ":
            return self._mistakes_pairs()
        if mode == "Слушание":
            return self.audio_pairs()
        if mode == "Избранное":
            favs = set(self.stats.get("favorites", []))
            return [p for p in self.all_pairs() if p.de in favs] or list(self.word_pairs)
        if mode == "Заучивание по группам":
            return [DQPair(de, ru, self.selected_group, "word")
                    for de, ru in self.grouped_words.get(self.selected_group, [])]
        if mode == "Числа":
            return list(self.number_pairs) + random_number_pairs(120, self.rng)
        if mode == "Телефоны":
            return list(self.phone_pairs) + random_phone_pairs(30, self.rng)
        if mode == "Школьные фразы":
            return list(self.phrase_pairs)
        if mode == "Слова (Duolingo)":
            return list(self.word_pairs)
        if mode == "Грамматика":
            return list(self.grammar_pairs)
        # «Все вместе»
        pool = (list(self.word_pairs) + list(self.phrase_pairs) +
                random_number_pairs(60, self.rng) +
                list(self.grammar_pairs[:12]))
        return pool

    def audio_pairs(self):
        """Слова с озвучкой — для игр «на слух»."""
        pool = list(self.word_pairs) + list(self.phrase_pairs) + list(self.number_pairs)
        return [p for p in pool if p.audio and not p.audio.startswith("Число")]

    def random_pair(self, mode=None):
        pool = self.dataset_for_mode(mode)
        if not pool:
            pool = self.all_pairs()
        return self.rng.choice(pool) if pool else None

    def _mistakes_pairs(self):
        known = {p.de: p for p in self.all_pairs()}
        out = []
        for item in self.stats.get("mistakes", []):
            de, ru = item[0], item[1]
            if de in known:
                out.append(known[de])
            else:
                out.append(DQPair(de, ru, "Ошибки", "word"))
        return out

    def game_pool(self, limit=60, kind=None):
        """Слова для игр: уважаем выбранный режим, но не берём пустые.

        kind — заставить пул быть одного типа ("word"/"phrase"/"number"/"phone").
        Если тип не задан, но в режиме смешаны типы (режим «Все вместе»),
        выбираем самый крупный тип — иначе варианты ответов получаются
        из разных категорий («слово», «300», «Большое спасибо»).
        """
        pool = [p for p in self.dataset_for_mode() if p.de and p.ru]
        if not pool:
            pool = list(self.word_pairs)
        if kind:
            typed = [p for p in pool if getattr(p, "kind", "word") == kind]
            pool = typed or pool
        elif len({getattr(p, "kind", "word") for p in pool}) > 1:
            counts = {}
            for p in pool:
                k = getattr(p, "kind", "word")
                counts.setdefault(k, []).append(p)
            # выбираем самый крупный тип, при равенстве — слова
            best = max(counts.values(), key=len)
            pool = counts.get("word") if len(counts.get("word", [])) >= len(best) else best
        if limit and len(pool) > limit:
            pool = self.rng.sample(pool, limit)
        return pool or list(self.word_pairs)

    # ================================================================== #
    #  МЕДИА
    # ================================================================== #
    def speak(self, text, lang=None, interrupt=False):
        """Озвучить текст через единую очередь (без наложений и «запоздалых» звуков)."""
        if not text:
            return
        lang = lang or "de"
        try:
            self.audio.play_text(text, lang, interrupt=interrupt)
        except Exception:
            LOGGER.debug("speak failed", exc_info=True)

    def speak_current(self):
        self.speak(self.current_de_text or (self.current_pair.audio if self.current_pair else ""),
                   interrupt=True)

    def stop_audio(self):
        """Глушит всё: смена экрана/вопроса не должна оставлять висящих звуков."""
        try:
            self.audio.cancel_pending()
        except Exception:
            LOGGER.debug("stop_audio failed", exc_info=True)

    def request_image(self, de_text, ru_text="", on_ready=None):
        """Асинхронно достаёт картинку слова и вызывает on_ready(path).

        По умолчанию — офлайн: мгновенная простая картинка (PIL), без сети.
        Если в настройках включён «онлайн-поиск», сначала пробуем интернет
        (ровно один раз на слово), а при неудаче рисуем простую.
        """
        path = self.images.find_file(de_text)
        if path:
            if on_ready:
                on_ready(path)
            return path
        with self._image_lock:
            if de_text in self._image_pending:
                return None
            self._image_pending.add(de_text)
        online = bool(self.stats.get("online_images", False))

        def work():
            try:
                got = self.images.ensure_image(de_text, ru_text, allow_network=online)
            finally:
                with self._image_lock:
                    self._image_pending.discard(de_text)
            if got and on_ready:
                self._safe_after(0, lambda: on_ready(got))

        threading.Thread(target=work, daemon=True).start()
        return None

    def regenerate_image(self, de_text, ru_text="", on_ready=None):
        """«Создать простую картинку» — рисуем ассоциацию в PIL."""
        from .media import generate_simple_image
        blob = generate_simple_image(de_text, ru_text, bg=self.theme["card"],
                                     accent=self.accent)
        if not blob:
            self.toast("Нужна библиотека pillow (pip install pillow)", "bad")
            return None
        path = self.images.save_bytes(de_text, blob, ".png")
        if on_ready:
            on_ready(path)
        return path

    def replace_image(self, de_text, ru_text="", on_ready=None):
        """«Другая картинка» — ищем в интернете, минуя кэш «уже пробовали»."""
        from .media import (_forget_online_tried, fetch_commons_image,
                            fetch_openverse_image, fetch_wikipedia_image)
        _forget_online_tried(de_text)
        for fetcher in (fetch_commons_image, fetch_openverse_image, fetch_wikipedia_image):
            blob = None
            try:
                blob = fetcher(de_text)
            except Exception:
                blob = None
            if blob:
                path = self.images.save_bytes(de_text, blob, ".png")
                if self.images._open_pil(path) is not None:
                    if on_ready:
                        on_ready(path)
                    return path
        self.toast("Новых картинок не нашлось", "warn")
        return None

    def prepare_media_on_start(self):
        """При входе догружаем озвучку и картинки в фоне (не блокируя окно)."""
        want_images = bool(self.stats.get("auto_images", True))
        limit = int(self.stats.get("auto_images_limit", 250))
        pairs = (self.word_pairs + self.phrase_pairs + self.number_pairs)

        texts = []
        seen = set()
        for p in pairs:
            for value, lang in ((p.audio, "de"), (p.ru, "ru")):
                if value and (lang, value) not in seen:
                    seen.add((lang, value))
                    texts.append((value, lang))

        def progress(phase, done, total):
            if total and done >= total:
                self.toast("Медиа готово: " + ("озвучка" if phase == "audio" else "картинки"),
                           "ok", 1200)

        if not texts and not want_images:
            return
        threading.Thread(
            target=prepare_media,
            args=({"texts": texts, "pairs": pairs},),
            kwargs={"on_progress": progress, "stop_event": self._media_stop,
                    "want_images": want_images, "image_limit": limit,
                    "image_store": self.images},
            daemon=True,
        ).start()

    # ================================================================== #
    #  АНИМАЦИИ
    # ================================================================== #
    def _steps(self, base=14):
        if self.animation_level == "Мгновенно":
            return 1
        if self.animation_level == "Плавно":
            return int(base * 1.6)
        return base

    def animate_control(self, widget, state):
        """Плавная spring-реакция control-элемента на hover/press.

        Liquid Glass ведёт себя как физический материал: плотность и свет
        меняются МЕДЛЕННО и непрерывно, без резких opacity/scale-скачков.
        Значения состояний заложены в widget.colors(); здесь только
        обеспечивается короткая серия перерисовок с мягким easing.
        """
        if hasattr(widget, "animate_material"):
            widget.animate_material()
            return
        if not hasattr(widget, "redraw"):
            return
        try:
            widget.redraw()
        except tk.TclError:
            return

    def animate(self, widget, bg=None, border=None, steps=None):
        if not isinstance(widget, (Button, RoundedCard)):
            return
        if not self.animations_enabled:
            if isinstance(widget, Button):
                widget.redraw(bg=bg, border=border)
            else:
                widget.set_colors(bg or widget.inner_bg, border or widget.border)
            return
        target_bg = bg
        if target_bg is None:
            return
        start = getattr(widget, "_anim_from", None) or self._widget_bg(widget)
        if start is None or start == target_bg:
            if isinstance(widget, Button):
                widget.redraw(bg=target_bg, border=border)
            else:
                widget.set_colors(target_bg, border)
            return
        steps = max(1, steps or self._steps(8))

        def run(i=0):
            if not widget.winfo_exists():
                return
            p = i / steps
            col = hex_blend(start, target_bg, p)
            widget._anim_from = col if p < 1 else None
            if isinstance(widget, Button):
                widget.redraw(bg=col, border=border)
            else:
                widget.set_colors(col, border)
            if i < steps:
                widget.after(16, run, i + 1)

        run(0)

    def _widget_bg(self, widget):
        if isinstance(widget, Button):
            return widget.colors()[0]
        return widget.inner_bg

    def animate_progress(self, bar):
        def loop():
            if not bar.winfo_exists():
                return
            if bar.tick():
                bar.after(16, loop)
        loop()

    def animate_ring(self, ring):
        def loop():
            if not ring.winfo_exists():
                return
            if ring.tick():
                ring.after(16, loop)
        loop()

    def fade_in(self, widget, direction="up", distance=14, steps=None):
        if not self.animations_enabled or self.animation_level == "Мгновенно":
            return
        steps = max(1, steps or self._steps(10))
        try:
            widget.pack_forget()
        except Exception:
            return

        def run(i=0):
            if not widget.winfo_exists():
                return
            p = i / steps
            try:
                widget.pack(fill="both", expand=True, pady=int(distance * (1 - p)))
            except tk.TclError:
                return
            if i < steps:
                widget.after(18, run, i + 1)

        run(0)

    def pop_in(self, widget):
        if not widget.winfo_exists():
            return
        steps = self._steps(8)
        start_bg = hex_blend(self.theme["card"], self.theme["bg"], 0.5)

        def run(i=0):
            if not widget.winfo_exists():
                return
            p = i / steps
            col = hex_blend(start_bg, self.theme["card2"], p)
            try:
                widget.config(bg=col,
                              highlightbackground=hex_blend(self.theme["line"], self.accent, p * 0.5))
            except tk.TclError:
                return
            for child in widget.winfo_children():
                try:
                    child.config(bg=col)
                except Exception:
                    pass
            if i < steps:
                widget.after(18, run, i + 1)

        run(0)

    def animate_text_in(self, label, text):
        if not self.animations_enabled or self.animation_level == "Мгновенно":
            label.config(text=text)
            return
        steps = self._steps(9)
        t = self.theme
        dim = hex_blend(t["card"], t["bg"], 0.55)

        def run(i=0):
            if not label.winfo_exists():
                return
            p = i / steps
            label.config(text=text, fg=hex_blend(dim, t["text"], p))
            if i < steps:
                label.after(18, run, i + 1)

        run(0)

    def flash_card(self, card, color):
        try:
            card.set_colors(self.theme["card"], color)
        except Exception:
            return
        self.later(280, lambda: card.set_colors(self.theme["card"], None)
                   if card.winfo_exists() else None)

    def shake_card(self, card):
        try:
            card.set_colors(self.theme["card"], STATUS_COLORS["bad"])
        except Exception:
            return
        for i, shift in enumerate((6, 0, 5, 0, 3, 0)):
            self.later(i * 34, lambda s=shift: self._nudge_card(card, s))
        self.later(260, lambda: card.set_colors(self.theme["card"], None)
                   if card.winfo_exists() else None)

    def _nudge_card(self, card, shift):
        try:
            if shift:
                card.pack_configure(padx=(shift, -shift))
            else:
                card.pack_configure(padx=0)
        except Exception:
            pass

    def spawn_confetti(self, anchor=None):
        if not self.animations_enabled:
            return
        anchor = anchor or getattr(self, "lesson", None) or self.content
        try:
            self.root.update_idletasks()
            x, y = anchor.winfo_rootx(), anchor.winfo_rooty()
            width = max(1, anchor.winfo_width())
            height = max(1, anchor.winfo_height())
            transparent = "#010203"
            overlay = tk.Toplevel(self.root)
            overlay.overrideredirect(True)
            overlay.transient(self.root)
            try:
                overlay.wm_attributes("-transparentcolor", transparent)
            except tk.TclError:
                overlay.destroy()
                return
            overlay.geometry(f"{width}x{height}+{x}+{y}")
            canvas = tk.Canvas(overlay, bg=transparent, bd=0, highlightthickness=0)
            canvas.pack(fill="both", expand=True)
            colors = [self.accent, STATUS_COLORS["info"], STATUS_COLORS["warn"],
                      "#FF70A6", "#A98BFF", STATUS_COLORS["ok"]]
            pieces = []
            for _ in range(34):
                px = random.uniform(width * 0.25, width * 0.75)
                py = height * 0.45
                size = random.randint(5, 10)
                item = canvas.create_polygon(px, py, px + size, py, px + size / 2, py + size,
                                             fill=random.choice(colors), outline="")
                pieces.append([item, px, py, random.uniform(-5, 5),
                               random.uniform(-9, -4), size, random.uniform(-math.pi, math.pi)])
            steps = 28 if self.animation_level == "Плавно" else 16

            def tick(step=0):
                if not overlay.winfo_exists() or not anchor.winfo_exists():
                    try:
                        overlay.destroy()
                    except Exception:
                        pass
                    return
                cw = max(1, anchor.winfo_width())
                ch = max(1, anchor.winfo_height())
                overlay.geometry(f"{cw}x{ch}+{anchor.winfo_rootx()}+{anchor.winfo_rooty()}")
                for piece in pieces:
                    item, px, py, vx, vy, size, phase = piece
                    px += vx
                    py += vy
                    vy += 0.38
                    phase += 0.22
                    half = size / 2
                    canvas.coords(item,
                                  px + math.cos(phase) * half, py + math.sin(phase) * half,
                                  px + math.cos(phase + 2.1) * half, py + math.sin(phase + 2.1) * half,
                                  px + math.cos(phase + 4.2) * half, py + math.sin(phase + 4.2) * half)
                    piece[1:5] = [px, py, vx, vy]
                    piece[6] = phase
                if step < steps:
                    canvas.after(24, lambda: tick(step + 1))
                else:
                    overlay.destroy()

            tick()
        except Exception:
            LOGGER.debug("confetti skipped", exc_info=True)

    # ================================================================== #
    #  ИНФРАСТРУКТУРА
    # ================================================================== #
    def safe_config(self, widget, **kwargs):
        if widget is None:
            return
        try:
            if not widget.winfo_exists():
                return
            widget.config(**kwargs)
        except Exception:
            pass

    def safe_set_text(self, widget, text):
        if widget is None:
            return
        try:
            if not widget.winfo_exists():
                return
            if hasattr(widget, "set_text"):
                widget.set_text(text)
            else:
                widget.config(text=text)
        except Exception:
            pass

    def run_action(self, command):
        try:
            command()
        except Exception:
            LOGGER.exception("Ошибка в действии")
            self.toast("Что-то пошло не так", "bad")

    def toast(self, text, kind="info", duration=1700):
        try:
            Toast(self, text, kind, duration)
        except Exception:
            LOGGER.debug("toast failed", exc_info=True)

    def label(self, parent, text="", size=10, weight="normal", fg=None, bg=None, **kw):
        try:
            parent_bg = parent.cget("bg")
        except Exception:
            parent_bg = self.theme["bg"]
        return tk.Label(parent, text=text, font=(self.font, size, weight),
                        fg=fg or self.theme["text"], bg=bg if bg else parent_bg, **kw)

    def clear(self, frame):
        for child in frame.winfo_children():
            child.destroy()

    def later(self, ms, fn):
        timer = self.root.after(ms, fn)
        self.pending_timers.append(timer)
        return timer

    def _safe_after(self, ms, fn):
        """Потокобезопасный root.after: тихо игнорирует вызов вне mainloop/destroyed окна."""
        try:
            if not self.root.winfo_exists():
                return None
            return self.root.after(ms, fn)
        except (RuntimeError, tk.TclError, AttributeError):
            return None

    def cancel_pending(self):
        if self.pending_next_after is not None:
            try:
                self.root.after_cancel(self.pending_next_after)
            except tk.TclError:
                pass
            self.pending_next_after = None
        for timer in self.pending_timers:
            try:
                self.root.after_cancel(timer)
            except tk.TclError:
                pass
        self.pending_timers.clear()

    def on_resize(self, event=None):
        if event is not None and event.widget is not self.root:
            return
        width = self.root.winfo_width()
        if width <= 1:
            return
        if width == getattr(self, "_last_width", None):
            return
        self._last_width = width
        self.apply_responsive()

    def apply_responsive(self):
        """Раскладка двух слоёв: контент + плавающие controls поверх него."""
        w = self.root.winfo_width()
        if w <= 1:
            return
        wide = w >= 1280          # есть место для боковой панели статистики
        show_topnav = w >= 1180   # влезает ли горизонтальная навигация в topbar

        # --- плавающая боковая панель статистики (Glass) ------------------ #
        panel = getattr(self, "side_panel_wrap", None)
        if panel is not None and panel.winfo_exists():
            if wide:
                panel.place(relx=1.0, rely=0.0, x=-22 - 290, y=86, width=290,
                            relheight=1.0, height=-22 - 86 - 96)
            else:
                panel.place_forget()

        # правый отступ контента, когда панель видна
        pad_right = (22 + 290 + 16) if wide else 22
        try:
            self.center_wrap.pack_configure(padx=(22, pad_right))
        except Exception:
            pass

        # --- навигация в topbar (на широких экранах) ---------------------- #
        nav = getattr(self, "topnav", None)
        if nav is not None and nav.winfo_exists():
            if show_topnav:
                nav.pack(side="left", padx=(24, 0))
            else:
                nav.pack_forget()

        # --- плавающий topbar: на всю ширину, высота по содержимому -------- #
        topbar = getattr(self, "topbar", None)
        if topbar is not None and topbar.winfo_exists():
            _, th = topbar.content_size()
            topbar.place(x=22, y=14, width=max(1, w - 44), height=th)
            topbar._redraw()

        # --- tab bar по ширине: компактнее на узких экранах --------------- #
        if self._tabbar_visible:
            self.place_tabbar(compact=w < 1180)
            self.tabbar.update_idletasks()
            self.tabbar._redraw()

        # --- сверху воздух под topbar; перерисуем и фон -------------------- #
        top_pad = 78
        try:
            self.center_wrap.pack_configure(pady=(top_pad, 90))
        except Exception:
            pass
        self._draw_backdrop()

    def build_mobile_bar(self):
        """Устарело: навигация теперь живёт в плавающем tab bar (см. build_tabbar)."""
        self.mobile_bar = None

    # ================================================================== #
    #  СТАТИСТИКА
    # ================================================================== #
    def save_stats(self):
        self.stats.update({
            "theme": self.theme_name, "accent": self.accent_name,
            "animations": self.animations_enabled,
            "animation_level": self.animation_level,
            "favorite_group": self.selected_group, "mode": self.mode,
            "input_type": self.input_type, "direction": self.direction,
            "daily_goal": self.daily_goal, "session_goal": self.session_goal,
            "xp": self.xp, "listen_lang": self.listen_lang,
        })
        save_stats(self.stats)

    def accuracy(self):
        total = self.stats.get("answered", 0)
        if not total:
            return 0
        return round(self.stats.get("correct", 0) / total * 100)

    def register_mistake(self, pair):
        if pair is None:
            return
        mistakes = self.stats.setdefault("mistakes", [])
        item = [pair.de, pair.ru]
        mistakes[:] = [m for m in mistakes if list(m) != item]
        mistakes.insert(0, item)
        del mistakes[25:]
        self.save_stats()

    def award(self, points):
        """XP + учёт ответа (для игр)."""
        self.xp += points
        self.level = max(1, self.xp // 100 + 1)
        self.stats["answered"] = self.stats.get("answered", 0) + 1
        self.stats["correct"] = self.stats.get("correct", 0) + 1
        self.stats["daily_answers"] = self.stats.get("daily_answers", 0) + 1
        self._update_day_streak()
        self.save_stats()
        self.update_stats_panel()

    def record_game(self, key, value, mode="max"):
        games = self.stats.setdefault("games", {})
        current = games.get(key, 0)
        games[key] = max(current, value) if mode == "max" else current + value
        self.save_stats()
    def _update_day_streak(self):
        today = time.strftime("%Y-%m-%d")
        if self.stats.get("last_study_day") == today:
            return
        last_day = self.stats.get("last_study_day", "")
        if last_day:
            try:
                prev = time.strptime(last_day, "%Y-%m-%d")
                now = time.strptime(today, "%Y-%m-%d")
                gap = round((time.mktime(now) - time.mktime(prev)) / 86400)
            except Exception:
                gap = 99
            self.stats["day_streak"] = self.stats.get("day_streak", 0) + 1 if gap == 1 else 1
        else:
            self.stats["day_streak"] = 1
        self.stats["last_study_day"] = today
    # ================================================================== #
    #  ТЕМЫ
    # ================================================================== #
    def apply_theme(self, rebuild=True):
        self.theme = dict(THEMES[self.theme_name])
        self.accent, self.accent2 = ACCENTS[self.accent_name]
        self.images.app_bg = self.theme["card"]
        self.images.accent = self.accent
        self.root.configure(bg=self.theme["bg"])
        if rebuild:
            self.build_shell()
            self.go(self.screen or "train", force=True)

    def set_theme(self, name):
        self.theme_name = name
        self.save_stats()
        self.apply_theme()

    def set_accent(self, name):
        self.accent_name = name
        self.save_stats()
        self.apply_theme()

    # ================================================================== #
    #  ГОРЯЧИЕ КЛАВИШИ
    # ================================================================== #
    def bind_shortcuts(self):
        self.root.bind("<F11>", lambda e: self.toggle_fullscreen())
        self.root.bind("<Escape>", lambda e: self.on_escape())
        self.root.bind("<Control-d>", lambda e: self.cycle_theme())
        self.root.bind("<Control-n>", lambda e: self.skip())
        self.root.bind("<Control-g>", lambda e: self.go("games"))
        self.root.bind("<Control-Shift-D>", lambda e: self.cycle_accent())

    def on_escape(self):
        if self.overlay is not None and self.overlay.winfo_exists():
            self.close_overlay()
        elif self.root.attributes("-fullscreen") in (True, 1, "1"):
            self.toggle_fullscreen()
        return "break"

    def toggle_fullscreen(self):
        fs = self.root.attributes("-fullscreen") in (True, 1, "1")
        self.root.attributes("-fullscreen", not fs)
        return "break"

    def cycle_theme(self):
        names = list(THEMES.keys())
        self.set_theme(names[(names.index(self.theme_name) + 1) % len(names)])
        return "break"

    def cycle_accent(self):
        names = ACCENT_NAMES
        self.set_accent(names[(names.index(self.accent_name) + 1) % len(names)])
        return "break"

    def close(self):
        try:
            self._media_stop.set()
        except Exception:
            pass
        try:
            self.audio.stop()
        except Exception:
            pass
        if self.active_game_obj is not None:
            try:
                self.active_game_obj.finish()
            except Exception:
                pass
        self.save_stats()
        self.root.destroy()

    # ================================================================== #
    #  ОБОЛОЧКА
    # ================================================================== #
    def build_shell(self):
        """Собирает два визуальных слоя: CONTENT LAYER + FLOATING CONTROL LAYER.

          * фон — мягкий градиент-«обои» (среда под всем интерфейсом);
          * контент — плотная поверхность, главный объект;
          * controls — плавающие стеклянные панели (top bar, tab bar, статы).
        """
        for child in self.root.winfo_children():
            child.destroy()
        self.anim_jobs.clear()

        # --- слой 0+1: СРЕДА и КОНТЕНТ ----------------------------------- #
        # Сам shell — Canvas, на котором нарисован мягкий градиент-«обои».
        # Тогда фон виден в «воздухе» между контентом и плавающими панелями,
        # а сами панели/карточки остаются плотными поверхностями (Liquid Glass).
        self.shell = tk.Canvas(self.root, bd=0, highlightthickness=0,
                               bg=self.theme["bg"])
        self.shell.pack(fill="both", expand=True)
        self.shell.bind("<Configure>", self._draw_backdrop)
        self.backdrop = self.shell   # совместимость: рисуем градиент на shell

        # воздух под плавающие controls: сверху topbar (~78px), снизу tab bar
        self.center_wrap = tk.Frame(self.shell, bg=self.theme["bg"])
        self.center_wrap.pack(fill="both", expand=True, padx=(22, 22), pady=(78, 90))
        self.content = tk.Frame(self.center_wrap, bg=self.theme["bg"])
        self.content.pack(fill="both", expand=True)

        # --- слой 2: ПЛАВАЮЩИЕ СТЕКЛЯННЫЕ CONTROLS ------------------------ #
        self.build_topbar()
        self.side_panel_wrap = GlassPanel(self.shell, self, radius=RADIUS["xl"],
                                          material=self.theme.get("glass", GLASS_REGULAR))
        self.side_panel = tk.Frame(self.side_panel_wrap.body,
                                   bg=self.side_panel_wrap.material_color())
        self.side_panel.pack(fill="both", expand=True, padx=8, pady=8)
        self.build_side_panel()
        self.build_tabbar()

        self.root.after(60, self.apply_responsive)
        self.root.bind("<Map>", lambda e: self.root.after(120, self.apply_responsive))

    def _draw_backdrop(self, event=None):
        """Обои: глубокий градиент и мягкий акцент света для iOS-like Liquid Glass."""
        c = self.backdrop
        if not c.winfo_exists():
            return
        w = max(c.winfo_width(), 1)
        h = max(c.winfo_height(), 1)
        c.delete("bg")
        for y, col in backdrop_gradient(self.theme, w, h):
            c.create_line(0, y, w, y, fill=col, tags="bg")

        def diffuse_glow(cx, cy, rx, ry, color, strength):
            for step in range(18, 0, -1):
                scale = step / 18
                amount = strength * (1 - scale) ** 1.5
                fill = hex_blend(self.theme["bg2"], color, amount)
                c.create_oval(cx - rx * scale, cy - ry * scale,
                              cx + rx * scale, cy + ry * scale,
                              fill=fill, outline="", tags="bg")

        diffuse_glow(w * 0.16, h * 0.08, w * 0.58, h * 0.48, self.accent, 0.22)
        diffuse_glow(w * 0.92, h * 0.92, w * 0.48, h * 0.44,
                     "#FFFFFF", 0.055)
        c.tag_lower("bg")

    def build_topbar(self):
        """Верхний floating glass-bar: логотип + навигация + служебные действия."""
        t = self.theme
        self.topbar = GlassPanel(self.shell, self, radius=RADIUS["xl"],
                                 material=t.get("glass", GLASS_REGULAR))
        bar = tk.Frame(self.topbar.body, bg=self.topbar.material_color())
        bar.pack(fill="x", padx=16, pady=10)

        head = tk.Frame(bar, bg=self.topbar.material_color())
        head.pack(side="left")
        logo = tk.Canvas(head, width=38, height=38, bg=self.topbar.material_color(),
                         bd=0, highlightthickness=0)
        logo.pack(side="left")
        logo.create_oval(3, 3, 35, 35, fill=self.accent, outline="")
        logo.create_text(19, 20, text="DQ", fill="#08120D", font=(self.font, 11, "bold"))
        titles = tk.Frame(head, bg=self.topbar.material_color())
        titles.pack(side="left", padx=(10, 0))
        self.label(titles, "Deutsch Quest", 14, "bold",
                   bg=self.topbar.material_color()).pack(anchor="w")
        self.label(titles, f"УРОВЕНЬ {self.level}", 7, "bold", fg=t["faint"],
                   bg=self.topbar.material_color()).pack(anchor="w")

        self.nav_buttons = {}
        self.topnav = tk.Frame(bar, bg=self.topbar.material_color())
        self.topnav.pack(side="left", padx=(24, 0))
        for key, title, icon in (("train", "Тренировка", "▶"),
                                 ("games", "Игры", "◇"),
                                 ("grammar", "Грамматика", "§"),
                                 ("stats", "Прогресс", "◷"),
                                 ("dictionary", "База слов", "▤")):
            self.nav_buttons[key] = self.nav_item(self.topnav, icon, title, key)

        actions = tk.Frame(bar, bg=self.topbar.material_color())
        actions.pack(side="right")
        for title, cmd in (("ОШИБКИ", self.start_mistake_review),
                           ("⚙", self.open_settings)):
            Button(actions, self, title, cmd, ghost=True, size=9, padx=12, pady=7,
                   radius=RADIUS["sm"]).pack(side="left", padx=3)

    def nav_item(self, parent, icon, title, key):
        btn = Button(parent, self, f"{icon}  {title}", lambda k=key: self.go(k), size=10,
                     padx=13, pady=8, radius=RADIUS["md"])
        btn.pack(side="left", padx=3)
        return btn

    def build_tabbar(self):
        """Нижний floating tab bar — плавает НАД контентом, не прилипает к низу."""
        t = self.theme
        self.tabbar = GlassPanel(self.shell, self, radius=RADIUS["capsule"],
                                 material=t.get("glass_clear", GLASS_CLEAR))
        self.tabbar_body = tk.Frame(self.tabbar.body, bg=self.tabbar.material_color())
        self.tabbar_body.pack(fill="x", padx=14, pady=10)
        self.tab_buttons = {}
        items = (("train", "Учить", "▶"), ("games", "Игры", "◇"),
                 ("grammar", "Грамм.", "§"), ("stats", "Прогресс", "◷"),
                 ("dictionary", "Слова", "▤"))
        for key, title, icon in items:
            b = Button(self.tabbar_body, self, f"{icon}  {title}", lambda k=key: self.go(k),
                       ghost=True, size=9, padx=16, pady=9, radius=RADIUS["sm"])
            b.pack(side="left", padx=3)
            self.tab_buttons[key] = b
        self._tabbar_visible = True
        self._tabbar_compact = False
        self.tabbar.update_idletasks()
        self.place_tabbar()

    def place_tabbar(self, compact=False):
        """Размещает tab bar по центру внизу, с воздухом до краёв окна."""
        if not getattr(self, "tabbar", None) or not self.tabbar.winfo_exists():
            return
        width, height = self.tabbar.content_size()
        if compact:
            width = int(width * 0.82)
        x = (self.root.winfo_width() - width) // 2
        y = self.root.winfo_height() - height - 18
        self.tabbar.place(x=max(12, x), y=max(12, y), width=width, height=height)
        self._tabbar_height = height

    def set_tabbar_visible(self, visible):
        """Скрытие/возврат нижнего tab bar при прокрутке (iOS-поведение)."""
        if visible == getattr(self, "_tabbar_visible", True):
            return
        self._tabbar_visible = visible
        if not getattr(self, "tabbar", None) or not self.tabbar.winfo_exists():
            return
        if visible:
            self.tabbar.place_configure(y=self.root.winfo_height() - 300)
            target_y = self.root.winfo_height() - self.tabbar.winfo_reqheight() - 18
            self._slide_tabbar(0, target_y)
        else:
            self.tabbar.place_forget()

    def _slide_tabbar(self, y, target, step=0):
        if not getattr(self, "tabbar", None) or not self.tabbar.winfo_exists():
            return
        self.tabbar.place_configure(y=int(y))
        if step < 10:
            nxt = y + (target - y) * 0.4
            self.tabbar.after(16, lambda: self._slide_tabbar(nxt, target, step + 1))
        else:
            self.tabbar.place_configure(y=int(target))

    def refresh_nav(self):
        game_screens = ("g_speed", "g_anagram", "g_pairs", "g_quiz",
                        "g_listen", "g_typing", "g_images", "g_sentence")

        def active_for(key):
            if key == "games":
                return self.screen == "games" or self.screen in game_screens
            return self.screen == key

        for key, btn in getattr(self, "nav_buttons", {}).items():
            active = active_for(key)
            btn.set_accent(active)
            btn.set_ghost(not active)
        for key, btn in getattr(self, "tab_buttons", {}).items():
            active = active_for(key)
            btn.set_accent(active)
            btn.set_ghost(not active)

    def build_side_panel(self):
        """Панель статистики — живёт внутри плавающей стеклянной панели.

        Внутренние блоки — НЕ стекло поверх стекла, а плотные поверхности
        контента (readable-слой), лежащие на стекле."""
        self.clear(self.side_panel)
        t = self.theme
        panel_bg = self.side_panel.cget("bg")
        self.side_panel_bg = panel_bg
        # внутри стекла карточки чуть светлее фона панели — отделяются материалом
        card_bg = hex_blend(panel_bg, "#FFFFFF", 0.05)

        today = RoundedCard(self.side_panel, card_bg, None, radius=RADIUS["lg"])
        today.pack(fill="x", pady=(0, 12))
        tb = today.body
        self.label(tb, "СЕГОДНЯ", 8, "bold", fg=t["faint"], bg=card_bg).pack(
            anchor="w", padx=15, pady=(14, 8))
        grid = tk.Frame(tb, bg=card_bg)
        grid.pack(fill="x", padx=12, pady=(0, 14))
        grid.grid_columnconfigure(0, weight=1, uniform="st")
        grid.grid_columnconfigure(1, weight=1, uniform="st")
        self.day_stat = self.mini_stat(grid, "0", "ответов", STATUS_COLORS["info"], 0, 0, card_bg)
        self.day_streak_stat = self.mini_stat(grid, "0", "дней", STATUS_COLORS["warn"], 1, 0, card_bg)
        self.accuracy_stat = self.mini_stat(grid, "0%", "точность", STATUS_COLORS["ok"], 0, 1, card_bg)
        self.level_stat = self.mini_stat(grid, "1", "уровень", self.accent, 1, 1, card_bg)

        xp = RoundedCard(self.side_panel, card_bg, None, radius=RADIUS["lg"])
        xp.pack(fill="x", pady=(0, 12))
        xb = xp.body
        self.label(xb, "ПРОГРЕСС УРОВНЯ", 8, "bold", fg=t["faint"], bg=card_bg).pack(
            anchor="w", padx=15, pady=(14, 4))
        row = tk.Frame(xb, bg=card_bg)
        row.pack(fill="x", padx=15)
        self.level_big = self.label(row, str(self.level), 24, "bold", fg=self.accent, bg=card_bg)
        self.level_big.pack(side="left")
        self.xp_label = self.label(row, f"{self.xp % 100} / 100 XP", 8, "bold",
                                   fg=t["faint"], bg=card_bg)
        self.xp_label.pack(side="right", pady=(8, 0))
        self.xp_bar = ProgressBar(xb, self, height=7)
        self.xp_bar.pack(fill="x", padx=15, pady=(9, 15))
        self.xp_bar.set_colors(hex_blend(card_bg, "#000000", 0.18), self.accent)
        self.xp_bar.set_value((self.xp % 100) / 100, animate=False)

        goal = RoundedCard(self.side_panel, card_bg, None, radius=RADIUS["lg"])
        goal.pack(fill="x", pady=(0, 12))
        gb = goal.body
        top = tk.Frame(gb, bg=card_bg)
        top.pack(fill="x", padx=15, pady=(14, 2))
        self.label(top, "ЦЕЛЬ НА СЕГОДНЯ", 8, "bold", fg=t["faint"], bg=card_bg).pack(side="left")
        self.goal_value = self.label(top, f"{self.stats.get('daily_answers', 0)} / {self.daily_goal}",
                                     9, "bold", fg=STATUS_COLORS["ok"], bg=card_bg)
        self.goal_value.pack(side="right")
        self.goal_bar = ProgressBar(gb, self, height=7)
        self.goal_bar.pack(fill="x", padx=15, pady=(8, 12))
        self.goal_bar.set_colors(hex_blend(card_bg, "#000000", 0.18), STATUS_COLORS["ok"])
        self.goal_bar.set_value(min(1, self.stats.get("daily_answers", 0) / max(1, self.daily_goal)),
                                animate=False)

        live = RoundedCard(self.side_panel, card_bg, None, radius=RADIUS["lg"])
        live.pack(fill="x")
        lb = live.body
        head = tk.Frame(lb, bg=card_bg)
        head.pack(fill="x", padx=15, pady=(14, 6))
        self.label(head, "В СЕССИИ", 8, "bold", fg=t["faint"], bg=card_bg).pack(side="left")
        self.hearts_box = tk.Frame(head, bg=card_bg)
        self.hearts_box.pack(side="right")
        self._render_hearts()
        self.session_score_label = self.label(lb, "0 / 0", 26, "bold", bg=card_bg)
        self.session_score_label.pack(anchor="w", padx=15, pady=(4, 0))
        self.label(lb, "правильных ответов", 8, "normal", fg=t["faint"], bg=card_bg).pack(
            anchor="w", padx=15)
        self.combo_label = self.label(lb, "Серия: 0", 9, "bold", fg=STATUS_COLORS["ok"],
                                      bg=card_bg)
        self.combo_label.pack(anchor="w", padx=15, pady=(10, 2))
        self.best_combo_label = self.label(lb, "Лучшее комбо: 0", 9, "bold",
                                           fg=STATUS_COLORS["warn"], bg=card_bg)
        self.best_combo_label.pack(anchor="w", padx=15)
        self.label(lb, "1–4 вариант  •  Enter проверить  •  N далее\n"
                       "Space звук  •  F11 экран  •  Ctrl+G игры",
                   7, "normal", fg=t["faint"], bg=card_bg, justify="left").pack(
            anchor="w", padx=15, pady=(12, 14))

    def _render_hearts(self):
        box = getattr(self, "hearts_box", None)
        if box is None:
            return
        try:
            if not box.winfo_exists():
                return
            self.clear(box)
            bg = box.cget("bg")
            for i in range(5):
                full = i < self.heart
                tk.Label(box, text="♥" if full else "♡", bg=bg,
                         fg=STATUS_COLORS["bad"] if full else self.theme["faint"],
                         font=(self.font, 12, "bold")).pack(side="left")
        except tk.TclError:
            pass

    def mini_stat(self, parent, value, title, color, row, col, bg=None):
        bg = bg or parent.cget("bg")
        box = tk.Frame(parent, bg=bg)
        box.grid(row=row, column=col, sticky="nsew", padx=2, pady=2)
        parent.grid_columnconfigure(col, weight=1)
        lbl = self.label(box, value, 16, "bold", fg=color, bg=bg)
        lbl.pack(anchor="w", padx=6, pady=(6, 0))
        self.label(box, title, 7, "normal", fg=self.theme["faint"],
                   bg=bg).pack(anchor="w", padx=6, pady=(0, 6))
        return lbl

    def build_mobile_bar(self):
        self.mobile_bar = tk.Frame(self.center_wrap, bg=self.theme["panel"])
        for key, title, icon in (("train", "Учить", "▶"), ("games", "Игры", "◆"),
                                 ("grammar", "Грамм.", "§"), ("stats", "Прогресс", "▤"),
                                 ("dictionary", "Слова", "▦")):
            Button(self.mobile_bar, self, f"{icon} {title}", lambda k=key: self.go(k),
                   ghost=True, size=9, pady=8, radius=9).pack(side="left", fill="both",
                                                             expand=True, padx=4, pady=7)

    # ================================================================== #
    #  РОУТЕР
    # ================================================================== #
    def go(self, screen, force=False):
        if self.screen == screen and not force:
            return
        if self.active_game_obj is not None and screen not in ("games",) and screen == self.screen:
            return
        if self.screen == "g_speed" and (screen != "g_speed" or force):
            self._speed_cancel()
        self.cancel_pending()
        self.stop_audio()   # при смене экрана никакие «зависшие» звуки не играют
        if self.active_game_obj is not None and self.screen != screen:
            try:
                self.active_game_obj.finish()
            except Exception:
                LOGGER.debug("game finish failed", exc_info=True)
            self.active_game_obj = None
        self.screen = screen
        self.clear(self.content)
        builders = {
            "train": self.build_train,
            "games": self.build_games,
            "grammar": self.build_grammar,
            "stats": self.build_stats,
            "dictionary": self.build_dictionary,
            "g_speed": self.build_game_speed,
            "g_anagram": self.build_game_anagram,
            "g_pairs": self.build_game_pairs,
            "g_quiz": self.build_game_quiz,
            "g_listen": lambda: self.build_new_game("listen"),
            "g_typing": lambda: self.build_new_game("typing"),
            "g_images": lambda: self.build_new_game("images"),
            "g_sentence": lambda: self.build_new_game("sentence"),
        }
        builder = builders.get(screen, self.build_train)
        try:
            builder()
        except Exception:
            LOGGER.exception("Ошибка экрана %s", screen)
            self.label(self.content, "Не удалось открыть экран", 14, "bold",
                       fg=STATUS_COLORS["bad"]).pack(expand=True)
        self.refresh_nav()
        if self.animations_enabled:
            self.fade_in(self.content, steps=self._steps(10))

    def open_overlay(self, builder, width, height, on_close=None):
        self.close_overlay()
        win = tk.Toplevel(self.root)
        win.configure(bg=self.theme["bg"])
        win.transient(self.root)
        win.resizable(False, False)
        self.overlay = win
        wrap = tk.Frame(win, bg=self.theme["bg"])
        wrap.pack(fill="both", expand=True, padx=20, pady=20)
        card = GlassPanel(wrap, self, radius=RADIUS["xl"],
                          material=self.theme.get("glass", GLASS_REGULAR))
        card.pack(fill="both", expand=True)
        self._overlay_card = card
        self._overlay_body = tk.Frame(card.body, bg=card.material_color())
        self._overlay_body.pack(fill="both", expand=True, padx=22, pady=20)
        try:
            builder(self._overlay_body, win)
        except Exception:
            LOGGER.exception("Ошибка в окне")
        win.update_idletasks()
        w = min(width, self.root.winfo_width() - 80)
        h = min(height, self.root.winfo_height() - 80)
        x = self.root.winfo_rootx() + (self.root.winfo_width() - w) // 2
        y = self.root.winfo_rooty() + (self.root.winfo_height() - h) // 2
        win.geometry(f"{w}x{h}+{max(0, x)}+{max(0, y)}")
        try:
            win.grab_set()
        except Exception:
            pass
        win.bind("<Escape>", lambda e: self.close_overlay())
        return win

    def close_overlay(self):
        if self.overlay is not None:
            try:
                self.overlay.grab_release()
                self.overlay.destroy()
            except Exception:
                pass
            self.overlay = None

    def open_confirm(self, title, text, on_yes):
        def builder(body, win):
            t = self.theme
            self.label(body, title, 18, "bold", bg=t["card"]).pack(anchor="w")
            self.label(body, text, 10, "normal", fg=t["dim"], bg=t["card"], wraplength=380,
                       justify="left").pack(anchor="w", pady=(6, 16))
            row = tk.Frame(body, bg=t["card"])
            row.pack(anchor="e")
            Button(row, self, "ДА", lambda: (self.close_overlay(), on_yes()), accent=True,
                   size=10, padx=20, pady=9).pack(side="left", padx=6)
            Button(row, self, "ОТМЕНА", self.close_overlay, ghost=True, size=10,
                   padx=18, pady=9).pack(side="left")
        self.open_overlay(builder, 460, 230)

    # ------------------------------------------------------------------ #
    #  Экран: тренировка
    # ------------------------------------------------------------------ #
    def build_train(self):
        t = self.theme
        top = tk.Frame(self.content, bg=t["bg"])
        top.pack(fill="x", pady=(0, 12))

        left = tk.Frame(top, bg=t["bg"])
        left.pack(side="left")
        self.label(left, "Тренировка", 26, "bold", bg=t["bg"]).pack(anchor="w")
        self.context_label = self.label(left, "", 9, "bold", fg=t["faint"], bg=t["bg"])
        self.context_label.pack(anchor="w", pady=(2, 0))

        right = tk.Frame(top, bg=t["bg"])
        right.pack(side="right")
        self.session_label = self.label(right, f"Сессия 0 / {self.session_goal}", 10, "bold",
                                        fg=t["dim"], bg=t["bg"])
        self.session_label.pack(anchor="e", pady=(4, 6))
        self.session_bar = ProgressBar(right, self, height=6)
        self.session_bar.set_colors(t["card2"], self.accent)
        self.session_bar.pack(fill="x")

        # --- переключатели ------------------------------------------------ #
        controls = RoundedCard(self.content, t["panel"], None, radius=16)
        controls.pack(fill="x", pady=(0, 12))
        inner = tk.Frame(controls.body, bg=t["panel"])
        inner.pack(fill="x", padx=16, pady=13)

        self.label(inner, "РЕЖИМ", 7, "bold", fg=t["faint"], bg=t["panel"]).pack(anchor="w")
        mode_row = tk.Frame(inner, bg=t["panel"])
        mode_row.pack(fill="x", pady=(6, 0))
        self.mode_buttons = {}
        for name, short in MODES:
            b = Button(mode_row, self, short, lambda m=name: self.set_mode(m), size=9,
                       padx=11, pady=7, radius=9)
            b.pack(side="left", padx=(0, 6))
            self.mode_buttons[name] = b

        opts = tk.Frame(inner, bg=t["panel"])
        opts.pack(fill="x", pady=(12, 0))
        self.label(opts, "ОТВЕТ", 7, "bold", fg=t["faint"], bg=t["panel"]).pack(side="left")
        self.input_buttons = {}
        for label, value in (("Варианты", "Выбор вариантов"), ("Написать", "Ручной ввод")):
            b = Button(opts, self, label, lambda v=value: self.set_input_type(v), size=9,
                       padx=13, pady=6, radius=9)
            b.pack(side="left", padx=(8, 5))
            self.input_buttons[value] = b
        self.label(opts, "НАПРАВЛЕНИЕ", 7, "bold", fg=t["faint"],
                   bg=t["panel"]).pack(side="left", padx=(14, 0))
        self.direction_buttons = {}
        for value, (label, _lang) in DIRECTIONS.items():
            b = Button(opts, self, label, lambda v=value: self.set_direction(v), size=9,
                       padx=12, pady=6, radius=9)
            b.pack(side="left", padx=(8, 5))
            self.direction_buttons[value] = b

        # --- карточка вопроса -------------------------------------------- #
        self.lesson = RoundedCard(self.content, t["card"], None, radius=22, center=True)
        self.lesson.pack(fill="both", expand=True)
        lb = self.lesson.body

        head = tk.Frame(lb, bg=t["card"])
        head.pack(fill="x", padx=24, pady=(18, 0))
        self.badge_label = self.label(head, "", 8, "bold", fg=t["faint"], bg=t["card"])
        self.badge_label.pack(side="left")

        icon_row = tk.Frame(head, bg=t["card"])
        icon_row.pack(side="right")
        self.img_button = Button(icon_row, self, "🖼", self.train_next_image, ghost=True,
                                 size=13, padx=9, pady=2, radius=9)
        self.img_button.pack(side="left", padx=3)
        self.fav_button = Button(icon_row, self, "☆", self.toggle_favorite, ghost=True,
                                 size=14, padx=8, pady=2, radius=9)
        self.fav_button.pack(side="left", padx=3)
        self.audio_button = Button(icon_row, self, "\U0001F50A", self.speak_current, ghost=True,
                                   size=13, padx=11, pady=2, radius=9)
        self.audio_button.pack(side="left", padx=3)

        self.progress_caption = self.label(lb, "", 8, "bold", fg=self.accent, bg=t["card"])
        self.progress_caption.pack(pady=(12, 0))
        self.question = self.label(lb, "—", 34, "bold", bg=t["card"], wraplength=760,
                                   justify="center")
        self.question.pack(padx=34, pady=(4, 0))
        self.phonetics = self.label(lb, "", 13, "normal", fg=t["dim"], bg=t["card"])
        self.phonetics.pack(pady=(4, 8))

        # картинка слова (показывается только когда есть)
        self.image_area = tk.Frame(lb, bg=t["card"])
        self.image_label = tk.Label(self.image_area, bg=t["card"], cursor="hand2")
        self.image_label.pack(expand=True)
        self.image_label.bind("<Button-1>", lambda e: self.train_next_image())

        self.answer_area = tk.Frame(lb, bg=t["card"])
        self.answer_area.pack(fill="x", padx=38, pady=(10, 8))
        self.options_frame = tk.Frame(self.answer_area, bg=t["card"])
        self.entry_frame = tk.Frame(self.answer_area, bg=t["card"])
        self._build_entry_widgets()

        self.status = self.label(lb, "", 11, "bold", bg=t["card"], justify="center",
                                 wraplength=740)
        self.status.pack(pady=(4, 6))
        self.footer_hint = self.label(lb, "", 8, "normal", fg=t["faint"], bg=t["card"])
        self.footer_hint.pack(pady=(0, 14))

        self.option_buttons = []
        self.update_mode_buttons()
        self.update_input_buttons()
        self.update_direction_buttons()
        self.update_stats_panel()
        self.next_question()

    def _build_entry_widgets(self):
        t = self.theme
        for child in self.entry_frame.winfo_children():
            child.destroy()
        self.entry_shell = tk.Frame(self.entry_frame, bg=t["input"], highlightthickness=1,
                                    highlightbackground=t["line"])
        self.entry_shell.pack(side="left", fill="x", expand=True)
        self.entry_input = tk.Entry(self.entry_shell, font=(self.font, 15, "bold"), bg=t["input"],
                                    fg=t["text"], insertbackground=self.accent, relief="flat", bd=0)
        self.entry_input.pack(fill="x", padx=14, ipady=12)
        self.entry_input.bind("<Return>", lambda e: self.check_manual_answer())
        self.voice_button = Button(self.entry_frame, self, "🎙", self.start_voice_input,
                                   ghost=True, size=13, padx=12, pady=8, radius=11)
        self.voice_button.pack(side="left", padx=8)
        self.submit_button = Button(self.entry_frame, self, "ПРОВЕРИТЬ", self.check_manual_answer,
                                    accent=True, size=10, padx=20, pady=9, radius=11)
        self.submit_button.pack(side="left")

    # -- обновление переключателей ------------------------------------- #
    def update_mode_buttons(self):
        for name, b in self.mode_buttons.items():
            b.set_accent(name == self.mode)

    def update_input_buttons(self):
        for value, b in self.input_buttons.items():
            b.set_accent(value == self.input_type)
        # направление нужно для игр на слух: подсказываем какой язык ответа
        if self.input_type == "Ручной ввод":
            self.footer_hint_text = "Enter — проверить  •  микрофон — голосом"
        else:
            self.footer_hint_text = "1–4 — выбрать вариант"

    def update_direction_buttons(self):
        for value, b in self.direction_buttons.items():
            b.set_accent(value == self.direction)

    def set_mode(self, mode):
        self.mode = mode
        self.save_stats()
        self.update_mode_buttons()
        if self.mode == "Слушание":
            self.input_type = "Выбор вариантов"
            self.update_input_buttons()
        if hasattr(self, "context_label"):
            self.next_question()

    def set_input_type(self, value):
        self.input_type = value
        self.save_stats()
        self.update_input_buttons()
        if hasattr(self, "question"):
            self.next_question()

    def set_direction(self, value):
        self.direction = value
        self.save_stats()
        self.update_direction_buttons()
        if hasattr(self, "question"):
            self.next_question()

    def update_stats_panel(self):
        answered_today = min(self.stats.get("daily_answers", 0), 9999)
        self.safe_config(getattr(self, "day_stat", None), text=str(answered_today))
        self.safe_config(getattr(self, "day_streak_stat", None),
                         text=str(self.stats.get("day_streak", 0)))
        self.safe_config(getattr(self, "accuracy_stat", None), text=f"{self.accuracy()}%")
        self.safe_config(getattr(self, "level_stat", None), text=str(self.level), fg=self.accent)
        self.safe_config(getattr(self, "level_big", None), text=str(self.level))
        self.safe_config(getattr(self, "xp_label", None), text=f"{self.xp % 100} / 100 XP")
        self.safe_bar(getattr(self, "xp_bar", None), (self.xp % 100) / 100)
        self.safe_config(getattr(self, "goal_value", None),
                         text=f"{answered_today} / {self.daily_goal}")
        self.safe_bar(getattr(self, "goal_bar", None),
                      min(1, answered_today / max(1, self.daily_goal)))
        self.safe_config(getattr(self, "session_score_label", None),
                         text=f"{self.session_correct} / {self.session_answered}")
        self.safe_config(getattr(self, "combo_label", None), text=f"Серия: {self.streak}")
        self.safe_config(getattr(self, "best_combo_label", None),
                         text=f"Лучшее комбо: {max(self.best_streak_session, self.stats.get('best_streak', 0))}")
        self.safe_bar(getattr(self, "session_bar", None),
                      min(1, self.session_answered / max(1, self.session_goal)))
        self.safe_config(getattr(self, "session_label", None),
                         text=f"Сессия {self.session_answered} / {self.session_goal}")
        self.safe_config(getattr(self, "context_label", None),
                         text=f"{self.mode}  •  {DIRECTIONS[self.direction][0]}")
        group_count = len(self.grouped_words.get(self.selected_group, []))
        self.safe_config(getattr(self, "badge_label", None),
                         text=f"ГРУППА: {self.selected_group}  •  {group_count} СЛОВ")
        self._render_hearts()

    def safe_bar(self, bar, value):
        if bar is None:
            return
        try:
            if bar.winfo_exists():
                bar.set_value(value)
        except Exception:
            pass
    # ------------------------------------------------------------------ #
    #  Тренировка: логика вопроса
    # ------------------------------------------------------------------ #
    def _mode_uses_listening(self):
        return self.mode == "Слушание"

    def next_question(self):
        if not hasattr(self, "question"):
            return
        self.cancel_pending()
        # старый звук вопроса больше не актуален — гасим очередь
        self.stop_audio()
        self.is_answering_blocked = False
        try:
            self.status.config(text="", fg=self.theme["dim"])
        except tk.TclError:
            return

        dataset = self.dataset_for_mode()
        if not dataset:
            self.question.config(text="Нет слов для тренировки")
            self.phonetics.config(text="")
            return

        pair = self.rng.choice(dataset)
        if self._mode_uses_listening():
            pair = self.rng.choice(self.audio_pairs() or dataset)

        self.current_pair = pair
        self.current_de_text = pair.de
        favorites = self.stats.get("favorites", [])
        self.current_is_favorite = pair.de in favorites

        # ответ зависит от направления: DE→RU отвечаем переводом, RU→DE — немецким
        is_ru_to_de = self.direction.startswith("RU")
        question = pair.ru if is_ru_to_de else pair.de
        answer = pair.de if is_ru_to_de else pair.ru
        self.correct_answer = answer

        self.progress_caption.config(
            text=("ПОСЛУШАЙ И ВЫБЕРИ" if self._mode_uses_listening()
                  else ("ВЫБЕРИ ОТВЕТ" if self.input_type == "Выбор вариантов" else "НАПИШИ ОТВЕТ")))
        self.update_stats_panel()

        about_group = pair.group
        self.safe_config(self.badge_label,
                         text=f"ГРУППА: {about_group}  •  {len(dataset)} В ОЧЕРЕДИ")

        self.animate_text_in(self.question, question)
        self.phonetics.config(
            text=convert_de_to_ru_phonetics(pair.de) if not is_ru_to_de else "")
        self.fav_button.set_text("★" if self.current_is_favorite else "☆")
        self.fav_button.set_accent(self.current_is_favorite)

        # --- картинка ---------------------------------------------------- #
        self._show_question_image(pair)

        # --- варианты / ввод -------------------------------------------- #
        for w in self.options_frame.winfo_children():
            w.destroy()
        self.options_frame.pack_forget()
        self.entry_frame.pack_forget()
        self._build_entry_widgets()

        if self.input_type == "Выбор вариантов":
            self.options_frame.pack(fill="x")
            self.build_options(dataset)
        else:
            self.entry_frame.pack(fill="x")
            self.entry_input.delete(0, tk.END)
            self.entry_input.config(bg=self.theme["input"], fg=self.theme["text"],
                                    insertbackground=self.accent)
            self.entry_input.focus_set()

        self.footer_hint.config(
            text="1–4 — выбрать вариант" if self.input_type == "Выбор вариантов"
            else f"Enter — проверить  •  ответ на {'немецком' if is_ru_to_de else 'русском'}")

        # озвучка: при DE→RU всегда произносим слово; в режиме «Слушание» — обязательно
        if pair.audio and not is_ru_to_de:
            self.later(140, lambda: self.speak(pair.audio, "de"))

    def _show_question_image(self, pair):
        """Картинка вопроса: только для отдельных слов (не для фраз и чисел),
        из локального кэша или из сети — с догрузкой в фоне."""
        self.current_photo = None
        self.current_image_path = None
        try:
            self.image_label.config(image="")
        except tk.TclError:
            return

        # фразы («Macht nichts.»), числа и телефоны не визуализируем поиском в Wikipedia
        if getattr(pair, "kind", "word") != "word":
            try:
                self.image_area.pack_forget()
            except Exception:
                pass
            return

        path = self.images.find_file(pair.de)
        if path:
            self._render_train_image(path)
            return

        # картинки ещё нет — мгновенно рисуем простую ассоциацию (без сети),
        # чтобы область не висела пустой; красивую подтянем только если включён
        # онлайн-поиск в настройках
        if not HAS_PIL:
            try:
                self.image_area.pack_forget()
            except Exception:
                pass
            return
        placeholder = self.images.generate_local(pair.de, pair.ru)
        if placeholder:
            self._render_train_image(placeholder)
        else:
            try:
                self.image_area.pack_forget()
            except Exception:
                pass
        if self.stats.get("online_images", False):
            self.request_image(pair.de, pair.ru,
                               on_ready=lambda p, de=pair.de: self._on_train_image(p, de))

    def _on_train_image(self, path, de_text):
        if de_text != self.current_de_text or not path:
            return
        self._render_train_image(path)

    def _render_train_image(self, path):
        photo = self.images.photo(path, 560, 150)
        if photo is None:
            try:
                self.image_area.pack_forget()
            except Exception:
                pass
            return
        self.current_photo = photo
        self.current_image_path = path
        try:
            self.image_label.config(image=photo)
            self.image_area.pack(fill="x", padx=26, pady=(2, 4))
        except tk.TclError:
            pass

    def train_next_image(self):
        """Кнопка 🖼: другая картинка из сети ИЛИ простая созданная, если сети нет."""
        pair = self.current_pair
        if pair is None or not pair.de:
            return
        self.toast("Ищу другую картинку…", "info", 1100)
        if not HAS_PIL:
            return
        de, ru = pair.de, pair.ru

        def on_ready(path):
            if de == self.current_de_text:
                self._render_train_image(path)

        def work():
            from .media import (fetch_commons_image, fetch_openverse_image,
                                fetch_wikipedia_image)
            for fetcher in (fetch_commons_image, fetch_openverse_image,
                            fetch_wikipedia_image):
                try:
                    blob = fetcher(de)
                except Exception:
                    blob = None
                if blob:
                    path = self.images.save_bytes(de, blob, ".png")
                    if self.images._open_pil(path) is not None:
                        self._safe_after(0, lambda p=path: on_ready(p))
                        return
            # не нашли ничего нового — рисуем простую картинку
            from .media import generate_simple_image
            blob = generate_simple_image(de, ru, bg=self.theme["card"], accent=self.accent)
            if blob:
                path = self.images.save_bytes(de, blob, ".png")
                self._safe_after(0, lambda p=path: on_ready(p))

        threading.Thread(target=work, daemon=True).start()

    def build_options(self, dataset):
        t = self.theme
        is_ru_to_de = self.direction.startswith("RU")
        current_kind = getattr(self.current_pair, "kind", "word")
        # отвлекающие варианты берём ТОГО ЖЕ типа (слова к словам, числа к числам),
        # иначе к фразе подмешивались бы числа и телефоны
        same_kind, other = [], []
        for p in (dataset + self.all_pairs()):
            val = p.de if is_ru_to_de else p.ru
            if not val or normalize_answer(val) == normalize_answer(self.correct_answer):
                continue
            (same_kind if getattr(p, "kind", "word") == current_kind else other).append(val)
        # делаем варианты похожими на ответ, чтобы нельзя было угадать по принципу
        # «это явно не цифра/не масло». confusing_distractors отсеивает чужие типы
        # (числа к словам) и предпочитает близкие по виду/длине слова
        options_wrong = confusing_distractors(self.correct_answer, same_kind,
                                              count=3, rng=self.rng)
        if len(options_wrong) < 3:
            extra = confusing_distractors(self.correct_answer, other, count=3,
                                          rng=self.rng)
            for v in extra:
                if len(options_wrong) >= 3:
                    break
                if normalize_answer(v) != normalize_answer(self.correct_answer):
                    options_wrong.append(v)
        # последняя страховка: если своего типа совсем не хватило, добираем любыми
        # разными значениями, кроме правильного ответа (лишь бы было 4 кнопки)
        if len(options_wrong) < 3 and not looks_numeric(self.correct_answer):
            for v in list(dict.fromkeys(same_kind + other)):
                if len(options_wrong) >= 3:
                    break
                if normalize_answer(v) != normalize_answer(self.correct_answer):
                    options_wrong.append(v)
        options = options_wrong[:3] + [self.correct_answer]
        self.rng.shuffle(options)

        self.option_buttons = []
        for idx, option in enumerate(options):
            row, col = divmod(idx, 2)
            tile = OptionTile(self.options_frame, self, idx, option,
                              command=lambda o=option: self.check_option_answer(o))
            tile.grid(row=row, column=col, sticky="nsew", padx=5, pady=5)
            self.options_frame.grid_columnconfigure(col, weight=1)
            self.option_buttons.append((tile, option))
            if self.animations_enabled:
                tile.after(int(idx * 55), lambda tl=tile: self.pop_in(tl))

    # -- проверка ответов ------------------------------------------------ #
    def register_answer(self, correct):
        self.total += 1
        self.session_answered += 1
        if correct:
            self.session_correct += 1
            self.score += 1
            self.streak += 1
            self.best_streak_session = max(self.best_streak_session, self.streak)
            self.stats["correct"] = self.stats.get("correct", 0) + 1
            self.stats["best_streak"] = max(self.stats.get("best_streak", 0), self.streak)
            self.xp += 12 + min(self.streak, 8)
        else:
            self.streak = 0
            self.xp += 3
            self.register_mistake(self.current_pair)
        self.stats["answered"] = self.stats.get("answered", 0) + 1
        self.stats["daily_answers"] = self.stats.get("daily_answers", 0) + 1
        self.level = max(1, self.xp // 100 + 1)
        self._update_day_streak()
        self.save_stats()
        self.update_stats_panel()

    def answer_feedback(self, correct, show_answer=True):
        if correct:
            self.status.config(text=f"ПРАВИЛЬНО   +{12 + min(self.streak, 8)} XP",
                               fg=STATUS_COLORS["ok"])
            self.audio.play_effect(True)
            if self.current_pair and self.current_pair.audio:
                self.speak(self.current_pair.audio, "de")
            self.flash_card(self.lesson, STATUS_COLORS["ok"])
        else:
            self.heart = max(0, self.heart - 1)
            self._render_hearts()
            self.status.config(text=f"ОТВЕТ:  {self.correct_answer}", fg=STATUS_COLORS["bad"])
            self.audio.play_effect(False)
            self.shake_card(self.lesson)
        if self.session_answered >= self.session_goal:
            self.status.config(text=self.status.cget("text") + "   •   ЦЕЛЬ СЕССИИ ВЫПОЛНЕНА",
                               fg=STATUS_COLORS["warn"])
            self.toast("Сессия завершена! Цель выполнена", "ok", 2400)
        if self.heart <= 0:
            self._game_over()

    def _game_over(self):
        self.heart = 5
        self._render_hearts()
        self.toast("Жизни закончились — начинаем заново", "bad", 2600)
        self.session_answered = 0
        self.session_correct = 0
        self.streak = 0
        self.update_stats_panel()
        self.later(900, self.next_question)

    def check_option_answer(self, selected):
        if self.is_answering_blocked:
            return
        self.is_answering_blocked = True
        correct = normalize_answer(selected) == normalize_answer(self.correct_answer)
        self.register_answer(correct)
        correct_key = normalize_answer(self.correct_answer)
        selected_key = normalize_answer(selected)
        for tile, option in self.option_buttons:
            key = normalize_answer(option)
            if key == correct_key:
                tile.set_state("correct")
            elif key == selected_key and not correct:
                tile.set_state("wrong")
            else:
                tile.set_state("dim")
            tile.set_enabled(False)
        self.answer_feedback(correct)
        if correct:
            self.spawn_confetti(self.lesson)
        self.schedule_next()

    def check_manual_answer(self):
        if self.is_answering_blocked or not hasattr(self, "entry_input"):
            return
        user = normalize_answer(self.entry_input.get())
        if not user:
            self.toast("Введи ответ", "warn")
            return
        self.is_answering_blocked = True
        correct = (user == normalize_answer(self.correct_answer)
                   or is_typo_match(user, self.correct_answer))
        close = not correct and similarity(user, self.correct_answer) > 0.85
        self.register_answer(correct)
        color = STATUS_COLORS["ok"] if correct else (
            STATUS_COLORS["warn"] if close else STATUS_COLORS["bad"])
        self.entry_shell.config(bg=color, highlightbackground=color)
        self.entry_input.config(bg=color, fg="#08120D" if correct else "#FFFFFF")
        if correct and user != normalize_answer(self.correct_answer):
            # засчитали, но были опечатки — скажем об этом
            self.status.config(text=f"ЗАСЧИТАНО С ОПЕЧАТКОЙ  •  верно: {self.correct_answer}",
                               fg=STATUS_COLORS["ok"])
            self.audio.play_effect(True)
            self.spawn_confetti(self.lesson)
            self.schedule_next(1500)
            return
        if close:
            self.status.config(text=f"ПОЧТИ! Правильно: {self.correct_answer}",
                               fg=STATUS_COLORS["warn"])
            self.audio.play_effect(True)
            self.shake_card(self.lesson)
            self.schedule_next(1700)
            return
        self.answer_feedback(correct)
        if correct:
            self.spawn_confetti(self.lesson)
        self.schedule_next()

    def schedule_next(self, delay=1200):
        def advance():
            self.pending_next_after = None
            if hasattr(self, "question"):
                self.next_question()

        self.cancel_pending()
        self.pending_next_after = self.root.after(delay, advance)

    def skip(self):
        if hasattr(self, "question") and self.screen == "train":
            self.next_question()
        return "break"

    def handle_key(self, event):
        """Глобальная клавиатура: ведём её в зависимости от активного экрана.

        Цифры 1–4 работают и в тренажёре, и в играх (Скорость, Слух и т.п.),
        где варианты — это кнопки, а не поле ввода.
        """
        # 1) поле ввода всегда имеет приоритет
        try:
            if event.widget.winfo_toplevel() is not self.root:
                return
        except (AttributeError, tk.TclError):
            return
        if self.overlay is not None and self.overlay.winfo_exists():
            return

        focused = self.root.focus_get()
        if focused is not None and focused.winfo_class() == "Entry":
            return

        screen = self.screen
        ch = event.char if event.char and event.char in "1234" else event.keysym
        if ch.startswith("KP_") and ch[-1:] in "1234":
            ch = ch[-1]

        # --- тренажёр --------------------------------------------------- #
        if screen == "train" and hasattr(self, "entry_input"):
            if ch in "1234" and self.input_type == "Выбор вариантов":
                idx = int(ch) - 1
                if idx < len(self.option_buttons):
                    self.check_option_answer(self.option_buttons[idx][1])
                    return "break"
            elif event.keysym.lower() == "n" and not (event.state & 0x0004):
                self.next_question()
                return "break"
            elif event.keysym == "space" and self.current_de_text:
                self.speak_current()
                return "break"
            return

        # --- игра «Скорость» ------------------------------------------- #
        if screen == "g_speed" and self._speed_number_key(ch):
            return "break"
        if screen == "g_speed" and event.keysym == "space":
            pair = self.speed_state.get("current")
            if pair is not None and pair.audio:
                self.speak(pair.audio, "de", interrupt=True)
            return "break"

        # --- игры на базе QuestionGame (Слух / Картинки / Викторина) --- #
        if screen in ("g_listen", "g_images", "g_quiz") and self.active_game_obj:
            if ch in "1234" and self._game_number_key(int(ch) - 1):
                return "break"
            if event.keysym == "space" and hasattr(self.active_game_obj, "replay"):
                self.active_game_obj.replay()
                return "break"
            return

        # --- диктант: пробел = повторить --------------------------------- #
        if screen == "g_typing" and self.active_game_obj \
                and event.keysym == "space":
            self.active_game_obj.replay()
            return "break"

    def _speed_number_key(self, ch):
        """1–4 в «Скорости» выбирают вариант. Возвращает True, если обработано."""
        if ch.startswith("KP_") and ch[-1:] in "1234":
            ch = ch[-1]
        if ch not in "1234":
            return False
        st = getattr(self, "speed_state", None)
        if not st or not st.get("running"):
            return False
        options = st.get("options") or []
        idx = int(ch) - 1
        if idx < len(options):
            self._speed_answer(options[idx])
            return True
        return False

    def _game_number_key(self, idx):
        """1–4 в играх QuestionGame: нажимаем соответствующую кнопку варианта."""
        game = self.active_game_obj
        buttons = getattr(game, "_buttons", None)
        if not buttons or idx >= len(buttons):
            return False
        if getattr(game, "_answered", False):
            return False
        button, _option = buttons[idx]
        # короткий подсветочный «отжим» — визуально как клик
        try:
            button._hover = True
            button._pressed = False
            button.redraw(bg=STATUS_COLORS["info"], border=STATUS_COLORS["info"], fg="#07110D")
        except tk.TclError:
            return False
        self.root.after(70, lambda b=button: b._release(None) if b.winfo_exists() else None)
        return True

    # -- избранное / аудио / голос --------------------------------------- #
    def toggle_favorite(self):
        if not self.current_de_text:
            return
        favorites = self.stats.setdefault("favorites", [])
        if self.current_de_text in favorites:
            favorites.remove(self.current_de_text)
            self.current_is_favorite = False
        else:
            favorites.append(self.current_de_text)
            self.current_is_favorite = True
        self.fav_button.set_text("★" if self.current_is_favorite else "☆")
        self.fav_button.set_accent(self.current_is_favorite)
        self.save_stats()
        self.toast("Добавлено в избранное" if self.current_is_favorite else "Убрано из избранного")

    def start_voice_input(self):
        if not HAS_SR:
            messagebox.showerror("Микрофон",
                                 "Установи библиотеки:\npip install SpeechRecognition pyaudio")
            return
        self.voice_button.set_text("…")
        lang = "de-DE" if self.direction.startswith("RU") else "ru-RU"

        def listen():
            try:
                with sr.Microphone() as source:
                    self.recognizer.adjust_for_ambient_noise(source, duration=0.3)
                    audio = self.recognizer.listen(source, timeout=4, phrase_time_limit=5)
                    text = self.recognizer.recognize_google(audio, language=lang)

                def apply():
                    if hasattr(self, "entry_input") and self.entry_input.winfo_exists():
                        self.entry_input.delete(0, tk.END)
                        self.entry_input.insert(0, text)
                    if hasattr(self, "voice_button") and self.voice_button.winfo_exists():
                        self.voice_button.set_text("🎙")
                self.root.after(0, apply)
            except Exception:
                def restore():
                    if hasattr(self, "voice_button") and self.voice_button.winfo_exists():
                        self.voice_button.set_text("🎙")
                self.root.after(0, restore)

        threading.Thread(target=listen, daemon=True).start()
    # ================================================================== #
    #  ЭКРАН: ГРАММАТИКА (уроки + тренажёр порядка слов)
    # ================================================================== #
    def build_grammar(self):
        t = self.theme
        top = tk.Frame(self.content, bg=t["bg"])
        top.pack(fill="x", pady=(0, 12))
        self.label(top, "Грамматика", 26, "bold", bg=t["bg"]).pack(anchor="w")
        self.label(top, "Короткие правила + тренажёр порядка слов", 9, "bold",
                   fg=t["faint"], bg=t["bg"]).pack(anchor="w", pady=(2, 12))

        bar = RoundedCard(top, t["panel"], None, radius=16)
        bar.pack(fill="x")
        row = tk.Frame(bar.body, bg=t["panel"])
        row.pack(fill="x", padx=16, pady=12)
        Button(row, self, "🧩  ТРЕНАЖЁР ПОРЯДКА СЛОВ", lambda: self.go("g_sentence"),
               accent=True, size=10, padx=18, pady=10).pack(side="left")
        self.grammar_progress = self.label(
            row, f"Заданий решено: {self.stats.get('grammar', {}).get('sentences', 0)}",
            9, "bold", fg=t["faint"], bg=t["panel"])
        self.grammar_progress.pack(side="right")

        scroll = ScrollFrame(self.content, self, bg=t["bg"])
        scroll.pack(fill="both", expand=True)
        body = scroll.body

        for lesson in GRAMMAR_LESSONS:
            card = RoundedCard(body, t["card"], None, radius=18)
            card.pack(fill="x", pady=6)
            inner = tk.Frame(card.body, bg=t["card"])
            inner.pack(fill="x", padx=22, pady=16)
            head = tk.Frame(inner, bg=t["card"])
            head.pack(fill="x")
            self.label(head, lesson["title"], 16, "bold", fg=self.accent,
                       bg=t["card"]).pack(side="left")
            self.label(inner, lesson["rule"], 10, "normal", fg=t["text"], bg=t["card"],
                       wraplength=760, justify="left").pack(anchor="w", pady=(8, 8))
            for de, ru in lesson["examples"]:
                ex = tk.Frame(inner, bg=t["card2"])
                ex.pack(fill="x", pady=2)
                tk.Label(ex, text=de, bg=t["card2"], fg=t["text"],
                         font=(self.font, 11, "bold"), anchor="w").pack(
                    side="left", padx=(12, 10), pady=7)
                tk.Label(ex, text="—", bg=t["card2"], fg=t["faint"],
                         font=(self.font, 10)).pack(side="left")
                tk.Label(ex, text=ru, bg=t["card2"], fg=t["dim"],
                         font=(self.font, 10), anchor="w").pack(side="left", padx=10, pady=7)
            if lesson.get("tip"):
                self.label(inner, "💡 " + lesson["tip"], 9, "bold", fg=STATUS_COLORS["warn"],
                           bg=t["card"], wraplength=760, justify="left").pack(anchor="w",
                                                                            pady=(8, 0))

    # ================================================================== #
    #  ЭКРАН: БАЗА СЛОВ
    # ================================================================== #
    def build_dictionary(self):
        t = self.theme
        top = tk.Frame(self.content, bg=t["bg"])
        top.pack(fill="x", pady=(0, 12))
        self.label(top, "База слов", 26, "bold", bg=t["bg"]).pack(anchor="w")
        self.label(top, "Поиск по немецкому, русскому и произношению", 9, "bold",
                   fg=t["faint"], bg=t["bg"]).pack(anchor="w", pady=(2, 12))

        bar = RoundedCard(top, t["panel"], None, radius=16)
        bar.pack(fill="x")
        inner = tk.Frame(bar.body, bg=t["panel"])
        inner.pack(fill="x", padx=14, pady=12)
        self.query = tk.StringVar()
        entry = tk.Entry(inner, textvariable=self.query, font=(self.font, 12), bg=t["input"],
                         fg=t["text"], insertbackground=self.accent, relief="flat", bd=0)
        entry.pack(side="left", fill="x", expand=True, ipady=9, padx=(6, 10))
        self.filter_var = tk.StringVar(value="Все")
        cats = ["Все"] + list(self.grouped_words.keys()) + ["Школьные фразы", "Числа", "Грамматика"]
        for cat in cats:
            Button(inner, self, cat[:14], lambda c=cat: self._set_filter(c), size=8,
                   padx=10, pady=5, radius=8).pack(side="left", padx=2)
        entry.focus_set()

        table = RoundedCard(self.content, t["card"], None, radius=18)
        table.pack(fill="both", expand=True)
        holder = tk.Frame(table.body, bg=t["card"])
        holder.pack(fill="both", expand=True, padx=10, pady=10)
        scroll = ScrollFrame(holder, self, bg=t["card"])
        scroll.pack(fill="both", expand=True)
        self.dict_body = scroll.body
        self._dict_rows = []
        self._render_dictionary()
        self.query.trace_add("write", lambda *_: self._render_dictionary())
        entry.bind("<Return>", lambda e: self.speak_selected())

        foot = tk.Frame(self.content, bg=t["bg"])
        foot.pack(fill="x", pady=(10, 0))
        Button(foot, self, "\U0001F50A  ПРОИЗНЕСТИ", self.speak_selected, ghost=True, size=9,
               padx=16, pady=8).pack(side="left")
        Button(foot, self, "★  В ИЗБРАННОЕ", self.favorite_selected, ghost=True, size=9,
               padx=16, pady=8).pack(side="left", padx=8)
        Button(foot, self, "🖼  КАРТИНКА", self.dict_image_for_selected, ghost=True, size=9,
               padx=16, pady=8).pack(side="left")
        self.dict_count = self.label(foot, "", 9, "bold", fg=t["faint"], bg=t["bg"])
        self.dict_count.pack(side="right")

        # окно предпросмотра картинки выбранного слова
        self.dict_preview = ImagePreview(self.content, self, self.images, height=150)
        self.dict_preview.pack(fill="x", pady=(10, 0))
        self.dict_preview.pack_forget()

    def _set_filter(self, cat):
        self.filter_var.set(cat)
        self._render_dictionary()

    def _dictionary_rows(self):
        rows = []
        for p in self.word_pairs:
            rows.append((p.de, convert_de_to_ru_phonetics(p.de), p.ru, p.group))
        for p in self.phrase_pairs:
            rows.append((p.de, convert_de_to_ru_phonetics(p.de), p.ru, "Школьные фразы"))
        for p in self.number_pairs:
            rows.append((p.de, convert_de_to_ru_phonetics(p.de), f"Число: {p.numeric}", "Числа"))
        for p in self.grammar_pairs:
            rows.append((p.de, "", p.ru, "Грамматика"))
        return rows

    def _render_dictionary(self):
        if not hasattr(self, "dict_body"):
            return
        self.clear(self.dict_body)
        t = self.theme
        favs = set(self.stats.get("favorites", []))
        text = self.query.get().lower().strip()
        cat = self.filter_var.get()
        filtered = []
        for de, pron, ru, group in self._dictionary_rows():
            if cat != "Все" and group != cat:
                continue
            if text and not any(text in v.lower() for v in (de, pron, ru)):
                continue
            filtered.append((de, pron, ru, group))
        self._dict_rows = filtered
        self.safe_config(getattr(self, "dict_count", None), text=f"{len(filtered)} записей")

        if not filtered:
            self.label(self.dict_body, "Ничего не найдено", 11, "bold", fg=t["faint"],
                       bg=t["card"]).pack(pady=30)
            return
        head = tk.Frame(self.dict_body, bg=t["card2"])
        head.pack(fill="x", pady=(0, 4))
        for text_, w in (("НЕМЕЦКИЙ", 250), ("ПРОИЗНОШЕНИЕ", 190), ("ПЕРЕВОД", 250), ("ГРУППА", 160)):
            self.label(head, text_, 8, "bold", fg=t["faint"], bg=t["card2"],
                       width=w // 9, anchor="w").pack(side="left", padx=12, pady=7)
        for i, (de, pron, ru, group) in enumerate(filtered[:400]):
            stripe = t["card"] if i % 2 == 0 else hex_blend(t["card"], t["card2"], 0.45)
            line = tk.Frame(self.dict_body, bg=stripe, cursor="hand2")
            line.pack(fill="x", pady=1)
            vals = [de, pron, ru, group]
            colors = [t["text"], t["dim"], t["text"], t["faint"]]
            weights = ["bold", "normal", "bold", "normal"]
            sizes = [11, 10, 11, 9]
            for v, col, wgt, sz, wd in zip(vals, colors, weights, sizes, (250, 190, 250, 160)):
                lbl = tk.Label(line, text=v, bg=stripe, fg=col, font=(self.font, sz, wgt),
                               anchor="w", width=wd // 9)
                lbl.pack(side="left", padx=12, pady=9)
                lbl.bind("<Button-1>", lambda e, d=de: self._select_word(d))
            star = tk.Label(line, text="★" if de in favs else "", bg=stripe,
                            fg=STATUS_COLORS["warn"], font=(self.font, 11, "bold"))
            star.pack(side="right", padx=14)
            for child in line.winfo_children():
                child.bind("<Button-1>", lambda e, d=de: self._select_word(d))
            line.bind("<Button-1>", lambda e, d=de: self._select_word(d))

    def _select_word(self, german):
        self.current_de_text = german
        pair = next((p for p in self.all_pairs() if p.de == german), None)
        self.current_pair = pair or DQPair(german, "")
        self.toast(f"Выбрано: {german}", "info", 1200)
        if hasattr(self, "dict_preview"):
            self.dict_preview.ru_text = pair.ru if pair else ""
            self.dict_preview.show(german, pair.ru if pair else "")
            if self.dict_preview.path:
                self.dict_preview.pack(fill="x", pady=(10, 0))
            else:
                self.dict_preview.pack_forget()

    def dict_image_for_selected(self):
        if not self.current_de_text:
            self.toast("Сначала выбери слово", "warn")
            return
        pair = self.current_pair or DQPair(self.current_de_text, "")
        self.toast("Ищу картинку…", "info", 1100)

        def on_ready(path):
            if hasattr(self, "dict_preview") and self.dict_preview.winfo_exists():
                self.dict_preview.set_path(path)
                self.dict_preview.pack(fill="x", pady=(10, 0))

        if not self.images.find_file(pair.de) and HAS_PIL:
            threading.Thread(target=lambda: on_ready(self.images.ensure_image(pair.de, pair.ru)),
                             daemon=True).start()
        else:
            on_ready(self.images.find_file(pair.de))

    def speak_selected(self):
        if not self.current_de_text:
            return
        self.speak(self.current_de_text, "de")

    def favorite_selected(self):
        if not self.current_de_text:
            self.toast("Сначала выбери слово", "warn")
            return
        favorites = self.stats.setdefault("favorites", [])
        if self.current_de_text in favorites:
            favorites.remove(self.current_de_text)
            self.toast("Убрано из избранного", "info")
        else:
            favorites.append(self.current_de_text)
            self.toast("Добавлено в избранное", "ok")
        self.save_stats()
        self._render_dictionary()

    # ================================================================== #
    #  ЭКРАН: ПРОГРЕСС
    # ================================================================== #
    def build_stats(self):
        t = self.theme
        self.label(self.content, "Прогресс", 26, "bold", bg=t["bg"]).pack(anchor="w")
        self.label(self.content,
                   f"Уровень {self.level}  •  {self.xp} XP  •  точность {self.accuracy()}%",
                   9, "bold", fg=t["faint"], bg=t["bg"]).pack(anchor="w", pady=(2, 16))

        scroll = ScrollFrame(self.content, self, bg=t["bg"])
        scroll.pack(fill="both", expand=True)
        body = scroll.body

        hero = RoundedCard(body, t["card"], None, radius=20)
        hero.pack(fill="x", pady=(0, 14))
        row = tk.Frame(hero.body, bg=t["card"])
        row.pack(fill="x", padx=22, pady=20)
        ring = Ring(row, self, size=112, thickness=9)
        ring.set_colors(self.accent)
        ring.pack(side="left", padx=(0, 22))
        ring.set(self.accuracy() / 100, f"{self.accuracy()}%", "точность")
        info = tk.Frame(row, bg=t["card"])
        info.pack(side="left", fill="both", expand=True)
        self.label(info, "ТОЧНОСТЬ ОТВЕТОВ", 9, "bold", fg=t["faint"], bg=t["card"]).pack(anchor="w")
        self.label(info, f"{self.stats.get('correct', 0)} из {self.stats.get('answered', 0)} ответов",
                   11, "bold", bg=t["card"]).pack(anchor="w", pady=(4, 10))
        xp2 = ProgressBar(info, self, height=7)
        xp2.set_colors(t["card2"], self.accent)
        xp2.pack(fill="x", pady=(0, 4))
        xp2.set_value((self.xp % 100) / 100, animate=False)
        self.label(info, f"До уровня {self.level + 1}: {100 - self.xp % 100} XP", 8, "normal",
                   fg=t["dim"], bg=t["card"]).pack(anchor="w")

        grid = tk.Frame(body, bg=t["bg"])
        grid.pack(fill="x", pady=(0, 14))
        cards = [
            ("Ответов всего", self.stats.get("answered", 0), STATUS_COLORS["info"]),
            ("Правильных", self.stats.get("correct", 0), STATUS_COLORS["ok"]),
            ("Лучшая серия", self.stats.get("best_streak", 0), STATUS_COLORS["warn"]),
            ("Дней подряд", self.stats.get("day_streak", 0), "#A98BFF"),
            ("Избранных", len(self.stats.get("favorites", [])), "#FF70A6"),
            ("В повторении", len(self.stats.get("mistakes", [])), STATUS_COLORS["bad"]),
        ]
        for i, (title, value, color) in enumerate(cards):
            r, c = divmod(i, 3)
            grid.grid_columnconfigure(c, weight=1)
            box = RoundedCard(grid, t["panel"], None, radius=16)
            box.grid(row=r, column=c, sticky="nsew",
                     padx=(0 if c == 0 else 8, 8 if c < 2 else 0), pady=6)
            inner = tk.Frame(box.body, bg=t["panel"])
            inner.pack(fill="both", expand=True, padx=18, pady=18)
            self.label(inner, str(value), 24, "bold", fg=color, bg=t["panel"]).pack(anchor="w")
            self.label(inner, title, 8, "bold", fg=t["faint"], bg=t["panel"]).pack(anchor="w",
                                                                                   pady=(2, 0))

        goal = RoundedCard(body, t["card"], None, radius=20)
        goal.pack(fill="x", pady=(0, 14))
        head = tk.Frame(goal.body, bg=t["card"])
        head.pack(fill="x", padx=22, pady=(18, 6))
        self.label(head, "ЦЕЛЬ НА СЕГОДНЯ", 9, "bold", fg=t["faint"], bg=t["card"]).pack(side="left")
        done = self.stats.get("daily_answers", 0)
        self.label(head, f"{done} / {self.daily_goal}", 11, "bold",
                   fg=STATUS_COLORS["ok"] if done >= self.daily_goal else t["text"],
                   bg=t["card"]).pack(side="right")
        gbar = ProgressBar(goal.body, self, height=9)
        gbar.set_colors(t["card2"], STATUS_COLORS["ok"])
        gbar.pack(fill="x", padx=22, pady=(0, 18))
        gbar.set_value(min(1, done / max(1, self.daily_goal)), animate=False)
        Button(goal.body, self, "ИЗМЕНИТЬ ЦЕЛЬ", self.open_goal_picker, ghost=True, size=9,
               padx=16, pady=8).pack(anchor="e", padx=22, pady=(0, 16))

        mistakes = self.stats.get("mistakes", [])
        err = RoundedCard(body, t["card"], None, radius=20)
        err.pack(fill="x", pady=(0, 14))
        self.label(err.body, "ОШИБКИ НА ПОВТОРЕНИЕ", 9, "bold", fg=t["faint"],
                   bg=t["card"]).pack(anchor="w", padx=22, pady=(18, 10))
        if mistakes:
            list_box = tk.Frame(err.body, bg=t["card"])
            list_box.pack(fill="x", padx=22, pady=(0, 16))
            for i, pair in enumerate(mistakes[:10]):
                de, ru = pair[0], pair[1]
                line = tk.Frame(list_box, bg=t["card2"])
                line.pack(fill="x", pady=3)
                tk.Label(line, text=f"{i + 1:02d}", bg=t["card2"], fg=t["faint"],
                         font=(self.font, 9, "bold"), width=4).pack(side="left", padx=(10, 4), pady=9)
                tk.Label(line, text=de, bg=t["card2"], fg=t["text"],
                         font=(self.font, 11, "bold")).pack(side="left", pady=9)
                tk.Label(line, text="→", bg=t["card2"], fg=t["faint"],
                         font=(self.font, 10)).pack(side="left", padx=10)
                tk.Label(line, text=ru, bg=t["card2"], fg=t["dim"],
                         font=(self.font, 10)).pack(side="left", pady=9)
            Button(err.body, self, "ПОВТОРИТЬ ОШИБКИ  ↺", self.start_mistake_review,
                   accent=True, size=9, padx=18, pady=10).pack(anchor="e", padx=22, pady=(0, 18))
        else:
            self.label(err.body, "Ошибок пока нет — отличная работа!", 10, "normal",
                       fg=t["dim"], bg=t["card"]).pack(anchor="w", padx=22, pady=(0, 20))

        games = self.stats.get("games", {})
        gr = RoundedCard(body, t["panel"], None, radius=20)
        gr.pack(fill="x", pady=(0, 10))
        self.label(gr.body, "РЕКОРДЫ ИГР", 9, "bold", fg=t["faint"], bg=t["panel"]).pack(
            anchor="w", padx=22, pady=(18, 10))
        grow = tk.Frame(gr.body, bg=t["panel"])
        grow.pack(fill="x", padx=22, pady=(0, 18))
        items = (("Скорость", f"{games.get('best_speed', 0)} очк"),
                 ("Анаграммы", str(games.get("anagram", 0))),
                 ("Пары", str(games.get("pairs", 0))),
                 ("Правда/ложь", str(games.get("quiz", 0))),
                 ("Слух", str(games.get("listen", 0))),
                 ("Диктант", str(games.get("typing", 0))),
                 ("Порядок слов", str(games.get("sentence", 0))))
        for i, (title, value) in enumerate(items):
            r, c = divmod(i, 2)
            grow.grid_columnconfigure(c, weight=1)
            box = tk.Frame(grow, bg=t["card"])
            box.grid(row=r, column=c, sticky="nsew", padx=4, pady=4)
            self.label(box, value, 15, "bold", fg=self.accent, bg=t["card"]).pack(anchor="w",
                                                                                 padx=12, pady=(8, 0))
            self.label(box, title, 8, "normal", fg=t["faint"], bg=t["card"]).pack(anchor="w",
                                                                                 padx=12, pady=(0, 8))

        Button(body, self, "НАЧАТЬ ТРЕНИРОВКУ", lambda: self.go("train"), accent=True,
               size=10, padx=22, pady=12).pack(fill="x", pady=(4, 20))
    # ================================================================== #
    #  ИГРЫ
    # ================================================================== #
    def _game_header(self, title, subtitle, color, icon="◆"):
        t = self.theme
        top = tk.Frame(self.content, bg=t["bg"])
        top.pack(fill="x", pady=(0, 14))
        left = tk.Frame(top, bg=t["bg"])
        left.pack(side="left")
        row = tk.Frame(left, bg=t["bg"])
        row.pack(anchor="w")
        tk.Label(row, text=icon, bg=t["bg"], fg=color, font=(self.font, 20, "bold")).pack(
            side="left", padx=(0, 10))
        self.label(row, title, 23, "bold", bg=t["bg"]).pack(side="left")
        self.label(left, subtitle, 9, "bold", fg=t["faint"], bg=t["bg"]).pack(anchor="w",
                                                                             pady=(2, 0))
        Button(top, self, "◆  К ИГРАМ", lambda: self.go("games"), ghost=True, size=9,
               padx=14, pady=8).pack(side="right")
        return top

    def build_games(self):
        t = self.theme
        self.label(self.content, "Игры для памяти", 26, "bold", bg=t["bg"]).pack(anchor="w")
        self.label(self.content,
                   "Понимание на слух, визуальные ассоциации, письмо и грамматика — в игровой форме",
                   9, "bold", fg=t["faint"], bg=t["bg"]).pack(anchor="w", pady=(2, 16))

        scroll = ScrollFrame(self.content, self, bg=t["bg"])
        scroll.pack(fill="both", expand=True)
        body = scroll.body
        games = self.stats.get("games", {})
        cards = [
            ("speed", "↯", "Скорость", STATUS_COLORS["info"],
             "30 секунд на все ответы. Чем быстрее — тем больше очков. Ошибка стоит времени.",
             f"Рекорд: {games.get('best_speed', 0)} очков", "g_speed"),
            ("listen", "◉", "Понимание на слух", self.accent,
             "Слышишь только слово (без текста) и выбираешь, что это было. Немецкая озвучка.",
             f"Верных ответов: {games.get('listen', 0)}", "g_listen"),
            ("typing", "⌨", "Диктант: услышал — напиши", "#8FD0FF",
             "Слушаешь слово, число или номер телефона и пишешь его — по-немецки ИЛИ по-русски на выбор.",
             f"Написано верно: {games.get('typing', 0)}", "g_typing"),
            ("images", "▧", "Слова по картинкам", "#FF70A6",
             "Показывается картинка слова — нужно узнать и назвать его. Развивает ассоциации.",
             f"Угадано: {games.get('images', 0)}", "g_images"),
            ("sentence", "§", "Порядок слов", STATUS_COLORS["warn"],
             "Собери немецкое предложение из кусочков в правильном порядке. Тренирует грамматику.",
             f"Собранных фраз: {games.get('sentence', 0)}", "g_sentence"),
            ("anagram", "⇄", "Анаграммы", "#A98BFF",
             "Перемешанные буквы — собери немецкое слово. Тренирует письмо и память.",
             f"Решено всего: {games.get('anagram', 0)}", "g_anagram"),
            ("pairs", "◫", "Пары (память)", "#7BE0AD",
             "Игра «найди пару»: немецкое слово и его перевод. Тренирует зрительную память.",
             f"Побед: {games.get('pairs', 0)}", "g_pairs"),
            ("quiz", "✓", "Правда или ложь", STATUS_COLORS["info"],
             "Показывают слово и перевод — но перевод может быть неверным. Угадай, правда ли это.",
             f"Верных ответов: {games.get('quiz', 0)}", "g_quiz"),
        ]
        for i in range(0, len(cards), 2):
            row = tk.Frame(body, bg=t["bg"])
            row.pack(fill="x", pady=8)
            row.grid_columnconfigure(0, weight=1)
            row.grid_columnconfigure(1, weight=1)
            for col, card in enumerate(cards[i:i + 2]):
                self._game_card(row, card, col)
        Button(body, self, "←  К ТРЕНИРОВКЕ", lambda: self.go("train"), ghost=True, size=10,
               padx=20, pady=11).pack(anchor="w", pady=(14, 24))

    def _game_card(self, parent, card, col):
        key, icon, title, color, desc, record, screen = card
        t = self.theme
        box = RoundedCard(parent, t["card"], None, radius=20)
        box.grid(row=0, column=col, sticky="nsew",
                 padx=(0, 8) if col == 0 else (8, 0), pady=0)
        inner = tk.Frame(box.body, bg=t["card"])
        inner.pack(fill="both", expand=True, padx=22, pady=20)
        head = tk.Frame(inner, bg=t["card"])
        head.pack(fill="x")
        badge = tk.Canvas(head, width=44, height=44, bg=t["card"], bd=0, highlightthickness=0)
        badge.pack(side="left")
        badge.create_oval(2, 2, 42, 42, fill=hex_blend(color, t["card"], 0.78), outline="")
        badge.create_text(22, 23, text=icon, fill=color, font=(self.font, 15, "bold"))
        titles = tk.Frame(head, bg=t["card"])
        titles.pack(side="left", padx=(12, 0))
        self.label(titles, title, 16, "bold", bg=t["card"]).pack(anchor="w")
        self.label(titles, record, 8, "bold", fg=t["faint"], bg=t["card"]).pack(anchor="w",
                                                                               pady=(2, 0))
        self.label(inner, desc, 10, "normal", fg=t["dim"], bg=t["card"], wraplength=380,
                   justify="left").pack(anchor="w", pady=(12, 14))
        Button(inner, self, "ИГРАТЬ", lambda s=screen: self.go(s), accent=True, size=10,
               padx=22, pady=10).pack(anchor="w")
        if self.animations_enabled:
            box.after(int(col * 90), lambda b=box: self.pop_in(b.body))

    # ------------------------------------------------------------------ #
    #  Игра: СКОРОСТЬ (30 секунд)
    # ------------------------------------------------------------------ #
    def build_game_speed(self):
        t = self.theme
        self.speed_state = {"score": 0, "time": 30.0, "lives": 3, "running": False,
                            "tick": None, "blocked": False, "pool": [], "queue": [],
                            "current": None, "answer": "", "next_after": None,
                            "options": []}
        self._game_header("Скорость", "30 секунд: отвечай как можно быстрее", STATUS_COLORS["info"],
                          icon="↯")

        stats = RoundedCard(self.content, t["panel"], None, radius=16)
        stats.pack(fill="x", pady=(0, 12))
        row = tk.Frame(stats.body, bg=t["panel"])
        row.pack(fill="x", padx=20, pady=14)
        self.speed_time_bar = ProgressBar(row, self, height=8)
        self.speed_time_bar.set_colors(t["card2"], STATUS_COLORS["info"])
        self.speed_time_bar.pack(side="left", fill="x", expand=True, padx=(0, 18))
        self.speed_time_bar.set_value(1.0, animate=False)
        self.speed_time = self.label(row, "30.0", 20, "bold", fg=STATUS_COLORS["info"],
                                     bg=t["panel"])
        self.speed_time.pack(side="left")
        self.speed_lives = self.label(row, "♥♥♥", 14, "bold", fg=STATUS_COLORS["bad"],
                                      bg=t["panel"])
        self.speed_lives.pack(side="left", padx=(16, 0))
        self.speed_score = self.label(row, "0", 20, "bold", fg=self.accent, bg=t["panel"])
        self.speed_score.pack(side="right")

        self.speed_card = RoundedCard(self.content, t["card"], None, radius=20, center=True)
        self.speed_card.pack(fill="both", expand=True)
        self.speed_body = tk.Frame(self.speed_card.body, bg=t["card"])
        self.speed_body.pack(fill="both", expand=True, padx=24, pady=22)
        self._speed_preview()

    def _speed_preview(self):
        self.clear(self.speed_body)
        t = self.theme
        self.label(self.speed_body, "⚡  Скоростная тренировка", 22, "bold", bg=t["card"]).pack(
            pady=(10, 4))
        self.label(self.speed_body,
                   "30 секунд. Верный ответ = очки и +1 секунда.\nОшибка = минус 3 секунды и одна жизнь.",
                   10, "normal", fg=t["dim"], bg=t["card"], wraplength=520, justify="center").pack(
            pady=(0, 8))
        # для скорости нужен большой однотипный пул — иначе варианты «разъезжаются»
        word_pool = [p for p in self.word_pairs if p.de and p.ru]
        pool = word_pool or self.game_pool(60)
        self.speed_state["pool"] = pool
        self.label(self.speed_body, f"Слов доступно в раунде: {len(pool)}", 9, "bold",
                   fg=t["faint"], bg=t["card"]).pack()
        Button(self.speed_body, self, "▶  СТАРТ", self._speed_start, accent=True, size=11,
               padx=30, pady=13).pack(pady=(18, 0))

    def _speed_start(self):
        st = self.speed_state
        st.update({"score": 0, "time": 30.0, "lives": 3, "running": True, "blocked": False,
                   "queue": []})
        pool = st["pool"] or self.game_pool(60)
        self.rng.shuffle(pool)
        st["queue"] = pool[:40]
        # строим «игровое» полотно один раз
        self.clear(self.speed_body)
        t = self.theme
        self.speed_hint = self.label(self.speed_body, "Что это по-немецки?", 9, "bold",
                                     fg=t["faint"], bg=t["card"])
        self.speed_hint.pack(pady=(4, 0))
        self.speed_question = self.label(self.speed_body, "", 32, "bold", bg=t["card"],
                                         wraplength=680, justify="center")
        self.speed_question.pack(pady=(6, 2))
        self.speed_phon = self.label(self.speed_body, "", 12, "normal", fg=t["dim"], bg=t["card"])
        self.speed_phon.pack(pady=(0, 12))
        self.speed_options = tk.Frame(self.speed_body, bg=t["card"])
        self.speed_options.pack(fill="x")
        self.speed_feedback = self.label(self.speed_body, "", 12, "bold", bg=t["card"])
        self.speed_feedback.pack(pady=(12, 0))
        self._speed_refresh_hud()
        self._speed_tick()
        self._speed_next()

    def _speed_refresh_hud(self):
        st = self.speed_state
        try:
            self.speed_score.config(text=str(st["score"]))
            self.speed_time.config(text=f"{st['time']:.1f}")
            self.speed_time_bar.set_value(max(0.0, st["time"] / 30.0), animate=False)
            self.speed_lives.config(text="♥" * max(0, st["lives"]))
        except tk.TclError:
            pass

    def _speed_tick(self):
        st = self.speed_state
        if not st["running"]:
            return
        st["time"] = max(0.0, st["time"] - 0.1)
        self._speed_refresh_hud()
        if st["time"] <= 0:
            self._speed_finish()
            return
        st["tick"] = self.root.after(100, self._speed_tick)

    def _speed_next(self):
        st = self.speed_state
        st["next_after"] = None
        if not st["running"]:
            return
        self.stop_audio()
        if not st["queue"]:
            self._speed_finish()
            return
        pair = st["queue"].pop(0)
        st["current"] = pair
        st["blocked"] = False
        is_ru_to_de = self.direction.startswith("RU")
        question = pair.ru if is_ru_to_de else pair.de
        answer = pair.de if is_ru_to_de else pair.ru
        st["answer"] = answer
        self.speed_question.config(text=question)
        self.speed_phon.config(text=convert_de_to_ru_phonetics(pair.de) if not is_ru_to_de else "")
        self.speed_hint.config(text="Выбери немецкое слово" if is_ru_to_de else "Выбери перевод")
        self._speed_options(pair, answer, is_ru_to_de)
        if pair.audio:
            self.speak(pair.audio, "de", interrupt=True)

    def _speed_options(self, pair, answer, is_ru_to_de):
        self.clear(self.speed_options)
        st = self.speed_state
        kind = getattr(pair, "kind", "word")
        same = [p.de if is_ru_to_de else p.ru for p in st["pool"]
                if getattr(p, "kind", "word") == kind]
        other = [p.de if is_ru_to_de else p.ru for p in st["pool"]]
        pool = confusing_distractors(answer, same, count=3, rng=self.rng)
        if len(pool) < 3:
            pool += confusing_distractors(answer, other, count=3, rng=self.rng)
        options = list(dict.fromkeys(pool))[:3] + [answer]
        self.rng.shuffle(options)
        # сохраняем порядок вариантов — нужен для выбора цифрами 1–4
        st["options"] = options
        for i, opt in enumerate(options):
            tile = OptionTile(self.speed_options, self, i, opt,
                              command=lambda o=opt: self._speed_answer(o))
            tile.pack(fill="x", pady=4)

    def _speed_answer(self, selected):
        st = self.speed_state
        if st["blocked"] or not st["running"]:
            return
        st["blocked"] = True
        correct = normalize_answer(selected) == normalize_answer(st["answer"])
        if correct:
            points = max(5, int(12 - st["time"] / 4))
            st["score"] += points
            st["time"] = min(30.0, st["time"] + 1.0)
            self.speed_feedback.config(text=f"+{points}   ВЕРНО", fg=STATUS_COLORS["ok"])
            self.audio.play_effect(True)
        else:
            st["lives"] -= 1
            st["time"] = max(0.0, st["time"] - 3.0)
            self.speed_feedback.config(text=f"НЕТ:  {st['answer']}", fg=STATUS_COLORS["bad"])
            self.audio.play_effect(False)
        self._speed_refresh_hud()
        if st["lives"] <= 0:
            self.later(700, self._speed_finish)
            return
        st["next_after"] = self.root.after(260, self._speed_next)

    def _speed_cancel(self):
        """Останавливает текущий раунд без записи результата при уходе с экрана."""
        st = getattr(self, "speed_state", None)
        if not st:
            return
        st["running"] = False
        for key in ("tick", "next_after"):
            timer = st.get(key)
            if timer is not None:
                try:
                    self.root.after_cancel(timer)
                except tk.TclError:
                    pass
                st[key] = None

    def _speed_finish(self):
        st = self.speed_state
        if not st["running"]:
            return
        st["running"] = False
        self._speed_cancel()
        self.stop_audio()
        score = st["score"]
        self.record_game("speed", score, "max")
        self.record_game("best_speed", score, "max")
        self.award(min(60, score // 2))
        self.clear(self.speed_body)
        t = self.theme
        self.label(self.speed_body, "Раунд окончен", 24, "bold", bg=t["card"]).pack(pady=(20, 6))
        self.label(self.speed_body, f"Счёт: {score}", 18, "bold", fg=self.accent,
                   bg=t["card"]).pack()
        self.label(self.speed_body, f"Слов пройдено, жизней осталось: {max(0, st['lives'])}",
                   10, "normal", fg=t["dim"], bg=t["card"]).pack(pady=(6, 18))
        Button(self.speed_body, self, "ЕЩЁ РАУНД", self._speed_preview, accent=True, size=11,
               padx=26, pady=12).pack(side="left", padx=(90, 10))
        Button(self.speed_body, self, "К ИГРАМ", lambda: self.go("games"), ghost=True, size=11,
               padx=26, pady=12).pack(side="left")
        self.toast(f"Счёт: {score}", "ok", 2200)

    # ------------------------------------------------------------------ #
    #  Игра: АНАГРАММЫ
    # ------------------------------------------------------------------ #
    def build_game_anagram(self):
        t = self.theme
        self.anagram_state = {"solved": 0, "rounds": 0, "current": None, "slots": []}
        self._game_header("Анаграммы", "Собери немецкое слово из перемешанных букв", self.accent,
                          icon="⇄")

        top = RoundedCard(self.content, t["panel"], None, radius=16)
        top.pack(fill="x", pady=(0, 12))
        row = tk.Frame(top.body, bg=t["panel"])
        row.pack(fill="x", padx=20, pady=14)
        self.anagram_score = self.label(row, "0", 20, "bold", fg=self.accent, bg=t["panel"])
        self.anagram_score.pack(side="left")
        self.label(row, "решено", 9, "normal", fg=t["faint"], bg=t["panel"]).pack(
            side="left", padx=(6, 0), pady=(6, 0))
        self.anagram_round = self.label(row, "Раунд 1", 10, "bold", fg=t["dim"], bg=t["panel"])
        self.anagram_round.pack(side="right", pady=(4, 0))

        card = RoundedCard(self.content, t["card"], None, radius=20)
        card.pack(fill="both", expand=True)
        body = tk.Frame(card.body, bg=t["card"])
        body.pack(fill="both", expand=True, padx=24, pady=22)
        self.label(body, "Переведи слово", 9, "bold", fg=t["faint"], bg=t["card"]).pack()
        self.anagram_prompt = self.label(body, "", 30, "bold", bg=t["card"])
        self.anagram_prompt.pack(pady=(2, 14))
        self.label(body, "Собери немецкое слово", 9, "normal", fg=t["dim"], bg=t["card"]).pack()
        self.anagram_slots = LetterSlots(body, self, bg=t["card"])
        self.anagram_slots.pack(pady=(14, 10))
        self.anagram_letters = tk.Frame(body, bg=t["card"])
        self.anagram_letters.pack(pady=(4, 12))
        self.anagram_feedback = self.label(body, "", 12, "bold", bg=t["card"])
        self.anagram_feedback.pack(pady=(4, 0))
        actions = tk.Frame(body, bg=t["card"])
        actions.pack(pady=(12, 0))
        Button(actions, self, "ПРОВЕРИТЬ", self._anagram_check, accent=True, size=10,
               padx=22, pady=10).pack(side="left", padx=6)
        Button(actions, self, "ПРОПУСТИТЬ", self._anagram_next, ghost=True, size=10,
               padx=20, pady=10).pack(side="left", padx=6)
        Button(actions, self, "ПОДСКАЗКА", self._anagram_hint, ghost=True, size=10,
               padx=20, pady=10).pack(side="left", padx=6)
        self._anagram_next()

    def _anagram_words(self):
        pool = [p for p in (self.word_pairs + self.phrase_pairs)
                if p.de.replace("-", "").replace(" ", "").isalpha()
                and 3 <= len(p.de.replace(" ", "")) <= 12]
        return pool or self.word_pairs

    def _anagram_next(self):
        self.stop_audio()
        pool = self._anagram_words()
        if not pool:
            self.anagram_prompt.config(text="Нет слов")
            return
        pair = self.rng.choice(pool)
        st = self.anagram_state
        st["current"] = pair
        st["rounds"] += 1
        letters = [c for c in pair.de if c.isalpha()]
        shuffled = letters[:]
        self.rng.shuffle(shuffled)
        if len(shuffled) > 1 and shuffled == letters:
            self.rng.shuffle(shuffled)
        st["slots"] = [None] * len(letters)
        st["letters"] = shuffled
        self.anagram_prompt.config(text=pair.ru)
        self.anagram_feedback.config(text="")
        self.anagram_round.config(text=f"Раунд {st['rounds']}")
        self._anagram_render()
        self.speak(pair.audio, "de")

    def _anagram_render(self):
        st = self.anagram_state
        self.anagram_slots.render(st["slots"], on_click=self._anagram_pick)
        self.clear(self.anagram_letters)
        for idx, ch in enumerate(st["letters"]):
            Button(self.anagram_letters, self, ch, lambda i=idx: self._anagram_put(i),
                   size=15, padx=8, pady=8, radius=10).pack(side="left", padx=5)

    def _anagram_put(self, idx):
        st = self.anagram_state
        for i, v in enumerate(st["slots"]):
            if v is None:
                st["slots"][i] = st["letters"][idx]
                st["letters"][idx] = None
                self._anagram_render()
                return

    def _anagram_pick(self, slot_idx):
        st = self.anagram_state
        ch = st["slots"][slot_idx]
        if ch is None:
            return
        for i, v in enumerate(st["letters"]):
            if v is None:
                st["letters"][i] = ch
                break
        st["slots"][slot_idx] = None
        self._anagram_render()

    def _anagram_check(self):
        st = self.anagram_state
        pair = st["current"]
        if pair is None:
            return
        if any(v is None for v in st["slots"]):
            self.anagram_feedback.config(text="Собери все буквы", fg=STATUS_COLORS["warn"])
            return
        guess = "".join(st["slots"])
        if guess.lower() == pair.de.lower():
            st["solved"] += 1
            self.anagram_score.config(text=str(st["solved"]))
            self.anagram_feedback.config(text="ВЕРНО!  +10 XP", fg=STATUS_COLORS["ok"])
            self.audio.play_effect(True)
            self.spawn_confetti(self.anagram_slots)
            self.award(10)
            self.record_game("anagram", 1, "add")
            self.later(900, self._anagram_next)
        else:
            self.anagram_feedback.config(text=f"НЕ ТО. Ответ: {pair.de}", fg=STATUS_COLORS["bad"])
            self.audio.play_effect(False)
            self.register_mistake(pair)
            self.later(1300, self._anagram_next)

    def _anagram_hint(self):
        pair = self.anagram_state.get("current")
        if pair is None:
            return
        self.anagram_feedback.config(
            text=f"Подсказка: {pair.ru} = {pair.de[0].upper()}… ({len(pair.de)} букв)",
            fg=STATUS_COLORS["info"])

    # ------------------------------------------------------------------ #
    #  Игра: ПАРЫ (память)
    # ------------------------------------------------------------------ #
    def build_game_pairs(self):
        t = self.theme
        self.pairs_state = {"cards": [], "open": [], "matched": 0, "moves": 0, "busy": False,
                            "size": 4}
        self._game_header("Пары", "Найди немецкое слово и его перевод", "#7BE0AD", icon="◫")

        top = RoundedCard(self.content, t["panel"], None, radius=16)
        top.pack(fill="x", pady=(0, 12))
        row = tk.Frame(top.body, bg=t["panel"])
        row.pack(fill="x", padx=20, pady=14)
        self.pairs_moves = self.label(row, "0", 20, "bold", fg="#7BE0AD", bg=t["panel"])
        self.pairs_moves.pack(side="left")
        self.label(row, "ходов", 9, "normal", fg=t["faint"], bg=t["panel"]).pack(
            side="left", padx=(6, 0), pady=(6, 0))
        self.pairs_left = self.label(row, "8", 20, "bold", fg=self.accent, bg=t["panel"])
        self.pairs_left.pack(side="right")
        self.label(row, "осталось пар", 9, "normal", fg=t["faint"], bg=t["panel"]).pack(
            side="right", padx=(0, 6), pady=(6, 0))

        holder = RoundedCard(self.content, t["card"], None, radius=20)
        holder.pack(fill="both", expand=True)
        self.pairs_board_holder = holder
        actions = tk.Frame(self.content, bg=t["bg"])
        actions.pack(pady=(12, 0))
        for size, title in ((4, "4×4  легко"), (6, "6×6  средне"), (8, "8×8  сложно")):
            Button(actions, self, title, lambda s=size: self._pairs_new_board(s), ghost=True,
                   size=9, padx=16, pady=9, radius=10).pack(side="left", padx=5)
        self._pairs_new_board(4)

    def _pairs_new_board(self, size):
        self.stop_audio()
        st = self.pairs_state
        st["size"] = size
        pool = [p for p in self.game_pool(200) if len(p.de) < 18]
        need = (size * size) // 2
        if len(pool) < need:
            pool = self.all_pairs()
        chosen = self.rng.sample(pool, min(need, len(pool)))
        cards = []
        for pair in chosen:
            cards.append({"key": pair.de, "text": pair.de, "kind": "de"})
            cards.append({"key": pair.de, "text": pair.ru, "kind": "ru"})
        self.rng.shuffle(cards)
        st.update({"cards": cards, "open": [], "matched": 0, "moves": 0, "busy": False})
        self._pairs_render()

    def _pairs_render(self):
        holder = getattr(self, "pairs_board_holder", None)
        if holder is None or not holder.winfo_exists():
            return
        self.clear(holder.body)
        st = self.pairs_state
        size = st["size"]
        t = self.theme
        board = tk.Frame(holder.body, bg=t["card"])
        board.pack(fill="both", expand=True, padx=10, pady=10)
        for c in range(size):
            board.grid_columnconfigure(c, weight=1, uniform="card")
            board.grid_rowconfigure(c, weight=1, uniform="card")
        for i, card in enumerate(st["cards"]):
            r, c = divmod(i, size)
            is_open = card in st["open"] or card.get("done")
            face_bg, fg = t["card2"], t["text"]
            if card.get("done"):
                face_bg, fg = hex_blend(STATUS_COLORS["ok"], t["card"], 0.78), STATUS_COLORS["ok"]
            elif card.get("kind") == "de":
                face_bg, fg = hex_blend(self.accent, t["card"], 0.82), self.accent
            elif card.get("kind") == "ru":
                face_bg, fg = hex_blend("#FF70A6", t["card"], 0.84), "#FF9CC1"
            text = card["text"] if is_open else "?"
            btn = Button(board, self, text, lambda cd=card: self._pairs_flip(cd),
                         size=10 if len(str(text)) < 12 else 8, padx=8, pady=22, radius=10)
            btn.grid(row=r, column=c, sticky="nsew", padx=4, pady=4)
            if is_open:
                btn.redraw(bg=face_bg, border=face_bg, fg=fg)
        self.pairs_moves.config(text=str(st["moves"]))
        self.pairs_left.config(text=str(len(st["cards"]) // 2 - st["matched"]))

    def _pairs_flip(self, card):
        st = self.pairs_state
        if st["busy"] or card.get("done") or card in st["open"] or len(st["open"]) >= 2:
            return
        st["open"].append(card)
        self._pairs_render()
        if card.get("kind") == "de":
            self.speak(card["text"], "de", interrupt=True)
        if len(st["open"]) < 2:
            return
        st["moves"] += 1
        st["busy"] = True
        first, second = st["open"]
        if first["key"] == second["key"] and first["kind"] != second["kind"]:
            for c in (first, second):
                c["done"] = True
            st["matched"] += 1
            st["busy"] = False
            st["open"] = []
            self._pairs_render()
            self.award(8)
            self.record_game("pairs", 1, "add")
            if st["matched"] >= len(st["cards"]) // 2:
                self._pairs_win()
        else:
            self.later(800, self._pairs_close)

    def _pairs_close(self):
        st = self.pairs_state
        st["open"] = []
        st["busy"] = False
        self._pairs_render()

    def _pairs_win(self):
        st = self.pairs_state
        bonus = max(0, 60 - st["moves"] * 2)
        self.toast(f"Все пары найдены за {st['moves']} ходов!  +{bonus} XP", "ok", 3000)
        self.award(bonus)
        self.spawn_confetti(self.pairs_board_holder)

    # ------------------------------------------------------------------ #
    #  Игра: ПРАВДА ИЛИ ЛОЖЬ
    # ------------------------------------------------------------------ #
    def build_game_quiz(self):
        t = self.theme
        self.quiz_state = {"score": 0, "streak": 0, "current": None}
        self._game_header("Правда или ложь", "Какой перевод правильный?", STATUS_COLORS["warn"],
                          icon="✓")

        top = RoundedCard(self.content, t["panel"], None, radius=16)
        top.pack(fill="x", pady=(0, 12))
        row = tk.Frame(top.body, bg=t["panel"])
        row.pack(fill="x", padx=20, pady=14)
        self.quiz_score = self.label(row, "0", 20, "bold", fg=STATUS_COLORS["warn"], bg=t["panel"])
        self.quiz_score.pack(side="left")
        self.label(row, "очков", 9, "normal", fg=t["faint"], bg=t["panel"]).pack(
            side="left", padx=(6, 0), pady=(6, 0))
        self.quiz_streak = self.label(row, "0", 20, "bold", fg=STATUS_COLORS["ok"], bg=t["panel"])
        self.quiz_streak.pack(side="right")
        self.label(row, "серия", 9, "normal", fg=t["faint"], bg=t["panel"]).pack(
            side="right", padx=(0, 6), pady=(6, 0))

        card = RoundedCard(self.content, t["card"], None, radius=20)
        card.pack(fill="both", expand=True)
        body = tk.Frame(card.body, bg=t["card"])
        body.pack(fill="both", expand=True, padx=24, pady=22)
        self.label(body, "Правда или ложь?", 9, "bold", fg=t["faint"], bg=t["card"]).pack()
        self.quiz_de = self.label(body, "", 34, "bold", bg=t["card"], wraplength=720,
                                  justify="center")
        self.quiz_de.pack(pady=(6, 6))
        self.quiz_phon = self.label(body, "", 12, "normal", fg=t["dim"], bg=t["card"])
        self.quiz_phon.pack()
        self.quiz_ru = self.label(body, "", 24, "bold", fg=t["text"], bg=t["card"],
                                  wraplength=720, justify="center")
        self.quiz_ru.pack(pady=(16, 4))
        self.quiz_feedback = self.label(body, "", 13, "bold", bg=t["card"])
        self.quiz_feedback.pack(pady=(6, 10))
        btns = tk.Frame(body, bg=t["card"])
        btns.pack(pady=(6, 0))
        self.quiz_true = Button(btns, self, "✓  ПРАВДА", lambda: self._quiz_answer(True),
                                accent=True, size=12, padx=28, pady=13)
        self.quiz_true.pack(side="left", padx=8)
        self.quiz_false = Button(btns, self, "✕  ЛОЖЬ", lambda: self._quiz_answer(False),
                                 danger=True, size=12, padx=28, pady=13)
        self.quiz_false.pack(side="left", padx=8)
        self._quiz_next()

    def _quiz_next(self):
        self.stop_audio()
        st = self.quiz_state
        pool = self.game_pool(120)
        if not pool:
            return
        pair = self.rng.choice(pool)
        others = [p.ru for p in pool if p.ru != pair.ru]
        is_true = self.rng.random() < 0.5
        shown = pair.ru if is_true or not others else self.rng.choice(others)
        st["current"] = (pair, is_true)
        self.quiz_de.config(text=pair.de)
        self.quiz_phon.config(text=convert_de_to_ru_phonetics(pair.de))
        self.quiz_ru.config(text=shown)
        self.quiz_feedback.config(text="")
        self.quiz_true.set_enabled(True)
        self.quiz_false.set_enabled(True)
        self.speak(pair.audio, "de")

    def _quiz_answer(self, said_true):
        st = self.quiz_state
        if st["current"] is None:
            return
        pair, is_true = st["current"]
        self.quiz_true.set_enabled(False)
        self.quiz_false.set_enabled(False)
        correct = said_true == is_true
        if correct:
            bonus = 10 + st["streak"] * 2
            st["score"] += bonus
            st["streak"] += 1
            self.quiz_score.config(text=str(st["score"]))
            self.quiz_streak.config(text=str(st["streak"]))
            self.quiz_feedback.config(text=f"ВЕРНО!  +{bonus} XP", fg=STATUS_COLORS["ok"])
            self.award(bonus)
            self.record_game("quiz", 1, "add")
            self.audio.play_effect(True)
        else:
            st["streak"] = 0
            self.quiz_streak.config(text="0")
            self.quiz_feedback.config(text=f"НЕВЕРНО!  {pair.de} = {pair.ru}", fg=STATUS_COLORS["bad"])
            self.audio.play_effect(False)
            self.register_mistake(pair)
        self.later(1300, self._quiz_next)

    # ================================================================== #
    #  ОКНА
    # ================================================================== #
    def open_group_picker(self):
        def builder(body, win):
            t = self.theme
            self.label(body, "Группа слов", 20, "bold", bg=t["card"]).pack(anchor="w")
            self.label(body, "Выбери набор слов для режима «Заучивание по группам»", 9,
                       "normal", fg=t["dim"], bg=t["card"]).pack(anchor="w", pady=(2, 12))
            scroll = ScrollFrame(body, self, bg=t["card"])
            scroll.pack(fill="both", expand=True)
            for name, items in self.grouped_words.items():
                row = tk.Frame(scroll.body, bg=t["card"], cursor="hand2")
                row.pack(fill="x", pady=2)
                btn = Button(row, self, f"{name}   ({len(items)})",
                             lambda n=name: self.pick_group(n), ghost=True, size=10,
                             padx=14, pady=9, radius=10)
                btn.pack(fill="x")
                if name == self.selected_group:
                    btn.set_accent(True)

        self.open_overlay(builder, 520, 560)

    def pick_group(self, name):
        self.selected_group = name
        self.mode = "Заучивание по группам"
        self.save_stats()
        self.close_overlay()
        self.toast(f"Группа: {name}", "ok")
        self.go("train", force=True)

    def open_goal_picker(self):
        def builder(body, win):
            t = self.theme
            self.label(body, "Цели на день", 20, "bold", bg=t["card"]).pack(anchor="w")
            self.label(body, "Сколько ответов в день и в одной сессии", 9, "normal",
                       fg=t["dim"], bg=t["card"]).pack(anchor="w", pady=(2, 12))

            def row_for(label, current, key):
                self.label(body, label, 9, "bold", fg=t["faint"], bg=t["card"]).pack(
                    anchor="w", pady=(8, 2))
                row = tk.Frame(body, bg=t["card"])
                row.pack(anchor="w")
                for value in (10, 20, 30, 50, 100):
                    b = Button(row, self, str(value),
                               lambda v=value, k=key: self._set_goal(k, v), ghost=True,
                               size=9, padx=12, pady=6, radius=8)
                    b.pack(side="left", padx=3)
                    if value == current:
                        b.set_accent(True)

            row_for("ОТВЕТОВ В ДЕНЬ", self.daily_goal, "daily_goal")
            row_for("ОТВЕТОВ В СЕССИИ", self.session_goal, "session_goal")
            Button(body, self, "ГОТОВО", self.close_overlay, accent=True, size=10,
                   padx=22, pady=10).pack(anchor="e", pady=(20, 0))

        self.open_overlay(builder, 480, 400)

    def _set_goal(self, key, value):
        setattr(self, key, int(value))
        self.stats[key] = int(value)
        self.save_stats()
        self.update_stats_panel()
        self.close_overlay()
        self.open_goal_picker()

    def start_mistake_review(self):
        self.close_overlay()
        if not self.stats.get("mistakes"):
            self.toast("Ошибок нет — отличная работа!", "ok")
            return
        self.mode = "ОШИБКИ"
        self.save_stats()
        self.go("train", force=True)
        self.toast("Повторяем ошибки", "warn")

    def open_settings(self):
        def builder(body, win):
            t = self.theme
            self.label(body, "Настройки", 20, "bold", bg=t["card"]).pack(anchor="w")
            self.label(body, "Тема, акценты и подготовка медиа", 9, "normal", fg=t["dim"],
                       bg=t["card"]).pack(anchor="w", pady=(2, 12))

            self.label(body, "ТЕМА", 9, "bold", fg=t["faint"], bg=t["card"]).pack(anchor="w")
            theme_row = tk.Frame(body, bg=t["card"])
            theme_row.pack(anchor="w", pady=(4, 12))
            for name in THEMES.keys():
                b = Button(theme_row, self, name, lambda n=name: self.pick_theme(n), ghost=True,
                           size=9, padx=12, pady=7, radius=9)
                b.pack(side="left", padx=3)
                if name == self.theme_name:
                    b.set_accent(True)

            self.label(body, "АКЦЕНТ", 9, "bold", fg=t["faint"], bg=t["card"]).pack(anchor="w")
            accent_row = tk.Frame(body, bg=t["card"])
            accent_row.pack(anchor="w", pady=(4, 12))
            for name, (c1, _c2) in ACCENTS.items():
                sw = tk.Frame(accent_row, bg=c1, width=30, height=30, cursor="hand2",
                              highlightthickness=2 if name == self.accent_name else 0,
                              highlightbackground=t["text"] if name == self.accent_name else c1)
                sw.pack(side="left", padx=4)
                sw.bind("<Button-1>", lambda e, n=name: self.pick_accent(n))

            self.label(body, "АНИМАЦИИ", 9, "bold", fg=t["faint"], bg=t["card"]).pack(anchor="w")
            anim_row = tk.Frame(body, bg=t["card"])
            anim_row.pack(anchor="w", pady=(4, 12))
            for level in ANIMATION_LEVELS:
                b = Button(anim_row, self, level, lambda l=level: self.pick_animation(l),
                           ghost=True, size=9, padx=12, pady=7, radius=9)
                b.pack(side="left", padx=3)
                if level == self.animation_level:
                    b.set_accent(True)

            self.label(body, "КАРТИНКИ И ОЗВУЧКА", 9, "bold", fg=t["faint"],
                       bg=t["card"]).pack(anchor="w", pady=(4, 4))
            online_on = bool(self.stats.get("online_images", False))
            online_btn = Button(
                body, self,
                "ОНЛАЙН-КАРТИНКИ: " + ("ВКЛ (медленно, красиво)" if online_on
                                        else "ВЫКЛ (быстро, простые)"),
                self.toggle_online_images, ghost=True, size=9, padx=14, pady=9,
                radius=9)
            online_btn.pack(anchor="w", pady=(2, 4))
            if online_on:
                online_btn.set_accent(True)
            self.label(body,
                       "Выкл: мгновенные простые картинки (PIL) — быстро и без сети.\n"
                       "Вкл: искать картинки в Wikipedia/Commons — дольше, иногда красивее.",
                       8, "normal", fg=t["dim"], bg=t["card"]).pack(anchor="w", pady=(0, 6))
            Button(body, self, "СКАЧАТЬ КАРТИНКИ И ОЗВУЧКУ ДЛЯ ВСЕХ СЛОВ",
                   self.prepare_all_media, ghost=True, size=9, padx=14, pady=9,
                   radius=9).pack(anchor="w", pady=(2, 8))
            images_count = len([1 for _ in self.images.index])
            self.label(body, f"Уже сохранено картинок: {images_count}", 8, "normal",
                       fg=t["dim"], bg=t["card"]).pack(anchor="w", pady=(0, 12))

            Button(body, self, "ЗАКРЫТЬ", self.close_overlay, accent=True, size=10,
                   padx=20, pady=10).pack(anchor="e")

        self.open_overlay(builder, 560, 560)

    def pick_theme(self, name):
        self.set_theme(name)
        self.close_overlay()

    def pick_accent(self, name):
        self.set_accent(name)
        self.close_overlay()

    def pick_animation(self, level):
        self.animation_level = level
        self.animations_enabled = level != "Без эффектов"
        self.save_stats()
        self.close_overlay()

    def toggle_online_images(self):
        """Вкл/выкл поиск картинок в интернете (по умолчанию — выкл, офлайн)."""
        self.stats["online_images"] = not bool(self.stats.get("online_images", False))
        self.save_stats()
        self.close_overlay()
        state = "включён" if self.stats["online_images"] else "выключен"
        self.toast(f"Онлайн-поиск картинок {state}", "info", 1600)

    def prepare_all_media(self):
        """Кнопка «скачать всё»: озвучка + картинки для всей базы в фоне с прогрессом."""
        pairs = (self.word_pairs + self.phrase_pairs + self.number_pairs)

        def builder(body, win):
            t = self.theme
            self.label(body, "Подготовка медиа", 20, "bold", bg=t["card"]).pack(anchor="w")
            self.label(body, "Скачиваем озвучку и картинки. Это можно прервать.", 9,
                       "normal", fg=t["dim"], bg=t["card"]).pack(anchor="w", pady=(2, 14))
            self._prep_phase = self.label(body, "Озвучка…", 10, "bold", fg=self.accent,
                                          bg=t["card"])
            self._prep_phase.pack(anchor="w")
            bar = ProgressBar(body, self, height=8)
            bar.set_colors(t["card2"], self.accent)
            bar.pack(fill="x", pady=(8, 4))
            self._prep_bar = bar
            self._prep_counter = self.label(body, "0 / 0", 8, "bold", fg=t["faint"], bg=t["card"])
            self._prep_counter.pack(anchor="w")
            self._prep_note = self.label(body, "", 8, "normal", fg=t["dim"], bg=t["card"],
                                         wraplength=440, justify="left")
            self._prep_note.pack(anchor="w", pady=(10, 0))
            Button(body, self, "ЗАКРЫТЬ", win.destroy, ghost=True, size=9, padx=16,
                   pady=8).pack(anchor="e", pady=(12, 0))

        self.open_overlay(builder, 500, 320)

        def on_progress(phase, done, total):
            def upd():
                if not getattr(self, "_prep_bar", None) or not self._prep_bar.winfo_exists():
                    return
                label = "Озвучка" if phase == "audio" else "Картинки"
                self._prep_phase.config(text=f"{label}…")
                self._prep_counter.config(text=f"{done} / {total}")
                self._prep_bar.set_value(done / max(1, total), animate=False)
                if done >= total:
                    self._prep_note.config(text="Готово. Файлы сохранены в audio_cache/ и images/")
            self._safe_after(0, upd)

        texts = []
        seen = set()
        for p in pairs:
            for value, lang in ((p.audio, "de"), (p.ru, "ru")):
                if value and (lang, value) not in seen:
                    seen.add((lang, value))
                    texts.append((value, lang))

        def worker():
            prepare_media({"texts": texts, "pairs": pairs}, on_progress=on_progress,
                          stop_event=self._media_stop, want_images=True,
                          image_limit=None, image_store=self.images)

        threading.Thread(target=worker, daemon=True).start()

    # ================================================================== #
    #  НОВЫЕ ИГРЫ
    # ================================================================== #
    def build_new_game(self, kind):
        """Создаёт игру-наследника QuestionGame нужного типа."""
        cls = {
            "listen": ListenGame,
            "typing": TypingGame,
            "images": ImageGame,
            "sentence": SentenceGame,
        }.get(kind)
        if cls is None:
            self.build_games()
            return
        self.active_game_obj = cls(self)


# --------------------------------------------------------------------------- #
#  1. ИГРА «СЛУХ»: слышишь слово — выбираешь, что это было
# --------------------------------------------------------------------------- #
class ListenGame(QuestionGame, MediaMixin):
    TITLE = "Понимание на слух"
    SUBTITLE = "Слышишь только слово — определи, что это было"
    COLOR = "#2EE6A8"
    ICON = "◉"
    RECORD_KEY = "listen"
    OPTION_COUNT = 4

    def __init__(self, app):
        # в этой игре ВСЕГДА вопрос — немецкое слово на слух, ответ — русский перевод
        self._saved_direction = app.direction
        app.direction = "DE ➔ RU (Вопрос на немецком)"
        super().__init__(app)

    def hint_text(self):
        return "🔊 Послушай и выбери перевод"

    def pick_pair(self):
        pool = [p for p in self.app.audio_pairs()
                if p.kind in ("word", "phrase", "number") and p.ru]
        return self.app.rng.choice(pool) if pool else self.app.random_pair()

    def option_pool(self, pair):
        values = [p.ru for p in self.app.all_pairs() if p.ru and p.ru != pair.ru]
        return list(dict.fromkeys(values))

    def correct_option(self, pair):
        return pair.ru

    def build_prompt(self, pair):
        # текста нет — только звук и иконка
        self.prompt.config(text="🔊")
        self.sub_label.config(text="Нажми на громкоговоритель, чтобы повторить")

    def on_round(self, pair):
        # автозапуск озвучки + кнопка повтора
        holder = tk.Frame(self.media_holder, bg=self.app.theme["card"])
        holder.pack(pady=(4, 6))
        Button(holder, self.app, "🔊  ПОВТОРИТЬ",
               lambda: self.app.speak(pair.audio, "de", interrupt=True),
               accent=True, size=11, padx=22, pady=12).pack()
        self.app.speak(pair.audio, "de", interrupt=True)

    def after_correct(self, pair):
        self.sub_label.config(text=f"{pair.de}  —  {pair.ru}")

    def after_wrong(self, pair):
        self.sub_label.config(text=f"Это было:  {pair.de}  —  {pair.ru}")

    def finish(self):
        super().finish()
        try:
            self.app.direction = self._saved_direction
        except Exception:
            pass


# --------------------------------------------------------------------------- #
#  2. ИГРА «ДИКТАНТ»: услышал — напиши (по-немецки или по-русски)
# --------------------------------------------------------------------------- #
class TypingGame:
    """Диктант. Обучение письму на слух: числа, телефоны, слова, фразы."""

    TITLE = "Диктант: услышал — напиши"
    SUBTITLE = "Слушай и пиши слово, число или номер телефона"
    COLOR = "#8FD0FF"
    ICON = "⌨"
    RECORD_KEY = "typing"

    def __init__(self, app):
        self.app = app
        self.state = {"score": 0, "streak": 0, "rounds": 0, "correct": 0}
        self.pair = None
        self.answer_lang = app.stats.get("typing_lang", "de")
        if self.answer_lang not in ("de", "ru"):
            self.answer_lang = "de"
        self.source_kind = app.stats.get("typing_source", "все")
        if self.source_kind not in ("все", "числа", "телефоны", "слова"):
            self.source_kind = "все"
        self.correct_answer = ""
        self._answered = False
        self._advance_after = None
        self._build()

    # -- построение --------------------------------------------------- #
    def _build(self):
        app, t = self.app, self.app.theme
        app._game_header(self.TITLE, self.SUBTITLE, self.COLOR, icon=self.ICON)

        bar = RoundedCard(app.content, t["panel"], None, radius=16)
        bar.pack(fill="x", pady=(0, 12))
        inner = tk.Frame(bar.body, bg=t["panel"])
        inner.pack(fill="x", padx=18, pady=12)

        app.label(inner, "ПИШУ ОТВЕТ", 7, "bold", fg=t["faint"], bg=t["panel"]).pack(anchor="w")
        self.lang_row = ChoiceRow(
            inner, app,
            options=(("de", "По-немецки"), ("ru", "По-русски")),
            command=self._set_lang, bg=t["panel"])
        self.lang_row.pack(anchor="w", pady=(4, 10))
        self.lang_row.select(self.answer_lang)

        app.label(inner, "ЧТО СЛУШАЕМ", 7, "bold", fg=t["faint"], bg=t["panel"]).pack(anchor="w")
        self.src_row = ChoiceRow(
            inner, app,
            options=(("все", "Всё"), ("числа", "Числа"), ("телефоны", "Телефоны"),
                     ("слова", "Слова")),
            command=self._set_source, bg=t["panel"])
        self.src_row.pack(anchor="w", pady=(4, 0))
        self.src_row.select(self.source_kind)

        stats = RoundedCard(app.content, t["panel"], None, radius=16)
        stats.pack(fill="x", pady=(0, 12))
        row = tk.Frame(stats.body, bg=t["panel"])
        row.pack(fill="x", padx=20, pady=12)
        self.score_label = app.label(row, "0", 18, "bold", fg=self.COLOR, bg=t["panel"])
        self.score_label.pack(side="left")
        app.label(row, "верно", 9, "normal", fg=t["faint"], bg=t["panel"]).pack(
            side="left", padx=(6, 0), pady=(6, 0))
        self.streak_label = app.label(row, "0", 18, "bold", fg=STATUS_COLORS["ok"], bg=t["panel"])
        self.streak_label.pack(side="right")
        app.label(row, "серия", 9, "normal", fg=t["faint"], bg=t["panel"]).pack(
            side="right", padx=(0, 6), pady=(6, 0))

        card = RoundedCard(app.content, t["card"], None, radius=20, center=True)
        card.pack(fill="both", expand=True)
        body = tk.Frame(card.body, bg=t["card"])
        body.pack(fill="both", expand=True, padx=26, pady=20)
        self.body = body
        self.card = card

        app.label(body, "СЛУШАЙ И НАПИШИ", 9, "bold", fg=t["faint"], bg=t["card"]).pack()
        self.replay_btn = Button(body, app, "🔊  ПОВТОРИТЬ", self._replay, accent=True,
                                 size=13, padx=30, pady=14)
        self.replay_btn.pack(pady=(10, 4))
        self.replay_count = app.label(body, "", 8, "normal", fg=t["faint"], bg=t["card"])
        self.replay_count.pack()
        self.hint = app.label(body, "", 11, "bold", fg=STATUS_COLORS["warn"], bg=t["card"],
                              wraplength=700, justify="center")
        self.hint.pack(pady=(12, 6))
        self.answer_show = app.label(body, "", 26, "bold", fg=t["dim"], bg=t["card"],
                                     wraplength=700, justify="center")
        self.answer_show.pack(pady=(0, 12))

        entry_shell = tk.Frame(body, bg=t["input"], highlightthickness=1,
                               highlightbackground=t["line"])
        entry_shell.pack(fill="x", padx=60)
        self.entry = tk.Entry(entry_shell, font=(app.font, 17, "bold"), bg=t["input"],
                              fg=t["text"], insertbackground=app.accent, relief="flat", bd=0,
                              justify="center")
        self.entry.pack(fill="x", padx=14, ipady=12)
        self.entry.bind("<Return>", lambda e: self._check())

        btns = tk.Frame(body, bg=t["card"])
        btns.pack(pady=(14, 4))
        Button(btns, app, "ПРОВЕРИТЬ", self._check, accent=True, size=11, padx=24,
               pady=11).pack(side="left", padx=6)
        Button(btns, app, "ПОДСКАЗКА", self._hint, ghost=True, size=10, padx=18,
               pady=11).pack(side="left", padx=6)
        Button(btns, app, "ПРОПУСТИТЬ", self.next_round, ghost=True, size=10, padx=18,
               pady=11).pack(side="left", padx=6)

        self.feedback = app.label(body, "", 13, "bold", bg=t["card"], wraplength=700,
                                  justify="center")
        self.feedback.pack(pady=(12, 0))

        self.next_round()

    # -- настройки ---------------------------------------------------- #
    def _set_lang(self, value):
        self.answer_lang = value
        self.app.stats["typing_lang"] = value
        self.app.save_stats()
        self.lang_row.select(value)
        self.next_round()

    def _set_source(self, value):
        self.source_kind = value
        self.app.stats["typing_source"] = value
        self.app.save_stats()
        self.src_row.select(value)
        self.next_round()

    # -- раунд -------------------------------------------------------- #
    def _pool(self):
        app = self.app
        if self.source_kind == "числа":
            return list(app.number_pairs) + random_number_pairs(80, app.rng)
        if self.source_kind == "телефоны":
            return list(app.phone_pairs) + random_phone_pairs(20, app.rng)
        if self.source_kind == "слова":
            return [p for p in (app.word_pairs + app.phrase_pairs) if p.ru]
        pool = ([p for p in (app.word_pairs + app.phrase_pairs) if p.ru][:80] +
                list(app.number_pairs)[:40] + list(app.phone_pairs)[:30] +
                random_number_pairs(30, app.rng))
        return pool or app.all_pairs()

    def next_round(self):
        app = self.app
        app.stop_audio()
        if self._advance_after is not None:
            try:
                app.root.after_cancel(self._advance_after)
            except tk.TclError:
                pass
            self._advance_after = None
        self._answered = False
        pool = self._pool()
        if not pool:
            self.pair = None
            self.feedback.config(text="Нет данных для диктанта", fg=STATUS_COLORS["bad"])
            return
        self.pair = app.rng.choice(pool)
        pair = self.pair
        self.state["rounds"] += 1
        self.hint.config(text="")
        self.answer_show.config(text="")
        self.feedback.config(text="")
        try:
            self.entry.delete(0, tk.END)
            self.entry.config(bg=app.theme["input"], fg=app.theme["text"])
            self.entry.focus_set()
        except tk.TclError:
            return

        if pair.kind == "phone" and self.answer_lang == "de":
            self.play_text = phone_to_german(pair.ru)
            self.play_lang = "de"
            self.correct_answer = pair.ru
            self.hint.config(text="☎  Немецкий номер телефона — запиши цифрами, как услышишь")
        elif pair.kind == "phone":
            self.play_text = phone_to_russian(pair.ru)
            self.play_lang = "ru"
            self.correct_answer = pair.ru
            self.hint.config(text="☎  Номер телефона по-русски — запиши цифрами")
        elif pair.kind == "number" and self.answer_lang == "de":
            self.play_text = pair.de
            self.play_lang = "de"
            self.correct_answer = number_to_german(int(pair.numeric))
            self.hint.config(text="Число по-немецки — напиши его словами (например: einundzwanzig)")
        elif pair.kind == "number":
            self.play_text = pair.de
            self.play_lang = "de"
            self.correct_answer = str(pair.numeric)
            self.hint.config(text="Число по-немецки — напиши его цифрами")
        elif self.answer_lang == "de":
            self.play_text = pair.ru
            self.play_lang = "ru"
            self.correct_answer = pair.de
            self.hint.config(text="Слушай по-русски — напиши по-немецки (с артиклем)")
        else:
            self.play_text = pair.de
            self.play_lang = "de"
            self.correct_answer = pair.ru
            self.hint.config(text="Слушай по-немецки — напиши перевод по-русски")

        self._replay()
        self._refresh()

    def _replay(self):
        text = getattr(self, "play_text", "")
        if not text:
            return
        self.app.speak(text, getattr(self, "play_lang", "de"), interrupt=True)
        try:
            self.replay_btn.set_text("🔊  ПОВТОРИТЬ (пробел)")
        except Exception:
            pass

    def _hint(self):
        pair = self.pair
        if pair is None:
            return
        self.answer_show.config(text=f"Подсказка:  {pair.de}  —  {pair.ru}")

    def _check(self):
        if self._answered:
            return
        user = self.entry.get().strip()
        if not user:
            self.app.toast("Введи ответ", "warn")
            return
        self._answered = True
        expected = self.correct_answer
        exact = (normalize_answer(user) == normalize_answer(expected)
                 or user.replace(" ", "") == expected.replace(" ", ""))
        correct = exact or is_typo_match(user, expected)
        close = (not correct and similarity(user, expected) > 0.85)
        color = STATUS_COLORS["ok"] if correct else (
            STATUS_COLORS["warn"] if close else STATUS_COLORS["bad"])
        try:
            self.entry.config(bg=color, fg="#08120D" if correct else "#FFFFFF")
        except tk.TclError:
            pass
        self.answer_show.config(text=f"{self.pair.de}  —  {self.pair.ru}")
        if correct:
            points = 12 + self.state["streak"] * 2
            self.state["score"] += points
            self.state["streak"] += 1
            self.state["correct"] += 1
            if exact:
                self.feedback.config(text=f"ВЕРНО!  +{points} XP", fg=STATUS_COLORS["ok"])
            else:
                self.feedback.config(
                    text=f"ЗАСЧИТАНО С ОПЕЧАТКОЙ  •  верно: {expected}  +{points} XP",
                    fg=STATUS_COLORS["ok"])
            self.app.audio.play_effect(True)
            self.app.award(points)
            self.app.record_game("typing", 1, "add")
            self.app.spawn_confetti(self.card)
            self._schedule_next(1400)
        elif close:
            self.feedback.config(text=f"ПОЧТИ! Правильно: {expected}", fg=STATUS_COLORS["warn"])
            self._schedule_next(1800)
        else:
            self.state["streak"] = 0
            self.feedback.config(text=f"НЕВЕРНО. Правильно: {expected}", fg=STATUS_COLORS["bad"])
            self.app.audio.play_effect(False)
            self.app.register_mistake(self.pair)
            self._schedule_next(1800)
        self._refresh()

    def _schedule_next(self, delay):
        if self._advance_after is not None:
            try:
                self.app.root.after_cancel(self._advance_after)
            except tk.TclError:
                pass
        self._advance_after = self.app.root.after(delay, self._advance_round)

    def _advance_round(self):
        self._advance_after = None
        if self.app.screen == "g_typing" and self.app.active_game_obj is self:
            self.next_round()

    def _refresh(self):
        try:
            self.score_label.config(text=str(self.state["score"]))
            self.streak_label.config(text=str(self.state["streak"]))
        except tk.TclError:
            pass

    def finish(self):
        if self._advance_after is not None:
            try:
                self.app.root.after_cancel(self._advance_after)
            except tk.TclError:
                pass
            self._advance_after = None
        self.app.record_game("typing", self.state["score"], "max")


# --------------------------------------------------------------------------- #
#  3. ИГРА «КАРТИНКИ»: показывается картинка — выбираешь/пишешь слово
# --------------------------------------------------------------------------- #
class ImageGame(QuestionGame, MediaMixin):
    TITLE = "Слова по картинкам"
    SUBTITLE = "Показывается картинка — назови слово"
    COLOR = "#FF70A6"
    ICON = "▧"
    RECORD_KEY = "images"
    OPTION_COUNT = 4

    def hint_text(self):
        return "Что на картинке? Выбери правильное слово"

    def pick_pair(self):
        # только существительные/конкретные слова, которые можно изобразить
        pool = [p for p in self._visual_pool() if p.de and p.ru]
        return self.app.rng.choice(pool) if pool else self.app.random_pair()

    def _visual_pool(self):
        """Слова, для которых есть понятная картинка, — только целые слова.

        Раньше сравнение шло по подстроке, и короткие служебные слова вроде
        «und» попадали в набор (они встречаются внутри других слов).
        Теперь — точное совпадение или совпадение по отдельному слову фразы.
        """
        from dq.media import EMOJI_HINTS
        keys = {de.lower() for _g, de, _ru in EMOJI_HINTS}
        out = []
        for p in self.app.word_pairs:
            low = p.de.lower().strip()
            words = [w for w in low.replace("-", " ").split() if w]
            if low in keys or any(w in keys for w in words):
                out.append(p)
        return out or [p for p in self.app.word_pairs
                       if p.de.isalpha() and len(p.de) < 22]

    def build_prompt(self, pair):
        # текст скрыт — картинка заменяет его
        self.prompt.config(text="")
        self.sub_label.config(text="")

    def option_pool(self, pair):
        # варианты — тоже «изобразимые» слова, иначе игра нечестная
        values = [p.de for p in self._visual_pool() if p.de and p.de != pair.de]
        if len(values) < 3:
            values += [p.de for p in self.app.word_pairs if p.de and p.de != pair.de]
        return list(dict.fromkeys(values))

    def correct_option(self, pair):
        return pair.de

    def on_round(self, pair):
        # hide_text=True: на картинке нет подписи со словом — иначе это спойлер
        lbl = self.show_word_image(self.media_holder, pair.de, pair.ru, height=190,
                                   hide_text=True)
        if lbl is None:
            self.sub_label.config(text="Картинка загружается…  Можно отвечать по кнопкам")

    def after_correct(self, pair):
        self.prompt.config(text=pair.de)
        self.sub_label.config(text=pair.ru)
        self.app.speak(pair.audio, "de")

    def after_wrong(self, pair):
        self.prompt.config(text=pair.de)
        self.sub_label.config(text=pair.ru)
        self.app.speak(pair.audio, "de")


# --------------------------------------------------------------------------- #
#  4. ИГРА «ПОРЯДОК СЛОВ»: собрать предложение из кусочков (грамматика)
# --------------------------------------------------------------------------- #
class SentenceGame:
    TITLE = "Порядок слов"
    SUBTITLE = "Собери немецкое предложение в правильном порядке"
    COLOR = STATUS_COLORS["warn"]
    ICON = "§"
    RECORD_KEY = "sentence"

    def __init__(self, app):
        self.app = app
        self.state = {"score": 0, "streak": 0, "rounds": 0, "correct": 0}
        self.task = None
        self.slots = []
        self.available = []
        self._answered = False
        self.use_distractors = bool(app.stats.get("sentence_distractors", False))
        self._build()

    def _build(self):
        app, t = self.app, self.app.theme
        app._game_header(self.TITLE, self.SUBTITLE, self.COLOR, icon=self.ICON)

        bar = RoundedCard(app.content, t["panel"], None, radius=16)
        bar.pack(fill="x", pady=(0, 12))
        inner = tk.Frame(bar.body, bg=t["panel"])
        inner.pack(fill="x", padx=18, pady=12)
        row = tk.Frame(inner, bg=t["panel"])
        row.pack(fill="x")
        self.score_label = app.label(row, "0", 18, "bold", fg=self.COLOR, bg=t["panel"])
        self.score_label.pack(side="left")
        app.label(row, "очков", 9, "normal", fg=t["faint"], bg=t["panel"]).pack(
            side="left", padx=(6, 0), pady=(6, 0))
        self.streak_label = app.label(row, "0", 18, "bold", fg=STATUS_COLORS["ok"], bg=t["panel"])
        self.streak_label.pack(side="right")
        app.label(row, "серия", 9, "normal", fg=t["faint"], bg=t["panel"]).pack(
            side="right", padx=(0, 6), pady=(6, 0))
        self.distractor_row = ChoiceRow(
            inner, app,
            options=(("off", "Без лишних слов"), ("on", "С лишними словами")),
            command=self._set_distractors, bg=t["panel"])
        self.distractor_row.pack(anchor="w", pady=(10, 0))
        self.distractor_row.select("on" if self.use_distractors else "off")

        card = RoundedCard(app.content, t["card"], None, radius=20, center=True)
        card.pack(fill="both", expand=True)
        body = tk.Frame(card.body, bg=t["card"])
        body.pack(fill="both", expand=True, padx=26, pady=20)
        self.body = body
        self.card = card

        app.label(body, "СОБЕРИ ПРЕДЛОЖЕНИЕ", 9, "bold", fg=t["faint"], bg=t["card"]).pack()
        self.ru_label = app.label(body, "", 22, "bold", bg=t["card"], wraplength=720,
                                  justify="center")
        self.ru_label.pack(pady=(8, 4))
        self.rule_label = app.label(body, "", 9, "normal", fg=STATUS_COLORS["warn"], bg=t["card"],
                                    wraplength=700, justify="center")
        self.rule_label.pack(pady=(0, 14))

        self.slot_row = tk.Frame(body, bg=t["card"])
        self.slot_row.pack(pady=(6, 12))
        self.pool_row = tk.Frame(body, bg=t["card"])
        self.pool_row.pack(pady=(6, 12))

        btns = tk.Frame(body, bg=t["card"])
        btns.pack(pady=(4, 6))
        Button(btns, app, "ПРОВЕРИТЬ", self._check, accent=True, size=11, padx=24,
               pady=11).pack(side="left", padx=6)
        Button(btns, app, "СБРОСИТЬ", self._reset, ghost=True, size=10, padx=18,
               pady=11).pack(side="left", padx=6)
        Button(btns, app, "ПОДСКАЗКА", self._hint, ghost=True, size=10, padx=18,
               pady=11).pack(side="left", padx=6)
        Button(btns, app, "ДАЛЬШЕ", self.next_round, ghost=True, size=10, padx=18,
               pady=11).pack(side="left", padx=6)

        self.feedback = app.label(body, "", 13, "bold", bg=t["card"], wraplength=720,
                                  justify="center")
        self.feedback.pack(pady=(10, 0))

        self.next_round()

    def _set_distractors(self, value):
        self.use_distractors = value == "on"
        self.app.stats["sentence_distractors"] = self.use_distractors
        self.app.save_stats()
        self.distractor_row.select(value)
        self.next_round()

    def next_round(self):
        app = self.app
        app.stop_audio()
        self._answered = False
        self.task = build_sentence(app.all_pairs(), app.rng, distractors=self.use_distractors)
        self.state["rounds"] += 1
        self.feedback.config(text="")
        self.ru_label.config(text=self.task["ru"])
        self.rule_label.config(text="💡 " + self.task["rule"])
        self.slots = [None] * len(self.task["parts"])
        self.available = list(self.task["shuffled"])
        self._render()
        if self.task["pair"].audio:
            app.speak(self.task["pair"].audio, "de")

    def _render(self):
        app = self.app
        t = app.theme
        for child in self.slot_row.winfo_children():
            child.destroy()
        for child in self.pool_row.winfo_children():
            child.destroy()

        for i, chunk in enumerate(self.slots):
            if chunk is None:
                box = tk.Frame(self.slot_row, bg=t["card2"], height=46,
                               highlightthickness=1, highlightbackground=t["line"])
                box.pack(side="left", padx=4, pady=4)
                tk.Label(box, text="…", bg=t["card2"], fg=t["faint"], width=6,
                         font=(app.font, 12, "bold")).pack(padx=10, pady=10)
            else:
                Button(self.slot_row, app, chunk, lambda idx=i: self._remove(idx),
                       ghost=True, size=12, padx=14, pady=10, radius=10).pack(side="left", padx=4)

        for i, chunk in enumerate(self.available):
            if chunk is None:
                box = tk.Frame(self.pool_row, bg=app.theme["bg"], height=40, width=60)
                box.pack(side="left", padx=4, pady=4)
                box.pack_propagate(False)
            else:
                Button(self.pool_row, app, chunk, lambda idx=i: self._place(idx),
                       size=12, padx=14, pady=10, radius=10).pack(side="left", padx=4)

    def _place(self, pool_idx):
        if self._answered:
            return
        chunk = self.available[pool_idx]
        for i, v in enumerate(self.slots):
            if v is None:
                self.slots[i] = chunk
                self.available[pool_idx] = None
                self._render()
                return
        self.app.toast("Все клетки заняты — убери лишнее", "warn", 1500)

    def _remove(self, slot_idx):
        if self._answered:
            return
        chunk = self.slots[slot_idx]
        if chunk is None:
            return
        for i, v in enumerate(self.available):
            if v is None:
                self.available[i] = chunk
                break
        self.slots[slot_idx] = None
        self._render()

    def _reset(self):
        self.available = [c for c in self.slots if c is not None] + \
                         [c for c in self.available if c is not None]
        self.slots = [None] * len(self.task["parts"])
        self._render()

    def _hint(self):
        correct = self.task["answer"]
        self.feedback.config(text=f"Правильно:  {correct}", fg=STATUS_COLORS["info"])
        self.app.speak(self.task["answer"], "de")

    def _check(self):
        if self._answered:
            return
        if any(v is None for v in self.slots):
            self.app.toast("Заполни все клетки", "warn")
            return
        self._answered = True
        guess = " ".join(v for v in self.slots if v)
        correct = normalize_answer(guess) == normalize_answer(self.task["answer"])
        if correct:
            points = 15 + self.state["streak"] * 3
            self.state["score"] += points
            self.state["streak"] += 1
            self.state["correct"] += 1
            self.feedback.config(text=f"ВЕРНО!  +{points} XP", fg=STATUS_COLORS["ok"])
            self.app.audio.play_effect(True)
            self.app.speak(self.task["answer"], "de")
            self.app.award(points)
            self.app.record_game("sentence", 1, "add")
            grammar = self.app.stats.setdefault("grammar", {})
            grammar["sentences"] = grammar.get("sentences", 0) + 1
            grammar["correct"] = grammar.get("correct", 0) + 1
            self.app.save_stats()
            self.app.spawn_confetti(self.card)
            self.app.later(1600, self.next_round)
        else:
            self.state["streak"] = 0
            self.feedback.config(
                text=f"НЕВЕРНО. Правильно:  {self.task['answer']}", fg=STATUS_COLORS["bad"])
            self.app.audio.play_effect(False)
            self.app.later(2200, self.next_round)
        self._refresh()

    def _refresh(self):
        try:
            self.score_label.config(text=str(self.state["score"]))
            self.streak_label.config(text=str(self.state["streak"]))
        except tk.TclError:
            pass

    def finish(self):
        self.app.record_game("sentence", self.state["score"], "max")

# --------------------------------------------------------------------------- #
def main():
    from dq.core import set_dpi_awareness
    set_dpi_awareness()
    root = tk.Tk()
    GermanQuestApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
