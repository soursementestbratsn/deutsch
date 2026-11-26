/* ============================================================
   Deutsch Quest — ОБЩИЕ МЕЛОЧИ ДЛЯ ВСЕХ ЭКРАНОВ (window.DQUI)

   1) der / die / das — подсветка артикля цветом:
        der — синий · die — красный · das — зелёный
      art(html)       — заменить артикли в готовой HTML-строке на <b class="dq-art art-der">…
      paint(root)     — то же для текстовых узлов внутри узла (без потери слушателей)
      plain(text)     — текст без разметки (для aria/title)
      of(word)        — артикль слова: "der" | "die" | "das" | "" (из словаря или по окончанию)

   2) Фото к словам (пишет пользователь на экране «Словарь»):
      photo(word)     — ссылка на картинку или ""
      photoHtml(word, opts) — красивый кружок с фото (или пусто, если фото нет)
      reload()        — перечитать список фото с сервера

   Настройки (панель → «Внешний вид»):
      articles   — подсвечивать артикли
      wordPhotos — показывать фото слов
      photoMax   — сколько фото на экран (чтобы не тормозить)
   ============================================================ */
"use strict";

window.DQUI = (function () {
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const ui = () => (window.SETTINGS && window.SETTINGS.ui) || {};
  const on = (key, fallback = true) => {
    const v = ui()[key];
    return v === undefined ? fallback : !!v;
  };

  /* ------------------------------------------------------------
     1. АРТИКЛИ
     ------------------------------------------------------------ */
  function slot(word) {
    return String(word || "").trim().toLowerCase()
      .replace(/[„“"'«»]/g, "")
      .replace(/^(der|die|das|ein|eine)\s+/, "")
      .replace(/[.,;:!?]+$/, "")
      .trim();
  }

  /** Артикль слова: берём из словаря (words.txt), иначе — по окончанию. */
  function of(word) {
    const raw = String(word || "").trim();
    if (!raw) return "";
    const m = raw.match(/^(der|die|das)\s+/i);
    if (m) return m[1].toLowerCase();
    const key = slot(raw);
    if (!key) return "";
    const pool = (window.DQ && window.DQ.pool) || [];
    for (const p of pool) {
      if (!p || !p[0]) continue;
      const mm = String(p[0]).match(/^(der|die|das)\s+(.+)$/i);
      if (mm && slot(mm[2]) === key) return mm[1].toLowerCase();
    }
    return "";
  }

  const ART_RE = /(^|[^\p{L}])(der|die|das)(?=$|[^\p{L}])/giu;

  /** «der Stuhl» → «<b class="dq-art art-der">der</b> Stuhl». */
  function art(html) {
    const s = String(html == null ? "" : html);
    if (!on("articles") || !s) return s;
    return s.replace(ART_RE, (_all, pre, a) =>
      pre + `<b class="dq-art art-${a.toLowerCase()}">${a}</b>`);
  }

  /** Для текста подсказки/озвучки — без цветов. */
  function plain(s) { return String(s == null ? "" : s); }

  const SKIP = new Set(["SCRIPT", "STYLE", "INPUT", "TEXTAREA", "CODE", "kbd".toUpperCase(), "OPTION"]);

  /** Подсветить артикли в текстовых узлах (сохраняет разметку и слушатели). */
  function paint(root) {
    if (!root || !on("articles")) return root;
    let nodes = [];
    try {
      const doc = root.ownerDocument || document;
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          if (!ART_RE.test(n.nodeValue || "")) return NodeFilter.FILTER_REJECT;
          ART_RE.lastIndex = 0;
          const p = n.parentElement;
          if (!p || SKIP.has(p.tagName) || p.closest(".dq-art, .type-row, .q-text.q-blur")) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!/[A-Za-zÄÖÜäöüß]/.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      while (walker.nextNode()) nodes.push(walker.currentNode);
    } catch (e) { nodes = []; }
    nodes.forEach((n) => {
      const txt = n.nodeValue || "";
      const frag = document.createDocumentFragment();
      let last = 0;
      ART_RE.lastIndex = 0;
      let m;
      while ((m = ART_RE.exec(txt))) {
        const start = m.index + m[1].length;
        if (start > last) frag.appendChild(document.createTextNode(txt.slice(last, start)));
        const b = document.createElement("b");
        b.className = "dq-art art-" + m[2].toLowerCase();
        b.textContent = m[2];
        frag.appendChild(b);
        last = start + m[2].length;
      }
      if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
      try { n.parentNode.replaceChild(frag, n); } catch (e) { /* узел уже удалён */ }
    });
    return root;
  }

  /* ------------------------------------------------------------
     2. ФОТО К СЛОВАМ
     ------------------------------------------------------------ */
  let PHOTOS = null;          // {ключ: {file, at, w, h}}
  let LOADING = null;

  function photos() { return PHOTOS || {}; }

  async function reload() {
    LOADING = fetch("/api/vocab")
      .then((r) => r.json())
      .then((d) => { PHOTOS = d.photos || {}; return PHOTOS; })
      .catch(() => { PHOTOS = PHOTOS || {}; return PHOTOS; })
      .finally(() => { LOADING = null; });
    return LOADING;
  }

  /** Фото слова: точное совпадение ключа, иначе — единственное фото с той же основой
      (слово в тексте бывает в другой форме: «Häuser» → фото к «Haus»). */
  function photo(word) {
    const all = photos();
    const key = slot(word);
    if (!key) return "";
    let e = all[key];
    if (!e || !e.file) {
      const cands = Object.keys(all).filter((k) => all[k] && all[k].file &&
        (k.startsWith(key) || key.startsWith(k)) && Math.abs(k.length - key.length) <= 2);
      e = cands.length === 1 ? all[cands[0]] : null;
    }
    return e && e.file ? "/photos/" + e.file : "";
  }

  /** Сколько фото уже показано на странице (ограничение ui.photoMax). */
  let shown = 0;
  void shown;
  const maxShown = () => {
    const n = Number(ui().photoMax);
    return n > 0 ? n : 60;
  };

  /** Кружок с фото. opts: size (px), cls — доп.классы, card — крупнее. */
  function photoHtml(word, opts) {
    const o = opts || {};
    if (!word || !on("wordPhotos")) return "";   // настройка «Рисунки к словам»
    const src = photo(word);
    if (!src) return "";
    const size = Number(o.size) || 44;
    const style = `style="--ph:${size}px"`;
    return `<img class="dq-photo ${esc(o.cls || "")}" src="${src}" alt="" loading="lazy" ${style} data-ph="${esc(slot(word))}">`;
  }

  /** Фото под уже готовой строкой, где слово выделено: <span class="tt">Haus</span>.
      Нужен экранам-спискам (правила, таблицы, тексты): там фото ставится
      последним в строке, а название слова остаётся чистым. */
  const T = '<span class="tt">';
  function photoTail(html) {
    if (!html || typeof html !== "string" || !on("wordPhotos")) return html;
    const rowRe = /<(?:p|h1|h2|h3|h4|h5|h6|li|td|th|dt|dd|div|blockquote)\b[^>]*>[\s\S]*?<\/(?:p|h1|h2|h3|h4|h5|h6|li|td|th|dt|dd|div|blockquote)>/g;
    let n = 0;
    const max = maxShown();
    return String(html).replace(rowRe, (row) => {
      if (/<img\b/.test(row) || !row.includes(" class=\"tt\"")) return row;
      const m = row.match(/class="tt"[^>]*>([^<]{2,40})</);
      if (!m) return row;
      if (n++ >= max) return row;
      const img = photoHtml(m[1], { size: 96, cls: "tt-photo" });
      if (!img) return row;
      const close = row.lastIndexOf("</");
      return close > 0 ? row.slice(0, close) + img + row.slice(close) : row + img;
    });
  }

  /** Ограничитель: не рисовать больше photoMax картинок на экране. */
  function limit(html) {
    if (!html) return "";
    const max = maxShown();
    let n = 0;
    return html.replace(/<img class="dq-photo\b[^>]*>/g, (tag) => (n++ < max ? tag : ""));
  }

  /** Сбросить счётчик перед новой отрисовкой экрана. */
  function resetLimit() { shown = 0; }

  /* ------------------------------------------------------------
     3. Автоподсветка новых данных (для экранов без ручного вызова)
     ------------------------------------------------------------ */
  function watch() {
    if (!window.MutationObserver) return;
    let t = null;
    const obs = new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        document.querySelectorAll(".my-grid, .gv-q, .cr-flash, .wod-de, .q-text")
          .forEach((el) => { if (!el.querySelector(".dq-art")) paint(el); });
      }, 120);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: false });
  }

  function init() {
    if (PHOTOS === null) reload();
    watch();
    watchBroken();
  }

  /* Удалённое из «Словаря» фото не должно оставлять битую картинку
     (разметка уже нарисована на экране). */
  function watchBroken() {
    document.addEventListener("error", (e) => {
      const img = e.target;
      if (img && img.tagName === "IMG" && img.classList && img.classList.contains("dq-photo")) {
        img.classList.add("broken");
      }
    }, true);
  }

  const ready = () => {
    if (PHOTOS === null) reload();
    watch();
    watchBroken();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else setTimeout(ready, 0);

  return {
    slot, art, paint, plain, of, esc,
    photo, photoHtml, photos, reload, limit, resetLimit, init, photoTail,
  };
})();
