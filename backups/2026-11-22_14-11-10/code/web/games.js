/* ============================================================
   Deutsch Quest — восемь мини-игр из старого приложения:
   Скорость, Понимание на слух, Диктант, Слова по картинкам,
   Порядок слов, Анаграммы, Пары (память), Правда или ложь.
   ============================================================ */
"use strict";

window.DQGames = (function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const DQ = () => window.DQ || {};
  const q = () => DQ();

  /* ---------------- утилиты (те же правила, что в dq/core.py) ---------------- */
  const normalize = (s) => String(s || "").toLowerCase().trim()
    .replace(/ß/g, "ss")
    .replace(/[.,?!;:\-’'"]/g, " ")
    .split(/\s+/).filter(Boolean).join(" ");

  function editDistance(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function similarity(a, b) {
    a = normalize(a); b = normalize(b);
    if (!a || !b) return a === b ? 1 : 0;
    return 1 - editDistance(a, b) / Math.max(a.length, b.length);
  }

  function isTypoMatch(user, expected, maxDistance = 2) {
    const u = normalize(user), e = normalize(expected);
    if (!u || !e) return false;
    if (u === e) return true;
    const uw = u.split(" "), ew = e.split(" ");
    if (ew.length > 1) {
      if (uw.length !== ew.length) return false;
      return uw.every((w, i) => {
        const len = Math.max(w.length, ew[i].length);
        if (len <= 2) return w === ew[i];
        return editDistance(w, ew[i]) <= (len <= 6 ? 1 : maxDistance);
      });
    }
    if (uw.length !== 1) return false;
    const base = Math.max(u.length, e.length);
    if (base <= 2) return false;
    return editDistance(u, e) <= (base <= 6 ? 1 : maxDistance);
  }

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  /* «Без повторок» (настройка тренажёра): игры тоже идут по колоде,
     каждый вопрос — один раз, пока колода не кончится. Если набор
     подходящих вопросов сменился — колода собирается заново. */
  const draw = (select) => {
    const data = select();
    if (!data.length) return data[0];
    if (window.DQ && window.DQ.noRepeat && !window.DQ.noRepeat()) return pick(data);
    if (!G.deckById) G.deckById = {};
    const key = (typeof G.current === "string" ? G.current : (G.current && G.current.id)) || "_default";
    const sig = data.map((x) => JSON.stringify(x)).sort().join("|");
    let deckState = G.deckById[key];
    if (!deckState || deckState.sig !== sig || !deckState.left.length) {
      deckState = G.deckById[key] = { sig, left: shuffle(data) };
    }
    return deckState.left.shift();
  };
  const uniq = (arr) => Array.from(new Set(arr));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------------- единые звук + анимация для всех игр ---------------- */
  const SND = () => window.DQSND;
  const FX = () => window.DQFX;
  function sfx(name, el) {
    const s = SND();
    if (s && s[name]) s[name]();
    if (el && FX()) FX().pop(el, "fx-pop");
  }
  function sfxResult(ok, el) {
    const s = SND();
    if (ok) { s && s.correct(); }
    else { s && s.wrong(); }
    const f = FX();
    if (!f) return;
    if (ok) { if (el) { f.pop(el); f.confettiAt(el); } else f.confetti(); }
    else if (el) f.shake(el.parentElement || el);
  }

  /* ---------------- карточки игр ---------------- */
  const CATALOG = [
    {
      id: "speed", icon: "↯", color: "#3fa9ff", title: "Скорость",
      desc: "30 секунд на все ответы. Верный ответ — очки и +1 секунда, ошибка — −3 секунды и жизнь.",
      record: (g) => `Рекорд: ${g.best_speed || 0} очков`, pool: "pairs"
    },
    {
      id: "listen", icon: "◉", color: "#2ee6a8", title: "Понимание на слух",
      desc: "Слышишь только слово (без текста) и выбираешь, что это было. Немецкая озвучка.",
      record: (g) => `Верных ответов: ${g.listen || 0}`, pool: "pairs"
    },
    {
      id: "typing", icon: "⌨", color: "#8fd0ff", title: "Диктант: услышал — напиши",
      desc: "Слушаешь слово, число или номер телефона и пишешь его — по-немецки ИЛИ по-русски.",
      record: (g) => `Написано верно: ${g.typing || 0}`, pool: "typing"
    },
    {
      id: "images", icon: "▧", color: "#ff70a6", title: "Слова по картинкам",
      desc: "Показывается картинка слова — найди его название. Развивает ассоциации.",
      record: (g) => `Угадано: ${g.images || 0}`, pool: "emoji"
    },
    {
      id: "sentence", icon: "§", color: "#ffc44d", title: "Порядок слов",
      desc: "Собери немецкое предложение из кусочков в правильном порядке. Тренирует грамматику.",
      record: (g) => `Собранных фраз: ${g.sentence || 0}`, pool: "grammar"
    },
    {
      id: "anagram", icon: "⇄", color: "#a98bff", title: "Анаграммы",
      desc: "Перемешанные буквы — собери немецкое слово. Тренирует письмо и память.",
      record: (g) => `Решено всего: ${g.anagram || 0}`, pool: "pairs"
    },
    {
      id: "pairs", icon: "◫", color: "#7be0ad", title: "Пары (память)",
      desc: "«Найди пару»: немецкое слово и его перевод. Тренирует зрительную память.",
      record: (g) => `Побед: ${g.pairs || 0}`, pool: "pairs"
    },
    {
      id: "quiz", icon: "✓", color: "#3fa9ff", title: "Правда или ложь",
      desc: "Показывают слово и перевод — но перевод может быть неверным. Угадай, правда ли это.",
      record: (g) => `Верных ответов: ${g.quiz || 0}`, pool: "pairs"
    },
    // ---------------- НОВЫЕ ИГРЫ ----------------
    {
      id: "oddone", icon: "◐", color: "#ffb020", title: "Лишнее слово",
      desc: "Четыре переводов одного слова — три из них относятся к одной теме, одно лишнее. Найди чужое.",
      record: (g) => `Найдено лишних: ${g.oddone || 0}`, pool: "pairs"
    },
    {
      id: "chain", icon: "∞", color: "#7be0ad", title: "Цепочка",
      desc: "Последняя буква перевода — первая буква следующего слова. Держи цепочку как можно дольше.",
      record: (g) => `Лучшая цепочка: ${g.chain || 0}`, pool: "pairs"
    },
    {
      id: "flash", icon: "◷", color: "#a98bff", title: "Карточки-вспышки",
      desc: "Слово появляется на мгновение — успеваешь ли ты его узнать? Лестница времени: 1200 → 300 мс.",
      record: (g) => `Пройдено ступеней: ${g.flash || 0}`, pool: "pairs"
    },
    {
      id: "gender", icon: "⚑", color: "#ff70a6", title: "der · die · das",
      desc: "Определи род немецкого существительного. Ошибка возвращает слово в конец колоды.",
      record: (g) => `Верно определить: ${g.gender || 0}`, pool: "pairs"
    },
    {
      id: "letter", icon: "✎", color: "#8fd0ff", title: "Пропущенная буква",
      desc: "В немецком слове исчезла одна буква — вставь её на место и запомни написание.",
      record: (g) => `Собрано слов: ${g.letter || 0}`, pool: "pairs"
    },
    // ---------------- ОЗВУЧКА И ПРОИЗНОШЕНИЕ ----------------
    {
      id: "mic", icon: "◎", color: "#ff8fb8", title: "Микрофон",
      desc: "Показывается русское слово — произнеси его по-немецки вслух. Распознаёт речь и оценивает произношение.",
      record: (g) => `Сказано верно: ${g.mic || 0}`, pool: "pairs"
    },
    {
      id: "shadow", icon: "◍", color: "#9fe8ff", title: "Эхо",
      desc: "Слушай слово и повтори его вслух — тренировка слуха и говорения одновременно. Похожесть фраз оценивается.",
      record: (g) => `Повторено: ${g.shadow || 0}`, pool: "pairs"
    },
    {
      id: "dictation", icon: "◌", color: "#b4f24b", title: "Фразы на слух",
      desc: "Слышишь немецкую фразу (без текста) — собери её из слов. Тренирует понимание речи, а не отдельных слов.",
      record: (g) => `Фраз разобрано: ${g.dictation || 0}`, pool: "phrases"
    },
  ];

  const G = {
    data: { emoji: [], sentences: null },
    timer: null,
    deckById: {},        // «без повторок»: остатки колод по играм
  };

  const host = {
    body: () => $("#gBody"),
    hud: () => $("#gHud"),
    extra: () => $("#gExtra"),
    feedback: () => $("#gFeedback"),
  };

  function fb(text, kind = "") {
    const el = host.feedback();
    el.textContent = text || "";
    el.className = "game-feedback " + kind;
  }

  /* Защита от «хвостов» таймеров: рауід следующей игры планируется только
     если в окне всё ещё открыта ИМЕННО эта игра. */
  function later(owner, fn, ms) {
    setTimeout(() => {
      if (G.current === owner) fn();
    }, ms);
  }

  function setHud(items) {
    host.hud().innerHTML = items.map((it) => {
      if (it.bar !== undefined) {
        return `<div class="h-time-bar"><i style="width:${Math.max(0, Math.min(1, it.bar)) * 100}%"></i></div>`;
      }
      return `<div class="h-item">${it.html ? it.html : `<b class="h-val" style="color:${it.color || "var(--accent)"}">${esc(it.value)}</b>`}<span class="h-lbl">${esc(it.label || "")}</span></div>`;
    }).join("");
  }

  function record(key, value, mode, xp) {
    // локально тоже копим, иначе карточки «Рекорд/Верных» не обновятся до перезагрузки
    const D = q();
    D.stats.games = D.stats.games || {};
    if (key) {
      if (mode === "max") D.stats.games[key] = Math.max(Number(D.stats.games[key] || 0), Number(value) || 0);
      else D.stats.games[key] = Number(D.stats.games[key] || 0) + (Number(value) || 0);
    }
    fetch("/api/game/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, mode, xp: xp || 0 }),
    }).catch(() => { });
    q().renderGames?.();
  }

  function say(text, lang, opts) {
    const D = q();
    if (D.say) D.say(text, lang || "de", opts);
    else if (D.speak) D.speak(text, lang || "de");
    else if (D.audio) D.audio.play(text, lang || "de");
  }

  /* Карточка произношения под словом (IPA / слоги / по-русски). */
  function pron(de, opts) {
    const D = q();
    return D.pronCard ? D.pronCard(de, opts) : "";
  }

  /* Звуковые кнопки (▶ / 🐢) для любого текста. */
  function sayButtons(de, extra = "") {
    return `<div class="g-row" style="justify-content:center;gap:8px">
      <button class="btn ghost small" data-say="${encodeURIComponent(de)}"><span class="ico ico-vol"></span> Слушать ${extra}</button>
      <button class="btn ghost small" data-slow="${encodeURIComponent(de)}"><span class="ico ico-slow"></span> Медленно</button>
    </div>`;
  }

  function bindSay(root) {
    (root || document).querySelectorAll("[data-say],[data-slow]").forEach((b) => {
      b.onclick = () => {
        const de = decodeURIComponent(b.dataset.say || b.dataset.slow || "");
        say(de, "de", b.dataset.slow !== undefined ? { slow: true } : undefined);
        window.DQSND && window.DQSND.tap();
      };
    });
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  /* Распознавание речи с обработкой результата. */
  function listenOnce(onText, onDone) {
    if (!SR) { fb("Браузер не поддерживает распознавание речи — открой в Chrome или Edge", "bad"); onDone && onDone(); return null; }
    q().stopAudio?.();                       // микрофон и озвучка одновременно не работают
    const r = new SR();
    r.lang = "de-DE"; r.interimResults = false; r.maxAlternatives = 3; r.continuous = false;
    let got = false;
    r.onresult = (ev) => {
      const alts = [];
      const res = ev.results[0];
      for (let i = 0; i < res.length; i++) alts.push(res[i].transcript);
      got = true;
      onText(alts[0] || "", alts);
    };
    r.onerror = (e) => { if (e.error !== "aborted") fb(e.error === "not-allowed" ? "Нет доступа к микрофону" : "Не расслышал", "warn"); };
    r.onend = () => { if (!got) onDone && onDone(); };
    try { r.start(); } catch (e) { onDone && onDone(); }
    return r;
  }

  /* =========================================================
     СКОРОСТЬ — 30 секунд, 3 жизни
     ========================================================= */
  const speed = {};

  function speedStart() {
    const D = q();
    const pool = D.pairPool(80);
    if (!pool.length) { fb("Нет слов в выбранных группах", "bad"); return; }
    Object.assign(speed, { score: 0, time: 30, lives: 3, running: true, blocked: false, pool, queue: [] });
    fb("");
    speedTick();
    speedNext();
  }

  function speedTick() {
    if (!speed.running) return;
    speed.time = Math.max(0, speed.time - 0.1);
    setHud([
      { bar: speed.time / 30 },
      { value: speed.time.toFixed(1), label: "сек", color: "#3fa9ff" },
      { html: `<b class="lives">${"♥".repeat(Math.max(0, speed.lives))}</b>` },
      { html: `<b class="h-val" style="color:var(--accent)">${speed.score}</b><span class="h-lbl">очков</span>` },
    ]);
    if (speed.time <= 0) { speedFinish(); return; }
    G.timer = setTimeout(speedTick, 100);
  }

  function speedNext() {
    if (!speed.running) return;
    const askDe = q().direction === "de-ru";
    speed.current = draw(() => speed.pool);
    speed.blocked = false;
    const question = askDe ? speed.current[0] : speed.current[1];
    const answer = askDe ? speed.current[1] : speed.current[0];
    speed.answer = answer;
    const others = uniq(speed.pool.map((p) => (askDe ? p[1] : p[0])).filter((v) => normalize(v) !== normalize(answer)));
    const options = shuffle(uniq([answer, ...shuffle(others).slice(0, 3)]));
    host.body().innerHTML = `
      <div class="g-hint">${askDe ? "Выбери перевод" : "Выбери немецкое слово"}</div>
      <div class="g-big">${esc(question)}</div>
      <div class="g-row" id="speedOpts">
        ${options.map((o) => `<button class="g-tile small" style="min-width:180px">${esc(o)}</button>`).join("")}
      </div>`;
    Array.from($("#speedOpts").children).forEach((btn, i) => {
      btn.onclick = () => speedAnswer(btn, options[i]);
    });
    if (speed.current[0]) setTimeout(() => say(speed.current[0], "de"), 10);
  }

  function speedAnswer(btn, selected) {
    if (speed.blocked || !speed.running) return;
    speed.blocked = true;
    const ok = normalize(selected) === normalize(speed.answer);
    if (ok) {
      const points = Math.max(5, Math.floor(12 - speed.time / 4));
      speed.score += points;
      speed.time = Math.min(30, speed.time + 1);
      fb(`+${points} · ВЕРНО`, "ok");
      q().srs && q().srs.record(speed.current[0], true);
    } else {
      speed.lives -= 1;
      speed.time = Math.max(0, speed.time - 3);
      btn.classList.add("wrong");
      fb(`НЕТ: ${speed.answer}`, "bad");
      q().srs && q().srs.record(speed.current[0], false);
    }
    Array.from($("#speedOpts").children).forEach((b) => { b.disabled = true; });
    setHud([{ bar: speed.time / 30 }, { value: speed.time.toFixed(1), label: "сек", color: "#3fa9ff" },
    { html: `<b class="lives">${"♥".repeat(Math.max(0, speed.lives))}</b>` },
    { html: `<b class="h-val" style="color:var(--accent)">${speed.score}</b><span class="h-lbl">очков</span>` }]);
    if (speed.lives <= 0) { setTimeout(speedFinish, 600); return; }
    setTimeout(() => { if (speed.running) speedNext(); }, 260);
  }

  function speedFinish() {
    if (!speed.running) return;
    speed.running = false;
    clearTimeout(G.timer);
    const score = speed.score;
    record("speed", score, "max", Math.min(60, Math.floor(score / 2)));
    record("best_speed", score, "max", 0);
    host.body().innerHTML = `
      <div class="g-mid">Раунд окончен</div>
      <div class="g-big" style="color:var(--accent)">${score}</div>
      <div class="g-small">Жизней осталось: ${Math.max(0, speed.lives)}</div>
      <div class="g-actions">
        <button class="btn primary" id="speedAgain">ЕЩЁ РАУНД</button>
        <button class="btn ghost" id="speedBack">К ИГРАМ</button>
      </div>`;
    $("#speedAgain").onclick = () => open("speed");
    $("#speedBack").onclick = () => close();
    fb(`Рекорд: ${Math.max(score, q().stats.games?.best_speed || 0)} очков`, "info");
  }

  /* =========================================================
     ПОНИМАНИЕ НА СЛУХ — только звук, 4 варианта перевода
     ========================================================= */
  const listen = { score: 0, streak: 0, answered: false };

  function listenRound() {
    const pool = q().pairPool(120).filter((p) => p[0] && p[0].split(" ").length <= 4);
    if (!pool.length) { fb("Нет слов", "bad"); return; }
    listen.pair = draw(() => pool);
    listen.answered = false;
    const others = uniq(pool.map((p) => p[1]).filter((r) => normalize(r) !== normalize(listen.pair[1])));
    listen.options = shuffle(uniq([listen.pair[1], ...shuffle(others).slice(0, 3)]));
    // подсказка по длине — без спойлера (показываем только счётчик слогов)
    const syl = (q().pron(listen.pair[0]) || {}).syllables || [];
    host.body().innerHTML = `
      <div class="g-hint">Послушай и выбери перевод</div>
      ${syl.length ? `<div class="gm-legend">${syl.map(() => "<span>•</span>").join("")}<span>${syl.length} слог${syl.length === 1 ? "" : syl.length < 5 ? "а" : "ов"}</span></div>` : ""}
      <div class="g-row" style="justify-content:center;gap:8px">
        <button class="btn primary" id="listenPlay"><span class="ico ico-vol"></span> Повторить</button>
        <button class="btn ghost" id="listenSlow"><span class="ico ico-slow"></span> Медленно</button>
      </div>
      <div class="g-row" id="listenOpts">
        ${listen.options.map((o) => `<button class="g-tile" style="min-width:200px">${esc(o)}</button>`).join("")}
      </div>`;
    $("#listenPlay").onclick = () => say(listen.pair[0], "de");
    $("#listenSlow").onclick = () => say(listen.pair[0], "de", { slow: true });
    Array.from($("#listenOpts").children).forEach((btn, i) => { btn.onclick = () => listenAnswer(btn, listen.options[i]); });
    say(listen.pair[0], "de");
    listenHud();
  }

  function listenHud() {
    setHud([
      { value: listen.score, label: "верно" },
      { html: `<b class="h-val" style="color:var(--ok)">${listen.streak}</b><span class="h-lbl">серия</span>` },
    ]);
  }

  function listenAnswer(btn, selected) {
    if (listen.answered) return;
    listen.answered = true;
    const ok = normalize(selected) === normalize(listen.pair[1]);
    Array.from($("#listenOpts").children).forEach((b, i) => {
      b.disabled = true;
      if (normalize(listen.options[i]) === normalize(listen.pair[1])) b.classList.add("correct");
    });
    if (!ok) btn.classList.add("wrong");
    if (ok) {
      listen.score++; listen.streak++;
      q().award(10); record("listen", 1, "add");
      fb(`Верно! ${listen.pair[0]} — ${listen.pair[1]}`, "ok");
    } else {
      listen.streak = 0;
      fb(`Это было: ${listen.pair[0]} — ${listen.pair[1]}`, "bad");
    }
    // после ответа видно, как слово пишется и произносится
    if (!host.body().querySelector(".ph-card")) {
      host.body().insertAdjacentHTML("beforeend", pron(listen.pair[0], { compact: true }));
      window.DQPhon && window.DQPhon.bind(host.body());
    }
    listenHud();
    sfxResult(ok, btn);
    later("listen", listenRound, ok ? 1300 : 2200);
  }

  /* =========================================================
     ДИКТАНТ — услышал и написал
     ========================================================= */
  const typing = { score: 0, streak: 0, answered: false, playCount: 0 };

  function typingOpts() {
    return { lang: q().stats.typing_lang || "de", source: q().stats.typing_source || "все" };
  }

  function typingPool(source) {
    const D = q();
    if (source === "числа") return D.numberPool();
    if (source === "телефоны") return D.phonePool();
    if (source === "слова") return D.pairPool(400);
    return D.pairPool(400);
  }

  function typingRound() {
    const opts = typingOpts();
    const pool = typingPool(opts.source);
    if (!pool.length) { fb("Нет данных для диктанта", "bad"); return; }
    typing.answered = false; typing.playCount = 0;
    typing.item = draw(() => pool);

    const kind = typing.item.kind;
    if (kind === "phone") {
      typing.play = typing.item.de;
      typing.playLang = "de";
      typing.answer = typing.item.raw;
      typing.hint = "☎ Немецкий номер телефона — запиши цифрами, как услышишь";
    } else if (kind === "number") {
      typing.play = typing.item.de;
      typing.playLang = "de";
      typing.answer = opts.lang === "de" ? typing.item.de : typing.item.ru;
      typing.hint = opts.lang === "de"
        ? "Число по-немецки — напиши его словами (напр.: einundzwanzig)"
        : "Число по-немецки — напиши его цифрами";
    } else if (opts.lang === "de") {
      typing.play = typing.item[1]; typing.playLang = "ru";
      typing.answer = typing.item[0];
      typing.hint = "Слушай по-русски — напиши по-немецки";
    } else {
      typing.play = typing.item[0]; typing.playLang = "de";
      typing.answer = typing.item[1];
      typing.hint = "Слушай по-немецки — напиши перевод по-русски";
    }

    renderTyping();
    typingPlay();
    typingHud();
  }

  function typingHud() {
    setHud([
      { value: typing.score, label: "верно", color: "#8fd0ff" },
      { html: `<b class="h-val" style="color:var(--ok)">${typing.streak}</b><span class="h-lbl">серия</span>` },
    ]);
  }

  function renderTyping() {
    const opts = typingOpts();
    const srcOptions = [["все", "Всё"], ["числа", "Числа"], ["телефоны", "Телефоны"], ["слова", "Слова"]];
    host.extra().innerHTML = `
      <div class="segmented" id="typingLang">
        <button data-v="de" class="${opts.lang === "de" ? "active" : ""}">По-немецки</button>
        <button data-v="ru" class="${opts.lang === "ru" ? "active" : ""}">По-русски</button>
      </div>
      <div class="segmented" id="typingSrc">
        ${srcOptions.map(([v, t]) => `<button data-v="${v}" class="${opts.source === v ? "active" : ""}" style="font-size:12px;padding:7px 12px">${t}</button>`).join("")}
      </div>`;
    host.body().innerHTML = `
      <div class="g-hint">Слушай и напиши</div>
      <div class="g-row" style="justify-content:center;gap:8px">
        <button class="btn primary" id="typingPlay"><span class="ico ico-vol"></span> Повторить</button>
        <button class="btn ghost" id="typingSlow"><span class="ico ico-slow"></span> Медленно</button>
      </div>
      <div class="g-small" id="typingHint">${esc(typing.hint)}</div>
      <input class="g-input" id="typingInput" autocomplete="off" spellcheck="false" placeholder="…">
      <div class="g-actions">
        <button class="btn primary" id="typingCheck">ПРОВЕРИТЬ</button>
        <button class="btn ghost" id="typingShowHint">ПОДСКАЗКА</button>
        <button class="btn ghost" id="typingSkip">ПРОПУСТИТЬ</button>
      </div>`;
    $("#typingPlay").onclick = typingPlay;
    $("#typingSlow").onclick = () => say(typing.play, typing.playLang, { slow: true });
    $("#typingCheck").onclick = typingCheck;
    $("#typingSkip").onclick = typingRound;
    $("#typingShowHint").onclick = () => {
      const it = typing.item;
      const de = it[0] || it.de || "", ru = it[1] || it.ru || "";
      fb(`Подсказка: ${de} — ${ru}`, "info");
    };
    const input = $("#typingInput");
    input.onkeydown = (e) => {
      if (e.key === "Enter") { e.preventDefault(); typingCheck(); }
    };
    setTimeout(() => input.focus(), 40);
    $("#typingLang").querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        q().batch({ typing_lang: b.dataset.v });
        typingRound();
      };
    });
    $("#typingSrc").querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        q().batch({ typing_source: b.dataset.v });
        typingRound();
      };
    });
  }

  function typingPlay() {
    if (!typing.play) return;
    typing.playCount++;
    say(typing.play, typing.playLang);
  }

  function typingCheck() {
    if (typing.answered) return;
    const input = $("#typingInput");
    const user = input.value.trim();
    if (!user) { fb("Введи ответ", "warn"); return; }
    typing.answered = true;
    const expected = typing.answer;
    const exact = normalize(user) === normalize(expected) || user.replace(/\s+/g, "") === expected.replace(/\s+/g, "");
    const D = q();
    // та же строгость, что в тренажёре, и варианты ответа («с; из; имеющий»)
    const ok = exact || (D.matchAnswer ? D.matchAnswer(user, expected) : isTypoMatch(user, expected));
    const close = !ok && similarity(user, expected) > 0.85;
    input.disabled = true;
    input.classList.add(ok ? "ok" : "bad");
    const label = `${(typing.item[0] || typing.item.de)} — ${(typing.item[1] || typing.item.ru)}`;
    fb(label, "info");
    if (ok) {
      const points = 12 + typing.streak * 2;
      typing.score += points; typing.streak++;
      q().award(points); record("typing", 1, "add");
      fb(exact ? `ВЕРНО!  +${points} XP` : `ЗАСЧИТАНО С ОПЕЧАТКОЙ · верно: ${expected}  +${points} XP`, "ok");
      later("typing", typingRound, 1200);
    } else if (close) {
      fb(`ПОЧТИ! Правильно: ${expected}`, "warn");
      later("typing", typingRound, 1600);
    } else {
      typing.streak = 0;
      fb(`НЕВЕРНО. Правильно: ${expected}`, "bad");
      q().registerMistake?.(typing.item[0] || typing.item.de);
      later("typing", typingRound, 1600);
    }
    typingHud();
    sfxResult(ok, input);
  }

  /* =========================================================
     СЛОВА ПО КАРТИНКАМ — эмодзи вместо картинки
     ========================================================= */
  const images = { score: 0, streak: 0, answered: false };

  function imagePool() {
    const emoji = G.data.emoji || [];
    const D = q();
    if (D.loadGameData) D.loadGameData();      // числа/телефоны/эмодзи — фоном
    const words = q().pairPool(400);
    if (!emoji.length) return [];
    const known = new Map(emoji.map(([e, de, ru]) => [de.toLowerCase(), { emoji: e, de, ru }]));
    // те же группы, что выбраны в тренажёре: показываем только знакомые картинки
    const out = [];
    for (const [de, ru] of words) {
      const low = String(de).toLowerCase().replace(/^(der|die|das)\s+/, "").trim();
      const hit = known.get(low) || known.get(String(de).toLowerCase());
      if (hit) out.push({ de: hit.de, ru: hit.ru, emoji: hit.emoji, full: de });
    }
    return out.length ? out : emoji.map(([e, de, ru]) => ({ de, ru, emoji: e, full: de }));
  }

  function imagesRound() {
    const pool = imagePool();
    if (!pool.length) { fb("Нет картинок", "bad"); return; }
    // сверх эмодзи — настоящие картинки слов из images/ (если есть)
    images.answered = false;
    images.item = draw(() => pool);
    const others = uniq(pool.map((p) => p.de).filter((d) => d !== images.item.de));
    images.options = shuffle(uniq([images.item.de, ...shuffle(others).slice(0, 3)]));
    host.body().innerHTML = `
      <div class="g-hint">Что на картинке? Выбери слово</div>
      <div class="g-emoji">${images.item.emoji}</div>
      <div class="g-row" id="imageOpts">
        ${images.options.map((o) => `<button class="g-tile" style="min-width:180px">${esc(o)}</button>`).join("")}
      </div>`;
    Array.from($("#imageOpts").children).forEach((btn, i) => { btn.onclick = () => imagesAnswer(btn, images.options[i]); });
    say(images.item.de, "de");
    imagesHud();
  }

  function imagesHud() {
    setHud([
      { value: images.score, label: "очков", color: "#ff70a6" },
      { html: `<b class="h-val" style="color:var(--ok)">${images.streak}</b><span class="h-lbl">серия</span>` },
    ]);
  }

  function imagesAnswer(btn, selected) {
    if (images.answered) return;
    images.answered = true;
    const ok = selected === images.item.de;
    Array.from($("#imageOpts").children).forEach((b, i) => {
      b.disabled = true;
      if (images.options[i] === images.item.de) b.classList.add("correct");
    });
    if (!ok) btn.classList.add("wrong");
    const label = `${images.item.emoji}  ${images.item.de} — ${images.item.ru}`;
    if (ok) {
      images.score += 10; images.streak++;
      q().award(10); record("images", 1, "add");
      fb(`Верно! ${label}`, "ok");
    } else {
      images.streak = 0;
      fb(`Это было: ${label}`, "bad");
    }
    say(images.item.de, "de");
    imagesHud();
    sfxResult(ok, btn);
    later("images", imagesRound, ok ? 1100 : 1700);
  }

  /* =========================================================
     ПОРЯДОК СЛОВ — собрать предложение из кусочков
     ========================================================= */
  const sentence = { score: 0, streak: 0, answered: false, slots: [], available: [] };

  function sentenceRound() {
    const templates = (G.data.sentences && G.data.sentences.templates) || [];
    const pool = q().numberPool();
    if (!templates.length) { fb("Грамматика недоступна", "bad"); return; }
    const tpl = pick(templates);
    let parts = tpl.parts.slice();
    let ru = tpl.ru;
    if (tpl.range) {
      const n = kindsNumber(pool, tpl.range);
      parts = parts.map((p) => p.replace("{zahl}", n.de).replace("{uhr}", n.de));
      ru = ru.replace("{zahl_ru}", String(n.n)).replace("{uhr}", String(n.n));
    }
    const answer = parts.join(" ");
    const extra = [];
    if (q().stats.sentence_distractors) {
      const used = new Set(parts.map((p) => p.toLowerCase()));
      const free = (G.data.sentences.distractors || []).filter((w) => !used.has(w));
      extra.push(...shuffle(free).slice(0, 1 + Math.floor(Math.random() * 2)));
    }
    let shuffled = shuffle(parts);
    if (shuffled.length > 1 && shuffled.join(" ") === answer) shuffled = shuffle(parts);
    Object.assign(sentence, {
      task: { parts, ru, answer, rule: tpl.rule },
      slots: new Array(parts.length).fill(null),
      available: [...shuffled, ...extra],
      answered: false,
    });
    fb("");
    sentenceRender();
    sentenceHud();
    say(answer, "de");
  }

  function kindsNumber(numberPool, range) {
    const [lo, hi] = range;
    const fit = numberPool.filter((n) => n.n >= lo && n.n <= hi);
    return fit.length ? pick(fit) : numberPool[0];
  }

  function sentenceHud() {
    setHud([
      { value: sentence.score, label: "очков", color: "#ffc44d" },
      { html: `<b class="h-val" style="color:var(--ok)">${sentence.streak}</b><span class="h-lbl">серия</span>` },
    ]);
    host.extra().innerHTML = `
      <div class="segmented" id="sentDistr">
        <button data-v="0" class="${q().stats.sentence_distractors ? "" : "active"}">Без лишних слов</button>
        <button data-v="1" class="${q().stats.sentence_distractors ? "active" : ""}">С лишними словами</button>
      </div>`;
    $("#sentDistr").querySelectorAll("button").forEach((b) => {
      b.onclick = () => { q().batch({ sentence_distractors: b.dataset.v === "1" }); sentenceRound(); };
    });
  }

  function sentenceRender() {
    const slots = sentence.slots.map((c, i) =>
      c ? `<div class="slot chunk" data-slot="${i}">${esc(c)}</div>` : `<div class="slot empty">…</div>`).join("");
    const pool = sentence.available.map((c, i) =>
      c ? `<button class="g-tile small" data-pool="${i}">${esc(c)}</button>` : "").join("");
    host.body().innerHTML = `
      <div class="g-hint">Собери предложение</div>
      <div class="g-mid">${esc(sentence.task.ru)}</div>
      <div class="g-rule"><span class="ico ico-bulb"></span> ${esc(sentence.task.rule)}</div>
      <div class="slots" id="sentSlots">${slots}</div>
      <div class="g-row" id="sentPool">${pool}</div>
      <div class="g-actions">
        <button class="btn primary" id="sentCheck">ПРОВЕРИТЬ</button>
        <button class="btn ghost" id="sentReset">СБРОСИТЬ</button>
        <button class="btn ghost" id="sentHint">ПОДСКАЗКА</button>
        <button class="btn ghost" id="sentNext">ДАЛЬШЕ</button>
      </div>`;
    $("#sentSlots").querySelectorAll("[data-slot]").forEach((el) => {
      el.onclick = () => {
        if (sentence.answered) return;
        const i = +el.dataset.slot;
        const chunk = sentence.slots[i];
        const empty = sentence.available.indexOf(null);
        if (empty >= 0) sentence.available[empty] = chunk;
        else sentence.available.push(chunk);
        sentence.slots[i] = null;
        sentenceRender();
      };
    });
    $("#sentPool").querySelectorAll("[data-pool]").forEach((el) => {
      el.onclick = () => {
        if (sentence.answered) return;
        const i = +el.dataset.pool;
        const free = sentence.slots.indexOf(null);
        if (free < 0) { q().toast("Все клетки заняты — убери лишнее", "bad"); return; }
        sentence.slots[free] = sentence.available[i];
        sentence.available[i] = null;
        sentenceRender();
      };
    });
    $("#sentCheck").onclick = sentenceCheck;
    $("#sentReset").onclick = () => {
      if (sentence.answered) return;
      sentence.available = [...sentence.slots.filter(Boolean), ...sentence.available.filter(Boolean)];
      sentence.slots = new Array(sentence.slots.length).fill(null);
      sentenceRender();
    };
    $("#sentHint").onclick = () => {
      fb(`Правильно: ${sentence.task.answer}`, "info");
      say(sentence.task.answer, "de");
    };
    $("#sentNext").onclick = sentenceRound;
  }

  function sentenceCheck() {
    if (sentence.answered) return;
    if (sentence.slots.some((v) => v === null)) { q().toast("Заполни все клетки", "bad"); return; }
    sentence.answered = true;
    const guess = sentence.slots.filter(Boolean).join(" ");
    const correct = normalize(guess) === normalize(sentence.task.answer);
    if (correct) {
      const points = 15 + sentence.streak * 3;
      sentence.score += points; sentence.streak++;
      q().award(points); record("sentence", 1, "add");
      fb(`ВЕРНО!  +${points} XP`, "ok");
      say(sentence.task.answer, "de");
      later("sentence", sentenceRound, 1500);
    } else {
      sentence.streak = 0;
      fb(`НЕВЕРНО. Правильно: ${sentence.task.answer}`, "bad");
      later("sentence", sentenceRound, 2000);
    }
    sentenceHudOnly();
    sfxResult(correct, $("#sentPool"));
  }

  function sentenceHudOnly() {
    setHud([
      { value: sentence.score, label: "очков", color: "#ffc44d" },
      { html: `<b class="h-val" style="color:var(--ok)">${sentence.streak}</b><span class="h-lbl">серия</span>` },
    ]);
  }

  /* =========================================================
     АНАГРАММЫ — собрать слово из букв
     ========================================================= */
  const anagram = { solved: 0, rounds: 0, slots: [], letters: [] };

  function anagramRound() {
    const pool = q().pairPool(400).filter(([de]) => {
      const clean = String(de).replace(/[-\s]/g, "");
      return /^[A-Za-zÄÖÜäöüß]+$/.test(clean) && clean.length >= 3 && clean.length <= 12;
    });
    if (!pool.length) { fb("Нет подходящих слов", "bad"); return; }
    anagram.item = draw(() => pool);
    anagram.rounds++;
    anagram.word = anagram.item[0];
    anagram.letters = shuffle(anagram.word.split(""));
    if (anagram.letters.length > 1 && anagram.letters.join("") === anagram.word) anagram.letters = shuffle(anagram.letters);
    anagram.slots = new Array(anagram.letters.length).fill(null);
    fb("");
    anagramRender();
    anagramHud();
  }

  function anagramHud() {
    setHud([
      { value: anagram.solved, label: "решено", color: "#a98bff" },
      { value: "Раунд " + anagram.rounds, label: "" },
    ]);
  }

  function anagramRender() {
    const slots = anagram.slots.map((c, i) => c
      ? `<button class="slot chunk" data-slot="${i}">${esc(c)}</button>`
      : `<div class="slot empty" data-slot="${i}">·</div>`).join("");
    const letters = anagram.letters.map((c, i) => c
      ? `<button class="letter" data-letter="${i}">${esc(c)}</button>` : `<div class="letter" style="visibility:hidden"></div>`).join("");
    host.body().innerHTML = `
      <div class="g-hint">Переведи слово</div>
      <div class="g-big">${esc(anagram.item[1])}</div>
      <div class="g-small">Собери немецкое слово</div>
      <div class="slots" id="anaSlots">${slots}</div>
      <div class="letters" id="anaLetters">${letters}</div>
      <div class="g-actions">
        <button class="btn primary" id="anaCheck">ПРОВЕРИТЬ</button>
        <button class="btn ghost" id="anaSkip">ПРОПУСТИТЬ</button>
        <button class="btn ghost" id="anaHint">ПОДСКАЗКА</button>
      </div>`;
    $("#anaSlots").querySelectorAll("[data-slot]").forEach((el) => {
      el.onclick = () => {
        const i = +el.dataset.slot;
        const ch = anagram.slots[i];
        if (!ch) return;
        const free = anagram.letters.indexOf(null);
        if (free >= 0) anagram.letters[free] = ch;
        else anagram.letters.push(ch);
        anagram.slots[i] = null;
        anagramRender();
      };
    });
    $("#anaLetters").querySelectorAll("[data-letter]").forEach((el) => {
      el.onclick = () => {
        const i = +el.dataset.letter;
        const free = anagram.slots.indexOf(null);
        if (free < 0) return;
        anagram.slots[free] = anagram.letters[i];
        anagram.letters[i] = null;
        anagramRender();
      };
    });
    $("#anaCheck").onclick = anagramCheck;
    $("#anaSkip").onclick = anagramRound;
    $("#anaHint").onclick = () => fb(`Подсказка: ${anagram.word[0].toUpperCase()}… (${anagram.word.length} букв)`, "info");
  }

  function anagramCheck() {
    if (anagram.slots.some((v) => v === null)) { fb("Собери все буквы", "warn"); return; }
    const guess = anagram.slots.join("");
    if (guess.toLowerCase() === anagram.word.toLowerCase()) {
      anagram.solved++;
      q().award(10); record("anagram", 1, "add");
      fb("ВЕРНО!  +10 XP", "ok");
      anagramHud();
      sfxResult(true, $("#anaSlots"));
      later("anagram", anagramRound, 900);
    } else {
      fb(`НЕ ТО. Ответ: ${anagram.word}`, "bad");
      sfxResult(false, $("#anaSlots"));
      q().registerMistake?.(anagram.word);
      later("anagram", anagramRound, 1300);
    }
  }

  /* =========================================================
     ПАРЫ (ПАМЯТЬ) — 4×4 / 6×6 / 8×8
     ========================================================= */
  const pairs = { cards: [], open: [], matched: 0, moves: 0, busy: false, size: 4 };

  function pairsNew(size) {
    pairs.size = size || pairs.size || 4;
    const need = (pairs.size * pairs.size) / 2;
    let pool = uniq(q().pairPool(800)).filter(([de]) => String(de).length < 18);
    if (pool.length < need) pool = uniq(q().pairPool(800));
    const chosen = shuffle(pool).slice(0, need);
    if (chosen.length < need) {
      q().toast(`Для поля ${pairs.size}×${pairs.size} нужно ${need} слов, а в выбранных группах только ${chosen.length}. Выберите больше групп.`, "bad");
      pairs.size = Math.max(4, Math.floor(Math.sqrt(chosen.length * 2)));
      return pairsNew(pairs.size);
    }
    const cards = [];
    chosen.forEach(([de, ru]) => {
      cards.push({ key: de, text: de, kind: "de" });
      cards.push({ key: de, text: ru, kind: "ru" });
    });
    Object.assign(pairs, { cards: shuffle(cards), open: [], matched: 0, moves: 0, busy: false });
    fb("");
    pairsRender();
  }

  function pairsRender() {
    const n = pairs.size;
    host.extra().innerHTML = `
      <div class="segmented" id="pairsSize">
        ${[[4, "4×4 легко"], [6, "6×6 средне"], [8, "8×8 сложно"]].map(([s, t]) =>
      `<button data-s="${s}" class="${pairs.size === s ? "active" : ""}" style="font-size:12px;padding:7px 12px">${t}</button>`).join("")}
      </div>`;
    $("#pairsSize").querySelectorAll("button").forEach((b) => {
      b.onclick = () => pairsNew(+b.dataset.s);
    });
    const open = pairs.open;
    const cardsHtml = pairs.cards.map((c, i) => {
      const isOpen = open.includes(i) || c.done;
      let cls = "mem-card";
      if (c.done) cls += " done";
      else if (isOpen) cls += c.kind === "de" ? " de" : " ru";
      const text = isOpen ? c.text : "?";
      return `<button class="${cls}" data-i="${i}" style="font-size:${n > 4 ? 11 : 14}px">${esc(text)}</button>`;
    }).join("");
    setHud([
      { value: pairs.moves, label: "ходов", color: "#7be0ad" },
      { value: pairs.cards.length / 2 - pairs.matched, label: "осталось пар" },
    ]);
    host.body().innerHTML = `
      <div class="memory" style="--cols:${n}; --cell:${n >= 8 ? 54 : n >= 6 ? 62 : 76}px">${cardsHtml}</div>`;
    host.body().querySelectorAll("[data-i]").forEach((el) => {
      el.onclick = () => pairsFlip(+el.dataset.i);
    });
  }

  function pairsFlip(i) {
    if (pairs.busy || pairs.open.includes(i) || pairs.cards[i].done) return;
    pairs.open.push(i);
    if (pairs.cards[i].kind === "de") say(pairs.cards[i].text, "de");
    if (pairs.open.length < 2) { pairsRender(); return; }
    pairs.moves++;
    pairs.busy = true;
    const [a, b] = pairs.open;
    if (pairs.cards[a].key === pairs.cards[b].key && pairs.cards[a].kind !== pairs.cards[b].kind) {
      pairs.cards[a].done = true;
      pairs.cards[b].done = true;
      pairs.matched++;
      pairs.open = [];
      pairs.busy = false;
      q().award(8); record("pairs", 1, "add");
        pairsRender();
        if (pairs.matched >= pairs.cards.length / 2) pairsWin();
      } else {
        pairsRender();
        if (SND()) SND().miss();
        setTimeout(() => { pairs.open = []; pairs.busy = false; pairsRender(); }, 800);
      }
  }

  function pairsWin() {
    const bonus = Math.max(0, 60 - pairs.moves * 2);
    q().award(bonus);
    q().toast(`Все пары найдены за ${pairs.moves} ходов!  +${bonus} XP`, "ok");
    fb(`Победа за ${pairs.moves} ходов  +${bonus} XP`, "ok");
    SND() && SND().finish();
    FX() && FX().confetti();
  }

  /* =========================================================
     ПРАВДА ИЛИ ЛОЖЬ
     ========================================================= */
  const quiz = { score: 0, streak: 0, current: null };

  function quizRound() {
    const pool = q().pairPool(120);
    if (!pool.length) { fb("Нет слов", "bad"); return; }
    quiz.pair = draw(() => pool);
    const others = uniq(pool.map((p) => p[1]).filter((r) => r !== quiz.pair[1]));
    const isTrue = Math.random() < 0.5;
    const shown = isTrue || !others.length ? quiz.pair[1] : pick(others);
    quiz.current = { isTrue };
    host.body().innerHTML = `
      <div class="g-hint">Правда или ложь?</div>
      <div class="g-big">${esc(quiz.pair[0])}</div>
      <div class="g-mid" style="color:var(--dim)">${esc(shown)}</div>
      <div class="g-row">
        <button class="btn primary" id="quizTrue" style="min-width:160px">✓ ПРАВДА</button>
        <button class="btn ghost danger" id="quizFalse" style="min-width:160px">✕ ЛОЖЬ</button>
      </div>`;
    $("#quizTrue").onclick = () => quizAnswer(true);
    $("#quizFalse").onclick = () => quizAnswer(false);
    say(quiz.pair[0], "de");
    quizHud();
  }

  function quizHud() {
    setHud([
      { value: quiz.score, label: "очков", color: "#ffc44d" },
      { html: `<b class="h-val" style="color:var(--ok)">${quiz.streak}</b><span class="h-lbl">серия</span>` },
    ]);
  }

  function quizAnswer(saidTrue) {
    if (!quiz.current) return;
    const ok = saidTrue === quiz.current.isTrue;
    $("#quizTrue").disabled = true;
    $("#quizFalse").disabled = true;
    if (ok) {
      const bonus = 10 + quiz.streak * 2;
      quiz.score += bonus; quiz.streak++;
      q().award(bonus); record("quiz", 1, "add");
      fb(`ВЕРНО!  +${bonus} XP`, "ok");
    } else {
      quiz.streak = 0;
      fb(`На самом деле: ${quiz.pair[0]} — ${quiz.pair[1]}`, "bad");
      q().registerMistake?.(quiz.pair[0]);
    }
    quizHud();
    sfxResult(ok, $("#gBody"));
    later("quiz", quizRound, ok ? 900 : 1700);
  }

  /* =========================================================
     ЛИШНЕЕ СЛОВО — три перевода к одной теме, один лишний
     ========================================================= */
  const oddone = { score: 0, answered: false };

  /* Тема слова — его группа в словаре (Инструменты, Кухня, Безопасность…).
     Раньше тема вычислялась по первому слову перевода и группы смешивались. */
  function oddonePool() {
    const out = [];
    (window.DQ.groupedPairs ? window.DQ.groupedPairs() : []).forEach(({ group, pairs }) => {
      pairs.forEach(([de, ru]) => out.push({ de, ru, group }));
    });
    return out;
  }

  function oddoneRound() {
    const all = oddonePool();
    if (all.length < 12) { fb("Мало слов в выбранных группах", "bad"); return; }
    oddone.answered = false;

    const groups = {};
    all.forEach((p) => { (groups[p.group] = groups[p.group] || []).push(p); });
    const rich = Object.keys(groups).filter((g) => groups[g].length >= 3);
    if (!rich.length) { fb("Недостаточно групп, чтобы найти лишнее", "bad"); return; }
    const theme = pick(rich);
    const trio = shuffle(groups[theme]).slice(0, 3);
    const intruder = pick(all.filter((p) => p.group !== theme));
    // короткое имя темы для заголовка (полное — в подсказке)
    const shortTheme = (window.DQ && window.DQ.groupShort ? window.DQ.groupShort(theme) : theme);

    oddone.theme = shortTheme;
    oddone.trio = trio;
    oddone.intruder = intruder;
    oddone.correct = intruder.ru;
    const opts = shuffle([...trio.map((p) => p.ru), intruder.ru]);
    host.body().innerHTML = `
      <div class="g-hint">Найди слово не из темы</div>
      <div class="g-mid">«${esc(shortTheme)}»</div>
      <div class="g-row" id="oddOpts">
        ${opts.map((o) => `<button class="g-tile" style="min-width:170px">${esc(o)}</button>`).join("")}
      </div>`;
    Array.from($("#oddOpts").children).forEach((btn, i) => { btn.onclick = () => oddoneAnswer(btn, opts[i]); });
    setHud([{ value: oddone.score, label: "найдено", color: "#ffb020" }]);
  }

  function oddoneAnswer(btn, selected) {
    if (oddone.answered) return;
    oddone.answered = true;
    const ok = selected === oddone.correct;
    Array.from($("#oddOpts").children).forEach((b) => {
      b.disabled = true;
      if (b.textContent === oddone.correct) b.classList.add("correct");
    });
    if (!ok) btn.classList.add("wrong");
    if (ok) {
      oddone.score++;
      q().award(10); record("oddone", 1, "add");
      fb(`Верно! «${oddone.intruder.ru}» — из другой темы (${oddone.intruder.de})`, "ok");
    } else {
      fb(`Лишнее — «${oddone.intruder.ru}» (${oddone.intruder.de}), тема была «${oddone.theme}»`, "bad");
    }
    sfxResult(ok, btn);
    setHud([{ value: oddone.score, label: "найдено", color: "#ffb020" }]);
    later("oddone", oddoneRound, ok ? 1100 : 1700);
  }

  /* =========================================================
     ЦЕПОЧКА — последняя буква перевода = первая буква следующего
     ========================================================= */
  const chain = { score: 0, best: 0, current: null, used: new Set() };

  const firstLetter = (ru) => (normalize(ru).replace(/[^a-zа-яё]/g, "")[0] || "");
  const lastLetter = (ru) => {
    const w = normalize(ru).replace(/[^a-zа-яё]/g, "");
    return w[w.length - 1] || "";
  };

  function chainRound() {
    const pool = q().pairPool(400);
    if (pool.length < 6) { fb("Мало слов", "bad"); return; }

    // Стартовое слово выбираем такое, к которому ГАРАНТИРОВАННО есть продолжение
    // (иначе цепочка обрывается на первом шаге — так было с «голодный» → «Й»).
    if (!chain.current) {
      const canStart = pool.filter((p) => {
        const need = lastLetter(p[1]);
        return need && pool.some((o) => o !== p && firstLetter(o[1]) === need);
      });
      chain.current = pick(canStart.length ? canStart : pool);
    }

    const need = lastLetter(chain.current[1]);
    const next = pool.filter((p) => p !== chain.current && !chain.used.has(p[0]) && firstLetter(p[1]) === need);
    chain.candidates = next;
    // если продолжение кончилось — честно предлагаем новую цепочку
    const opts = next.length
      ? shuffle([pick(next), ...shuffle(pool.filter((p) => p !== chain.current && firstLetter(p[1]) !== need)).slice(0, 3)])
      : [];
    host.body().innerHTML = `
      <div class="g-hint">Цепочка: ${esc(chain.current[0])} — ${esc(chain.current[1])}</div>
      <div class="g-mid">Нужно слово на «${esc(need.toUpperCase())}»</div>
      ${opts.length ? `<div class="g-row" id="chainOpts">${opts.map((o) => `<button class="g-tile" style="min-width:170px">${esc(o[1])}</button>`).join("")}</div>`
        : `<div class="g-small">Цепочка оборвалась — начни новую</div>
           <button class="btn primary" id="chainRestart">Новая цепочка</button>`}`;
    if (opts.length) {
      Array.from($("#chainOpts").children).forEach((btn, i) => { btn.onclick = () => chainAnswer(btn, opts[i]); });
    } else {
      $("#chainRestart").onclick = () => {
        chain.best = Math.max(chain.best, chain.score);
        record("chain", chain.score, "max");
        chain.score = 0; chain.used = new Set(); chain.current = null;
        chainRound();
      };
    }
    setHud([
      { value: chain.score, label: "цепочка", color: "#7be0ad" },
      { value: chain.best, label: "лучшая" },
    ]);
  }

  function chainAnswer(btn, selectedPair) {
    const ok = firstLetter(selectedPair[1]) === lastLetter(chain.current[1]);
    if (ok) {
      chain.used.add(chain.current[0]);
      chain.score++;
      chain.best = Math.max(chain.best, chain.score);
      chain.current = selectedPair;
      q().award(8); record("chain", 1, "add");
      fb(`Продолжили: ${selectedPair[0]} — ${selectedPair[1]}`, "ok");
      sfxResult(true, btn);
      chainRound();
    } else {
      fb(`Не подходит: нужно на «${lastLetter(chain.current[1]).toUpperCase()}»`, "bad");
      sfxResult(false, btn);
    }
  }

  /* =========================================================
     КАРТОЧКИ-ВСПЫШКИ — слово мелькает, потом выбираешь
     ========================================================= */
  const flash = { level: 0, score: 0, pair: null, answered: false };
  const FLASH_STEPS = [1200, 900, 700, 550, 450, 350];

  function flashRound() {
    const pool = q().pairPool(300);
    if (!pool.length) { fb("Мало слов", "bad"); return; }
    const ms = FLASH_STEPS[Math.min(flash.level, FLASH_STEPS.length - 1)];
    flash.pair = draw(() => pool);
    flash.answered = false;
    host.body().innerHTML = `
      <div class="g-hint">Ступень ${flash.level + 1} · ${ms} мс</div>
      <div class="g-big flash-word" id="flashWord" style="opacity:0">${esc(flash.pair[0])}</div>
      <div class="g-small" id="flashMsg">Смотри внимательно…</div>`;
    const word = $("#flashWord");
    word.style.transition = "opacity 80ms linear";
    word.style.opacity = "1";
    setTimeout(() => {
      word.style.opacity = "0";
      const others = uniq(pool.map((p) => p[1]).filter((r) => r !== flash.pair[1]));
      const opts = shuffle(uniq([flash.pair[1], ...shuffle(others).slice(0, 3)]));
      $("#flashMsg").textContent = "Что это было?";
      const box = document.createElement("div");
      box.className = "g-row";
      box.id = "flashOpts";
      box.innerHTML = opts.map((o) => `<button class="g-tile" style="min-width:160px">${esc(o)}</button>`).join("");
      host.body().appendChild(box);
      Array.from(box.children).forEach((b, i) => { b.onclick = () => flashAnswer(b, opts[i]); });
    }, ms);
    setHud([
      { value: flash.score, label: "очков", color: "#a98bff" },
      { value: `${flash.level + 1}/${FLASH_STEPS.length}`, label: "ступень" },
    ]);
  }

  function flashAnswer(btn, selected) {
    if (flash.answered) return;
    flash.answered = true;
    const ok = selected === flash.pair[1];
    Array.from($("#flashOpts").children).forEach((b) => {
      b.disabled = true;
      if (b.textContent === flash.pair[1]) b.classList.add("correct");
    });
    if (!ok) btn.classList.add("wrong");
    if (ok) {
      flash.score += 10;
      flash.level = Math.min(FLASH_STEPS.length - 1, flash.level + 1);
      q().award(10); record("flash", 1, "add");
      fb(`Верно! ${flash.pair[0]} — ${flash.pair[1]}`, "ok");
    } else {
      flash.level = Math.max(0, flash.level - 1);
      fb(`Это было: ${flash.pair[0]} — ${flash.pair[1]}`, "bad");
    }
    sfxResult(ok, btn);
    setHud([
      { value: flash.score, label: "очков", color: "#a98bff" },
      { value: `${flash.level + 1}/${FLASH_STEPS.length}`, label: "ступень" },
    ]);
    later("flash", flashRound, ok ? 900 : 1500);
  }

  /* =========================================================
     der · die · das — род существительного
     ========================================================= */
  const gender = { score: 0, streak: 0, answered: false, deck: [] };

  function genderPool() {
    return q().pairPool(500).filter(([de]) => /^(der|die|das)\s+\S/.test(String(de)));
  }

  function genderRound() {
    if (!gender.deck.length) gender.deck = shuffle(genderPool());
    if (!gender.deck.length) { fb("В выбранных группах нет существительных с артиклем", "bad"); return; }
    gender.answered = false;
    const pair = gender.deck[0];
    const de = pair[0];
    gender.pair = pair;
    gender.correct = de.split(/\s+/)[0];
    host.body().innerHTML = `
      <div class="g-hint">Определи род · ${esc(pair[1])}</div>
      <div class="g-big">${esc(de.replace(/^(der|die|das)\s+/, ""))}</div>
      <div class="g-row">
        <button class="g-tile" data-g="der" style="color:#8fd0ff">der</button>
        <button class="g-tile" data-g="die" style="color:#ff9cc1">die</button>
        <button class="g-tile" data-g="das" style="color:#7be0ad">das</button>
      </div>`;
    host.body().querySelectorAll("[data-g]").forEach((b) => { b.onclick = () => genderAnswer(b, b.dataset.g); });
    genderHud();
  }

  function genderHud() {
    setHud([
      { value: gender.score, label: "верно", color: "#ff70a6" },
      { html: `<b class="h-val" style="color:var(--ok)">${gender.streak}</b><span class="h-lbl">серия</span>` },
      { value: gender.deck.length, label: "в колоде" },
    ]);
  }

  function genderAnswer(btn, picked) {
    if (gender.answered) return;
    gender.answered = true;
    const ok = picked === gender.correct;
    host.body().querySelectorAll("[data-g]").forEach((b) => {
      b.disabled = true;
      if (b.dataset.g === gender.correct) b.classList.add("correct");
    });
    if (!ok) btn.classList.add("wrong");
    const pair = gender.deck.shift();
    if (ok) {
      gender.score++; gender.streak++;
      q().award(10); record("gender", 1, "add");
      fb(`Верно! ${pair[0]} — ${pair[1]}`, "ok");
    } else {
      gender.streak = 0;
      gender.deck.push(pair);   // ошибка — слово вернётся в конец колоды
      fb(`На самом деле: ${pair[0]} — ${pair[1]}`, "bad");
    }
    sfxResult(ok, btn);
    genderHud();
    later("gender", genderRound, ok ? 800 : 1500);
  }

  /* =========================================================
     ПРОПУЩЕННАЯ БУКВА — вставь букву на место
     ========================================================= */
  const letter = { score: 0, answered: false };

  function letterRound() {
    const pool = q().pairPool(400).filter(([de]) => {
      const w = String(de).replace(/^(der|die|das)\s+/, "").replace(/[^A-Za-zÄÖÜäöüß]/g, "");
      return w.length >= 4 && w.length <= 14;
    });
    if (!pool.length) { fb("Мало слов", "bad"); return; }
    letter.answered = false;
    const pair = draw(() => pool);
    letter.pair = pair;
    const bare = String(pair[0]).replace(/^(der|die|das)\s+/, "");
    const lettersIdx = [];
    for (let i = 0; i < bare.length; i++) if (/[A-Za-zÄÖÜäöüß]/.test(bare[i])) lettersIdx.push(i);
    const at = lettersIdx[Math.floor(Math.random() * lettersIdx.length)];
    const missing = bare[at];
    const shown = bare.slice(0, at) + "＿" + bare.slice(at + 1);
    letter.correct = missing;
    // варианты: правильная буква + похожие (соседние по алфавиту)
    const alphabet = "abcdefghijklmnopqrstuvwxyzäöüß";
    const idx = alphabet.indexOf(missing.toLowerCase());
    const nearAlts = [alphabet[(idx + 1) % alphabet.length], alphabet[(idx + 3) % alphabet.length],
                      alphabet[(idx + 7) % alphabet.length]].filter((c) => c !== missing.toLowerCase());
    const opts = shuffle(uniq([missing.toLowerCase(), ...nearAlts.slice(0, 3)]));
    host.body().innerHTML = `
      <div class="g-hint">Какая буква пропущена? · ${esc(pair[1])}</div>
      <div class="g-big" style="letter-spacing:.08em">${esc(shown)}</div>
      <div class="g-row" id="letterOpts">
        ${opts.map((c) => `<button class="g-tile letter-opt" style="min-width:60px">${esc(c)}</button>`).join("")}
      </div>`;
    Array.from($("#letterOpts").children).forEach((b, i) => { b.onclick = () => letterAnswer(b, opts[i]); });
    setHud([{ value: letter.score, label: "собрано", color: "#8fd0ff" }]);
    say(pair[0], "de");
  }

  function letterAnswer(btn, picked) {
    if (letter.answered) return;
    letter.answered = true;
    const ok = String(picked).toLowerCase() === String(letter.correct).toLowerCase();
    Array.from($("#letterOpts").children).forEach((b) => {
      b.disabled = true;
      if (b.textContent.toLowerCase() === String(letter.correct).toLowerCase()) b.classList.add("correct");
    });
    if (!ok) btn.classList.add("wrong");
    if (ok) {
      letter.score++;
      q().award(10); record("letter", 1, "add");
      fb(`Верно! ${letter.pair[0]} — ${letter.pair[1]}`, "ok");
    } else {
      fb(`Пропущена «${letter.correct}»: ${letter.pair[0]}`, "bad");
    }
    sfxResult(ok, btn);
    setHud([{ value: letter.score, label: "собрано", color: "#8fd0ff" }]);
    later("letter", letterRound, ok ? 1000 : 1700);
  }

  /* =========================================================
     МИКРОФОН — скажи слово по-немецки
     ========================================================= */
  const mic = { score: 0, streak: 0, answered: false };

  function speechPool() {
    return q().pairPool(200).filter((p) => /^[A-Za-zÄÖÜäöüß]/.test(p[0]) && p[0].split(" ").length <= 3);
  }

  function micRound() {
    const pool = speechPool();
    if (!pool.length) { fb("Нет слов — выберите группы", "bad"); return; }
    mic.answered = false;
    mic.pair = draw(() => pool);
    const d = q().pron(mic.pair[0]);
    host.body().innerHTML = `
      <div class="g-hint">Скажи по-немецки:</div>
      <div class="gm-big-word">${esc(mic.pair[1])}</div>
      ${d ? `<div class="ph-row" style="text-align:center;color:var(--faint);font-size:13px">/${esc(d.ipa)}/</div>` : ""}
      <button class="mic-btn" id="micGo" title="Записать ответ"><span class="ico ico-mic"></span></button>
      <div class="mic-hint" id="micLive">Нажми и произнеси</div>
      <div class="g-actions"><button class="btn ghost" id="micSkip">Не знаю</button></div>
      <div id="micPron"></div>`;
    $("#micGo").onclick = () => {
      const live = $("#micLive");
      $("#micGo").classList.add("listening");
      if (live) { live.className = "mic-hint live"; live.textContent = "Слушаю…"; }
      listenOnce(
        (text, alts) => micAnswer(text, alts),
        () => { $("#micGo") && $("#micGo").classList.remove("listening"); },
      );
    };
    $("#micSkip").onclick = () => {
      mic.streak = 0;
      fb(`Это было: ${mic.pair[0]} — ${mic.pair[1]}`, "info");
      say(mic.pair[0], "de");
      micHud();
      later("mic", micRound, 1400);
    };
    micHud();
  }

  function micHud() {
    setHud([{ value: mic.score, label: "верно" }, { value: mic.streak, label: "серия" }]);
  }

  function micAnswer(text, alts) {
    if (mic.answered) return;
    mic.answered = true;
    const target = normalize(mic.pair[0]);
    const cand = [text, ...(alts || [])].map(normalize);
    const exact = cand.some((c) => c === target);
    const near = cand.some((c) => isTypoMatch(c, target));
    const best = Math.max(...cand.map((c) => similarity(c, target)));
    // «mit = с; из; имеющий» — принимаем и другие варианты перевода
    const altOk = !exact && cand.some((c) => q().matchAnyAnswer && q().matchAnyAnswer(c, mic.pair[1] || ""));
    const ok = exact || near || altOk;
    const box = $("#micLive");
    if (box) { box.className = "mic-hint"; box.textContent = `Услышано: «${text}»`; }
    $("#micGo") && $("#micGo").classList.remove("listening");
    // покажем транскрипцию и озвучку правильного варианта
    const pronBox = $("#micPron");
    if (pronBox) { pronBox.innerHTML = pron(mic.pair[0], { compact: true }); window.DQPhon && window.DQPhon.bind(pronBox); }
    say(mic.pair[0], "de");
    if (ok) {
      const pts = exact ? 12 : 8;
      mic.score += pts; mic.streak++;
      q().award(pts); record("mic", 1, "add");
      fb(exact ? `Отлично! +${pts} XP` : `Почти верно (${Math.round(best * 100)}%) +${pts} XP`, "ok");
    } else {
      mic.streak = 0;
      fb(`Не похоже (${Math.round(best * 100)}%). Нужно: ${mic.pair[0]}`, "bad");
    }
    sfxResult(ok, $("#micGo"));
    micHud();
    later("mic", micRound, ok ? 1700 : 2400);
  }

  /* =========================================================
     ЭХО — слушай и повторь (слух + речь + произношение)
     ========================================================= */
  const shadow = { score: 0, streak: 0, answered: false };

  function shadowRound() {
    const pool = speechPool();
    if (!pool.length) { fb("Нет слов", "bad"); return; }
    shadow.answered = false;
    shadow.pair = draw(() => pool);
    host.body().innerHTML = `
      <div class="g-hint">Послушай и повтори вслух (без текста!)</div>
      <div class="word-line" style="margin:14px 0">
        <button class="btn primary big" id="shadowPlay"><span class="ico ico-vol"></span> Слушать</button>
        <button class="btn ghost" id="shadowSlow"><span class="ico ico-slow"></span> Медленно</button>
      </div>
      <button class="mic-btn" id="shadowMic"><span class="ico ico-mic"></span></button>
      <div class="mic-hint" id="shadowLive">Запомнил — повтори</div>
      <div class="g-actions"><button class="btn ghost" id="shadowShow">Показать слово</button></div>`;
    $("#shadowPlay").onclick = () => say(shadow.pair[0], "de");
    $("#shadowSlow").onclick = () => say(shadow.pair[0], "de", { slow: true });
    $("#shadowShow").onclick = () => {
      shadow.answered = true;
      fb(`${shadow.pair[0]} — ${shadow.pair[1]}`, "info");
      host.body().insertAdjacentHTML("beforeend", pron(shadow.pair[0], { compact: true }));
      window.DQPhon && window.DQPhon.bind(host.body());
      later("shadow", shadowRound, 2000);
    };
    $("#shadowMic").onclick = () => {
      $("#shadowMic").classList.add("listening");
      const live = $("#shadowLive");
      if (live) { live.className = "mic-hint live"; live.textContent = "Слушаю…"; }
      listenOnce((text, alts) => shadowAnswer(text, alts), () => {
        $("#shadowMic") && $("#shadowMic").classList.remove("listening");
      });
    };
    say(shadow.pair[0], "de");
    shadowHud();
  }

  function shadowHud() {
    setHud([{ value: shadow.score, label: "повторов" }, { value: shadow.streak, label: "серия" }]);
  }

  function shadowAnswer(text, alts) {
    if (shadow.answered) return;
    shadow.answered = true;
    const target = normalize(shadow.pair[0]);
    const cand = [text, ...(alts || [])].map(normalize);
    const best = Math.max(...cand.map((c) => similarity(c, target)));
    const ok = best >= 0.82;
    $("#shadowMic") && $("#shadowMic").classList.remove("listening");
    const live = $("#shadowLive");
    if (live) { live.className = "mic-hint"; live.textContent = `Услышано: «${text}»`; }
    host.body().insertAdjacentHTML("beforeend", pron(shadow.pair[0], { compact: true }));
    window.DQPhon && window.DQPhon.bind(host.body());
    if (ok) {
      shadow.score++; shadow.streak++;
      q().award(10); record("shadow", 1, "add");
      fb(`Молодец! ${Math.round(best * 100)}% сходства`, "ok");
    } else {
      shadow.streak = 0;
      fb(`Было: ${shadow.pair[0]} — ${shadow.pair[1]} (${Math.round(best * 100)}%)`, "bad");
    }
    sfxResult(ok, $("#shadowMic"));
    shadowHud();
    later("shadow", shadowRound, ok ? 1500 : 2400);
  }

  /* =========================================================
     ФРАЗЫ НА СЛУХ — собери услышанную фразу
     ========================================================= */
  const dictation = { score: 0, answered: false };

  function phrasePool() {
    // немецкие фразы = те пары, у которых в немецкой части 2+ слова
    return q().pairPool(600)
      .filter((p) => normalize(p[0]).split(" ").length >= 2 && p[0].split(" ").length <= 9)
      .slice(0, 80);
  }

  /* Строим пул фраз из задания «Порядок слов» (если слов нет). */
  function sentencePhrases() {
    const tpl = (G.data.sentences && G.data.sentences.templates) || [];
    return tpl.map((t) => ({ de: t.parts.join(" ").replace(/\{zahl\}|\{uhr\}/g, "drei"), ru: t.ru }))
      .filter((p) => p.de.split(" ").length >= 3);
  }

  function dictationRound() {
    const pool = (phrasePool().length ? phrasePool() : sentencePhrases());
    if (!pool.length) { fb("Нет фраз — выберите группы с фразами", "bad"); return; }
    dictation.answered = false;
    const item = draw(() => pool);
    const words = item.de.replace(/[.,!?]/g, "").split(/\s+/).filter(Boolean);
    dictation.item = item;
    dictation.answer = words.map(normalize).join(" ");
    dictation.ordered = words.map((w, i) => ({ w, i }));
    dictation.shuffled = shuffle(dictation.ordered);
    dictation.picked = [];
    host.body().innerHTML = `
      <div class="g-hint">Слушай фразу — собери её из слов</div>
      <div class="word-line" style="margin:10px 0">
        <button class="btn primary" id="dictPlay"><span class="ico ico-vol"></span> Слушать</button>
        <button class="btn ghost" id="dictSlow"><span class="ico ico-slow"></span> Медленно</button>
      </div>
      <div class="gm-transcript" id="dictLine">…</div>
      <div class="g-row" id="dictBank" style="margin-top:10px"></div>
      <div class="g-actions">
        <button class="btn ghost" id="dictUndo">↶ Убрать</button>
        <button class="btn ghost" id="dictRev">Показать фразу</button>
      </div>`;
    renderDict();
    $("#dictPlay").onclick = () => say(item.de, "de");
    $("#dictSlow").onclick = () => say(item.de, "de", { slow: true });
    $("#dictUndo").onclick = () => {
      if (!dictation.picked.length || dictation.answered) return;
      dictation.picked.pop();
      renderDict();
    };
    $("#dictRev").onclick = () => {
      if (dictation.answered) return;
      dictation.answered = true;
      fb(`Фраза: ${item.de}`, "warn");
      host.body().insertAdjacentHTML("beforeend", pron(item.de.split(" ")[0], { compact: true }));
      window.DQPhon && window.DQPhon.bind(host.body());
      later("dictation", dictationRound, 2600);
    };
    say(item.de, "de");
    setHud([{ value: dictation.score, label: "фраз" }]);
  }

  function renderDict() {
    const line = $("#dictLine"), bank = $("#dictBank");
    if (!line || !bank) return;
    line.textContent = dictation.picked.length ? dictation.picked.map((p) => p.w).join(" ") : "…";
    line.classList.toggle("live", dictation.picked.length > 0);
    bank.innerHTML = dictation.shuffled.map((p) =>
      `<button class="g-tile" data-i="${p.i}" ${dictation.picked.includes(p) ? "disabled" : ""}>${esc(p.w)}</button>`).join("");
    bank.querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        if (dictation.answered) return;
        const item = dictation.shuffled.find((p) => p.i === Number(b.dataset.i));
        if (!item || dictation.picked.includes(item)) return;
        dictation.picked.push(item);
        renderDict();
        dictationCheck();
      };
    });
  }

  function dictationCheck() {
    if (dictation.picked.length !== dictation.shuffled.length) return;
    const got = dictation.picked.map((p) => normalize(p.w)).join(" ");
    const ok = got === dictation.answer;
    dictation.answered = true;
    if (ok) {
      dictation.score++;
      q().award(15); record("dictation", 1, "add");
      fb(`Верно! ${dictation.item.de}`, "ok");
    } else {
      fb(`Не совсем. Правильно: ${dictation.item.de}`, "bad");
    }
    say(dictation.item.de, "de");
    host.body().insertAdjacentHTML("beforeend", pron(dictation.item.de.split(" ")[0], { compact: true }));
    window.DQPhon && window.DQPhon.bind(host.body());
    sfxResult(ok, $("#dictLine"));
    setHud([{ value: dictation.score, label: "фраз" }]);
    later("dictation", dictationRound, ok ? 1800 : 3000);
  }

  /* =========================================================
     Запуск / закрытие
     ========================================================= */
  const RUNNERS = {
    speed: () => { host.extra().innerHTML = ""; speedStart(); },
    listen: () => { host.extra().innerHTML = ""; listenRound(); },
    typing: typingRound,
    images: () => { host.extra().innerHTML = ""; imagesRound(); },
    sentence: sentenceRound,
    anagram: () => { host.extra().innerHTML = ""; anagramRound(); },
    pairs: () => pairsNew(4),
    quiz: () => { host.extra().innerHTML = ""; quizRound(); },
    oddone: () => { host.extra().innerHTML = ""; oddoneRound(); },
    chain: () => { host.extra().innerHTML = ""; chain.score = 0; chain.best = 0; chain.used = new Set(); chain.current = null; chainRound(); },
    flash: () => { host.extra().innerHTML = ""; flash.level = 0; flash.score = 0; flashRound(); },
    gender: () => { host.extra().innerHTML = ""; gender.score = 0; gender.streak = 0; gender.deck = []; genderRound(); },
    letter: () => { host.extra().innerHTML = ""; letter.score = 0; letterRound(); },
    mic: () => { host.extra().innerHTML = ""; mic.score = 0; mic.streak = 0; micRound(); },
    shadow: () => { host.extra().innerHTML = ""; shadow.score = 0; shadow.streak = 0; shadowRound(); },
    dictation: () => { host.extra().innerHTML = ""; dictation.score = 0; dictationRound(); },
  };

  function stopTimers() {
    clearTimeout(G.timer);
    speed.running = false;
    q().stopAudio?.();
  }

  async function open(id) {
    const card = CATALOG.find((c) => c.id === id);
    if (!card) return;
    stopTimers();
    // полностью сбрасываем состояние прошлой игры: её фидбек не должен «переезжать»
    fb("");
    host.extra().innerHTML = "";
    host.hud().innerHTML = "";
    G.current = id;
    const modal = $("#gameModal");
    modal.classList.add("open");
    document.documentElement.classList.add("modal-open");
    $("#gIcon").textContent = card.icon;
    $("#gIcon").style.color = card.color;
    $("#gTitle").textContent = card.title;
    $("#gSub").textContent = card.record(q().stats.games || {});
    host.hud().innerHTML = "";
    host.body().innerHTML = `<div class="g-small">Загрузка…</div>`;

    try {
      if (id === "sentence" && !G.data.sentences) G.data.sentences = await q().api("/api/game/sentences");
    } catch (e) {
      host.body().innerHTML = `<div class="g-small">Сервер недоступен: ${esc(e.message)}</div>`;
      return;
    }
    // эмодзи-картинки всегда нужны как замена изображений
    if (card.pool === "emoji" && !G.data.emoji.length) {
      try {
        const d = await q().api("/api/game/emoji");
        G.data.emoji = d.emoji || [];
      } catch (e) { /* работаем без картинок */ }
    }
    if (!card.pool || card.pool !== "emoji") {
      if (!G.data.emoji.length) {
        try { G.data.emoji = (await q().api("/api/game/emoji")).emoji || []; } catch (e) { }
      }
    }
    RUNNERS[id]();
  }

  function close() {
    stopTimers();
    G.current = null;
    $("#gameModal").classList.remove("open");
    document.documentElement.classList.remove("modal-open");
    fb("");
    host.hud().innerHTML = "";
    host.extra().innerHTML = "";
    host.body().innerHTML = "";
    q().renderGames?.();
  }

  /* ---------------- карточки игр в списке ---------------- */
  function renderCatalog() {
    const grid = $("#gameGrid");
    if (!grid) return;
    const games = q().stats.games || {};
    grid.innerHTML = CATALOG.map((c) => `
      <div class="game-card" data-id="${c.id}" style="--gc:${c.color}">
        <div class="gc-head">
          <div class="gc-ic">${c.icon}</div>
          <div><div class="gc-title">${c.title}</div><div class="gc-rec">${esc(c.record(games))}</div></div>
        </div>
        <div class="gc-desc">${c.desc}</div>
        <button class="gc-play">ИГРАТЬ</button>
      </div>`).join("");
    grid.querySelectorAll(".game-card").forEach((el) => {
      el.onclick = () => open(el.dataset.id);
    });
    const total = ["speed", "listen", "typing", "images", "sentence", "anagram", "pairs", "quiz"]
      .map((k) => games[k] || 0).reduce((a, b) => a + b, 0);
    const sum = $("#gamesSummary");
    if (sum) sum.textContent = `Сыграно очков: ${total}`;
  }

  return { CATALOG, open, close, renderCatalog, isOpen: () => $("#gameModal").classList.contains("open") };
})();