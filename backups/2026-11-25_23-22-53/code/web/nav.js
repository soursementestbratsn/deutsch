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
    { id: "learn", label: "Учиться", items: ["course", "lernen", "train", "worksheets", "grammar", "speech", "content", "modes"] },
    { id: "practice", label: "Практика", items: ["games", "reading", "sounds", "dictation", "exam"] },
    { id: "daily", label: "Ритм", items: ["plan", "journal", "cards"] },
    { id: "mine", label: "Myё", items: ["words", "dict", "groups", "tables"] },
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
    dict: { title: "Словарь", sub: "все слова + фото" },
    tables: { title: "Таблицы", sub: "вся грамматика" },
    grammar: { title: "Грамматика", sub: "10 упражнений по правилу" },
    speech: { title: "Речь", sub: "разговорник и диалоги" },
    content: { title: "Материалы", sub: "песни, письма, частицы" },
    modes: { title: "Режимы", sub: "спидран, 5 минут" },
    course: { title: "Курс", sub: "24 урока A0–B1" },
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
    
    // Bottom nav click handling
    const bottomNav = $("#bottomNav");
    if (bottomNav) {
      bottomNav.addEventListener("click", (e) => {
        const item = e.target.closest("button[data-view]");
        if (!item) return;
        const view = item.dataset.view;
        if (view === "more") {
          openMoreDrawer();
          return;
        }
        paintActive(view);
        // Trigger view change via DQNav.go
        window.DQNav.go(view);
      });
    }
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

  /** Открывает drawer «Ещё» на мобильных — показывает скрытые разделы */
  function openMoreDrawer() {
    const nav = $("#nav");
    const bottomNav = $("#bottomNav");
    if (!nav || !bottomNav) return;
    
    // Create or show drawer
    let drawer = $("#moreDrawer");
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.id = "moreDrawer";
      drawer.className = "more-drawer";
      drawer.innerHTML = `
        <div class="more-drawer-backdrop"></div>
        <div class="more-drawer-content">
          <div class="more-drawer-handle"></div>
          <div class="more-drawer-header">
            <span>Ещё</span>
            <button class="more-drawer-close" aria-label="Закрыть">✕</button>
          </div>
          <div class="more-drawer-list"></div>
        </div>
      `;
      document.body.appendChild(drawer);
      
      // Close on backdrop click
      drawer.querySelector(".more-drawer-backdrop").addEventListener("click", closeMoreDrawer);
      drawer.querySelector(".more-drawer-close").addEventListener("click", closeMoreDrawer);
      
      // Swipe down to close
      let startY = 0;
      const content = drawer.querySelector(".more-drawer-content");
      content.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; }, { passive: true });
      content.addEventListener("touchmove", (e) => {
        const delta = e.touches[0].clientY - startY;
        if (delta > 50) closeMoreDrawer();
      }, { passive: true });
    }
    
    // Populate with hidden items + stats if not in bottom nav
    const list = drawer.querySelector(".more-drawer-list");
    list.innerHTML = "";
    
    // Get all views from GROUPS
    const allViews = GROUPS.flatMap(g => g.items);
    const bottomNavViews = ["train", "lernen", "games", "stats"];
    
    allViews.forEach(view => {
      if (bottomNavViews.includes(view)) return; // Already in bottom nav
      const meta = META[view] || { title: view, sub: "" };
      const btn = document.createElement("button");
      btn.dataset.view = view;
      btn.className = "more-drawer-item";
      btn.innerHTML = `<span class="ico ico-${view}"></span><span>${meta.title}</span>`;
      btn.onclick = () => {
        closeMoreDrawer();
        paintActive(view);
        window.DQNav.go(view);
      };
      list.appendChild(btn);
    });
    
    // Add stats if not in bottom nav (but it is)
    drawer.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  
  function closeMoreDrawer() {
    const drawer = $("#moreDrawer");
    if (drawer) {
      drawer.classList.remove("open");
      document.body.style.overflow = "";
    }
  }

  /** Подсветка: активное внутри группы + у группы + bottom nav */
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
    
    // Sync bottom nav
    const bottomNav = $("#bottomNav");
    if (bottomNav) {
      $$("button[data-view]", bottomNav).forEach((b) => b.classList.toggle("active", b.dataset.view === lastView));
    }
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
