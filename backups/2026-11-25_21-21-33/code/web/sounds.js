/* ============================================================
   Deutsch Quest — экран «Немецкие звуки»
   Шпаргалка IPA + проверка произношения любого слова.
   ============================================================ */
"use strict";

window.DQSounds = (function () {
  const $ = (s, r = document) => r.querySelector(s);

  /* Звуки, которые чаще всего «не даются» русскоязычным ученикам. */
  const SOUNDS = [
    {
      ipa: "ç", name: "ich-Laut", ru: "мягкое «хь»",
      text: "Язык к нёбу, как при «хи», но без взрыва: воздух шуршит. После «я/е/и/ё/ю» и после согласных.",
      ex: ["ich", "nicht", "Mädchen", "Bücher", "möchte"]
    },
    {
      ipa: "x", name: "ach-Laut", ru: "грубое «х»",
      text: "Как в русском «х», но глубже, из горла. После «а/о/у/ау».",
      ex: ["Buch", "Nacht", "hoch", "auch", "Sprache"]
    },
    {
      ipa: "ʃ", name: "sch", ru: "«ш»",
      text: "Язык отодвинут назад и сложен «ложкой», губы вперёд.",
      ex: ["Schule", "schön", "Fisch"]
    },
    {
      ipa: "ʃt / ʃp", name: "st / sp в начале", ru: "«шт / шп»",
      text: "В начале слова или корня: Straße = ШТРасе, Sport = ШПОРТ.",
      ex: ["Straße", "Stadt", "Stern", "Sport"]
    },
    {
      ipa: "ts", name: "z / tz", ru: "слитное «ц»",
      text: "Zug, Zeit: «ц» одним звуком — не «з». Немецкое z никогда не «з».",
      ex: ["Zug", "Zeit", "Herz", "Katze"]
    },
    {
      ipa: "v", name: "w", ru: "«в»",
      text: "Буква w = «в» (Wasser), а v = «ф» (Vater).",
      ex: ["Wasser", "Wort", "Vater", "Vier"]
    },
    {
      ipa: "z", name: "s в начале", ru: "«з»",
      text: "s перед гласной в начале слова и между гласными — «з».",
      ex: ["Sonne", "sagen", "lesen"]
    },
    {
      ipa: "œ", name: "ö", ru: "«ё» с губами «о»",
      text: "Говорите «э», губы при этом тяните к «о». Без «й» в начале.",
      ex: ["schön", "Können", "möchte"]
    },
    {
      ipa: "y", name: "ü (долгое)", ru: "«и» с губами «у»",
      text: "Говорите «и», губы — трубочка как при «у».",
      ex: ["Tür", "Bücher", "müde", "über"]
    },
    {
      ipa: "ʏ", name: "ü (короткое)", ru: "«ю» с губами «у»",
      text: "Короткое и напряжённое, как «ю» без «й».",
      ex: ["Glück", "fünf", "Stück"]
    },
    {
      ipa: "ɛ", name: "ä", ru: "открытое «э»",
      text: "Рот шире, чем в русском «э»: Bär, Hände.",
      ex: ["Bär", "Hände", "Mädchen", "Säfte"]
    },
    {
      ipa: "ʁ", name: "r", ru: "мягкое «р» из горла",
      text: "Похоже на картавое французское r; на конце слова — «а» (Vater = ФАта).",
      ex: ["rot", "Straße", "Vater", "Wasser"]
    },
    {
      ipa: "ɐ", name: "-er", ru: "безударное «а»",
      text: "Окончание -er звучит как «а»: Lehrer = ЛЭРа, Bruder = БРУда.",
      ex: ["Lehrer", "Bruder", "Wasser"]
    },
    {
      ipa: "ə", name: "-e (безударное)", ru: "«э» без напряжения",
      text: "В окончаниях -e, be-, ge- — краткое нейтральное «э».",
      ex: ["bitte", "habe", "gesagt"]
    },
    {
      ipa: "ɔʏ", name: "eu / äu", ru: "«ой»",
      text: "Heute, Häuser — но пишется не так, как слышится.",
      ex: ["Heute", "Häuser", "neun"]
    },
    {
      ipa: "ŋ", name: "ng / nk", ru: "носовое «н»",
      text: "Как в английском sing: язык делает «нг» одним носовым звуком.",
      ex: ["lang", "singen", "danke"]
    },
    {
      ipa: "h", name: "немое h", ru: "пауза на месте h",
      text: "В ah/eh/ih/oh/uh буква h не читается — она лишь тянет гласный.",
      ex: ["sehen", "gehen", "Uhr"]
    },
  ];

  function renderVoices() {
    const el = $("#voiceInfo");
    if (!el || !window.DQVoice) return;
    const info = window.DQVoice.info();
    el.textContent = info.chosen && info.chosen !== "нет немецкого голоса — используется сервер"
      ? info.chosen.split(" (")[0]
      : "запись голоса";
    el.title = info.voices.join("\n") || "Серверная озвучка (mp3)";
  }

  function renderGrid() {
    const box = $("#soundsGrid");
    if (!box) return;
    box.innerHTML = SOUNDS.map((s) => `
      <div class="sound-card fx-item">
        <div class="sound-row">
          <div>
            <div class="sc-ipa">/${s.ipa}/</div>
            <div class="muted small">${s.name} · ${s.ru}</div>
          </div>
          <button class="ph-btn" data-ex="${encodeURIComponent(s.ex[0])}" title="Слушать пример"><span class="ico ico-vol"></span></button>
        </div>
        <div class="sc-hint">${s.text}</div>
        <div class="sc-ex">${s.ex.map((w) =>
      `<b data-ex="${encodeURIComponent(w)}" style="cursor:pointer">${w}</b>`).join(" · ")}</div>
      </div>`).join("");
    box.querySelectorAll("[data-ex]").forEach((b) => {
      b.onclick = () => {
        const w = decodeURIComponent(b.dataset.ex);
        window.DQVoice.say(w, "de");
        window.DQSND && window.DQSND.tap();
      };
    });
  }

  async function lookup() {
    const input = $("#sndWord");
    const word = (input.value || "").trim();
    if (!word) { input.focus(); return; }
    const out = $("#sndResult");
    out.innerHTML = '<div class="muted small">…</div>';
    await window.DQPhon.prepare([word]);
    const d = window.DQPhon.get(word);
    if (!d) { out.innerHTML = '<div class="muted small">Не удалось разобрать слово.</div>'; return; }
    const notes = window.DQPhon.notesFor(word);
    out.innerHTML = `
      <div class="word-line" style="margin-top:14px">
        <span class="gm-big-word" style="margin:0">${word}</span>
      </div>
      ${window.DQPhon.card(word, { title: false })}
      ${notes.length ? `<div class="ph-card" style="margin-top:10px">
          <div class="ph-head">что здесь важно</div>
          ${notes.map(([sym, txt]) => `<div class="ph-note"><b>/${sym}/</b> — ${txt}</div>`).join("")}
        </div>` : ""}
      <div class="rd-say-bar">
        <button class="btn primary" id="sndPlay"><span class="ico ico-vol"></span> Слушать</button>
        <button class="btn ghost" id="sndSlow"><span class="ico ico-slow"></span> Медленно</button>
      </div>`;
    window.DQPhon.bind(out);
    $("#sndPlay").onclick = () => window.DQVoice.say(word, "de");
    $("#sndSlow").onclick = () => window.DQVoice.slow(word, "de");
    window.DQVoice.say(word, "de");
  }

  function init() {
    if (init.done) { renderVoices(); return; }
    init.done = true;
    renderVoices();
    renderGrid();
    const btn = $("#sndSay");
    if (btn) btn.onclick = lookup;
    const input = $("#sndWord");
    if (input) input.onkeydown = (e) => { if (e.key === "Enter") lookup(); };
  }

  return { init, SOUNDS };
})();
