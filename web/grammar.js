/* ============================================================
   Deutsch Quest — GRAMMATIK-TRAINER (блок C: идеи 1–12)

   Не справочник, а генератор упражнений. Все задания строятся на лету
   из зашитых здесь мини-словарей, поэтому новых JSON-файлов не нужно.
   ============================================================ */
"use strict";

window.DQGrammatik = (function () {
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rnd(arr.length)];
  const shuffle = (a) => {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  };
  const uniqShuffle = (arr) => shuffle([...new Set(arr)]);

  /* ---------- словари ---------- */
  const NOUNS = [
    ["der", "Mann", "Männer", "мужчина"], ["der", "Tisch", "Tische", "стол"],
    ["der", "Hund", "Hunde", "собака"], ["der", "Stuhl", "Stühle", "стул"],
    ["der", "Apfel", "Äpfel", "яблоко"], ["der", "Lehrer", "Lehrer", "учитель"],
    ["der", "Tag", "Tage", "день"], ["der", "Freund", "Freunde", "друг"],
    ["die", "Frau", "Frauen", "женщина"], ["die", "Lampe", "Lampen", "лампа"],
    ["die", "Blume", "Blumen", "цветок"], ["die", "Tasche", "Taschen", "сумка"],
    ["die", "Straße", "Straßen", "улица"], ["die", "Zeitung", "Zeitungen", "газета"],
    ["die", "Küche", "Küchen", "кухня"], ["die", "Frage", "Fragen", "вопрос"],
    ["die", "Schule", "Schulen", "школа"], ["die", "Stadt", "Städte", "город"],
    ["das", "Kind", "Kinder", "ребёнок"], ["das", "Buch", "Bücher", "книга"],
    ["das", "Haus", "Häuser", "дом"], ["das", "Auto", "Autos", "машина"],
    ["das", "Mädchen", "Mädchen", "девочка"], ["das", "Fenster", "Fenster", "окно"],
    ["das", "Bild", "Bilder", "картинка"], ["das", "Jahr", "Jahre", "год"],
    ["das", "Zimmer", "Zimmer", "комната"], ["das", "Wort", "Wörter", "слово"],
  ];
  const VERBS = [
    ["machen", "mach", null], ["lernen", "lern", null], ["kaufen", "kauf", null],
    ["wohnen", "wohn", null], ["arbeiten", "arbeit", null], ["spielen", "spiel", null],
    ["reisen", "reis", null], ["öffnen", "öffn", null],
    ["fahren", "fahr", ["fährst", "fährt"]], ["lesen", "les", ["liest", "liest"]],
    ["essen", "ess", ["isst", "isst"]], ["sprechen", "sprech", ["sprichst", "spricht"]],
    ["schlafen", "schlaf", ["schläfst", "schläft"]], ["nehmen", "nehm", ["nimmst", "nimmt"]],
    ["geben", "geb", ["gibst", "gibt"]], ["sehen", "seh", ["siehst", "sieht"]],
  ];
  const PERSON = ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"];
  const ENDING = ["e", "st", "t", "en", "t", "en"];

  const MODALS = [
    ["können", ["kann", "kannst", "kann", "können", "könnt", "können"]],
    ["müssen", ["muss", "musst", "muss", "müssen", "müsst", "müssen"]],
    ["dürfen", ["darf", "darfst", "darf", "dürfen", "dürft", "dürfen"]],
    ["wollen", ["will", "willst", "will", "wollen", "wollt", "wollen"]],
    ["sollen", ["soll", "sollst", "soll", "sollen", "sollt", "sollen"]],
  ];

  /* настоящие примеры падежей: вставляем нужный артикль */
  const KASUS_SENT = [
    ["___ Mann liest ein Buch.", "der", "Nominativ", "Мужчина читает книгу."],
    ["Ich sehe ___ Mann.", "den", "Akkusativ", "Я вижу мужчину."],
    ["Ich helfe ___ Mann.", "dem", "Dativ", "Я помогаю мужчине."],
    ["Das Auto ___ Mannes ist neu.", "des", "Genitiv", "Машина мужчины новая."],
    ["___ Frau kocht Suppe.", "die", "Nominativ", "Женщина варит суп."],
    ["Ich kenne ___ Frau.", "die", "Akkusativ", "Я знаю женщину."],
    ["Ich danke ___ Frau.", "der", "Dativ", "Я благодарю женщину."],
    ["___ Kind spielt im Garten.", "das", "Nominativ", "Ребёнок играет в саду."],
    ["Ich lese ___ Buch.", "das", "Akkusativ", "Я читаю книгу."],
    ["Ich gebe ___ Kind ein Buch.", "dem", "Dativ", "Я даю ребёнку книгу."],
    ["___ Kinder spielen draußen.", "die", "Nominativ", "Дети играют на улице."],
    ["Ich sehe ___ Kinder.", "die", "Akkusativ", "Я вижу детей."],
    ["Ich helfe ___ Kindern.", "den", "Dativ", "Я помогаю детям."],
    ["Der Hund ___ Nachbarn bellt.", "des", "Genitiv", "Собака соседа лает."],
    ["___ Apfel ist rot.", "der", "Nominativ", "Яблоко красное."],
    ["Ich esse ___ Apfel.", "den", "Akkusativ", "Я ем яблоко."],
    ["Ich kaufe ___ Zeitung.", "die", "Akkusativ", "Я покупаю газету."],
    ["Sind das ___ Stühle?", "die", "Nominativ", "Это стулья?"],
  ];

  const PREPS = {
    Dativ: ["mit", "nach", "aus", "bei", "seit", "von", "zu"],
    Akkusativ: ["durch", "für", "ohne", "um", "gegen", "bis"],
  };

  const ZEITEN = [
    ["Ich lerne Deutsch.", "Präsens", "настоящее"],
    ["Ich habe ein Buch gelesen.", "Perfekt", "прошедшее разговорное"],
    ["Er war krank.", "Präteritum", "прошедшее письменное"],
    ["Nachdem er gegessen hatte, ging er.", "Plusquamperfekt", "предпрошедшее"],
    ["Ich werde morgen kommen.", "Futur I", "будущее"],
    ["Bis Freitag werde ich es gelesen haben.", "Futur II", "будущее совершенное"],
    ["Sie hat um drei Uhr angerufen.", "Perfekt", "прошедшее разговорное"],
    ["Wir machten die Hausaufgaben.", "Präteritum", "прошедшее письменное"],
  ];
  const ZEIT_NAMES = ["Präsens", "Perfekt", "Präteritum", "Plusquamperfekt", "Futur I", "Futur II"];

  const STEIGERUNG = [
    ["schnell", "schneller", "am schnellsten"],
    ["alt", "älter", "am ältesten"],
    ["jung", "jünger", "am jüngsten"],
    ["gut", "besser", "am besten"],
    ["viel", "mehr", "am meisten"],
    ["groß", "größer", "am größten"],
    ["klein", "kleiner", "am kleinsten"],
    ["lang", "länger", "am längsten"],
    ["hoch", "höher", "am höchsten"],
    ["gern", "lieber", "am liebsten"],
  ];

  /* ---------- генераторы ---------- */
  function taskKasus() {
    const [sent, art, kasus, ru] = pick(KASUS_SENT);
    const wrong = uniqShuffle(["der", "die", "das", "den", "dem", "des"].filter((x) => x !== art)).slice(0, 2);
    return {
      id: "kasus", skill: "Грамматика · падежи",
      prompt: "Выберите правильный артикль",
      sentence: sent, options: shuffle([art, ...wrong]), answer: art,
      explain: `${kasus}: ${sent.replace("___", art)} · «${ru}»`,
    };
  }

  function taskPlural() {
    const [art, word, plural, ru] = pick(NOUNS);
    return {
      id: "plural", skill: "Грамматика · множественное",
      prompt: `Множественное число: ${art} ${word} (${ru})`,
      input: true, answer: plural,
      explain: `die ${plural} — во множественном числе всегда «die»`,
    };
  }

  function taskPraesens() {
    const [inf, stem, strong] = pick(VERBS);
    const p = rnd(6);
    const form = strong && p === 1 ? strong[0] : strong && p === 2 ? strong[1] : stem + ENDING[p];
    return {
      id: "praesens", skill: "Грамматика · Präsens",
      prompt: "Поставьте глагол в правильную форму",
      sentence: `${PERSON[p]} ___ (${inf})`,
      input: true, answer: form,
      explain: `${PERSON[p]} ${form} — ${(strong && (p === 1 || p === 2)) ? "сильный глагол меняет гласную!" : `окончание -${ENDING[p]}`}`,
    };
  }

  function taskModal() {
    const [inf, forms] = pick(MODALS);
    const p = rnd(6);
    return {
      id: "modal", skill: "Грамматика · модальные",
      prompt: `Вставьте «${inf}» в нужной форме`,
      sentence: `${PERSON[p]} ___ nach Hause gehen.`,
      input: true, answer: forms[p],
      explain: `${PERSON[p]} ${forms[p]}: у модальных в ich/er нет окончания, в du/er меняется гласная`,
    };
  }

  function taskAdj() {
    const kind = pick(["schwach", "gemischt", "stark"]);
    const caseName = pick(["Nom", "Akk", "Dat"]);
    const gender = pick(["m", "f", "n"]);
    const TAB = {
      schwach: { Nom: { m: "-e", f: "-e", n: "-e" }, Akk: { m: "-en", f: "-e", n: "-e" }, Dat: { m: "-en", f: "-en", n: "-en" } },
      gemischt: { Nom: { m: "-er", f: "-e", n: "-es" }, Akk: { m: "-en", f: "-e", n: "-es" }, Dat: { m: "-en", f: "-en", n: "-en" } },
      stark: { Nom: { m: "-er", f: "-e", n: "-es" }, Akk: { m: "-en", f: "-e", n: "-es" }, Dat: { m: "-em", f: "-er", n: "-em" } },
    };
    const end = TAB[kind][caseName][gender];
    const article = kind === "schwach" ? { m: "der", f: "die", n: "das" }[gender]
      : kind === "gemischt" ? { m: "ein", f: "eine", n: "ein" }[gender] : "";
    const noun = { m: "Mann", f: "Frau", n: "Kind" }[gender];
    const wrong = uniqShuffle(["-e", "-en", "-er", "-es", "-em"].filter((x) => x !== end)).slice(0, 2);
    return {
      id: "adj", skill: "Грамматика · прилагательные",
      prompt: `Выберите окончание (${caseName}, ${kind === "schwach" ? "слабое" : kind === "gemischt" ? "смешанное" : "сильное"} склонение)`,
      sentence: `${article ? article + " " : ""}___ ${noun}`,
      options: shuffle([end, ...wrong]),
      answer: end,
      explain: `${article ? article + " " : ""}gut${end} ${noun}`,
    };
  }

  function taskZeiten() {
    const [sent, t, hint] = pick(ZEITEN);
    const wrong = uniqShuffle(ZEIT_NAMES.filter((x) => x !== t)).slice(0, 3);
    return {
      id: "zeiten", skill: "Грамматика · времена",
      prompt: "Какое это время?",
      sentence: sent,
      options: shuffle([t, ...wrong]),
      answer: t,
      explain: `${t} (${hint}): ${sent}`,
    };
  }

  function taskSteigerung() {
    const [pos, komp, sup] = pick(STEIGERUNG);
    return {
      id: "st", skill: "Грамматика · степени",
      prompt: `Komparativ от «${pos}»`,
      input: true, answer: komp,
      explain: `${pos} → ${komp} → ${sup}`,
    };
  }

  function taskPraep() {
    const kasus = pick(["Dativ", "Akkusativ"]);
    const prep = pick(PREPS[kasus]);
    const right = kasus;
    const wrong = uniqShuffle(["Dativ", "Akkusativ", "Genitiv"].filter((x) => x !== right)).slice(0, 2);
    return {
      id: "praep", skill: "Грамматика · предлоги",
      prompt: `«${prep}» — какой падеж после него?`,
      options: shuffle([right, ...wrong]),
      answer: right,
      explain: `«${prep}» всегда требует ${right}. Например: ${prep} dem Kind / ${prep} das Kind.`,
    };
  }

  function taskSatzbau() {
    const subj = pick(["Ich", "Mein Freund", "Die Frau", "Der Lehrer", "Wir"]);
    const verb = pick(["lernt", "kauft", "liest", "schreibt", "macht"]);
    const obj = pick(["Deutsch", "Brot", "ein Buch", "einen Brief", "Hausaufgaben"]);
    const time = pick(["heute", "morgen", "immer", "selten"]);
    const answer = `${subj} ${verb} ${obj} ${time}.`;
    return {
      id: "satz", skill: "Грамматика · порядок слов",
      prompt: "Соберите предложение в правильном порядке",
      words: shuffle([subj, verb, obj, time]),
      answer,
      explain: `${answer}<br>В простом главном предложении глагол всегда на 2-м месте.`,
    };
  }

  const GEN = {
    kasus: taskKasus, plural: taskPlural, praesens: taskPraesens, modal: taskModal,
    adj: taskAdj, zeiten: taskZeiten, st: taskSteigerung, praep: taskPraep, satz: taskSatzbau,
  };
  const MODULES = [
    { id: "kasus", title: "Падежи и артикли", sub: "der / den / dem / des — где какой", icon: "ico-book" },
    { id: "plural", title: "Множественное число", sub: "die Häuser, die Frauen…", icon: "ico-repeat" },
    { id: "praesens", title: "Präsens: окончания", sub: "mache, machst, macht…", icon: "ico-pen" },
    { id: "modal", title: "Модальные глаголы", sub: "kann, muss, darf, will…", icon: "ico-bulb" },
    { id: "adj", title: "Прилагательные", sub: "слабое, смешанное, сильное", icon: "ico-star" },
    { id: "zeiten", title: "6 времён", sub: "Perfekt, Präteritum, Futur…", icon: "ico-play" },
    { id: "st", title: "Степени сравнения", sub: "schnell → schneller → am schnellsten", icon: "ico-star" },
    { id: "praep", title: "Предлоги → падежи", sub: "mit Dativ, für Akkusativ", icon: "ico-vol" },
    { id: "satz", title: "Порядок слов", sub: "где стоит глагол", icon: "ico-pen" },
  ];

  return {
    modules: () => MODULES.map((m) => ({ ...m })),
    generate(id, n = 1) {
      const fn = GEN[id || "kasus"];
      return Array.from({ length: n }, () => fn());
    },
  };
})();
