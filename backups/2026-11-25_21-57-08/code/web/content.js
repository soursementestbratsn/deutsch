/* ============================================================
   Deutsch Quest — РАЗДЕЛ «Материалы» (window.DQContent)

   Идеи блока H, сделанные как вкладки одного экрана:
     83. Песни и стихи            — 8 коротких стишков/песен с переводом
     84. Новости в картинках      — 5 коротких «новостей» дня + вопрос
     85. Рецепты                   — 4 рецепта: императив, меры, порядок
     86. Письма-образцы           — e-mail хозяину/жалоба/собеседование
     87. Цифры и даты в контексте — время работы, цены, годы
     89. Найди неправильный перевод — мини-игра
     90. Мини-выражения           — частицы, которые делают речь живой
   ============================================================ */
"use strict";

window.DQContent = (function () {
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
  const say = (t, slow) => {
    if (window.DQVoice && window.DQVoice.say) return window.DQVoice.say(t, "de", { slow: !!slow, forceBrowser: true });
    if (window.DQ && window.DQ.say) return window.DQ.say(t, "de");
  };

  /* ---------- 83. стихи и песни ---------- */
  const SONGS = [
    {
      title: "Der Mond ist aufgegangen", author: "Matthias Claudius",
      lines: [["Der Mond ist aufgegangen,", "Луна уже взошла,"],
      ["die goldnen Sternlein prangen", "звёздочки золотые сверкают"],
      ["am Himmel hell und klar.", "на небе светло и ясно."],
      ["Der Wald steht schwarz und schweiget.", "Лес стоит тёмный и молчаливый."]],
    },
    {
      title: "O Tannenbaum", author: "Volkslied",
      lines: [["O Tannenbaum, o Tannenbaum,", "О ёлочка, о ёлочка,"],
      ["wie grün sind deine Blätter!", "как зелены твои иголки!"],
      ["Du grünst nicht nur zur Sommerzeit,", "Ты зеленеешь не только летом,"],
      ["nein, auch im Winter, wenn es schneit.", "нет, и зимой, когда идёт снег."]],
    },
    {
      title: "Alle meine Entchen", author: "Kinderlied",
      lines: [["Alle meine Entchen", "Все мои утята"],
      ["schwimmen auf dem See,", "плавают по озеру,"],
      ["schwimmen auf dem See,", "плавают по озеру,"],
      ["Köpfchen in das Wasser, Schwänzchen in die Höh'.", "головку в воду, хвостик кверху."]],
    },
    {
      title: "Guten Abend, gut' Nacht", author: "Brahms",
      lines: [["Guten Abend, gut' Nacht,", "Добрый вечер, доброй ночи,"],
      ["mit Rosen bedacht,", "усыпанный розами,"],
      ["mit Näglein besteckt,", "с гвоздичками,"],
      ["schlupf unter die Deck'.", "полезай под одеяло."]],
    },
  ];

  /* ---------- 84. новости в картинках ---------- */
  const NEWS = [
    ["Die Bahn streikt heute.", "Bahn — это…", ["поезд/железная дорога", "банк", "велосипед"], 0],
    ["Es regnet den ganzen Tag.", "regnen — это…", ["идет дождь", "светит солнце", "идет снег"], 0],
    ["Die Universität öffnet ein neues Café.", "die Universität — это…", ["университет", "библиотека", "стадион"], 0],
    ["Der Bus fährt bis 22 Uhr.", "bis — это…", ["до", "после", "через"], 0],
    ["Im Wohnheim gibt es freies WLAN.", "das Wohnheim — это…", ["общежитие", "больница", "школа"], 0],
    ["Morgen ist ein Feiertag.", "der Feiertag — это…", ["праздник", "понедельник", "рабочий день"], 0],
  ];

  /* ---------- 85. рецепты ---------- */
  const RECIPES = [
    {
      title: "Rührei (омлет-глазунья)", time: "5 мин",
      steps: [["Schlagen Sie zwei Eier in eine Schüssel.", "Разбейте два яйца в миску."],
      ["Geben Sie einen Esslöffel Milch dazu.", "Добавьте одну столовую ложку молока."],
      ["Erhitzen Sie die Pfanne mit etwas Butter.", "Разогрейте сковороду с маслом."],
      ["Gießen Sie die Masse in die Pfanne.", "Вылейте массу на сковороду."],
      ["Rühren Sie drei Minuten.", "Мешайте три минуты. (Императив!)"]],
    },
    {
      title: "Tee (чай)", time: "7 мин",
      steps: [["Bringen Sie Wasser zum Kochen.", "Доведите воду до кипения."],
      ["Geben Sie einen Beutel Schwarztee in die Tasse.", "Положите пакетик чёрного чая в чашку."],
      ["Gießen Sie das heiße Wasser auf.", "Залейте горячей водой."],
      ["Warten Sie drei Minuten.", "Подождите три минуты."],
      ["Nehmen Sie den Beutel heraus.", "Достаньте пакетик."]],
    },
    {
      title: "Brot mit Butter", time: "2 мин",
      steps: [["Nehmen Sie zwei Scheiben Brot.", "Возьмите два ломтика хлеба."],
      ["Streichen Sie Butter darauf.", "Намажьте масло. (auf + Akkusativ)"],
      ["Legen Sie Käse dazu.", "Положите рядом сыр."]],
    },
    {
      title: "Kartoffelsuppe (суп)", time: "25 мин",
      steps: [["Schälen Sie vier Kartoffeln.", "Почистите четыре картофелины."],
      ["Kochen Sie die Kartoffeln 15 Minuten.", "Варите картофель 15 минут."],
      ["Schneiden Sie eine Zwiebel.", "Нарежьте луковицу."],
      ["Geben Sie Salz und Pfeffer dazu.", "Добавьте соль и перец."],
      ["Alles gut untermischen.", "Хорошо перемешать. (инфинитив)"]],
    },
  ];

  /* ---------- 86. письма ---------- */
  const LETTERS = [
    {
      title: "E-Mail an den Hausmeister (не работает кран)",
      to: "hausmeister@wohnheim.de",
      subject: "Wasserhahn in Zimmer 12 kaputt",
      body: [
        ["Guten Tag,", "Добрый день,"],
        ["ich möchte Ihnen mitteilen, dass der Wasserhahn in meinem Zimmer nicht funktioniert.", "хочу сообщить вам, что кран в моей комнате не работает."],
        ["Ich wohne im Appartement 12, Geb. B.", "Я живу в апартаменте 12, корпус B."],
        ["Könnten Sie bitte vorbeikommen?", "Не могли бы вы зайти?"],
        ["Vielen Dank im Voraus!", "Большое спасибо заранее!"],
        ["Mit freundlichen Grüßen", "С уважением"],
      ],
    },
    {
      title: "E-Mail an einen Lehrer (отсутствие)",
      to: "weber@uni.de",
      subject: "Abwesenheit am Montag",
      body: [
        ["Sehr geehrte Frau Weber,", "Уважаемая фрау Вебер,"],
        ["leider kann ich am Montag nicht zum Seminar kommen,", "к сожалению, не смогу прийти на семинар в понедельник,"],
        ["weil ich einen Arzttermin habe.", "потому что у меня приём у врача."],
        ["Ich informiere mich über die Hausaufgaben bei meinen Kommilitonen.", "Домашнее задание узнаю у однокурсников."],
        ["Mit freundlichen Grüßen, Igor", "С уважением, Игорь"],
      ],
    },
    {
      title: "Жалоба в жильё (Heizung kaputt)",
      to: "verwaltung@haus.de",
      subject: "Heizung funktioniert nicht",
      body: [
        ["Sehr geehrte Damen und Herren,", "Уважаемые дамы и господа,"],
        ["die Heizung in der Wohnung 4 funktioniert seit zwei Tagen nicht.", "отопление в квартире 4 не работает уже два дня."],
        ["Die Raume sind zu kalt (15 Grad).", "В комнатах слишком холодно (15 градусов)."],
        ["Bitte reparieren Sie das so schnell wie möglich.", "Пожалуйста, почините это как можно скорее."],
        ["Sonst muss ich einen Teil der Miete zurückfordern.", "Иначе мне придётся потребовать часть аренды обратно."],
      ],
    },
  ];

  /* ---------- 87. даты и цифры в контексте ---------- */
  const DATES = [
    ["Öffnungszeiten: Mo–Fr 9:00–18:00", "Когда открыто в субботу?",
      ["Закрыто", "Открыто 9:00–13:00", "Открыто до 18:00"], 0, "Суббота не входит в часы работы — значит закрыто."],
    ["Uhrzeit: 17:42", "Как сказать это по-немецки в быту?",
      ["achtzehn vor fünf", "zwölf nach vier", "fünf vor sechs"], 0, "Официально: siebzehn Uhr zweiundvierzig. Разговорно: achtzehn vor fünf."],
    ["Das Buch kostet 12,95 €.", "Сколько сдачи с двадцати евро?",
      ["7,05 €", "8,05 €", "7,50 €"], 0, "20 − 12,95 = 7,05 €"],
    ["Geburtsjahr: 1998", "Как читают год?",
      ["eintausendneunhundertachtundneunzig", "neunzehnhundertachtundneunzig", "achtzehnhundertneunzig"], 1, "Годы до 2000 читаются «сотнями»: neunzehn-hundert-achtundneunzig."],
    ["Der Termin ist am 3. März.", "Какой месяц?",
      ["март", "май", "октябрь"], 0, "der März — март; am 3. = «третьего»."],
    ["Der Zug fährt um 7:45 Uhr ab.", "Во сколько это по-немецки?",
      ["Viertel vor acht", "Viertel nach sieben", "Viertel nach acht"], 0, "7:45 = Viertel vor acht (без четверти восемь)."],
  ];
  const DATES2 = [
    ["die Bank", "банк / скамейка", ["банк", "скамья", "море"]],
    ["der See", "озеро", ["озеро", "море", "река"]],
    ["der Termin", "запись / встреча", ["встреча", "время", "запись"]] ,
    ["die Maus", "мышь", ["мышь", "дом", "кошка"]],
    ["der Zug", "поезд", ["поезд", "самолёт", "корабль"]],
    ["der Kuchen", "пирог", ["пирог", "кухня", "стол"]],
    ["der Freund", "друг", ["друг", "враг", "сосед"]],
    ["die Tür", "дверь", ["дверь", "окно", "стена"]],
    ["der Schlüssel", "ключ", ["ключ", "замок", "дверь"]],
    ["der Schrank", "шкаф", ["шкаф", "полка", "кресло"]],
  ];

  /* ---------- 90. частицы ---------- */
  const PARTICLES = [
    ["Doch!", "Как же да! (возражение)", "Du bist nicht groß. — Doch!"],
    ["Na klar!", "Ну конечно!", "Kommt er? — Na klar!"],
    ["Quatsch!", "Ерунда / чушь", "Das ist Quatsch."],
    ["Ach so.", "А, вот оно что.", "Ach so, jetzt verstehe ich."],
    ["Na gut.", "Ну ладно.", "Na gut, dann morgen."],
    ["Los geht's!", "Поехали / начали!", "Los, los, los!"],
    ["Genau!", "Точно!", "Das stimmt genau."],
    ["Egal.", "Всё равно.", "Warum fragst du? — Egal."],
    ["Halt!", "Стой!", "Halt, warte!"],
    ["Wohl.", "Пожалуй / наверное", "Er kommt wohl später."],
    ["Mal.", "Разик / как-то", "Komm mal her."],
    ["Ja, ja.", "Да-да (скептически)", "Ja, ja, ich glaube dir."],
  ];

  /* ============ вёрстка вкладок ============ */
  function tabSongs(host) {
    host.innerHTML = SONGS.map((s) => `
      <div class="ct-song">
        <div class="idea-head"><h3>${esc(s.title)}</h3><span class="muted small">${esc(s.author)}</span></div>
        <div class="ct-lines">${s.lines.map(([de, ru]) => `
          <div class="ct-line"><button class="ct-say" data-t="${esc(de)}"><span class="ico ico-vol"></span></button>
            <span>${esc(de)}</span><em>${esc(ru)}</em></div>`).join("")}</div>
      </div>`).join("");
    $$(".ct-say", host).forEach((b) => { b.onclick = () => say(b.dataset.t, true); });
  }

  function tabNews(host) {
    const items = shuffle(NEWS).slice(0, 5);
    host.innerHTML = `
      <div class="ct-news">${items.map(([text, q, opts, ans]) => `
        <div class="ct-news-item">
          <div class="ct-news-text">${esc(text)}</div>
          <div class="muted small">${esc(q)}</div>
          <div class="ct-opts">${shuffle(opts).map((o) => `<button class="ct-opt" data-ok="${o === opts[ans] ? 1 : 0}">${esc(o)}</button>`).join("")}</div>
        </div>`).join("")}</div>`;
    $$(".ct-opt", host).forEach((b) => {
      b.onclick = () => {
        const box = b.closest(".ct-news-item");
        if (box.dataset.done) return;
        box.dataset.done = "1";
        $$(".ct-opt", box).forEach((x) => { x.disabled = true; x.classList.toggle("right", x.dataset.ok === "1"); });
        if (b.dataset.ok !== "1") b.classList.add("wrong");
        if (window.DQSND) b.dataset.ok === "1" ? window.DQSND.correct() : window.DQSND.wrong();
      };
    });
  }

  function tabRecipes(host) {
    host.innerHTML = RECIPES.map((r) => `
      <div class="ct-recipe">
        <div class="idea-head"><h3>${esc(r.title)}</h3><span class="muted small">${esc(r.time)}</span></div>
        <ol>${r.steps.map(([de, ru]) => `<li><b>${esc(de)}</b><br><span class="muted">${esc(ru)}</span></li>`).join("")}</ol>
      </div>`).join("");
  }

  function tabLetters(host) {
    host.innerHTML = LETTERS.map((l) => `
      <div class="ct-letter">
        <div class="idea-head"><h3>${esc(l.title)}</h3><span class="muted small">an: ${esc(l.to)}</span></div>
        <div class="ct-letter-meta"><b>Betreff:</b> ${esc(l.subject)}</div>
        <div class="ct-lines">${l.body.map(([de, ru]) => `
          <div class="ct-line"><button class="ct-say" data-t="${esc(de)}"><span class="ico ico-vol"></span></button>
            <span>${esc(de)}</span><em>${esc(ru)}</em></div>`).join("")}</div>
        <button class="link-btn ct-copy" data-copy="${esc(l.body.map((x) => x[0]).join("\n"))}">скопировать текст письма</button>
      </div>`).join("");
    $$(".ct-say", host).forEach((b) => { b.onclick = () => say(b.dataset.t, true); });
    $$(".ct-copy", host).forEach((b) => {
      b.onclick = async () => {
        try { await navigator.clipboard.writeText(b.dataset.copy); window.DQ && window.DQ.toast && window.DQ.toast("Скопировано", "ok"); }
        catch (e) { window.DQ && window.DQ.toast && window.DQ.toast("Браузер не дал доступ к буферу", "bad"); }
      };
    });
  }

  function tabDates(host) {
    host.innerHTML = `
      <div class="ct-dates">${DATES.slice(0, 6).map(([text, q, opts, ans, why]) => `
        <div class="ct-news-item">
          <div class="ct-news-text">${esc(text)}</div>
          <div class="muted small">${esc(q)}</div>
          <div class="ct-opts">${shuffle(opts).map((o) => `<button class="ct-opt2" data-ok="${o === opts[ans] ? 1 : 0}" data-why="${esc(why || "")}">${esc(o)}</button>`).join("")}</div>
          <div class="ct-why muted small"></div>
        </div>`).join("")}</div>`;
    $$(".ct-opt2", host).forEach((b) => {
      b.onclick = () => {
        const box = b.closest(".ct-news-item");
        if (box.dataset.done) return;
        box.dataset.done = "1";
        $$(".ct-opt2", box).forEach((x) => { x.disabled = true; x.classList.toggle("right", x.dataset.ok === "1"); });
        if (b.dataset.ok !== "1") b.classList.add("wrong");
        $(".ct-why", box).textContent = b.dataset.why || "";
      };
    });
  }

  function tabWrong(host) {
    host.innerHTML = `<div class="ct-wrong" id="ctWrong"></div>`;
    const box = $("#ctWrong");
    let score = 0, round = 0;
    const draw = () => {
      if (round >= 8) {
        box.innerHTML = `<div class="sp-dialog-done"><h2>Итог: ${score} / 8</h2>
          <button class="btn primary" id="ctAgain">Ещё раз</button></div>`;
        $("#ctAgain").onclick = () => { score = 0; round = 0; draw(); };
        return;
      }
      const [de, right, variants] = WORD_PAIRS[rnd(WORD_PAIRS.length)];
      // верный вариант берём целиком (может быть «банк / скамейка»), а в «ловушки» — только части
      const wrongs = shuffle(variants.filter((v) => !right.includes(v))).slice(0, 2);
      const opts = shuffle([right, ...wrongs]);
      box.innerHTML = `<div class="ct-news-item">
        <div class="ct-news-text">${esc(de)}</div>
        <div class="muted small">Выберите ПРАВИЛЬНЫЙ перевод</div>
        <div class="ct-opts">${opts.map((o) => `<button class="ct-opt" data-ok="${o === right ? 1 : 0}">${esc(o)}</button>`).join("")}</div>
      </div>`;
      $$(".ct-opt", box).forEach((b) => {
        b.onclick = () => {
          if (box.dataset.done) return;
          box.dataset.done = "1";
          const ok = b.dataset.ok === "1";
          if (ok) score++;
          round++;
          $$(".ct-opt", box).forEach((x) => { x.disabled = true; if (x.dataset.ok === "1") x.classList.add("right"); });
          if (!ok) b.classList.add("wrong");
          setTimeout(() => { box.dataset.done = ""; draw(); }, 700);
        };
      });
    };
    draw();
  }

  function tabParticles(host) {
    host.innerHTML = `<div class="ct-particles">${PARTICLES.map(([de, ru, ex]) => `
      <div class="ct-particle" data-de="${esc(de)}">
        <b>${esc(de)}</b><span class="muted">${esc(ru)}</span>
        <em>${esc(ex)}</em>
        <button class="ct-say" data-t="${esc(ex)}"><span class="ico ico-vol"></span></button>
      </div>`).join("")}</div>`;
    $$(".ct-say", host).forEach((b) => { b.onclick = () => say(b.dataset.t, true); });
  }

  const TABS = [
    { id: "songs", title: "Песни и стихи", icon: "ico-play", draw: tabSongs },
    { id: "news", title: "Новости", icon: "ico-bulb", draw: tabNews },
    { id: "recipes", title: "Рецепты", icon: "ico-book", draw: tabRecipes },
    { id: "letters", title: "Письма", icon: "ico-pen", draw: tabLetters },
    { id: "dates", title: "Даты и цифры", icon: "ico-repeat", draw: tabDates },
    { id: "wrong", title: "Найди ошибку", icon: "ico-star", draw: tabWrong },
    { id: "particles", title: "Частицы", icon: "ico-vol", draw: tabParticles },
  ];
  let active = "songs";

  function render() {
    const host = $("#ctBody");
    if (!host) return;
    host.innerHTML = `
      <div class="tr-tabs sp-tabs">${TABS.map((t) =>
      `<button class="${t.id === active ? "active" : ""}" data-id="${t.id}"><span class="ico ${t.icon}"></span>${esc(t.title)}</button>`).join("")}</div>
      <div class="ct-stage" id="ctStage"></div>`;
    $$(".sp-tabs button", host).forEach((b) => {
      b.onclick = () => { active = b.dataset.id; render(); };
    });
    (TABS.find((t) => t.id === active) || TABS[0]).draw($("#ctStage"));
  }

  return { init: render, render };
})();
