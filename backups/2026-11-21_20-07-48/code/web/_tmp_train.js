/* ============================================================
   Deutsch Quest — раздел «Тренировка» (Lernen).

   Уровни A0–B1 × 4 навыка:
     hoeren     — слушаем фразу (TTS) и выбираем перевод
     wortschatz — карточки: значение слова / артикль der·die·das
     lesen      — короткий текст + вопросы на понимание
     schreiben  — порядок слов из перемешанных слов / перевод фразы

   Данные лежат в web/train/data-<уровень>.js и грузятся через
   window.DQTrainData.levels[уровень][навык] = [ {...}, {...} ].

   Форматы заданий (по типу навыка):
     hoeren:     { id, say, ru, options: [...] }
     wortschatz: { id, word, ru, options: [...] }
                 { art: true, id, word, answer: "der|die|das", options }
     lesen:      { id, title, text, questions: [{ q, options, answer }] }
     schreiben ★ { id, type: "words", ru, answer, words: [...], hint }
                 { id, type: "write", ru, answers: [...], hint }

   Прогресс — в localStorage (ключ dq.train.v1), серверная статистика
   (XP, ответы) обновляется через DQ.award / DQ.batch — как в играх.
   ============================================================ */
"use strict";

window.DQTrain = (function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const LEVELS = ["a0", "a1", "a2", "b1"];
  const SKILLS = ["hoeren", "wortschatz", "lesen", "schreiben"];
  const SKILL_TITLE = {
    hoeren: "Hören",
    wortschatz: "Wortschatz",
    lesen: "Lesen",
    schreiben: "Schreiben",
  };
  const SKILL_SUB = {
    hoeren: "Слушаем и выбираем, что было сказано",
    wortschatz: "Слова, значения и артикли der · die · das",
    lesen: "Короткий текст и вопросы на понимание",
    schreiben: "Собираем фразы и переводим — главный блок A1–A2",
  };
  const STORE_KEY = "dq.train.v1";

  /* ---------------- состояние ---------------- */
  const S = {
    level: "a1",              // a0 | a1 | a2 | b1
    skill: "schreiben",       // hoeren | wortschatz | lesen | schreiben
    queue: [],                // задания текущего круга
    idx: 0,
    cur: null,                // текущее задание
    picked: [],               // выбранные слова (Schreiben: words)
    pickedOpt: null,          // выбранный вариант (choice-задания)
    checked: false,           // ответ уже проверен
    showing: false,           // открыт разбор
    session: { ok: 0, total: 0 },
    progress: load(),         // { a1: { schreiben: {ok, total, doneIds:...} } }
  };

  /* ---------------- localStorage ---------------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (!data || typeof data !== "object") return {};
      return data;
    } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S.progress)); } catch (e) { /* приватный режим */ }
  }
  function bucket(lv = S.level, sk = S.skill) {
    S.progress[lv] = S.progress[lv] || {};
    const b = S.progress[lv][sk] || (S.progress[lv][sk] = { ok: 0, total: 0, ids: {} });
    if (!b.ids) b.ids = {};
    return b;
  }

  /* ---------------- утилиты ---------------- */
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const normalize = (s) => String(s || "")
    .trim()
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[.,!?;:„“"']+/g, "")
    .replace(/\s+/g, " ");

  function editDistance(a, b) {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  /** Сравнение перевода: точка/регистр не важны, 1 опечатка прощается на коротких фразах. */
  function matchTranslation(user, answers) {
    const got = normalize(user);
    if (!got) return false;
    return answers.some((a) => {
      const want = normalize(a);
      if (got === want) return true;
      const dist = editDistance(got, want);
      const limit = want.length <= 12 ? 1 : want.length <= 30 ? 2 : 3;
      return dist <= limit;
    });
  }

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  function say(text, slow) {
    if (!text) return;
    if (window.DQVoice) { window.DQVoice.say(text, "de", { slow: !!slow, forceBrowser: true }); return; }
    if (window.DQ && window.DQ.speak) window.DQ.speak(text, "de");
  }

  /* ---------------- данные ---------------- */
  function data(level = S.level, skill = S.skill) {
    const all = window.DQTrainData && window.DQTrainData.levels;
    const lv = all && all[level];
    const arr = lv && lv[skill];
    return Array.isArray(arr) ? arr : [];
  }

  /** Круг: сначала «не решённые», потом остальные. Не больше 8 подряд. */
  function buildQueue() {
    const items = data();
    const ids = bucket().ids;
    const fresh = items.filter((x) => !ids[x.id]);
    const rest = items.filter((x) => ids[x.id]);
    S.queue = [...shuffle(fresh), ...shuffle(rest)];
    S.idx = 0;
  }

  /* ---------------- рендер: шапка ---------------- */
  function renderHead() {
    const bar = $("#trLevels");
    if (bar) {
      $$("button", bar).forEach((b) => b.classList.toggle("active", b.dataset.level === S.level));
    }
    const tabs = $("#trTabs");
    if (tabs) {
      $$("button", tabs).forEach((b) => {
        const sk = b.dataset.skill;
        const n = data(S.level, sk).length;
        b.classList.toggle("active", sk === S.skill);
        b.classList.toggle("is-priority", sk === "schreiben" && (S.level === "a1" || S.level === "a2"));
        const cnt = $(".tr-tab-n", b);
        if (cnt) cnt.textContent = n;
      });
    }
    const sub = $("#trSkillSub");
    if (sub) sub.textContent = SKILL_SUB[S.skill] || "";
    renderProgress();
  }

  function renderProgress() {
    const box = $("#trProgress");
    if (!box) return;
    const rows = LEVELS.map((lv) => {
      const cells = SKILLS.map((sk) => {
        const b = (S.progress[lv] || {})[sk];
        const total = data(lv, sk).length;
        const ok = b ? b.ok || 0 : 0;
        const pct = total ? Math.round((Math.min(ok, total) / total) * 100) : 0;
        return `<span class="tr-pc${lv === S.level && sk === S.skill ? " cur" : ""}" title="${SKILL_TITLE[sk]}: ${ok} верных">
          <i style="--p:${pct}%"></i><em>${SKILL_TITLE[sk].slice(0, 3)}</em>
        </span>`;
      }).join("");
      return `<div class="tr-pr-row${lv === S.level ? " cur" : ""}">
        <button class="tr-pr-lv" data-level="${lv}" title="Переключиться на ${lv.toUpperCase()}">${lv.toUpperCase()}</button>
        <div class="tr-pr-cells">${cells}</div>
      </div>`;
    }).join("");
    const s = S.session;
    box.innerHTML = `
      <div class="tr-pr-top">
        <span>Сессия</span>
        <b>${s.ok} / ${s.total}</b>
      </div>
      ${rows}
      <button class="btn ghost small block" id="trResetAll" style="margin-top:10px">Сбросить прогресс раздела</button>`;

    $$(".tr-pr-lv", box).forEach((b) => {
      b.onclick = () => setLevel(b.dataset.level);
    });
    const reset = $("#trResetAll", box);
    if (reset) reset.onclick = resetProgress;
  }

  /* ---------------- рендер: задание ---------------- */
  function renderStage() {
    const stage = $("#trStage");
    if (!stage) return;
    if (!S.queue.length) {
      stage.innerHTML = `<div class="tr-empty">
        <p>Для этого уровня и навыка пока нет заданий.</p>
        <p class="muted small">Задания лежат в web/train/data-${S.level}.js — допишите объект в массив «${S.skill}».</p>
      </div>`;
      return;
    }
    const item = S.queue[S.idx % S.queue.length];
    S.cur = item;
    S.picked = [];
    S.pickedOpt = null;
    S.checked = false;
    S.showing = false;
    stage.innerHTML = `
      <div class="tr-card" data-kind="${S.skill}">
        ${renderCounter()}
        <div class="tr-prompt">
          <div class="tr-tag">${SKILL_TITLE[S.skill]} · ${S.level.toUpperCase()}</div>
          ${renderPrompt(item)}
        </div>
        <div class="tr-answer" id="trAnswer">${renderAnswer(item)}</div>
        <div class="tr-feedback" id="trFeedback"></div>
        <div class="tr-actions">
          <button class="btn ghost small" id="trHint"><span class="ico ico-bulb"></span> Показать разбор</button>
          <button class="btn primary" id="trCheck">Проверить</button>
          <button class="btn ghost small" id="trNext" hidden>Дальше →</button>
        </div>
      </div>`;
    bindStage(item);
    if (S.skill === "hoeren") say(item.say);
  }

  function renderCounter() {
    const total = S.queue.length;
    const n = (S.idx % total) + 1;
    return `<div class="tr-counter">
      <span>${n} / ${total}</span>
      <div class="tr-bar"><i style="width:${Math.round((n - 1) / total * 100)}%"></i></div>
    </div>`;
  }

  function renderPrompt(it) {
    switch (S.skill) {
      case "hoeren":
        return `<button class="tr-play" id="trPlay" title="Слушать"><span class="ico ico-vol"></span></button>
                <button class="tr-play slow" id="trPlaySlow" title="Медленно"><span class="ico ico-slow"></span></button>
                <p class="tr-note">Нажмите и послушайте — затем выберите перевод.</p>`;
      case "wortschatz":
        if (it.art) {
          return `<div class="tr-word">der · die · das <b>${esc(it.word)}</b></div>
                  <p class="tr-note">${esc(it.ru || "")} — какой артикль?</p>`;
        }
        return `<div class="tr-word">${esc(it.word)}</div>
                <p class="tr-note">Что это значит по-русски?</p>`;
      case "lesen":
        return `<h3 class="tr-title">${esc(it.title)}</h3>
                <div class="tr-text" data-lead="on">${esc(it.text).replace(/\n/g, "<br>")}</div>`;
      case "schreiben":
        if (it.type === "words") {
          return `<div class="tr-ru">${esc(it.ru)}</div>
                  <p class="tr-note">Соберите немецкое предложение из слов ниже.</p>`;
        }
        return `<div class="tr-ru">${esc(it.ru)}</div>
                <p class="tr-note">Напишите по-немецки.</p>`;
      default:
        return "";
    }
  }

  function renderAnswer(it) {
    switch (S.skill) {
      case "hoeren":
      case "wortschatz":
        return `<div class="tr-opts">${(it.options || []).map((o, i) =>
          `<button class="tr-opt" data-i="${i}">${esc(o)}</button>`).join("")}</div>`;
      case "lesen":
        return `<div class="tr-qs">${(it.questions || []).map((q, qi) =>
          `<div class="tr-q" data-q="${qi}">
            <div class="tr-q-text">${esc(q.q)}</div>
            <div class="tr-opts">${(q.options || []).map((o, oi) =>
            `<button class="tr-opt" data-q="${qi}" data-i="${oi}">${esc(o)}</button>`).join("")}</div>
          </div>`).join("")}</div>`;
      case "schreiben":
        return it.type === "words" ? renderWordBuilder(it) : renderWriting(it);
      default:
        return "";
    }
  }

  function renderWordBuilder(it) {
    return `
      <div class="tr-build" id="trBuild"></div>
      <div class="tr-words" id="trWords">${(it.words || []).map((w, i) =>
      `<button class="tr-chip" data-i="${i}">${esc(w)}</button>`).join("")}</div>`;
  }

  function renderWriting() {
    return `<div class="tr-write-row">
      <input class="input tr-input" id="trInput" placeholder="Schreibe auf Deutsch…" autocomplete="off" spellcheck="false">
      <span class="tr-input-extra muted small">Enter — проверить</span>
    </div>`;
  }

  /* ---------------- привязка ---------------- */
  function bindStage(it) {
    const check = $("#trCheck");
    if (check) check.onclick = () => doCheck(it);
    const hint = $("#trHint");
    if (hint) hint.onclick = () => showReview(it);
    const next = $("#trNext");
    if (next) next.onclick = () => advance();

    if (S.skill === "hoeren") {
      const p = $("#trPlay"); if (p) p.onclick = () => say(it.say);
      const ps = $("#trPlaySlow"); if (ps) ps.onclick = () => say(it.say, true);
    }

    /* выбор варианта */
    $$("#trAnswer .tr-opt").forEach((b) => {
      b.onclick = () => {
        if (S.checked) return;
        if (S.skill === "lesen") {
          const qi = b.dataset.q;
          $$(`#trAnswer .tr-opt[data-q="${qi}"]`).forEach((x) => x.classList.remove("sel"));
          b.classList.add("sel");
        } else {
          $$("#trAnswer .tr-opt").forEach((x) => x.classList.remove("sel"));
          b.classList.add("sel");
          S.pickedOpt = Number(b.dataset.i);
        }
      };
    });

    if (S.skill === "schreiben" && it.type === "words") {
      const build = $("#trBuild");
      const update = () => {
        build.innerHTML = S.picked.map((wi, pos) =>
          `<button class="tr-chip in" data-pos="${pos}">${esc(it.words[wi])}</button>`).join("");
        $$("#trWords .tr-chip").forEach((c) => {
          c.classList.toggle("used", S.picked.includes(Number(c.dataset.i)));
        });
        build.querySelectorAll(".tr-chip").forEach((c) => {
          c.onclick = () => {
            if (S.checked) return;
            S.picked.splice(Number(c.dataset.pos), 1);
            update();
          };
        });
      };
      $$("#trWords .tr-chip").forEach((c) => {
        c.onclick = () => {
          if (S.checked || c.classList.contains("used")) return;
          S.picked.push(Number(c.dataset.i));
          update();
        };
      });
      bindStage._update = update;
    }

    if (S.skill === "schreiben" && it.type === "write") {
      const inp = $("#trInput");
      if (inp) {
        inp.focus();
        inp.onkeydown = (e) => {
          if (e.key === "Enter") { e.preventDefault(); S.checked ? advance() : doCheck(it); }
        };
      }
    }
  }

  /* ---------------- проверка ---------------- */
  function doCheck(it) {
    if (S.checked) return;

    if (S.skill === "hoeren" || S.skill === "wortschatz") return checkChoice(it);
    if (S.skill === "lesen") return checkReading(it);
    if (S.skill === "schreiben") {
      return it.type === "words" ? checkWords(it) : checkWrite(it);
    }
  }

  function mark(ok, msg, extra, it) {
    S.checked = true;
    const fb = $("#trFeedback");
    if (fb) {
      fb.className = "tr-feedback " + (ok ? "ok" : "bad");
      fb.innerHTML = `${ok ? "Верно." : "Пока не так."} ${msg || ""}${extra ? `<div class="tr-explain">${extra}</div>` : ""}`;
      fb.classList.toggle("has-explain", !!extra);
    }
    const chk = $("#trCheck"); if (chk) chk.hidden = true;
    const nxt = $("#trNext"); if (nxt) { nxt.hidden = false; nxt.focus(); }
    const b = bucket();
    b.total = (b.total || 0) + 1;
    if (ok) {
      b.ok = (b.ok || 0) + 1;
      if (it && it.id) b.ids[it.id] = 1;
    }
    save();
    S.session.total += 1;
    if (ok) S.session.ok += 1;
    renderProgress();
    const global = window.DQ;
    if (global) {
      global.award(ok ? 4 : 1);
      global.batch({
        answered: (global.stats.answered || 0) + 1,
        correct: (global.stats.correct || 0) + (ok ? 1 : 0),
        daily_answers: (global.stats.daily_answers || 0) + 1,
      });
    }
    if (window.DQSND) (ok ? window.DQSND.correct : window.DQSND.wrong)();
    if (window.DQFX) {
      if (ok) window.DQFX.confettiAt && window.DQFX.confettiAt($(".tr-card"));
      else window.DQFX.shake && window.DQFX.shake($(".tr-card"));
    }
  }

  function checkChoice(it) {
    if (S.pickedOpt == null) {
      const fb = $("#trFeedback");
      if (fb) { fb.className = "tr-feedback warn"; fb.textContent = "Сначала выберите вариант."; }
      return;
    }
    const want = S.skill === "wortschatz" && it.art ? it.answer : it.ru;
    const chosen = it.options[S.pickedOpt];
    $$("#trAnswer .tr-opt").forEach((b) => {
      const txt = it.options[Number(b.dataset.i)];
      if (txt === want) b.classList.add("correct");
      else if (Number(b.dataset.i) === S.pickedOpt) b.classList.add("wrong");
      b.disabled = true;
    });
    if (S.skill === "hoeren") {
      const after = `Фраза: „${esc(it.say)}“ — ${esc(it.ru)}`;
      mark(chosen === want, chosen === want ? "" : "Правильный ответ выделен.", after, it);
      say(it.say);
    } else {
      const extra = chosen === want ? "" : (it.art ? `Правильно: <b>${esc(want)} ${esc(it.word)}</b>` : `Правильно: <b>${esc(want)}</b>`);
      mark(chosen === want, "", extra, it);
    }
  }

  function checkReading(it) {
    const qs = it.questions || [];
    const picks = {};
    $$("#trAnswer .tr-q").forEach((qEl) => {
      const sel = $(".tr-opt.sel", qEl);
      if (sel) picks[qEl.dataset.q] = Number(sel.dataset.i);
    });
    if (Object.keys(picks).length < qs.length) {
      const fb = $("#trFeedback");
      if (fb) { fb.className = "tr-feedback warn"; fb.textContent = `Ответьте на все вопросы (${Object.keys(picks).length} из ${qs.length}).`; }
      return;
    }
    let right = 0;
    $$("#trAnswer .tr-q").forEach((qEl) => {
      const qi = Number(qEl.dataset.q);
      const q = qs[qi];
      const pick = picks[qi];
      $$(".tr-opt", qEl).forEach((b) => {
        const txt = q.options[Number(b.dataset.i)];
        if (txt === q.answer) b.classList.add("correct");
        else if (Number(b.dataset.i) === pick) b.classList.add("wrong");
        b.disabled = true;
      });
      if (q.options[pick] === q.answer) right += 1;
    });
    mark(right === qs.length, `Верно ответов: ${right} из ${qs.length}.`, "", it);
  }

  function checkWords(it) {
    if (!S.picked.length) {
      const fb = $("#trFeedback");
      if (fb) { fb.className = "tr-feedback warn"; fb.textContent = "Соберите предложение из слов."; }
      return;
    }
    const built = S.picked.map((i) => it.words[i]).join(" ");
    const ok = normalize(built) === normalize(it.answer);
    /* подсветка: слова в пределах пары позиций */
    if (bindStage._update) bindStage._update();
    const target = it.answer.split(/\s+/);
    $$("#trBuild .tr-chip").forEach((chip, pos) => {
      const want = target[pos];
      const got = chip.textContent.trim();
      chip.classList.add(want && normalize(want) === normalize(got) ? "ok" : "bad");
    });
    $$("#trWords .tr-chip").forEach((c) => { c.disabled = true; });
    /* показываем решение во фразе целиком, если фраза не собрана */
    mark(ok, ok ? "" : `Правильно: <b>${esc(it.answer)}</b>`, ok || !it.hint ? "" : esc(it.hint), it);
  }

  function checkWrite(it) {
    const inp = $("#trInput");
    const val = inp ? inp.value : "";
    if (!String(val).trim()) {
      const fb = $("#trFeedback");
      if (fb) { fb.className = "tr-feedback warn"; fb.textContent = "Напишите перевод."; }
      return;
    }
    const ok = matchTranslation(val, it.answers || [it.answer]);
    const target = (it.answers || [it.answer])[0].split(/\s+/);
    const got = String(val).trim().split(/\s+/);
    const diff = target.map((w, i) => {
      const g = got[i] || "";
      return `<span class="${normalize(w) === normalize(g) ? "w-ok" : "w-bad"}">${esc(w)}</span>`;
    }).join(" ");
    if (inp) { inp.classList.add(ok ? "ok" : "bad"); inp.readOnly = true; }
    mark(ok, ok ? "" : "Смотрите разбор по словам:", `<div class="tr-diff">${diff}</div>${esc(it.hint || "")}`, it);
  }

  function showReview(it) {
    it = it || S.cur;
    const fb = $("#trFeedback");
    if (!fb || !it) return;
    S.showing = !S.showing;
    if (!S.showing) { fb.innerHTML = ""; return; }
    let answer = "";
    if (S.skill === "hoeren") answer = `${esc(it.say)} — ${esc(it.ru)}`;
    else if (S.skill === "wortschatz") answer = it.art ? `${it.answer} ${esc(it.word)}` : `${esc(it.word)} — ${esc(it.ru)}`;
    else if (S.skill === "lesen") answer = (it.questions || []).map((q) => `${esc(q.q)} → <b>${esc(q.answer)}</b>`).join("<br>");
    else if (S.skill === "schreiben") answer = `<b>${esc(it.type === "write" ? (it.answers || [])[0] : it.answer)}</b>`;
    fb.className = "tr-feedback review";
    fb.innerHTML = `<div class="tr-explain"><b>Разбор.</b> ${answer}${it.hint ? `<br><span class="muted small">${esc(it.hint)}</span>` : ""}</div>`;
  }

  function advance() {
    S.idx = (S.idx + 1) % Math.max(1, S.queue.length);
    renderStage();
  }

  /* ---------------- переключения ---------------- */
  function setLevel(lv) {
    if (!LEVELS.includes(lv)) return;
    S.level = lv;
    S.progress.__lastLevel = lv;
    save();
    S.session = { ok: 0, total: 0 };
    buildQueue();
    renderHead();
    renderStage();
    if (window.DQSND) window.DQSND.tap && window.DQSND.tap();
  }

  function setSkill(sk) {
    if (!SKILLS.includes(sk)) return;
    S.skill = sk;
    S.progress.__lastSkill = sk;
    save();
    S.session = { ok: 0, total: 0 };
    buildQueue();
    renderHead();
    renderStage();
    if (window.DQSND) window.DQSND.tap && window.DQSND.tap();
  }

  function resetProgress() {
    if (!window.confirm("Сбросить весь локальный прогресс раздела «Тренировка»?")) return;
    S.progress = {};
    S.session = { ok: 0, total: 0 };
    save();
    buildQueue();
    renderHead();
    renderStage();
    if (window.DQ) window.DQ.toast("Прогресс раздела сброшен", "ok");
  }

  /* ---------------- инициализация ---------------- */
  function init() {
    const stage = $("#trStage");
    if (!stage) return;
    const levelsBar = $("#trLevels");
    if (levelsBar) {
      $$("button", levelsBar).forEach((b) => { b.onclick = () => setLevel(b.dataset.level); });
    }
    const tabs = $("#trTabs");
    if (tabs) {
      $$("button", tabs).forEach((b) => { b.onclick = () => setSkill(b.dataset.skill); });
    }
    S.level = S.progress.__lastLevel && LEVELS.includes(S.progress.__lastLevel) ? S.progress.__lastLevel : "a1";
    S.skill = S.progress.__lastSkill && SKILLS.includes(S.progress.__lastSkill) ? S.progress.__lastSkill : "schreiben";
    buildQueue();
    renderHead();
    renderStage();
  }

  return {
    init,
    setLevel,
    setSkill,
    resetProgress,
    get level() { return S.level; },
    get skill() { return S.skill; },
  };
})();
