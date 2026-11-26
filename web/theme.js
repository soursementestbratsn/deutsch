/* ============================================================
   Deutsch Quest — СЛОЙ ОФОРМЛЕНИЯ (единственное место для правок вида)

   Здесь ВСЁ, что отвечает за внешний вид и «ощущение»:
     • THEMES     — цветовые темы
     • ACCENTS    — акцентные цвета
     • BACKDROPS  — стили фона (градиент, сетка, звёзды)
     • DENSITIES  — плотность интерфейса (скругления, отступы)
     • MOTION     — скорость анимаций
     • DEFAULTS   — настройки по умолчанию

   Как менять:
     — новый цвет темы → объект в THEMES (и параметр в style.css)
     — новый акцент    → ACCENTS (+ переменная --sw-<имя> в style.css)
     — новый фон       → BACKDROPS (+ правило body[data-backdrop="…"] в style.css)
     — строже/воздушнее → DENSITIES

   Имена переменных совпадают с style.css: --bg, --text, --accent…
   ============================================================ */
"use strict";

window.DQ_THEME = {
  THEMES: {
    graphite: { label: "Графит", vars: { bg: "#151517", bg2: "#212227", text: "#f5f5f7", dim: "#b8bcc7", faint: "#7b8190" } },
    night: { label: "Ночь", vars: { bg: "#070c15", bg2: "#101b2b", text: "#f5f8ff", dim: "#a9b9d7", faint: "#7383a2" } },
    ocean: { label: "Океан", vars: { bg: "#031922", bg2: "#0a2a39", text: "#eaf9ff", dim: "#a4c8d9", faint: "#6e91a8" } },
    neon: { label: "Неон", vars: { bg: "#130b1d", bg2: "#20133a", text: "#f7eeff", dim: "#c8b8e8", faint: "#8f79b1" } },
    light: { label: "Свет", vars: { bg: "#e9eef5", bg2: "#dde7f2", text: "#182233", dim: "#526176", faint: "#77869a" } },
    sand: { label: "Песок", vars: { bg: "#f6efe4", bg2: "#efe3d2", text: "#2b2118", dim: "#5f5346", faint: "#8a7d6e" } },
    slate: { label: "Туман", vars: { bg: "#171a1e", bg2: "#22272e", text: "#eef2f7", dim: "#adb7c4", faint: "#76808d" } },
    forest: { label: "Изумруд", vars: { bg: "#08130f", bg2: "#10221b", text: "#eef7f1", dim: "#a7bfb0", faint: "#6f8a79" } }
  },

  ACCENTS: {
    mint: { label: "Мята", vars: { accent: "#2ee6a8", accent2: "#7bffd0", onAccent: "#06121c" } },
    lime: { label: "Лайм", vars: { accent: "#b4f24b", accent2: "#d8ff85", onAccent: "#14180a" } },
    sky: { label: "Небо", vars: { accent: "#3fa9ff", accent2: "#8fd0ff", onAccent: "#04131f" } },
    violet: { label: "Фиолет", vars: { accent: "#a98bff", accent2: "#cfc0ff", onAccent: "#120a22" } },
    coral: { label: "Коралл", vars: { accent: "#ff6b6b", accent2: "#ffa3a3", onAccent: "#1c0707" } },
    amber: { label: "Янтарь", vars: { accent: "#ffb020", accent2: "#ffd27a", onAccent: "#1a1102" } },
    ice: { label: "Лёд", vars: { accent: "#9fe8ff", accent2: "#d6f5ff", onAccent: "#04161c" } },
    rose: { label: "Роза", vars: { accent: "#ff8fb8", accent2: "#ffc2d6", onAccent: "#1b0710" } }
  },

  BACKDROPS: { aurora: "Аврора", mesh: "Сетка", stars: "Звёзды", plain: "Ровный" },

  DENSITIES: {
    compact: { label: "Компактно", radius: 14 },
    normal: { label: "Обычно", radius: 22 },
    airy: { label: "Просторно", radius: 28 }
  },

  MOTION: {
    off: { label: "Выключены", k: 0 },
    fast: { label: "Быстро", k: 0.6 },
    normal: { label: "Обычно", k: 1 },
    slow: { label: "Плавно", k: 1.5 }
  },

  /* Качество «жидкого стекла»: плата за красоту — размытие фона */
  GLASS: {
    high: { label: "Максимум" },
    balanced: { label: "Баланс" },
    low: { label: "Скорость" }
  },

  /* Насколько жёстко проверяется введённый ответ (web/dq.js: matchAnswer).
     Ключи-строки — их же берут кнопки-чипсы в настройках. */
  TOLERANCE: {
    "0": { label: "Идеально", hint: "Только точное написание" },
    "1": { label: "1 буква", hint: "Одна опечатка прощается" },
    "2": { label: "Обычно", hint: "Похожий ответ прощается" },
    "3": { label: "Чуть не так", hint: "До двух букв, если ответ похож" }
  },

  DEFAULTS: {
    theme: "graphite",
    glass: "balanced",   // high | balanced | low — качество Liquid Glass
    accent: "mint",
    backdrop: "aurora",
    density: "normal",
    motion: "normal",
    sound: true,
    soundVolume: 0.45,
    soundTone: "soft",
    soundEffects: true,     // звуки правильно/неправильно везде
    confetti: true,
    answerGlow: true,
    /* --- озвучка и транскрипция --- */
    serverVoice: true,      // слова — записью голоса (audio_cache), а не синтезом
    voiceRate: 1,           // темп речи (0.6 — медленно … 1.3 — быстро)
    voicePitch: 1,
    voiceGender: "auto",    // auto | female | male
    voiceVariant: "standard", // standard | austria | swiss (для немецкого)
    autoSay: true,          // читать новое слово автоматически
    showPron: true,         // показывать IPA/слоги/русскую транскрипцию
    showPronAnswer: true,   // транскрипция и в ответе (после проверки)
    /* --- учёба --- */
    srs: true,              // интервальное повторение
    noRepeat: true,         // все слова по одному разу за круг (без повторов)
    tolerance: 2,           // строгость проверки: 0 идеально … 3 «чуть не так»
    autoNext: true,         // сам переходить к следующему вопросу
    dailyGoal: 10,          // цель ответов за день
    haptics: true,

    /* --- читаемость и вид (новые) --- */
    fontSize: 100,          // размер текста в интерфейсе, % (90…130)
    reduceGlow: false,      // убрать цветные пятна фона
    compactSidebar: false,  // узкая левая колонка тренажёра
    highContrast: false,    // контрастная обводка у карточек и кнопок

    /* --- озвучка и произношение (новые) --- */
    readRu: false,          // при ответе читать ещё и русский перевод
    slowFirstAnswer: true,  // первое озвучивание нового слова — медленнее
    pronBrowse: true,       // транскрипция в списках (Мои слова / группы)

    /* --- учёба (новые) --- */
    typoStreakFreeze: true, // опечатка не сбрасывает серию
    showArticle: true,      // подсказывать артикль (der/die/das) к немецкому слову
    showPlural: false,      // показывать форму множественного числа
    showRelated: true,      // похожие слова в разборе ответа
    nlGerman: false,        // в «Мои слова» — краткий перевод по-немецки
    wordOfDay: true,        // «слово дня» на экране тренажёра
    gamify: true,           // XP, уровни, конфетти и звуки
    smartRepeat: true,      // слова с ошибками возвращаются раньше остальных
    srsCap: 60,             // максимум слов в повторении за день
    goalLevel: 50,          // цель: % правильных ответов за день

    /* --- ритм и дисциплина (новые) --- */
    studyTimer: 0,          // таймер сессии, мин (0 — выкл.)
    focusMusic: false,      // тихий фон в режиме фокуса
    breakReminder: true,    // напоминать о перерыве

    /* --- тренировка навыков (новые) --- */
    mistakeOnly: false,     // тренажёр только по словам с ошибками
    reverseOnMistake: false,// после ошибки спросить это слово в обратную сторону
    autoCards: true,        // новые слова — сразу в карточки
    shadowing: false,       // в озвучке повторять слово вместе с голосом
    typingPractice: true,   // в подсказках — где нажать на клавиатуре
    greeting: true,         // приветствие с планом дня при открытии
    /* --- артикли и фото слов (новое) --- */
    articles: false,        // der — синий, die — красный, das — зелёный (по умолчанию выкл.: мешает читать)
    wordPhotos: true,       // показывать фото, которые добавлены словам
    photoMax: 0,            // 0 — без ограничения: фото показывается везде, где есть слово
    /* --- Liquid Glass (новые) --- */
    glassDepth: 50,          // глубина стекла 0-100
    lightAngle: 135,         // угол блика 0-360
    chromatic: false,        // хроматическая аберрация по краям
    shapeMorph: true,        // морфинг форм карточек
    accentGlow: true,        // свечение акцента
    glassTint: true,         // оттенок стекла
    parallax: true,          // параллакс слоёв
    highContrastGlass: false // контрастное стекло
  },

  /** Применяет настройки вида к <body> и CSS-переменным. */
  apply(ui) {
    const u = { ...this.DEFAULTS, ...(ui || {}) };
    const body = document.body;
    body.dataset.theme = this.THEMES[u.theme] ? u.theme : "graphite";
    body.dataset.accent = this.ACCENTS[u.accent] ? u.accent : "mint";
    body.dataset.backdrop = this.BACKDROPS[u.backdrop] ? u.backdrop : "aurora";
    body.dataset.density = this.DENSITIES[u.density] ? u.density : "normal";
    const k = (this.MOTION[u.motion] || this.MOTION.normal).k;
    const root = document.documentElement;
    root.style.setProperty("--motion", String(k));
    root.style.setProperty("--radius", (this.DENSITIES[u.density] || this.DENSITIES.normal).radius + "px");
    // Сцена «стекла» была захардкожена в чёрный (glass.css) — из-за этого
    // темы Ночь/Океан/Песок и т.д. визуально не меняли фон. Красим её от темы.
    const th = (this.THEMES[body.dataset.theme] || this.THEMES.graphite).vars;
    root.style.setProperty("--scene-bg", th.bg);
    root.style.setProperty("--scene-mid", th.bg2);
    root.style.setProperty("--is-light", body.dataset.theme === "light" || body.dataset.theme === "sand" ? "1" : "0");
    // читаемость и плотность (20 новых настроек — вид)
    const fs = Math.max(90, Math.min(130, Number(u.fontSize) || 100));
    root.style.setProperty("--ui-scale", String(fs / 100));
    body.style.fontSize = fs === 100 ? "" : (16 * fs / 100).toFixed(2) + "px";
    body.classList.toggle("is-compact-side", !!u.compactSidebar);
    body.classList.toggle("is-contrast", !!u.highContrast);
    body.dataset.glow = u.reduceGlow ? "off" : "on";
    // Liquid Glass (новые)
    root.style.setProperty("--glass-depth", String(Math.max(0, Math.min(100, Number(u.glassDepth) || 50))));
    root.style.setProperty("--light-angle", String(Math.max(0, Math.min(360, Number(u.lightAngle) || 135)) + "deg"));
    body.classList.toggle("is-chromatic", !!u.chromatic);
    body.classList.toggle("is-shape-morph", !!u.shapeMorph);
    body.classList.toggle("is-accent-glow", !!u.accentGlow);
    body.classList.toggle("is-glass-tint", !!u.glassTint);
    body.classList.toggle("is-parallax", !!u.parallax);
    body.classList.toggle("is-hc-glass", !!u.highContrastGlass);
    body.classList.toggle("is-calm", !!u.calmMode);
    const scene = document.querySelector(".glass-light");
    if (scene) scene.style.opacity = u.reduceGlow ? ".35" : "";
    return u;
  },

  /** Список вариантов для панели настроек. */
  options(kind) {
    const extra = {
      voiceGender: { auto: { label: "Любой лучший" }, female: { label: "Женский" }, male: { label: "Мужской" } },
      voiceVariant: { standard: { label: "Стандарт (DE)" }, austria: { label: "Австрия (AT)" }, swiss: { label: "Швейцария (CH)" } },
      tolerance: this.TOLERANCE,
    };
    const src = kind === "theme" ? this.THEMES
      : kind === "accent" ? this.ACCENTS
      : kind === "density" ? this.DENSITIES
      : kind === "glass" ? this.GLASS
      : kind === "motion" ? this.MOTION
      : kind === "backdrop" ? this.BACKDROPS
      : extra[kind] || {};
    return Object.entries(src).map(([value, v]) => ({
      value,
      label: typeof v === "string" ? v : v.label
    }));
  }
};

/* Раннее имя настроек — отдельный объект, созданный при загрузке темы. */
if (!window.SETTINGS) window.SETTINGS = { ui: {} };
