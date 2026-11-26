/* ============================================================
   Deutsch Quest — ПРОИЗНОШЕНИЕ (клиентская часть)

   Три задачи:

   1) ЖИВАЯ ОЗВУЧКА (window.DQVoice)
      SpeechSynthesis, но с «человеческим» подходом:
        • выбирается ЛУЧШИЙ доступный немецкий голос — приоритет у
          нейросетевых: «Google Deutsch» (Chrome), «Microsoft Katja/Katrin/
          Conrad/Klaus Online (Natural)» (Edge), «Anna», «Markus» (macOS);
        • «словарные» слова сначала ищутся в audio_cache (Google TTS —
          запись произведения речи) через /api/tts: живое качество и без
          роботизированного синтеза;
        • фраза читается с паузами между частями (в т.ч. по запятым);
        • темп/тон регулируются в настройках, при сбое — откат к другому голосу;
        • всегда есть повтор и «медленно» (rate 0.6) — для тренировки слуха.

   2) РАЗБОР ГОЛОСОВ И ДИАГНОСТИКА (показывает, какие голоса есть).

   3) КАРТОЧКА ТРАНСКРИПЦИИ (window.DQPhon)
      Рисует «Как это звучит»: IPA, слоги, русская транскрипция с ударением,
      кнопки ▶ и 🐢 и справку «звуки, которые вы не знаете».
      Данные приходят с сервера (/api/pron), кэшируются в памяти.
   ============================================================ */
"use strict";

/* ============================================================
   1. ГОЛОС
   ============================================================ */
