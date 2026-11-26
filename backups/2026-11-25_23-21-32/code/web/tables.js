/* ============================================================
   Deutsch Quest — ТАБЛИЦЫ ГРАММАТИКИ (A1–B1)

   Данные: worksheets/grammatik-tables.json
     { sections: [ { id, title, subtitle, icon, tables: [
         { title, headers: [...], rows: [[...], ...] } ] } ] }

   Как добавить таблицу: откройте JSON и добавьте объект в нужный раздел —
   этот файл править не нужно. Новый раздел — новый объект в sections.
   ============================================================ */
"use strict";

window.DQTables = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const S = { data: null, filter: "" };

  async function load() {
    if (S.data) return S.data;
    const res = await fetch("/api/tables", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    S.data = await res.json();
    return S.data;
  }

  /** Подсветка для ячеек: ключи падежей и «—» в таблицах падежей. */
  function cellClass(cell) {
    const c = String(cell);
    if (/^(Nominativ|Genitiv|Dativ|Akkusativ)$/i.test(c)) return " tbl-case";
    if (c === "—" || c === "-") return " tbl-dash";
    if (/^(m|f|n|pl)$/i.test(c)) return " tbl-genus";
    return "";
  }

  function renderTable(t) {
    const cols = t.headers.length;
    return `
      <section class="tbl-card card" data-search="${escape((t.title + " " + t.headers.join(" ") + " " +
      t.rows.map((r) => r.join(" ")).join(" ")).toLowerCase())}">
        <div class="tbl-head">
          <h4>${t.title}</h4>
          <span class="tbl-count">${t.rows.length} строк</span>
        </div>
        <div class="tbl-wrap">
          <table class="grammar-table${cols >= 5 ? " wide" : ""}">
            <thead><tr>${t.headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
            <tbody>
              ${t.rows.map((r) => `<tr>${r.map((c) => `<td class="${cellClass(c)}">${c}</td>`).join("")}</tr>`).join("")}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function render() {
    const box = $("#tablesBox");
    if (!box || !S.data) return;
    const f = S.filter.trim().toLowerCase();
    box.innerHTML = S.data.sections.map((sec, si) => `
      <section class="tbl-section" data-sec="${sec.id}">
        <div class="tbl-section-head">
          <span class="tbl-icon">${sec.icon || "📘"}</span>
          <div>
            <h2 class="tbl-section-title">${sec.title}</h2>
            <p class="muted">${sec.subtitle || ""}</p>
          </div>
          <span class="tbl-badge">${sec.tables.length} табл.</span>
        </div>
        <div class="tbl-grid">
          ${sec.tables.map(renderTable).join("")}
        </div>
      </section>`).join("");

    // поиск: скрываем таблицы и пустые разделы
    if (f) {
      $$(".tbl-card", box).forEach((c) => {
        c.hidden = !c.dataset.search.includes(f);
      });
      $$(".tbl-section", box).forEach((s) => {
        const visible = $$(".tbl-card", s).filter((c) => !c.hidden).length;
        s.hidden = visible === 0;
        const badge = $(".tbl-badge", s);
        if (badge) badge.textContent = visible + " из " + $$(".tbl-card", s).length;
      });
    }

    // мягкое появление карточек (каскад) и подсветка совпадений
    if (window.DQFX) window.DQFX.stagger(box, ".tbl-card");
    if (f) $$(".tbl-card:not([hidden])", box).forEach((c) => highlight(c, f));
  }

  /** Подсветка совпадений поиска внутри ячеек. */
  function highlight(card, needle) {
    $$("td, th, h4", card).forEach((cell) => {
      if (cell.dataset.plain === undefined) cell.dataset.plain = cell.innerHTML;
      const plain = cell.dataset.plain;
      const lower = plain.toLowerCase();
      const at = lower.indexOf(needle);
      if (at < 0) { cell.innerHTML = plain; return; }
      // вставляем <mark> вокруг первого совпадения (без ломки HTML-тегов)
      const before = plain.slice(0, at);
      const hit = plain.slice(at, at + needle.length);
      const after = plain.slice(at + needle.length);
      cell.innerHTML = `${before}<mark class="tbl-mark">${hit}</mark>${after}`;
    });
  }

  async function init() {
    const box = $("#tablesBox");
    if (!box) return;
    try {
      await load();
      render();
    } catch (e) {
      box.innerHTML = `<div class="card"><p class="muted">Не удалось загрузить таблицы: ${escape(e.message)}</p></div>`;
      return;
    }
    const search = $("#tblSearch");
    if (search) {
      search.oninput = () => {
        S.filter = search.value;
        render();
      };
    }
  }

  return { init, render };
})();