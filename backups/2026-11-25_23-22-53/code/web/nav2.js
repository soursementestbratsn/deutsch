/* ============================================================
   Deutsch Quest — NEW NAVIGATION SYSTEM (nav2.js)
   4-tab bottom navigation + bottom sheets + swipe gestures
   ============================================================ */
"use strict";

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ─── State ─── */
  let currentTab = "home";
  let currentView = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;

  /* ─── Tab Definitions ─── */
  const TABS = [
    { id: "home", label: "Главная", icon: "ico-home", screen: "screen-home" },
    { id: "practice", label: "Практика", icon: "ico-dumbbell", screen: "screen-practice" },
    { id: "library", label: "Библиотека", icon: "ico-book", screen: "screen-library" },
    { id: "profile", label: "Профиль", icon: "ico-user", screen: "screen-profile" },
  ];

  /* ─── View Mappings (for bottom sheets) ─── */
  const VIEW_SCREENS = {
    // Home tab views
    train: "screen-train",
    lernen: "screen-lernen",
    worksheets: "screen-worksheets",
    grammar: "screen-grammar",
    speech: "screen-speech",
    content: "screen-content",
    modes: "screen-modes",
    course: "screen-course",
    reading: "screen-reading",
    tables: "screen-tables",
    sounds: "screen-sounds",
    dictation: "screen-dictation",
    exam: "screen-exam",
    plan: "screen-plan",
    journal: "screen-journal",
    cards: "screen-cards",
    // Library tab views
    dict: "screen-dict",
    groups: "screen-groups",
    words: "screen-words",
    // Profile tab views
    stats: "screen-stats",
    settings: "settingsSheet",
  };

  /* ─── Initialize ─── */
  function init() {
    setupTabBar();
    setupBottomSheets();
    setupSwipeGestures();
    setupQuickActions();
    setupKeyboardShortcuts();
    restoreLastTab();
    window.DQNav2 = { go, openSheet, closeSheet, openView, currentTab: () => currentTab };
  }

  /* ─── Tab Bar ─── */
  function setupTabBar() {
    const tabBar = $("#tabBar");
    if (!tabBar) return;

    tabBar.addEventListener("click", (e) => {
      const tab = e.target.closest(".tab-item");
      if (!tab) return;
      switchTab(tab.dataset.tab);
    });

    // Keyboard navigation for tab bar
    tabBar.addEventListener("keydown", (e) => {
      const items = $$(".tab-item", tabBar);
      const activeIndex = items.findIndex(i => i.classList.contains("active"));
      let newIndex = activeIndex;
      if (e.key === "ArrowLeft") newIndex = Math.max(0, activeIndex - 1);
      if (e.key === "ArrowRight") newIndex = Math.min(items.length - 1, activeIndex + 1);
      if (e.key === "Home") newIndex = 0;
      if (e.key === "End") newIndex = items.length - 1;
      if (newIndex !== activeIndex) {
        e.preventDefault();
        items[newIndex].click();
        items[newIndex].focus();
      }
    });
  }

  function switchTab(tabId) {
    const tab = TABS.find(t => t.id === tabId);
    if (!tab) return;

    // Update tab bar
    $$(".tab-item", "#tabBar").forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive);
    });

    // Update screens
    $$(".screen").forEach(screen => {
      const isActive = screen.id === tab.screen;
      screen.classList.toggle("active", isActive);
      screen.hidden = !isActive;
    });

    // Update navbar title
    updateNavbar(tab);

    currentTab = tabId;
    saveLastTab(tabId);

    // Haptic feedback
    if (navigator.vibrate && getSetting("haptics") !== false) {
      navigator.vibrate(8);
    }

    // Trigger custom event
    document.dispatchEvent(new CustomEvent("dq:tabChange", { detail: { tab: tabId } }));
  }

  function updateNavbar(tab) {
    const title = $("#navTitle");
    const subtitle = $("#navSubtitle");
    if (title) title.textContent = "Deutsch Quest";
    if (subtitle) subtitle.textContent = tab.label;
  }

  /* ─── Bottom Sheets ─── */
  function setupBottomSheets() {
    // Close on backdrop click
    $$(".bottom-sheet-backdrop").forEach(backdrop => {
      backdrop.addEventListener("click", () => closeSheet(backdrop.closest(".bottom-sheet").id));
    });

    // Close buttons
    $$(".bottom-sheet-close").forEach(btn => {
      btn.addEventListener("click", () => closeSheet(btn.closest(".bottom-sheet").id));
    });

    // Swipe down to close
    $$(".bottom-sheet-content").forEach(content => {
      let startY = 0;
      content.addEventListener("touchstart", (e) => {
        startY = e.touches[0].clientY;
      }, { passive: true });

      content.addEventListener("touchmove", (e) => {
        const delta = e.touches[0].clientY - startY;
        if (delta > 80) {
          closeSheet(content.closest(".bottom-sheet").id);
        }
      }, { passive: true });
    });

    // Escape key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        $$(".bottom-sheet.open").forEach(sheet => closeSheet(sheet.id));
      }
    });
  }

  function openSheet(sheetId) {
    const sheet = $(`#${sheetId}`);
    if (!sheet) return;
    sheet.classList.add("open");
    sheet.querySelector(".bottom-sheet-backdrop").classList.add("visible");
    document.body.style.overflow = "hidden";
    // Focus management
    const closeBtn = sheet.querySelector(".bottom-sheet-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeSheet(sheetId) {
    const sheet = $(`#${sheetId}`);
    if (!sheet) return;
    sheet.classList.remove("open");
    sheet.querySelector(".bottom-sheet-backdrop").classList.remove("visible");
    document.body.style.overflow = "";
  }

  /* ─── View Navigation (opens in bottom sheet on mobile) ─── */
  function openView(viewId) {
    const isMobile = window.innerWidth <= 768;
    const screenId = VIEW_SCREENS[viewId];

    if (isMobile && screenId && screenId !== "settingsSheet") {
      // Open in bottom sheet on mobile
      const viewSheet = $("#viewSheet");
      const body = $("#viewSheetBody");
      const title = $("#viewSheetTitle");

      if (viewSheet && body) {
        // Load the view content
        loadViewIntoSheet(viewId, body);
        if (title) title.textContent = getViewTitle(viewId);
        openSheet("viewSheet");
      }
    } else {
      // Use existing DQNav.go for desktop or settings
      if (window.DQNav && window.DQNav.go) {
        window.DQNav.go(viewId);
      } else if (viewId === "settings") {
        openSheet("settingsSheet");
      }
    }
  }

  function loadViewIntoSheet(viewId, container) {
    // Trigger the view change through DQ's showView
    if (window.DQ && window.DQ.showView) {
      container.innerHTML = ""; // Clear first
      window.DQ.showView(viewId);
      // Move the active view content into the sheet
      setTimeout(() => {
        const activeView = $(`.view.active`);
        if (activeView && activeView.id !== "screen-home" && activeView.id !== "screen-practice" && activeView.id !== "screen-library" && activeView.id !== "screen-profile") {
          container.appendChild(activeView.cloneNode(true));
        }
      }, 50);
    }
  }

  function getViewTitle(viewId) {
    const titles = {
      train: "Тренажёр",
      lernen: "Тренировка",
      worksheets: "Задания",
      grammar: "Грамматика",
      speech: "Речь",
      content: "Материалы",
      modes: "Режимы",
      course: "Курс",
      reading: "Чтение",
      tables: "Таблицы",
      sounds: "Звуки",
      dictation: "Диктант",
      exam: "Экзамен",
      plan: "План дня",
      journal: "Дневник",
      cards: "Карточки",
      dict: "Словарь",
      groups: "Группы",
      words: "Мои слова",
      stats: "Статистика",
    };
    return titles[viewId] || viewId;
  }

  /* ─── Quick Actions ─── */
  function setupQuickActions() {
    $$("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (TABS.some(t => t.id === action)) {
          switchTab(action);
        } else if (VIEW_SCREENS[action]) {
          openView(action);
        }
      });
    });

    // Continue learning button
    const continueBtn = $("#continueBtn");
    if (continueBtn) {
      continueBtn.addEventListener("click", () => openView("train"));
    }

    // Due words button
    const dueBtn = $("#dueBtn");
    if (dueBtn) {
      dueBtn.addEventListener("click", () => openView("train"));
    }

    // Word of day button
    const wotdBtn = $("#wotdBtn");
    if (wotdBtn) {
      wotdBtn.addEventListener("click", () => openView("train"));
    }

    // Settings button
    const settingsBtn = $("#settingsOpen");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => openSheet("settingsSheet"));
    }

    const openSettingsBtn = $("#openSettings");
    if (openSettingsBtn) {
      openSettingsBtn.addEventListener("click", () => openSheet("settingsSheet"));
    }

    // List items in Practice/Library tabs
    $$(".list-item[data-view]").forEach(item => {
      item.addEventListener("click", () => openView(item.dataset.view));
    });

    // Game buttons
    $$("[data-game]").forEach(btn => {
      btn.addEventListener("click", () => {
        openView("games");
        // Pass game selection
        setTimeout(() => {
          if (window.DQGames && window.DQGames.start) {
            window.DQGames.start(btn.dataset.game);
          }
        }, 100);
      });
    });

    // Training mode buttons
    $$("[data-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        openView("lernen");
        setTimeout(() => {
          if (window.DQTrain && window.DQTrain.setMode) {
            window.DQTrain.setMode(btn.dataset.mode);
          }
        }, 100);
      });
    });
  }

  /* ─── Swipe Gestures ─── */
  function setupSwipeGestures() {
    const mainWrap = $("#mainWrap");
    if (!mainWrap) return;

    mainWrap.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isSwiping = false;
    }, { passive: true });

    mainWrap.addEventListener("touchmove", (e) => {
      if (isSwiping) return;
      const deltaX = e.touches[0].clientX - touchStartX;
      const deltaY = e.touches[0].clientY - touchStartY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
        isSwiping = true;
      }
    }, { passive: true });

    mainWrap.addEventListener("touchend", (e) => {
      if (!isSwiping) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(deltaX) > 60) {
        const tabs = TABS.map(t => t.id);
        const currentIndex = tabs.indexOf(currentTab);
        if (deltaX < 0 && currentIndex < tabs.length - 1) {
          // Swipe left -> next tab
          switchTab(tabs[currentIndex + 1]);
        } else if (deltaX > 0 && currentIndex > 0) {
          // Swipe right -> previous tab
          switchTab(tabs[currentIndex - 1]);
        }
      }
    }, { passive: true });
  }

  /* ─── Keyboard Shortcuts ─── */
  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Ctrl/Cmd + K -> Command palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        openCommandPalette();
      }
      // F -> Focus mode
      if (e.key === "f" && !e.ctrlKey && !e.metaKey && !e.target.matches("input, textarea")) {
        e.preventDefault();
        toggleFocusMode();
      }
      // Numbers 1-4 for tab switching
      if (e.key >= "1" && e.key <= "4" && !e.ctrlKey && !e.metaKey && !e.target.matches("input, textarea")) {
        const tabs = TABS.map(t => t.id);
        const index = parseInt(e.key) - 1;
        if (tabs[index]) switchTab(tabs[index]);
      }
    });
  }

  function openCommandPalette() {
    const overlay = $("#cmdOverlay");
    const input = $("#cmdInput");
    if (overlay && input) {
      overlay.style.display = "flex";
      input.focus();
    }
  }

  function toggleFocusMode() {
    document.body.classList.toggle("focus-mode");
    const btn = $("#focusBtn");
    if (btn) btn.setAttribute("aria-pressed", document.body.classList.contains("focus-mode"));
  }

  /* ─── Persistence ─── */
  function saveLastTab(tabId) {
    try {
      localStorage.setItem("dq_lastTab", tabId);
    } catch (e) {}
  }

  function restoreLastTab() {
    try {
      const saved = localStorage.getItem("dq_lastTab");
      if (saved && TABS.some(t => t.id === saved)) {
        switchTab(saved);
      }
    } catch (e) {}
  }

  function getSetting(key) {
    return window.SETTINGS?.ui?.[key];
  }

  /* ─── Public API ─── */
  function go(viewId) {
    openView(viewId);
    return true;
  }

  /* ─── Init ─── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();