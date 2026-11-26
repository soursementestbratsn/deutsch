/* ============================================================
   Deutsch Quest — СЛОВАРЬ (window.DQDict)

   Все слова из content/words.txt и phrases.txt в одном списке:
     • поиск по немецкому и русскому;
     • отметка слов галочкой → «Спрашивать эти слова» (тренажёр берёт
       только их), или обычный выбор целыми группами — на экране «Группы»;
     • фильтр «только с фото»;
     • фото к слову: кинуть картинку на строку, вставить из буфера
       (Ctrl+V), выбрать файл или перетащить сразу пачку (по имени файла
       слово находится само). Фото видно на всех экранах.

   Сервер: GET /api/vocab, POST /api/photo, POST /api/photo/delete.
   ============================================================ */
"use strict";

window.DQDict = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const EN = new Intl.Collator("de");

  const S = {
    inited: false,
    words: [],            // [{de, ru, group, groupKey}]
    groups: {},           // {key: {label, hint}}
    photos: {},           // {ключ: {file, at, w, h}}
    q: "",
    group: "",            // "" = все группы
    onlyPhotos: false,
    picked: false,        // фильтр «выбранные»
    cap: 300,             // сколько строк рисовать за раз
    pending: null,        // слово, которому сейчас ждём фото
  };

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const slot = (w) => (window.DQUI ? window.DQUI.slot(w) : String(w || "").trim().toLowerCase());
  const norm = (s) => String(s || "").toLowerCase().replace(/^(der|die|das)\s+/, "").trim();

  async function api(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(path + " → " + res.status);
    return res.json();
  }

  /* ---------------- данные ---------------- */
  async function load() {
    try {
      const d = await api("/api/vocab");
      S.words = d.words || [];
      S.groups = d.groups || {};
      S.photos = d.photos || {};
    } catch (e) {
      S.words = S.words || [];
      window.DQ.toast && window.DQ.toast("Не удалось загрузить словарь: " + e.message, "bad");
    }
    if (window.DQUI) window.DQUI.reload();
    paintStats();
    render();
  }

  function wordToKey() {
    const m = new Map();
    S.words.forEach((w) => m.set(slot(w.de), w));
    return m;
  }

  /** «Слышать артикль в словаре» — выбираем по ключу слова (без артикля). */
  function enabled() {
    const st = (window.DQ && window.DQ.stats) || {};
    return Array.isArray(st.enabled_words) ? st.enabled_words : [];
  }
  function isOn(word) { return enabled().includes(slot(word)); }

  async function readVocab() {
    const d = await api("/api/data");
    return Array.isArray(d.stats && d.stats.enabled_words) ? d.stats.enabled_words : [];
  }

  async function setEnabled(list) {
    const cleaned = Array.from(new Set(list.map(slot).filter(Boolean)));
    try {
      const d = await api("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled_words: cleaned }),
      });
      if (d && d.stats && window.DQ) window.DQ.applyStats(d.stats);
    } catch (e) {
      window.DQ.toast && window.DQ.toast("Не сохранилось: " + e.message, "bad");
    }
  }

  async function treatChosen() {
    const list = enabled();
    if (!list.length) {
      window.DQ.toast && window.DQ.toast("Отметьте слова, которые должны попадаться", "bad");
      return;
    }
    if (!window.DQ || !window.DQ.startWords) {
      window.DQ.toast && window.DQ.toast("Тренажёр ещё не готов", "bad");
      return;
    }
    await window.DQ.startWords(list);
    window.DQNav && window.DQNav.go("train");
    window.DQ.toast && window.DQ.toast(`Спрашиваем выбранное: ${list.length}`, "ok");
  }

  /* ---------------- фильтр ---------------- */
  function filtered() {
    const q = S.q.trim().toLowerCase();
    const list = S.words.filter((w) => {
      if (S.group && w.groupKey !== S.group) return false;
      if (S.onlyPhotos && !S.photos[slot(w.de)]) return false;
      if (S.picked && !isOn(w.de)) return false;
      if (!q) return true;
      return (w.de + " " + w.ru + " " + w.group).toLowerCase().includes(q);
    });
    return list.sort((a, b) => EN.compare(norm(a.de), norm(b.de)));
  }

  /* ---------------- разметка ---------------- */
  function paintStats() {
    const withPhoto = Object.keys(S.photos).length;
    const n = withPhoto;
    const el = $("#dictStats");
    if (el) el.textContent = `${S.words.length} слов · ${n} с фото · выбрано ${enabled().length}`;
    const badge = $("#navDictBadge");
    if (badge) badge.textContent = String(S.words.length);
  }

  function artHtml(de) {
    const plainWord = String(de || "").replace(/^(der|die|das)\s+/i, "");
    const art = window.DQUI ? window.DQUI.of(de) : "";
    if (!art) return `<span class="dt-de">${esc(plainWord)}</span>`;
    return `<span class="dt-de"><b class="dq-art art-${art}">${art}</b> ${esc(plainWord)}</span>`;
  }

  function rowHtml(w) {
    const key = slot(w.de);
    const ph = window.DQUI ? window.DQUI.photo(w.de) : "";
    const on = isOn(w.de);
    return `<div class="dt-row ${on ? "on" : ""}" data-key="${esc(key)}">
      <button class="dt-check ${on ? "on" : ""}" data-act="pick" title="${on ? "Не спрашивать это слово" : "Спрашивать это слово"}"></button>
      <div class="dt-ph ${ph ? "has" : ""}" data-drop="1" title="Фото к слову: клик — выбрать файл, можно перетащить картинку сюда или Ctrl+V">
        ${ph ? `<img src="${ph}" alt="" loading="lazy">` : `<span class="dt-ph-plus">+</span>`}
      </div>
      <div class="dt-main">
        ${artHtml(w.de)}
        <div class="dt-ru">${esc(w.ru || "")}</div>
      </div>
      <div class="dt-group">${esc(w.group || "")}</div>
      <div class="dt-tools">
        <button class="dt-btn" data-act="say" title="Слушать"><span class="ico ico-vol"></span></button>
        <button class="dt-btn" data-act="up" title="Заменить фото">${ph ? "↻" : "+"}</button>
        ${ph ? `<button class="dt-btn danger" data-act="del" title="Убрать фото">✕</button>` : ""}
      </div>
    </div>`;
  }

  function render() {
    const host = $("#dictList");
    if (!host) return;
    const list = filtered();
    if (!list.length) {
      host.innerHTML = `<div class="card"><p class="muted">Ничего не найдено. Поменяйте фильтр или поиск.</p></div>`;
      paintMore(0, 0);
      return;
    }
    const slice = list.slice(0, S.cap);
    host.innerHTML = window.DQUI ? window.DQUI.limit(slice.map(rowHtml).join("")) : slice.map(rowHtml).join("");
    paintMore(slice.length, list.length);
    bindRows(host);
  }

  function paintMore(shownN, total) {
    const btn = $("#dictMore");
    if (!btn) return;
    btn.hidden = shownN >= total;
    btn.textContent = `Показать ещё (${total - shownN})`;
  }

  function bindRows(host) {
    $$(".dt-row", host).forEach((row) => {
      const key = row.dataset.key;
      const w = S.words.find((x) => slot(x.de) === key);
      if (!w) return;
      const ph = $(".dt-ph", row);
      if (ph) ph.onclick = () => pickFile(w);
      $('[data-act="say"]', row).onclick = (e) => {
        e.stopPropagation();
        window.DQVoice && window.DQVoice.say(w.de, "de");
      };
      const pick = $('[data-act="pick"]', row);
      if (pick) pick.onclick = () => togglePick(w);
      $('[data-act="up"]', row).onclick = () => pickFile(w);
      const del = $('[data-act="del"]', row);
      if (del) del.onclick = () => removePhoto(w);
      // перетаскивание файла прямо на строку/фото
      row.ondragover = (e) => { e.preventDefault(); row.classList.add("drop"); };
      row.ondragleave = () => row.classList.remove("drop");
      row.ondrop = (e) => {
        e.preventDefault();
        row.classList.remove("drop");
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) upload(w, f);
        else if (S.pending) upload(w, S.pending);
      };
    });
  }

  /* ---------------- выбор слов ---------------- */
  async function togglePick(w) {
    const list = enabled().slice();
    const key = slot(w.de);
    const i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1);
    else list.push(key);
    await setEnabled(list);
    window.DQSND && window.DQSND.tap();
    // точечно обновить строку и счётчики (без перерисовки всего списка)
    const row = $(`.dt-row[data-key="${CSS.escape(key)}"]`);
    if (row) {
      const on = isOn(w.de);
      row.classList.toggle("on", on);
      const b = $(".dt-check", row);
      if (b) { b.classList.toggle("on", on); b.title = on ? "Не спрашивать это слово" : "Спрашивать это слово"; }
    }
    if (S.picked) render();
    paintStats();
  }

  async function pickAll(flag) {
    const list = filtered().map((w) => slot(w.de));
    const cur = new Set(flag ? enabled() : []);
    if (flag) list.forEach((k) => cur.add(k));
    else filtered().forEach((w) => cur.delete(slot(w.de)));
    await setEnabled(Array.from(cur));
    render();
    paintStats();
    window.DQ.toast && window.DQ.toast(flag ? "Слова отмечены" : "Слова сняты", "ok");
  }

  /* ---------------- фото ---------------- */
  let fileInput = null;
  function pickFile(w) {
    S.pending = w;
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.hidden = true;
      document.body.appendChild(fileInput);
      fileInput.onchange = () => {
        const f = fileInput.files && fileInput.files[0];
        fileInput.value = "";
        if (f && S.pending) upload(S.pending, f);
      };
    }
    fileInput.click();
  }

  function fileToDataUrl(f) {
    return new Promise((ok, bad) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result || ""));
      r.onerror = () => bad(new Error("не удалось прочитать файл"));
      r.readAsDataURL(f);
    });
  }

  async function upload(w, file) {
    if (!file) return;
    if (!/^image\//.test(file.type || "")) {
      window.DQ.toast && window.DQ.toast("Это не картинка", "bad");
      return;
    }
    try {
      const data = await fileToDataUrl(file);
      const d = await api("/api/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: w.de, data }),
      });
      if (!d.ok) throw new Error(d.error || "не сохранилось");
      S.photos = d.photos || S.photos;
      if (window.DQUI) { window.DQUI.reload(); }
      window.DQ.toast && window.DQ.toast(`Фото → ${w.de}`, "ok");
      render();
      paintStats();
      window.DQSND && window.DQSND.correct();
    } catch (e) {
      window.DQ.toast && window.DQ.toast("Фото не принято: " + e.message, "bad");
    }
  }

  async function removePhoto(w) {
    try {
      const d = await api("/api/photo/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: w.de }),
      });
      S.photos = d.photos || S.photos;
      if (window.DQUI) window.DQUI.reload();
      render();
      paintStats();
    } catch (e) {
      window.DQ.toast && window.DQ.toast("Не удалилось: " + e.message, "bad");
    }
  }

  /* Пачка файлов (drag&drop на всю страницу): имя файла → слово. */
  async function dropBatch(files) {
    const bySlot = wordToKey();
    let done = 0;
    const unknown = [];
    for (const f of files) {
      if (!/^image\//.test(f.type || "")) continue;
      const base = f.name.replace(/\.[^.]+$/, "");
      const candidates = [base, base.replace(/[_-]+/g, " "), base.replace(/\s*\(\d+\)$/, "")];
      const hit = candidates.map((c) => bySlot.get(slot(c))).find(Boolean);
      if (!hit) { unknown.push(base); continue; }
      await upload(hit, f);
      done++;
    }
    if (done) window.DQ.toast && window.DQ.toast(`Фото добавлено: ${done}`, "ok");
    if (unknown.length) {
      window.DQ.toast && window.DQ.toast(
        `Не нашёл слова для: ${unknown.slice(0, 3).join(", ")}${unknown.length > 3 ? "…" : ""}. Кидайте по одному на строку.`,
        "bad");
    }
  }

  /* ---------------- обработчики экрана ---------------- */
  function bind() {
    const search = $("#dictSearch");
    if (search) search.oninput = () => { S.q = search.value; S.cap = 300; render(); };
    const gsel = $("#dictGroup");
    if (gsel) gsel.onchange = () => { S.group = gsel.value; S.cap = 300; render(); };
    const ph = $("#dictOnlyPhotos");
    if (ph) ph.onclick = () => {
      S.onlyPhotos = !S.onlyPhotos;
      ph.classList.toggle("on", S.onlyPhotos);
      S.cap = 300;
      render();
    };
    const pk = $("#dictOnlyPicked");
    if (pk) pk.onclick = () => {
      S.picked = !S.picked;
      pk.classList.toggle("on", S.picked);
      S.cap = 300;
      render();
    };
    const all = $("#dictPickAll"), none = $("#dictPickNone"), go = $("#dictGo");
    if (all) all.onclick = () => pickAll(true);
    if (none) none.onclick = () => pickAll(false);
    if (go) go.onclick = treatChosen;
    const more = $("#dictMore");
    if (more) more.onclick = () => { S.cap += 300; render(); };

    // Ctrl+V с картинкой — фото к «последней нажатой» строке
    document.addEventListener("paste", (e) => {
      if (!$("#view-dict") || !$("#view-dict").classList.contains("active")) return;
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const it of items) {
        if (it.type && /^image\//.test(it.type)) {
          const f = it.getAsFile();
          if (f) {
            const w = S.pending || (S.words.find((x) => isOn(x.de)) || null);
            if (w) upload(w, f);
            else window.DQ.toast && window.DQ.toast("Сначала нажмите на строку слова, куда вставить фото", "bad");
            e.preventDefault();
          }
          return;
        }
      }
    });
  }

  async function open() {
    if (!S.inited) {
      S.inited = true;
      bind();
      const gsel = $("#dictGroup");
      if (gsel && !gsel.options.length) {
        gsel.innerHTML = `<option value="">Все группы</option>`;
      }
    }
    const gsel = $("#dictGroup");
    if (gsel) {
      const cur = gsel.value;
      gsel.innerHTML = `<option value="">Все группы</option>` +
        Object.entries(S.groups).map(([k, g]) => `<option value="${esc(k)}">${esc(g.label)}</option>`).join("");
      gsel.value = S.group || cur || "";
    }
    // свежие данные (в словаре могли появиться новые слова/фото)
    try {
      const d = await api("/api/vocab");
      S.words = d.words || S.words;
      S.groups = d.groups || S.groups;
      S.photos = d.photos || S.photos;
    } catch (e) { /* остаёмся с тем, что было */ }
    paintStats();
    render();
    if (window.DQFX) window.DQFX.stagger($("#dictList"));
  }

  return {
    open,
    refresh: load,
    get photos() { return S.photos; },
    upload: (word, file) => {
      const w = S.words.find((x) => slot(x.de) === slot(word)) || { de: word };
      return upload(w, file);
    },
    dropBatch,
    _state: S,
  };
})();
