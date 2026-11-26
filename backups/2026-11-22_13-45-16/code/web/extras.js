/* ============================================================
   Deutsch Quest — ДОПОЛНИТЕЛЬНЫЕ РАЗДЕЛЫ И ФУНКЦИИ (window.DQExtras).

   Что добавлено в приложение:
     1. Дневник (Journal)        — все ответы по дням, что и когда учил
     2. План на день (Plan)      — цель, время, серия, чек-лист задач
     3. Карточки (SRS-колода)    — интервальные повторения «переверни карточку»
     4. Диктант (Diktat)         — слушаешь фразу и печатаешь её
     5. Экзамен (Prüfung)        — 10 вопросов из всех навыков + оценка
     6. Режим фокуса             — скрывает всё лишнее, таймер 25 минут
     7. Палитра команд (⌘K)      — быстрый переход к любому разделу
     8. Трекер серии дней        — огонёк и «заморозки»
     9. Быстрые заметки          — своя заметка к любому слову
    10. Экспорт/импорт прогресса — JSON, без сервера
    11. Эмбиент-шум / фокус-звук — WebAudio, без файлов
    12. Горячая клавиша ⌘K, ⌘E (экспорт), F (фокус), ? (справка)

   Всё хранится в localStorage; серверная статистика (XP) — через DQ.award.
   ============================================================ */
"use strict";

