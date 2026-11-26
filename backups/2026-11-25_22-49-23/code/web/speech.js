/* ============================================================
   Deutsch Quest — РАЗДЕЛ «Речь» (window.DQSpeech)

   Идеи блока D, которые можно сделать без сервера и внешних API:
     49. Deutsch-разговорник — 5 бытовых ситуаций с фразами
     50. Диалог-симуляция — приложение «спрашивает», вы отвечаете
     51. Азбука на слух — узнавайте ß, ä, ö, ü, ch, sch на слух
     53. «Слышу — пишу» — диктант слов на слух
     46. Учитель-попугай — проиграть слово X раз с паузами
     45. Сказка на ночь — медленное чтение по предложениям

   Озвучка — браузерная (SpeechSynthesis), работает без сети.
   ============================================================ */
"use strict";

window.DQSpeech = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  };
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  /** Озвучка: голос из настроек (Deborah/Axel) или браузерный синтез. */
  function say(text, opts = {}) {
    if (!text) return;
    if (window.DQVoice && window.DQVoice.say) {
      return window.DQVoice.say(text, "de", { slow: !!opts.slow, forceBrowser: true });
    }
    if (window.DQ && window.DQ.say) {
      return (opts.slow && window.DQ.saySlow || window.DQ.say)(text, "de");
    }
  }
  const stop = () => { try { speechSynthesis.cancel(); } catch (e) { } };

  /* ---------- 49. разговорник ---------- */
  const SITUATIONS = [
    {
      title: "В кафе", icon: "ico-vol",
      phrases: [
        ["Ich hätte gern einen Kaffee, bitte.", "Я бы хотел кофе, пожалуйста."],
        ["Was empfehlen Sie?", "Что вы посоветуете?"],
        ["Die Rechnung, bitte.", "Счёт, пожалуйста."],
        ["Kann ich mit Karte zahlen?", "Можно оплатить картой?"],
        ["Ohne Zucker, bitte.", "Без сахара, пожалуйста."],
      ],
    },
    {
      title: "На вокзале", icon: "ico-repeat",
      phrases: [
        ["Wann fährt der nächste Zug nach Berlin?", "Когда следующий поезд в Берлин?"],
        ["Eine Fahrkarte nach Hamburg, bitte.", "Один билет до Гамбурга, пожалуйста."],
        ["Auf welchem Gleis fährt der Zug?", "С какой платформы отправляется поезд?"],
        ["Hat der Zug Verspätung?", "Поезд опаздывает?"],
        ["Ist dieser Platz frei?", "Это место свободно?"],
      ],
    },
    {
      title: "У врача", icon: "ico-star",
      phrases: [
        ["Ich habe Kopfschmerzen.", "У меня болит голова."],
        ["Ich brauche einen Termin.", "Мне нужна запись на приём."],
        ["Mein Bauch tut weh.", "У меня болит живот."],
        ["Ich bin allergisch gegen Nüsse.", "У меня аллергия на орехи."],
        ["Wo ist die nächste Apotheke?", "Где ближайшая аптека?"],
      ],
    },
    {
      title: "В банке и на почте", icon: "ico-book",
      phrases: [
        ["Ich möchte ein Konto eröffnen.", "Я хочу открыть счёт."],
        ["Wie hoch ist die Gebühr?", "Какая комиссия?"],
        ["Ich möchte ein Paket verschicken.", "Я хочу отправить посылку."],
        ["Kann ich hier Geld abheben?", "Можно здесь снять деньги?"],
        ["Wo fülle ich das Formular aus?", "Где заполнить форму?"],
      ],
    },
    {
      title: "Покупая хлеб", icon: "ico-bulb",
      phrases: [
        ["Ein Brot, bitte.", "Один хлеб, пожалуйста."],
        ["Haben Sie frische Brötchen?", "У вас есть свежие булочки?"],
        ["Wie viel kostet das?", "Сколько это стоит?"],
        ["Ich nehme auch ein Stück Kuchen.", "Я возьму ещё кусок пирога."],
        ["Das ist alles, danke.", "Это всё, спасибо."],
      ],
    },
  ];

  function renderPhrasebook(host) {
    host.innerHTML = `
      <div class="sp-situations">${SITUATIONS.map((s, i) =>
        `<button class="sp-sit ${i === 0 ? "on" : ""}" data-i="${i}"><span class="ico ${s.icon}"></span>${esc(s.title)}</button>`).join("")}</div>
      <div class="sp-phrases" id="spPhrases"></div>`;
    const draw = (i) => {
      $$(".sp-sit", host).forEach((b, k) => b.classList.toggle("on", k === i));
      $("#spPhrases").innerHTML = SITUATIONS[i].phrases.map(([de, ru], k) =>
        `<div class="sp-phrase${k === 0 ? " open" : ""}" data-de="${esc(de)}">
          <button class="sp-say"><span class="ico ico-vol"></span></button>
          <div><b>${esc(de)}</b><span class="muted">${esc(ru)}</span></div>
        </div>`).join("");
      $$(".sp-phrase", host).forEach((row) => {
        row.onclick = () => { row.classList.toggle("open"); stop(); };
        $(".sp-say", row).onclick = (e) => { e.stopPropagation(); say(row.dataset.de, { slow: true }); };
      });
    };
    $$(".sp-sit", host).forEach((b) => { b.onclick = () => draw(+b.dataset.i); });
    draw(0);
  }

  /* ---------- 50. диалог-симуляция ---------- */
  const DIALOGS = [
    {
      title: "Приём у врача",
      lines: [
        ["Praxis Dr. Weber. Guten Tag, wie kann ich Ihnen helfen?", "Кабинет доктора Вебера. Здравствуйте, чем могу помочь?",
          ["Ich brauche einen Termin.", "Мне нужна запись на приём.", "Я ошибся этажом"]],
        ["Waren Sie schon einmal bei uns?", "Вы уже были у нас?",
          ["Nein, ich bin zum ersten Mal hier.", "Нет, я здесь впервые.", "Да, вчера"]],
        ["Welche Beschwerden haben Sie?", "На что жалуетесь?",
          ["Ich habe seit gestern Halsschmerzen.", "У меня со вчерашнего дня болит горло.", "Мне очень приятно"]],
        ["Verstanden. Können Sie am Donnerstag um zehn Uhr?", "Понятно. Вам удобно в четверг в десять?",
          ["Ja, das passt. Danke!", "Да, удобно. Спасибо!", "Я не понимаю"]],
      ],
    },
    {
      title: "В кафе",
      lines: [
        ["Guten Tag! Was darf ich Ihnen bringen?", "Добрый день! Что принести?",
          ["Einen Kaffee und ein Croissant, bitte.", "Кофе и круассан, пожалуйста.", "Всё равно"]],
        ["Mit Milch oder schwarz?", "С молоком или чёрный?",
          ["Mit Milch, bitte.", "С молоком, пожалуйста.", "Двойной"]],
        ["Möchten Sie noch etwas?", "Хотите что-нибудь ещё?",
          ["Nein, danke. Die Rechnung, bitte.", "Нет, спасибо. Счёт, пожалуйста.", "Да, ещё три"]],
        ["Das macht fünf Euro achtzig. Bar oder Karte?", "Это 5,80 евро. Наличными или картой?",
          ["Mit Karte, bitte.", "Картой, пожалуйста.", "Оставьте сдачу"]],
      ],
    },
    {
      title: "Сосед в общежитии",
      lines: [
        ["Hallo! Bist du neu hier im Wohnheim?", "Привет! Ты новенький в общежитии?",
          ["Ja, ich bin vor einer Woche eingezogen.", "Да, я переехал неделю назад.", "Я ничего не понимаю"]],
        ["Woher kommst du?", "Откуда ты?",
          ["Ich komme aus Russland.", "Я из России.", "Из космоса"]],
        ["Willst du heute Abend Tee trinken?", "Хочешь сегодня вечером чаю?",
          ["Gern! Ich komme um sieben.", "С удовольствием! Я приду в семь.", "Только кофе"]],
      ],
    },
  ];

  function renderDialog(host) {
    let di = 0, li = 0, score = 0;
    const draw = () => {
      const d = DIALOGS[di];
      if (li >= d.lines.length) {
        host.innerHTML = `
          <div class="sp-dialog-done">
            <h2>Диалог пройден</h2>
            <p class="muted">Верных реплик: ${score} из ${d.lines.length}</p>
            <button class="btn primary" id="spAgain">Ещё раз</button>
            <button class="btn ghost" id="spOther">Другой сценарий</button>
          </div>`;
        $("#spAgain").onclick = () => { li = 0; score = 0; draw(); };
        $("#spOther").onclick = () => { di = (di + 1) % DIALOGS.length; li = 0; score = 0; draw(); };
        return;
      }
      const [de, ru, opts] = d.lines[li];
      const order = shuffle(opts.slice());
      host.innerHTML = `
        <div class="sp-dl-top"><span class="muted small">${esc(d.title)} · реплика ${li + 1}/${d.lines.length}</span></div>
        <div class="sp-talk">
          <div class="sp-say-row"><button class="dt-play" id="spHear"><span class="ico ico-vol"></span></button>
            <div><b>${esc(de)}</b><span class="muted">${esc(ru)}</span></div></div>
        </div>
        <div class="sp-choices">${order.map((o) => `<button class="sp-choice" data-ok="${o === opts[0] ? 1 : 0}">${esc(o)}</button>`).join("")}</div>`;
      $("#spHear").onclick = () => say(de, { slow: true });
      say(de, { slow: true });
      $$(".sp-choice").forEach((b) => {
        b.onclick = () => {
          $$(".sp-choice").forEach((x) => { x.disabled = true; x.classList.add(x.dataset.ok === "1" ? "right" : "dim"); });
          if (b.dataset.ok === "1") { score++; b.classList.add("right"); }
          else b.classList.add("wrong");
          if (window.DQSND) b.dataset.ok === "1" ? window.DQSND.correct() : window.DQSND.wrong();
          li++;
          setTimeout(draw, 900);
        };
      });
    };
    draw();
  }

  /* ---------- 51. азбука на слух ---------- */
  const SOUNDS = [
    ["ä", "как «э» в слове «эти»", ["Äpfel", "Mädchen", "spät"]],
    ["ö", "как «ё» без «й»", ["schön", "König", "Löffel"]],
    ["ü", "как «ю» без «й»", ["Übung", "Tür", "Müsli"]],
    ["ß", "долгая «с»", ["Straße", "groß", "heißen"]],
    ["ch", "как «х» мягко", ["Buch", "machen", "nicht"]],
    ["sch", "как «ш»", ["Schule", "Fisch", "Tisch"]],
    ["ei", "как «ай»", ["Ei", "Wein", "Bein"]],
    ["ie", "как «и» долгая", ["Liebe", "Familie", "spielen"]],
  ];
  function renderAlphabet(host) {
    const [sound, hint, words] = SOUNDS[rnd(SOUNDS.length)];
    const w = words[rnd(words.length)];
    const order = shuffle(SOUNDS.filter((s) => s[0] !== sound)).slice(0, 2).map((s) => s[0]);
    host.innerHTML = `
      <div class="sp-alph-q">
        <div class="muted small">Прослушайте слово и выберите звук, который в нём главный</div>
        <button class="dt-play" id="spA"><span class="ico ico-vol"></span></button>
        <div class="sp-alph-hint muted" id="spAHint">(нажмите ▶, чтобы услышать)</div>
      </div>
      <div class="sp-choices" id="spAOpts">${shuffle([sound, ...order]).map((s) => `<button class="sp-choice" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>
      <div class="gv-feedback" id="spAFb"></div>`;
    $("#spA").onclick = () => say(w, { slow: true });
    say(w, { slow: true });
    $$("#spAOpts .sp-choice").forEach((b) => {
      b.onclick = () => {
        $$("#spAOpts .sp-choice").forEach((x) => { x.disabled = true; if (x.dataset.s === sound) x.classList.add("right"); });
        const ok = b.dataset.s === sound;
        if (!ok) b.classList.add("wrong");
        $("#spAFb").className = "gv-feedback " + (ok ? "ok" : "bad");
        $("#spAFb").innerHTML = `${ok ? "Верно" : "Это"}: <b>${esc(sound)}</b> — ${esc(hint)}<br>${esc(w)} · звук «${esc(sound)}»`;
        if (window.DQSND) ok ? window.DQSND.correct() : window.DQSND.wrong();
        setTimeout(() => renderAlphabet(host), 1600);
      };
    });
  }

  /* ---------- 53. «слышу — пишу» ---------- */
  const HARD = [
    ["Straße", "улица"], ["schön", "красиво"], ["Übung", "упражнение"],
    ["Mädchen", "девочка"], ["Buch", "книга"], ["Fisch", "рыба"],
    ["Löffel", "ложка"], ["heißen", "называться"], ["Schule", "школа"],
    ["König", "король"], ["groß", "большой"], ["nicht", "не"],
    ["Zwölf", "двенадцать"], ["spät", "поздно"], ["schreiben", "писать"],
  ];
  function renderHearWrite(host) {
    const [w, ru] = HARD[rnd(HARD.length)];
    host.innerHTML = `
      <div class="sp-alph-q">
        <div class="muted small">Послушайте и напишите слово</div>
        <button class="dt-play" id="spH"><span class="ico ico-vol"></span></button>
        <input class="input sp-hw-input" id="spHInput" placeholder="слово…" autocomplete="off" spellcheck="false">
      </div>
      <div class="gv-feedback" id="spHFb"></div>`;
    $("#spH").onclick = () => say(w, { slow: true });
    say(w, { slow: true });
    const inp = $("#spHInput");
    inp.focus();
    inp.onkeydown = (e) => {
      if (e.key !== "Enter") return;
      const ok = inp.value.trim().toLowerCase() === w.toLowerCase();
      $("#spHFb").className = "gv-feedback " + (ok ? "ok" : "bad");
      $("#spHFb").innerHTML = ok ? "Верно! " + esc(w) : `Правильно: <b>${esc(w)}</b> (${esc(ru)})`;
      if (window.DQSND) ok ? window.DQSND.correct() : window.DQSND.wrong();
      inp.disabled = true;
      setTimeout(() => renderHearWrite(host), 1500);
    };
  }

  /* ---------- 46. учитель-попугай ---------- */
  function renderParrot(host) {
    host.innerHTML = `
      <div class="muted small">Выберите слово — приложение повторит его несколько раз.</div>
      <div class="sp-parrot">
        <input class="input" id="spWord" value="Schmetterling" autocomplete="off">
        <label class="muted small">повторов <input type="number" id="spRep" value="2" min="1" max="4" class="input sp-num"></label>
        <button class="btn primary" id="spPlay">Прочитать</button>
      </div>
      <div class="muted small">Сначала медленно, потом в обычном темпе. Для сложных слов имён прилагательных и длинных существительных.</div>`;
    $("#spPlay").onclick = () => {
      const w = $("#spWord").value.trim() || "Hallo";
      const n = Math.max(1, Math.min(4, Number($("#spRep").value) || 1));
      say(w, { slow: true });
      for (let i = 1; i < n; i++) setTimeout(() => say(w), 1400 * i);
    };
  }

  /* ---------- 45. сказка на ночь ---------- */
  const TALES = [
    ["Der Mond und die Sterne", ["Am Abend kommt der Mond.", "Die Sterne leuchten am Himmel.", "Ein Kind schläft im warmen Bett.", "Die Nacht ist still und ruhig."],
      ["Вечером приходит луна.", "Звёзды светят на небе.", "Ребёнок спит в тёплой постели.", "Ночь тихая и спокойная."]],
    ["Morgen im Dorf", ["Der Hahn singt früh am Morgen.", "Frau Müller macht einen Tee.", "Die Kinder gehen zur Schule.", "Auf der Straße riecht es nach Brot."],
      ["Петух поёт рано утром.", "Фрау Мюллер делает чай.", "Дети идут в школу.", "На улице пахнет хлебом."]],
    ["Im Zoo", ["Im Zoo wohnt ein grosser Elefant.", "Er trinkt viel Wasser.", "Der Affe springt von Ast zu Ast.", "Die Kinder lachen und klatschen."],
      ["В зоопарке живёт большой слон.", "Он пьёт много воды.", "Обезьяна прыгает с ветки на ветку.", "Дети смеются и хлопают."]],
  ];
  function renderTale(host) {
    const [title, de, ru] = TALES[rnd(TALES.length)];
    host.innerHTML = `
      <div class="sp-tale">
        <h2>${esc(title)}</h2>
        ${de.map((s, i) => `<p class="sp-tale-line" data-i="${i}"><span>${esc(s)}</span><em hidden>${esc(ru[i])}</em></p>`).join("")}
      </div>
      <div class="gv-actions"><button class="btn primary" id="spTalePlay">Читать медленно</button>
        <button class="btn ghost" id="spTaleStop">Стоп</button></div>`;
    let stopped = false;
    $("#spTaleStop").onclick = () => { stopped = true; stop(); $$(".sp-tale-line").forEach((l) => l.classList.remove("on")); };
    $("#spTalePlay").onclick = () => {
      stopped = false; stop();
      const lines = $$(".sp-tale-line");
      let k = 0;
      const playNext = () => {
        if (stopped) return;
        lines.forEach((l) => l.classList.remove("on"));
        if (k >= lines.length) { stopped = true; return; }
        const line = lines[k];
        line.classList.add("on");
        const txt = de[k];
        // показать перевод после прочтения
        setTimeout(() => { if (!stopped) line.querySelector("em").hidden = false; }, 500 + txt.length * 70);
        say(txt, { slow: true });
        k++;
        setTimeout(playNext, 1200 + txt.split(" ").length * 620);
      };
      playNext();
    };
  }

  /* ---------- экран ---------- */
  const TABS = [
    { id: "phrase", title: "Разговорник", icon: "ico-vol", draw: renderPhrasebook },
    { id: "dialog", title: "Диалог", icon: "ico-repeat", draw: renderDialog },
    { id: "alpha", title: "Звуки на слух", icon: "ico-play", draw: renderAlphabet },
    { id: "hear", title: "Слышу — пишу", icon: "ico-pen", draw: renderHearWrite },
    { id: "parrot", title: "Попугай", icon: "ico-bulb", draw: renderParrot },
    { id: "tale", title: "Сказка на ночь", icon: "ico-book", draw: renderTale },
  ];
  let active = "phrase";

  function render() {
    const host = $("#spBody");
    if (!host) return;
    host.innerHTML = `
      <div class="tr-tabs sp-tabs">${TABS.map((t) =>
        `<button class="${t.id === active ? "active" : ""}" data-id="${t.id}"><span class="ico ${t.icon}"></span>${esc(t.title)}</button>`).join("")}</div>
      <div class="sp-stage" id="spStage"></div>`;
    $$(".sp-tabs button").forEach((b) => {
      b.onclick = () => { active = b.dataset.id; render(); };
    });
    (TABS.find((t) => t.id === active) || TABS[0]).draw($("#spStage"));
  }

  return { init: render, render };
})();
