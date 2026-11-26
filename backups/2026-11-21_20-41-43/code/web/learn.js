/* ============================================================
   Deutsch Quest — 10 фишек «чтобы проще учить язык» (window.DQLearn).

   Каждая фишка включается/выключается своим ключом в SETTINGS.ui
   (web/settings.js → «Учёба» / «Ритм» / «Озвучка»):

     1. Слово дня            ui.wordOfDay       — карточка справа в тренажёре
     2. Подсказки по фразе   (всегда)           — артикль, мн. ч., слово в примере
     3. Похожие слова        ui.showRelated     — в разборе ответа + клик для перевода
     4. Умные повторки       ui.smartRepeat     — ошибся → слово возвращается скоро
     5. Обратный вопрос      ui.reverseOnMistake— после ошибки спросим это же слово обратно
     6. Объяснение по-немецки ui.nlGerman       — краткое определение на немецком
     7. Таймер сессии        ui.studyTimer      — обратный отсчёт над вопросом
     8. Напоминание о перерыве ui.breakReminder — тост каждые 25 минут
     9. Игра «стань мышью»   FakeFocus           — «куда нажать», «сколько ещё осталось»
    10. Приветствие с планом ui.greeting        — карточка при открытии

   Ничего не дублирует dq.js: тренажёр лишь вызывает несколько
   маленьких функций (причёсано комментариями «Фишка N»).
   ============================================================ */
"use strict";

