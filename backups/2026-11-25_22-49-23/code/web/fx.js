/* ============================================================
   Deutsch Quest — ДВИЖОК АНИМАЦИЙ
   Всё «живое» поведение интерфейса. Никаких зависимостей.

   Публичный API (window.DQFX):
     init()                       — подписаться на настройки скорости
     view(el)                     — появление/уход экрана
     stagger(container, sel)      — каскадное появление карточек
     pop(el)                      — «пружинка» (верный ответ)
     shake(el)                    — «дрожание» (ошибка)
     confetti(x, y)               — салют из точки
     countUp(el, from, to)        — счётчик XP/очков
     ripple(event)                — кружок от клика на кнопке
     flip(btn, text)              — плавная смена текста (счётчики)
     board(el, cols)              — лёгкий наклон/подъём доски
     revealHelp(el)               — раскрытие шпаргалки

   Как менять:
     — скорость всех анимаций регулируется настройкой «Скорость» (--motion);
     — выключить всё: body[data-motion="off"] / настройка «Анимации: выключены»;
     — новые эффекты добавлять отдельными функциями и экспортировать ниже.
   ============================================================ */
"use strict";

window.DQFX = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const S = { motion: 1, confetti: true };

  const enabled = () => S.motion > 0 && document.body.dataset.motion !== "off";
  const dur = (ms) => Math.max(0, Math.round(ms * (S.motion || 0)));

  /* ---------------- настройки ---------------- */
  function sync() {
    const ui = (window.SETTINGS && window.SETTINGS.ui) || {};
    const k = window.DQ_THEME
      ? (window.DQ_THEME.MOTION[ui.motion] || window.DQ_THEME.MOTION.normal).k
      : 1;
    S.motion = k;
    S.confetti = ui.confetti !== false;
    document.body.dataset.motion = k ? "on" : "off";
  }

  /* ---------------- экраны ---------------- */
  function view(el) {
    if (!el) return;
    el.classList.remove("fx-in");
    // принудительный reflow, чтобы анимация перезапускалась
    void el.offsetWidth;
    el.classList.add("fx-in");
    stagger($(".fx-stagger", el) || el);
  }

  function stagger(container, sel = ".fx-item") {
    if (!container || !enabled()) return;
    const items = $$(sel, container);
    items.forEach((el, i) => {
      el.style.animationDelay = Math.round(i * 35 * S.motion) + "ms";
      el.classList.remove("fx-pop-in");
      void el.offsetWidth;
      el.classList.add("fx-pop-in");
    });
  }

  /* ---------------- микро-эффекты ---------------- */
  function pop(el, cls = "fx-pop") {
    if (!el || !enabled()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), dur(520));
  }

  function shake(el) {
    if (!el || !enabled()) return;
    el.classList.remove("fx-shake");
    void el.offsetWidth;
    el.classList.add("fx-shake");
    setTimeout(() => el.classList.remove("fx-shake"), dur(500));
  }

  function flip(el, text) {
    if (!el) return;
    if (el.textContent === String(text)) return;
    if (!enabled()) { el.textContent = text; return; }
    el.classList.add("fx-flip-out");
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove("fx-flip-out");
      el.classList.add("fx-flip-in");
      setTimeout(() => el.classList.remove("fx-flip-in"), dur(260));
    }, dur(140));
  }

  function countUp(el, from, to) {
    if (!el) return;
    if (!enabled()) { el.textContent = to; return; }
    const start = performance.now();
    const total = Math.max(220, Math.abs(to - from) * 18) * (S.motion || 1);
    const step = (now) => {
      const t = Math.min(1, (now - start) / total);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------------- салют ---------------- */
  function confetti(x, y) {
    if (!enabled() || !S.confetti) return;
    const host = document.createElement("div");
    host.className = "fx-confetti";
    const palette = ["var(--accent)", "var(--accent2)", "#ffc44d", "#ff70a6", "#9fe8ff"];
    const n = 26;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const dist = 70 + Math.random() * 130;
      p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      p.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      p.style.setProperty("--rot", Math.round(Math.random() * 720 - 360) + "deg");
      p.style.setProperty("--d", Math.round((520 + Math.random() * 500) * S.motion) + "ms");
      p.style.background = palette[i % palette.length];
      if (i % 3 === 0) p.style.borderRadius = "50%";
      host.appendChild(p);
    }
    host.style.left = (x ?? window.innerWidth / 2) + "px";
    host.style.top = (y ?? window.innerHeight / 2) + "px";
    document.body.appendChild(host);
    setTimeout(() => host.remove(), dur(1200));
  }

  function confettiAt(el) {
    if (!el) return confetti();
    const r = el.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 2);
  }

  /* ---------------- клик-волна (без аллокаций при каждом клике) ---------------- */
  let lastRipple = 0;
  function ripple(ev) {
    if (!enabled()) return;
    const now = performance.now();
    if (now - lastRipple < 60) return;   // не чаще 16 волн/сек
    lastRipple = now;
    const btn = ev.target && ev.target.closest(".btn, .opt, .g-tile, .ws-opt, .gc-play");
    if (!btn) return;
    // КЛЮЧЕВОЕ: не трогаем getComputedStyle и inline styles — только transform
    const r = btn.getBoundingClientRect();
    const d = Math.max(r.width, r.height);
    const c = document.createElement("span");
    c.className = "fx-ripple";
    c.style.cssText = `width:${d}px;height:${d}px;left:${ev.clientX - r.left - d / 2}px;top:${ev.clientY - r.top - d / 2}px`;
    if (!btn.classList.contains("fx-rel")) btn.classList.add("fx-rel");
    btn.appendChild(c);
    setTimeout(() => c.remove(), 520);
  }

  /* ---------------- параллакс (только при наличии желания «анимации») ---------------- */
  function parallax() {
    if (!enabled()) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const g1 = $(".g1"), g2 = $("#glow2");
    if (!g1 || !g2) return;
    let raf = 0, px = 0, py = 0;
    window.addEventListener("pointermove", (e) => {
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        g1.style.transform = `translate3d(${px * 18}px, ${py * 14}px, 0)`;
        g2.style.transform = `translate3d(${-px * 22}px, ${-py * 18}px, 0)`;
      });
    }, { passive: true });
  }

  /* ---------------- доска «Пар»: tilt при наведении ---------------- */
  function board(el) {
    if (!el || !enabled()) return;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(800px) rotateX(${-y * 3}deg) rotateY(${x * 3}deg)`;
    });
    el.addEventListener("pointerleave", () => { el.style.transform = ""; });
  }

  /* ---------------- раскрытие шпаргалки ---------------- */
  function revealHelp(details) {
    const body = $(".ws-help-body", details);
    if (!body || !enabled()) return;
    if (details.open) {
      body.style.height = "0";
      requestAnimationFrame(() => {
        body.style.height = body.scrollHeight + "px";
        setTimeout(() => { body.style.height = ""; }, dur(320));
      });
    }
  }

  /* ---------------- запуск ---------------- */
  function init() {
    sync();
    parallax();
    document.addEventListener("pointerdown", ripple, { passive: true });
    // Каскад НЕ через MutationObserver на весь body (это сильно грузило страницу).
    // Списки анимируются явно: stagger()/view() вызывают их сами.
  }

  return {
    init, sync, view, stagger, pop, shake, flip, countUp, confetti, confettiAt,
    ripple, board, revealHelp,
    get motion() { return S.motion; },
    dur,
  };
})();