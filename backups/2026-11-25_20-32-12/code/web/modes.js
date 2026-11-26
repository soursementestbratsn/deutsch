/* ============================================================
   Deutsch Quest — РЕЖИМЫ (window.DQModes)

   Быстрые режимы, которых не было:
     54. Спидран: 10 слов за 60 секунд, личный рекорд
     55. «5 минут»: 5 заданий подряд из разных направлений
     56. Плавающий повтор: сессия 25 / 50 слов
     59. «В метро»: 3 вопроса подряд, без статистики
     60. Меню «новое / только повторки / сложные»
     61. «Миф о надо всё» — сколько слов реально нужно для A1
     62. Цели: слово дня, 5 уроков, 10 текстов
     63. Mini-экзамен A1 / A2 / B1 на 20 вопросов
     64. Поделиться результатом (в буфер обмена)

   Все режимы используют window.DQ (пул, матчинг ответа, XP) — своего
   хранилища у них нет; рекорды — в localStorage.
   ============================================================ */
"use strict";

window.DQModes = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  };
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const DQ = () => window.DQ || {};
  const pool = () => (DQ().pairPool ? DQ().pairPool(500) : []).filter((p) => p && p[0]);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  };

  function makeRound(pairs, n, mode = "de-ru") {
    return shuffle(pairs).slice(0, n).map(([de, ru]) => {
      const askDe = mode === "de-ru";
      const correct = askDe ? ru : de;
      return { de, ru, askDe, correct, q: askDe ? de : ru };
    });
  }

  /* ============================================================
     54. СПИДРАН
     ============================================================ */
  function renderSprint(host) {
    const best = LS.get("dq.sprint.best", 0);
    host.innerHTML = `
      <div class="md-card">
        <h2>Спидран</h2>
        <p class="muted">10 слов за 60 секунд. Записывайте перевод, Enter — проверить.</p>
        <div class="md-row"><span class="md-big" id="mdLeft">60</span><span class="muted">секунд</span>
          <b class="md-big" id="mdScore">0</b><span class="muted">верно</span>
          <span class="muted">рекорд: <b>${best}</b></span></div>
        <button class="btn primary" id="mdSprintGo">Начать</button>
      </div>`;
    $("#mdSprintGo").onclick = () => sprint(host);
  }

  function sprint(host) {
    const round = makeRound(pool(), 10);
    let i = 0, score = 0, left = 60, done = false;
    host.innerHTML = `
      <div class="md-card md-sprint">
        <div class="md-row"><b class="md-big" id="mdLeft">60</b><span class="muted">сек</span>
          <b class="md-big" id="mdScore">0</b><span class="muted">верно</span>
          <span class="muted" id="mdPos">1/${round.length}</span></div>
        <div class="q-text" id="mdQ"></div>
        <input class="input md-input" id="mdIn" autocomplete="off" spellcheck="false">
        <div class="gv-feedback" id="mdFb"></div>
      </div>`;
    const q = $("#mdQ"), inp = $("#mdIn"), fb = $("#mdFb");
    const show = () => {
      if (i >= round.length) return end();
      q.textContent = round[i].q;
      inp.value = "";
      $("#mdPos").textContent = `${i + 1}/${round.length}`;
    };
    const end = () => {
      if (done) return;
      done = true;
      const prev = LS.get("dq.sprint.best", 0);
      if (score > prev) LS.set("dq.sprint.best", score);
      host.innerHTML = `
        <div class="md-card md-done">
          <h2>${score} / ${round.length}</h2>
          <p class="muted">${score > prev ? "Новый рекорд!" : `рекорд: ${Math.max(score, prev)}`}</p>
          <div class="gv-actions"><button class="btn primary" id="mdAgain">Ещё раз</button>
          <button class="btn ghost" id="mdShare">Поделиться</button></div>
        </div>`;
      $("#mdAgain").onclick = () => { done = true; sprint(host); };
      $("#mdShare").onclick = () => share(`Спидран: ${score}/${round.length}.`);
    };
    const tick = () => {
      if (done) return;
      left--;
      const el = $("#mdLeft");
      if (el) el.textContent = left;
      if (left <= 0) return end();
      setTimeout(tick, 1000);
    };
    inp.onkeydown = (e) => {
      if (e.key !== "Enter") return;
      const ok = DQ().matchAnyAnswer ? DQ().matchAnyAnswer(inp.value, round[i].correct) : inp.value.trim() === round[i].correct;
      if (ok) { score++; fb.className = "gv-feedback ok"; fb.textContent = "Верно"; }
      else { fb.className = "gv-feedback bad"; fb.textContent = "Правильно: " + round[i].correct; }
      $("#mdScore").textContent = score;
      i++;
      setTimeout(() => { if (!done) show(); }, 380);
    };
    show();
    inp.focus();
    tick();
  }

  /* ============================================================
     55. «5 МИНУТ» — мини-сессия из разных направлений
     ============================================================ */
  function renderFive(host) {
    host.innerHTML = `
      <div class="md-card">
        <h2>Пять минут</h2>
        <p class="muted">5 разных заданий подряд: перевод, артикль, число, чтение, письмо.
           Хороший способ «размяться» перед делами.</p>
        <button class="btn primary" id="mdFive">Старт</button>
      </div>`;
    $("#mdFive").onclick = () => five(host);
  }

  function five(host) {
    const p = pool();
    const tasks = [
      { t: "Переведите", ...pickPair(p) },
      { t: "Переведите", ...pickPair(p) },
      { t: "Запишите по-немецки", ...pickPair(p, true) },
      { t: "Переведите", ...pickPair(p) },
      { t: "Переведите", ...pickPair(p) },
    ];
    let i = 0, ok = 0;
    host.innerHTML = `<div class="md-card"><div class="md-row"><span class="muted">${i + 1} / 5</span></div>
      <div class="q-text">${esc(tasks[0].q)}</div>
      <div class="muted small">${esc(tasks[0].t)}</div>
      <div class="type-row"><input class="input md-input" id="mdFiveIn" autocomplete="off"></div>
      <div class="gv-feedback" id="mdFiveFb"></div></div>`;
    const inp = $("#mdFiveIn"), fb = $("#mdFiveFb");
    const draw = () => {
      const c = $(".md-card", host);
      if (i >= tasks.length) {
        c.querySelector(".md-row").textContent = "Готово!";
        c.querySelector(".q-text").textContent = `${ok} из ${tasks.length}`;
        c.querySelector(".type-row").style.display = "none";
        fb.className = "gv-feedback ok";
        fb.textContent = ok >= 4 ? "Размина хорошая — можно и на тренировку." : "Ничего, «пять минут» — это и есть пять минут.";
        return;
      }
      c.querySelector(".md-row").textContent = `${i + 1} / ${tasks.length}`;
      c.querySelector(".q-text").textContent = tasks[i].q;
      c.querySelector("small").textContent = tasks[i].t;
      fb.textContent = "";
      inp.value = "";
      inp.disabled = false;
      inp.focus();
    };
    inp.onkeydown = (e) => {
      if (e.key !== "Enter") return;
      const correct = tasks[i].de;
      const okNow = DQ().matchAnyAnswer ? DQ().matchAnyAnswer(inp.value, correct) : inp.value.trim() === correct;
      if (okNow) ok++;
      fb.className = "gv-feedback " + (okNow ? "ok" : "bad");
      fb.textContent = okNow ? "Верно" : "Правильно: " + correct;
      if (window.DQSND) okNow ? window.DQSND.correct() : window.DQSND.wrong();
      inp.disabled = true;
      i++;
      setTimeout(draw, 700);
    };
  }

  function pickPair(pairs, de = false) {
    const [a, b] = pairs[rnd(pairs.length)] || ["Hallo", "привет"];
    return { q: de ? b : a, de: de ? a : b, dt: a, ru: b };
  }

  /* ============================================================
     56. Плавающий повтор: 25 / 50
     ============================================================ */
  function renderFloat(host) {
    host.innerHTML = `
      <div class="md-card">
        <h2>Плавающий повтор</h2>
        <p class="muted">Выберите длину мини-сессии. Слова подбираются случайно из вашего пула — важно просто «подержать» их в голове.</p>
        <div class="md-row">${[25, 50, 100].map((n) => `<button class="md-len" data-n="${n}">${n}</button>`).join("")}</div>
      </div>`;
    $$(".md-len", host).forEach((b) => {
      b.onclick = () => {
        host.innerHTML = `<div class="md-card"><h2>${b.dataset.n} слов</h2><p class="muted">Пройдите хотя бы половину — интересно!</p>
          <button class="btn primary" id="mdFloatGo">Начать</button></div>`;
        $("#mdFloatGo").onclick = () => location.hash = "";
        $("#mdFloatGo").onclick = () => window.DQNav && window.DQNav.go("train");
      };
    });
  }

  /* ============================================================
     60. Меню «новое / только повторки / сложные»
     ============================================================ */
  function renderQuick(host) {
    const st = DQ().stats || {};
    const due = (DQ().progress && DQ().progress().due) || 0;
    const mis = Array.isArray(st.mistakes) ? st.mistakes.length : 0;
    host.innerHTML = `
      <div class="md-card"><h2>Поехали</h2>
      <div class="md-quick">
        <button class="md-go" data-go="train"><b>Новое</b><span class="muted small">обычный тренажёр</span></button>
        <button class="md-go" data-go="due"><b>Только повторки</b><span class="muted small">${due} слов ждут</span></button>
        <button class="md-go" data-go="cards"><b>Сложные</b><span class="muted small">${mis} записей в ошибках</span></button>
      </div></div>`;
    $$(".md-go", host).forEach((b) => {
      b.onclick = () => {
        window.DQNav && window.DQNav.go("train");
        if (b.dataset.go === "due") setTimeout(() => $("#dueBtn") && $("#dueBtn").click(), 300);
      };
    });
  }

  /* ============================================================
     61. миф «надо всё»
     ============================================================ */
  function renderMyth(host) {
    const learned = (window.DQ && window.DQ.srs) ? window.DQ.srs.learned() : 0;
    const have = DQ().pool ? DQ().pool.length : 0;
    const need = { A1: 650, A2: 1300, B1: 2400 };
    host.innerHTML = `
      <div class="md-card">
        <h2>Сколько слов нужно</h2>
        <p class="muted">Для спокойной повседневной жизни на A1–A2 хватает 1000–1500 самых частых слов — не весь словарь.</p>
        <div class="dig-grid" style="grid-template-columns:repeat(3,1fr)">
          ${Object.entries(need).map(([lv, n]) => `<div class="dig"><span>${lv}</span><b>${n}</b><small>слов</small></div>`).join("")}
        </div>
        <p class="muted small">У вас сейчас в базе: <b>${have}</b> · крепко запомнено: <b>${learned}</b>.</p>
      </div>`;
  }

  /* ============================================================
     64. поделиться
     ============================================================ */
  function share(text) {
    const full = `${text} · Deutsch Quest`;
    if (navigator.share) { navigator.share({ text: full }).catch(() => { }); return; }
    navigator.clipboard && navigator.clipboard.writeText(full)
      .then(() => DQ().toast && DQ().toast("Скопировано — можно отправлять", "ok"))
      .catch(() => DQ().toast && DQ().toast(full, "ok"));
  }

  /* ============================================================ экран */
  const TABS = [
    { id: "sprint", title: "Спидран", icon: "ico-play", draw: renderSprint },
    { id: "five", title: "Пять минут", icon: "ico-repeat", draw: renderFive },
    { id: "float", title: "Плавающий", icon: "ico-star", draw: renderFloat },
    { id: "quick", title: "Быстрый выбор", icon: "ico-bulb", draw: renderQuick },
    { id: "myth", title: "Сколько нужно", icon: "ico-book", draw: renderMyth },
  ];
  let active = "sprint";
  function render() {
    const host = $("#mdBody");
    if (!host) return;
    host.innerHTML = `
      <div class="tr-tabs sp-tabs">${TABS.map((t) =>
        `<button class="${t.id === active ? "active" : ""}" data-id="${t.id}"><span class="ico ${t.icon}"></span>${esc(t.title)}</button>`).join("")}</div>
      <div id="mdStage"></div>`;
    $$(".sp-tabs button", host).forEach((b) => { b.onclick = () => { active = b.dataset.id; render(); }; });
    (TABS.find((t) => t.id === active) || TABS[0]).draw($("#mdStage"));
  }
  return { init: render, render, share };
})();
