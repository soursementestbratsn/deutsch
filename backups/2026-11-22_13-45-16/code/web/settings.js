/* ============================================================
   Deutsch Quest — НАСТРОЙКИ И ПАНЕЛЬ
   Единственное место, где описаны все «тонкие» настройки приложения.
   Панель строится по декларативной схеме SCHEMA: чтобы добавить
   новый переключатель — добавьте строку в SCHEMA и поле в DEFAULTS
   (web/theme.js) + обработку в apply(). Ничего больше.

   Хранение: stats.ui (один объект) — сервер сохраняет его как есть.
   ============================================================ */
"use strict";

window.SETTINGS = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const S = {
    ui: {},
    dirty: false,
    saveTimer: null,
  };

  /* ---------- схема панели: разделы → контролы ---------- */
  const SCHEMA = [
    {
      id: "look", title: "Внешний вид", icon: "ico-star",
      controls: [
        { key: "theme", type: "cards", label: "Тема", source: "theme" },
        { key: "accent", type: "swatches", label: "Акцент", source: "accent" },
        { key: "glass", type: "chips", label: "Стекло (жидкое)", source: "glass", hint: "Ниже — быстрее на слабых компьютерах" },
        { key: "backdrop", type: "chips", label: "Фон", source: "backdrop" },
        { key: "density", type: "chips", label: "Плотность", source: "density" },
        /* новые — читаемость */
        { key: "fontSize", type: "range", label: "Размер текста", min: 90, max: 130, step: 5, pct: true, hint: "Увеличивает текст всего интерфейса" },
        { key: "reduceGlow", type: "toggle", label: "Меньше свечения", hint: "Спокойнее фон и мягче блики" },
        { key: "compactSidebar", type: "toggle", label: "Компактная колонка", hint: "Уже боковая панель тренажёра" },
        { key: "highContrast", type: "toggle", label: "Высокий контраст", hint: "Чётче границы карточек и кнопок" },
      ],
    },
    {
      id: "say", title: "Озвучка", icon: "ico-vol",
      controls: [
        { key: "serverVoice", type: "toggle", label: "Живой голос для слов", hint: "Запись голоса вместо синтеза" },
        { key: "voiceGender", type: "chips", label: "Голос", source: "voiceGender" },
        { key: "voiceRate", type: "range", label: "Темп речи", min: 0.6, max: 1.3, step: 0.05 },
        { key: "autoSay", type: "toggle", label: "Читать новое слово самому" },
        { key: "showPron", type: "toggle", label: "Транскрипция к вопросу" },
        { key: "showPronAnswer", type: "toggle", label: "Транскрипция в ответе" },
        /* новые */
        { key: "readRu", type: "toggle", label: "Читать и по-русски", hint: "После немецкого — русский перевод" },
        { key: "slowFirstAnswer", type: "toggle", label: "Первое слово — медленно", hint: "Новое слово проговаривается помедленнее" },
        { key: "pronBrowse", type: "toggle", label: "Транскрипция в списках", hint: "В «Моих словах» и группах" },
        { key: "shadowing", type: "toggle", label: "Повторять вслед за голосом", hint: "Пауза после слова для повтора вслух" },
        { key: "_sayTest", type: "button", label: "Проверить голос", action: "testVoice" },
      ],
    },
    {
      id: "learn", title: "Учёба", icon: "ico-book",
      controls: [
        { key: "dailyGoal", type: "range", label: "Цель в день", min: 5, max: 100, step: 5, plain: true },
        { key: "tolerance", type: "chips", label: "Строгость", source: "tolerance", hint: "Допуск на опечатки" },
        { key: "noRepeat", type: "toggle", label: "Без повторок за круг" },
        { key: "srs", type: "toggle", label: "Интервальное повторение" },
        { key: "autoNext", type: "toggle", label: "Сразу к следующему" },
        { key: "haptics", type: "toggle", label: "Вибрация (моб.)" },
        /* новые — учёба */
        { key: "showArticle", type: "toggle", label: "Подсказывать артикль", hint: "der / die / das к слову" },
        { key: "showPlural", type: "toggle", label: "Показывать множественное", hint: "die Häuser и т.п." },
        { key: "showRelated", type: "toggle", label: "Похожие слова в разборе", hint: "Подсказки после ответа" },
        { key: "nlGerman", type: "toggle", label: "Объяснять по-немецки", hint: "Краткий перевод на немецкий в подсказке" },
        { key: "wordOfDay", type: "toggle", label: "Слово дня", hint: "На экране тренажёра" },
        { key: "typoStreakFreeze", type: "toggle", label: "Опечатка не сбрасывает серию", hint: "Прощение одной описки" },
        { key: "smartRepeat", type: "toggle", label: "Умные повторки", hint: "Ошибочные слова возвращаются раньше" },
        { key: "srsCap", type: "range", label: "Повторение за день", min: 20, max: 200, step: 10, plain: true, hint: "Сколько карточек вмещает день" },
        { key: "goalLevel", type: "range", label: "Цель точности", min: 50, max: 95, step: 5, pct: true, hint: "% правильных ответов за день" },
      ],
    },
    {
      id: "rhythm", title: "Ритм", icon: "ico-repeat",
      controls: [
        /* новые — дисциплина */
        { key: "studyTimer", type: "range", label: "Таймер сессии", min: 0, max: 60, step: 5, plain: true, hint: "0 — без таймера; иначе минуты" },
        { key: "focusMusic", type: "toggle", label: "Тихий фон в режиме фокуса" },
        { key: "breakReminder", type: "toggle", label: "Напоминать про перерыв", hint: "Каждые 25 минут" },
        { key: "gamify", type: "toggle", label: "XP, уровни и конфетти", hint: "Выключите — и останется только учёба" },
        /* новые — тренировка навыков */
        { key: "mistakeOnly", type: "toggle", label: "Только слова с ошибками", hint: "Тренажёр по «Слабым местам»" },
        { key: "reverseOnMistake", type: "toggle", label: "После ошибки — обращаю вопрос", hint: "Спросить это же слово в другую сторону" },
        { key: "autoCards", type: "toggle", label: "Новые слова — в карточки", hint: "Колода SRS пополняется сама" },
        { key: "typingPractice", type: "toggle", label: "Подсказки по клавиатуре", hint: "В режиме ввода — раскладка" },
        { key: "greeting", type: "toggle", label: "Приветствие с планом дня", hint: "Короткая карточка при открытии" },
      ],
    },
    {
      id: "sound", title: "Звук и движение", icon: "ico-play",
      controls: [
        { key: "sound", type: "toggle", label: "Звуки интерфейса" },
        { key: "soundVolume", type: "range", label: "Громкость", min: 0, max: 1, step: 0.05, pct: true },
        { key: "soundTone", type: "chips", label: "Тембр", static: true,
          options: [{ value: "soft", label: "Мягкий" }, { value: "bright", label: "Яркий" }, { value: "deep", label: "Глубокий" }] },
        { key: "_test", type: "button", label: "Проверить звук", action: "testSound" },
        { key: "motion", type: "chips", label: "Анимации", source: "motion" },
        { key: "confetti", type: "toggle", label: "Салют за верный ответ" },
        { key: "answerGlow", type: "toggle", label: "Подсветка правильного" },
      ],
    },
  ];
  let activeSection = "look";

  /* ============================================================
     ЗАГРУЗКА / СОХРАНЕНИЕ
     ============================================================ */
  function load(fromStats) {
    const defaults = (window.DQ_THEME && window.DQ_THEME.DEFAULTS) || {};
    S.ui = { ...defaults, ...((fromStats && fromStats.ui) || {}) };
    apply();
  }

  function save(patch) {
    Object.assign(S.ui, patch || {});
    // ручная перемена настройки важнее прошлого состояния круга
    if (window.DQ && window.DQ.syncRepeatMode) window.DQ.syncRepeatMode();
    S.dirty = true;
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(() => {
      fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ui: S.ui }),
      }).catch(() => {});
    }, 400);
  }

  /* ============================================================
     ПРИМЕНЕНИЕ
     ============================================================ */
  function apply() {
    if (window.DQ_THEME) window.DQ_THEME.apply(S.ui);
    if (window.DQLiquid) window.DQLiquid.applyQuality(S.ui.glass || "balanced");
    if (window.DQSND) window.DQSND.set(S.ui);
    if (window.DQFX) window.DQFX.sync();
    if (window.DQVoice) window.DQVoice.set(S.ui);
    if (window.DQLearn) window.DQLearn.sync();
    document.body.dataset.sound = S.ui.sound === false ? "off" : "on";
  }

  function set(key, value) {
    if (!key || key === "undefined") return;
    const known = new Set(Object.keys((window.DQ_THEME && window.DQ_THEME.DEFAULTS) || {}));
    if (!known.has(key)) return;   // защита от мусорных ключей в сохранённых настройках
    S.ui[key] = value;
    apply();
    save();
  }

  /* ============================================================
     ПАНЕЛЬ
     ============================================================ */
  function optionsFor(ctrl) {
    if (ctrl.options) return ctrl.options;
    if (window.DQ_THEME && ctrl.source) return window.DQ_THEME.options(ctrl.source);
    return [];
  }

  function controlHtml(ctrl) {
    const v = S.ui[ctrl.key];
    const opts = optionsFor(ctrl);

    if (ctrl.type === "cards") {
      return `<div class="set-cards" data-key="${ctrl.key}">
        ${opts.map((o) => `<button class="set-card ${String(v) === o.value ? "on" : ""}"
          data-value="${o.value}"><i class="sc-preview" data-theme="${o.value}"></i>
          <span>${o.label}</span></button>`).join("")}
      </div>`;
    }
    if (ctrl.type === "select") {
      return `<select class="input set-select" data-key="${ctrl.key}">
        ${opts.map((o) => `<option value="${o.value}" ${String(v) === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
      </select>`;
    }
    if (ctrl.type === "swatches") {
      return `<div class="set-swatches" data-key="${ctrl.key}">
        ${opts.map((o) => `<button class="set-sw ${String(v) === o.value ? "on" : ""}"
          data-value="${o.value}" title="${o.label}"
          style="--sw:${colorOf(o.value)}" aria-label="${o.label}"></button>`).join("")}
      </div>`;
    }
    if (ctrl.type === "chips") {
      return `<div class="set-chips" data-key="${ctrl.key}">
        ${opts.map((o) => `<button class="chip ${String(v) === o.value ? "on" : ""}"
          data-value="${o.value}">${o.label}</button>`).join("")}
      </div>`;
    }
    if (ctrl.type === "toggle") {
      return `<button class="set-toggle ${v ? "on" : ""}" data-key="${ctrl.key}" role="switch"
        aria-checked="${!!v}"><span class="knob"></span></button>`;
    }
    if (ctrl.type === "range") {
      const shown = ctrl.pct ? Math.round(Number(v) * 100) + "%"
        : ctrl.plain ? String(v)
        : Number(v).toFixed(2).replace(/\.?0+$/, "") + "×";
      return `<div class="set-range">
        <input type="range" class="set-slider" data-key="${ctrl.key}"
          data-plain="${ctrl.plain ? 1 : 0}"
          min="${ctrl.min ?? 0}" max="${ctrl.max ?? 1}" step="${ctrl.step ?? 0.01}"
          value="${v}">
        <span class="set-range-val">${shown}</span>
      </div>`;
    }
    if (ctrl.type === "button") {
      return `<button class="set-link" data-action="${ctrl.action}">${ctrl.label}</button>`;
    }
    if (ctrl.type === "info") {
      const info = window.DQVoice ? window.DQVoice.info() : null;
      if (!info) return `<div class="set-info muted small">—</div>`;
      const lines = [``, `Выбран: <b>${info.chosen}</b>`, `Всего немецких: ${info.count}`]
        .concat(info.voices.slice(0, 6).map((v) => `<div class="muted small">• ${v}</div>`));
      return `<div class="set-info">${lines.join("<br>")}</div>`;
    }
    return "";
  }

  function colorOf(name) {
    const map = {
      mint: "#31d6a2", lime: "#9fdc3e", sky: "#4aa8ff", violet: "#9d8bff",
      coral: "#ff7b6b", amber: "#ffc247", ice: "#8fe3ff", rose: "#ff92b8",
    };
    return map[name] || "var(--accent)";
  }

  /* -------------------- рендер -------------------- */
  function renderNav() {
    const nav = $("#settingsNav");
    if (!nav) return;
    nav.innerHTML = SCHEMA.map((g) => `<button class="set-nav-item ${g.id === activeSection ? "active" : ""}" data-sec="${g.id}">
      <span class="ico ${g.icon}"></span>${g.title}</button>`).join("");
    $$(".set-nav-item", nav).forEach((b) => {
      b.onclick = () => {
        activeSection = b.dataset.sec;
        render();
        const body = $("#settingsBody");
        if (body) body.scrollTop = 0;
      };
    });
  }

  function render() {
    const host = $("#settingsBody");
    if (!host) return;
    renderNav();
    const group = SCHEMA.find((g) => g.id === activeSection) || SCHEMA[0];

    host.innerHTML = `
      <section class="set-group set-section">
        <div class="set-group-head">
          <span class="ico ${group.icon}"></span><h4>${group.title}</h4>
        </div>
        ${group.controls.filter((c) => c.type !== "info").map((ctrl) => rowHtml(ctrl)).join("")}
      </section>
      <div class="set-foot">
        <button id="setResetAll">Вернуть настройки по умолчанию</button>
      </div>`;
    bind();
  }

  /** Одна строка настроек в стиле iOS: подпись слева, контрол/значение справа. */
  function rowHtml(ctrl) {
    const stack = ["swatches", "chips", "cards"].includes(ctrl.type);
    const hint = ctrl.hint ? `<em class="set-hint">${ctrl.hint}</em>` : "";
    return `<div class="set-row${stack ? " stack" : ""}" data-type="${ctrl.type}">
      <span class="set-label">${ctrl.label}${hint}</span>
      ${controlHtml(ctrl)}
    </div>`;
  }

  function bind() {
    const host = $("#settingsBody");
    if (!host) return;

    $$(".set-select", host).forEach((sel) => {
      sel.onchange = () => {
        set(sel.dataset.key, sel.value);
        window.DQSND && window.DQSND.switch();
      };
    });

    $$(".set-sw", host).forEach((b) => {
      b.onclick = () => {
        const key = b.parentElement.dataset.key;   // data-key живёт на контейнере
        if (!key) return;
        set(key, b.dataset.value);
        $$(".set-sw", b.parentElement).forEach((x) => x.classList.toggle("on", x === b));
        window.DQSND && window.DQSND.tap();
      };
    });

    $$(".set-cards .set-card", host).forEach((b) => {
      b.onclick = () => {
        const key = b.parentElement.dataset.key;
        if (!key) return;
        set(key, b.dataset.value);
        $$(".set-card", b.parentElement).forEach((x) => x.classList.toggle("on", x === b));
        window.DQSND && window.DQSND.tap();
      };
    });

    $$(".set-chips .chip", host).forEach((b) => {
      b.onclick = () => {
        const key = b.parentElement.dataset.key;
        // число — числом, иначе сравнение в «%» по строгости сломается
        const raw = b.dataset.value;
        set(key, raw !== "" && !isNaN(Number(raw)) ? Number(raw) : raw);
        $$(".chip", b.parentElement).forEach((x) => x.classList.toggle("on", x === b));
        window.DQSND && window.DQSND.switch();
      };
    });

    $$(".set-toggle", host).forEach((b) => {
      b.onclick = () => {
        const key = b.dataset.key;
        const next = !S.ui[key];
        set(key, next);
        b.classList.toggle("on", next);
        b.setAttribute("aria-checked", String(next));
        window.DQSND && window.DQSND.switch();
      };
    });

    $$(".set-slider", host).forEach((sl) => {
      sl.oninput = () => {
        const key = sl.dataset.key;
        const val = Number(sl.value);
        S.ui[key] = val;
        apply();
        const out = sl.parentElement.querySelector(".set-range-val");
        if (out) out.textContent = sl.dataset.plain === "1"
          ? String(val)
          : (key === "soundVolume" ? Math.round(val * 100) + "%"
             : Number(val).toFixed(2).replace(/\.?0+$/, "") + "×");
        window.DQSND && window.DQSND.tap();
      };
      sl.onchange = () => save();
    });

    $$("[data-action]", host).forEach((b) => {
      b.onclick = () => {
        if (b.dataset.action === "testSound") {
          window.DQSND && window.DQSND.correct();
          setTimeout(() => window.DQSND && window.DQSND.star(), 320);
        }
        if (b.dataset.action === "testVoice") {
          window.DQVoice && window.DQVoice.say("Guten Tag! Ich lerne Deutsch.", "de");
        }
      };
    });

    const reset = $("#setResetAll");
    if (reset) reset.onclick = () => {
      S.ui = { ...(window.DQ_THEME.DEFAULTS || {}) };
      apply();
      save();
      render();
      if (window.DQ && window.DQ.syncRepeatMode) window.DQ.syncRepeatMode();
      window.DQSND && window.DQSND.switch();
    };
  }

  /* ============================================================
     ОТКРЫТИЕ / ЗАКРЫТИЕ
     ============================================================ */
  function open() {
    render();
    const ov = $("#settingsOverlay");
    if (!ov) return;
    ov.classList.add("open");
    document.documentElement.classList.add("modal-open");
    window.DQSND && window.DQSND.open();
    if (window.DQFX) window.DQFX.stagger($("#settingsBody"));
  }

  function close() {
    const ov = $("#settingsOverlay");
    if (!ov) return;
    ov.classList.remove("open");
    document.documentElement.classList.remove("modal-open");
    window.DQSND && window.DQSND.close();
  }

  function init(fromStats) {
    load(fromStats);
    const ov = $("#settingsOverlay");
    if (ov) ov.onclick = (e) => { if (e.target.id === "settingsOverlay") close(); };
    const closeBtn = $("#settingsClose");
    if (closeBtn) closeBtn.onclick = close;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && ov && ov.classList.contains("open")) close();
    });
  }

  return {
    init, open, close, set, render, apply, save,
    get ui() { return S.ui; },
  };
})();