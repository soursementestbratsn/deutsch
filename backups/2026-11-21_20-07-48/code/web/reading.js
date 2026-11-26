/* ============================================================
   Deutsch Quest — ГЕНЕРАТОР ТЕКСТОВ ДЛЯ ЧТЕНИЯ (A0 / A1 / A2)

   Как это работает:
     • EXPRESSIONS(уровень) — фразы для вставки (позитивное/негативное/время/еда).
     • SCENES — сценарии: место + кто + тема.
     • TEXT_TEMPLATES[уровень] — шаблоны текста с {плейсхолдерами}.
     • QUESTIONS — вопросы к каждому шаблону (с опорой на данные).

   Каждый клик = новый текст: случайная сцена × фразы × детали
   (день, время, погода, количество). Вопросы пересчитываются из тех же
   данных, поэтому ответ всегда совпадает с текстом.

   Как менять:
     • добавить фразы → EXPRESSIONS[уровень][категория].push(...)
     • новый сценарий → TEXT_TEMPLATES[уровень].push({...})
     • новый вопрос → функции в QUESTIONS того же template id.
   ============================================================ */
"use strict";

window.DQReading = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
  const num = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  /* ---------------- словарные банки ---------------- */
  const V = {
    mann: [
      { nom: "Peter", art: "der", gen: "Mann", he: "er" },
      { nom: "Thomas", art: "der", gen: "Mann", he: "er" },
      { nom: "Max", art: "der", gen: "Junge", he: "er" },
      { nom: "Michael", art: "der", gen: "Papa", he: "er" },
    ],
    frau: [
      { nom: "Anna", art: "die", gen: "Frau", he: "sie" },
      { nom: "Maria", art: "die", gen: "Frau", he: "sie" },
      { nom: "Julia", art: "die", gen: "Schülerin", he: "sie" },
      { nom: "Oma Inge", art: "die", gen: "Oma", he: "sie" },
    ],
    tier: [
      { nom: "Hund", art: "der", pl: "Hunde", he: "er" },
      { nom: "Kater", art: "der", pl: "Kater", he: "er" },
      { nom: "Hase", art: "der", pl: "Hasen", he: "er" },
    ],
    kind: [
      { nom: "Lena", art: "die", gen: "Tochter", he: "sie" },
      { nom: "Tim", art: "der", gen: "Sohn", he: "er" },
      { nom: "Paul", art: "der", gen: "Sohn", he: "er" },
    ],
    stadt: ["Berlin", "München", "Hamburg", "Köln", "Dresden", "Leipzig", "Stuttgart", "Bremen"],
    land: ["Deutschland", "Österreich", "der Schweiz"],
    tag: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
    zeit: ["8 Uhr", "9 Uhr", "10 Uhr", "17 Uhr", "18 Uhr", "19 Uhr"],
  };

  const FRUCHT = [
    { nom: "der Apfel", acc: "einen Apfel", pl: "Äpfel" },
    { nom: "die Banane", acc: "eine Banane", pl: "Bananen" },
    { nom: "die Birne", acc: "eine Birne", pl: "Birnen" },
    { nom: "der Pfirsich", acc: "einen Pfirsich", pl: "Pfirsiche" },
  ];

  const ESSEN = [
    { nom: "Brot mit Käse", acc: "Brot mit Käse" },
    { nom: "Suppe", acc: "eine Suppe" },
    { nom: "Nudeln", acc: "Nudeln" },
    { nom: "Kartoffeln mit Gemüse", acc: "Kartoffeln mit Gemüse" },
    { nom: "Wurst und Salat", acc: "Wurst und Salat" },
  ];

  const GETRAENK = ["Kaffee", "Tee", "Wasser", "Saft", "Milch (heiß)"];

  const ORT = [
    { nom: "Supermarkt", art: "der", in: "im Supermarkt" },
    { nom: "Bäckerei", art: "die", in: "in der Bäckerei" },
    { nom: "Markt", art: "der", in: "auf dem Markt" },
    { nom: "Buchhandlung", art: "die", in: "in der Buchhandlung" },
  ];

  const HOBBY = [
    { nom: "Fußball", spielen: "Fußball", wo: "im Park", mit: "mit seinen Freunden" },
    { nom: "Basketball", spielen: "Basketball", wo: "in der Schule", mit: "mit der Klasse" },
    { nom: "Karten", spielen: "Karten", wo: "zu Hause", mit: "mit der Familie" },
  ];

  const WETTER = {
    gut: [
      { adj: "schön", text: "schönes", extra: "und warm" },
      { adj: "sonnig", text: "sonniges", extra: "und trocken" },
    ],
    schlecht: [
      { adj: "regnerisch", text: "regnerisches", extra: "und kalt" },
      { adj: "windig", text: "windiges", extra: "und grau" },
    ],
  };

  /* ============================================================
     ШАБЛОНЫ
     ============================================================ */
  const TEMPLATES = {
    /* ---------------------------------------------------------- A0 */
    a0: [
      {
        id: "farm",
        title: "Auf dem Bauernhof",
        build() {
          const wer = rnd(V.mann);
          const tier = rnd(V.tier);
          const n = num(2, 6);
          const gut = Math.random() < 0.8;
          const fr = rnd(FRUCHT);
          return {
            text:
              `${wer.nom} wohnt auf einem Bauernhof. ${cap(wer.he)} hat ${n} ${tier.pl}. ` +
              `Die ${tier.pl} sind sehr nett. Jeden Morgen geht ${wer.he} in den Garten. ` +
              `${cap(wer.he)} isst ${fr.acc} und trinkt ${num(1, 2)} Glas Milch. ` +
              (gut ? "Es ist warm. " : "Es ist kalt. ") +
              `Am Abend sagt ${wer.he}: „Tschüss, bis morgen!“`,
            data: { wer: wer.nom, tier: tier.pl, n, gut, frucht: fr.nom },
          };
        },
        questions: (d) => [
          { q: `Wie viele ${d.tier} hat ${d.wer.split(" ")[0]}?`, a: String(d.n), wrong: [String(d.n + 2), String(d.n - 1), "zehn"] },
          { q: "Wo wohnt die Hauptperson?", a: "Auf einem Bauernhof", wrong: ["In der Stadt", "Im Hotel", "Am Bahnhof"] },
          { q: "Was isst die Hauptperson am Morgen?", a: d.frucht, wrong: ["Wurst", "Suppe", "Pizza"] },
          { q: "Wie ist das Wetter in diesem Text?", a: d.gut ? "warm" : "kalt", wrong: [d.gut ? "kalt" : "warm", "heiß", "Es regnet stark"] },
        ],
      },
      {
        id: "familie-bild",
        title: "Das Familienfoto",
        build() {
          const mann = rnd(V.mann), frau = rnd(V.frau), kind = rnd(V.kind);
          const gross = Math.random() < 0.5;
          return {
            text:
              `Das ist ein Foto von einer Familie. Hinten steht ${mann.nom}. ` +
              `Er ist ${num(30, 45)} Jahre alt. Neben ihm steht ${frau.nom}. ` +
              `Vorne sitzt ${kind.nom}, ${num(6, 14)} Jahre alt. ` +
              `Die Familie wohnt in ${rnd(V.stadt)}. ` +
              (gross ? "Die Wohnung ist groß und hell." : "Die Wohnung ist klein, aber gemütlich.") +
              " Alle sind sehr glücklich.",
            data: { mann: mann.nom, frau: frau.nom, kind: kind.nom, gross },
          };
        },
        questions: (d) => [
          { q: "Wer steht hinten auf dem Foto?", a: d.mann, wrong: [d.frau, d.kind, "der Hund"] },
          { q: "Wo wohnt die Familie?", a: "in einer Wohnung", wrong: ["im Hotel", "im Auto", "im Zelt"] },
          { q: "Wie ist die Wohnung?", a: d.gross ? "groß und hell" : "klein, aber gemütlich", wrong: [d.gross ? "klein" : "groß", "leer", "sehr alt"] },
        ],
      },
      {
        id: "cats",
        title: "Meine Katze",
        build() {
          const farbe = rnd(["schwarz", "grau", "weiß", "braun"]);
          const jahr = num(1, 8);
          const ort = rnd(["auf dem Bett", "auf dem Tisch", "auf dem Sofa", "im Korb"]);
          return {
            text:
              `Ich habe eine Katze. Sie ist ${farbe} und schon ${jahr} Jahre alt. ` +
              `Am Morgen schläft sie immer ${ort}. Dann trinkt sie Milch und geht in den Garten. ` +
              `Abends sitzt sie bei mir auf dem Tisch. Nachts ist die Katze wach. ` +
              `Ich mag meine Katze sehr.`,
            data: { farbe, jahr, ort },
          };
        },
        questions: (d) => [
          { q: "Welche Farbe hat die Katze?", a: d.farbe, wrong: ["rot", "grün", "blau"] },
          { q: `Wie alt ist die Katze?`, a: `${d.jahr} Jahre`, wrong: [`${d.jahr + 3} Jahre`, `${d.jahr + 1} Jahre`, "zehn Jahre"] },
          { q: "Wo schläft die Katze am Morgen?", a: d.ort, wrong: ["im Auto", "in der Schule", "auf dem Dach"] },
        ],
      },
      {
        id: "a0-schule",
        title: "In der Schule",
        build() {
          const kind = rnd(V.kind);
          const fach = rnd(["Deutsch", "Mathe", "Sport", "Kunst", "Musik"]);
          const n = num(10, 12);
          const wann = rnd(V.zeit);
          const gern = Math.random() < 0.6;
          return {
            text:
              `${kind.nom} geht in die Schule. Die Schule beginnt um ${wann}. ` +
              `Um ${n} Uhr gibt es eine Pause. ${kind.nom} mag ${fach} ` + (gern ? "sehr. " : "nicht so gern. ") +
              `In der Pause isst ${kind.nom} ein Brot und trinkt Wasser. ` +
              `Nach der Schule geht ${kind.nom} nach Hause und macht die Hausaufgaben.`,
            data: { kind: kind.nom, fach, n, wann, gern },
          };
        },
        questions: (d) => [
          { q: "Wann beginnt die Schule?", a: `um ${d.wann}`, wrong: ["um 12 Uhr", "am Abend", "um 7 Uhr"] },
          { q: `Welches Fach mag ${d.kind.split(" ")[0]}?`, a: d.gern ? d.fach : "Andere Fächer", wrong: [d.gern ? "Sport nicht" : d.fach, "gar nichts", "nur Mathe"] },
          { q: "Was isst das Kind in der Pause?", a: "ein Brot", wrong: ["eine Suppe", "einen Apfel", "ein Eis"] },
        ],
      },
      {
        id: "a0-einkaufen",
        title: "Im Supermarkt",
        build() {
          const fr = rnd(FRUCHT);
          const n = num(2, 6);
          const getr = rnd(GETRAENK);
          const brot = rnd(["Brot", "Brötchen", "Kuchen"]);
          return {
            text:
              `Ich kaufe heute im Supermarkt ein. Ich brauche ${n} ${fr.pl} und ein ${brot}. ` +
              `Ich möchte auch ${getr} kaufen. Der Supermarkt ist neben dem Bahnhof. ` +
              `Die Verkäuferin ist sehr freundlich. Ich bezahle an der Kasse. ` +
              `Danach trage ich meine Tasche nach Hause.`,
            data: { fr: fr.pl, n, getr, brot },
          };
        },
        questions: (d) => [
          { q: `Wie viele ${d.fr} kaufe ich?`, a: String(d.n), wrong: [String(d.n + 2), "eins", "zehn"] },
          { q: "Was möchte ich trinken kaufen?", a: d.getr, wrong: ["Kaffee", "Cola", "Bier"] },
          { q: "Wo ist der Supermarkt?", a: "neben dem Bahnhof", wrong: ["in der Schule", "am Markt", "im Park"] },
        ],
      },
      {
        id: "a0-hund",
        title: "Mein Hund Bello",
        build() {
          const hund = rnd(["Bello", "Max", "Lucky", "Wuffi"]);
          const jahr = num(1, 9);
          const spiel = rnd(["Ball", "Stock", "seinen Knochen"]);
          return {
            text:
              `Mein Hund heisst ${hund}. Er ist ${jahr} Jahre alt und sehr freundlich. ` +
              `Jeden Morgen gehen wir in den Park. Dort spielt ${hund} mit einem ${spiel}. ` +
              `Er frisst gern Fleisch und trinkt viel Wasser. ` +
              `Am Abend schläft er auf dem Boden im Flur. Ich liebe meinen Hund.`,
            data: { hund, jahr, spiel },
          };
        },
        questions: (d) => [
          { q: "Wie heißt der Hund?", a: d.hund, wrong: ["Junge", "Anna", "Hase"] },
          { q: "Wie alt ist der Hund?", a: `${d.jahr} Jahre`, wrong: ["zehn Jahre", "ein Jahr", `${d.jahr + 2} Jahre`] },
          { q: "Wo schläft der Hund abends?", a: "auf dem Boden im Flur", wrong: ["im Bett", "im Garten", "in der Schule"] },
        ],
      },

      {
        id: "a0-essen",
        title: "Beim Mittagessen",
        build() {
          const wer = rnd(V.frau);
          const essen = rnd(ESSEN);
          const getr = rnd(GETRAENK);
          const ort = rnd(["in der Küche", "im Restaurant", "in der Schule", "im Garten"]);
          const lecker = Math.random() < 0.75;
          return {
            text:
              `${wer.nom} isst heute ${essen.acc} ${ort}. Sie trinkt einen ${getr}. ` +
              (lecker
                ? "Das Essen ist sehr lecker, und sie isst alles."
                : "Das Essen ist leider kalt, und sie isst nur ein bisschen.") +
              ` Danach bezahlt sie ${num(3, 12)} Euro. Am Abend kocht sie zu Hause eine Suppe.`,
            data: { wer: wer.nom, essen: essen.nom, getr, ort, lecker },
          };
        },
        questions: (d) => [
          { q: "Was isst die Person?", a: d.essen, wrong: ["Pizza", "Eis", "Kuchen"] },
          { q: "Was trinkt sie?", a: d.getr, wrong: ["Bier", "Cola", "Tee"] },
          { q: "Wo isst sie?", a: d.ort, wrong: ["im Auto", "am Bahnhof", "im Kino"] },
          { q: "Ist das Essen gut?", a: d.lecker ? "ja, sehr lecker" : "nein, es ist kalt", wrong: [d.lecker ? "nein, es ist kalt" : "ja, sehr lecker", "man weiß es nicht", "es ist zu teuer"] },
        ],
      },
      {
        id: "a0-hobby",
        title: "Nach der Schule",
        build() {
          const kind = rnd(V.kind);
          const h = rnd(HOBBY);
          const zeit = num(15, 18);
          return {
            text:
              `${kind.nom} geht um 14 Uhr nach Hause. Um ${zeit} Uhr spielt ${kind.nom} ${h.spielen} ${h.wo} ${h.mit}. ` +
              `Das macht sehr viel Spaß. Danach trinkt ${kind.nom} Wasser und macht die Hausaufgaben. ` +
              `Am Abend sieht ${kind.nom} noch ein bisschen Fernsehen und geht um 21 Uhr ins Bett.`,
            data: { kind: kind.nom, h, zeit },
          };
        },
        questions: (d) => [
          { q: "Was spielt das Kind?", a: d.h.spielen, wrong: ["Klavier", "Schach", "Tennis"] },
          { q: "Wo spielt das Kind?", a: d.h.wo, wrong: ["im Büro", "am Flughafen", "in der Küche"] },
          { q: "Um wie viel Uhr spielt das Kind?", a: d.zeit + " Uhr", wrong: ["um 8 Uhr", "um 23 Uhr", "um 5 Uhr"] },
        ],
      },
    ],

    /* ---------------------------------------------------------- A1 */
    a1: [
      {
        id: "weekend-market",
        title: "Am Samstag auf dem Markt",
        build() {
          const tag = rnd(V.tag);
          const zeit = rnd(V.zeit);
          const ort = rnd(ORT);
          const fr = rnd(FRUCHT);
          const n = num(2, 5);
          const preis = (n * 1.5 + 0.5).toFixed(2).replace(".", ",");
          const eff = rnd(["Brötchen", "Kuchen", "Honig", "Käse"]);
          return {
            text:
              `Am ${tag}morgen steht Anna um ${zeit} auf. Sie fährt mit dem Fahrrad zum Markt. ` +
              `Sie geht zuerst ${ort.in}. Dort kauft sie ${n} ${fr.pl} und ein Brot. ` +
              `Die ${fr.pl} kosten ${preis} Euro. Danach geht sie noch in die Bäckerei und kauft ${eff}. ` +
              `Um 12 Uhr ist sie wieder zu Hause. Sie kocht eine Suppe für die Familie. ` +
              `Der ${tag} ist für Anna immer ein schöner Tag.`,
            data: { tag, zeit, ort: ort.nom, n, frucht: fr.pl, preis, eff },
          };
        },
        questions: (d) => [
          { q: "Wann steht Anna auf?", a: `um ${d.zeit}`, wrong: ["um 6 Uhr", "um 14 Uhr", "um 20 Uhr"] },
          { q: `Wie viele ${d.frucht} kauft Anna?`, a: String(d.n), wrong: [String(d.n + 2), String(d.n + 1), "zehn"] },
          { q: "Was kostet das Obst?", a: `${d.preis} Euro`, wrong: ["1 Euro", `${d.preis} Cent`, "umsonst"] },
          { q: "Was kauft Anna in der Bäckerei?", a: d.eff, wrong: ["Brot", "Milch", "Kartoffeln"] },
          { q: "Was macht Anna zu Hause?", a: "Sie kocht eine Suppe", wrong: ["Sie schläft", "Sie fährt in die Stadt", "Sie liest"] },
        ],
      },
      {
        id: "zug",
        title: "Die Reise nach Berlin",
        build() {
          const zeit = num(6, 11);
          const dauer = num(2, 5);
          const preis = num(30, 90);
          const schlecht = Math.random() < 0.5;
          return {
            text:
              `Letztes Jahr war Peter mit dem Zug in Berlin. Der Zug fuhr um ${zeit} Uhr ab. ` +
              `Die Reise dauerte ${dauer} Stunden. Er hat ${preis} Euro für die Fahrkarte bezahlt. ` +
              (schlecht
                ? "Unterwegs war der Zug zu spät. Peter war müde und ärgerlich. "
                : "Die Fahrt war ruhig, und Peter konnte schlafen. ") +
              `In Berlin besuchte er das Museum und das Brandenburger Tor. ` +
              `Er aß eine Wurst und trank einen Kaffee. ` +
              `${cap(schlecht ? "Trotzdem war" : "Am Ende war")} Peter ${schlecht ? "froh, wieder zu Hause zu sein" : "glücklich und sehr zufrieden"}.`,
            data: { zeit, dauer, preis, schlecht },
          };
        },
        questions: (d) => [
          { q: "Wann fuhr der Zug ab?", a: `${d.zeit} Uhr`, wrong: ["0 Uhr", "23 Uhr", "um 3 Uhr"] },
          { q: "Wie lange dauerte die Reise?", a: `${d.dauer} Stunden`, wrong: [`${d.dauer + 1} Stunden`, "zehn Minuten", "3 Tage"] },
          { q: "Wie viel hat die Fahrkarte gekostet?", a: `${d.preis} Euro`, wrong: ["10 Euro", "100 Euro", "umsonst"] },
          { q: "Was hat Peter in Berlin besucht?", a: "das Museum und das Brandenburger Tor", wrong: ["eine Schule", "den Zoo und den Bahnhof", "den Markt"] },
          { q: "Was trank Peter?", a: "einen Kaffee", wrong: ["Tee", "Wasser", "Bier"] },
        ],
      },
      {
        id: "wohnung",
        title: "Die neue Wohnung",
        build() {
          const zimmer = num(2, 4);
          const preis = num(350, 700);
          const stock = num(1, 5);
          const gut = Math.random() < 0.6;
          return {
            text:
              `Meine Schwester sucht eine neue Wohnung. Sie hat endlich eine gefunden. ` +
              `Die Wohnung hat ${zimmer} Zimmer und ein Bad. Sie kostet ${preis} Euro pro Monat. ` +
              `Sie liegt im ${stock}. Stock. ` +
              (gut ? "Die Wohnung ist hell, aber die Küche ist sehr alt. " : "Die Wohnung ist leider sehr dunkel und laut. ") +
              `Vom Fenster sieht man ${gut ? "den Park" : "nur die Straße"}. ` +
              `Meine Schwester möchte im Sommer einziehen. Dann machen wir eine kleine Party.`,
            data: { zimmer, preis, stock, gut },
          };
        },
        questions: (d) => [
          { q: "Wie viele Zimmer hat die Wohnung?", a: String(d.zimmer), wrong: [String(d.zimmer + 1), "ein Zimmer", "zehn"] },
          { q: "Wie viel kostet die Wohnung pro Monat?", a: `${d.preis} Euro`, wrong: [`${d.preis + 100} Euro`, "50 Euro", "umsonst"] },
          { q: "In welchem Stock liegt die Wohnung?", a: `${d.stock}. Stock`, wrong: ["im Erdgeschoss", "im 10. Stock", "im Keller"] },
          { q: "Was sieht man vom Fenster?", a: "den Park", wrong: ["den Bahnhof", "das Meer", "die Schule"] },
        ],
      },

      {
        id: "a1-einladung",
        title: "Einladung zum Geburtstag",
        build() {
          const wer = rnd(V.frau);
          const alter = num(20, 45);
          const tag = rnd(V.tag);
          const zeit = rnd(V.zeit);
          const ort = rnd(["in ihrer Wohnung", "im Restaurant", "im Park", "in der Bibliothek"]);
          const mitbringen = rnd(["einen Kuchen", "Blumen", "ein Geschenk", "einen Salat"]);
          return {
            text:
              `${wer.nom} wird am ${tag} ${alter} Jahre alt. Sie macht eine kleine Party ${ort}. ` +
              `Die Party beginnt um ${zeit}. Sie möchte mit Freunden essen, reden und Musik hören. ` +
              `Jeder Gast soll ${mitbringen} mitbringen. ` +
              `${wer.nom} freut sich schon sehr auf die Feier und hat alle Freunde eingeladen.`,
            data: { wer: wer.nom, alter, tag, zeit, ort, mitbringen },
          };
        },
        questions: (d) => [
          { q: "Wie alt wird die Person?", a: `${d.alter} Jahre`, wrong: [`${d.alter + 5} Jahre`, "zehn Jahre", "hundert Jahre"] },
          { q: "Wann ist die Party?", a: `am ${d.tag}`, wrong: ["am Montag", "nächste Woche", "im Sommer"] },
          { q: "Wann beginnt die Party?", a: `um ${d.zeit}`, wrong: ["um 5 Uhr morgens", "am Abend um 23 Uhr", "um 12 Uhr"] },
          { q: "Was soll jeder Gast mitbringen?", a: d.mitbringen, wrong: ["nichts", "ein Handy", "ein Buch"] },
        ],
      },
      {
        id: "a1-arbeit",
        title: "Der erste Arbeitstag",
        build() {
          const wer = rnd(V.mann);
          const beruf = rnd([
            { job: "Verkäufer", ort: "im Supermarkt" },
            { job: "Fahrer", ort: "in einer Firma" },
            { job: "Lehrer", ort: "in einer Schule" },
          ]);
          const zeit = rnd(["7", "8", "9"]);
          const kollege = rnd(V.frau);
          const ok = Math.random() < 0.75;
          return {
            text:
              `${wer.nom} hat einen neuen Job: ${wer.he} arbeitet jetzt als ${beruf.job} ${beruf.ort}. ` +
              `Am ersten Tag muss ${wer.he} um ${zeit} Uhr da sein. ${kollege.nom} zeigt ihm die Arbeit. ` +
              (ok
                ? `Alles ist neu, aber nach einer Woche fühlt ${wer.he} sich schon sehr wohl.`
                : `Leider gefällt ihm die Arbeit nicht, weil die Kollegen oft gestresst sind.`) +
              ` Am Abend ruft ${wer.he} die Familie an und erzählt von dem Tag.`,
            note: ok ? "positive" : "negative",
            data: { wer: wer.nom, beruf, zeit, kollege: kollege.nom, ok },
          };
        },
        questions: (d) => [
          { q: "Was ist der neue Job?", a: "als " + d.beruf.job, wrong: ["als Koch", "als Arzt", "als Bäcker"] },
          { q: "Um wie viel Uhr muss die Person am ersten Tag da sein?", a: d.zeit + " Uhr", wrong: ["um 15 Uhr", "um 20 Uhr", "erst am Abend"] },
          { q: "Wer zeigt die Arbeit?", a: d.kollege, wrong: ["der Chef", "die Familie", "niemand"] },
          { q: "Wie findet die Person die Arbeit?", a: d.ok ? "sehr wohl" : "nicht gut, weil die Kollegen gestresst sind", wrong: ["sehr schwer, weil der Weg weit ist", "langweilig", "zu teuer"] },
        ],
      },
      {
        id: "a1-wetter",
        title: "Ein verrückter Sonntag",
        build() {
          const tag = rnd(V.tag);
          const wetter = rnd(["Sonne", "Regen", "Wind", "Schnee"]);
          const was = rnd(V.frau);
          const ort = rnd(["im Park", "in der Stadt", "am See", "im Garten"]);
          const action = rnd(["spazieren", "Rad fahren", "Fußball spielen", "ein Picknick machen"]);
          const pech = Math.random() < 0.5;
          return {
            text:
              `Am ${tag} wollte ${was.nom} mit Freunden ${action} ${ort}. ` +
              `Der Wetterbericht hat ${wetter} angekündigt. ` +
              (pech
                ? `Leider hat es dann stark geregnet, und alle sind nass geworden. `
                : `Und es war wirklich schön! Die Sonne hat geschienen, und alle waren sehr fröhlich. `) +
              `Danach haben sie in einem Café Warmes getrunken. ` +
              `Der ${tag} war vielleicht verrückt, aber lustig.`,
            data: { tag, wetter, was: was.nom, ort, action, pech },
          };
        },
        questions: (d) => [
          { q: "Was wollte die Person machen?", a: d.action + " " + d.ort, wrong: ["schlafen", "arbeiten", "im Kino sitzen"] },
          { q: "Welches Wetter war angekündigt?", a: d.wetter, wrong: ["30 Grad Hitze", "Schnee im Sommer", "kein Wetter"] },
          { q: "Hat das Wetter gepasst?", a: d.pech ? "nein, es hat geregnet" : "ja, die Sonne hat geschienen", wrong: [d.pech ? "ja, es war warm" : "nein, es hat geschneit", "man weiß es nicht", "es gab Sturm"] },
          { q: "Was haben sie danach gemacht?", a: "in einem Café Warmes getrunken", wrong: ["zu Hause geschlafen", "einen Film gesehen", "weiter Fußball gespielt"] },
        ],
      },

      {
        id: "a1-wetterbericht",
        title: "Der Wetterbericht",
        build() {
          const stadt = rnd(V.stadt);
          const temp = num(4, 26);
          const wetter = Math.random() < 0.5 ? "Sonne" : "Regen";
          const wind = num(5, 35);
          return {
            text:
              `Der Wetterbericht für ${stadt}: Am Morgen sind es ${temp} Grad. ` +
              `Am Nachmittag gibt es ${wetter}, und der Wind kommt aus dem Norden mit ${wind} Kilometern pro Stunde. ` +
              (wetter === "Regen"
                ? "Wer heute unterwegs ist, sollte einen Regenschirm mitnehmen. "
                : "Perfektes Wetter für einen Spaziergang — die Sonne scheint fast den ganzen Tag. ") +
              `Am Abend werden die Temperaturen niedriger, und in der Nacht kühlt es auf ${Math.max(0, temp - 8)} Grad ab.`,
            data: { stadt, temp, wetter, wind },
          };
        },
        questions: (d) => [
          { q: "Für welche Stadt ist der Wetterbericht?", a: d.stadt, wrong: ["Wien", "Paris", "Rom"] },
          { q: "Wie viele Grad sind am Morgen?", a: `${d.temp} Grad`, wrong: ["minus 5 Grad", "40 Grad", "0 Grad"] },
          { q: "Welches Wetter gibt es am Nachmittag?", a: d.wetter, wrong: [d.wetter === "Sonne" ? "Regen" : "Sonne", "Schnee", "Hagel"] },
          { q: "Was sollte man mitnehmen, wenn es regnet?", a: "einen Regenschirm", wrong: ["eine Sonnenbrille", "einen Hut", "nichts"] },
        ],
      },
      {
        id: "a1-reparatur",
        title: "Die kaputte Waschmaschine",
        build() {
          const jahre = num(2, 9);
          const preis = num(80, 250);
          const neu = num(400, 700);
          const entscheidung = Math.random() < 0.5;
          return {
            text:
              `Familie Krüger hat ein Problem: Die Waschmaschine ist kaputt. Sie ist ${jahre} Jahre alt. ` +
              `Der Techniker sagt, dass die Reparatur ${preis} Euro kostet. ` +
              `Eine neue Maschine kostet aber ${neu} Euro. ` +
              (entscheidung
                ? "Deshalb entscheidet sich die Familie für eine neue Waschmaschine."
                : "Deshalb lassen sie die alte Maschine reparieren, denn sie funktioniert danach wieder sehr gut.") +
              ` Am Samstag geht die Familie zum Elektromarkt in der Stadt. `,
            data: { jahre, preis, neu, entscheidung },
          };
        },
        questions: (d) => [
          { q: "Wie alt ist die Waschmaschine?", a: `${d.jahre} Jahre`, wrong: ["ein Jahr", "zwanzig Jahre", "neu"] },
          { q: "Wie viel kostet die Reparatur?", a: `${d.preis} Euro`, wrong: ["10 Euro", "umsonst", `${d.neu} Euro`] },
          { q: "Wie viel kostet eine neue Maschine?", a: `${d.neu} Euro`, wrong: ["50 Euro", "umsonst", `${d.preis} Euro`] },
          { q: "Was macht die Familie?", a: d.entscheidung ? "Sie kauft eine neue Waschmaschine" : "Sie lässt die alte reparieren", wrong: [d.entscheidung ? "Sie lässt sie reparieren" : "Sie kauft eine neue", "Sie wäscht mit der Hand", "Sie zieht um"] },
        ],
      },
    ],

    /* ---------------------------------------------------------- A2 */
    a2: [
      {
        id: "bewerbung",
        title: "Das Bewerbungsgespräch",
        build() {
          const beruf = rnd([
            { job: "Mechaniker", ort: "in einer Werkstatt" },
            { job: "Koch", ort: "in einem Restaurant" },
            { job: "Verkäufer", ort: "in einem Supermarkt" },
          ]);
          const jahre = num(1, 6);
          const pnktlich = Math.random() < 0.7;
          return {
            text:
              `Herr Krause hat sich um eine Stelle als ${beruf.job} beworben. ` +
              `Letzten Dienstag hatte er ein Vorstellungsgespräch. Der Termin war um 9 Uhr. ` +
              (pnktlich
                ? "Er ist pünktlich gekommen und hat einen guten Eindruck gemacht. "
                : "Leider ist er zu spät gekommen, weil der Bus nicht pünktlich fuhr. ") +
              `Er hat erzählt, dass er ${jahre} Jahre Erfahrung ${beruf.ort} hat. ` +
              `Außerdem spricht er Deutsch, Englisch und ein bisschen Spanisch. ` +
              `Die Chefin hat ihm Fragen gestellt, denn sie sucht einen Mitarbeiter, ` +
              `der selbstständig arbeiten kann.` +
              (pnktlich
                ? " Am Ende hat sie gesagt: „Sie haben die Stelle.“ Herr Krause ist sehr froh."
                : " Deshalb hat sie ihm eine zweite Chance gegeben: Am Freitag soll er noch einmal kommen."),
            data: { beruf, jahre, pnktlich },
          };
        },
        questions: (d) => [
          { q: "Um welche Stelle hat sich Herr Krause beworben?", a: "als " + d.beruf.job, wrong: ["als Lehrer", "als Pilot", "als Ingenieur"] },
          { q: "Wann war der Termin?", a: "um 9 Uhr", wrong: ["um 15 Uhr", "am Wochenende", "am Abend"] },
          { q: "Wie viele Jahre Erfahrung hat Herr Krause?", a: `${d.jahre} Jahre`, wrong: [`${d.jahre + 2} Jahre`, "gar keine", "zwanzig Jahre"] },
          { q: "Wie viele Sprachen spricht der Bewerber?", a: "drei", wrong: ["eine", "zwei", "vier"] },
          { q: "Was sucht die Chefin?", a: "einen Mitarbeiter, der selbstständig arbeiten kann", wrong: ["einen Praktikanten", "eine Sekretärin", "einen Fahrer"] },
        ],
      },
      {
        id: "umwelt",
        title: "Ein Paket weniger pro Woche",
        build() {
          const stadt = rnd(V.stadt);
          const prozent = num(20, 40);
          const wie = rnd(["Mit dem Fahrrad", "Zu Fuß", "Mit dem Bus"]);
          const plan = rnd(["Kisten statt Kartons", "Pfandflaschen", "Leitungswasser", "Reparatur statt Neukauf"]);
          return {
            text:
              `In ${stadt} haben die Menschen ein neues Ziel: Sie wollen weniger Müll produzieren. ` +
              `Seit einem Jahr kaufen sie jeden Monat ein Paket weniger. Das klingt nach wenig, ` +
              `aber zusammen macht das ${prozent} Prozent weniger Verpackungen. ` +
              `Viele legen Wege in die Stadt ${wie.toLowerCase()} zurück, zum Beispiel zum Einkaufen oder zur Arbeit. ` +
              `Einige Läden benutzen ${plan}. Die Stadt will das Projekt noch ein Jahr testen, ` +
              `denn sie hofft, dass mehr Leute mitmachen. Kritiker sagen aber, dass die Regeln zu streng für Familien sind.`,
            data: { stadt, prozent, wie, plan },
          };
        },
        questions: (d) => [
          { q: "Wo findet das Projekt statt?", a: "in " + d.stadt, wrong: ["in Paris", "in Wien", "in Rom"] },
          { q: "Um wie viel Prozent gibt es weniger Verpackungen?", a: `${d.prozent} %`, wrong: ["5 %", "90 %", "gar nicht"] },
          { q: "Wie kommen viele Menschen in die Stadt?", a: d.wie.toLowerCase(), wrong: ["mit dem Auto", "mit dem Flugzeug", "mit dem Taxi"] },
          { q: "Was kritisieren manche Menschen?", a: "dass die Regeln zu streng für Familien sind", wrong: ["dass es zu billig ist", "dass die Stadt keine Läden hat", "dass die Züge fahren"] },
        ],
      },
      {
        id: "arzt",
        title: "Beim Arzt",
        build() {
          const seit = num(2, 5);
          const symptom = rnd([{ s: "Kopfschmerzen", r: "Kopfschmerz-Tabletten" }, { s: "Husten", r: "Hustensaft" }, { s: "Bauchschmerzen", r: "Tabletten für den Bauch" }]);
          const weiter = Math.random() < 0.5;
          return {
            text:
              `Frau Neumann fühlt sich seit ${seit} Tagen schlecht. Sie hat ${symptom.s} und kann nicht gut schlafen. ` +
              `Deshalb hat sie einen Termin beim Arzt gemacht. Der Arzt hat sie untersucht und gesagt, ` +
              `dass sie sich ausruhen soll. Er hat ihr ${symptom.r} verschrieben. ` +
              `Außerdem soll sie viel Wasser trinken und keine schwere Arbeit machen. ` +
              (weiter
                ? "Wenn es nach einer Woche nicht besser ist, soll sie wieder kommen."
                : "Sie muss zwei Tage zu Hause bleiben und darf nicht zur Arbeit.") +
              ` Frau Neumann hat gefragt, ob sie Sport machen darf, und der Arzt hat gelacht.`,
            data: { seit, symptom, weiter },
          };
        },
        questions: (d) => [
          { q: "Seit wie vielen Tagen ist Frau Neumann krank?", a: `${d.seit} Tagen`, wrong: ["einem Tag", "zwei Wochen", "drei Monaten"] },
          { q: "Was hat der Arzt verschrieben?", a: d.symptom.r, wrong: ["Tee", "keine Medikamente", "eine Spritze"] },
          { q: "Was soll Frau Neumann tun?", a: "sich ausruhen und viel Wasser trinken", wrong: ["viel Sport machen", "zur Arbeit gehen", "mehr Kaffee trinken"] },
          { q: "Was hat Frau Neumann den Arzt gefragt?", a: "ob sie Sport machen darf", wrong: ["was das kostet", "wo die Toilette ist", "ob sie arbeiten muss"] },
        ],
      },
      {
        id: "a2-wohngemeinschaft",
        title: "Zusammen wohnen — ja oder nein?",
        build() {
          const mieter = num(300, 600);
          const zimmer = num(2, 4);
          const pro = ["Strom", "Internet", "Wasser", "Müll"];
          const pflicht = rnd(["putzen", "einkaufen", "kochen", "Abfall wegbringen"]);
          const konflikt = Math.random() < 0.6;
          return {
            text:
              `Drei Studenten suchen eine gemeinsame Wohnung in der Stadt. Die Miete beträgt ${mieter} Euro, ` +
              `dazu kommen Kosten für ${pro[0]}, ${pro[1]}, ${pro[2]} und ${pro[3]}. Die Wohnung hat ${zimmer} Zimmer und eine Küche. ` +
              `Alle wollen sparen, denn einzeln ist das Wohnen zu teuer. Deshalb machen sie einen Plan: ` +
              `Jeder muss einmal pro Woche ${pflicht}. ` +
              (konflikt
                ? `Aber schon nach einem Monat gibt es Streit, weil niemand die Küche sauber macht. `
                : `Das funktioniert sehr gut, weil alle sich an die Regeln halten. `) +
              `Am Ende sind sie sich einig: Die Wohnung ist klein, aber sie ist ihr Zuhause.`,
            data: { mieter, zimmer, pro, pflicht, konflikt },
          };
        },
        questions: (d) => [
          { q: "Wie hoch ist die Miete?", a: d.mieter + " Euro", wrong: ["100 Euro", "1000 Euro", "umsonst"] },
          { q: "Wie viele Zimmer hat die Wohnung?", a: String(d.zimmer), wrong: ["ein Zimmer", "zehn Zimmer", String(d.zimmer + 3)] },
          { q: "Was muss jeder einmal pro Woche machen?", a: d.pflicht, wrong: ["Sport", "arbeiten", "Fernsehen"] },
          { q: "Warum gibt es Streit (oder warum nicht)?", a: d.konflikt ? "weil niemand die Küche sauber macht" : "weil alle sich an die Regeln halten", wrong: ["weil die Miete zu hoch ist", "weil die Wohnung zu klein ist", "weil sie nicht genug Geld haben"] },
        ],
      },
      {
        id: "a2-termin",
        title: "Der Termin beim Amt",
        build() {
          const nummer = num(20, 90);
          const warten = num(10, 60);
          const dokument = rnd(["einen Ausweis", "eine Anmeldung", "einen Vertrag", "eine Unterschrift"]);
          const fehlt = Math.random() < 0.5;
          return {
            text:
              `Frau Berger musste heute zum Amt. Sie hatte einen Termin um 9 Uhr und die Nummer ${nummer} ` +
              `auf ihrem Tickets. Am Eingang hat sie gefragt, wo sie warten soll, und die Frau am Schalter ` +
              `hat gesagt, dass sie im ersten Stock Platz nehmen soll. Sie musste etwa ${warten} Minuten warten. ` +
              `Für den Antrag brauchte sie ${dokument}. ` +
              (fehlt
                ? `Leider hat sie etwas vergessen: Ohne den zweiten Ausweis konnte der Beamte den Antrag nicht fertig machen. ` +
                  `Deshalb muss sie morgen wieder kommen.`
                : `Zum Glück hatte sie alles dabei, und der Antrag war in zehn Minuten fertig. `) +
              ` Frau Berger hat danach gesagt, dass sie froh ist, wenn alles erledigt ist.`,
            data: { nummer, warten, dokument, fehlt },
          };
        },
        questions: (d) => [
          { q: "Was für eine Nummer hatte Frau Berger?", a: String(d.nummer), wrong: ["1", "100", "55"] },
          { q: "Wie lange musste sie warten?", a: `etwa ${d.warten} Minuten`, wrong: ["zwei Stunden", "gar nicht", "drei Tage"] },
          { q: "Was brauchte sie für den Antrag?", a: d.dokument, wrong: ["ein Foto", "Geld", "ein Auto"] },
          { q: "Konnte der Antrag fertig werden?", a: d.fehlt ? "nein, sie musste morgen wieder kommen" : "ja, in zehn Minuten", wrong: [d.fehlt ? "ja, sehr schnell" : "nein, sie hat alles vergessen", "man weiß es nicht", "erst in einer Woche"] },
        ],
      },
    ],
  };

  /* ============================================================
     СБОРКА
     ============================================================ */
  const S = { level: "a1", current: null, answered: false, score: 0, total: 0 };

  function generate(level) {
    const tpl = rnd(TEMPLATES[level]);
    const data = tpl.build();
    const questions = tpl.questions(data.data);
    return {
      id: tpl.id + "-" + Math.random().toString(36).slice(2, 7),
      level: level.toUpperCase(),
      title: tpl.title,
      text: data.text,
      questions: questions.map((q) => {
        // убираем дубли и совпадения с правильным ответом (шаблоны могут пересечься)
        const seen = new Set([String(q.a).toLowerCase()]);
        const wrong = [];
        for (const w of q.wrong) {
          const k = String(w).toLowerCase();
          if (!seen.has(k)) { seen.add(k); wrong.push(w); }
        }
        while (wrong.length < 3) wrong.push("—" + (wrong.length + 1));
        const opts = [q.a, ...wrong.slice(0, 3)];
        // перемешиваем варианты
        for (let i = opts.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [opts[i], opts[j]] = [opts[j], opts[i]];
        }
        return { q: q.q, answer: q.a, options: opts, picked: null };
      }),
    };
  }

  function speakText(text, slow) {
    // живой голос из phonetics.js: лучший немецкий голос, паузы по запятым
    if (window.DQVoice) { window.DQVoice.say(text, "de", { slow: !!slow, forceBrowser: true }); return; }
    if (!window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "de-DE";
      u.rate = slow ? 0.6 : 0.9;
      speechSynthesis.speak(u);
    } catch (e) { /* нет синтеза — не страшно */ }
  }

  /** Каждое слово — кликабельное: щёлкнул → услышал и увидел транскрипцию. */
  function markWords(text) {
    return String(text).split(/(\s+)/).map((chunk) => {
      if (!chunk.trim()) return chunk;
      const m = chunk.match(/^(.*?)([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß-]*)(.*)$/);
      if (!m) return chunk;
      const word = m[2];
      return `${m[1]}<span class="rd-word" data-w="${encodeURIComponent(word)}">${word}</span>${m[3]}`;
    }).join("");
  }

  function showWordCard(word, anchor) {
    const host = $("#rdWordCard");
    if (!host) return;
    window.DQPhon.prepare([word]).then(() => {
      const html = window.DQPhon.card(word, { title: false });
      host.innerHTML = html || `<div class="ph-card"><b>${word}</b></div>`;
      window.DQPhon.bind(host);
      window.DQVoice && window.DQVoice.say(word, "de");
      if (anchor) { try { anchor.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {} }
    });
  }

  function bindWords(root) {
    root.querySelectorAll(".rd-word").forEach((el) => {
      el.onclick = (e) => {
        const word = decodeURIComponent(el.dataset.w);
        root.querySelectorAll(".rd-word.playing").forEach((x) => x.classList.remove("playing"));
        el.classList.add("playing");
        showWordCard(word, $("#rdWordCard"));
        window.DQSND && window.DQSND.tap();
      };
    });
  }

  function render() {
    const box = $("#readingBox");
    if (!box) return;
    if (!S.current) {
      box.innerHTML = `<div class="rd-empty">
        <div class="rd-empty-icon"><span class="ico ico-vol" style="font-size:44px"></span></div>
        <p>Выберите уровень и нажмите «Новый текст» — текст и вопросы будут новыми каждый раз.</p>
      </div>`;
      return;
    }
    const t = S.current;
    box.innerHTML = `
      <article class="card rd-text-card">
        <div class="rd-text-head">
          <div>
            <span class="ws-level">${t.level}</span>
            <h3>${t.title}</h3>
          </div>
          <div class="rd-actions">
            <button class="btn ghost small" id="rdSpeak"><span class="ico ico-vol"></span> Прослушать</button>
            <button class="btn ghost small" id="rdSlow"><span class="ico ico-slow"></span> Медленно</button>
            <button class="btn ghost small" id="rdStop"><span class="ico ico-stop"></span> Стоп</button>
            <button class="btn ghost small" id="rdAnother"><span class="ico ico-repeat"></span> Другой текст</button>
          </div>
        </div>
        <p class="rd-text reading-text" id="rdText">${markWords(t.text)}</p>
        <div id="rdWordCard"></div>
        <div class="rd-hint-mini muted small" style="margin-top:8px">
          Щёлкни по любому слову — услышишь его и увидишь транскрипцию.
        </div>
        <div class="rd-words" id="rdWords"></div>
      </article>

      <div class="card rd-q-card">
        <div class="stat-panel-head">
          <h3>Вопросы к тексту</h3>
          <span class="muted small">${t.questions.length} вопросов</span>
        </div>
        <div class="rd-questions">
          ${t.questions.map((q, i) => `
            <div class="rd-q" data-i="${i}">
              <div class="rd-q-text"><span class="ws-num">${i + 1}</span> ${q.q}</div>
              <div class="g-row rd-opts">
                ${q.options.map((o) => `<button class="g-tile small rd-opt" data-o="${o}">${o}</button>`).join("")}
              </div>
              <div class="rd-fb" hidden></div>
            </div>`).join("")}
        </div>
        <div class="g-actions" style="margin-top:16px">
          <button class="btn primary" id="rdCheck">Проверить ответы</button>
        </div>
      </div>`;

    $("#rdSpeak").onclick = () => { window.DQSND && window.DQSND.open(); speakText(t.text); };
    $("#rdSlow").onclick = () => speakText(t.text, true);
    $("#rdStop").onclick = () => { window.DQVoice && window.DQVoice.stop(); };
    $("#rdAnother").onclick = () => newText();
    bindWords(box);
    $$(".rd-q", box).forEach((qEl, i) => {
      $$(".rd-opt", qEl).forEach((b) => {
        b.onclick = () => {
          if (S.answered) return;
          $$(".rd-opt", qEl).forEach((x) => x.classList.remove("sel"));
          b.classList.add("sel");
          t.questions[i].picked = b.dataset.o;
          window.DQSND && window.DQSND.tap();
        };
      });
    });
    $("#rdCheck").onclick = check;
    renderWords();
  }

  function renderWords() {
    const box = $("#rdWords");
    if (!box || !S.current) return;
    const words = S.current.text
      .replace(/[.,!?„“":;()]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 5)
      .map((w) => w.replace(/[^A-Za-zÄÖÜäöüß-]/g, ""))
      .filter(Boolean);
    const uniq = [...new Set(words)].slice(0, 10);
    box.innerHTML = uniq.length
      ? `<span class="rd-words-label">Слова из текста (нажми — послушай):</span>` +
        uniq.map((w) => `<span class="chip static rd-word" data-w="${encodeURIComponent(w)}">${w}</span>`).join("")
      : "";
    bindWords(box);
  }

  function check() {
    if (S.answered || !S.current) return;
    S.answered = true;
    let correct = 0;
    S.current.questions.forEach((q, i) => {
      const qEl = $(`.rd-q[data-i="${i}"]`);
      const fb = $(".rd-fb", qEl);
      // выбранное берём из DOM: это надёжнее, чем полагаться на состояние
      const selEl = $(".rd-opt.sel", qEl);
      const picked = selEl ? selEl.dataset.o : q.picked;
      q.picked = picked;
      $$(".rd-opt", qEl).forEach((b) => {
        b.disabled = true;
        b.classList.remove("sel");
        if (b.dataset.o === q.answer) b.classList.add("correct");
        if (picked != null && b.dataset.o === picked && picked !== q.answer) b.classList.add("wrong");
      });
      const ok = picked != null && picked === q.answer;
      if (ok) correct++;
      fb.hidden = false;
      fb.className = "rd-fb " + (ok ? "ok" : "bad");
      fb.textContent = ok ? "Верно" : "Правильно: " + q.answer;
    });
    const pct = Math.round((correct / S.current.questions.length) * 100);
    if (window.DQSND) window.DQSND.play(pct >= 70 ? "success" : "lose");
    if (window.DQFX && pct >= 70) window.DQFX.confetti();
    window.SETTINGS && null;
    const note = pct === 100 ? "Отлично" : pct >= 70 ? "Хорошо" : "Перечитайте текст ещё раз";
    const head = $(".rd-q-card .stat-panel-head .muted");
    if (head) head.textContent = `${correct} из ${S.current.questions.length} · ${note}`;
    const btn = $("#rdCheck");
    if (btn) { btn.disabled = true; btn.textContent = "Проверено"; }
    if (window.DQ) window.DQ.applyStats(window.DQ.stats);
  }

  function newText(level) {
    if (level) S.level = level;
    S.current = generate(S.level);
    S.answered = false;
    render();
    window.DQSND && window.DQSND.open();
  }

  function init() {
    const box = $("#readingBox");
    if (!box) return;
    $$("#rdLevels button").forEach((b) => {
      b.onclick = () => {
        S.level = b.dataset.level;
        $$("#rdLevels button").forEach((x) => x.classList.toggle("active", x === b));
        window.DQSND && window.DQSND.switch();
        if (S.current) newText(S.level);
      };
    });
    const btn = $("#rdNew");
    if (btn) btn.onclick = () => newText();
    render();
  }

  return { init, newText, generate, render, get level() { return S.level; } };
})();