# -*- coding: utf-8 -*-
"""
dq.widgets — визуальные компоненты приложения.

Из старого кода перенесено почти без изменений (они работали хорошо), но:
  * кнопки и карточки теперь парсят теги в тексте:  «<accent>Слово</accent> <dim>перевод</dim>»
    — это позволяет раскрашивать вопрос в тренажёре;
  * добавлен ChoiceRow — строка кнопок-переключателей (часто использовалась вручную);
  * Badge — маленькая цветная метка-подпись.
"""
import tkinter as tk
import re
from tkinter import font as tkfont

from .core import (THEMES, STATUS_COLORS, hex_blend, RADIUS, GLASS_REGULAR,
                   GLASS_CLEAR, material_color, specular, deepen)

try:
    from PIL import Image, ImageTk
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


# --------------------------------------------------------------------------- #
#  Разбор разметки в текстах кнопок/карточек
# --------------------------------------------------------------------------- #
_TAG_RE = re.compile(r"<(accent|accent2|dim|faint|ok|bad|warn|info|text)>(.*?)</\1>",
                     re.DOTALL)


def _resolve_tag(app, tag):
    t = app.theme
    table = {
        "accent": app.accent, "accent2": app.accent2,
        "dim": t["dim"], "faint": t["faint"], "text": t["text"],
        "ok": STATUS_COLORS["ok"], "bad": STATUS_COLORS["bad"],
        "warn": STATUS_COLORS["warn"], "info": STATUS_COLORS["info"],
    }
    return table.get(tag, t["text"])


def _tokenize(text):
    """'<accent>Wort</accent> <dim>слово</dim>' → [('accent','Wort'), (None,' '), ('dim','слово')]"""
    if not text:
        return []
    tokens, pos = [], 0
    for match in _TAG_RE.finditer(text):
        if match.start() > pos:
            tokens.append((None, text[pos:match.start()]))
        tokens.append((match.group(1), match.group(2)))
        pos = match.end()
    if pos < len(text):
        tokens.append((None, text[pos:]))
    return tokens


def strip_tags(text):
    return _TAG_RE.sub(lambda m: m.group(2), text or "")


def _round_rect(canvas, x0, y0, x1, y1, r, **kw):
    """Рисует скруглённый прямоугольник одним polygon — без «швов» на углах."""
    r = max(0, min(r, (x1 - x0) / 2, (y1 - y0) / 2))
    if r <= 0.5:
        return canvas.create_rectangle(x0, y0, x1, y1, **kw)
    pts = [
        x0 + r, y0, x1 - r, y0,
        x1, y0, x1, y0 + r,
        x1, y1 - r, x1, y1,
        x1 - r, y1, x0 + r, y1,
        x0, y1, x0, y1 - r,
        x0, y0 + r, x0, y0,
    ]
    return canvas.create_polygon(pts, smooth=True, splinesteps=24, **kw)