window.DQExtras = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const KEY = "dq.extras.v1";
  const S = {
    journal: {},      // "2026-11-20": [{t, de, ru, ok, src}]
    notes: {},        // "de-слово": "заметка"
    streak: { days: 0, last: null, freezes: 2 },
    focus: { on: false, endTs: 0, minutes: 25 },
    plan: { tasks: [] },
  };

  /* ---------------- хранение ---------------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(S, JSON.parse(raw));
    } catch (e) { /* пустой кэш */ }
    if (!S.journal || typeof S.journal !== "object") S.journal = {};
    if (!S.notes || typeof S.notes !== "object") S.notes = {};
    if (!S.plan.tasks) S.plan.tasks = [];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
  }
  const dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  /* ---------------- журнал ---------------- */
  function log(de, ru, ok, src) {
    const k = dayKey();
    const arr = S.journal[k] || (S.journal[k] = []);
    arr.push({ t: Date.now(), de, ru, ok: !!ok, src: src || "train" });
    if (arr.length > 400) arr.splice(0, arr.length - 400);
    const keys = Object.keys(S.journal).sort();
    if (keys.length > 180) keys.slice(0, keys.length - 180).forEach((x) => delete S.journal[x]);
    bumpStreak();
    save();
  }

  function bumpStreak() {
    const today = dayKey();
    if (S.streak.last === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    S.streak.days = S.streak.last === dayKey(y) ? (S.streak.days || 0) + 1 : 1;
    S.streak.last = today;
  }

  function journalDays(n = 14) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = dayKey(d);
      const arr = S.journal[k] || [];
      out.push({ key: k, label: d.toLocaleDateString("ru", { day: "2-digit", month: "short" }), count: arr.length, ok: arr.filter((x) => x.ok).length });
    }
    return out;
  }

  /* ---------------- экран: Дневник ---------------- */
  function renderJournal() {
    const host = $("#journalBody");
    if (!host) return;
    const days = journalDays(21).reverse();
    const total = Object.values(S.journal).reduce((n, a) => n + a.length, 0);
    const okN = Object.values(S.journal).reduce((n, a) => n + a.filter((x) => x.ok).length, 0);
    const max = Math.max(1, ...days.map((d) => d.count));

    const bars = days.map((d) => `
      <button class="jr-day ${d.count ? "" : "empty"}" data-day="${d.key}" title="${d.label}: ${d.count} ответов">
        <i style="height:${Math.round((d.count / max) * 100)}%"></i>
        <em>${d.label}</em>
      </button>`).join("");

    const todayArr = (S.journal[dayKey()] || []).slice().reverse().slice(0, 20);
    const list = todayArr.length ? todayArr.map((x) => `
      <li class="jr-item ${x.ok ? "ok" : "bad"}">
        <span class="jr-mark">${x.ok ? "✓" : "✕"}</span>
        <span class="jr-de">${esc(x.de || "")}</span>
        <span class="jr-ru">${esc(x.ru || "")}</span>
        <time>${new Date(x.t).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}</time>
      </li>`).join("") : `<li class="jr-empty">Сегодня пока нет ответов — начните тренировку.</li>`;

    host.innerHTML = `
      <div class="jr-stats">
        <div><b>${total}</b><span>ответов всего</span></div>
        <div><b>${total ? Math.round((okN / total) * 100) : 0}%</b><span>точность</span></div>
        <div><b>${S.streak.days || 0}</b><span>дней подряд</span></div>
      </div>
      <h3 class="jr-title">Активность</h3>
      <div class="jr-bars">${bars}</div>
      <h3 class="jr-title">Сегодня</h3>
      <ul class="jr-list" id="jrList">${list}</ul>`;
    bindJournal();
  }

  function bindJournal() {
    $$(".jr-day").forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.day;
        const arr = (S.journal[k] || []).slice().reverse();
        const list = $("#jrList");
        if (!list) return;
        list.innerHTML = arr.length ? arr.map((x) => `
          <li class="jr-item ${x.ok ? "ok" : "bad"}">
            <span class="jr-mark">${x.ok ? "✓" : "✕"}</span>
            <span class="jr-de">${esc(x.de || "")}</span>
            <span class="jr-ru">${esc(x.ru || "")}</span>
            <time>${new Date(x.t).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}</time>
          </li>`).join("") : `<li class="jr-empty">В этот день занятий не было.</li>`;
      };
    });
  }

  /* ---------------- экран: План ---------------- */
  function renderPlan() {
    const host = $("#planBody");
    if (!host) return;
    const goal = (window.SETTINGS && window.SETTINGS.ui.dailyGoal) || 10;
    const done = (S.journal[dayKey()] || []).length;
    const pct = Math.min(100, Math.round((done / Math.max(1, goal)) * 100));
    const mins = Math.round(S.focus.minutes);

    const tasks = S.plan.tasks;
    const list = tasks.length ? tasks.map((t, i) => `
      <li class="pl-task ${t.done ? "done" : ""}" data-i="${i}">
        <button class="pl-check" aria-label="готово"></button>
        <input class="pl-input" value="${esc(t.text)}" maxlength="90">
        <button class="pl-del" aria-label="удалить">×</button>
      </li>`).join("") : `<li class="pl-empty">Список пуст — добавьте первую задачу.</li>`;

    host.innerHTML = `
      ${window.DQIdeas && window.DQIdeas.challengeHtml ? window.DQIdeas.challengeHtml() : ""}
      ${smartPlanHtml(goal, done)}
      <div class="pl-main">
        <div class="pl-ring" style="--p:${pct}"><b>${done}<small>&nbsp;/&nbsp;${goal}</small></b></div>
        <div class="pl-info">
          <h2>Сегодня</h2>
          <p>${done >= goal ? "Цель дня выполнена." : `Осталось ${goal - done} ответов до цели.`}</p>
          <div class="pl-meta">
            <span>Серия: <b>${S.streak.days || 0} дн.</b></span>
            <span>Фокус: <b>${mins} мин</b></span>
          </div>
        </div>
      </div>

      <div class="pl-tasks-card">
        <div class="pl-tasks-head">
          <h3>Задачи на день</h3>
          <button class="btn ghost small" id="plAdd">+ Добавить</button>
        </div>
        <ul class="pl-tasks" id="plTasks">${list}</ul>
      </div>

      <div class="pl-actions">
        <button class="btn primary" id="plStart">Начать тренировку</button>
        <button class="btn ghost" id="plFocus">${S.focus.on ? "Выйти из фокуса" : "Режим фокуса"}</button>
      </div>`;
    bindPlan();
  }

  /** Умный план: сам предлагает задачи на сегодня и отмечает выполненное (идея 103). */
  function smartPlanHtml(goal, done) {
    const pr = (window.DQ && window.DQ.progress && window.DQ.progress()) || {};
    const due = pr.due || 0, left = Math.max(0, goal - done);
    const rows = [];
    if (due) rows.push({ t: `Повторить ${due} слов по расписанию`, ok: false, go: "dueBtn" });
    if (left) rows.push({ t: `Ещё ${left} ответа до цели дня`, ok: false, go: "planTrain" });
    else rows.push({ t: `Цель дня выполнена (${done}/${goal})`, ok: true });
    const readKey = `dq.read.${dayKey()}`;
    let hasRead = false;
    try { hasRead = !!localStorage.getItem(readKey); } catch (e) { }
    rows.push({ t: "Прочитать 1 текст", ok: hasRead, go: "planRead" });
    return `<div class="idea-card smart-plan">
      <div class="idea-head"><h3>План на сегодня</h3><span class="muted small">сам подсказывает</span></div>
      <ul class="sp-list">${rows.map((r) =>
        `<li class="${r.ok ? "ok" : ""}">${r.ok ? "✓" : "○"} ${esc(r.t)}` +
        (r.go ? ` <button class="link-btn sp-go" data-go="${r.go}">открыть</button>` : "") +
        `</li>`).join("")}</ul>
    </div>`;
  }

  function bindPlan() {
    const add = $("#plAdd");
    if (add) add.onclick = () => {
      S.plan.tasks.unshift({ text: "", done: false });
      save(); renderPlan();
      const inp = $("#plTasks .pl-input");
      if (inp) inp.focus();
    };
    $$(".pl-check").forEach((b) => {
      b.onclick = () => {
        const i = Number(b.parentElement.dataset.i);
        S.plan.tasks[i].done = !S.plan.tasks[i].done;
        save(); renderPlan();
      };
    });
    $$(".pl-input").forEach((inp) => {
      inp.onchange = () => {
        const i = Number(inp.parentElement.dataset.i);
        S.plan.tasks[i].text = inp.value;
        save();
      };
    });
    $$(".pl-del").forEach((b) => {
      b.onclick = () => {
        S.plan.tasks.splice(Number(b.parentElement.dataset.i), 1);
        save(); renderPlan();
      };
    });
    const st = $("#plStart");
    if (st) st.onclick = () => window.DQNav && window.DQNav.go("lernen");
    const fo = $("#plFocus");
    if (fo) fo.onclick = () => toggleFocus();
    // умный план (идея 103): кнопки «открыть» ведут в нужный раздел
    $$(".sp-go").forEach((b) => {
      b.onclick = () => {
        const go = b.dataset.go;
        if (go === "planRead") {
          try { localStorage.setItem(`dq.read.${dayKey()}`, "1"); } catch (e) { }
          window.DQNav && window.DQNav.go("reading");
        } else if (go === "planTrain") {
          window.DQNav && window.DQNav.go("train");
        } else if (go === "dueBtn") {
          window.DQNav && window.DQNav.go("train");
          setTimeout(() => { const d = document.querySelector("#dueBtn"); if (d) d.click(); }, 300);
        }
        renderPlan();
      };
    });
  }

  /* ---------------- экран: Карточки (SRS) ---------------- */
  const Cards = { deck: [], i: 0, flipped: false };

  function renderCards() {
    const host = $("#cardsBody");
    if (!host) return;
    // новая колода (web/ideas.js): реальные интервалы и слова из памяти
    if (window.DQIdeas && window.DQIdeas.renderDeck) {
      try { window.DQIdeas.renderDeck(); return; } catch (e) { console.warn(e); }
    }
    if (!Cards.deck.length) {
      const pool = (window.DQ && window.DQ.pairPool(40)) || [];
      Cards.deck = pool.map((p) => ({ de: p[0], ru: p[1], box: 0 })).slice(0, 20);
      Cards.i = 0;
      Cards.flipped = false;
    }
    if (!Cards.deck.length) {
      host.innerHTML = `<div class="cd-empty">Нет слов — выберите группы в «Тренажёре».</div>`;
      return;
    }
    const c = Cards.deck[Cards.i];
    host.innerHTML = `
      <div class="cd-progress">${Cards.i + 1} / ${Cards.deck.length}
        <div class="cd-bar"><i style="width:${Math.round((Cards.i / Cards.deck.length) * 100)}%"></i></div>
      </div>
      <button class="cd-card ${Cards.flipped ? "flipped" : ""}" id="cdCard">
        <span class="cd-face front">${esc(c.de)}</span>
        <span class="cd-face back">${esc(c.ru)}</span>
      </button>
      <p class="cd-hint">${Cards.flipped ? "Знаете? Отметьте." : "Нажмите на карточку, чтобы перевернуть"}</p>
      <div class="cd-actions">
        <button class="btn ghost" id="cdAgain">Ещё раз</button>
        <button class="btn ghost" id="cdSpeak"><span class="ico ico-vol"></span> Слушать</button>
        <button class="btn primary" id="cdKnow">Знаю</button>
      </div>`;
    bindCards(c);
  }

  function bindCards(c) {
    const card = $("#cdCard");
    if (card) card.onclick = () => { Cards.flipped = !Cards.flipped; renderCards(); };
    const again = $("#cdAgain");
    if (again) again.onclick = () => {
      Cards.deck.push(Cards.deck.splice(Cards.i, 1)[0]);
      Cards.flipped = false;
      renderCards();
      log(c.de, c.ru, false, "cards");
    };
    const know = $("#cdKnow");
    if (know) know.onclick = () => {
      log(c.de, c.ru, true, "cards");
      window.DQ && window.DQ.award && window.DQ.award(2);
      Cards.i = (Cards.i + 1) % Cards.deck.length;
      Cards.flipped = false;
      if (Cards.i === 0) Cards.deck = [];
      renderCards();
    };
    const sp = $("#cdSpeak");
    if (sp) sp.onclick = () => window.DQVoice && window.DQVoice.say(c.de, "de");
  }

  /* ---------------- экран: Диктант ---------------- */
  const Dict = { cur: null, ok: 0, total: 0 };

  function renderDictation() {
    const host = $("#dictBody");
    if (!host) return;
    if (!Dict.cur) Dict.cur = pickDictation();
    const c = Dict.cur;
    host.innerHTML = `
      <div class="dt-head">
        <span>Диктант</span>
        <b>${Dict.ok} / ${Dict.total}</b>
      </div>
      <div class="dt-listen">
        <button class="dt-play" id="dtPlay"><span class="ico ico-vol"></span></button>
        <button class="dt-play slow" id="dtSlow"><span class="ico ico-slow"></span></button>
      </div>
      <p class="dt-hint">Послушайте и напишите фразу по-немецки</p>
      <input class="input dt-input" id="dtInput" placeholder="Schreibe, was du hörst…" autocomplete="off" spellcheck="false">
      <div class="dt-feedback" id="dtFeedback"></div>
      <div class="dt-actions">
        <button class="btn ghost" id="dtRepeat">Повторить</button>
        <button class="btn primary" id="dtCheck">Проверить</button>
      </div>`;
    bindDictation(c);
    setTimeout(() => say(c.de), 250);
  }

  function pickDictation() {
    const all = (window.DQTrainData && window.DQTrainData.levels) || {};
    const lv = all[window.DQTrain ? window.DQTrain.level : "a1"] || all.a1 || {};
    const arr = (lv.schreiben || []).filter((x) => x.type === "words" && x.answer);
    const src = arr.length ? arr : [{ answer: "Ich lerne Deutsch.", ru: "Я учу немецкий." }];
    const it = src[Math.floor(Math.random() * src.length)];
    return { de: it.answer, ru: it.ru || "" };
  }

  function say(t, slow) {
    if (window.DQVoice) window.DQVoice.say(t, "de", { slow: !!slow, forceBrowser: true });
    else if (window.DQ) window.DQ.speak(t, "de");
  }

  function bindDictation(c) {
    const play = $("#dtPlay"); if (play) play.onclick = () => say(c.de);
    const slow = $("#dtSlow"); if (slow) slow.onclick = () => say(c.de, true);
    const rep = $("#dtRepeat"); if (rep) rep.onclick = () => say(c.de);
    const inp = $("#dtInput");
    if (inp) {
      inp.focus();
      inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); $("#dtCheck").click(); } };
    }
    const chk = $("#dtCheck");
    if (chk) chk.onclick = () => {
      const val = inp ? inp.value : "";
      const norm = (s) => String(s).toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ").trim();
      const ok = norm(val) === norm(c.de);
      Dict.total += 1; if (ok) Dict.ok += 1;
      log(c.de, c.ru, ok, "dictation");
      if (window.DQ) { window.DQ.award(ok ? 5 : 1); }
      const fb = $("#dtFeedback");
      if (fb) {
        fb.className = "dt-feedback " + (ok ? "ok" : "bad");
        fb.innerHTML = ok ? "Верно." : `Правильно: <b>${esc(c.de)}</b>`;
      }
      if (inp) inp.readOnly = true;
      chk.textContent = "Дальше";
      chk.onclick = () => { Dict.cur = pickDictation(); renderDictation(); };
    };
  }

  /* ---------------- экран: Экзамен ---------------- */
  const Exam = { items: [], i: 0, ok: 0, done: false };

  function buildExam() {
    const all = (window.DQTrainData && window.DQTrainData.levels) || {};
    const lv = (window.DQTrain ? window.DQTrain.level : "a1");
    const pool = [];
    for (const sk of ["hoeren", "wortschatz", "lesen", "schreiben"]) {
      const arr = ((all[lv] || {})[sk]) || [];
      arr.forEach((x) => pool.push({ ...x, _sk: sk }));
    }
    // берём только то, где есть из чего выбирать (в «письме» вариантов нет — будет одна кнопка «—»)
    const usable = pool.filter(examUsable);
    Exam.items = shuffle(usable.length ? usable : pool).slice(0, 10);
    Exam.i = 0; Exam.ok = 0; Exam.done = false;
  }

  /** Есть ли у задания минимум два реальных варианта ответа. */
  function examUsable(it) {
    if (it._sk === "lesen") {
      const q = (it.questions || [])[0];
      return !!q && (q.options || []).length >= 2 && !!q.answer;
    }
    if (it._sk === "schreiben") return false;
    const opts = it.options || [];
    return opts.length >= 2 && opts.every((o) => o && o !== "—");
  }

  const shuffle = (a) => {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[x[i], x[j]] = [x[j], x[i]]; }
    return x;
  };

  /** Перемешивает варианты ответа: верный мог быть первым (так в данных). */
  function shuffleAnswers(options, correct) {
    const list = Array.isArray(options) ? options.slice() : [];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return { answers: list, correct };
  }
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function renderExam() {
    const host = $("#examBody");
    if (!host) return;
    if (!Exam.items.length) buildExam();
    if (Exam.done) {
      const pct = Math.round((Exam.ok / Exam.items.length) * 100);
      const grade = pct >= 90 ? "Sehr gut" : pct >= 75 ? "Gut" : pct >= 60 ? "Befriedigend" : "Noch üben";
      host.innerHTML = `
        <div class="ex-result">
          <div class="ex-score" style="--p:${pct}"><b>${pct}%</b></div>
          <h2>${grade}</h2>
          <p>Правильно ${Exam.ok} из ${Exam.items.length}</p>
          <button class="btn primary" id="exAgain">Пройти ещё раз</button>
        </div>`;
      const again = $("#exAgain");
      if (again) again.onclick = () => { buildExam(); renderExam(); };
      return;
    }
    const it = Exam.items[Exam.i];
    const sk = it._sk;
    let prompt = "", answers = [], correct = "";
    if (sk === "hoeren") { prompt = "Что было сказано?"; answers = it.options; correct = it.answer || it.options[0]; }
    else if (sk === "wortschatz") { prompt = it.art ? `Артикль к «${it.word}»` : `Перевод «${it.word}»`; answers = it.options; correct = it.answer || it.ru; }
    else if (sk === "lesen") { prompt = it.questions[0].q; answers = it.questions[0].options; correct = it.questions[0].answer; }
    else { prompt = it.ru; answers = it.options || [it.answer || "—"]; correct = it.answer || ""; }
    // варианты в JSON лежат с верным первым — перемешиваем, чтобы его место было случайным
    ({ answers, correct } = shuffleAnswers(answers, correct));
    if (answers.length < 2) {              // такого быть не должно после examUsable
      Exam.i += 1;
      if (Exam.i >= Exam.items.length) Exam.done = true;
      return renderExam();
    }

    host.innerHTML = `
      <div class="ex-head">
        <span>Экзамен · ${sk}</span>
        <b>${Exam.i + 1} / ${Exam.items.length}</b>
      </div>
      <div class="ex-bar"><i style="width:${Math.round((Exam.i / Exam.items.length) * 100)}%"></i></div>
      <div class="ex-q">
        ${it._sk === "hoeren" ? `<button class="dt-play" id="exSay"><span class="ico ico-vol"></span></button>` : ""}
        <h2>${esc(prompt)}</h2>
        ${it.text ? `<p class="ex-text">${esc(it.text)}</p>` : ""}
      </div>
      <div class="ex-opts">${answers.map((a, i) => `<button class="ex-opt" data-i="${i}">${esc(a)}</button>`).join("")}</div>
      <div class="ex-fb" id="exFb"></div>`;
    bindExam(it, answers, correct);
  }

  function bindExam(it, answers, correct) {
    if (it._sk === "hoeren") {
      const b = $("#exSay"); if (b) b.onclick = () => say(it.say);
      setTimeout(() => say(it.say), 250);
    }
    let locked = false;
    $$(".ex-opt").forEach((b) => {
      b.onclick = () => {
        if (locked) return;
        locked = true;
        const picked = answers[Number(b.dataset.i)];
        // сравниваем по индексу: в вариантах могут быть одинаковые строки (например, два «der»)
        const ok = Number(b.dataset.i) === answers.indexOf(correct);
        if (ok) Exam.ok += 1;
        $$(".ex-opt").forEach((x) => {
          if (Number(x.dataset.i) === answers.indexOf(correct)) x.classList.add("correct");
          else if (x === b) x.classList.add("wrong");
          x.disabled = true;
        });
        const fb = $("#exFb");
        if (fb) { fb.className = "ex-fb " + (ok ? "ok" : "bad"); fb.textContent = ok ? "Верно" : `Правильно: ${correct}`; }
        if (window.DQ) window.DQ.award(ok ? 6 : 1);
        log(it.say || it.word || it.answer || correct, it.ru || "", ok, "exam");
        setTimeout(() => {
          Exam.i += 1;
          if (Exam.i >= Exam.items.length) { Exam.done = true; renderExam(); }
          else renderExam();
        }, 900);
      };
    });
  }

  /* ---------------- режим фокуса ---------------- */
  let focusTimer = 0;
  function toggleFocus(force) {
    const on = force === undefined ? !S.focus.on : !!force;
    S.focus.on = on;
    document.body.classList.toggle("focus-mode", on);
    const pill = $("#focusPill");
    if (on) {
      S.focus.minutes = 25;
      S.focus.endTs = Date.now() + S.focus.minutes * 60000;
      save();
      if (pill) { pill.hidden = false; tickFocus(); clearInterval(focusTimer); focusTimer = setInterval(tickFocus, 1000); }
      if (window.DQ && window.DQ.toast) window.DQ.toast("Режим фокуса · 25 минут", "ok");
    } else {
      if (pill) pill.hidden = true;
      clearInterval(focusTimer);
      focusTimer = 0;
      save();
    }
  }
  function tickFocus() {
    const pill = $("#focusPill");
    if (!pill) return;
    const left = Math.max(0, Math.round((S.focus.endTs - Date.now()) / 1000));
    const m = String(Math.floor(left / 60)).padStart(2, "0");
    const s = String(left % 60).padStart(2, "0");
    pill.querySelector("b").textContent = `${m}:${s}`;
    if (left === 0) { toggleFocus(false); if (window.DQ) window.DQ.toast("Фокус завершён", "ok"); }
  }

  /* ---------------- палитра команд ---------------- */
  const CMDS = [
    { id: "lernen", label: "Тренировка A0–B1", hint: "4 навыка", view: "lernen" },
    { id: "train", label: "Тренажёр", hint: "слово за словом", view: "train" },
    { id: "games", label: "Игры", hint: "мини-игры", view: "games" },
    { id: "worksheets", label: "Задания", hint: "тесты", view: "worksheets" },
    { id: "reading", label: "Чтение", hint: "тексты", view: "reading" },
    { id: "journal", label: "Дневник", hint: "что учил", view: "journal" },
    { id: "plan", label: "План дня", hint: "цели и задачи", view: "plan" },
    { id: "cards", label: "Карточки", hint: "SRS-колода", view: "cards" },
    { id: "dictation", label: "Диктант", hint: "на слух", view: "dictation" },
    { id: "exam", label: "Экзамен", hint: "10 вопросов", view: "exam" },
    { id: "stats", label: "Статистика", hint: "прогресс", view: "stats" },
    { id: "settings", label: "Настройки", hint: "вид и звук", action: () => window.SETTINGS && window.SETTINGS.open() },
    { id: "focus", label: "Режим фокуса", hint: "25 минут", action: () => toggleFocus() },
    { id: "export", label: "Экспорт прогресса", hint: "JSON-файл", action: () => exportProgress() },
  ];

  let cmdOpen = false, cmdSel = 0, cmdList = CMDS;
  function openCmd() {
    const ov = $("#cmdOverlay");
    if (!ov) return;
    cmdOpen = true; cmdSel = 0; cmdList = CMDS.slice();
    ov.classList.add("open");
    const inp = $("#cmdInput");
    if (inp) { inp.value = ""; inp.focus(); }
    renderCmd();
    document.documentElement.classList.add("modal-open");
  }
  function closeCmd() {
    cmdOpen = false;
    const ov = $("#cmdOverlay");
    if (ov) ov.classList.remove("open");
    document.documentElement.classList.remove("modal-open");
  }
  function renderCmd() {
    const list = $("#cmdList");
    if (!list) return;
    list.innerHTML = cmdList.length ? cmdList.map((c, i) => `
      <li class="cmd-item ${i === cmdSel ? "sel" : ""}" data-i="${i}">
        <span>${esc(c.label)}</span><em>${esc(c.hint)}</em>
      </li>`).join("") : `<li class="cmd-empty">Ничего не найдено</li>`;
    $$(".cmd-item", list).forEach((li) => {
      li.onclick = () => runCmd(cmdList[Number(li.dataset.i)]);
    });
  }
  function runCmd(c) {
    if (!c) return;
    closeCmd();
    if (c.action) c.action();
    else if (window.DQNav) window.DQNav.go(c.view);
  }

  /* ---------------- экспорт / импорт ---------------- */
  function exportProgress() {
    const data = {
      v: 1, exported: new Date().toISOString(),
      stats: (window.DQ && window.DQ.stats) || {},
      extras: S,
      train: (() => { try { return JSON.parse(localStorage.getItem("dq.train.v1") || "{}"); } catch (e) { return {}; } })(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `deutsch-quest-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    if (window.DQ) window.DQ.toast("Прогресс выгружен", "ok");
  }

  /* ---------------- заметки к словам ---------------- */
  function noteFor(word) { return S.notes[word] || ""; }
  function setNote(word, text) {
    if (!word) return;
    if (text) S.notes[word] = text; else delete S.notes[word];
    save();
  }

  /* ---------------- звук-эмбиент ---------------- */
  const Amb = { ctx: null, gain: null, on: false };
  function toggleAmbient() {
    try {
      if (!Amb.ctx) {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        Amb.ctx = new C();
        Amb.gain = Amb.ctx.createGain();
        Amb.gain.gain.value = 0.015;
        Amb.gain.connect(Amb.ctx.destination);
        // мягкий шум через фильтр — «дождь»
        const buf = Amb.ctx.createBuffer(1, Amb.ctx.sampleRate * 2, Amb.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
        const src = Amb.ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const flt = Amb.ctx.createBiquadFilter();
        flt.type = "lowpass"; flt.frequency.value = 900;
        src.connect(flt); flt.connect(Amb.gain); src.start();
      }
      Amb.on = !Amb.on;
      Amb.gain.gain.value = Amb.on ? 0.02 : 0;
      if (Amb.ctx.state === "suspended") Amb.ctx.resume();
    } catch (e) { /* нет AudioContext */ }
  }

  /* ---------------- инициализация ---------------- */
  function init() {
    load();
    // кнопки-переключатели в шапке
    const fBtn = $("#focusBtn");
    if (fBtn) fBtn.onclick = () => toggleFocus();
    const cmdBtn = $("#cmdBtn");
    if (cmdBtn) cmdBtn.onclick = openCmd;
    const fs = $("#focusStop");
    if (fs) fs.onclick = () => toggleFocus(false);

    const ov = $("#cmdOverlay");
    if (ov) {
      ov.onclick = (e) => { if (e.target.id === "cmdOverlay") closeCmd(); };
      const inp = $("#cmdInput");
      if (inp) {
        inp.oninput = () => {
          const q = inp.value.trim().toLowerCase();
          cmdList = q ? CMDS.filter((c) => (c.label + " " + c.hint).toLowerCase().includes(q)) : CMDS.slice();
          cmdSel = 0;
          renderCmd();
        };
      }
    }

    document.addEventListener("keydown", (e) => {
      const typing = e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); cmdOpen ? closeCmd() : openCmd(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") { e.preventDefault(); exportProgress(); return; }
      if (cmdOpen) {
        if (e.key === "Escape") { e.preventDefault(); closeCmd(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); cmdSel = Math.min(cmdList.length - 1, cmdSel + 1); renderCmd(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); cmdSel = Math.max(0, cmdSel - 1); renderCmd(); }
        else if (e.key === "Enter") { e.preventDefault(); runCmd(cmdList[cmdSel]); }
        return;
      }
      if (typing) return;
      if (e.key === "f" || e.key === "F") { if (!e.altKey && !e.ctrlKey && !e.metaKey) toggleFocus(); }
    });

    document.addEventListener("pointerdown", () => { if (Amb.ctx && Amb.ctx.state === "suspended") Amb.ctx.resume(); }, { once: true });
  }

  /* ---------------- публичный API ---------------- */
  return {
    init,
    log,
    renderJournal,
    renderPlan,
    renderCards,
    renderDictation,
    renderExam,
    toggleFocus,
    openCmd,
    exportProgress,
    noteFor,
    setNote,
    toggleAmbient,
    journalDays,
    get streak() { return S.streak; },
    get extras() { return S; },
  };
})();
