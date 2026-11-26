/* ============================================================
   Deutsch Quest — клиент веб-версии на Framework7.
   Мультивыбор групп: числа + техника + фразы — в одном пуле.
   ============================================================ */
"use strict";

window.__DQ_BUILD__ = "f7-1";

(function () {
  const preloaderMsg = document.querySelector("#qText");

  function fail(msg) {
    if (preloaderMsg) preloaderMsg.textContent = msg;
    const pre = document.querySelector(".preloader");
    if (pre) pre.style.display = "none";
  }

  if (!window.Framework7) {
    fail("Не загрузился Framework7 (проверьте js/framework7-bundle.min.js)");
    return;
  }
  const f7 = new Framework7({ el: "#app", theme: "ios", name: "DeutschQuest" });

  const STATUS = ["h", "g", "y", "r"];     // флаги нескольких групп: H/G/Y/R
  const state = {
    groups: [],      // [{ct, main, id, page}]
    saved: [],       // выбранные группы
    leitner: {},     // id → 0..3 (ошибки/правильность конкретного вопроса)
    lastBad: false,
  };

  /* ---------------- storage (help lite) ---------------- */
  function load(key, fallback) {
    try {
      const raw = f7.data.get(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    f7.data.set(key, JSON.stringify(value));
  }

  /* ---------------- сервер ---------------- */
  async function api(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(path + " → HTTP " + res.status);
    return res.json();
  }

  function post(path, body) {
    return api(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).catch(() => null);
  }

  /* ---------------- сборка групп ---------------- */
  function scanGroups() {
    const list = [];
    document.querySelectorAll(".page[data-name], .page[data-page]").forEach((page, pageIdx) => {
      const name = page.getAttribute("data-name") || page.getAttribute("data-page") || "";
      page.querySelectorAll(".list .item-content").forEach((row) => {
        const b15 = row.querySelector(".b15");
        if (!b15) return;
        const meta = row.querySelector(".b13, .b12");
        const title = b15.innerText.trim();
        const ct = page.querySelector(".block-title .b15");
        const main = ct ? ct.innerText.trim() : name;
        list.push({
          id: "g" + pageIdx + "_" + list.length,
          title,
          main,
          href: page.getAttribute("data-href") || "tests" + (pageIdx + 1),
          pageName: name,
          meta: meta ? meta.innerText.trim() : "",
          row,
          page,
        });
      });
    });
    return list;
  }

  /* ---------------- «Карточки» / «Тесты» ---------------- */
  function mainOf(card) {
    return card ? card.main : "—";
  }

  function matchesCard(card) {
    return !!card;   // все группы из всех страниц входят
  }

  function syncFlags() {
    state.groups.forEach((g) => {
      const flags = g.row.querySelectorAll(".flag");
      if (!flags.length) return;
      let flag = null;
      if (state.saved.includes(g.id)) {
        const lvl = state.leitner[g.id] || 0;
        // если вопрос уже отвечал — показываем его статус (как в Framework7 Cards)
        flag = lvl > 0 || state.answeredOnce ? STATUS[lvl] : "h";
      } else {
        flag = "g";
      }
      // в F7 первый «старый» флаг: держим минимум 1 для ранее взятых
      if (flag === "h") {
        flags.forEach((el) => el.setAttribute("data", "h"));
      } else if (flag === "g" || flag === "y" || flag === "r" || flag === "b") {
        // оставляем не более одного невидимого/статусного флага
        flags.forEach((el, i) => el.setAttribute("data", i === flags.length - 1 ? flag : "g"));
      }
      g.row.classList.toggle("dq-selected", state.saved.includes(g.id));
    });
  }

  state.groups = scanGroups();
  state.answeredOnce = false;

  /* поиск в «Карточках» */
  function fillSearch() {
    const inp = document.querySelector("#gCardSearch");
    if (!inp) return;
    inp.addEventListener("input", () => {
      const q = inp.value.toLowerCase();
      state.groups.forEach((g) => {
        const on = inp.value.indexOf("$") === 0;
        const hide = on || q !== '' ? false : false;
        const inQ = !q || g.title.toLowerCase().indexOf(q) >= 0 || g.main.toLowerCase().indexOf(q) >= 0;
        g.row.style.display = inQ ? "" : "none";
      });
      document.querySelectorAll(".dq-selected-p").forEach((el) => {
        const q = inp.value.toLowerCase();
        if (!q) { el.style.display = ""; return; }
        const txt = el.innerText.toLowerCase();
        el.style.display = txt.indexOf(q) >= 0 ? "" : "none";
      });
      // включённые группы отображаем сразу после поиска (секция Cleaner)
      document.querySelector("#gCardSearch").blur();
    });
  }

  function updateTo() {
    const groups = state.saved;
    document.querySelectorAll("#to .label").forEach((lbl) => {
      const dq = groups.map(gIdToTitle);
      const v = dq[0] || "";
      try { lbl.textContent = v || "(не выбрано)"; } catch (e) { }
      lbl.setAttribute("data-value", v || "");
    });
  }

  function gIdToTitle(id) {
    const g = state.groups.find((x) => x.id === id);
    if (!g) return id;
    return g.title;
  }

  function pickGroup(g, mode) {
    // режим "Все": обычный клик по чекбоксу; "Отчёт": просмотр
    if (!state.saved.includes(g.id)) state.draft.push(g.id);
  }

  /* ---------------- списки ---------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* старт */
  function init() {
    readSaved();
    bindList();
    try {
      syncFlags();
    } catch (e) { /* noop */ }
  }
  if (f7.app) f7.app.on("pageInit", () => { });

  window.addEventListener("load", () => {
    try {
      init();
    } catch (e) {
      fail("init: " + e.message);
    }
  });
})();