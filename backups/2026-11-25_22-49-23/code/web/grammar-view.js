/* ============================================================
   Deutsch Quest — ЭКРАН «Грамматика» (window.DQGrammarView)

   Набор из 10 упражнений по выбранному правилу (генератор — web/grammar.js).
   Типы задания: выбор варианта, ввод ответа, сборка предложения.
   ============================================================ */
"use strict";

window.DQGrammarView = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const S = { module: null, tasks: [], i: 0, right: 0, checked: false, mode: "index" };

  function renderIndex() {
    const host = $("#gvBody");
    if (!host) return;
    S.mode = "index";
    const mods = window.DQGrammatik.modules();
    host.innerHTML = `
      <div class="gv-grid">
        ${mods.map((m) => `
          <button class="gv-card" data-mod="${m.id}">
            <span class="ico ${m.icon}"></span>
            <b>${esc(m.title)}</b>
            <span class="muted small">${esc(m.sub)}</span>
          </button>`).join("")}
      </div>`;
    $$(".gv-card", host).forEach((b) => { b.onclick = () => start(b.dataset.mod); });
  }

  function start(mod) {
    S.module = mod;
    S.tasks = window.DQGrammatik.generate(mod, 10);
    S.i = 0; S.right = 0; S.checked = false; S.mode = "quiz";
    render();
  }

  /** Фото немецкого слова, о котором задание (если у слова есть фото в «Словаре»). */
  function photoRow(t) {
    const src = [t.answer, t.word, t.prompt].find((s) => /^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*$/.test(String(s || "").trim()));
    const img = src ? window.DQUI.photoHtml(src, { size: 200, cls: "gv-photo" }) : "";
    return img ? `<div class="gv-photo-box">${img}</div>` : "";
  }

  function questionHtml(t, mod) {
    const pct = Math.round((S.i / S.tasks.length) * 100);
    return `
      <div class="gv-head">
        <button class="link-btn" id="gvBack">← все правила</button>
        <span class="muted small">${esc(mod.title || "")}</span>
        <span class="gv-count">${S.i + 1} / ${S.tasks.length}</span>
      </div>
      <div class="bar gv-bar"><i style="width:${pct}%"></i></div>
      <div class="gv-q">
        <div class="muted small">${esc(t.skill)}</div>
        <h2>${esc(t.prompt)}</h2>
        ${t.sentence ? `<div class="gv-sent">${esc(t.sentence).replace(/___/g, "<span class='gv-gap'>___</span>")}</div>` : ""}
        ${t.words ? `<div class="gv-words" id="gvWords">${t.words.map((w) => `<button class="tr-chip gv-word" data-w="${esc(w)}">${esc(w)}</button>`).join("")}</div>
          <div class="gv-built muted small" id="gvBuilt">Ваше предложение: —</div>` : ""}
        ${!t.words && window.DQUI ? photoRow(t) : ""}
      </div>
      <div class="gv-answer" id="gvAnswer"></div>
      <div class="gv-feedback" id="gvFb"></div>
      <div class="gv-actions">
        <button class="btn primary" id="gvBtn">Проверить</button>
        <button class="btn ghost" id="gvSkip">Пропустить</button>
      </div>`;
  }

  function render() {
    const host = $("#gvBody");
    if (!host) return;
    if (S.i >= S.tasks.length) return finish();
    const t = S.tasks[S.i];
    const mod = window.DQGrammatik.modules().find((m) => m.id === S.module) || {};
    host.innerHTML = questionHtml(t, mod);
    $("#gvBack").onclick = renderIndex;

    const area = $("#gvAnswer");
    if (t.words) {
      // сборка предложения: кликаем слова по порядку, повторный клик — убрать
      area.innerHTML = "";
      $$(".gv-word").forEach((b) => {
        b.onclick = () => {
          if (S.checked) return;
          const on = b.classList.toggle("on");
          b.style.order = on ? String(++S.orderSeq) : "";
          const built = $$(".gv-word.on").sort((x, y) => (+x.style.order) - (+y.style.order))
            .map((x) => x.dataset.w);
          $("#gvBuilt").textContent = "Ваше предложение: " + (built.join(" ") || "—");
        };
      });
      S.orderSeq = 0;
    } else if (t.options) {
      area.innerHTML = `<div class="options">${t.options.map((o) =>
        `<button class="opt" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
      $$("#gvAnswer .opt").forEach((b) => {
        b.onclick = () => {
          if (S.checked) return;
          $$("#gvAnswer .opt").forEach((x) => x.classList.remove("sel"));
          b.classList.add("sel");
        };
      });
    } else {
      area.innerHTML = `<div class="type-row"><input class="input" id="gvInput" placeholder="Напишите ответ…" autocomplete="off" spellcheck="false"></div>`;
      $("#gvInput").onkeydown = (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        S.checked ? next() : check($("#gvInput").value);
      };
      setTimeout(() => { const i = $("#gvInput"); if (i) i.focus(); }, 30);
    }

    $("#gvBtn").onclick = () => {
      if (S.checked) return next();
      if (t.words) {
        const val = $$(".gv-word.on").sort((x, y) => (+x.style.order) - (+y.style.order)).map((x) => x.dataset.w).join(" ");
        if (!val) return feedback("warn", "Соберите предложение из слов.");
        return check(val);
      }
      if (t.options) {
        const sel = $("#gvAnswer .opt.sel");
        if (!sel) return feedback("warn", "Выберите вариант.");
        return check(sel.dataset.v);
      }
      return check($("#gvInput").value);
    };
    $("#gvSkip").onclick = () => { S.i++; S.checked = false; render(); };
  }

  function feedback(cls, html) {
    const fb = $("#gvFb");
    if (!fb) return;
    fb.className = "gv-feedback " + cls;
    fb.innerHTML = html;
  }

  function norm(s) {
    return String(s || "").toLowerCase().trim()
      .replace(/ß/g, "ss").replace(/[.,!?;:„“"'’]/g, "").replace(/\s+/g, " ");
  }

  function check(user) {
    const t = S.tasks[S.i];
    const ok = norm(user) === norm(t.answer);
    S.checked = true;
    if (ok) S.right++;
    if (t.options) {
      $$("#gvAnswer .opt").forEach((b) => {
        b.disabled = true;
        if (norm(b.dataset.v) === norm(t.answer)) b.classList.add("correct");
        else if (b.classList.contains("sel")) b.classList.add("wrong");
      });
    }
    const input = $("#gvInput");
    if (input) { input.disabled = true; input.classList.add(ok ? "ok" : "bad"); }
    if (t.words) $$(".gv-word").forEach((b) => { b.disabled = true; });
    feedback(ok ? "ok" : "bad",
      `<b>${ok ? "Верно!" : "Правильно:"}</b> ${esc(t.answer)}` +
      (t.explain ? `<div class="gv-explain">${t.explain}</div>` : ""));
    if (window.DQSND) ok ? window.DQSND.correct() : window.DQSND.wrong();
    $("#gvBtn").textContent = S.i + 1 >= S.tasks.length ? "Итог →" : "Дальше →";
    $("#gvBtn").onclick = next;
    // ошибки грамматики — в «Слабые места» статистики
    try {
      if (!ok && window.DQ && window.DQ.stats) {
        const st = window.DQ.stats;
        const list = Array.isArray(st.mistakes) ? st.mistakes.slice() : [];
        const nm = t.answer;
        const at = list.findIndex((m) => m && m[0] === nm);
        if (at >= 0) list.splice(at, 1);
        list.push([nm, t.skill]);
        st.mistakes = list.slice(-200);
        window.DQ.batch({ mistakes: st.mistakes });
      }
    } catch (e) { }
  }

  function next() {
    S.checked = false;
    S.i++;
    render();
  }

  function finish() {
    const host = $("#gvBody");
    S.mode = "done";
    const pct = Math.round((S.right / S.tasks.length) * 100);
    const mod = window.DQGrammatik.modules().find((m) => m.id === S.module) || {};
    host.innerHTML = `
      <div class="gv-done">
        <div class="ex-score" style="--p:${pct}"><b>${pct}%</b></div>
        <h2>${esc(mod.title || "")}</h2>
        <p class="muted">Правильно ${S.right} из ${S.tasks.length}${pct >= 80 ? " — отлично!" : pct >= 50 ? " — уже близко." : " — правило стоит повторить."}</p>
        <div class="gv-actions" style="justify-content:center">
          <button class="btn primary" id="gvAgain">Ещё раз</button>
          <button class="btn ghost" id="gvAll">Другое правило</button>
        </div>
      </div>`;
    $("#gvAgain").onclick = () => start(S.module);
    $("#gvAll").onclick = renderIndex;
    if (window.DQ && window.DQ.award) window.DQ.award(S.right * 2);
  }

  return {
    init() { if (S.mode === "index") renderIndex(); },
    renderIndex, start,
  };
})();