window.DQVoice = (function () {
  const S = {
    voices: [],
    de: null,          // выбранный немецкий голос (браузерный запасной)
    ru: null,
    ready: false,
    rate: 1,           // множитель к базовому темпу (настройка)
    pitch: 1,
    gender: "auto",    // auto | female | male
    cacheOk: true,     // сервер умеет отдавать mp3 (нейро-голос)
    serverVoice: true, // слова озвучивает сервер — они звучат живо
    speaking: false,
    prewarm: new Set(), // слова, которые уже греем в кэше
  };

  /* Ранг голоса: чем больше, тем «живее». Natural/Neural/Google — первыми. */
  const NAME_RANK = [
    [/microsoft.*(katja|katrin|conrad|klaus|heinz|amala|killian|seraphina|florian)/i, 90],
    [/\(natural\)/i, 100],
    [/online/i, 40],
    [/google/i, 95],
    [/apple|anna|markus|yuna|petra/i, 80],
    [/siri/i, 70],
    [/deutsch|german/i, 30],
  ];
  const PREFERRED_FEMALE = /katja|katrin|anna|petra|yuna|marlene|vicki|amala|seraphina|female|frau|google/i;
  const PREFERRED_MALE = /conrad|klaus|heinz|killian|florian|markus|male|mann|stefan/i;

  function score(v) {
    let s = 0;
    for (const [re, pts] of NAME_RANK) if (re.test(v.name || "")) s += pts;
    if (v.localService === false) s += 25;            // сетевые голоса звучат лучше
    if (S.gender === "female" && PREFERRED_FEMALE.test(v.name)) s += 35;
    if (S.gender === "male" && PREFERRED_MALE.test(v.name)) s += 35;
    return s;
  }

  function load() {
    if (!window.speechSynthesis) return;
    const all = window.speechSynthesis.getVoices() || [];
    S.voices = all;
    const de = all.filter((v) => /^(de|de-DE|de-AT|de-CH)/i.test(v.lang) ||
      /deutsch|german/i.test(v.name));
    const ru = all.filter((v) => /^ru/i.test(v.lang));
    const byName = (a, b) => score(b) - score(a);
    de.sort(byName);
    S.de = de[0] || null;
    S.ru = ru[0] || null;
    S.ready = true;
    S.all_de = de;
  }

  function init() {
    if (!window.speechSynthesis) return;
    load();
    window.speechSynthesis.onvoiceschanged = load;
    // некоторые браузеры отдают голоса только после «щелчка» — пробуем по таймеру
    setTimeout(load, 400);
    setTimeout(load, 1500);
  }

  function pick(lang) {
    return lang === "ru" ? S.ru : S.de;
  }

  /** Разбивает длинный текст на части по запятым/точкам — речь звучит естественнее. */
  function chunks(text) {
    const parts = String(text).split(/(?<=[,;:.!?])\s+/).filter(Boolean);
    return parts.length ? parts : [String(text)];
  }

  /* ------------------ браузерный синтез (fallback и фразы) ------------------ */
  function speakBrowser(text, lang, opts) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) return resolve(false);
      try { window.speechSynthesis.cancel(); } catch (e) { }
      const voice = opts.voice || pick(lang);
      const rate = (lang === "de" ? 0.92 : 0.98) * (opts.rate || S.rate);
      const list = chunks(text);
      let i = 0;
      S.speaking = true;
      const next = () => {
        if (i >= list.length) { S.speaking = false; resolve(true); return; }
        const u = new SpeechSynthesisUtterance(list[i++]);
        u.lang = lang === "ru" ? "ru-RU" : (voice && voice.lang) || "de-DE";
        if (voice) u.voice = voice;
        u.rate = Math.max(0.5, Math.min(1.6, rate));
        u.pitch = (S.pitch || 1) * (opts.pitch || 1);
        u.volume = 1;
        u.onend = () => setTimeout(next, list.length > 1 ? 90 : 0);
        u.onerror = () => { S.speaking = false; resolve(false); };
        try { window.speechSynthesis.speak(u); }
        catch (e) { S.speaking = false; resolve(false); }
      };
      next();
    });
  }

  /* ------------------ серверная озвучка (нейро-голос, mp3) ------------------ */
  const _audio = new Audio();
  _audio.preload = "auto";
  let _audioToken = 0;
  const _cache = new Map();           // url → ready(true/false)

  function ttsUrl(text, lang, opts) {
    return "/api/tts?lang=" + encodeURIComponent(lang) +
      "&text=" + encodeURIComponent(text) +
      (opts.slow ? "&slow=1" : "") +
      "&gender=" + (S.gender === "male" ? "male" : "female");
  }

  /** Фоновая предзагрузка: к моменту вопроса mp3 уже в кэше браузера. */
  function prewarm(text, lang = "de", opts = {}) {
    text = String(text || "").trim();
    if (!text || !S.cacheOk || S.prewarm.has(text)) return;
    S.prewarm.add(text);
    const url = ttsUrl(text, lang, opts);
    const a = new Audio();
    a.preload = "auto";
    a.src = url;
    _cache.set(url, false);
    a.addEventListener("loadeddata", () => _cache.set(url, true), { once: true });
    a.addEventListener("error", () => _cache.set(url, false), { once: true });
    a.load();
  }

  async function speakServer(text, lang, opts) {
    const token = ++_audioToken;
    const url = ttsUrl(text, lang, opts);
    try {
      _audio.pause();
      _audio.src = url;
      await new Promise((res, rej) => {
        const done = () => { _audio.removeEventListener("error", fail); res(); };
        const fail = () => { _audio.removeEventListener("loadeddata", done); rej(); };
        _audio.addEventListener("loadeddata", done, { once: true });
        _audio.addEventListener("error", fail, { once: true });
        _audio.load();
        // нейро-синтез на сервере может занять до пары секунд при первом запросе
        setTimeout(() => rej(new Error("timeout")), 6000);
      });
      if (token !== _audioToken) return false;
      // mp3 — 24 кГц, браузер тянет скорость без «пластеровки»
      _audio.playbackRate = Math.max(0.5, Math.min(1.6, (opts.rate || 1) * (opts.slow ? 0.85 : 1)));
      await _audio.play();
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Говорить. Живой голос по умолчанию:
   *   say(text, "de")               — нейро-голос Katja/Conrad (сервер), иначе браузер
   *   say(text, "de", { slow:true })— медленно (тренировка слуха)
   *   say(text, "de", { forceBrowser:true }) — всегда браузерный синтез
   */
  async function say(text, lang = "de", opts = {}) {
    text = String(text || "").trim();
    if (!text) return false;
    lang = lang === "ru" ? "ru" : "de";
    stop();
    if (S.serverVoice && S.cacheOk && !opts.forceBrowser) {
      const ok = await speakServer(text, lang, opts);
      if (ok) return true;
      // сервер не смог (нет edge-tts / сеть) — один раз помечаем и отдаём браузеру,
      // но через минуту снова пробуем (сеть могла вернуться)
      S.cacheOk = false;
      setTimeout(() => { S.cacheOk = true; }, 60000);
    }
    return speakBrowser(text, lang, opts);
  }

  function slow(text, lang = "de") { return say(text, lang, { slow: true }); }

  function stop() {
    _audioToken++;
    try { _audio.pause(); } catch (e) { }
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { }
    S.speaking = false;
  }

  /** Диагностика для настроек: какие голоса найдены и какой выбран. */
  function info() {
    const de = (S.all_de || []).map((v) => `${v.name} (${v.lang}${v.localService ? "" : ", сеть"})`);
    return {
      supported: !!window.speechSynthesis,
      chosen: S.de ? `${S.de.name} (${S.de.lang})` : "нет немецкого голоса — используется сервер",
      count: (S.all_de || []).length,
      voices: de,
      server: S.cacheOk,
    };
  }

  function set(cfg) {
    if (!cfg) return;
    if (typeof cfg.voiceRate === "number") S.rate = cfg.voiceRate;
    if (typeof cfg.voicePitch === "number") S.pitch = cfg.voicePitch;
    if (cfg.voiceGender) S.gender = cfg.voiceGender;
    if (typeof cfg.serverVoice === "boolean") S.serverVoice = cfg.serverVoice;
    // пересобрать приоритет
    const all = S.voices || [];
    const de = all.filter((v) => /^de/i.test(v.lang) || /deutsch|german/i.test(v.name));
    de.sort((a, b) => score(b) - score(a));
    S.all_de = de;
    S.de = de[0] || null;
  }

  init();

  return {
    say, slow, stop, info, set, prewarm, refresh: load,
    get chosen() { return S.de; },
    get voices() { return S.voices; },
    get speaking() { return S.speaking; },
    get alive() { return S.cacheOk; },
  };
})();

