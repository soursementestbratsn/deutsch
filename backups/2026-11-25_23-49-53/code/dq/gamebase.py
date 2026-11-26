# -*- coding: utf-8 -*-
"""
dq.gamebase — общий «движок» мини-игр.

Раньше каждая игра дублировала построение вопроса, вариантов и проверку ответа.
Теперь это один класс QuestionGame; конкретные игры задают только тему вопроса
(текст, картинку, озвучку) и способ ответа.

Что даёт:
  * одинаковое поведение (очки, серии, XP, рекорды) во всех играх;
  * простую реализацию новых игр: см. dq/app.py → build_game_listen / typing / images / sentence;
  * меньше кода и меньше мест для ошибок.
"""
import tkinter as tk

from .core import (STATUS_COLORS, similarity, normalize_answer, hex_blend, DQPair,
                   confusing_distractors, convert_de_to_ru_phonetics, LOGGER, RADIUS)
from .widgets import RoundedCard, Button, ProgressBar, strip_tags


class QuestionGame:
    """База для игр «вопрос → ответ вариантами»."""

    #: заголовок и подзаголовок экрана (переопределяются в игре)
    TITLE = "Игра"
    SUBTITLE = ""
    COLOR = STATUS_COLORS["info"]
    ICON = "◆"
    RECORD_KEY = None            # ключ в stats["games"]

    #: сколько вариантов ответа показывать
    OPTION_COUNT = 4

    def __init__(self, app):
        self.app = app
        self.state = {"score": 0, "streak": 0, "rounds": 0, "correct": 0}
        self.pair = None
        self.correct_answer = ""
        self._buttons = []
        self._answered = False
        self._build()

    # ------------------------------------------------------------------ #
    #  построение экрана
    # ------------------------------------------------------------------ #
    def _build(self):
        t = self.app.theme
        self.app._game_header(self.TITLE, self.SUBTITLE, self.COLOR, icon=self.ICON)

        top = RoundedCard(self.app.content, t["panel"], None, radius=16)
        top.pack(fill="x", pady=(0, 12))
        row = tk.Frame(top.body, bg=t["panel"])
        row.pack(fill="x", padx=20, pady=14)
        self.score_label = self.app.label(row, "0", 20, "bold", fg=self.COLOR, bg=t["panel"])
        self.score_label.pack(side="left")
        self.app.label(row, "очков", 9, "normal", fg=t["faint"],
                       bg=t["panel"]).pack(side="left", padx=(6, 0), pady=(6, 0))
        self.streak_label = self.app.label(row, "0", 20, "bold", fg=STATUS_COLORS["ok"],
                                           bg=t["panel"])
        self.streak_label.pack(side="right")
        self.app.label(row, "серия", 9, "normal", fg=t["faint"],
                       bg=t["panel"]).pack(side="right", padx=(0, 6), pady=(6, 0))

        self.card = RoundedCard(self.app.content, t["card"], None, radius=20, center=True)
        self.card.pack(fill="both", expand=True)
        body = tk.Frame(self.card.body, bg=t["card"])
        body.pack(fill="both", expand=True, padx=24, pady=20)
        self.body = body

        self.hint_label = self.app.label(body, self.hint_text(), 9, "bold", fg=t["faint"],
                                         bg=t["card"])
        self.hint_label.pack()

        self.media_holder = tk.Frame(body, bg=t["card"])
        self.media_holder.pack(fill="x")

        self.prompt = self.app.label(body, "", 34, "bold", bg=t["card"], wraplength=760,
                                     justify="center")
        self.prompt.pack(pady=(8, 2))
        self.sub_label = self.app.label(body, "", 13, "normal", fg=t["dim"], bg=t["card"],
                                        wraplength=700, justify="center")
        self.sub_label.pack(pady=(0, 8))

        self.options_frame = tk.Frame(body, bg=t["card"])
        self.options_frame.pack(fill="x", pady=(8, 4))
        self.feedback = self.app.label(body, "", 13, "bold", bg=t["card"], wraplength=700,
                                       justify="center")
        self.feedback.pack(pady=(8, 0))

        self.extra_holder = tk.Frame(body, bg=t["card"])
        self.extra_holder.pack(fill="x", pady=(10, 0))

        self.next_round()

    # ------------------------------------------------------------------ #
    #  что переопределяют игры
    # ------------------------------------------------------------------ #
    def hint_text(self):
        return "Выбери правильный ответ"

    def pick_pair(self):
        return self.app.random_pair()

    def build_prompt(self, pair):
        """Заполняет prompt/sub_label/media. По умолчанию DE → RU."""
        self.prompt.config(text=pair.de)
        self.sub_label.config(text=convert_de_to_ru_phonetics(pair.de))

    def option_pool(self, pair):
        """Список неверных вариантов (строк)."""
        is_ru = getattr(self.app, "direction", "").startswith("RU")
        values = []
        for p in self.app.all_pairs():
            val = p.de if is_ru else p.ru
            if val and val != (pair.de if is_ru else pair.ru):
                values.append(val)
        return list(dict.fromkeys(values))

    def correct_option(self, pair):
        is_ru = getattr(self.app, "direction", "").startswith("RU")
        return pair.de if is_ru else pair.ru

    def after_correct(self, pair):
        """Хук: что показать/озвучить при верном ответе."""

    def after_wrong(self, pair):
        """Хук: что показать при ошибке."""

    def on_round(self, pair):
        """Хук: вызывается каждый раунд до построения вариантов."""

    # ------------------------------------------------------------------ #
    #  цикл игры
    # ------------------------------------------------------------------ #
    def next_round(self):
        self.app.stop_audio()
        self._answered = False
        pair = self.pick_pair()
        if pair is None:
            self.prompt.config(text="Нет данных для этой игры")
            self.sub_label.config(text="")
            return
        self.pair = pair
        self.state["rounds"] += 1
        self.correct_answer = self.correct_option(pair)
        self.feedback.config(text="")
        self._clear_media()
        self.on_round(pair)
        self.build_prompt(pair)
        self._render_options()
        self.hint_label.config(text=self.hint_text())

    def replay(self):
        """Повторить озвучку текущего вопроса (по пробелу/кнопке).

        Базовая реализация: заново произносит аудио пары. Игры, где звук —
        основа (Слух), переопределяют это под своё поведение.
        """
        pair = getattr(self, "pair", None)
        if pair is not None and getattr(pair, "audio", None):
            self.app.speak(pair.audio, "de", interrupt=True)

    def _clear_media(self):
        for child in self.media_holder.winfo_children():
            child.destroy()
        for child in self.extra_holder.winfo_children():
            child.destroy()

    def _render_options(self):
        for child in self.options_frame.winfo_children():
            child.destroy()
        count = max(2, self.OPTION_COUNT)
        # варианты подбираются похожими на ответ (тот же тип, схожая длина/буквы),
        # чтобы нельзя было угадать, просто отбросив «явно не то»
        wrong = confusing_distractors(self.correct_answer,
                                      self.option_pool(self.pair),
                                      count=count - 1, rng=self.app.rng)
        if len(wrong) < count - 1:
            seen = {normalize_answer(self.correct_answer)}
            seen.update(normalize_answer(v) for v in wrong)
            for v in self.option_pool(self.pair):
                if len(wrong) >= count - 1:
                    break
                key = normalize_answer(v)
                if key and key not in seen:
                    seen.add(key)
                    wrong.append(v)
        options = wrong[:count - 1] + [self.correct_answer]
        self.app.rng.shuffle(options)
        self._buttons = []
        for idx, option in enumerate(options):
            row, col = divmod(idx, 2)
            b = Button(self.options_frame, self.app, f"{idx + 1}.  {option}",
                       lambda o=option: self.answer(o), ghost=True, size=11,
                       padx=14, pady=15, radius=RADIUS["md"])
            b.grid(row=row, column=col, sticky="nsew", padx=5, pady=5)
            self.options_frame.grid_columnconfigure(col, weight=1)
            self._buttons.append((b, option))

    def answer(self, selected):
        if self._answered:
            return
        self._answered = True
        correct = normalize_answer(selected) == normalize_answer(self.correct_answer)
        for b, option in self._buttons:
            if normalize_answer(option) == normalize_answer(self.correct_answer):
                b.redraw(bg=STATUS_COLORS["ok"], border=STATUS_COLORS["ok"], fg="#08120D")
            elif normalize_answer(option) == normalize_answer(selected) and not correct:
                b.redraw(bg=STATUS_COLORS["bad"], border=STATUS_COLORS["bad"], fg="#FFFFFF")
            b.set_enabled(False)
        if correct:
            self._on_correct()
        else:
            self._on_wrong(selected)

    def _on_correct(self):
        points = 10 + self.state["streak"] * 2
        self.state["score"] += points
        self.state["correct"] += 1
        self.state["streak"] += 1
        self._refresh_score()
        self.feedback.config(text=f"ВЕРНО!   +{points} XP", fg=STATUS_COLORS["ok"])
        self.app.audio.play_effect(True)
        self.app.speak(self.pair.audio)
        self.app.award(points)
        self.app.spawn_confetti()
        self.after_correct(self.pair)
        self.app.later(1100, self.next_round)

    def _on_wrong(self, selected):
        self.state["streak"] = 0
        self._refresh_score()
        self.feedback.config(text=f"НЕВЕРНО. Правильно: {self.correct_answer}",
                             fg=STATUS_COLORS["bad"])
        self.app.audio.play_effect(False)
        self.app.register_mistake(self.pair)
        self.after_wrong(self.pair)
        self.app.later(1500, self.next_round)

    def _refresh_score(self):
        try:
            self.score_label.config(text=str(self.state["score"]))
            self.streak_label.config(text=str(self.state["streak"]))
        except tk.TclError:
            pass

    def finish(self):
        """Вызывается при уходе с экрана: сохраняет рекорд."""
        if not self.RECORD_KEY:
            return
        self.app.record_game(self.RECORD_KEY, self.state["score"], mode="max")
        if self.RECORD_KEY == "speed":
            self.app.record_game("best_speed", self.state["score"], mode="max")


