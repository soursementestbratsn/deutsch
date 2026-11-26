/* ============================================================
   Deutsch Quest — раздел «Тренировка» (Lernen).

   Уровни A0–B1 × 4 навыка:
     hoeren     — слушаем фразу (TTS) и выбираем перевод
     wortschatz — карточки: значение слова / артикль der·die·das
     lesen      — короткий текст + вопросы на понимание
     schreiben  — порядок слов из перемешанных слов / перевод фразы

   Данные лежат в web/train/data-<уровень>.js и грузятся через
   window.DQTrainData.levels[уровень][навык] = [ {...}, {...} ].

   Форматы заданий:
     hoeren:     { id, say, ru, options: [...] }
     wortschatz: { id, word, ru, options: [...] }
                 { art: true, id, word, answer: "der|die|das", options, ru }
     lesen:      { id, title, text, questions: [{ q, options, answer }] }
     schreiben:  { id, type: "words", ru, answer, words: [...], hint }
                 { id, type: "write", ru, answers: [...], hint }

   Прогресс — localStorage (ключ dq.train.v1), серверная статистика
   (XP, ответы) — через DQ.award / DQ.batch, как в играх.
   ============================================================ */
"use strict";

window.DQTrain = (function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Случайная перестановка (Fisher–Yates). */
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const LEVELS = ["a0", "a1", "a2", "b1"];
  const LV_META = {
    a0: { name: "A0", title: "Erste Schritte", ru: "Старт: слова и простые фразы" },
    a1: { name: "A1", title: "Grundstufe", ru: "База: быт, магазин, транспорт, документы" },
    a2: { name: "A2", title: "Aufbaustufe", ru: "Продвинутая база: придаточные, Perfekt" },
    b1: { name: "B1", title: "Mittelstufe", ru: "Работа, договоры, письма, аргументы" },
  };
  const LV_TIP = {
    a0: "Начните здесь, если только начинаете: приветствия, знакомство, числа.",
    a1: "Для повседневки: магазин, транспорт, врач, документы.",
    a2: "Дальше: придаточные с weil/dass, Perfekt, падежи.",
    b1: "Работа и официальный язык: письма, договоры, аргументы.",
  };
  const SKILLS = ["hoeren", "wortschatz", "lesen", "schreiben"];
  const SKILL_TITLE = { hoeren: "Hören", wortschatz: "Wortschatz", lesen: "Lesen", schreiben: "Schreiben" };
  const SKILL_RU = { hoeren: "Аудирование", wortschatz: "Словарь", lesen: "Чтение", schreiben: "Письмо" };
  const SKILL_SUB = {
    hoeren: "Слушаем фразу и выбираем, что было сказано. Фраза читается вслух — есть повтор и медленный режим.",
    wortschatz: "Значения слов, артикли der · die · das и слова в контексте предложения.",
    lesen: "Короткий текст, объявление или письмо и вопросы на понимание.",
    schreiben: "Собираем фразы из слов и переводим. Главный блок A1–A2: порядок слов, падежи, модальные глаголы.",
    mix: "Всё сразу: по одному заданию из каждого навыка — хорошая разминка на 5 минут.",
  };
  const SKILL_ICON = {
    hoeren: "ico-vol",
    wortschatz: "ico-bulb",
    lesen: "ico-book",
    schreiben: "ico-pen",
    mix: "ico-repeat",
  };
  const STORE_KEY = "dq.train.v1";
  const ROUND = 8;      // столько заданий в круге
  const DAILY = 15;     // дневная цель по заданию

  /* ---------------- состояние ---------------- */
  const S = {
    level: "a1",
    skill: "schreiben",
    queue: [],
    idx: 0,
    cur: null,
    curSkill: null,    // для режима «микс» — навык конкретного задания
    picked: [],        // индексы выбранных слов (words)
    pickedOpt: null,   // индекс выбранного варианта (choice)
    checked: false,
    review: false,
    streak: 0,
    session: { ok: 0, total: 0 },
    today: { day: "", ok: 0 },
    progress: {},
    welcome: false,
  };

  /* ---------------- localStorage ---------------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return data && typeof data === "object" ? data : {};
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
  function dayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function loadToday() {
    S.today = { day: dayKey(), ok: 0 };
    const t = S.progress.__today;
    if (t && t.day === S.today.day && Number.isFinite(t.ok)) S.today = { day: t.day, ok: Math.max(0, t.ok) };
    else S.progress.__today = S.today;
  }

  /* ---------------- утилиты ---------------- */
  const normalize = (s) => String(s || "")
    .trim().toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[.,!?;:„“"'’]+/g, "")
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

  /** Сравнение перевода: регистр/пунктуация не важны, 1–2 опечатки прощаются. */
  function matchTranslation(user, answers) {
    const got = normalize(user);
    if (!got) return false;
    return answers.some((a) => {
      const want = normalize(a);
      if (got === want) return true;
      const limit = want.length <= 12 ? 1 : want.length <= 30 ? 2 : 3;
      return editDistance(got, want) <= limit;
    });
  }

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function say(text, slow) {
    if (!text) return;
    if (window.DQVoice) { window.DQVoice.say(text, "de", { slow: !!slow, forceBrowser: true }); return; }
    if (window.DQ && window.DQ.speak) window.DQ.speak(text, "de");
  }
  function snd(name) {
    if (!window.DQSND) return;
    const f = window.DQSND[name];
    if (typeof f === "function") { try { f(); } catch (e) { } }
  }

  /* ---------------- данные ---------------- */
  function data(level = S.level, skill = S.skill) {
    const all = (window.DQTrainData && window.DQTrainData.levels) || {};
    if (skill === "mix") {
      return SKILLS.flatMap((sk) => (Array.isArray(all[level] && all[level][sk]) ? all[level][sk].map((x) => Object.assign({ _sk: sk }, x)) : []));
    }
    const arr = all[level] && all[level][skill];
    return Array.isArray(arr) ? arr : [];
  }

  /** Круг: сначала нерешённые, потом остальные, максимум ROUND. */
  function buildQueue() {
    const items = data();
    const ids = bucket().ids;
    const fresh = items.filter((x) => !ids[x.id]);
    const rest = items.filter((x) => ids[x.id]);
    S.queue = [...shuffle(fresh), ...shuffle(rest)].slice(0, Math.max(1, Math.min(items.length, ROUND)));
    S.queue = S.queue.map(mixOptions);
    S.idx = 0;
  }

  /**
   * В контенте (web/train/data-*.js) варианты лежат с верным первым:
   * без перемешивания почти все ответы были бы «кнопкой №1».
   * Здесь перемешиваем на старте каждого задания и сохраняем answer.
   */
  function mixOptions(item) {
    const it = { ...item };
    if (Array.isArray(it.options) && it.options.length) {
      // верный ответ: явный answer, а у словаря без answer — первый вариант
      const answer = it.answer || it.options[0];
      it.options = shuffle(it.options);
      it.answer = answer;
    }
    if (Array.isArray(it.questions)) {
      it.questions = it.questions.map((q) => ({ ...q, options: shuffle(q.options || []) }));
    }
    return it;
  }

  /* ============================================================
     РЕНДЕР
     ============================================================ */

  /* ---------- шапка раздела: уровни + навыки + прогресс ---------- */
  function renderHead() {
    const bar = $("#trLevels");
    if (bar) {
      bar.innerHTML = LEVELS.map((lv) => {
        const total = SKILLS.reduce((n, sk) => n + data(lv, sk).length, 0);
        const ok = SKILLS.reduce((n, sk) => n + (((S.progress[lv] || {})[sk] || {}).ok || 0), 0);
        return `<button data-level="${lv}" class="${lv === S.level ? "active" : ""}${lv === "a1" || lv === "a2" ? " core" : ""}">
          <b>${LV_META[lv].name}</b>
          <small>${ok}/${total}</small>
        </button>`;
      }).join("");
      $$("button", bar).forEach((b) => { b.onclick = () => setLevel(b.dataset.level); });
    }

    const tabs = $("#trTabs");
    if (tabs) {
      const cards = SKILLS.map((sk) => {
        const n = data(S.level, sk).length;
        const b = (S.progress[S.level] || {})[sk] || {};
        const pct = n ? Math.round((Math.min(b.ok || 0, n) / n) * 100) : 0;
        return `<button data-skill="${sk}" class="${sk === S.skill ? "active" : ""}">
          <span class="ico ${SKILL_ICON[sk]}"></span>
          <span class="tr-tab-main">
            <b>${SKILL_TITLE[sk]}</b>
            <em>${SKILL_RU[sk]}</em>
          </span>
          <span class="tr-tab-n">${n}</span>
          <i class="tr-tab-prog" style="--p:${pct}%"></i>
        </button>`;
      }).join("");
      const mixN = SKILLS.reduce((n, sk) => n + data(S.level, sk).length, 0);
      const mix = `<button data-skill="mix" class="tr-mix ${S.skill === "mix" ? "active" : ""}">
        <span class="ico ${SKILL_ICON.mix}"></span>
        <span class="tr-tab-main"><b>Микс</b><em>всё по кругу</em></span>
        <span class="tr-tab-n">${mixN}</span>
      </button>`;
      tabs.innerHTML = cards + mix;
      $$("button", tabs).forEach((b) => { b.onclick = () => setSkill(b.dataset.skill); });
    }

    const sub = $("#trSkillSub");
    if (sub) sub.innerHTML = `<b>${SKILL_TITLE[S.skill]} · ${LV_META[S.level].name}</b> — ${esc(SKILL_SUB[S.skill] || "")}`;

    renderSide();
  }

  /* ---------- боковая панель: цель дня, сессия, прогресс ---------- */
  function renderSide() {
    const box = $("#trSide");
    if (!box) return;
    const goalPct = Math.max(0, Math.min(100, Math.round((S.today.ok / DAILY) * 100)));
    const goalN = Math.min(S.today.ok, DAILY);
    const s = S.session;
    const acc = s.total ? Math.round((s.ok / s.total) * 100) + "%" : "—";

    const rows = LEVELS.map((lv) => {
      const cells = SKILLS.map((sk) => {
        const b = (S.progress[lv] || {})[sk] || {};
        const total = data(lv, sk).length;
        const ok = Math.min(b.ok || 0, total);
        const pct = total ? Math.round((ok / total) * 100) : 0;
        const cur = lv === S.level && sk === S.skill;
        return `<button class="tr-pc${cur ? " cur" : ""}" data-lv="${lv}" data-sk="${sk}" title="${SKILL_TITLE[sk]} ${lv.toUpperCase()}: ${ok} из ${total}">
          <i style="--p:${pct}%"></i><em>${SKILL_TITLE[sk].slice(0, 3)}</em>
        </button>`;
      }).join("");
      return `<div class="tr-pr-row${lv === S.level ? " cur" : ""}">
        <span class="tr-pr-lv">${LV_META[lv].name}</span>
        <div class="tr-pr-cells">${cells}</div>
      </div>`;
    }).join("");

    box.innerHTML = `
      <div class="tr-goal">
        <div class="tr-goal-ring" style="--p:${goalPct}%"><b>${goalN}</b><small>/${DAILY}</small></div>
        <div class="tr-goal-txt"><span>Цель дня</span><b>${S.today.ok >= DAILY ? "готово" : goalPct + "%"}</b></div>
      </div>
      <div class="tr-side-stats">
        <div><span>Серия</span><b>${S.streak}</b></div>
        <div><span>Сессия</span><b>${s.ok}/${s.total}</b></div>
        <div><span>Точность</span><b>${acc}</b></div>
      </div>
      <h3 class="tr-side-title">Прогресс по уровням</h3>
      ${rows}
      <button class="btn ghost small block tr-reset" id="trResetAll">Сбросить прогресс</button>`;

    $$(".tr-pc", box).forEach((b) => {
      b.onclick = () => { S.level = b.dataset.lv; S.skill = b.dataset.sk; S.progress.__lastLevel = S.level; S.progress.__lastSkill = S.skill; save(); S.session = { ok: 0, total: 0 }; buildQueue(); renderHead(); renderStage(); };
    });
    const r = $("#trResetAll", box);
    if (r) r.onclick = resetProgress;
  }

  /* ---------- карточка задания ---------- */
  function renderStage() {
    const stage = $("#trStage");
    if (!stage) return;
    if (!S.queue.length) {
      stage.innerHTML = `<div class="tr-card tr-empty-card">
        <div class="tr-empty-icon"><span class="ico ico-bulb"></span></div>
        <p>Для этого уровня и навыка пока нет заданий.</p>
        <p class="muted small">Добавить: web/train/data-${S.level}.js → массив «${S.skill}».</p>
      </div>`;
      return;
    }

    // приветственная карточка: показываем раз в сессию
    if (S.welcome) { renderWelcome(); return; }

    const item = S.queue[S.idx % S.queue.length];
    // варианты уже перемешаны в mixOptions (верный больше не первый)
    if (item.options && !item.answer) item.answer = item.options[0];
    S.cur = item;
    S.picked = [];
    S.pickedOpt = null;
    S.checked = false;
    S.review = false;

    stage.innerHTML = `
      <div class="tr-card" data-kind="${S.skill}">
        ${renderCounter()}
        <div class="tr-prompt">${renderPrompt(item)}</div>
        <div class="tr-answer" id="trAnswer">${renderAnswer(item)}</div>
        <div class="tr-feedback" id="trFeedback"></div>
        <div class="tr-actions">
          <button class="btn ghost small" id="trHint"><span class="ico ico-bulb"></span> Показать разбор</button>
          <button class="btn ghost small" id="trSkip">Пропустить</button>
          <button class="btn primary" id="trCheck">Проверить</button>
          <button class="btn primary" id="trNext" hidden>Дальше →</button>
        </div>
      </div>`;
    bindStage(item);
    if (activeSkill() === "hoeren") setTimeout(() => say(item.say), 250);
  }

  /** Навык текущего задания (в режиме «микс» — у каждого задания свой). */
  function activeSkill(it) {
    const item = it || S.cur;
    return (item && item._sk) || S.skill;
  }

  /* ---------- приветственная карточка ---------- */
  function renderWelcome() {
    const stage = $("#trStage");
    const lv = LV_META[S.level];
    const perSkill = SKILLS.map((sk) => {
      const n = data(S.level, sk).length;
      const b = (S.progress[S.level] || {})[sk] || {};
      const pct = n ? Math.round((Math.min(b.ok || 0, n) / n) * 100) : 0;
      return `<li><span class="ico ${SKILL_ICON[sk]}"></span><b>${SKILL_TITLE[sk]}</b>
        <span class="w-n">${n} заданий</span><i class="w-bar"><i style="width:${pct}%"></i></i></li>`;
    }).join("");
    stage.innerHTML = `<div class="tr-card tr-welcome">
      <span class="tr-tag"><b>${lv.name}</b> · ${esc(lv.title)}</span>
      <h2 class="w-title">${esc(lv.ru)}</h2>
      <p class="w-tip">${esc(LV_TIP[S.level] || "")}</p>
      <ul class="w-list">${perSkill}</ul>
      <div class="w-tips">
        <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> — вариант</span>
        <span><kbd>S</kbd> — слушать</span>
        <span><kbd>H</kbd> — разбор</span>
        <span><kbd>Enter</kbd> — проверить / дальше</span>
      </div>
      <div class="tr-actions">
        <button class="btn primary" id="trStart">Начать · ${SKILL_RU[S.skill] || SKILL_TITLE[S.skill]}</button>
        <button class="btn ghost small" id="trStartMix">Микс всех навыков</button>
      </div>
      <p class="w-note muted small">Прогресс хранится в браузере (localStorage) — можно вернуться в любой момент.</p>
    </div>`;
    const st = $("#trStart");
    if (st) st.onclick = () => { S.welcome = false; renderStage(); };
    const mx = $("#trStartMix");
    if (mx) mx.onclick = () => { S.welcome = false; setSkill("mix"); };
  }

  function renderCounter() {
    const total = S.queue.length;
    const n = (S.idx % total) + 1;
    const dots = S.queue.map((_, i) => `<i class="${i < (S.idx % total) ? "done" : i === (S.idx % total) ? "now" : ""}"></i>`).join("");
    const sk = activeSkill();
    return `<div class="tr-topline">
      <span class="tr-tag">${S.skill === "mix" ? `<span class="tr-mix-badge">${SKILL_TITLE[sk]}</span>` : `<b>${SKILL_TITLE[sk]}</b>`} · ${LV_META[S.level].name} · ${n}/${total}</span>
      <div class="tr-dots">${dots}</div>
    </div>`;
  }

  function renderPrompt(it) {
    switch (activeSkill(it)) {
      case "hoeren":
        return `<div class="tr-audio">
            <button class="tr-play" id="trPlay" title="Слушать (S)"><span class="ico ico-vol"></span></button>
            <button class="tr-play slow" id="trPlaySlow" title="Медленно"><span class="ico ico-slow"></span></button>
            <span class="tr-note">Послушайте фразу и выберите верный перевод.</span>
          </div>`;
      case "wortschatz":
        if (it.custom === "context") {
          return `<div class="tr-word-box">
              <span class="tr-art-q">Вставьте слово</span>
              <div class="tr-sentence">${esc(it.sentence).replace("___", "<span class=\"tr-gap\">___</span>")}</div>
            </div>`;
        }
        if (it.art) {
          return `<div class="tr-word-box">
              <span class="tr-art-q">der · die · das</span>
              <div class="tr-word">${esc(it.word)}</div>
              <p class="tr-note">${esc(it.ru || "")} — какой артикль?</p>
            </div>`;
        }
        return `<div class="tr-word-box">
            <div class="tr-word">${esc(it.word)}</div>
            <p class="tr-note">Что это значит по-русски?</p>
          </div>`;
      case "lesen":
        return `<h3 class="tr-title">${esc(it.title)}</h3>
                <div class="tr-text" id="trText">${esc(it.text).replace(/\n/g, "<br>")}</div>`;
      case "schreiben":
        return `<div class="tr-ru-label">Переведите на немецкий</div>
                <div class="tr-ru">${esc(it.ru)}</div>
                <p class="tr-note">${it.type === "words" ? "Соберите предложение из слов ниже — порядок слов важен." : "Напишите фразу целиком."}</p>`;
      default: return "";
    }
  }

  function renderAnswer(it) {
    switch (activeSkill(it)) {
      case "hoeren":
      case "wortschatz":
        return `<div class="tr-opts">${(it.options || []).map((o, i) =>
          `<button class="tr-opt" data-i="${i}"><span class="opt-k">${i + 1}</span>${esc(o)}</button>`).join("")}</div>`;
      case "lesen":
        return `<div class="tr-qs">${(it.questions || []).map((q, qi) =>
          `<div class="tr-q" data-q="${qi}">
            <div class="tr-q-text"><span class="tr-q-n">${qi + 1}</span>${esc(q.q)}</div>
            <div class="tr-opts">${(q.options || []).map((o, oi) =>
            `<button class="tr-opt" data-q="${qi}" data-i="${oi}">${esc(o)}</button>`).join("")}</div>
          </div>`).join("")}</div>`;
      case "schreiben":
        return it.type === "words" ? renderWordBuilder(it) : renderWriting(it);
      default: return "";
    }
  }

  function renderWordBuilder(it) {
    return `
      <div class="tr-build" id="trBuild"><span class="tr-build-ph">Соберите фразу здесь…</span></div>
      <div class="tr-words" id="trWords">${(it.words || []).map((w, i) =>
      `<button class="tr-chip" data-i="${i}">${esc(w)}</button>`).join("")}</div>`;
  }

  function renderWriting() {
    return `<div class="tr-write-row">
      <input class="input tr-input" id="trInput" placeholder="Schreibe auf Deutsch…" autocomplete="off" spellcheck="false">
      <span class="tr-input-extra muted small">Enter — проверить · Shift+Enter — дальше</span>
    </div>`;
  }

  /* ---------- привязка событий к карточке ---------- */
  function bindStage(it) {
    const check = $("#trCheck"); if (check) check.onclick = () => doCheck(it);
    const hint = $("#trHint"); if (hint) hint.onclick = () => showReview(it);
    const next = $("#trNext"); if (next) next.onclick = () => advance();
    const skip = $("#trSkip"); if (skip) skip.onclick = () => advance(true);

    if (activeSkill(it) === "hoeren") {
      const p = $("#trPlay"); if (p) p.onclick = () => say(it.say);
      const ps = $("#trPlaySlow"); if (ps) ps.onclick = () => say(it.say, true);
    }

    $$("#trAnswer .tr-opt").forEach((b) => {
      b.onclick = () => {
        if (S.checked) return;
        if (activeSkill(it) === "lesen") {
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

    if (activeSkill(it) === "schreiben" && it.type === "words") bindWordBuilder(it);

    if (activeSkill(it) === "schreiben" && it.type === "write") {
      const inp = $("#trInput");
      if (inp) {
        inp.focus();
        inp.onkeydown = (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (!S.checked) doCheck(it);
          else if (e.shiftKey || true) advance();
        };
      }
    }
  }

  function bindWordBuilder(it) {
    const build = $("#trBuild");
    const update = () => {
      if (!S.picked.length) {
        build.innerHTML = `<span class="tr-build-ph">Соберите фразу здесь…</span>`;
      } else {
        build.innerHTML = S.picked.map((wi, pos) =>
          `<button class="tr-chip in" data-pos="${pos}">${esc(it.words[wi])}</button>`).join("");
      }
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
        snd("tap");
      };
    });
    bindWordBuilder.update = update;
  }

  /* ============================================================
     ПРОВЕРКА
     ============================================================ */
  function doCheck(it) {
    if (S.checked) return;
    const sk = activeSkill(it);
    if (sk === "hoeren" || sk === "wortschatz") return checkChoice(it);
    if (sk === "lesen") return checkReading(it);
    if (sk === "schreiben") return it.type === "words" ? checkWords(it) : checkWrite(it);
  }

  function mark(ok, msg, extra, it) {
    S.checked = true;
    S.streak = ok ? S.streak + 1 : 0;
    const fb = $("#trFeedback");
    if (fb) {
      fb.className = "tr-feedback " + (ok ? "ok" : "bad") + (extra ? " has-explain" : "");
      fb.innerHTML = `<div class="tr-fb-line"><span class="tr-fb-mark">${ok ? "Верно" : "Не так"}</span>${msg || ""}</div>${extra ? `<div class="tr-explain">${extra}</div>` : ""}`;
    }
    const chk = $("#trCheck"); if (chk) chk.hidden = true;
    const skp = $("#trSkip"); if (skp) skp.hidden = true;
    const nxt = $("#trNext"); if (nxt) { nxt.hidden = false; nxt.focus(); }

    const b = bucket();
    b.total = (b.total || 0) + 1;
    if (ok) { b.ok = (b.ok || 0) + 1; if (it && it.id) b.ids[it.id] = 1; }
    S.session.total += 1; if (ok) S.session.ok += 1;
    if (S.today.day !== dayKey()) loadToday();
    if (ok) S.today.ok += 1;
    S.today = { day: dayKey(), ok: S.today.ok };
    S.progress.__today = S.today;
    save();
    renderSide();

    const g = window.DQ;
    if (g) {
      g.award(ok ? 4 : 1);
      g.batch({
        answered: (g.stats.answered || 0) + 1,
        correct: (g.stats.correct || 0) + (ok ? 1 : 0),
        daily_answers: (g.stats.daily_answers || 0) + 1,
      });
    }
    snd(ok ? "correct" : "wrong");
    const card = $(".tr-card");
    if (window.DQFX && card) {
      if (ok && window.DQFX.confettiAt) window.DQFX.confettiAt(card);
      else if (!ok && window.DQFX.shake) window.DQFX.shake(card);
    }
  }

  function checkChoice(it) {
    if (S.pickedOpt == null) return warn("Сначала выберите вариант.");
    const want = activeSkill(it) === "wortschatz" && (it.art || it.custom === "context") ? it.answer
      : (it.answer || it.ru);
    const chosen = it.options[S.pickedOpt];
    // сравниваем по индексу: в вариантах бывают одинаковые строки (два раза «der»)
    const wantIdx = it.options.indexOf(want);
    $$("#trAnswer .tr-opt").forEach((b) => {
      const i = Number(b.dataset.i);
      if (i === wantIdx) b.classList.add("correct");
      else if (i === S.pickedOpt) b.classList.add("wrong");
      b.disabled = true;
    });
    if (activeSkill(it) === "hoeren") {
      mark(chosen === want, "", `<b>${esc(it.say)}</b> — ${esc(it.ru)}`, it);
      say(it.say);
    } else {
      const extra = chosen === want ? "" : `Правильно: <b>${esc(want)}</b>`;
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
    if (Object.keys(picks).length < qs.length) return warn(`Ответьте на все вопросы (${Object.keys(picks).length} из ${qs.length}).`);
    let right = 0;
    $$("#trAnswer .tr-q").forEach((qEl) => {
      const qi = Number(qEl.dataset.q);
      const q = qs[qi];
      const pick = picks[qi];
      const wi = q.options.indexOf(q.answer);
      $$(".tr-opt", qEl).forEach((b) => {
        const i = Number(b.dataset.i);
        if (i === wi) b.classList.add("correct");
        else if (i === pick) b.classList.add("wrong");
        b.disabled = true;
      });
      if (pick === wi) right += 1;
    });
    mark(right === qs.length, `Верных ответов: ${right} из ${qs.length}.`, "", it);
  }

  function checkWords(it) {
    if (!S.picked.length) return warn("Соберите предложение из слов.");
    const built = S.picked.map((i) => it.words[i]).join(" ");
    const ok = normalize(built) === normalize(it.answer);
    if (bindWordBuilder.update) bindWordBuilder.update();
    const target = it.answer.split(/\s+/);
    $$("#trBuild .tr-chip").forEach((chip, pos) => {
      const want = target[pos];
      const got = chip.textContent.trim();
      chip.classList.add(want && normalize(want) === normalize(got) ? "ok" : "bad");
    });
    $$("#trWords .tr-chip").forEach((c) => { c.disabled = true; });
    mark(ok, ok ? "" : `Правильно: <b>${esc(it.answer)}</b>`, ok || !it.hint ? "" : esc(it.hint), it);
  }

  function checkWrite(it) {
    const inp = $("#trInput");
    const val = inp ? inp.value : "";
    if (!String(val).trim()) return warn("Напишите перевод.");
    const ok = matchTranslation(val, it.answers || [it.answer]);
    const target = (it.answers || [it.answer])[0].split(/\s+/);
    const got = String(val).trim().split(/\s+/);
    const diff = target.map((w, i) => {
      const g = got[i] || "";
      return `<span class="${normalize(w) === normalize(g) ? "w-ok" : "w-bad"}">${esc(w)}</span>`;
    }).join(" ");
    if (inp) { inp.classList.add(ok ? "ok" : "bad"); inp.readOnly = true; }
    mark(ok, ok ? "" : "Разбор по словам:", `<div class="tr-diff">${diff}</div>${it.hint ? `<div class="tr-hint">${esc(it.hint)}</div>` : ""}`, it);
  }

  function warn(text) {
    const fb = $("#trFeedback");
    if (fb) { fb.className = "tr-feedback warn"; fb.textContent = text; }
  }

  function showReview(it) {
    it = it || S.cur;
    const fb = $("#trFeedback");
    if (!fb || !it) return;
    S.review = !S.review;
    if (!S.review) { fb.className = "tr-feedback"; fb.innerHTML = ""; return; }
    let answer = "";
    if (activeSkill(it) === "hoeren") answer = `<b>${esc(it.say)}</b> — ${esc(it.ru)}`;
    else if (activeSkill(it) === "wortschatz") {
      if (it.custom === "context") answer = it.sentence.replace("___", `<b>${esc(it.answer)}</b>`);
      else answer = it.art ? `<b>${it.answer} ${esc(it.word)}</b> — ${esc(it.ru || "")}` : `<b>${esc(it.word)}</b> — ${esc(it.ru)}`;
    }
    else if (activeSkill(it) === "lesen") answer = (it.questions || []).map((q, i) => `${i + 1}. ${esc(q.q)} → <b>${esc(q.answer)}</b>`).join("<br>");
    else if (activeSkill(it) === "schreiben") answer = `<b>${esc(it.type === "write" ? (it.answers || [])[0] : it.answer)}</b>`;
    fb.className = "tr-feedback review";
    fb.innerHTML = `<div class="tr-explain"><div class="tr-explain-head"><span class="ico ico-bulb"></span> Разбор</div>${answer}${it.hint ? `<div class="tr-hint">${esc(it.hint)}</div>` : ""}</div>`;
  }

  function advance(skip) {
    if (skip && S.cur && !S.checked) {
      const b = bucket();
      b.total = (b.total || 0) + 1;
      S.session.total += 1;
      S.streak = 0;
      save();
      renderSide();
    }
    S.idx = (S.idx + 1) % Math.max(1, S.queue.length);
    if (S.idx === 0) buildQueue();   // круг закончился — новый
    renderStage();
  }

  /* ---------------- переключения ---------------- */
  function setLevel(lv) {
    if (!LEVELS.includes(lv) || lv === S.level) return;
    S.level = lv; S.progress.__lastLevel = lv; save();
    S.session = { ok: 0, total: 0 };
    S.welcome = true;
    buildQueue(); renderHead(); renderStage();
    snd("tap");
  }
  function setSkill(sk) {
    if ((!SKILLS.includes(sk) && sk !== "mix") || sk === S.skill) return;
    S.skill = sk; S.progress.__lastSkill = sk; save();
    S.session = { ok: 0, total: 0 };
    buildQueue(); renderHead(); renderStage();
    snd("tap");
  }
  function resetProgress() {
    if (!window.confirm("Сбросить локальный прогресс раздела «Тренировка»?")) return;
    S.progress = {};
    S.session = { ok: 0, total: 0 };
    S.streak = 0;
    loadToday();
    save();
    buildQueue(); renderHead(); renderStage();
    if (window.DQ) window.DQ.toast("Прогресс раздела сброшен", "ok");
  }

  /* ---------------- инициализация ---------------- */
  function init() {
    const stage = $("#trStage");
    if (!stage) return;
    S.progress = load();
    loadToday();
    S.level = LEVELS.includes(S.progress.__lastLevel) ? S.progress.__lastLevel : "a1";
    S.skill = SKILLS.includes(S.progress.__lastSkill) || S.progress.__lastSkill === "mix" ? S.progress.__lastSkill : "schreiben";
    S.session = { ok: 0, total: 0 };
    S.streak = 0;
    S.welcome = !Object.keys(S.progress).some((k) => !k.startsWith("__"));
    buildQueue();
    renderHead();
    renderStage();
  }

  /* горячие клавиши, работают только когда открыт раздел */
  document.addEventListener("keydown", (e) => {
    const view = $("#view-lernen");
    if (!view || !view.classList.contains("active")) return;
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) {
      if (e.key === "Escape") e.target.blur();
      return;
    }
    const it = S.cur;
    if (!it) return;
    if (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4") {
      const idx = Number(e.key) - 1;
      if (activeSkill(it) === "lesen" || S.checked) return;
      const opts = $$("#trAnswer .tr-opt");
      if (opts[idx]) { opts[idx].click(); e.preventDefault(); }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (S.checked) advance(); else doCheck(it);
    } else if (e.key.toLowerCase() === "s" && activeSkill(it) === "hoeren") {
      say(it.say);
    } else if (e.key.toLowerCase() === "h") {
      showReview(it);
    }
  });

  return {
    init, setLevel, setSkill, resetProgress,
    get level() { return S.level; },
    get skill() { return S.skill; },
  };
})();


