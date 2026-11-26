/* ============================================================
   Deutsch Quest — КАРТОЧКА ПЕРЕВОДА ПО КЛИКУ (window.DQWordPop)

   Клик по немецкому слову или выделение целой фразы открывает окно:
     • само слово / фраза и перевод;
     • как читать: IPA, слоги и русская транскрипция (window.DQPhon);
     • «Слушать» / «Медленно» (window.DQVoice);
     • для фразы — разбор по словам (перевод каждого слова);
     • «Сохранить в слова́рь» — попадает в экран «Мои слова».

   Порядок поиска перевода:
     1) словарь на странице (пул тренажёра, словарик задания);
     2) сервер /api/tr/lookup — свои словари, затем Wiktionary / MyMemory,
        результат записывается в user_words.json (отдельный файл);
     3) если перевода нет — так и пишем.

   ВАЖНО: каждое нажатие записывается в «Мои слова» (даже без перевода),
   чтобы потом можно было открыть экран, посмотреть и повторить слова.
   ============================================================ */
"use strict";

window.DQWordPop = (function () {
  const DE_WORD_RE = /[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]+/g;
  const RU_WORD_RE = /[А-Яа-яЁё][А-Яа-яЁё-]+/g;
  const DICT = new Map();            // norm → {de, ru}
  const RDICT = new Map();           // norm(русское слово) → {de, ru}
  const SAVED = new Set();           // ключи, уже отправленные в файл на этот сеанс

  const norm = (s) => String(s || "").toLowerCase().replace(/[.,!?;:„“"'`»«()\[\]]/g, "").trim();
  const bare = (de) => String(de).replace(/^(der|die|das)\s+/i, "");

  /* В словаре первым может стоять русский перевод («дом = das Haus»).
     Тогда стороны меняем местами, иначе карточка и клик-перевод ломаются. */
  function add(de, ru) {
    if (!de || !ru) return;
    if (/[А-Яа-яЁё]/.test(de) && !/[А-Яа-яЁё]/.test(ru)) { const t = de; de = ru; ru = t; }
    DICT.set(norm(de), { de, ru });
    if (bare(de) !== de) DICT.set(norm(bare(de)), { de, ru });
    // обратная сторона: русское слово → немецкое (клик по-русски)
    String(ru).split(/[;,/]/).forEach((part) => {
      const k = norm(part.replace(/\([^)]*\)/g, " "));
      if (k) RDICT.set(k, { de, ru });
    });
  }

  function seed(pairs) { (pairs || []).forEach((p) => p && add(p[0], p[1])); }

  function seedFromPage() {
    document.querySelectorAll(".ws-vocab-item").forEach((el) => {
      const de = (el.querySelector(".de") || {}).textContent;
      const ru = (el.querySelector(".ru") || {}).textContent;
      add((de || "").trim(), (ru || "").trim());
    });
  }

  function lookup(raw) {
    const w = norm(raw);
    if (w.length < 2) return null;
    if (/[А-Яа-яЁё]/.test(w)) return RDICT.get(w) || null;   // русское слово → немецкое
    if (DICT.has(w)) return DICT.get(w);
    for (const suf of ["ungen", "ung", "en", "em", "er", "es", "st", "et", "t", "e", "n", "s"]) {
      if (w.length > suf.length + 2 && w.endsWith(suf)) {
        const stem = w.slice(0, -suf.length);
        if (DICT.has(stem)) return DICT.get(stem);
        if (DICT.has(stem + "en")) return DICT.get(stem + "en");
      }
    }
    return null;
  }

  const ui = () => (window.SETTINGS && window.SETTINGS.ui) || {};
  /* Фото к словам включаются настройкой ui.wordPhotos (панель → «Внешний вид»).
     Раньше функция потерялась — фото слов в карточке не появлялись вовсе. */
  const photoOn = () => {
    const v = ui().wordPhotos;
    return v === undefined ? true : !!v;
  };
  /* русский → немецкий включается в настройках (панель → «Слова»), по умолчанию — да */
  const revOn = () => ui().ruTranslate !== false;

  /* ---------------- сохранение в user_words.json ---------------- */
  function saveToBook(text, kind, rev) {
    if (!text || !window.DQ) return;
    const key = (rev ? "rev:" : "") + kind + ":" + norm(text);
    window.DQ.api("/api/tr/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, kind, rev: !!rev }),
    }).then((res) => {
      SAVED.add(key);
      const r = res && res.result;
      if (r && (r.ru || r.de)) {
        // подмешиваем в локальный словарь — чтобы следующий клик был мгновенным
        if (rev && r.de) add(r.de, r.ru || text);
        else if (r.ru) add(text, r.ru);
        if (cur && cur.text === text && cur.kind === kind) paintTranslation(r);
      }
    }).catch(() => {});
  }

  /* ---------------- окно ---------------- */
  let box = null;
  let tapMark = null;
  let cur = { text: "", kind: "word" };

  function build() {
    if (box) return box;
    box = document.createElement("div");
    box.className = "wordpop";
    box.innerHTML = `
      <button class="wordpop-x" aria-label="Закрыть">✕</button>
      <div class="wordpop-head">
        <div class="wordpop-photo"></div>
        <div class="wordpop-headtxt">
          <div class="wordpop-de"></div>
          <div class="wordpop-ru"><span class="wp-loading">ищу перевод…</span></div>
        </div>
      </div>
      <div class="wordpop-ph"></div>
      <div class="wordpop-parts"></div>
      <div class="wordpop-act">
        <button class="btn primary small" data-act="say"><span class="ico ico-vol"></span> Слушать</button>
        <button class="btn ghost small" data-act="slow"><span class="ico ico-slow"></span> Медленно</button>
      </div>
      <div class="wordpop-save"><button class="link-btn" data-act="save">Сохранить в мой словарь</button></div>`;
    box.querySelector(".wordpop-x").onclick = hide;
    box.addEventListener("click", (e) => e.stopPropagation());
    const spoken = () => (cur.rev ? (cur.de || "") : cur.text);   // что читать голосом
    box.querySelector('[data-act="say"]').onclick = () => {
      const t = spoken();
      if (t) window.DQVoice && window.DQVoice.say(t, cur.rev ? "de" : (cur.lang || "de"));
    };
    box.querySelector('[data-act="slow"]').onclick = () => {
      const t = spoken();
      if (t) window.DQVoice && window.DQVoice.slow(t, cur.rev ? "de" : (cur.lang || "de"));
    };
    box.querySelector('[data-act="save"]').onclick = () => {
      saveToBook(cur.text, cur.kind, cur.rev);
      window.DQ.toast && window.DQ.toast("Сохранено в «Мои слова»", "ok");
    };
    document.body.appendChild(box);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
    document.addEventListener("pointerdown", (e) => {
      if (box.classList.contains("open") && !box.contains(e.target)) setTimeout(hide, 0);
    }, true);
    window.addEventListener("resize", hide);
    return box;
  }

  function hide() {
    if (box) box.classList.remove("open");
    if (tapMark && tapMark.parentNode) {
      tapMark.replaceWith(document.createTextNode(tapMark.textContent));
      tapMark = null;
    }
  }

  function place(x, y) {
    const r = box.getBoundingClientRect();
    let left = x + 12, top = y + 16;
    if (left + r.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - r.width - 8);
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, y - r.height - 14);
    box.style.left = left + "px";
    box.style.top = top + "px";
  }

  function paintTranslation(res) {
    const ruEl = box.querySelector(".wordpop-ru");
    const txt = res ? (res.de && cur.rev ? res.de : res.ru) : "";
    if (!txt) {
      ruEl.textContent = "перевода нет — можно посмотреть в «Моих словах»";
      ruEl.classList.add("muted");
      return;
    }
    ruEl.classList.remove("muted");
    ruEl.textContent = txt;
    /* немецкий ответ можно озвучить: «Слушать» читает перевод, а не русский текст */
    if (cur.rev && res.de) cur.de = res.de;
    if (cur.rev) ruEl.classList.add("de-answer");
    // обратное направление: к немецкому ответу — фото и произношение
    if (cur.rev && res.de) {
      paintPhoto(res.de);
      drawPhon(box.querySelector(".wordpop-ph"), bare(res.de));
    }
    const src = { dict: "словарь", wiktionary: "Викисловарь", mymemory: "переводчик", user: "мой словарь" }[res.source] || "";
    if (src) {
      const tag = document.createElement("span");
      tag.className = "wp-src";
      tag.textContent = src;
      ruEl.appendChild(tag);
    }
  }

  /** Крупное фото слова (из «Словаря») — в шапке карточки. */
  function paintPhoto(word) {
    const host = box.querySelector(".wordpop-photo");
    if (!host) return;
    host.innerHTML = "";
    if (!word || !photoOn() || !window.DQUI) return;
    const url = window.DQUI.photo(word);
    if (!url) return;
    const img = document.createElement("img");
    img.className = "dq-photo wp-photo";
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => { img.remove(); };   // файл удалён — без рамки-пустышки
    host.appendChild(img);
  }

  /** Разбор фразы по словам: маленькие чипы с переводом. */
  function paintParts(text) {
    const host = box.querySelector(".wordpop-parts");
    host.innerHTML = "";
    const words = (text.match(DE_WORD_RE) || []).slice(0, 14);
    if (words.length < 2) return;
    const chips = words.map((w) => {
      const hit = lookup(w);
      const el = document.createElement("span");
      el.className = "wp-part" + (hit ? " has" : "");
      el.innerHTML = `<b>${w}</b>${hit ? `<i>${hit.ru.split(/[;,]/)[0].trim()}</i>` : ""}`;
      if (photoOn() && window.DQUI) {
        const url = window.DQUI.photo(w);
        if (url) {
          const pi = document.createElement("img");
          pi.className = "dq-photo wp-part-photo";
          pi.src = url;
          pi.alt = "";
          pi.loading = "lazy";
          pi.onerror = () => pi.remove();
          el.appendChild(pi);
        }
      }
      el.title = hit ? hit.ru : "нет в словаре";
      el.onclick = (ev) => { ev.stopPropagation(); show(w, "word", ev.clientX, ev.clientY); };
      return el;
    });
    chips.forEach((c) => host.appendChild(c));
  }

  /** Произношение в карточке: IPA / слоги / русская транскрипция. */
  function drawPhon(ph, word) {
    if (!ph || !word) return;
    const draw = () => {
      const d = window.DQPhon && window.DQPhon.get(word);
      if (!d || !d.ipa) return true;
      ph.innerHTML = `<span class="wp-ipa">[${d.ipa}]</span>` +
        (d.syllables && d.syllables.length ? `<span class="wp-syl">${d.syllables.join(" · ")}</span>` : "") +
        (d.ru ? `<span class="wp-ru">${d.ru}</span>` : "");
      return true;
    };
    if (draw() && ph.textContent) return;
    if (window.DQPhon && window.DQPhon.prepare) {
      window.DQPhon.prepare([word]).then(() => {
        if (!box || !box.classList.contains("open") || !ph.isConnected) return;
        draw();
      }).catch(() => {});
    }
  }

  /**
   * Показать карточку.
   * @param {string} text  — слово или фраза
   * @param {string} kind  — "word" | "phrase" (auto, если не указано)
   * @param {number} x,y   — координаты появления
   * @param {boolean} rev  — true: текст русский, перевод — на немецкий (ui.ruTranslate)
   */
  function show(text, kind, x, y, rev) {
    const b = build();
    const t = String(text || "").trim();
    if (!t) return;
    kind = kind || (t.split(/\s+/).length > 1 ? "phrase" : "word");
    rev = !!rev;
    cur = { text: t, kind, rev, de: "", lang: rev ? "ru" : "de" };

    b.querySelector(".wordpop-de").textContent = t;
    b.querySelector(".wordpop-de").classList.toggle("phrase", kind === "phrase");
    b.querySelector(".wordpop-de").classList.toggle("rev", rev);
    b.querySelector(".wordpop-ru").innerHTML = '<span class="wp-loading">ищу перевод…</span>';
    b.querySelector(".wordpop-ru").classList.remove("de-answer");
    b.querySelector(".wordpop-ph").innerHTML = "";
    b.querySelector(".wordpop-photo").innerHTML = "";
    b.querySelector(".wordpop-parts").innerHTML = "";
    b.classList.toggle("from-ru", rev);
    b.classList.add("open");
    b.style.left = "0px";
    b.style.top = "0px";

    /* --- обратное направление: русское слово → немецкое --- */
    if (rev) {
      const words = t.match(RU_WORD_RE) || [];
      if (words.length > 1) {
        // русская фраза — переводим целиком с сервера, без разбора
        place(x, y);
        window.DQSND && window.DQSND.tap();
        saveToBook(t, "phrase", true);
      } else {
        const lh = lookup(t);
        if (lh) paintTranslation({ de: lh.de, ru: lh.ru, source: "dict" });
        place(x, y);
        window.DQSND && window.DQSND.tap();
        saveToBook(t, "word", true);
      }
      return;
    }

    // 1) локальный словарь — мгновенно
    const hit = lookup(t);
    if (hit) paintTranslation({ ru: hit.ru, source: "dict" });
    // фото берём от чистого ключа (с артиклем или без — DQUI.photo нормализует сам)
    paintPhoto(hit ? hit.de : t);

    // 2) произношение
    const word = bare(hit ? hit.de : t);
    const ph = b.querySelector(".wordpop-ph");
    if (kind === "word") {
      drawPhon(ph, word);
    } else {
      paintParts(t);              // для фразы — разбор по словам
    }

    place(x, y);
    window.DQSND && window.DQSND.tap();

    // 3) сервер: свои словари → Wiktionary / MyMemory, и запись в user_words.json
    const key = kind + ":" + norm(t);
    if (!SAVED.has(key) || !hit) {
      saveToBook(t, kind, false);
    }
  }

  /* ---------------- клик по слову / выделение фразы ---------------- */
  /** Живой текст — только здесь работает клик-перевод вне разделов обучения. */
  const LIVE = ".ct-line, .ct-news, .rd-body, .rd-text, .rd-q-card, .rd-text-body, .tr-text, .cr-text, .cr-rule, .gv-explain, .gr-explain, .sp-hint, .sp-line, .ex-text, .wordpop, .my-card, .dt-row";
  /* Разделы-задания: там клик по тексту задания — это подсказка с ответом. */
  const QUIZ = ["view-train", "view-lernen", "view-worksheets", "view-reading", "view-grammatik", "view-course", "view-exam", "view-dictation", "view-cards"];

  function wordAt(x, y, rev) {
    let node = null, offset = null;
    if (document.caretPositionFromPoint) {
      const c = document.caretPositionFromPoint(x, y);
      if (c) { node = c.offsetNode; offset = c.offset; }
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (r) { node = r.startContainer; offset = r.startOffset; }
    }
    if (!node || node.nodeType !== 3) return null;
    const text = node.textContent || "";
    const re = new RegExp((rev ? RU_WORD_RE : DE_WORD_RE).source, "g");
    let m, found = null;
    while ((m = re.exec(text))) {
      if (offset === null || (offset >= m.index && offset <= m.index + m[0].length)) { found = m; break; }
    }
    if (!found) return null;
    return { node, m: found };
  }

  function selectedPhrase() {
    try {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return "";
      const txt = String(sel.toString() || "").replace(/\s+/g, " ").trim();
      if (txt.length < 3 || txt.length > 220) return "";
      if (/[А-Яа-яЁё]/.test(txt)) return "";
      // только немецкий текст (русские пояснения не переводим)
      return /[A-Za-zÄÖÜäöüß]/.test(txt) ? txt : "";
    } catch (e) { return ""; }
  }

  const INTERACTIVE = "button, a, input, textarea, select, summary, .wordpop, .opt, .chip, .ws-opt, .ws-in, #nav";

  function onClick(e) {
    if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
    if (box && box.contains(e.target)) return;

    // 1) есть выделение → переводим фразу (контекст)
    const phrase = selectedPhrase();
    if (phrase) {
      hide();
      show(phrase, "phrase", e.clientX, e.clientY);
      e.stopPropagation();
      return;
    }

    // 2) обычный клик по слову
    const t = e.target;
    if (!t || (t.closest && t.closest(INTERACTIVE))) return;

    /* В разделах-заданиях (задача — самому перевести слово) клик работает только
       в «живых» блоках текста: фраза, текст песни, сообщение, разбор и т.п.
       Иначе любое нажатие на слово вопроса работало бы как подсказка с ответом. */
    const asked = QUIZ.some((id) => {
      const el = document.getElementById(id);
      return !!el && el.classList.contains("active");
    });
    if (asked && !(t.closest && t.closest(LIVE))) { hide(); return; }

    /* направления клика: немецкий → русский всегда; русский → немецкий —
       только если включено в настройках (ui.ruTranslate).
       Русские пояснения вперемешку с немецкими словами: если под курсором
       кириллица — сразу обратная сторона, иначе ищем немецкое слово. */
    let hit = null;
    let rev = false;
    if (revOn()) { hit = wordAt(e.clientX, e.clientY, true); rev = !!hit; }
    if (!hit) { hit = wordAt(e.clientX, e.clientY, false); rev = false; }
    if (!hit && !revOn()) { hit = wordAt(e.clientX, e.clientY, true); rev = !!hit; }
    if (!hit) { hide(); return; }

    if (tapMark && tapMark.parentNode) tapMark.replaceWith(document.createTextNode(tapMark.textContent));
    try {
      const range = document.createRange();
      range.setStart(hit.node, hit.m.index);
      range.setEnd(hit.node, hit.m.index + hit.m[0].length);
      tapMark = document.createElement("span");
      tapMark.className = "word-tap";
      range.surroundContents(tapMark);
    } catch (err) { tapMark = null; }

    show(hit.m[0], "word", e.clientX, e.clientY, rev);
    e.stopPropagation();
  }

  /* Выделил текст мышью → отпустил → карточка фразы (контекстный перевод). */
  function onMouseUp(e) {
    if (!e || e.button !== 0) return;
    if (box && box.contains(e.target)) return;
    setTimeout(() => {
      const phrase = selectedPhrase();
      if (phrase && phrase.split(/\s+/).length >= 2) {
        hide();
        show(phrase, "phrase", e.clientX, e.clientY);
      }
    }, 10);
  }

  function addToPool() {
    const pool = (window.DQ && window.DQ.pool) || [];
    if (pool.length) seed(pool);
    seedFromPage();
  }

  function init() {
    document.addEventListener("click", onClick, true);
    document.addEventListener("mouseup", onMouseUp);
    addToPool();
    setInterval(addToPool, 4000);
  }

  return {
    init, seed, lookup, show, hide,
    showPhrase: (t, x, y) => show(t, "phrase", x || 120, y || 120),
    /** Показать карточку с русским текстом и немецким переводом (обратная сторона). */
    showRu: (t, x, y) => show(t, "word", x || 120, y || 120, true),
    get size() { return DICT.size; },
  };
})();

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", window.DQWordPop.init);
else window.DQWordPop.init();