class MediaMixin:
    """Утилиты для игр, которым нужны картинки/озвучка."""

    def show_word_image(self, parent, de_text, ru_text="", height=150, hide_text=False):
        """Показывает картинку слова — сразу и всегда.

        Логика:
          1. есть готовый файл (кэш/локальный) — рисуем сразу;
          2. нет — мгновенно рисуем простую ассоциацию (PIL) и показываем её;
          3. параллельно просим красивую картинку из сети — если придёт, заменим.
        Так игрок никогда не смотрит на пустоту.

        hide_text=True — для игр-угадаек, чтобы на картинке не было подписи-ответа.
        """
        app = self.app
        # 1. готовый файл
        path = app.images.find_file(de_text)
        if path:
            return self._render_image(parent, path, height)

        # 2. мгновенная офлайн-картинка (показываем сразу)
        from .media import generate_simple_image
        blob = generate_simple_image(de_text, ru_text, bg=app.theme["card"],
                                     accent=app.accent, show_text=not hide_text)
        placeholder = None
        rendered = None
        if blob:
            try:
                placeholder = app.images.save_bytes(de_text, blob, ".png")
                rendered = self._render_image(parent, placeholder, height)
            except Exception:
                LOGGER.debug("placeholder image failed", exc_info=True)

        # 3. параллельно тянем красивую картинку из сети и заменяем
        def on_ready(new_path):
            if not new_path or new_path == placeholder:
                return
            if getattr(self, "pair", None) and self.pair.de == de_text:
                self._replace_image(self.media_holder, new_path, height, de_text)

        app.request_image(de_text, ru_text, on_ready=on_ready)
        return rendered

    def _replace_image(self, parent, path, height, de_text):
        """Заменяет уже показанную картинку на новую (когда пришла из сети)."""
        try:
            if not parent.winfo_exists():
                return
        except tk.TclError:
            return
        for child in parent.winfo_children():
            try:
                child.destroy()
            except tk.TclError:
                pass
        self._render_image(parent, path, height)

    def _set_image(self, path, de_text):
        # картинка догрузилась в фоне — обновляем, если слово всё ещё актуально
        if path and getattr(self, "pair", None) and self.pair.de == de_text:
            self._replace_image(self.media_holder, path, 150, de_text)

    def _render_image(self, parent, path, height):
        photo = self.app.images.photo(path, 620, height)
        if photo is None:
            return None
        try:
            holder = tk.Frame(parent, bg=self.app.theme["card"])
            holder.pack(fill="x", pady=(4, 6))
            lbl = tk.Label(holder, image=photo, bg=self.app.theme["card"])
            lbl.image = photo
            lbl.pack()
        except tk.TclError:
            return None
        return lbl


def pairs_to_labels(pairs):
    return [strip_tags(p.de) for p in pairs]