/* ============================================================
   2. КАРТОЧКА ТРАНСКРИПЦИИ (window.DQPhon)
   ============================================================ */
window.DQPhon = (function () {
  const cache = new Map();
  let pending = null;

  async function fetchAll(words) {
    const todo = words.filter((w) => w && !cache.has(w.toLowerCase()));
    if (!todo.length) return;
    pending = pending || fetch("/api/pron", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: Array.from(new Set(todo)).slice(0, 120) }),
    }).then((r) => r.json()).then((data) => {
      Object.entries(data.words || {}).forEach(([k, v]) => cache.set(k, v));
    }).catch(() => { }).finally(() => { pending = null; });
    await pending;
  }

  function get(word) {
    return cache.get(String(word || "").toLowerCase()) || null;
  }

  /** HTML карточки: IPA / слоги / русская транскрипция + кнопки. */
  function card(word, opts = {}) {
    const d = get(word);
    if (!d || !d.ipa) return "";
    const compact = opts.compact ? " ph-compact" : "";
    const ru = (d.ru || "").replace(/-/g, "-");
    return `<div class="ph-card${compact}">
      ${opts.title === false ? "" : `<div class="ph-head">Как это звучит</div>`}
      <div class="ph-main">
        <span class="ph-ipa">/${d.ipa}/</span>
        <span class="ph-actions">
          <button class="ph-btn" data-say="${encodeURIComponent(word)}" title="Слушать"><span class="ico ico-vol"></span></button>
          <button class="ph-btn slow" data-say="${encodeURIComponent(word)}" data-slow="1" title="Медленно"><span class="ico ico-slow"></span></button>
        </span>
      </div>
      <div class="ph-rows">
        <span class="ph-row"><i>слоги</i> ${(d.syllables || []).join("·")}</span>
        <span class="ph-row"><i>по-русски</i> <b>${ru}</b></span>
      </div>
    </div>`;
  }

  function bind(root = document) {
    root.querySelectorAll("[data-say]").forEach((b) => {
      if (b._phBound) return;
      b._phBound = true;
      b.onclick = (e) => {
        e.stopPropagation();
        const word = decodeURIComponent(b.dataset.say);
        window.DQVoice.say(word, "de", { slow: b.dataset.slow === "1" });
      };
    });
  }

  /** Подгрузить транскрипции для списка слов. */
  async function prepare(words) {
    await fetchAll(words);
  }

  /** Готовые данные с сервера (/api/pairs отдаёт pron вместе со словами). */
  function seed(map) {
    Object.entries(map || {}).forEach(([k, v]) => cache.set(String(k).toLowerCase(), v));
  }

  /** Клочок виджета для русскоговорящего: «звуки, которых нет в русском». */
  const SOUND_NOTES = [
    ["ç", "ich-звук: мягкое «хь» — как в «хи» без взрыва, только воздух."],
    ["x", "ach-звук: резкое «х» из горла — Bach, Nacht, Buch."],
    ["ʃ", "«ш», но язык дальше назад, чем в русском."],
    ["ts", "«ц» в один звук — Zug, Zeit, Katze."],
    ["œ", "«ё» без «й» — только губы: schön, Können."],
    ["y", "«ю», но губы вытянуты как при «у» — fünf, Tür."],
    ["ʏ", "короткое «ю» с губами «у» — Glück, fünf."],
    ["ɛ", "открытое «э» — Bär, Hände."],
    ["ɐ", "безударное «а» на конце (ер) — Wasser, Vater."],
    ["ə", "безударное «э» — bitte, habe."],
    ["ʁ", "мягкое «р» из горла — rot, rot genau."],
    ["ŋ", "«н» через нос — singen, Zunge."],
    ["ɔʏ", "«ой» — heute, Häuser."],
    ["aɪ", "«ай» — mein, Zeit."],
    ["aʊ", "«ау» — Haus, braun."],
    ["ː", "долгота: гласную тянем в два раза дольше."],
    ["ˈ", "ударение: следующий слог — основной."],
  ];

  function notesFor(word) {
    const d = get(word);
    if (!d || !d.ipa) return [];
    return SOUND_NOTES.filter(([sym]) => d.ipa.includes(sym));
  }

  return { card, get, prepare, seed, bind, notesFor, SOUND_NOTES };
})();
