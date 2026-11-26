/* ============================================================
   Deutsch Quest — ПАКЕТ ИДЕЙ (волна 1)

   Здесь собраны самостоятельные фичи, которые не трогают ядро тренажёра:
   каждая живёт в своей карточке/разделе и сама себя рисует.

     95–102. Колода слов · челлендж 7 дней · статистика времени ·
             серии · «что повторить» · сложные слова · кривая забывания ·
             готовность уровня
   Данные читаются из window.DQ.stats / localStorage;
   ничего не пишется на сервер без явного действия пользователя.
   ============================================================ */
"use strict";

window.DQIdeas = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const dayKey = (d = new Date()) => {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const stats = () => (window.DQ && window.DQ.stats) || {};
  const today = () => Number(stats().daily_answers) || 0;

  /* ============================================================
     95. Колода слов (SRS-lite) — экран «Карточки»
     ============================================================ */
  const CARDS_KEY = "dq.cards.v1";
  function loadCards() {
    try { return JSON.parse(localStorage.getItem(CARDS_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function saveCards(obj) {
    try { localStorage.setItem(CARDS_KEY, JSON.stringify(obj)); } catch (e) { /* priv. mode */ }
  }
  /** Интервалы повторов (дни). */
  const STEPS = [1, 3, 7, 16, 35];

  function deckCards() {
    // основная колода — SRS-коробки тренажёра (если есть) + наши
    const box = (window.DQ && window.DQ.srs && window.DQ.srs.box && window.DQ.srs.box()) || {};
    const own = loadCards();
    const out = {};
    for (const [de, b] of Object.entries(box)) {
      out[de] = { ru: "", step: b.b || 0, last: b.last || "" };
    }
    for (const [de, c] of Object.entries(own)) out[de] = { ...out[de], ...c };
    return out;
  }

  function dueAt(card) {
    if (!card.last) return true;
    const days = STEPS[Math.min(card.step || 0, STEPS.length - 1)];
    const last = new Date(card.last + "T00:00:00");
    return (Date.now() - last.getTime()) / 86400000 >= days;
  }

  function renderDeck() {
    const host = $("#cardsBody") || $("#view-cards");
    if (!host) return;
    const all = deckCards();
    const due = Object.entries(all).filter(([, c]) => dueAt(c));
    const total = Object.keys(all).length;
    host.innerHTML = `
      <div class="idea-card">
        <div class="idea-head">
          <h3>Колода сегодня</h3>
          <span class="muted small">${total} слов${total ? ` · ${due.length} повторить` : ""}</span>
        </div>
        ${total ? `
        <div class="deck-progress"><b>${due.length}</b> карточек ждут · <span>${total - due.length} в запасе</span></div>
        <button class="btn primary deck-start" ${due.length ? "" : "disabled"}>Открыть ${Math.min(due.length, 20)}</button>
        <div class="deck-help muted small">Интервалы: ${STEPS.map((d) => d + " д").join(" → ")}</div>`
        : `<p class="muted">Пока пусто — пройдите пару слов в тренажёре, и они появятся здесь.</p>`}
      </div>`;

    const btn = $(".deck-start", host);
    if (btn && due.length) {
      btn.onclick = () => openDeck(due.slice(0, 20));
    }
  }

  function openDeck(items) {
    let i = 0;
    if (window.DQ && window.DQ.say) window.DQ.say(items[0][0], "de");
    const host = $("#cardsBody") || $("#view-cards");
    const overlays = `
      <div class="deck-modal">
        <div class="deck-top"><span>Карточка <b>${i + 1}</b> / ${items.length}</span>
          <span class="deck-tools"><button class="deck-say" title="Прослушать"><span class="ico ico-vol"></span></button>
          <button class="deck-x" title="Закрыть">×</button></span></div>
        <div class="deck-stage" id="deckStage">
          <div class="deck-face" id="deckFace">${esc(items[i][0])}</div>
          <div class="deck-back" id="deckBack" hidden>${esc(items[i][1].ru || "")}</div>
          <div class="deck-hint">нажмите на карточку, чтобы увидеть перевод</div>
        </div>
        <div class="deck-actions">
          <button class="btn ghost" data-ok="0">Не помню</button>
          <button class="btn primary" data-ok="1">Помню</button>
        </div>
      </div>`;
    host.innerHTML = overlays;
    const face = $("#deckFace", host), back = $("#deckBack", host);
    const hint = $(".deck-hint", host);
    const flip = () => {
      face.hidden = true; back.hidden = false; hint.hidden = true;
      if (window.DQ && window.DQ.say) window.DQ.say(back.dataset.de || "", "de");
    };
    $("#deckStage", host).onclick = () => { if (back.hidden) flip(); };
    host.querySelector(".deck-x").onclick = () => renderDeck();
    host.querySelector(".deck-say").onclick = (e) => {
      e.stopPropagation();
      if (window.DQ && window.DQ.say) window.DQ.say(items[i][0], "de");
    };
    host.querySelectorAll("[data-ok]").forEach((b) => {
      b.onclick = () => {
        const ok = b.dataset.ok === "1";
        const all = loadCards();
        const [de, c] = items[i];
        const prev = all[de] || { de, ru: c.ru || "", step: 0, last: "" };
        prev.step = ok ? Math.min(STEPS.length - 1, (prev.step || 0) + 1) : 0;
        prev.last = ok ? dayKey() : "1970-01-01";
        prev.ru = c.ru || prev.ru || "";
        all[de] = prev;
        saveCards(all);
        if (window.DQSND) ok ? window.DQSND.correct() : window.DQSND.wrong();
        i++;
        if (i >= items.length) return renderDeck();
        const [nd, nc] = items[i];
        $(".deck-top b", host).textContent = i + 1;
        face.textContent = nd;
        face.hidden = false;
        back.textContent = nc.ru || "";
        back.hidden = true;
        back.dataset.de = nd;
        hint.hidden = false;
        if (window.DQ && window.DQ.say) window.DQ.say(nd, "de");
      };
    });
  }

  /* ============================================================
     96. Челлендж «7 дней по 10 минут» — карточка в «План дня»
     ============================================================ */
  const CH_KEY = "dq.challenge.v1";
  function challenge() {
    let c;
    try { c = JSON.parse(localStorage.getItem(CH_KEY) || "null"); } catch (e) { c = null; }
    if (!c) c = { days: [], start: dayKey() };
    // каждый день цель: 10 ответов
    const streak = (() => {
      let n = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        if (!c.days.includes(dayKey(d))) break;
        n++;
      }
      return n;
    })();
    return { c, streak };
  }
  function markChallenge() {
    const { c } = challenge();
    if (today() >= 10 && !c.days.includes(dayKey())) {
      c.days.push(dayKey());
      // чистим старые
      c.days = c.days.slice(-14);
      try { localStorage.setItem(CH_KEY, JSON.stringify(c)); } catch (e) { }
    }
  }

  function challengeHtml() {
    markChallenge();
    const { c, streak } = challenge();
    const last7 = Array.from({ length: 7 }, (_, k) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - k));
      const wd = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"][d.getDay()];
      const todayK = dayKey(d) === dayKey();
      return { key: dayKey(d), label: todayK ? "сег" : wd, done: c.days.includes(dayKey(d)), today: todayK };
    });
    return `<div class="idea-card idea-challenge">
      <div class="idea-head"><h3>Челлендж 7 дней</h3><span class="muted small">10 ответов в день</span></div>
      <div class="ch-week">${last7.map((d) => `<span class="ch-day ${d.done ? "on" : ""} ${d.today ? "today" : ""}" title="${d.key}">${d.label}</span>`).join("")}</div>
      <div class="muted small">Сейчас: <b>${streak}</b> ${streak === 7 ? "— идеальная неделя!" : "дней подряд"}</div>
    </div>`;
  }

  /* ============================================================
     97–102. Блок «Глубже в цифры» на экране «Статистика»
     ============================================================ */
  function bestDay() {
    const h = stats().history || {};
    let d = null, n = 0;
    for (const [k, v] of Object.entries(h)) {
      const c = v && (v.a ?? v.c);
      if (Number(c) > n) { n = Number(c); d = k; }
    }
    return { day: d, n };
  }
  function weekBars() {
    const h = stats().history || {};
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const k = dayKey(d), v = h[k] || {};
      const n = Number(v.a ?? 0);
      return { k, n };
    });
  }
  function currentStreak() {
    const h = stats().history || {};
    let n = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const v = h[dayKey(d)] || {};
      if (Number(v.a ?? 0) > 0) n++; else if (i > 0) break;
    }
    return n;
  }
  function levelProgress() {
    const xp = Number(stats().xp) || 0;
    const lvl = Math.floor(xp / 100) + 1;
    return { lvl, inLevel: xp % 100, need: 100 };
  }
  function hardWords(n = 10) {
    const box = (window.DQ && window.DQ.srs && window.DQ.srs.box && window.DQ.srs.box()) || {};
    const mis = Array.isArray(stats().mistakes) ? stats().mistakes : [];
    const misScore = {};
    mis.forEach((m) => { misScore[m[0]] = (misScore[m[0]] || 0) + 1; });
    return Object.entries(box)
      .map(([de, b]) => ({ de, b: b.b || 0, last: b.last || "", score: (misScore[de] || 0) * 3 + (2 - Math.min(2, b.b || 0)) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }
  function forgetting() {
    // сколько слов из коробки «потеряются» в ближайшие 7 дней — оценки по шагам
    const box = (window.DQ && window.DQ.srs && window.DQ.srs.box && window.DQ.srs.box()) || {};
    let soon = 0, later = 0;
    for (const [, b] of Object.entries(box)) {
      const step = b.b || 0;
      if (step <= 0) soon++; else if (step === 1) later++;
    }
    return { soon, later, total: Object.keys(box).length };
  }
  function readiness() {
    const box = (window.DQ && window.DQ.srs && window.DQ.srs.box && window.DQ.srs.box()) || {};
    const learned = Object.values(box).filter((b) => (b.b || 0) >= 3).length;
    const p = (window.DQIdeas && window.DQIdeas.poolSize) ? window.DQIdeas.poolSize() : 150;
    const pct = Math.min(100, Math.round((learned / Math.max(50, p)) * 100));
    return { learned, pct };
  }

  function renderStatsExtras() {
    const host = $("#statExtras");
    if (!host) return;
    const bd = bestDay(), wk = weekBars(), cur = currentStreak(), lp = levelProgress();
    const hw = hardWords(8), fg = forgetting(), rd = readiness();
    const max = Math.max(1, ...wk.map((x) => x.n));
    host.innerHTML = `
      <div class="idea-card idea-digits">
        <div class="idea-head"><h3>Глубже в цифры</h3>
          <span class="muted small">уровень ${lp.lvl} · ${lp.inLevel}/${lp.need} XP</span></div>
        <div class="dig-grid">
          <div class="dig"><span>Серия сейчас</span><b>${cur}</b><small>дней подряд</small></div>
          <div class="dig"><span>Лучший день</span><b>${bd.n}</b><small>${bd.day || "—"}</small></div>
          <div class="dig"><span>Готовность</span><b>${rd.pct}%</b><small>${rd.learned} слов крепко</small></div>
        </div>
        <div class="wk-chart">${wk.map((d) => `<i style="height:${Math.round((d.n / max) * 100)}%" title="${d.k}: ${d.n}"></i>`).join("")}</div>
      </div>

      <div class="idea-card">
        <div class="idea-head"><h3>Сложные слова</h3><span class="muted small">топ-${hw.length}</span></div>
        ${hw.length ? `<ul class="hard-list">${hw.map((x) =>
      `<li><b>${esc(x.de)}</b><span class="hw-bar"><i style="width:${Math.min(100, x.score * 20)}%"></i></span>
             <button class="hw-say" data-de="${esc(x.de)}"><span class="ico ico-vol"></span></button></li>`).join("")}</ul>`
        : `<p class="muted">Пока нет данных — ошибки в тренажёре пополнят список.</p>`}
      </div>

      <div class="idea-card">
        <div class="idea-head"><h3>Кривая забывания</h3><span class="muted small">оценка</span></div>
        <p class="muted">Из ${fg.total} слов в интервальном повторе: <b>${fg.soon}</b> — на грани, ещё <b>${fg.later}</b> — чуть подождут.
           Лучше повторить ${fg.soon ? "сегодня" : "сейчас их достаточно мало"}.</p>
      </div>`;
    host.querySelectorAll(".hw-say").forEach((b) => {
      b.onclick = () => window.DQ && window.DQ.say && window.DQ.say(b.dataset.de, "de");
    });
  }

  /* ============================================================
     99. «Что повторить сегодня» — боковая колонка тренажёра
     ============================================================ */
  function renderReviewToday() {
    const host = $("#reviewToday");
    if (!host) return;
    const due = (window.DQ && window.DQ.srs && window.DQ.srs.due && window.DQ.srs.due()) || [];
    const words = due.slice(0, 4).map((de) => {
      const c = deckCards()[de] || {};
      return { de, ru: c.ru || "" };
    });
    host.hidden = !due.length;
    if (!due.length) { host.innerHTML = ""; return; }
    host.innerHTML = `
      <h2>Повторить</h2>
      <div class="idea-card review-today">
        <div class="muted small">${due.length} слов ждут раза</div>
        <ul class="rt-list">${words.map((w) => `<li>${esc(w.de)}${w.ru ? ` · <span class="muted">${esc(w.ru)}</span>` : ""}</li>`).join("")}</ul>
        <button class="btn ghost small" id="rtStart">Повторить забытое</button>
      </div>`;
    const b = $("#rtStart");
    if (b) b.onclick = () => window.DQ && window.DQ.dueSession && window.DQ.dueSession();
  }

  return {
    renderDeck, renderStatsExtras, renderReviewToday,
    challengeHtml,
    poolSize() {
      return (window.DQ && window.DQ.pool && window.DQ.pool.length) || 150;
    },
    /** Вызывается из showView, чтобы блоки перерисовывались при открытии. */
    refresh(view) {
      try {
        if (view === "cards") renderDeck();
        if (view === "stats") renderStatsExtras();
        if (view === "train") renderReviewToday();
      } catch (e) { console.warn("DQIdeas:", e); }
    },
  };
})();
