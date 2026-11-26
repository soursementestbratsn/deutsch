/* ============================================================
   Deutsch Quest — LIQUID GLASS (движок).

   Оптимизация (важно для FPS):
     • никаких MutationObserver на всё тело — стекло ставится только
       при инициализации и после смены экрана (событие dq:view);
     • один элемент = один слой backdrop-filter (никаких ::before
       с размытием);
     • пятна фона без filter: blur — только radial-gradient (GPU ест
       его почти бесплатно);
     • блик под курсором обновляется не чаще, чем раз в кадр, и только
       если курсор реально двигается;
     • три качества: high / balanced / low (настройка «Стекло»),
       авто-понижение при просадке FPS и на слабых устройствах.
   ============================================================ */
"use strict";

(() => {
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;

  const QUALITY = { high: 1, balanced: 0.7, low: 0 };
  let quality = "balanced";
  let qualityK = QUALITY[quality];

  /* ---------- фон-«сцена» ---------- */
  function injectScene() {
    if (document.querySelector(".glass-light")) return;
    const l = document.createElement("div");
    l.className = "glass-light";
    l.innerHTML = '<i class="gl-1"></i><i class="gl-2"></i><i class="gl-3"></i>';
    document.body.appendChild(l);
  }

  /* ---------- разметка стекла ---------- */
  const TARGETS = [
    ".card", ".tr-card", ".settings-card", ".modal-card", ".nav-menu",
    ".ws-set-card", ".game-card",
  ];

  let markRaf = 0;
  function markGlass() {
    if (markRaf) return;
    markRaf = requestAnimationFrame(() => {
      markRaf = 0;
      const all = $$(TARGETS.join(","));
      for (const el of all) if (!el.classList.contains("lg")) el.classList.add("lg");
    });
  }

  /* ---------- качество ---------- */
  function applyQuality(q) {
    quality = q;
    qualityK = QUALITY[q] ?? 0.7;
    root.dataset.glass = q;
    root.style.setProperty("--glass-blur", qualityK === 0 ? "0px" : qualityK < 1 ? "12px" : "20px");
    root.style.setProperty("--glass-sat", qualityK === 0 ? "100%" : "175%");
    root.classList.toggle("no-glass", qualityK === 0);
    // пятна фона: дорогие отключаем в low
    const scene = document.querySelector(".glass-light");
    if (scene) scene.classList.toggle("lite", qualityK === 0);
  }

  /** Авто-понижение, если кадры «плывут». Работает один раз за сессию. */
  function watchFPS() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frames = 0, start = performance.now(), downgraded = false;
    const tick = (t) => {
      frames++;
      if (t - start > 1400) {
        const fps = (frames * 1000) / (t - start);
        frames = 0; start = t;
        if (!downgraded && fps < 45 && quality !== "low") {
          downgraded = true;
          const next = quality === "high" ? "balanced" : "low";
          applyQuality(next);
          if (window.SETTINGS && window.SETTINGS.ui && window.SETTINGS.ui.glass !== next) {
            window.SETTINGS.ui.glass = next;
            window.SETTINGS.save && window.SETTINGS.save();
          }
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- блик под курсором ---------- */
  let rafP = 0;
  let lastX = 0, lastY = 0;
  function trackPointer() {
    if (window.matchMedia("(hover: none)").matches) return;
    window.addEventListener("pointermove", (e) => {
      if (qualityK === 0) return;
      // микродвижения не считаем — экономит кадры
      if (Math.abs(e.clientX - lastX) < 24 && Math.abs(e.clientY - lastY) < 24) return;
      lastX = e.clientX; lastY = e.clientY;
      if (rafP) return;
      rafP = requestAnimationFrame(() => {
        rafP = 0;
        root.style.setProperty("--mx", (lastX / window.innerWidth).toFixed(2));
        root.style.setProperty("--my", (lastY / window.innerHeight).toFixed(2));
      });
    }, { passive: true });
  }

  /* ---------- «плавление» шапки ---------- */
  function scrollGlass() {
    let lastState = null;
    const onScroll = () => {
      const scrolled = window.scrollY > 12;
      if (scrolled !== lastState) {
        lastState = scrolled;
        document.body.classList.toggle("is-scrolled", scrolled);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- остановка тяжёлых анимаций в неактивной вкладке ---------- */
  function visibility() {
    document.addEventListener("visibilitychange", () => {
      root.classList.toggle("is-hidden", document.hidden);
    });
  }

  /* ---------- инициализация ---------- */
  let started = false;
  function init(opt) {
    if (started) return;
    started = true;
    injectScene();

    const saved = (window.SETTINGS && window.SETTINGS.ui && window.SETTINGS.ui.glass) || opt || "balanced";
    applyQuality(QUALITY[saved] !== undefined ? saved : "balanced");

    markGlass();
    trackPointer();
    scrollGlass();
    visibility();

    // перерисовка после смены экрана — без наблюдения за всем DOM
    document.addEventListener("dq:view", markGlass);
    if (quality === "high") watchFPS();
  }

  window.DQLiquid = { init, markGlass, applyQuality, get quality() { return quality; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => init());
  else init();
})();
