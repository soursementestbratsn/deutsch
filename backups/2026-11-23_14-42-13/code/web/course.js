/* ============================================================
   Deutsch Quest — КУРС от A0 до B1 (window.DQCourse)

   24 урока: карта → урок → карточка правила → слова → практика → итог.
   Прогресс в localStorage (dq.course.v1), не в серверной статистике.
   Контент — web/course/lessons-*.js (сгенерирован scripts/build_course.py).
   ============================================================ */
"use strict";

window.DQCourse = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const KEY = "dq.course.v1";
  const LS = {
    get() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { } },
  };

  const S = { step: "map", lesson: null, idx: 0, taskIdx: 0, right: 0, checked: false, orderSeq: 0 };

  function data() { return (window.DQCourseData || []).slice().sort((a, b) => a.n - b.n); }
  function prog() { return LS.get(); }
  function saveProg(p) { LS.set(p); return p; }
  function isDone(id) { const p = prog(); return !!(p[id] && p[id].done); }

  /** Урок открыт, если предыдущий пройден (или это первый). */
  function unlocked(n) {
    const all = data();
    const cur = all.find((l) => l.n === n);
    if (!cur) return false;
    if (n === 1) return true;
    const prev = all.find((l) => l.n === n - 1);
    return prev ? isDone(prev.id) : true;
  }

  const say = (t, slow) => {
    if (window.DQ && window.DQ.say) return (slow && window.DQ.saySlow ? window.DQ.saySlow : window.DQ.say)(t, "de");
  };

  /** Артикли der/die/das — цветом (общая утилита). */
  const art = (html) => (window.DQUI ? window.DQUI.art(html) : html);

  /* ============================================================ карта */
  function renderMap() {
    const host = $("#courseBody");
    if (!host) return;
    S.step = "map";
    const p = prog();
    const all = data();
    const done = all.filter((l) => p[l.id] && p[l.id].done).length;
    const pct = all.length ? Math.round((done / all.length) * 100) : 0;

    host.innerHTML = `
      <div class="cr-top">
        <div class="goal-ring cr-ring" style="--p:${pct}"><b>${pct}%</b></div>
        <div class="cr-info">
          <h2>${done} из ${all.length} уроков</h2>
          <p class="muted">Каждый урок: правило → слова → 8 заданий. Следующий открывается после прохождения.</p>
        </div>
        <button class="btn primary" id="crCont">${nextLesson() ? "Продолжить: " + nextLesson().title : "Все уроки пройдены!"}</button>
      </div>
      <div class="cr-map">
        ${all.map((l) => {
      const st = p[l.id] || {};
      const ok = st.done, open = unlocked(l.n);
      return `<button class="cr-node ${ok ? "done" : ""} ${open ? "" : "locked"}" data-id="${l.id}">
            <span class="cr-num">${ok ? "✓" : l.n}</span>
            <span class="cr-title">${esc(l.title)}</span>
            <span class="cr-sub">${esc(l.ru)}</span>
            ${st.best != null ? `<span class="cr-score">${st.best}/8</span>` : ""}
            ${open ? "" : '<span class="cr-lock">🔒</span>'}
          </button>`;
    }).join("")}
      </div>`;
    $$(".cr-node", host).forEach((b) => {
      b.onclick = () => {
        const l = data().find((x) => x.id === b.dataset.id);
        if (!l) return;
        if (!unlocked(l.n)) {
          window.DQ && window.DQ.toast && window.DQ.toast("Сначала пройдите предыдущий урок", "ok");
          return;
        }
        openLesson(l);
      };
    });
    const c = $("#crCont");
    if (c) {
      const nl = nextLesson();
      c.onclick = () => nl && openLesson(nl);
      if (!nl) c.disabled = true;
    }
  }

  function nextLesson() {
    return data().find((l) => !isDone(l.id) && unlocked(l.n)) || null;
  }

  /* ============================================================ урок */
  function openLesson(lesson) {
    S.lesson = lesson;
    S.idx = 0;
    S.right = 0;
    S.step = "words";
    S.checked = false;
    render();
    setTimeout(() => { const b = $("#crNext"); if (b) b.focus(); }, 0);
  }

  function render() {
    const l = S.lesson;
    if (!l) return renderMap();
    if (S.step === "words") return renderWords();
    if (S.step === "rule") return renderRule();
    if (S.step === "done") return renderDone();
    if (S.step === "task") return renderTask();
    return renderMap();
  }

  /* --- правило --- */
  function renderRule() {
    const host = $("#courseBody"), l = S.lesson;
    S.step = "rule";
    const text = String(l.rule.body || "").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
    host.innerHTML = `
      <div class="cr-head">
        <button class="link-btn" id="crBack">← к карте</button>
        <span class="muted small">Урок ${l.n} · ${esc(l.title)}</span>
      </div>
      <div class="cr-rule">
        <h2>${art(esc(l.rule.title))}</h2>
        <p>${art(text)}</p>
      </div>
      <div class="cr-actions">
        <button class="btn primary" id="crNext">К практике →</button>
        <span class="muted small cr-kbd">Enter — дальше</span>
      </div>`;
    $("#crBack").onclick = renderMap;
    $("#crNext").onclick = stepForward;
  }

  /* --- слова --- */
  function renderWords() {
    const host = $("#courseBody"), l = S.lesson;
    const w = l.words[S.idx];
    const pct = Math.round((S.idx / l.words.length) * 100);
    host.innerHTML = `
      <div class="cr-head">
        <button class="link-btn" id="crBack">← к карте</button>
        <span class="muted small">Урок ${l.n} · ${esc(l.title)}</span>
        <span class="gv-count" id="crPos">${S.idx + 1}/${l.words.length}</span>
      </div>
      <div class="bar gv-bar"><i style="width:${pct}%"></i></div>
      <div class="cr-flash">
        <div class="cr-flash-word" id="crWord">${art(esc(w[0]))}</div>
        <div class="cr-flash-ru" id="crRu" hidden>${esc(w[1])}</div>
        <div class="muted small">нажмите на слово, чтобы увидеть перевод</div>
      </div>
      <div class="cr-actions">
        <button class="btn ghost" id="crSay"><span class="ico ico-vol"></span> Слушать</button>
        <button class="btn primary" id="crNext">${S.idx + 1 >= l.words.length ? "К правилу →" : "Дальше →"}</button>
        <span class="muted small cr-kbd">Enter — дальше</span>
      </div>`;
    const word = $("#crWord"), ru = $("#crRu");
    word.onclick = () => { ru.hidden = false; say(w[0]); };
    $("#crSay").onclick = () => { say(w[0]); };
    say(w[0]);
    $("#crBack").onclick = renderMap;
    $("#crNext").onclick = stepForward;
  }

  /* --- практика --- */
  function renderTask() {
    const host = $("#courseBody"), l = S.lesson;
    const t = l.tasks[S.taskIdx];
    if (!t) return finishLesson();
    const pct = Math.round((S.taskIdx / l.tasks.length) * 100);
    host.innerHTML = `
      <div class="cr-head">
        <button class="link-btn" id="crBack">← к карте</button>
        <span class="muted small">Практика ${S.taskIdx + 1}/${l.tasks.length}</span>
        <span class="gv-count" id="crPos">${S.right} верно</span>
      </div>
      <div class="bar gv-bar"><i style="width:${pct}%"></i></div>
      <div class="gv-q"><h2>${art(t.q)}</h2></div>
      <div id="crAnswer"></div>
      <div class="gv-feedback" id="crFb"></div>
      <div class="cr-actions">
        <button class="btn primary" id="crCheck">Проверить</button>
        <span class="muted small cr-kbd">Enter — проверить · ещё раз Enter — дальше</span>
      </div>`;
    $("#crBack").onclick = renderMap;
    const area = $("#crAnswer");
    if (t.options) {
      area.innerHTML = `<div class="options cr-options">${t.options.map((o) => `<button class="opt">${art(esc(o))}</button>`).join("")}</div>`;
      $$("#crAnswer .opt").forEach((b) => {
        b.onclick = () => {
          if (S.checked) return;
          $$("#crAnswer .opt").forEach((x) => x.classList.remove("sel"));
          b.classList.add("sel");
          if (window.DQSND) window.DQSND.tap();
        };
      });
    } else {
      area.innerHTML = `<div class="type-row"><input class="input" id="crInput" placeholder="Ответ…" autocomplete="off" spellcheck="false"></div>`;
      setTimeout(() => { const i = $("#crInput"); if (i) i.focus(); }, 30);
    }
    $("#crCheck").onclick = () => {
      if (S.checked) { nextTask(); return; }
      checkTask(t);
    };
  }

  /** Следующее задание (или итог урока). */
  function nextTask() {
    const l = S.lesson;
    S.taskIdx++;
    S.checked = false;
    if (S.taskIdx >= l.tasks.length) return finishLesson();
    S.step = "task";
    render();
  }

  /** Карточки слов — тоже с Enter: дальше → правило → практика. */
  function stepForward() {
    const l = S.lesson;
    if (!l) return;
    if (S.step === "words") {
      if (S.idx + 1 >= l.words.length) { S.step = "rule"; S.checked = false; render(); }
      else { S.idx++; render(); }
      return;
    }
    if (S.step === "rule") {
      S.step = "task"; S.taskIdx = 0; S.right = 0; S.checked = false; render();
    }
  }

  /** Enter — проверить → дальше; 1–6 — выбор варианта. */
  function onKey(e) {
    if (!S.lesson) return;
    if (e.key === "Enter") {
      if (S.step === "words" || S.step === "rule" || S.step === "done") {
        const btn = $("#crNext") || $("#crMap");
        if (btn) { e.preventDefault(); btn.click(); return; }
        if (S.step === "done") { e.preventDefault(); renderMap(); }
        return;
      }
      if (S.step !== "task") return;
      const btn = $("#crCheck");
      if (!btn) return;
      e.preventDefault();
      btn.click();
      return;
    }
    if (S.step === "task" && /^[1-6]$/.test(e.key) && !S.checked) {
      const b = $$("#crAnswer .opt")[parseInt(e.key, 10) - 1];
      if (b) b.click();
    }
  }

  document.addEventListener("keydown", onKey);

  function checkIfDone() { void S; }
  void checkIfDone;

  function norm(s) {
    return String(s || "").toLowerCase().trim()
      .replace(/ß/g, "ss").replace(/[.,!?;:„“"'’]/g, "").replace(/\s+/g, " ");
  }

  function checkTask(t) {
    const l = S.lesson;
    let val = "";
    if (t.options) {
      const sel = $("#crAnswer .opt.sel");
      if (!sel) {
        if (window.DQ && window.DQ.toast) window.DQ.toast("Сначала выберите вариант", "bad");
        return;
      }
      val = sel.textContent;
    } else {
      const inp = $("#crInput");
      val = inp ? inp.value : "";
      if (!String(val).trim()) { inp && inp.focus(); return; }
      if (inp) inp.disabled = true;
    }
    const ok = norm(val) === norm(t.answer);
    S.checked = true;
    if (ok) S.right++;
    if (t.options) {
      $$("#crAnswer .opt").forEach((b) => {
        b.disabled = true;
        const wasSel = b.classList.contains("sel");
        b.classList.remove("sel");
        if (norm(b.textContent) === norm(t.answer)) b.classList.add("correct");
        else if (wasSel) b.classList.add("wrong");   // выбранный неверный — красным
      });
    } else {
      const inp = $("#crInput");
      if (inp) inp.classList.add(ok ? "ok" : "bad");
    }
    const fb = $("#crFb");
    fb.className = "gv-feedback " + (ok ? "ok" : "bad");
    fb.innerHTML = ok ? "Верно!" : `Правильно: <b>${esc(t.answer)}</b>`;
    $("#crCheck").textContent = S.taskIdx + 1 >= l.tasks.length ? "Итог →" : "Дальше →";
    window.DQSND && (ok ? window.DQSND.correct() : window.DQSND.wrong());
    // после проверки фокус — на кнопку: следующее нажатие Enter уже ведёт дальше
    setTimeout(() => { const b = $("#crCheck"); if (b) b.focus(); }, 0);
  }

  /* --- итог --- */
  function finishLesson() {
    const l = S.lesson, p = prog();
    const total = l.tasks.length;
    const pct = Math.round((S.right / total) * 100);
    const passed = pct >= 60;
    const old = p[l.id] || {};
    p[l.id] = { done: passed || old.done, best: Math.max(old.best || 0, S.right), at: Date.now() };
    saveProg(p);
    if (window.DQ && window.DQ.award) window.DQ.award(Math.max(1, S.right * 2));
    S.step = "done";
    const host = $("#courseBody");
    host.innerHTML = `
      <div class="cr-done">
        <div class="ex-score" style="--p:${pct}"><b>${pct}%</b></div>
        <h2>${pct >= 60 ? "Урок пройден!" : "Закрыли, но стоит повторить"}</h2>
        <p class="muted">Верно ${S.right} из ${total}.</p>
        <div class="cr-actions" style="justify-content:center">
          ${pct < 60 ? '<button class="btn primary" id="crAgain">Ещё раз</button>' : ""}
          <button class="btn ghost" id="crMap">К карте</button>
        </div>
      </div>`;
    const ag = $("#crAgain");
    if (ag) ag.onclick = () => { S.taskIdx = 0; S.right = 0; S.checked = false; S.step = "task"; render(); };
    $("#crMap").onclick = renderMap;
  }

  return {
    init() { renderMap(); },
    refresh() { if (S.step === "map") renderMap(); },
    /* игры/карточки проверяют правильность через эту функцию */
    cleanAnswer(s) { return window.DQUI ? window.DQUI.plain(String(s == null ? "" : s)) : String(s == null ? "" : s); },
  };
})();