class RoundedCard(tk.Frame):
    """Поверхность контента (CONTENT LAYER) с мягким скруглением.

    Плотная поверхность без «стекла» и тяжёлых теней. Стекло применяется
    только к плавающим controls (см. Button/GlassPanel).
    """

    def __init__(self, parent, bg, border=None, radius=RADIUS["lg"], padding=0,
                 center=False, glass=False, backdrop=None, **kwargs):
        try:
            outer_bg = parent.cget("bg")
        except Exception:
            outer_bg = bg
        super().__init__(parent, bg=outer_bg, bd=0, highlightthickness=0, **kwargs)
        self.radius = radius
        self.inner_bg = bg
        self.border = border
        self.center = center
        self.glass = glass
        self.backdrop = backdrop or outer_bg
        self.canvas = tk.Canvas(self, width=1, height=1, bd=0, highlightthickness=0, bg=outer_bg)
        self.body = tk.Frame(self.canvas, bg=bg)
        self.body_id = self.canvas.create_window(0, 0, window=self.body, anchor="nw")
        self.canvas.pack(fill="both", expand=True, padx=padding, pady=padding)
        self.bind("<Configure>", self._redraw)
        self.body.bind("<Configure>", self._sync)

    def _sync(self, _event=None):
        try:
            need = max(self.body.winfo_reqheight(), 1)
            if self.canvas.winfo_height() < need:
                self.canvas.configure(height=need)
                self._redraw()
        except tk.TclError:
            pass

    def _redraw(self, event=None):
        w = max(self.winfo_width(), self.winfo_reqwidth(), 1)
        h = max(self.winfo_height(), self.canvas.winfo_reqheight(), 1)
        c = self.canvas
        c.delete("cardbg")
        r = min(self.radius, w // 2, h // 2)
        base = self.inner_bg
        shadow = deepen(base, 0.08)
        _round_rect(c, 0, 0, w, h, r, fill=shadow, outline="", tags="cardbg")
        _round_rect(c, 0, 1, w, h - 1, max(0, r - 1), fill=base, outline="", tags="cardbg")
        c.create_line(r * 0.5, 1.5, w - r * 0.5, 1.5,
                      fill=specular(base, 0.22), width=1, tags="cardbg")
        if self.border:
            _round_rect(c, 0.5, 0.5, w - 0.5, h - 0.5, max(0, r - 1), fill="",
                        outline=self.border, width=1, tags="cardbg")
        body_h = self.body.winfo_reqheight()
        if self.center and body_h and h > body_h:
            y = (h - body_h) / 2
        else:
            y = max(6, r * 0.35)
        try:
            c.itemconfigure(self.body_id, width=max(1, w - 2 * r * 0.38))
            c.coords(self.body_id, r * 0.38, y)
        except tk.TclError:
            pass

    def set_colors(self, bg, border=None):
        self.inner_bg = bg
        self.border = border
        self.body.config(bg=bg)
        self._redraw()


class GlassPanel(tk.Frame):
    """FLOATING GLASS LAYER — плавающая стеклянная панель поверх контента.

    Настоящий материал Liquid Glass:
      * оттенок берётся от фона под панелью (material_color);
      * по верхней кромке — тонкий specular-блик;
      * «дно» чуть темнее — ощущение толщины материала;
      * полупрозрачность имитируется наложением на цвет фона.
    """

    def __init__(self, parent, app, radius=RADIUS["xl"], material=None, padding=0, **kwargs):
        self.app = app
        self.material = material or self.app.theme.get("glass", GLASS_REGULAR)
        try:
            outer = parent.cget("bg")
        except Exception:
            outer = self.app.theme["bg"]
        super().__init__(parent, bg=outer, bd=0, highlightthickness=0, **kwargs)
        self.radius = radius
        self.backdrop = outer
        self.canvas = tk.Canvas(self, width=1, height=1, bd=0, highlightthickness=0, bg=outer)
        self.canvas.pack(fill="both", expand=True, padx=padding, pady=padding)
        self.body = tk.Frame(self.canvas, bg=outer)
        self.body_id = self.canvas.create_window(0, 0, window=self.body, anchor="nw")
        self.bind("<Configure>", self._redraw)
        self.body.bind("<Configure>", self._sync)

    def _sync(self, _event=None):
        try:
            need = max(self.body.winfo_reqheight(), 1)
            if self.canvas.winfo_height() < need:
                self.canvas.configure(height=need)
                self._redraw()
        except tk.TclError:
            pass

    def material_color(self):
        t = self.app.theme
        return material_color(self.material, self.backdrop, t.get("tint"))

    def _redraw(self, event=None):
        w = max(self.winfo_width(), self.winfo_reqwidth(), 1)
        h = max(self.winfo_height(), self.canvas.winfo_reqheight(), 1)
        c = self.canvas
        c.delete("glass")
        r = min(self.radius, w // 2, h // 2)
        base = self.material_color()
        under = deepen(base, 0.12)
        glow = hex_blend(base, "#FFFFFF", 0.08)
        _round_rect(c, 0, 0, w, h, r, fill=under, outline="", tags="glass")
        _round_rect(c, 0, 1, w, h - 1, max(0, r - 1), fill=base, outline="", tags="glass")
        c.create_line(r * 0.4, 1.2, w - r * 0.4, 1.2,
                      fill=specular(base, 0.38), width=1, tags="glass")
        c.create_line(1.3, max(2, r * 0.5), 1.3, h - max(2, r * 0.5),
                      fill=specular(base, 0.14), width=1, tags="glass")
        c.create_oval(0, 0, w * 0.55, h * 0.45, fill=hex_blend(glow, self.app.accent, 0.08),
                      outline="", tags="glass")
        _round_rect(c, 0.5, 0.5, w - 0.5, h - 0.5, max(0, r - 1), fill="",
                    outline=hex_blend(base, "#FFFFFF", 0.18), width=1, tags="glass")
        self.body.configure(bg=base)
        for child in self.body.winfo_children():
            try:
                child.configure(bg=base)
            except Exception:
                pass
        try:
            c.itemconfigure(self.body_id, width=max(1, w - 4))
            c.coords(self.body_id, 2, 2)
        except tk.TclError:
            pass

    def set_material(self, material):
        self.material = material
        self._redraw()

    def content_size(self, extra_w=4, extra_h=4):
        """Требуемый размер панели по её содержимому (для place-геометрии)."""
        self.update_idletasks()
        w = max(self.body.winfo_reqwidth(), 1) + extra_w
        h = max(self.body.winfo_reqheight(), 1) + extra_h
        return w, h


class Button(tk.Canvas):
    """Кнопка Liquid Glass с плавным hover/press и specular-состоянием.

    Состояния меняют ПЛОТНОСТЬ материала и положение света, а не резко
    переключают цвет — как физическая поверхность.
    """

    def __init__(self, parent, app, text="", command=None, accent=False, danger=False,
                 ghost=False, glass=True, size=10, weight="bold", padx=18, pady=11,
                 radius=RADIUS["md"], **kw):
        self.app = app
        self.command = command
        self.accent = accent
        self.danger = danger
        self.ghost = ghost
        self.glass = glass
        self.radius = radius
        self._text = text
        self._size = size
        self._weight = weight
        self._enabled = True
        self._padx = padx
        self._pady = pady
        self._hover = False
        self._pressed = False
        self._transition_job = None
        self._display_fill = None
        self._font = tkfont.Font(root=app.root, family=app.font, size=size, weight=weight)
        self._tokens = []
        width = self._measure(text) + padx * 2
        height = self._font.metrics("linespace") + pady * 2
        try:
            parent_bg = parent.cget("bg")
        except Exception:
            parent_bg = app.theme["bg"]
        super().__init__(parent, width=max(24, width), height=max(20, height), bd=0,
                         highlightthickness=0, bg=parent_bg, cursor="hand2")
        self.bind("<Configure>", lambda e: self.redraw())
        self.bind("<Enter>", self._enter)
        self.bind("<Leave>", self._leave)
        self.bind("<ButtonPress-1>", self._press)
        self.bind("<ButtonRelease-1>", self._release)
        self.redraw()

    # -- измерение ---------------------------------------------------------- #
    def _measure(self, text):
        plain = strip_tags(text)
        return self._font.measure(plain or " ")

    def _prepare_tokens(self, fg):
        tokens = []
        for tag, chunk in _tokenize(self._text):
            if not chunk:
                continue
            color = fg if tag is None else _resolve_tag(self.app, tag)
            tokens.append((color, chunk))
        return tokens

    def _backdrop(self):
        try:
            return self.master.cget("bg")
        except Exception:
            return self.app.theme["bg"]

    def colors(self):
        """(fill, text, border, specular_strength) для текущего состояния."""
        t = self.app.theme
        backdrop = self._backdrop()
        if not self._enabled:
            base = material_color(t.get("glass", GLASS_REGULAR), backdrop, t.get("tint"))
            return hex_blend(base, backdrop, 0.55), t["faint"], None, 0.06
        if self.accent:
            fill = hex_blend(self.app.accent, "#FFFFFF", 0.16)
            fg = "#06140F"
        elif self.danger:
            fill = hex_blend(STATUS_COLORS["bad"], "#FFFFFF", 0.12)
            fg = "#FFFFFF"
        elif self.ghost:
            fill = material_color(t.get("glass_clear", GLASS_CLEAR), backdrop, t.get("tint"))
            fg = t["text"]
        else:
            fill = (material_color(t.get("glass", GLASS_REGULAR), backdrop, t.get("tint"))
                    if self.glass else t["card"])
            fg = t["text"]
        if self._pressed:
            fill = hex_blend(fill, "#000000", 0.12)
            spec = 0.12
        elif self._hover:
            fill = hex_blend(fill, "#FFFFFF", 0.18)
            spec = 0.46
        else:
            spec = 0.28
        border = hex_blend(fill, "#FFFFFF", 0.16)
        return fill, fg, border, spec

    def redraw(self, bg=None, border=None, fg=None):
        if not self.winfo_exists():
            return
        default_bg, default_fg, default_border, spec = self.colors()
        bg = bg or default_bg
        fg = fg or default_fg
        border = border or default_border
        w = max(1, self.winfo_width())
        h = max(1, self.winfo_height())
        c = self
        c.delete("all")
        inset = 2 if self._pressed and self._enabled else 0
        r = min(self.radius, (w - inset * 2) // 2, (h - inset * 2) // 2)
        under = deepen(bg, 0.10)
        _round_rect(c, inset, inset, w - inset, h - inset, r, fill=under, outline="")
        _round_rect(c, inset, inset + 1, w - inset, h - inset - 1,
                    max(0, r - 1), fill=bg, outline="")
        if r > 3:
            c.create_line(inset + r * 0.7, inset + 1.2, w - inset - r * 0.7,
                          inset + 1.2, fill=specular(bg, spec), width=1)
        c.create_line(inset + 1.2, inset + max(1, r * 0.5), inset + 1.2,
                      h - inset - max(1, r * 0.5),
                      fill=specular(bg, max(0.08, spec * 0.4)), width=1)
        if border:
            _round_rect(c, inset + 0.5, inset + 0.5, w - inset - 0.5,
                        h - inset - 0.5, max(0, r - 1), fill="",
                        outline=border, width=1)
        tokens = self._prepare_tokens(fg)
        if not tokens:
            return
        # центрируем «строку» из разноцветных кусков
        widths = [self._font.measure(chunk) for _, chunk in tokens]
        total = sum(widths)
        x = (w - total) / 2
        y = h / 2
        for (color, chunk), cw in zip(tokens, widths):
            c.create_text(x, y, text=chunk, fill=color, font=self._font, anchor="w")
            x += cw
        self._display_fill = bg

    def animate_material(self):
        if not self.winfo_exists():
            return
        if self._transition_job is not None:
            try:
                self.after_cancel(self._transition_job)
            except tk.TclError:
                pass
            self._transition_job = None
        target, target_fg, target_border, _spec = self.colors()
        start = self._display_fill or target
        frames = (8 if self.app.animation_level == "Плавно" else 5)
        if not self.app.animations_enabled or self.app.animation_level == "Мгновенно":
            self.redraw()
            return

        def advance(step=1):
            self._transition_job = None
            if not self.winfo_exists():
                return
            amount = 1 - (1 - step / frames) ** 2
            fill = hex_blend(start, target, amount)
            self.redraw(bg=fill, fg=target_fg,
                        border=hex_blend(start, target_border or target, amount))
            if step < frames:
                self._transition_job = self.after(16, advance, step + 1)

        advance()

    def set_text(self, text):
        self._text = text
        if not self.winfo_exists():
            return
        try:
            need = self._measure(text) + self._padx * 2
            if need > self.winfo_reqwidth():
                self.configure(width=need)
        except tk.TclError:
            return
        self.redraw()

    def set_enabled(self, enabled):
        self._enabled = enabled
        self.configure(cursor="hand2" if enabled else "")
        self.redraw()

    def set_accent(self, accent):
        self.accent = accent
        self.redraw()

    def set_ghost(self, ghost):
        self.ghost = ghost
        self.redraw()

    def set_material(self, material):
        self.material = material
        self.redraw()

    # -- события: плавные spring-анимации ---------------------------------- #
    def _enter(self, _e):
        if not self._enabled:
            return
        self._hover = True
        self.app.animate_control(self, "hover")

    def _leave(self, _e):
        self._hover = False
        self._pressed = False
        if self._enabled:
            self.app.animate_control(self, "idle")

    def _press(self, _e):
        if not self._enabled:
            return
        self._pressed = True
        self.app.animate_control(self, "press")

    def _release(self, event):
        self._pressed = False
        if not self._enabled:
            return
        inside = (event is None or
                  0 <= event.x <= self.winfo_width() and
                  0 <= event.y <= self.winfo_height())
        self.app.animate_control(self, "hover" if self._hover else "idle")
        if inside and self.command:
            self.app.run_action(self.command)


class ProgressBar(tk.Canvas):
    def __init__(self, parent, app, height=8, radius=None):
        self.app = app
        radius = radius if radius is not None else height // 2
        super().__init__(parent, height=height, bd=0, highlightthickness=0,
                         bg=parent.cget("bg"))
        self.value = 0.0
        self.target = 0.0
        self.height_px = height
        self.radius = radius
        self.track_color = None
        self.fill_color = None
        self.bind("<Configure>", lambda e: self.draw())

    def set_colors(self, track, fill):
        self.track_color = track
        self.fill_color = fill
        self.draw()

    def set_value(self, value, animate=True):
        self.target = max(0.0, min(1.0, value))
        if animate:
            self.app.animate_progress(self)
        else:
            self.value = self.target
            self.draw()

    def tick(self):
        diff = self.target - self.value
        if abs(diff) < 0.002:
            self.value = self.target
            self.draw()
            return False
        self.value += diff * 0.28
        self.draw()
        return True

    def draw(self):
        if not self.winfo_exists():
            return
        w = max(1, self.winfo_width())
        h = self.height_px
        t = self.app.theme
        track = self.track_color or hex_blend(t["card2"], "#000000", 0.15)
        fill = self.fill_color or self.app.accent
        self.delete("all")
        r = min(self.radius, h // 2)
        _round_rect(self, 0, 0, w, h, r, fill=track, outline="")
        fw = int(w * self.value)
        if fw > 2:
            fw = max(fw, r * 2)
            _round_rect(self, 0, 0, fw, h, r, fill=fill, outline="")
            # specular по верхней кромке заполненной части
            self.create_line(r * 0.6, 1, max(1, fw - r * 0.6), 1,
                             fill=specular(fill, 0.35), width=1)


class Ring(tk.Canvas):
    """Кольцо прогресса (меню игр и статистика)."""

    def __init__(self, parent, app, size=64, thickness=7):
        super().__init__(parent, width=size, height=size, bd=0, highlightthickness=0,
                         bg=parent.cget("bg"))
        self.app = app
        self.size = size
        self.thickness = thickness
        self.value = 0.0
        self.target = 0.0
        self.caption = ""
        self.sub = ""
        self.color = app.accent

    def set_colors(self, color):
        self.color = color
        self.draw()

    def set(self, value, caption="", sub=""):
        self.target = max(0.0, min(1.0, value))
        self.caption = caption
        self.sub = sub
        self.app.animate_ring(self)

    def tick(self):
        diff = self.target - self.value
        if abs(diff) < 0.004:
            self.value = self.target
            self.draw()
            return False
        self.value += diff * 0.25
        self.draw()
        return True

    def draw(self):
        if not self.winfo_exists():
            return
        s = self.size
        pad = self.thickness // 2 + 1
        x0, y0, x1, y1 = pad, pad, s - pad, s - pad
        self.delete("all")
        track = hex_blend(self.app.theme["card2"], "#000000", 0.15)
        self.create_oval(x0, y0, x1, y1, outline=track, width=self.thickness)
        if self.value > 0.001:
            self.create_arc(x0, y0, x1, y1, start=90, extent=-359.99 * self.value,
                            style="arc", outline=self.color, width=self.thickness)
        if self.caption:
            self.create_text(s // 2, s // 2 - (4 if self.sub else 0), text=self.caption,
                             fill=self.app.theme["text"], font=(self.app.font, 12, "bold"))
        if self.sub:
            self.create_text(s // 2, s // 2 + 11, text=self.sub,
                             fill=self.app.theme["faint"], font=(self.app.font, 6, "bold"))


class ScrollFrame(tk.Frame):
    """Прокручиваемая область."""

    def __init__(self, parent, app, bg=None, padx=0, pady=0):
        bg = bg or app.theme["bg"]
        super().__init__(parent, bg=bg)
        self.app = app
        self.canvas = tk.Canvas(self, bg=bg, bd=0, highlightthickness=0)
        self.scroll = tk.Scrollbar(self, orient="vertical", command=self.canvas.yview,
                                   width=8, bd=0, relief="flat", troughcolor=bg,
                                   background=app.theme["card2"], activebackground=app.accent)
        self.body = tk.Frame(self.canvas, bg=bg)
        self.window = self.canvas.create_window((0, 0), window=self.body, anchor="nw")
        self.canvas.configure(yscrollcommand=self._on_scroll_set)
        self.canvas.pack(side="left", fill="both", expand=True, padx=(padx, 0), pady=pady)
        self.body.bind("<Configure>",
                       lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.bind("<Configure>", self._fit_width)
        self.bind("<Enter>", lambda e: self._bind_wheel(True))
        self.bind("<Leave>", lambda e: self._bind_wheel(False))
        self._bind_wheel(True)

    def _fit_width(self, event):
        self.canvas.itemconfigure(self.window, width=event.width)

    def _on_scroll_set(self, first, last):
        if float(first) <= 0.0 and float(last) >= 1.0:
            self.scroll.pack_forget()
        else:
            self.scroll.pack(side="right", fill="y", padx=(0, 4))
        self.scroll.set(first, last)

    def _bind_wheel(self, on):
        if on:
            self.canvas.bind_all("<MouseWheel>", self._wheel, add="+")
        else:
            try:
                self.canvas.unbind_all("<MouseWheel>")
            except Exception:
                pass

    def _wheel(self, event):
        units = int(-1 * (event.delta / 120))
        if not units:
            return
        first, last = self.canvas.yview()
        if units > 0 and last < 1.0:
            self.app.set_tabbar_visible(False)
        elif units < 0 and first > 0.0:
            self.app.set_tabbar_visible(True)
        self.canvas.yview_scroll(units, "units")


class Toast(tk.Toplevel):
    """Всплывающее уведомление."""

    def __init__(self, app, text, kind="info", duration=1700):
        super().__init__(app.root)
        self.overrideredirect(True)
        t = app.theme
        color = STATUS_COLORS.get(kind, t["text"])
        bg = material_color(t.get("glass", GLASS_REGULAR), t["bg2"], t.get("tint"))
        self.configure(bg=bg)
        frame = tk.Frame(self, bg=bg, bd=0, highlightthickness=0)
        frame.pack(padx=1, pady=1)
        tk.Frame(frame, bg=color, width=3).pack(side="left", fill="y")
        tk.Label(frame, text=strip_tags(text), bg=bg, fg=t["text"],
                 font=(app.font, 10, "bold"), padx=14, pady=10).pack(side="left")
        self.update_idletasks()
        x = app.root.winfo_rootx() + (app.root.winfo_width() - self.winfo_width()) // 2
        y = app.root.winfo_rooty() + app.root.winfo_height() - 90
        self.geometry(f"+{max(0, x)}+{max(0, y)}")
        try:
            self.after(duration, self.destroy)
        except tk.TclError:
            pass


class ChoiceRow(tk.Frame):
    """Строка кнопок-переключателей с подсветкой выбранного."""

    def __init__(self, parent, app, options, command, bg=None, size=9, padx=12, pady=7,
                 radius=RADIUS["sm"], wrap=False):
        bg = bg or app.theme["panel"]
        super().__init__(parent, bg=bg)
        self.app = app
        self.command = command
        self.buttons = {}
        for key, title in options:
            b = Button(self, app, title, lambda k=key: self.command(k), size=size,
                       padx=padx, pady=pady, radius=radius)
            b.pack(side="left", padx=(0, 6), pady=2)
            self.buttons[key] = b

    def select(self, value):
        for key, b in self.buttons.items():
            b.set_accent(key == value)


class Badge(tk.Frame):
    """Маленькая цветная метка-подпись."""

    def __init__(self, parent, app, text, color, bg=None, size=8):
        bg = bg or app.theme["panel"]
        super().__init__(parent, bg=bg)
        self.app = app
        self.label = tk.Label(self, text=text, bg=hex_blend(color, bg, 0.78), fg=color,
                              font=(app.font, size, "bold"), padx=8, pady=3)
        self.label.pack()

    def set_text(self, text):
        try:
            self.label.config(text=text)
        except tk.TclError:
            pass


class ImagePreview(tk.Frame):
    """Превью картинки слова + кнопки «другая» / «создать»."""

    def __init__(self, parent, app, image_store, height=170):
        super().__init__(parent, bg=app.theme["card"])
        self.app = app
        self.store = image_store
        self.height = height
        self.path = None
        self.photo = None
        self.de_text = ""
        self.ru_text = ""
        self._hover_bg = None
        self.canvas = tk.Canvas(self, height=height, bd=0, highlightthickness=0,
                                bg=app.theme["card"])
        self.canvas.pack(fill="x", expand=True)
        self.canvas.bind("<Configure>", lambda e: self.render())
        self.label = tk.Label(self.canvas, bg=app.theme["card"], bd=0)
        self.label.bind("<Button-1>", lambda e: self.app.run_action(self.buttons_toggle))

    # -- данные ---------------------------------------------------------- #
    def show(self, de_text, ru_text=""):
        self.de_text = de_text
        self.ru_text = ru_text
        self.path = self.store.find_file(de_text) if de_text else None
        self.render()

    def set_path(self, path):
        self.path = path
        self.render()

    def refresh(self):
        if self.de_text:
            self.show(self.de_text, self.ru_text)

    # -- отрисовка ------------------------------------------------------- #
    def render(self):
        if not self.winfo_exists():
            return
        self.photo = None
        if not self.path:
            self.label.config(image="", text="")
            self.label.place_forget()
            return
        max_w = max(120, self.winfo_width() - 20)
        max_h = max(60, self.height - 10)
        photo = self.store.photo(self.path, max_w, max_h)
        if photo is None:
            self.label.place_forget()
            return
        self.photo = photo
        try:
            self.label.config(image=photo, text="")
            self.label.place(relx=0.5, rely=0.5, anchor="center")
        except tk.TclError:
            pass

    def buttons_toggle(self):
        self.app.toast("Клик по картинке: используй кнопки «Другая картинка» / «Создать»",
                       "info", 2600)


# --------------------------------------------------------------------------- #
#  Плавная «прорисовка» длинного слова по буквам (для игр)
# --------------------------------------------------------------------------- #
class LetterSlots(tk.Frame):
    """Ряд клеточек для сборки слова (используется в анаграмме и порядку слов)."""

    def __init__(self, parent, app, bg=None):
        bg = bg or app.theme["card"]
        super().__init__(parent, bg=bg)
        self.app = app
        self.bg = bg

    def render(self, slots, on_click=None, box_w=44, box_h=52, font_size=18):
        for child in self.winfo_children():
            child.destroy()
        t = self.app.theme
        for i, ch in enumerate(slots):
            if ch is None:
                slot_bg = hex_blend(t["card2"], "#000000", 0.12)
                box = tk.Frame(self, bg=slot_bg, width=box_w, height=box_h,
                               highlightthickness=0)
                box.pack(side="left", padx=4)
                box.pack_propagate(False)
                tk.Label(box, text=str(i + 1), bg=slot_bg, fg=t["faint"],
                         font=(self.app.font, 9, "bold")).pack(expand=True)
            else:
                b = Button(self, self.app, ch,
                           (lambda idx=i: on_click(idx)) if on_click else None,
                           ghost=True, size=font_size, padx=6, pady=6, radius=RADIUS["sm"])
                b.pack(side="left", padx=4)


class OptionTile(tk.Canvas):
    """Плитка-вариант ответа в стиле Liquid Glass.

    Используется в тренажёре и играх: стеклянная капсула/скруглённый
    прямоугольник с номером-подсказкой, живым hover/press и явными
    состояниями «верно»/«неверно».
    """

    def __init__(self, parent, app, index, text, command=None, radius=RADIUS["md"]):
        self.app = app
        self.index = index
        self.command = command
        self.radius = radius
        self._text = text
        self._hover = False
        self._pressed = False
        self._state = "idle"      # idle | correct | wrong | dim
        self._enabled = True
        self._transition_job = None
        self._display_fill = None
        self._font = tkfont.Font(root=app.root, family=app.font, size=11, weight="bold")
        try:
            bg = parent.cget("bg")
        except Exception:
            bg = app.theme["card"]
        self._outer_bg = bg
        super().__init__(parent, height=56, bd=0, highlightthickness=0, bg=bg, cursor="hand2")
        self.bind("<Configure>", lambda e: self.redraw())
        self.bind("<Enter>", self._enter)
        self.bind("<Leave>", self._leave)
        self.bind("<ButtonPress-1>", self._press)
        self.bind("<ButtonRelease-1>", self._release)
        self.redraw()

    def set_bg(self, bg):
        self._outer_bg = bg
        try:
            self.configure(bg=bg)
        except tk.TclError:
            pass
        self.redraw()

    def set_text(self, text):
        self._text = text
        self.redraw()

    def set_state(self, state):
        self._state = state
        self.redraw()

    def set_enabled(self, enabled):
        self._enabled = enabled
        try:
            self.configure(cursor="hand2" if enabled else "")
        except tk.TclError:
            pass
        self.redraw()

    def _palette(self):
        t = self.app.theme
        backdrop = self._outer_bg
        if not self._enabled:
            base = hex_blend(backdrop, "#000000", 0.05)
            return base, t["faint"], 0.05
        if self._state == "correct":
            base = STATUS_COLORS["ok"]
            return base, "#07110D", 0.5
        if self._state == "wrong":
            base = STATUS_COLORS["bad"]
            return base, "#FFFFFF", 0.4
        if self._state == "dim":
            base = hex_blend(backdrop, "#000000", 0.10)
            return base, t["faint"], 0.05
        base = material_color(t.get("glass", GLASS_REGULAR), backdrop, t.get("tint"))
        if self._pressed:
            base = hex_blend(base, "#000000", 0.12)
            spec = 0.10
        elif self._hover:
            base = hex_blend(base, "#FFFFFF", 0.10)
            spec = 0.42
        else:
            spec = 0.20
        return base, t["text"], spec

    def redraw(self, fill_override=None):
        if not self.winfo_exists():
            return
        w = max(1, self.winfo_width())
        h = max(1, self.winfo_height())
        self.delete("all")
        base, fg, spec = self._palette()
        if fill_override is not None:
            base = fill_override
        inset = 2 if self._pressed and self._enabled else 0
        r = min(self.radius, (w - inset * 2) // 2, (h - inset * 2) // 2)
        _round_rect(self, inset, inset, w - inset, h - inset, r, fill=base, outline="")
        if r > 3:
            self.create_line(inset + r * 0.7, inset + 1.2, w - inset - r * 0.7,
                             inset + 1.2, fill=specular(base, spec), width=1)
        # номер-подсказка (1–4) — тонкая, в тон материалу
        badge_c = hex_blend(base, "#FFFFFF", 0.16)
        self.create_oval(12, h / 2 - 13, 38, h / 2 + 13, fill=badge_c, outline="")
        self.create_text(25, h / 2, text=str(self.index + 1),
                         fill=(fg if self._state in ("correct", "wrong") else self.app.accent),
                         font=(self.app.font, 10, "bold"))
        # текст варианта
        self.create_text(50, h / 2, text=strip_tags(self._text), fill=fg,
                         font=self._font, anchor="w")
        self._display_fill = base

    def animate_material(self):
        if not self.winfo_exists():
            return
        if self._transition_job is not None:
            try:
                self.after_cancel(self._transition_job)
            except tk.TclError:
                pass
            self._transition_job = None
        target, _fg, _spec = self._palette()
        start = self._display_fill or target
        if not self.app.animations_enabled or self.app.animation_level == "Мгновенно":
            self.redraw()
            return
        frames = 8 if self.app.animation_level == "Плавно" else 5

        def advance(step=1):
            self._transition_job = None
            if not self.winfo_exists():
                return
            amount = 1 - (1 - step / frames) ** 2
            self.redraw(hex_blend(start, target, amount))
            if step < frames:
                self._transition_job = self.after(16, advance, step + 1)

        advance()

    def _enter(self, _e):
        if not self._enabled:
            return
        self._hover = True
        self.app.animate_control(self, "hover")

    def _leave(self, _e):
        self._hover = False
        self._pressed = False
        if self._enabled:
            self.app.animate_control(self, "idle")

    def _press(self, _e):
        if not self._enabled:
            return
        self._pressed = True
        self.app.animate_control(self, "press")

    def _release(self, event):
        self._pressed = False
        if not self._enabled:
            return
        inside = (event is None or
                  0 <= event.x <= self.winfo_width() and
                  0 <= event.y <= self.winfo_height())
        self.app.animate_control(self, "hover" if self._hover else "idle")
        if inside and self.command:
            self.app.run_action(self.command)


def make_theme_swatch(parent, app, name, selected, on_click):
    """Цветной образец акцентного цвета для окна настроек."""
    a1, a2 = app.accent, app.accent2
    t = app.theme
    swatch = tk.Frame(parent, bg=a1, width=34, height=34, cursor="hand2",
                      highlightthickness=2 if selected else 0,
                      highlightbackground=t["text"] if selected else a1)
    swatch.pack(side="left", padx=(0, 8))
    swatch.inner = a1
    tk.Label(parent, text=name, bg=t["card"], fg=t["dim"],
             font=(app.font, 8)).pack(side="left", padx=(0, 12))
    swatch.bind("<Button-1>", lambda e, n=name: on_click(n))
    return swatch
