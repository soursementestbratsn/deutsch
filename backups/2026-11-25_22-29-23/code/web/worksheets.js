/* ============================================================
   Deutsch Quest — задания / тесты (Übungsblätter).

   Новый набор = новый JSON в папке worksheets/. Ничего здесь менять
   не нужно; новый ТИП задания = добавить объект в TASK_TYPES.
   ============================================================ */
"use strict";

window.DQWorksheets = (function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------- нормализация ответов ---------------- */
  const normalize = (s) => String(s || "")
    .trim()
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[.,!?;:]+$/g, "")   // конечная точка/знак не важны
    .replace(/\s+/g, " ");

  function matchAnswer(user, answers) {
    const got = normalize(user);
    if (!got) return false;
    if (answers.some((a) => normalize(a) === got)) return true;
    // одна опечатка прощается (как в тренажёре): "geflogen" vs "geflogen"
    return answers.some((a) => {
      const t = normalize(a);
      if (!t || got.length < 4 || Math.abs(got.length - t.length) > 2) return false;
      const m = got.length, n = t.length;
      let prev = Array.from({ length: n + 1 }, (_, j) => j);
      for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (got[i - 1] === t[j - 1] ? 0 : 1));
        }
        prev = cur;
      }
      return prev[n] <= (Math.max(m, n) <= 6 ? 1 : 2);
    });
  }

  /** Кнопка озвучки + пары «первая буква + длина» (без спойлера). */
  function sayBtn(text, kind = "") {
    if (!text || !/[A-Za-zÄÖÜäöüß]/.test(text)) return "";
    // в gap/sentence подставляется ответ — озвучка только ПОСЛЕ проверки
    return `<button class="ws-say ws-say-reveal" hidden data-ws-say="${encodeURIComponent(text)}" title="Слушать"><span class="ico ico-vol"></span></button>
            <button class="ws-say slow ws-say-reveal" hidden data-ws-slow="${encodeURIComponent(text)}" title="Медленно"><span class="ico ico-slow"></span></button>${kind}`;
  }

  function bindSay(root) {
    (root || document).querySelectorAll("[data-ws-say],[data-ws-slow]").forEach((b) => {
      if (b._wsSay) return;
      b._wsSay = true;
      b.onclick = (e) => {
        e.preventDefault();
        const t = decodeURIComponent(b.dataset.wsSay || b.dataset.wsSlow || "");
        window.DQVoice && window.DQVoice.say(t, "de", { slow: b.dataset.wsSlow !== undefined });
      };
    });
  }

  /* ============================================================
     ТИПЫ ЗАДАНИЙ
     render(item, i)  → HTML одного пункта
     check(item, i, root) → { ok, correct, skipped? }
     ============================================================ */
  const TASK_TYPES = {
    /* пропуск в тексте: before [input] (mid [input]) after */
    gap: {
      fields: (item) => item.answers.length,
      render(item, i, uid) {
        const cls = item.answers.length > 1 ? "ws-in ws-in-half" : "ws-in";
        const inputs = item.answers.map((_a, sub) =>
          `<input class="${cls}" data-uid="${uid}" data-sub="${sub}" autocomplete="off" spellcheck="false" placeholder="…">`).join(
            item.mid ? `<span class="ws-text">${item.mid}</span>` : "");
        return `
          <div class="ws-item" data-item="${uid}">
            <div class="ws-line">
              <span class="ws-text">${item.before || ""}</span>
              ${inputs}
              <span class="ws-text">${item.after || ""}</span>
              ${sayBtn([item.before, item.answers[0], item.mid, item.answers[1], item.after]
                  .filter(Boolean).join(" ").replace(/\([^)]*\)/g, ""))}
            </div>
            ${item.hint ? `<div class="ws-item-hint">${item.hint}</div>` : ""}
            <div class="ws-fb" hidden></div>
          </div>`;
      },
      check(item, i, root, uid) {
        const inputs = $$(`input[data-uid="${uid}"]`, root);
        const results = inputs.map((el, sub) => {
          const ok = matchAnswer(el.value, [item.answers[sub]]);
          el.classList.toggle("ok", ok);
          el.classList.toggle("bad", !ok);
          el.disabled = true;
          return ok;
        });
        return {
          ok: results.every(Boolean),
          correct: item.answers.join(" … "),
        };
      },
    },

    /* придаточное: префикс + поле до конца предложения */
    sentence: {
      render(item, i, uid) {
        return `
          <div class="ws-item" data-item="${uid}">
            <p class="ws-prompt">${item.sentence1}</p>
            <div class="ws-line">
              <span class="ws-text ws-prefix">${item.prefix}</span>
              <input class="ws-in ws-in-full" data-uid="${uid}" data-sub="0"
                     autocomplete="off" spellcheck="false" placeholder="weil / dass / wenn … (глагол в конце)">
              ${sayBtn((item.prefix || "").replace(/→/g, "") + " " + (item.answers[0] || ""))}
            </div>
            <div class="ws-fb" hidden></div>
          </div>`;
      },
      check(item, i, root, uid) {
        const el = $(`input[data-uid="${uid}"]`, root);
        const ok = matchAnswer(el.value, item.answers);
        el.classList.toggle("ok", ok);
        el.classList.toggle("bad", !ok);
        el.disabled = true;
        return { ok, correct: item.answers[0] };
      },
    },

    /* выбор одного варианта кнопками */
    choice: {
      render(item, i, uid) {
        const opts = (item.options || []).map((o, k) =>
          `<button class="ws-opt" data-uid="${uid}" data-sub="${k}">${o}</button>`).join("");
        return `
          <div class="ws-item" data-item="${uid}">
            <div class="ws-line"><span class="ws-text">${item.before || ""}</span>
              <span class="ws-blank">___</span><span class="ws-text">${item.after || ""}</span>
            </div>
            <div class="ws-opts" data-opts="${uid}">${opts}</div>
            <div class="ws-fb" hidden></div>
          </div>`;
      },
      check(item, i, root, uid) {
        const box = $(`[data-opts="${uid}"]`, root);
        const picked = box ? box.dataset.picked : null;
        const correctIdx = (item.options || []).findIndex((o) => matchAnswer(o, [item.answers[0]]));
        if (box) {
          $$("button", box).forEach((b, k) => {
            b.disabled = true;
            if (k === correctIdx) b.classList.add("ok");
            if (picked !== null && Number(picked) === k && k !== correctIdx) b.classList.add("bad");
          });
        }
        return {
          ok: picked !== null && picked !== undefined && Number(picked) === correctIdx,
          correct: item.answers[0],
        };
      },
    },
  };

  /* связывание кнопок `choice` до проверки */
  function bindChoices(root) {
    $$(".ws-opt", root).forEach((btn) => {
      btn.onclick = () => {
        if (btn.disabled) return;
        const box = btn.closest(".ws-opts");
        $$(".ws-opt", box).forEach((b) => b.classList.remove("sel"));
        btn.classList.add("sel");
        box.dataset.picked = btn.dataset.sub;
        window.DQSND && window.DQSND.tap();
      };
    });
  }

  /* ============================================================
     СОСТОЯНИЕ
     ============================================================ */
  const S = {
    index: [],
    progress: {},
    id: null,
    data: null,
    variant: 0,
  };

  async function api(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(path + " → HTTP " + res.status);
    return res.json();
  }

  /* ============================================================
     СПИСОК НАБОРОВ
     ============================================================ */
  async function loadIndex() {
    const d = await api("/api/worksheets");
    S.index = d.worksheets || [];
    S.progress = d.progress || {};
    return S.index;
  }

  function renderIndex() {
    const box = $("#wsIndex");
    if (!box) return;
    if (!S.index.length) {
      box.innerHTML = `<div class="card"><p class="muted">Пока нет ни одного набора. Добавьте JSON в папку <code>worksheets/</code>.</p></div>`;
      renderIndexHelp();
      return;
    }
    const helps = {};
    box.innerHTML = S.index.map((w) => {
      if (w.globalHelp) helps[w.id] = w.globalHelp;
      const p = S.progress[w.id] || {};
      const done = p.total ? `Лучший результат: ${p.best} / ${p.total}` : "ещё не проходили";
      return `
        <div class="ws-set-card" data-id="${w.id}" tabindex="0" role="button">
          <div class="ws-set-top">
            <span class="ws-level">${w.level}</span>
            <span class="ws-set-count">${w.variantCount} вар. · ${w.taskCount} задач.</span>
          </div>
          <div class="ws-set-title">${w.title}</div>
          <div class="ws-set-sub">${w.subtitle || ""}</div>
          <div class="ws-set-foot">
            <span class="ws-progress-dot ${p.total ? "has" : ""}"></span>
            <span>${done}</span>
            <span class="ws-open">Открыть →</span>
          </div>
        </div>`;
    }).join("");
    renderIndexHelp(helps);
    $$(".ws-set-card", box).forEach((el) => {
      const open = () => openWorksheet(el.dataset.id);
      el.onclick = open;
      el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
    });
  }

  /* «Помощь» прямо на экране каталога: `globalHelp` из JSON набора.
     Так шпаргалка доступна ещё до открытия теста. */
  function renderIndexHelp(sets) {
    const has = sets && Object.keys(sets).length;
    const old = $("#wsIndexHelp");
    if (old) old.remove();
    if (!has) return;
    const html = Object.entries(sets).map(([id, h]) => {
      const body = h.sections
        ? h.sections.map((s) => `<h4 class="ws-help-h">${s.title}</h4><div class="ws-help-body">${s.text}</div>`).join("")
        : `<div class="ws-help-body">${h.text || ""}</div>`;
      return `<details class="ws-help ws-help-global"><summary><span><span class="ico ico-bulb"></span>
        ${h.summary || "Помощь"}</span><span class="ws-chev">▾</span></summary>
        <div class="ws-help-body">${body}</div></details>`;
    }).join("");
    const wrapEl = document.createElement("div");
    wrapEl.id = "wsIndexHelp";
    wrapEl.className = "card ws-index-help";
    wrapEl.innerHTML = html;
    const host = $("#wsCatalogView");
    const index = $("#wsIndex");
    if (host && index) host.insertBefore(wrapEl, index.nextSibling);
  }

  /* ============================================================
     ОТКРЫТИЕ НАБОРА
     ============================================================ */
  async function openWorksheet(id) {
    S.id = id;
    S.data = await api("/api/worksheet/" + encodeURIComponent(id));
    S.variant = 0;
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderWorksheet();
  }

  function closeWorksheet() {
    S.id = null;
    S.data = null;
    renderWorksheet();
    renderIndex();
    if (window.showView) window.showView("worksheets");
  }

  function currentVariant() {
    return (S.data && S.data.variants[S.variant]) || { tasks: [], vocab: [] };
  }

  /* ------------------------------------------------------------ */
  function renderWorksheet() {
    const hostBox = $("#wsSheet");
    const w = S.data;
    const catalog = $("#wsCatalogView");
    if (!w) {
      hostBox.innerHTML = "";
      hostBox.hidden = true;
      if (catalog) catalog.hidden = false;
      // Скрываем нижнюю панель «Сбросить / Проверить» — иначе она висит
      // на всех остальных экранах после выхода из теста.
      renderActionBar();
      return;
    }
    if (catalog) catalog.hidden = true;
    hostBox.hidden = false;
    const v = currentVariant();

    const variantButtons = w.variants.map((vv, k) =>
      `<button class="${k === S.variant ? "active" : ""}" data-v="${k}">${vv.name}</button>`).join("");

    hostBox.innerHTML = `
      <div class="ws-head card">
        <div class="ws-head-buttons">
          <button class="btn ghost small" id="wsBack">← Все задания</button>
          <div class="segmented" id="wsVariants">${variantButtons}</div>
        </div>
        <div class="ws-head-title">
          <span class="ws-level">${w.level}</span>
          <h2 class="ws-big">${w.title}</h2>
        </div>
        <p class="muted">${w.subtitle || ""}</p>
      </div>

      <div id="wsTasks"></div>

      ${v.vocab && v.vocab.length ? `
      <section class="card ws-vocab">
        <div class="ws-vocab-head">
          <h3>Словарик варианта</h3>
          <span class="ws-level ws-level-soft">${v.vocab.length} слов</span>
        </div>
        <div class="ws-vocab-grid">
          ${v.vocab.map((x) => `<div class="ws-vocab-item"><span class="de">${x.de}</span>
            <button class="ws-say" data-ws-say="${encodeURIComponent(x.de)}" title="Слушать"><span class="ico ico-vol"></span></button>
            <span class="ru">${x.ru}</span></div>`).join("")}
        </div>
      </section>` : ""}
    `;

    const tasksBox = $("#wsTasks");
    tasksBox.innerHTML = v.tasks.map((task, ti) => {
      const renderer = TASK_TYPES[task.type];
      if (!renderer) {
        return `<section class="card ws-task ws-task-missing">
            Задание «${task.type}» — неизвестный тип. Добавьте его в TASK_TYPES (web/worksheets.js).
          </section>`;
      }
      // uid уникален внутри листа: «задание-пункт», а не номер пункта
      const itemsHtml = task.items.map((item, i) => renderer.render(item, i, ti + "-" + i)).join("");
      return `
        <section class="card ws-task" data-type="${task.type}" id="wsTask${ti}">
          <div class="ws-task-head">
            <h3><span class="ws-num">${ti + 1}</span> ${task.title || ""}</h3>
            <div class="ws-task-side">
              ${task.badge ? `<span class="ws-badge">${task.badge}</span>` : ""}
              <span class="ws-task-prog" data-prog="${ti}"></span>
            </div>
          </div>
          ${task.instruction ? `<p class="ws-instruction">${task.instruction}</p>` : ""}
          ${task.help ? `
            <details class="ws-help">
              <summary><span><span class="ico ico-bulb"></span> ${task.help.summary || "Подсказка"}</span><span class="ws-chev">▾</span></summary>
              <div class="ws-help-body">${task.help.text || ""}</div>
            </details>` : ""}
          <div class="ws-items">${itemsHtml}</div>
        </section>`;
    }).join("");

    bindChoices(tasksBox);
    bindTaskProgress(tasksBox, v);
    bindSay(tasksBox);

    $("#wsBack").onclick = closeWorksheet;
    $$("#wsVariants button").forEach((b) => {
      b.onclick = () => {
        S.variant = Number(b.dataset.v);
        renderWorksheet();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    });

    updateScore("Заполни пропуски и нажми «Проверить»");
    renderActionBar();
    bindProgressCounter(tasksBox);
  }

  /** Прогресс по каждому заданию: «3/10» рядом с бейджом. */
  function bindTaskProgress(root, variant) {
    const update = () => {
      variant.tasks.forEach((task, ti) => {
        const badge = $(`[data-prog="${ti}"]`, root);
        if (!badge) return;
        let filled = 0, total = 0;
        task.items.forEach((_it, i) => {
          const inputs = $$(`input[data-uid="${ti}-${i}"]`, root);
          if (inputs.length) {
            total++;
            if (inputs.every((el) => el.value.trim())) filled++;
          } else {
            total++;
            const box = $(`[data-opts="${ti}-${i}"]`, root);
            if (box && box.dataset.picked !== undefined) filled++;
          }
        });
        badge.textContent = `${filled}/${total}`;
        badge.classList.toggle("full", filled === total && total > 0);
      });
    };
    $$("input.ws-in", root).forEach((i) => i.addEventListener("input", update));
    root.addEventListener("click", (e) => {
      if (e.target.closest(".ws-opt, .g-tile, [data-g]")) setTimeout(update, 0);
    });
    update();
  }

  /** Живой счётчик «заполнено N из M» в нижней панели. */
  function bindProgressCounter(root) {
    const total = $$("input.ws-in", root).length;
    if (!total) return;
    const onInput = () => {
      const filled = $$("input.ws-in", root).filter((i) => i.value.trim()).length;
      const el = $("#wsScore");
      if (!el || S.checked) return;
      el.innerHTML = `Заполнено <b>${filled}</b> из ${total}` +
        (filled === total ? " · можно проверять" : "");
    };
    $$("input.ws-in", root).forEach((i) => {
      i.addEventListener("input", onInput);
    });
    onInput();
  }

  /* нижняя панель: счёт + действия */
  function renderActionBar() {
    const bar = $("#wsAction");
    if (!bar) return;
    if (!S.data) { bar.innerHTML = ""; bar.classList.remove("open"); return; }
    bar.classList.add("open");
    bar.classList.remove("done");
    bar.innerHTML = `
      <div class="ws-action-inner">
        <div id="wsScore" class="ws-score">Заполни пропуски и нажми «Проверить»</div>
        <div class="ws-action-btns">
          <button class="btn ghost small" id="wsReset">Сбросить</button>
          <button class="btn primary small" id="wsCheck">Проверить ответы</button>
        </div>
      </div>`;
    $("#wsCheck").onclick = checkAll;
    $("#wsReset").onclick = renderWorksheet;
  }

  function updateScore(html) {
    const el = $("#wsScore");
    if (el) el.innerHTML = html;
  }

  /* ============================================================
     ПРОВЕРКА
     ============================================================ */
  function feedback(item, uid, root, res) {
    const fb = $(`.ws-item[data-item="${uid}"] .ws-fb`, root);
    if (!fb) return;
    fb.hidden = false;
    fb.className = "ws-fb " + (res.ok ? "ok" : "bad");
    const expl = item.explanation ? `<span class="ws-expl">${item.explanation}</span>` : "";
    fb.innerHTML = res.ok
      ? `<b>✓ Верно!</b> ${expl}`
      : `<b>✗ Правильный ответ: <u>${res.correct}</u></b>${expl}`;
    if (window.DQFX) {
      if (res.ok) window.DQFX.pop(fb.parentElement?.querySelector(".ws-line") || fb);
      else window.DQFX.shake(fb.parentElement || fb);
    }
  }

  async function checkAll() {
    if (!S.data) return;
    const v = currentVariant();
    const root = $("#wsTasks");
    let total = 0, correct = 0;
    const answered = [];

    // один проход: каждый пункт проверяется ровно один раз
    v.tasks.forEach((task, ti) => {
      const renderer = TASK_TYPES[task.type];
      if (!renderer) return;
      task.items.forEach((item, i) => {
        total++;
        const uid = ti + "-" + i;
        let res = renderer.check(item, i, root, uid);
        if (res.pending) res = res.resolve();
        if (res.ok) correct++;
        feedback(item, uid, root, res);
        // звук по каждому пункту (верно / неверно), не дожидаясь итога
        if (window.DQSND) window.DQSND.play(res.ok ? "correct" : "wrong");
        answered.push(!!res.ok);
      });
    });

    // после проверки показываем кнопки озвучки (раньше были спрятаны)
    $$(".ws-say-reveal", root).forEach((b) => { b.hidden = false; });
    bindSay(root);

    const percent = total ? Math.round((correct / total) * 100) : 0;
    const mood = percent === 100 ? "Отлично" : percent >= 70 ? "Хорошо" : "Есть над чем поработать";
    updateScore(`Результат: <b>${correct} из ${total}</b> (${percent}%) · ${mood}`);
    if (window.DQSND && answered.length > 2) window.DQSND.play(percent >= 70 ? "success" : "lose");
    if (percent === 100 && window.DQFX) window.DQFX.confetti(24);
    const btn = $("#wsCheck");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Проверено";
    }
    $("#wsAction").classList.add("done");

    // прогресс + XP (сервер пишет в de_lernen_stats.json)
    try {
      const d = await api("/api/worksheet/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: S.id, variant: S.variant, total, correct }),
      });
      if (window.DQ && d.stats) window.DQ.applyStats(d.stats);
      S.progress[S.id] = (d.stats && d.stats.worksheets || {})[S.id] || S.progress[S.id];
      // отложенный повтор ошибок: слова из проваленных пунктов — пораньше
      if (window.DQ && window.DQ.srs) {
        const missed = [];
        v.tasks.forEach((task, ti) => {
          (task.items || []).forEach((item, i) => {
            const inputs = $$(`input[data-uid="${ti}-${i}"]`, root);
            const bad = inputs.some((el) => el.classList.contains("bad"));
            const box = $(`[data-opts="${ti}-${i}"]`, root);
            const picked = box && box.dataset.picked;
            const pb = box && picked != null ? box.querySelector(`button[data-sub="${picked}"]`) : null;
            const badChoice = !!(pb && !pb.classList.contains("ok"));
            if (bad || badChoice) missed.push(item);
          });
        });
        // ошибки — повторяем завтра (box 0), верные пункты — как обычно
        missed.forEach((item) => {
          const words = String((item.answers || []).join(" ") || item.sentence1 || "")
            .match(/[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*/g) || [];
          words.forEach((w) => window.DQ.srs.record(w, false));
        });
      }
    } catch (e) { /* прогресс не критичен для проверки */ }
  }

  /* ============================================================
     СТАРТ
     ============================================================ */
  async function init() {
    try {
      await loadIndex();
      renderIndex();
      const info = $("#wsCatalogInfo");
      if (info) info.textContent = `${S.index.length} наб. · ${S.index.reduce((n, w) => n + w.taskCount, 0)} задач`;
    } catch (e) {
      const box = $("#wsIndex");
      if (box) box.innerHTML = `<div class="card"><p class="muted">Сервер недоступен: ${e.message}</p></div>`;
    }
  }

  /* Вызывается при уходе с экрана «Задания»: гасим нижнюю панель. */
  function leave() {
    const bar = $("#wsAction");
    if (bar) { bar.classList.remove("open", "done"); bar.innerHTML = ""; }
  }

  return {
    init, renderIndex, openWorksheet, closeWorksheet, checkAll, leave,
    isOpen: () => !!S.data,
    /* id → человекочитаемое название (для экрана статистики) */
    get titles() {
      const map = {};
      S.index.forEach((w) => { map[w.id] = w.title; });
      return map;
    },
  };
})();