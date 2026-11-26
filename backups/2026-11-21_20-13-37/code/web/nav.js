/* ============================================================
   Deutsch Quest — верхнее меню.

   Плоская навигация из 4 групп вместо 10 кнопок в ряд:
     Учиться  — Тренировка · Тренажёр · Задания
     Практика — Игры · Чтение · Звуки
     Моё      — Мои слова · Группы · Таблицы
     plus «Статистика» отдельно справа.

   Пункт «Ещё» для узких экранов показывает то, что не влезло.
   Работает на тех же кнопках `#nav button[data-view]` — dq.js не трогаем.
   ============================================================ */
"use strict";

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const GROUPS = [
    { id: "learn", label: "Учиться", items: ["lernen", "train", "worksheets"] },
    { id: "practice", label: "Практика", items: ["games", "reading", "sounds", "dictation", "exam"] },
    { id: "daily", label: "Ритм", items: ["plan", "journal", "cards"] },
    { id: "mine", label: "Моё", items: ["words", "groups", "tables"] },
  ];
  const META = {
    train: { title: "Тренажёр", sub: "слово за словом" },
    lernen: { title: "Тренировка", sub: "A0–B1 · 4 навыка" },
    worksheets: { title: "Задания", sub: "пропуски и тесты" },
    games: { title: "Игры", sub: "16 мини-игр" },
    reading: { title: "Чтение", sub: "тексты + вопросы" },
    sounds: { title: "Звуки", sub: "произношение" },
    words: { title: "Мои слова", sub: "нажатые в тексте" },
    groups: { title: "Группы", sub: "какие слова учить" },
    tables: { title: "Таблицы", sub: "грамматика" },
    journal: { title: "Дневник", sub: "что учил" },
    plan: { title: "План дня", sub: "цели и задачи" },
    cards: { title: "Карточки", sub: "SRS-колода" },
    dictation: { title: "Диктант", sub: "на слух" },
    exam: { title: "Экзамен", sub: "10 вопросов" },
    stats: { title: "Статистика", sub: "прогресс и слабые места" },
  };

  let built = false;
  let lastView = "train";

  function navBtn(btn, view) {
    btn.classList.add("nav-item");
    btn.dataset.view = view;
    const meta = META[view] || { title: view, sub: "" };
    const badge = $(".badge", btn);
    btn.innerHTML = `<span class="nav-item-t">${meta.title}</span>` +
      (badge ? badge.outerHTML : "") +
      `<span class="nav-item-s">${meta.sub}</span>`;
    return btn;
  }

  function rebuild() {
    const nav = $("#nav");
    if (!nav) return false;
    const orig = $$("button[data-view]", nav);
    if (!orig.length) return false;

    const byView = {};
    orig.forEach((b) => { byView[b.dataset.view] = b; });

    nav.innerHTML = "";
    nav.classList.add("dq-nav");

    GROUPS.forEach((g) => {
      const wrap = document.createElement("div");
      wrap.className = "nav-group";
      wrap.dataset.group = g.id;

      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "nav-trigger";
      trigger.innerHTML = `<span>${g.label}</span><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      trigger.onclick = (e) => {
        e.stopPropagation();
        const open = wrap.classList.contains("open");
        $$(".nav-group.open", nav).forEach((w) => w.classList.remove("open"));
        if (!open) wrap.classList.add("open");
      };

      const menu = document.createElement("div");
      menu.className = "nav-menu";
      g.items.forEach((view) => {
        const src = byView[view];
        if (!src) return;
        const b = navBtn(src, view);
        b.classList.add("nav-menu-item");
        menu.appendChild(b);
      });

      wrap.appendChild(trigger);
      wrap.appendChild(menu);
      wrap._items = g.items;
      nav.appendChild(wrap);
    });

    // «Статистика» и «Ещё» — справа
    const tail = document.createElement("div");
    tail.className = "nav-tail";

    if (byView.stats) {
      const s = navBtn(byView.stats, "stats");
      s.classList.add("nav-stat");
      s.innerHTML = `<span class="ico ico-streak"></span><span class="nav-item-t">Статистика</span>`;
      tail.appendChild(s);
    }

    const more = document.createElement("button");
    more.type = "button";
    more.className = "nav-trigger nav-more";
    more.innerHTML = "Ещё";
    more.onclick = (e) => {
      e.stopPropagation();
      const open = nav.classList.contains("more-open");
      nav.classList.toggle("more-open", !open);
    };
    tail.appendChild(more);
    nav.appendChild(tail);

    // закрытие меню после выбора пункта
    nav.addEventListener("click", (e) => {
      const item = e.target.closest("button[data-view]");
      if (!item) return;
      $$(".nav-group.open", nav).forEach((w) => w.classList.remove("open"));
      nav.classList.remove("more-open");
      paintActive(item.dataset.view);
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest("#nav")) return;
      $$(".nav-group.open", nav).forEach((w) => w.classList.remove("open"));
      nav.classList.remove("more-open");
    });

    built = true;
    fit(nav);
    window.addEventListener("resize", () => fit(nav));
    return true;
  }

  /** На узком экране лишние группы прячем в «Ещё» (иначе шапка развалится). */
  function fit(nav) {
    const groups = $$(".nav-group", nav);
    nav.classList.remove("is-narrow", "more-open");
    groups.forEach((g) => g.classList.remove("nav-hidden"));
    if (!groups.length) return;
    const brandW = ($(".brand") || {}).offsetWidth || 220;
    const rightW = ($(".top-right") || {}).offsetWidth || 240;
    const avail = window.innerWidth - brandW - rightW - 70;
    let used = groups.reduce((n, g) => n + (g.querySelector(".nav-trigger").offsetWidth || 100) + 4, 0) + 90;
    if (used <= avail) return;
    nav.classList.add("is-narrow");
    for (let i = groups.length - 1; i >= 0 && used > avail; i--) {
      groups[i].classList.add("nav-hidden");
      used -= (groups[i].querySelector(".nav-trigger").offsetWidth || 100) + 4;
    }
  }

  /** Подсветка: активное внутри группы + у группы */
  function paintActive(view) {
    lastView = view || lastView;
    const nav = $("#nav");
    if (!nav) return;
    $$("button[data-view]", nav).forEach((b) => b.classList.toggle("active", b.dataset.view === lastView));
    $$(".nav-group", nav).forEach((g) => {
      const on = !!$(`button[data-view="${lastView}"]`, g);
      g.classList.toggle("has-active", on);
    });
    const stat = $(".nav-stat", nav);
    if (stat) stat.classList.toggle("active", lastView === "stats");
    // краткое имя текущего раздела в шапке (brand-sub заменяем на «уровень» — аккуратно)
  }

  /** Следим за showView(): подсвечиваем актуальный пункт */
  function watch() {
    if (!window.DQ || !window.DQ._showView) {
      // dq.js зовёт showView внутри модуля; перехват через MutationObserver по .view.active
      const main = $("#mainWrap");
      if (main) {
        new MutationObserver(() => {
          const active = $(".view.active");
          if (!active) return;
          const view = active.id.replace(/^view-/, "");
          if (view !== lastView) paintActive(view);
        }).observe(main, { subtree: true, attributes: true, attributeFilter: ["class"] });
      }
      return;
    }
  }

  function init() {
    if (!rebuild()) return;
    const active = $(".view.active");
    paintActive(active ? active.id.replace(/^view-/, "") : "train");
    watch();
  }

  window.DQNav = {
    init, paintActive,
    get groups() { return GROUPS; },
    /** Перейти на раздел (вызывается из палитры команд и других модулей). */
    go(view) {
      const nav = $("#nav");
      const btn = nav && nav.querySelector(`button[data-view="${view}"]`);
      if (btn) { btn.click(); return true; }
      return false;
    },
  };
  document.addEventListener("DOMContentLoaded", init);
  // dq.js мог уже отработать — пробуем сразу тоже
  setTimeout(init, 0);
})();
