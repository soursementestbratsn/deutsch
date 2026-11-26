/* ============================================================
   Deutsch Quest — ЗВУКОВОЙ ДВИЖОК
   Все звуки синтезируются в браузере (WebAudio) — не нужны mp3-файлы,
   поэтому ничего не скачивается и не ломается.

   Публичный API (window.DQSND):
     init()          — создать AudioContext (после первого клика)
     play(name)      — проиграть звук по имени
     set(ui)         — применить громкость/тембр/вкл-выкл
     click() tap() correct() wrong() levelUp() comboS() star() whoosh() ...
     speak(text, lang) — озвучка слова (речь браузера; отдельно от эффектов)

   Как менять:
     — TONES: набор частот тембра (soft / bright / deep);
     — SOUNDS: «партитура» каждого звука: [частота, длительность, тип, задержка];
     — новый звук = новая запись в SOUNDS, вызов DQSND.play("имя").
   ============================================================ */
"use strict";

window.DQSND = (function () {
  let ctx = null;
  const S = {
    on: true, volume: 0.45, tone: "soft",
    ready: false, last: 0, lastBy: {}, queue: [], qAt: 0,
  };

  /* тембры: множитель частоты + сглаживание */
  const TONES = {
    soft: { mul: 1.0, wave: "sine", q: 1.4 },
    bright: { mul: 1.28, wave: "triangle", q: 1.0 },
    deep: { mul: 0.82, wave: "sine", q: 2.0 },
  };

  /* партитура: [частота (Гц), длительность (с), тип волны, задержка (с), громкость] */
  const SOUNDS = {
    /* интерфейс */
    tap: [[880, 0.05, "sine", 0, 0.35]],
    click: [[660, 0.06, "triangle", 0, 0.4], [990, 0.05, "sine", 0.04, 0.22]],
    switch: [[520, 0.05, "sine", 0, 0.3], [780, 0.07, "sine", 0.05, 0.4]],
    open: [[420, 0.08, "sine", 0, 0.3], [630, 0.1, "sine", 0.07, 0.32], [840, 0.12, "sine", 0.14, 0.28]],
    close: [[760, 0.07, "sine", 0, 0.26], [480, 0.1, "sine", 0.06, 0.24]],
    flip: [[1100, 0.04, "triangle", 0, 0.22], [700, 0.05, "sine", 0.03, 0.16]],

    /* ответы */
    correct: [[784, 0.11, "sine", 0, 0.45], [1046, 0.16, "sine", 0.09, 0.4]],
    wrong: [[196, 0.16, "triangle", 0, 0.42], [147, 0.2, "sine", 0.09, 0.36]],
    near: [[523, 0.08, "sine", 0, 0.28], [587, 0.12, "sine", 0.07, 0.26]],
    tick: [[1320, 0.03, "square", 0, 0.10]],
    timeUp: [[523, 0.12, "triangle", 0, 0.35], [392, 0.16, "triangle", 0.12, 0.32], [262, 0.28, "sine", 0.26, 0.32]],

    /* успехи и прогресс */
    star: [[1046, 0.08, "sine", 0, 0.32], [1318, 0.1, "sine", 0.07, 0.3],
    [1568, 0.14, "sine", 0.14, 0.28]],
    streak: [[880, 0.07, "sine", 0, 0.3], [1108, 0.08, "sine", 0.06, 0.3],
    [1318, 0.1, "sine", 0.12, 0.3], [1760, 0.14, "sine", 0.19, 0.26]],
    levelUp: [[523, 0.1, "triangle", 0, 0.36], [659, 0.1, "triangle", 0.1, 0.36],
    [784, 0.11, "triangle", 0.2, 0.36], [1046, 0.22, "sine", 0.31, 0.38]],
    finish: [[392, 0.12, "sine", 0, 0.32], [523, 0.12, "sine", 0.1, 0.32],
    [659, 0.12, "sine", 0.2, 0.32], [784, 0.24, "sine", 0.3, 0.34]],

    /* игровые */
    whoosh: [[300, 0.16, "sawtooth", 0, 0.12]],
    flipCard: [[540, 0.06, "triangle", 0, 0.22], [820, 0.06, "sine", 0.04, 0.2]],
    match: [[659, 0.09, "sine", 0, 0.4], [880, 0.12, "sine", 0.08, 0.38]],
    miss: [[233, 0.12, "triangle", 0, 0.3], [196, 0.14, "sine", 0.08, 0.26]],
    success: [[523, 0.1, "sine", 0, 0.34], [659, 0.1, "sine", 0.09, 0.34],
              [784, 0.12, "sine", 0.18, 0.34], [1046, 0.2, "sine", 0.28, 0.3]],
    lose: [[330, 0.16, "triangle", 0, 0.3], [262, 0.18, "triangle", 0.14, 0.28],
           [196, 0.26, "sine", 0.28, 0.26]],
  };

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    S.ready = true;
    return ctx;
  }

  function tone(freq, dur, type, delay, gain, volScale = 1) {
    const c = ensure();
    if (!c) return;
    if (c.state !== "running") { try { c.resume(); } catch (e) { } return; }   // до жеста или после сна — не звучим
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    const master = c.createGain();
    const filter = c.createBiquadFilter();
    const toneCfg = TONES[S.tone] || TONES.soft;

    filter.type = "lowpass";
    filter.frequency.value = Math.max(900, freq * 5 * (toneCfg.mul > 1 ? 1.3 : 0.85));
    filter.Q.value = toneCfg.q;

    osc.type = type || toneCfg.wave;
    osc.frequency.setValueAtTime(freq * toneCfg.mul, t0);

    const peak = Math.max(0.0001, (gain || 0.3) * S.volume * volScale);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    master.gain.value = 1;
    osc.connect(filter).connect(g).connect(master).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /* простой «шумовой» хвост для whoosh */
  function noise(dur, delay, gain) {
    const c = ensure();
    if (!c) return;
    if (c.state !== "running") { try { c.resume(); } catch (e) { } return; }
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1200; f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = gain * S.volume;
    src.connect(f).connect(g).connect(c.destination);
    src.start(c.currentTime + (delay || 0));
  }

  /* Очередь: если несколько ответов проверяются одновременно (например, весь
     тест одним нажатием), звуки не глушат друг друга, а играют подряд. */
  function play(name, vol = 1) {
    if (!S.on || S.volume <= 0 || S.effects === false) return;
    const score = SOUNDS[name];
    if (!score) return;
    ensure();
    if (!ctx || ctx.state !== "running") { resumeCtx(); return; }   // нет контекста/звук спит
    const now = performance.now();
    if (now - S.qAt < 120) {            // шальной дубль (двойной клик) — пропускаем
      const last = S.queue[S.queue.length - 1];
      if (last && last.name === name) return;
    }
    if (now - S.qAt > 900) S.queue = [];
    S.qAt = now;
    const at = S.queue.reduce((n, q) => Math.max(n, q.at + q.len), 0);
    const len = name === "whoosh" ? 200 : Math.max.apply(null, score.map((x) => (x[3] || 0) * 1000 + (x[1] || 0) * 1000)) + 40;
    S.queue.push({ name, at: at || now, len });
    if (S.queue.length > 8) return;     // защита от лавины
    if (at > now + 20) setTimeout(() => fire(name, score, vol), at - now);
    else fire(name, score, vol);
  }

  function fire(name, score, vol) {
    if (!S.on || S.volume <= 0) return;
    if (!ctx || ctx.state !== "running") { resumeCtx(); return; }
    if (name === "whoosh") { noise(0.18, 0, 0.25 * vol); return; }
    score.forEach(([f, d, t, delay, g]) => tone(f, d, t, delay, g, vol));
  }

  /* ---------------- готовые действия ---------------- */
  const api = {
    init() {
      sync();
      // AudioContext создаём только после жеста: иначе браузер ругается в консоли
      const unlock = () => { ensure(); resumeCtx(); };
      ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
        document.addEventListener(ev, unlock, { once: true, passive: true }));
      // браузер может усыпить звук после паузы или смены вкладки — будим его на любой жест
      ["pointerdown", "keydown", "focus", "visibilitychange"].forEach((ev) =>
        document.addEventListener(ev, resumeCtx, { passive: true }));
    },
    play,
    set(ui) {
      S.on = ui.sound !== false;
      S.volume = ui.soundVolume === undefined ? 0.45 : Number(ui.soundVolume);
      S.tone = TONES[ui.soundTone] ? ui.soundTone : "soft";
      S.effects = ui.soundEffects !== false;
    },
    resume() { resumeCtx(); },
    tap: () => play("tap"),
    click: () => play("click"),
    switch: () => play("switch"),
    open: () => play("open"),
    close: () => play("close"),
    correct: () => play("correct"),
    wrong: () => play("wrong"),
    near: () => play("near"),
    tick: () => play("tick"),
    timeUp: () => play("timeUp"),
    star: () => play("star"),
    streak: () => play("streak"),
    levelUp: () => play("levelUp"),
    finish: () => play("finish"),
    match: () => play("match"),
    miss: () => play("miss"),
    flipCard: () => play("flipCard"),
    whoosh: () => play("whoosh"),
    get state() { return { ...S }; },
  };

  function resumeCtx() {
    if (ctx && ctx.state !== "running") { try { ctx.resume(); } catch (e) { } }
  }

  function sync() {
    if (window.SETTINGS && window.SETTINGS.ui) api.set(window.SETTINGS.ui);
  }

  /* Страховка «звук везде»: галочки верно/неверно в разметке (data-ok у вариантов,
     .opt.correct / .opt.wrong после ответа) могут остаться без звука, если экран
     не позвал DQSND сам — играем по изменению DOM. Свои звуки остаются как есть. */
  function watchAnswers() {
    if (!window.MutationObserver || !document.body) return;
    const RIGHT = 'button.correct, .opt.correct, .tr-opt.correct, .ex-opt.correct, .rd-opt.correct';
    const WRONG = 'button.wrong, .opt.wrong, .tr-opt.wrong, .ex-opt.wrong, .rd-opt.wrong';
    let last = 0, lastOk = null;
    const obs = new MutationObserver((recs) => {
      let ok = false, bad = false;
      recs.forEach((r) => {
        const t = r.target;
        if (!t || t.nodeType !== 1) return;
        if (r.attributeName === "class") {
          if (t.matches && t.matches(RIGHT)) ok = true;
          if (t.matches && t.matches(WRONG)) bad = true;
        } else if (r.attributeName === "data-ok") {
          if (t.dataset && t.dataset.ok === "1") ok = true;
          else if (t.dataset && t.dataset.ok === "0") bad = true;
        }
      });
      if (!ok && !bad) return;
      const now = performance.now();
      if (now - last < 350 && lastOk === (ok && !bad)) return;   // уже сыграли тот же звук
      last = now; lastOk = ok && !bad;
      api.play(ok && !bad ? "correct" : "wrong");
    });
    obs.observe(document.body, {
      subtree: true, childList: false,
      attributes: true, attributeFilter: ["class", "data-ok"],
    });
  }

  const _init = api.init;
  api.init = function () {
    _init.apply(api, arguments);
    watchAnswers();
  };

  return api;
})();