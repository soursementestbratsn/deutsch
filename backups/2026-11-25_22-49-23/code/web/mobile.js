/* ============================================================
   Deutsch Quest — MOBILE ENHANCEMENT (mobile.js)
   Adds bottom tab bar, bottom sheets, swipe gestures for mobile
   Works alongside existing nav.js and dq.js
   ============================================================ */
"use strict";

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ─── Config ─── */
  const TABS = [
    { id: "train", label: "Тренажёр", icon: "ico-train", view: "train" },
    { id: "lernen", label: "Тренировка", icon: "ico-dumbbell", view: "lernen" },
    { id: "games", label: "Игры", icon: "ico-game", view: "games" },
    { id: "stats", label: "Статистика", icon: "ico-stats", view: "stats" },
    { id: "more", label: "Ещё", icon: "ico-more", view: null },
  ];

  const MORE_SECTIONS = [
    {
      title: "Учёба",
      items: [
        { id: "worksheets", label: "Задания", icon: "ico-doc" },
        { id: "grammar", label: "Грамматика", icon: "ico-grammar" },
        { id: "tables", label: "Таблицы", icon: "ico-tables" },
        { id: "course", label: "Курс", icon: "ico-course" },
      ]
    },
    {
      title: "Практика",
      items: [
        { id: "reading", label: "Чтение", icon: "ico-reading" },
        { id: "speech", label: "Речь", icon: "ico-speech" },
        { id: "sounds", label: "Звуки", icon: "ico-sounds" },
        { id: "modes", label: "Режимы", icon: "ico-modes" },
      ]
    },
    {
      title: "Инструменты",
      items: [
        { id: "dictation", label: "Диктант", icon: "ico-dictation" },
        { id: "exam", label: "Экзамен", icon: "ico-exam" },
        { id: "plan", label: "План дня", icon: "ico-plan" },
        { id: "journal", label: "Дневник", icon: "ico-journal" },
        { id: "cards", label: "Карточки", icon: "ico-cards" },
        { id: "words", label: "Мои слова", icon: "ico-words" },
      ]
    },
    {
      title: "Справочники",
      items: [
        { id: "groups", label: "Группы", icon: "ico-groups" },
        { id: "dict", label: "Словарь", icon: "ico-words" },
      ]
    }
  ];

  /* ─── State ─── */
  let currentView = "train";
  let moreDrawer = null;
  let touchStartX = 0;
  let isSwiping = false;

  /* ─── Initialize ─── */
  function init() {
    if (window.innerWidth > 768) return; // Desktop - no mobile enhancements
    
    createBottomTabBar();
    setupBottomSheets();
    setupSwipeGestures();
    setupKeyboardShortcuts();
    syncWithDQNav();
    
    // Initial sync
    const activeView = $(".view.active");
    if (activeView) {
      currentView = activeView.id.replace("view-", "");
      updateTabBar(currentView);
    }
  }

  /* ─── Bottom Tab Bar ─── */
  function createBottomTabBar() {
    if ($("#bottomTabBar")) return;
    
    const bar = document.createElement("nav");
    bar.id = "bottomTabBar";
    bar.className = "bottom-tab-bar";
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Основная навигация");
    
    TABS.forEach((tab, index) => {
      const btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.dataset.tab = tab.id;
      btn.dataset.view = tab.view || "";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", index === 0 ? "true" : "false");
      btn.innerHTML = `<span class="ico ${tab.icon}"></span><label>${tab.label}</label>`;
      
      btn.addEventListener("click", () => handleTabClick(tab));
      bar.appendChild(btn);
    });
    
    document.body.appendChild(bar);
  }

  function handleTabClick(tab) {
    if (tab.id === "more") {
      openMoreDrawer();
      return;
    }
    
    // Haptic feedback
    if (navigator.vibrate && getSetting("haptics") !== false) {
      navigator.vibrate(8);
    }
    
    // Navigate using existing DQNav
    if (window.DQNav && window.DQNav.go) {
      window.DQNav.go(tab.view);
    } else if (window.DQ && window.DQ.showView) {
      window.DQ.showView(tab.view);
    }
  }

  function updateTabBar(viewId) {
    currentView = viewId;
    $$(".tab-btn", "#bottomTabBar").forEach(btn => {
      const isActive = btn.dataset.view === viewId;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive);
    });
  }

  /* ─── More Drawer (Bottom Sheet) ─── */
  function openMoreDrawer() {
    if (moreDrawer) {
      moreDrawer.classList.add("open");
      moreDrawer.querySelector(".bottom-sheet-backdrop").classList.add("visible");
      document.body.style.overflow = "hidden";
      return;
    }
    
    moreDrawer = document.createElement("div");
    moreDrawer.className = "bottom-sheet";
    moreDrawer.innerHTML = `
      <div class="bottom-sheet-backdrop"></div>
      <div class="bottom-sheet-content">
        <div class="bottom-sheet-handle"></div>
        <div class="bottom-sheet-header">
          <h2 class="bottom-sheet-title">Ещё</h2>
          <button class="bottom-sheet-close" aria-label="Закрыть">
            <span class="ico ico-close" style="font-size:20px;"></span>
          </button>
        </div>
        <div class="bottom-sheet-body">
          <div class="more-sections" id="moreSections"></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(moreDrawer);
    
    // Populate sections
    const container = $("#moreSections");
    MORE_SECTIONS.forEach(section => {
      const sectionEl = document.createElement("div");
      sectionEl.className = "more-section";
      sectionEl.innerHTML = `
        <h3 class="more-section-title">${section.title}</h3>
        <div class="more-section-list" id="moreSection-${section.title}"></div>
      `;
      container.appendChild(sectionEl);
      
      const list = sectionEl.querySelector(".more-section-list");
      section.items.forEach(view => {
        const item = document.createElement("button");
        item.className = "list-item";
        item.dataset.view = view.id;
        item.innerHTML = `
          <div class="list-item-icon"><span class="ico ${view.icon}"></span></div>
          <div class="list-item-content">
            <div class="list-item-title">${view.label}</div>
          </div>
          <span class="list-item-chevron"><span class="ico ico-chevron-right"></span></span>
        `;
        item.addEventListener("click", () => {
          closeMoreDrawer();
          if (window.DQNav && window.DQNav.go) {
            window.DQNav.go(view.id);
          } else if (window.DQ && window.DQ.showView) {
            window.DQ.showView(view.id);
          }
        });
        list.appendChild(item);
      });
    });
    
    // Close handlers
    moreDrawer.querySelector(".bottom-sheet-backdrop").addEventListener("click", closeMoreDrawer);
    moreDrawer.querySelector(".bottom-sheet-close").addEventListener("click", closeMoreDrawer);
    
    // Swipe down to close
    let startY = 0;
    const content = moreDrawer.querySelector(".bottom-sheet-content");
    content.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; }, { passive: true });
    content.addEventListener("touchmove", (e) => {
      const delta = e.touches[0].clientY - startY;
      if (delta > 80) closeMoreDrawer();
    }, { passive: true });
    
    // Show
    requestAnimationFrame(() => {
      moreDrawer.classList.add("open");
      moreDrawer.querySelector(".bottom-sheet-backdrop").classList.add("visible");
      document.body.style.overflow = "hidden";
    });
  }

  function closeMoreDrawer() {
    if (!moreDrawer) return;
    moreDrawer.classList.remove("open");
    moreDrawer.querySelector(".bottom-sheet-backdrop").classList.remove("visible");
    document.body.style.overflow = "";
  }

  /* ─── Settings Bottom Sheet ─── */
  function openSettingsSheet() {
    const settingsBtn = $("#settingsOpen");
    if (settingsBtn) settingsBtn.click(); // Use existing handler
  }

  /* ─── Swipe Gestures for Tab Switching ─── */
  function setupSwipeGestures() {
    const mainWrap = $("#mainWrap");
    if (!mainWrap) return;
    
    mainWrap.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
      isSwiping = false;
    }, { passive: true });
    
    mainWrap.addEventListener("touchmove", (e) => {
      if (isSwiping) return;
      const deltaX = e.touches[0].clientX - touchStartX;
      if (Math.abs(deltaX) > Math.abs(e.touches[0].clientY - touchStartY) && Math.abs(deltaX) > 20) {
        isSwiping = true;
      }
    }, { passive: true });
    
    mainWrap.addEventListener("touchend", (e) => {
      if (!isSwiping) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(deltaX) < 60) return;
      
      const tabIds = TABS.filter(t => t.view).map(t => t.id);
      const currentIndex = tabIds.indexOf(currentView);
      
      if (deltaX < 0 && currentIndex < tabIds.length - 1) {
        // Swipe left -> next tab
        const nextTab = TABS.find(t => t.id === tabIds[currentIndex + 1]);
        if (nextTab) handleTabClick(nextTab);
      } else if (deltaX > 0 && currentIndex > 0) {
        // Swipe right -> previous tab
        const prevTab = TABS.find(t => t.id === tabIds[currentIndex - 1]);
        if (prevTab) handleTabClick(prevTab);
      }
    }, { passive: true });
  }

  /* ─── Keyboard Shortcuts ─── */
  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Ctrl/Cmd + K -> Command palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const cmdBtn = $("#cmdBtn");
        if (cmdBtn) cmdBtn.click();
      }
      // F -> Focus mode
      if (e.key === "f" && !e.ctrlKey && !e.metaKey && !e.target.matches("input, textarea")) {
        e.preventDefault();
        const focusBtn = $("#focusBtn");
        if (focusBtn) focusBtn.click();
      }
      // Escape -> Close drawers
      if (e.key === "Escape") {
        closeMoreDrawer();
        // Close any open bottom sheets
        $$(".bottom-sheet.open").forEach(sheet => {
          sheet.classList.remove("open");
          sheet.querySelector(".bottom-sheet-backdrop").classList.remove("visible");
        });
        document.body.style.overflow = "";
      }
    });
  }

  /* ─── Sync with Existing DQNav ─── */
  function syncWithDQNav() {
    // Watch for view changes via MutationObserver
    const mainWrap = $("#mainWrap");
    if (mainWrap) {
      new MutationObserver(() => {
        const active = $(".view.active");
        if (active) {
          const view = active.id.replace("view-", "");
          if (view !== currentView) {
            currentView = view;
            updateTabBar(view);
          }
        }
      }).observe(mainWrap, { subtree: true, attributes: true, attributeFilter: ["class"] });
    }
    
    // Also listen for DQNav events if available
    document.addEventListener("dq:viewChange", (e) => {
      if (e.detail && e.detail.view) {
        currentView = e.detail.view;
        updateTabBar(currentView);
      }
    });
  }

  /* ─── Helpers ─── */
  function getSetting(key) {
    return window.SETTINGS?.ui?.[key];
  }

  /* ─── Public API ─── */
  window.DQMobile = {
    openMoreDrawer,
    closeMoreDrawer,
    openSettingsSheet,
    updateTabBar,
    getCurrentView: () => currentView,
  };

  /* ─── Auto-init ─── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  
  // Re-init on resize crossing breakpoint
  let wasMobile = window.innerWidth <= 768;
  window.addEventListener("resize", () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile !== wasMobile) {
      wasMobile = isMobile;
      if (isMobile) init();
      else {
        const bar = $("#bottomTabBar");
        if (bar) bar.remove();
        closeMoreDrawer();
      }
    }
  });
})();