window.DQLearn = (function () {
  const $ = (s, r = document) => r.querySelector(s);

  function ui() { return (window.SETTINGS && window.SETTINGS.ui) || {}; }
  const on = (key, fallback = true) => {
    const v = ui()[key];
    return v === undefined ? fallback : !!v;
  };
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const hash = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  };
  const isDe = (s) => /[A-Za-zÄÖÜäöüß]/.test(s || "");

  /* ------------------------------------------------------------
     ФИШКА 2 · подсказки по фразе
     «das Haus», «die Häuser», предложение-пример для узнавания в контексте.
     ------------------------------------------------------------ */
  const PLURAL_RULES = [
    [/(\w)er$/, (w) => w + ""],
    [/(\w)en$/, (w) => w + ""],
    [/(\w)e$/, (w) => w + "n"],
    [/(\w)$/, (w) => w + "e"],
  ];
  function guessArticle(de) {
    const w = String(de || "").trim();
    if (!w || !isDe(w)) return "";
    const first = w.split(/\s+/)[0];
    // слово само пришло с артиклем — не спорим
    if (/^(der|die|das)$/i.test(first)) return first.toLowerCase();
    if (/(ung|heit|keit|schaft|tion|sion|ion|ei|ik|ie|ur|ät)$/i.test(first)) return "die";
    if (/(chen|lein|ment|um|nis)$/i.test(first)) return "das";

    // главное: артикль есть в самом словаре (words.txt: «das Restaurant = …»)
    const pool = (window.DQ && window.DQ.pool) || [];
    for (const p of pool) {
      if (!p || !isDe(p[0])) continue;
      const m = String(p[0]).match(/^(der|die|das)\s+(.*)$/i);
      if (m && m[2].toLowerCase() === first.toLowerCase()) return m[1].toLowerCase();
    }

    // иначе — окончание -e: обычно женский
    if (/e$/.test(first)) return "die";
    return "der";
  }
  function articleForm(de) {
    const w = String(de || "").trim();
    if (!w || !isDe(w) || w.includes(" ")) return "";
    const art = guessArticle(w);
    return `${art} ${w.replace(/^(der|die|das)\s+/, "")}`;
  }
  function pluralForm(de) {
    const w = String(de || "").trim();
    if (!w || !isDe(w) || w.includes(" ")) return "";
    let out = "";
    for (const [re, f] of PLURAL_RULES) if (re.test(w)) { out = f(w); break; }
    if (!out) out = w + "e";
    return "die " + out;
  }

  /** Полная карточка слова из пары [de, ru] — для подсказки и разбора. */
  function wordCard(de) {
    const what = [];
    if (on("showArticle")) what.push(articleForm(de));
    if (on("showPlural")) what.push(pluralForm(de));
    const t = what.filter(Boolean);
    if (!t.length) return "";
    return t.map((x) => `<span class="lc-chip">${esc(x)}</span>`).join("");
  }

  /* ------------------------------------------------------------
     ФИШКА 3 · похожие слова — из уже загруженного пула
     ------------------------------------------------------------ */
  function related(de, n = 3) {
    if (!on("showRelated") || !window.DQ) return [];
    const pool = (window.DQ.pool || []).filter((p) => p && p[0] !== de && isDe(p[0]));
    const key = String(de || "").toLowerCase().slice(0, 3);
    return pool
      .map((p) => ({ p, s: (p[0].toLowerCase().startsWith(key) ? 1 : 0) + p[0].length / 100 }))
      .filter((x) => x.p[0].toLowerCase().startsWith(key) || key.length < 3)
      .sort((a, b) => b.s - a.s)
      .slice(0, n)
      .map((x) => x.p);
  }

  /* ------------------------------------------------------------
     ФИШКА 6 · объяснить по-немецки (позиция слова на «полке» + форма)
     ------------------------------------------------------------ */
  function germanHint(de, ru) {
    if (!on("nlGerman") || !isDe(de)) return "";
    const art = guessArticle(de);
    const kind = /^[A-ZÄÖÜ]/.test(de) ? "Nomen" : "Wort";
    return `<span class="lc-nl">${kind === "Nomen" ? `<b>${art}</b> ${esc(de)} — das Nomen` : `„${esc(de)}“`} · <i>${esc(ru)}</i></span>`;
  }

  /* ------------------------------------------------------------
     ФИШКА 1 · слово дня (без сети: из пула, стабильно на дату)
     ------------------------------------------------------------ */
  function wordOfDay() {
    if (!on("wordOfDay") || !window.DQ) return null;
    const pool = (window.DQ.pool || []).filter((p) => p && isDe(p[0]));
    if (!pool.length) return null;
    const day = new Date();
    const tag = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
    return pool[hash(tag + "wod") % pool.length];
  }

  /** Карточка «слово дня»: рисуется в боковой колонке тренажёра. */
  function renderWordOfDay() {
    const host = $("#wordOfDay");
    if (!host) return;
    const w = wordOfDay();
    if (!w) { host.hidden = true; host.innerHTML = ""; return; }
    host.hidden = false;
    host.innerHTML = `
      <h2>Слово дня</h2>
      <div class="wod-card">
        <div class="wod-de">${esc(w[0])}</div>
        <div class="wod-ru">${esc(w[1])}</div>
        <div class="wod-tools">
          <button class="link-btn" data-wod-say><span class="ico ico-vol"></span> слушать</button>
          <button class="link-btn" data-wod-show><span class="ico ico-bulb"></span> перевод</button>
        </div>
      </div>`;
    const ru = $(".wod-ru", host);
    const de = $(".wod-de", host);
    ru.style.visibility = "hidden";
    de.style.visibility = "visible";
    $("[data-wod-show]", host).onclick = () => { ru.style.visibility = "visible"; };
    de.onclick = () => { ru.style.visibility = "visible"; };
    $("[data-wod-say]", host).onclick = () => window.DQ.say && window.DQ.say(w[0], "de");
  }

  /* ------------------------------------------------------------
     ФИШКА 4 · умные повторки: слово, где ошиблись, вернём скоро
     ------------------------------------------------------------ */
  const soon = new Map();       // de → через сколько карточек вернуть
  let seen = 0;
  function noteAnswer(de, ok) {
    seen++;
    if (!de) return;
    if (ok) { soon.delete(de); return; }
    if (!on("smartRepeat")) return;
    soon.set(de, seen + 3);     // вернуть после ~3 других карточек
  }
  /** Вернуть пару, которую пора повторить (или null). */
  function dueSoon(pairs, currentDe) {
    for (const [de, at] of soon) {
      if (at > seen || de === currentDe) continue;
      const p = pairs.find((x) => x[0] === de);
      if (p) { soon.delete(de); return p; }
      soon.delete(de);
    }
    return null;
  }

  /* ------------------------------------------------------------
     ФИШКА 5 · после ошибки — обратный вопрос
     ------------------------------------------------------------ */
  let reverseNext = null;
  function askReverse(pair) {
    if (!on("reverseOnMistake") || !pair) return;
    reverseNext = pair;
  }
  function takeReverse(currentDe) {
    if (!reverseNext || reverseNext[0] === currentDe) { reverseNext = null; return null; }
    const p = reverseNext;
    reverseNext = null;
    return p;
  }

  /* ------------------------------------------------------------
     ФИШКА 7 · таймер сессии
     ------------------------------------------------------------ */
  let timer = null, endsAt = 0;
  function renderTimer() {
    const host = $("#sessionTimer");
    if (!host) return;
    const min = Number(ui().studyTimer) || 0;
    clearInterval(timer);
    timer = null;
    if (!min) { host.hidden = true; host.textContent = ""; return; }
    host.hidden = false;
    endsAt = Date.now() + min * 60000;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      const m = String(Math.floor(left / 60)).padStart(2, "0");
      const s = String(left % 60).padStart(2, "0");
      host.textContent = `${m}:${s}`;
      host.classList.toggle("low", left <= 60);
      if (left === 0) {
        clearInterval(timer);
        timer = null;
        host.hidden = false;
        host.textContent = "Время!";
        window.DQ && window.DQ.toast && window.DQ.toast("Таймер сессии вышел — сделайте паузу", "ok");
      }
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  /* ------------------------------------------------------------
     ФИШКА 8 · напоминание про перерыв (25 минут учёбы)
     ------------------------------------------------------------ */
  let workStarted = Date.now();
  let breakAnnounced = false;
  setInterval(() => {
    if (!on("breakReminder")) { workStarted = Date.now(); breakAnnounced = false; return; }
    if (breakAnnounced) return;
    if (Date.now() - workStarted >= 25 * 60000) {
      breakAnnounced = true;
      workStarted = Date.now();
      window.DQ && window.DQ.toast && window.DQ.toast("25 минут за книжками — разомнитесь и выпейте воды", "ok");
    }
  }, 15000);

  /* ------------------------------------------------------------
     ФИШКА 9 · «что нажимать дальше» — мягкая подсказка
     ------------------------------------------------------------ */
  function tip() {
    const done = !!$("#nextBtn") && !$("#nextBtn").disabled;
    const opt = $(".options .opt:not(:disabled)");
    const input = $("#answerArea input.input");
    if (done) return "Enter — дальше";
    if (opt) return `1–4 — выбрать · Space — проверить`;
    if (input) {
      if (on("typingPractice") && !input.value) return "Наберите ответ · Space — проверить";
      return "Space — проверить · Enter — дальше";
    }
    return "";
  }

  /* ------------------------------------------------------------
     ФИШКА 10 · приветствие с планом на день (один раз за день)
     ------------------------------------------------------------ */
  function greeting(stats) {
    if (!on("greeting")) return;
    const day = new Date().toISOString().slice(0, 10);
    let seenKey = "";
    try { seenKey = localStorage.getItem("dq.greeted") || ""; } catch (e) { }
    if (seenKey === day) return;
    try { localStorage.setItem("dq.greeted", day); } catch (e) { }
    const goal = Number(ui().dailyGoal) || 10;
    const today = Number(stats && stats.daily_answers) || 0;
    const due = window.DQ && window.DQ.progress ? window.DQ.progress().due : 0;
    const left = Math.max(0, goal - today);
    const lines = [
      left ? `Цель дня: ещё ${left} ${left === 1 ? "ответ" : "ответов"}` : "Цель дня уже сделана — отличная работа",
      due ? `К повторению: ${due}` : "",
    ].filter(Boolean);
    window.DQ && window.DQ.toast && window.DQ.toast(lines.join(" · "), "ok");
  }

  /* ------------------------------------------------------------
     Публичный API
     ------------------------------------------------------------ */
  return {
    wordCard, articleForm, pluralForm,
    related, germanHint, wordOfDay,
    renderWordOfDay, noteAnswer, dueSoon, askReverse, takeReverse,
    renderTimer, tip, greeting,
    /** Применить всё, что зависит от настроек (зовётся из SETTINGS.apply). */
    sync() {
      renderWordOfDay();
      renderTimer();
    },
    /** Блок разбора/подсказки под ответом. */
    explain(de, ru) {
      const bits = [wordCard(de), germanHint(de, ru)];
      const rel = related(de);
      const relHtml = rel.length
        ? `<div class="lc-rel"><span class="lc-rel-t">Похожие:</span> ${rel.map((p) => `<button class="lc-rel-w" data-de="${esc(p[0])}" data-ru="${esc(p[1])}">${esc(p[0])}</button>`).join(" ")}</div>`
        : "";
      const html = bits.filter(Boolean).join("") + relHtml;
      return html ? `<div class="lc-explain">${html}</div>` : "";
    },
  };
})();
