/* ============================================================
   Deutsch Quest — ЭКРАН «МОИ СЛОВА» (window.DQMyWords)

   Здесь всё, на что нажимали в тексте (web/wordpop.js): слово или
   фраза, перевод, сколько раз нажимали, когда в последний раз.
   Можно:
     • искать и фильтровать (всё / слова / фразы);
     • слушать и смотреть произношение;
     • «Повторить» — карточки: немецкое слово → «Показать перевод» → «Знаю / Ещё раз»;
     • убрать из списка и отметить «выучено».

   Данные — сервер, файл user_words.json (/api/tr/history, /api/tr/lookup,
   /api/tr/learned, /api/tr/forget).
   ============================================================ */
"use strict";

window.DQMyWords = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /** Артикли der/die/das — цветом (web/dq-ui.js). */
  const art = (html) => (window.DQUI ? window.DQUI.art(html) : html);

  const S = {
    items: [],
    stats: {},
    kind: "all",
    q: "",
    rep: null,          // {queue: [...], idx, shown}
    inited: false,
  };

  async function api(path, opts) {
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(path + " → " + res.status);
    return res.json();
  }

  /* ---------------- загрузка ---------------- */
  async function load() {
    try {
      const d = await api("/api/tr/history");
      S.items = d.items || [];
      S.stats = d.stats || {};
    } catch (e) {
      S.items = [];
    }
    paintStats();
    render();
  }

  function paintStats() {
    const el = $("#myStats");
    if (el) el.textContent = `${S.stats.words || 0} слов · ${S.stats.phrases || 0} фраз · выучено ${S.stats.learned || 0}`;
    const badge = $("#navWordsBadge");
    if (badge) badge.textContent = String((S.stats.words || 0) + (S.stats.phrases || 0));
  }

  function filtered() {
    const q = S.q.trim().toLowerCase();
    return S.items.filter((it) => {
      if (S.kind !== "all" && it.kind !== S.kind) return false;
      if (!q) return true;
      return (it.text + " " + it.ru).toLowerCase().includes(q);
    });
  }

  /* Частотный словарь и «слова-близнецы»: ранг слова и совпадающие переводы */
  const COMMON = ["sein", "haben", "werden", "nicht", "ein", "ich", "du", "er", "sie", "es",
    "wir", "ihr", "und", "oder", "aber", "mit", "auf", "fuer", "von", "zu", "bei", "nach",
    "aus", "ueber", "unter", "vor", "gehen", "kommen", "machen", "sagen", "sehen", "nehmen",
    "geben", "sprechen", "lesen", "schreiben", "gut", "schlecht", "gross", "klein", "viel",
    "wenig", "tag", "nacht", "jahr", "zeit", "mensch", "arbeit", "haus", "zimmer", "wasser",
    "brot", "kind", "frau", "mann", "freund", "schule", "stadt", "strasse", "auto"];
  const TOP = (() => {
    const map = {};
    COMMON.slice(0, 30).forEach((w, i) => { map[w] = i + 1; });
    COMMON.slice(30).forEach((w, i) => { map[w] = 101 + i * 12; });
    return map;
  })();
  function rankOf(text) {
    const w = String(text || "").toLowerCase()
      .replace(/^(der|die|das) /, "")
      .split(/ /)[0]
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue");
    return TOP[w] || null;
  }

  const PHOTO = (w, size) => (window.DQUI ? window.DQUI.photoHtml(w, { size: size || 64, cls: "my-photo" }) : "");

  /* ---------------- карточки-список ---------------- */
  function render() {
    const host = $("#myGrid");
    if (!host) return;
    const list = filtered();
    if (!list.length) {
      host.innerHTML = `<div class="card"><p class="muted">Пока пусто. Нажми на любое немецкое слово в тренажёре, задании или тексте — оно появится здесь.</p></div>`;
      return;
    }
    const htmlRows = list.map((it) => `
      <div class="my-card ${it.learned ? "learned" : ""}" data-key="${esc(it.key)}" data-kind="${it.kind}" data-rank="${rankOf(it.text) || ""}">
        <div class="my-top">
          <span class="my-text">${PHOTO(it.text, 64)}<span>${art(esc(it.text))}</span></span>
          <button class="my-say" data-act="say" title="Слушать"><span class="ico ico-vol"></span></button>
        </div>
        <div class="my-ru">${it.ru ? esc(it.ru) : '<span class="muted">перевода нет</span>'}</div>
        <div class="my-meta">
          <span>${it.kind === "phrase" ? "фраза" : "слово"}</span>
          <span>нажимали ${it.hits || 1}×</span>
          ${it.learned ? "<span class=\"my-ok\">выучено</span>" : ""}
          <span class="my-extra"></span>
        </div>
        <div class="my-actions">
          <button class="btn ghost small" data-act="learn">${it.learned ? "Забыть" : "Выучил"}</button>
          <button class="btn ghost small danger" data-act="del">Убрать</button>
        </div>
      </div>`).join("");
    host.innerHTML = window.DQUI ? window.DQUI.limit(htmlRows) : htmlRows;

    $$(".my-card", host).forEach((card) => {
      const key = card.dataset.key;
      const item = S.items.find((x) => x.key === key && x.kind === card.dataset.kind);
      if (!item) return;
      card.onclick = (e) => {
        if (e.target.closest("button")) return;
        window.DQVoice && window.DQVoice.say(item.text, "de");
      };
      const act = (name, fn) => {
        const b = card.querySelector(`[data-act="${name}"]`);
        if (b) b.onclick = (e) => { e.stopPropagation(); fn(); };
      };
      act("say", () => window.DQVoice && window.DQVoice.say(item.text, "de"));
      act("learn", async () => {
        await api("/api/tr/learned", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: item.key, value: !item.learned })
        });
        item.learned = !item.learned;
        load();
      });
      act("del", async () => {
        await api("/api/tr/forget", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: item.key })
        });
        S.items = S.items.filter((x) => !(x.key === item.key && x.kind === item.kind));
        load();
      });
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* ---------------- повторение (карточки) ---------------- */
  function startRepeat() {
    const pool = filtered().filter((it) => it.ru);
    if (!pool.length) { window.DQ.toast && window.DQ.toast("Нет слов с переводом для повторения", "bad"); return; }
    S.rep = { queue: shuffle(pool), idx: 0, shown: false, known: 0, total: pool.length };
    $("#myRepeatBox").hidden = false;
    paintRepeat();
  }

  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function paintRepeat() {
    const host = $("#myRepeatBox");
    const r = S.rep;
    if (!r) { host.hidden = true; host.innerHTML = ""; return; }
    if (r.idx >= r.queue.length) {
      host.innerHTML = `<div class="my-rep-done">
        <h3>Повторение закончено</h3>
        <p class="muted">Знаю: ${r.known} из ${r.total}</p>
        <button class="btn primary" id="myRepAgain">Ещё круг</button>
      </div>`;
      $("#myRepAgain").onclick = () => startRepeat();
      return;
    }
    const it = r.queue[r.idx];
    host.innerHTML = `
      <div class="my-rep-head">
        <span class="muted small">${r.idx + 1} / ${r.queue.length}</span>
        <button class="link-btn" id="myRepClose">закрыть</button>
      </div>
      <div class="my-rep-text">${esc(it.text)}</div>
      <div class="my-rep-ru ${r.shown ? "" : "hidden"}">${esc(it.ru)}</div>
      <div class="my-rep-act">
        <button class="btn ghost small" id="myRepSay"><span class="ico ico-vol"></span> Слушать</button>
        ${r.shown ? `<button class="btn ghost small" id="myRepAgain2">Ещё раз</button>
                     <button class="btn primary small" id="myRepKnow">Знаю</button>`
        : `<button class="btn primary small" id="myRepShow">Показать перевод</button>`}
      </div>`;
    $("#myRepClose").onclick = () => { S.rep = null; host.hidden = true; };
    $("#myRepSay").onclick = () => window.DQVoice && window.DQVoice.say(it.text, "de");
    const showBtn = $("#myRepShow");
    if (showBtn) showBtn.onclick = () => { r.shown = true; paintRepeat(); };
    const again = $("#myRepAgain2");
    if (again) again.onclick = () => { r.queue.push(it); r.idx++; r.shown = false; paintRepeat(); };
    const know = $("#myRepKnow");
    if (know) know.onclick = () => { r.known++; r.idx++; r.shown = false; paintRepeat(); };
  }

  /* ---------------- инициализация ---------------- */
  function init() {
    if (S.inited) return;
    S.inited = true;
    const kind = $("#myKind");
    if (kind) {
      $$("button", kind).forEach((b) => {
        b.onclick = () => {
          S.kind = b.dataset.kind;
          $$("button", kind).forEach((x) => x.classList.toggle("active", x === b));
          render();
        };
      });
    }
    const search = $("#mySearch");
    if (search) search.oninput = () => { S.q = search.value; render(); };
    const rep = $("#myRepeat");
    if (rep) rep.onclick = startRepeat;
    
    // Add word button
    const addBtn = $("#myAddWord");
    if (addBtn) addBtn.onclick = openAddWordModal;
    
    load();
  }

  function openAddWordModal() {
    const modal = document.createElement("div");
    modal.className = "add-word-modal";
    modal.innerHTML = `
      <div class="add-word-modal-backdrop"></div>
      <div class="add-word-modal-card">
        <h3>Добавить своё слово</h3>
        <div class="add-word-fields">
          <label>Немецкое слово/фраза <input type="text" id="addWordDe" placeholder="z. B. das Haus"></label>
          <label>Русский перевод <input type="text" id="addWordRu" placeholder="дом"></label>
          <label>
            <input type="checkbox" id="addWordPhrase"> Это фраза
          </label>
        </div>
        <div class="add-word-actions">
          <button class="btn ghost" id="addWordCancel">Отмена</button>
          <button class="btn primary" id="addWordSave">Сохранить</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    const backdrop = modal.querySelector(".add-word-modal-backdrop");
    const cancelBtn = modal.querySelector("#addWordCancel");
    const saveBtn = modal.querySelector("#addWordSave");
    const deInput = modal.querySelector("#addWordDe");
    const ruInput = modal.querySelector("#addWordRu");
    const phraseCheck = modal.querySelector("#addWordPhrase");
    
    function close() {
      modal.remove();
    }
    
    backdrop.onclick = close;
    cancelBtn.onclick = close;
    
    saveBtn.onclick = async () => {
      const text = deInput.value.trim();
      const ru = ruInput.value.trim();
      const kind = phraseCheck.checked ? "phrase" : "word";
      
      if (!text || !ru) {
        window.DQ.toast && window.DQ.toast("Заполните оба поля", "bad");
        return;
      }
      
      try {
        const res = await api("/api/tr/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, ru, kind })
        });
        if (res.ok) {
          close();
          load();
          window.DQ.toast && window.DQ.toast("Слово добавлено", "ok");
        } else {
          window.DQ.toast && window.DQ.toast(res.error || "Ошибка", "bad");
        }
      } catch (e) {
        window.DQ.toast && window.DQ.toast("Ошибка: " + e.message, "bad");
      }
    };
    
    // Focus first input
    setTimeout(() => deInput.focus(), 0);
    
    // Enter to save
    [deInput, ruInput].forEach(inp => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveBtn.onclick();
      });
    });
  }

  /** Вызывается при переходе на экран (dq.js: showView). */
  function open() {
    init();
    load();
  }

  return { init, open, load, startRepeat };
})();
