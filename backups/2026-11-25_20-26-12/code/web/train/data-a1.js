/* ============================================================
   Deutsch Quest — данные раздела «Тренировка», уровень A1.
   Основной уровень: Schreiben здесь самый объёмный.
   Ловушки: глагол на 2-м месте, модальный в конце, Perfekt,
   отделяемые приставки, zum/zur, den/dem, вопросы, отрицания.
   ============================================================ */
"use strict";

window.DQTrainData = window.DQTrainData || { levels: {} };

window.DQTrainData.levels.a1 = {
  /* ============================ Hören ============================ */
  hoeren: [
    { id: "a1-h1", say: "Ich fahre mit dem Bus zur Schule.", ru: "Я еду на автобусе в школу.", options: ["Я еду на автобусе в школу.", "Я иду в школу пешком.", "Я еду на поезде на работу."] },
    { id: "a1-h2", say: "Wir treffen uns um halb acht.", ru: "Мы встречаемся в полвосьмого.", options: ["Мы встречаемся в 7:30.", "Мы встречаемся в 8:30.", "Мы встречаемся в 6:30."] },
    { id: "a1-h3", say: "Kannst du mir bitte helfen?", ru: "Можешь мне помочь?", options: ["Можешь мне помочь?", "Можно взять твою ручку?", "Ты идёшь домой?"] },
    { id: "a1-h4", say: "Meine Schwester wohnt in München.", ru: "Моя сестра живёт в Мюнхене.", options: ["Моя сестра живёт в Мюнхене.", "Мой брат живёт в Гамбурге.", "Моя сестра учится в Мюнхене."] },
    { id: "a1-h5", say: "Der Zug hat zehn Minuten Verspätung.", ru: "Поезд опаздывает на десять минут.", options: ["Поезд опаздывает на 10 минут.", "Поезд приехал вовремя.", "Поезд отменили."] },
    { id: "a1-h6", say: "Ich habe keinen Führerschein.", ru: "У меня нет водительских прав.", options: ["У меня нет прав.", "У меня есть машина.", "У меня нет паспорта."] },
    { id: "a1-h7", say: "Wie viel kostet das Brot?", ru: "Сколько стоит хлеб?", options: ["Сколько стоит хлеб?", "Сколько хлеба нужно?", "Где хлеб?"] },
    { id: "a1-h8", say: "Heute bleibt die Praxis geschlossen.", ru: "Сегодня кабинет врача закрыт.", options: ["Кабинет врача сегодня закрыт.", "Кабинет работает сегодня.", "Врач приедет вечером."] },
    { id: "a1-h9", say: "Sie müssen das Formular unterschreiben.", ru: "Вам нужно подписать бланк.", options: ["Вам нужно подписать бланк.", "Вам нужно принести паспорт.", "Вам нужно позвонить."] },
    { id: "a1-h10", say: "Am Wochenende fahren wir ans Meer.", ru: "На выходных мы едем на море.", options: ["На выходных мы едем на море.", "На выходных мы остаёмся дома.", "В понедельник мы едем в горы."] },
    { id: "a1-h11", say: "Ich habe die Fahrkarte online gekauft.", ru: "Я купил(а) билет онлайн.", options: ["Я купил билет онлайн.", "Я забыл билет дома.", "Я потерял билет."] },
    { id: "a1-h12", say: "Bitte unterschreiben Sie hier unten.", ru: "Пожалуйста, подпишите здесь внизу.", options: ["Подпишите здесь внизу.", "Напишите ваш адрес сверху.", "Покажите ваш паспорт."] },
    { id: "a1-h13", say: "Wir haben einen Termin am Donnerstag.", ru: "У нас приём в четверг.", options: ["Приём в четверг.", "Приём во вторник.", "Приём отменили."] },
    { id: "a1-h14", say: "Die Wohnung liegt im dritten Stock.", ru: "Квартира находится на третьем этаже.", options: ["Квартира на 3-м этаже.", "Квартира на 1-м этаже.", "Квартира на улице."] },
    { id: "a1-h15", say: "Ich brauche eine Bescheinigung von der Arbeit.", ru: "Мне нужна справка с работы.", options: ["Мне нужна справка с работы.", "Мне нужен пропуск на работу.", "Мне нужна виза."] },
    { id: "a1-h16", say: "Entschuldigung, wo ist die nächste Apotheke?", ru: "Извините, где ближайшая аптека?", options: ["Где ближайшая аптека?", "Где ближайшая почта?", "Где остановка?"] },
  ],

  /* ============================ Wortschatz ============================ */
  wortschatz: [
    { id: "a1-w1", word: "der Fahrplan", ru: "расписание (транспорта)", options: ["расписание транспорта", "билет", "остановка"] },
    { id: "a1-w2", word: "die Anmeldung", ru: "прописка / регистрация", options: ["прописка, регистрация", "заявление", "подпись"] },
    { id: "a1-w3", word: "das Formular", ru: "бланк", options: ["бланк", "паспорт", "квитанция"] },
    { id: "a1-w4", word: "der Vermieter", ru: "арендодатель", options: ["арендодатель", "арендатор", "сосед"] },
    { id: "a1-w5", word: "die Krankenkasse", ru: "больничная касса", options: ["больничная касса", "аптека", "больница"] },
    { id: "a1-w6", word: "der Termin", ru: "приём / запись", options: ["запись на приём", "опоздание", "отпуск"] },
    { id: "a1-w7", word: "die Kasse", ru: "касса", options: ["касса", "полка", "тележка"] },
    { id: "a1-w8", word: "umsteigen", ru: "пересаживаться", options: ["пересаживаться", "выходить", "опаздывать"] },
    { id: "a1-w9", word: "die Miete", ru: "квартирная плата", options: ["квартирная плата", "залог", "счёт за свет"] },
    { id: "a1-w10", word: "der Ausweis", ru: "удостоверение / паспорт", options: ["удостоверение", "водительские права", "пропуск"] },
    { id: "a1-w11", word: "besuchen", ru: "навещать, посещать", options: ["навещать", "провожать", "записывать"] },
    { id: "a1-w12", word: "der Eingang", ru: "вход", options: ["вход", "выход", "лифт"] },
    { id: "a1-w13", word: "sich anmelden", ru: "регистрироваться, записываться", options: ["регистрироваться", "отменять", "оплачивать"] },
    { id: "a1-w14", word: "die Karte", ru: "карта / билет", options: ["карта, билет", "книжка", "купюра"] },
    { custom: "context", id: "a1-c1", sentence: "Ich gehe zur ___ , weil ich Medikamente brauche.", answer: "Apotheke", options: ["Apotheke", "Bäckerei", "Post"], hint: "Medikamente → Apotheke." },
    { custom: "context", id: "a1-c2", sentence: "Am ___ kaufe ich Brot und Milch.", answer: "Supermarkt", options: ["Supermarkt", "Bahnhof", "Krankenhaus"], hint: "Brot und Milch → Supermarkt." },
    { custom: "context", id: "a1-c3", sentence: "Der Bus fährt von der ___ ab.", answer: "Haltestelle", options: ["Haltestelle", "Küche", "Schule"], hint: "Где останавливается автобус — Haltestelle." },
    { custom: "context", id: "a1-c4", sentence: "Ich brauche ein ___ für meinen Termin.", answer: "Formular", options: ["Formular", "Fenster", "Foto"], hint: "Бланк для приёма — Formular." },
    { custom: "context", id: "a1-c5", sentence: "Mein ___ steht auf dem Klingelschild.", answer: "Name", options: ["Name", "Preis", "Tag"], hint: "На табличке у двери — имя." },
    { custom: "context", id: "a1-c6", sentence: "Ich zahle die ___ am Monatsanfang.", answer: "Miete", options: ["Miete", "Fahrkarte", "Zeitung"], hint: "Платим за квартиру — Miete." },
    { art: true, id: "a1-a1", word: "Fahrkarte", answer: "die", options: ["der", "die", "das"], ru: "билет" },
    { art: true, id: "a1-a2", word: "Termin", answer: "der", options: ["der", "die", "das"], ru: "приём" },
    { art: true, id: "a1-a3", word: "Formular", answer: "das", options: ["der", "die", "das"], ru: "бланк" },
    { art: true, id: "a1-a4", word: "Apotheke", answer: "die", options: ["der", "die", "das"], ru: "аптека" },
    { art: true, id: "a1-a5", word: "Bahnhof", answer: "der", options: ["der", "die", "das"], ru: "вокзал" },
    { art: true, id: "a1-a6", word: "Zimmer", answer: "das", options: ["der", "die", "das"], ru: "комната" },
    { art: true, id: "a1-a7", word: "Rechnung", answer: "die", options: ["der", "die", "das"], ru: "счёт" },
    { art: true, id: "a1-a8", word: "Ausweis", answer: "der", options: ["der", "die", "das"], ru: "удостоверение" },
    { art: true, id: "a1-a9", word: "Paket", answer: "das", options: ["der", "die", "das"], ru: "посылка" },
    { art: true, id: "a1-a10", word: "Haltestelle", answer: "die", options: ["der", "die", "das"], ru: "остановка" },
    { art: true, id: "a1-a11", word: "Arzt", answer: "der", options: ["der", "die", "das"], ru: "врач" },
    { art: true, id: "a1-a12", word: "Geld", answer: "das", options: ["der", "die", "das"], ru: "деньги" },
  ],

  /* ============================ Lesen ============================ */
  lesen: [
    {
      id: "a1-l1", title: "E-Mail an die Hausverwaltung",
      text: "Sehr geehrte Frau Meyer,\nseit Montag ist die Heizung in meiner Wohnung kaputt. Es ist sehr kalt. Können Sie bitte einen Handwerker schicken? Ich bin ab 17 Uhr zu Hause.\nMit freundlichen Grüßen\nIrina Weiss",
      questions: [
        { q: "Что сломано?", options: ["Отопление", "Кран", "Окно"], answer: "Отопление" },
        { q: "Когда автор дома?", options: ["С 17:00", "До 17:00", "Весь день"], answer: "С 17:00" },
        { q: "Кому письмо?", options: ["Управляющей домом", "Врачу", "Коллеге"], answer: "Управляющей домом" },
      ],
    },
    {
      id: "a1-l2", title: "Aushang im Haus",
      text: "Liebe Hausbewohner,\nam Samstag wird das Wasser von 9 bis 13 Uhr abgestellt. Bitte beachten Sie das.\nIhr Hausmeister",
      questions: [
        { q: "Что отключат в субботу?", options: ["Воду", "Свет", "Интернет"], answer: "Воду" },
        { q: "Во сколько всё вернётся?", options: ["В 13:00", "В 12:00", "В 9:00"], answer: "В 13:00" },
      ],
    },
    {
      id: "a1-l3", title: "SMS von Katja",
      text: "Hallo! Ich komme heute etwas später, mein Bus fährt erst um 18:20. Warten bitte nicht, ich bestelle schon mal. Bis gleich!",
      questions: [
        { q: "Почему Катя опаздывает?", options: ["Автобус позже", "Она болеет", "У неё встреча"], answer: "Автобус позже" },
        { q: "Что просит Катя?", options: ["Не ждать её", "Купить билеты", "Позвонить ей"], answer: "Не ждать её" },
      ],
    },
    {
      id: "a1-l4", title: "Arztpraxis: Öffnungszeiten",
      text: "Praxis Dr. Schulz\nMontag–Freitag: 8–12 und 15–18 Uhr\nMittwoch: nur Vormittag\nTermine auch online: www.praxis-schulz.de",
      questions: [
        { q: "В среду когда работают?", options: ["Только утром", "Весь день", "Только вечером"], answer: "Только утром" },
        { q: "Как можно записаться?", options: ["Онлайн или на приёме", "Только по телефону", "Только лично"], answer: "Онлайн или на приёме" },
      ],
    },
    {
      id: "a1-l5", title: "Im Kindergarten",
      text: "Liebe Eltern,\nam Freitag machen wir einen Ausflug in den Zoo. Bitte geben Sie Ihrem Kind ein Brot und Wasser mit. Der Bus fährt um 8:30 ab.",
      questions: [
        { q: "Куда идут дети?", options: ["В зоопарк", "В музей", "В парк"], answer: "В зоопарк" },
        { q: "Что взять с собой?", options: ["Бутерброд и воду", "Тёплую куртку", "Игрушку"], answer: "Бутерброд и воду" },
      ],
    },
    {
      id: "a1-l6", title: "Angebot im Supermarkt",
      text: "Diese Woche im Angebot:\nMilch 1 L – 0,99 €\nBrot – 1,79 €\nÄpfel 1 kg – 2,49 €\nAn der Kasse: mit Kundenkarte 10 % Rabatt am Dienstag.",
      questions: [
        { q: "Сколько стоит молоко?", options: ["0,99 €", "1,79 €", "2,49 €"], answer: "0,99 €" },
        { q: "Когда скидка по карте?", options: ["Во вторник", "В среду", "В субботу"], answer: "Во вторник" },
      ],
    },
    {
      id: "a1-l7", title: "Mietanzeige",
      text: "1-Zimmer-Wohnung, 28 m², Möbliert, ab sofort. Miete: 450 € + Strom. Kontakt: Herr Braun, 0176 556677. Keine Tiere.",
      questions: [
        { q: "Сколько стоит квартира?", options: ["450 €", "280 €", "100 €"], answer: "450 €" },
        { q: "Что нужно оплачивать отдельно?", options: ["Электричество", "Воду", "Интернет"], answer: "Электричество" },
        { q: "Животные разрешены?", options: ["Нет", "Да", "Только кошки"], answer: "Нет" },
      ],
    },
  ],

  /* ============================ Schreiben (приоритет) ============================ */
  schreiben: [
    /* --- порядок слов: глагол на 2-м месте --- */
    { id: "a1-s1", type: "words", ru: "Я хожу в школу каждый день.", answer: "Ich gehe jeden Tag in die Schule.", words: ["gehe", "jeden", "Ich", "Tag", "in", "die", "Schule."], hint: "Глагол gehe — 2-м; обстоятельство времени может идти сразу после него." },
    { id: "a1-s2", type: "words", ru: "Сегодня я не работаю.", answer: "Heute arbeite ich nicht.", words: ["arbeite", "Heute", "nicht.", "ich"], hint: "Предложение начинается с Heute — глагол всё равно 2-м: Heute (1) arbeite (2) ich nicht." },
    { id: "a1-s3", type: "words", ru: "Мой брат живёт в Гамбурге.", answer: "Mein Bruder wohnt in Hamburg.", words: ["wohnt", "Mein", "Bruder", "in", "Hamburg."], hint: "Обычный порядок: подлежащее + глагол + остальное." },
    { id: "a1-s4", type: "words", ru: "В субботу мы идём в кино.", answer: "Am Samstag gehen wir ins Kino.", words: ["gehen", "Am", "Samstag", "wir", "ins", "Kino."], hint: "Am Samstag = 1-е место → глагол на 2-м → подлежащее wir после глагола (инверсия)." },
    /* --- модальные глаголы --- */
    { id: "a1-s5", type: "words", ru: "Я должен сегодня учиться.", answer: "Ich muss heute lernen.", words: ["muss", "heute", "Ich", "lernen."], hint: "Модальный muss — 2-м, инфинитив lernen уходит в конец." },
    { id: "a1-s6", type: "words", ru: "Можешь дать мне билет?", answer: "Kannst du mir die Fahrkarte geben?", words: ["geben?", "Kannst", "du", "mir", "die", "Fahrkarte"], hint: "Kannst (1) du (2) mir die Fahrkarte geben? — инфинитив в конце." },
    { id: "a1-s7", type: "words", ru: "Мы хотим завтра сходить в музей.", answer: "Wir wollen morgen ins Museum gehen.", words: ["wollen", "morgen", "Wir", "ins", "Museum", "gehen."], hint: "wollen — 2-м, gehen — в конце. ins Museum = in + das Museum (Akkusativ)." },
    { id: "a1-s8", type: "words", ru: "Я не могу прийти сегодня.", answer: "Ich kann heute nicht kommen.", words: ["kann", "heute", "nicht", "Ich", "kommen."], hint: "nicht — после обстоятельства времени, kommen — в конце." },
    { id: "a1-s9", type: "words", ru: "Тебе нельзя курить здесь.", answer: "Du darfst hier nicht rauchen.", words: ["darfst", "hier", "nicht", "Du", "rauchen."], hint: "dürfen = «можно/нельзя». Инфинитив rauchen в конце." },
    /* --- Perfekt --- */
    { id: "a1-s10", type: "words", ru: "Я купил(а) новый телефон.", answer: "Ich habe ein neues Handy gekauft.", words: ["habe", "ein", "neues", "Handy", "gekauft.", "Ich"], hint: "Perfekt: habe (2-м) + gekauft (в конце)." },
    { id: "a1-s11", type: "words", ru: "Мы вчера были в магазине.", answer: "Wir waren gestern im Supermarkt.", words: ["waren", "gestern", "im", "Supermarkt.", "Wir"], hint: "Прошедшее время sein: waren. im Supermarkt = in + dem (Dativ)." },
    { id: "a1-s12", type: "words", ru: "Она ездила на поезде.", answer: "Sie ist mit dem Zug gefahren.", words: ["ist", "mit", "dem", "Zug", "gefahren.", "Sie"], hint: "fahren с sein: ist … gefahren." },
    /* --- отделяемые приставки --- */
    { id: "a1-s13", type: "words", ru: "Я встаю в семь часов.", answer: "Ich stehe um sieben Uhr auf.", words: ["stehe", "um", "sieben", "Ich", "Uhr", "auf."], hint: "aufstehen: приставка auf- стоит в конце." },
    { id: "a1-s14", type: "words", ru: "Поезд прибывает в 8:15.", answer: "Der Zug kommt um acht Uhr fünfzehn an.", words: ["kommt", "um", "acht", "Der", "Zug", "Uhr", "fünfzehn", "an."], hint: "ankommen: an- отделяется и идёт в конец." },
    { id: "a1-s15", type: "words", ru: "Я вечером звоню маме.", answer: "Am Abend rufe ich meine Mutter an.", words: ["rufe", "meine", "Mutter", "Am", "Abend", "ich", "an."], hint: "anrufen: an- в конце; после Am Abend — инверсия (rufe ich)." },
    /* --- zum / zur --- */
    { id: "a1-s16", type: "words", ru: "Я иду к врачу.", answer: "Ich gehe zum Arzt.", words: ["gehe", "zum", "Ich", "Arzt."], hint: "zu + dem (м.р.) = zum: der Arzt → zum Arzt." },
    { id: "a1-s17", type: "words", ru: "Она едет к бабушке.", answer: "Sie fährt zur Oma.", words: ["fährt", "zur", "Sie", "Oma."], hint: "zu + der (ж.р.) = zur: die Oma → zur Oma." },
    { id: "a1-s18", type: "words", ru: "Мы идём к аптеке.", answer: "Wir gehen zur Apotheke.", words: ["gehen", "zur", "Wir", "Apotheke."], hint: "die Apotheke → zur (zu + der)." },
    { id: "a1-s19", type: "words", ru: "Он идёт к вокзалу.", answer: "Er geht zum Bahnhof.", words: ["geht", "zum", "Er", "Bahnhof."], hint: "der Bahnhof → zum (zu + dem)." },
    /* --- den / dem --- */
    { id: "a1-s20", type: "words", ru: "Я вижу мальчика.", answer: "Ich sehe den Jungen.", words: ["sehe", "den", "Ich", "Jungen."], hint: "sehen + Akkusativ: der Junge → den Jungen." },
    { id: "a1-s21", type: "words", ru: "Я помогаю отцу.", answer: "Ich helfe dem Vater.", words: ["helfe", "dem", "Ich", "Vater."], hint: "helfen + Dativ: der Vater → dem Vater." },
    { id: "a1-s22", type: "words", ru: "Дай мне, пожалуйста, ручку.", answer: "Gib mir bitte den Stift.", words: ["Gib", "mir", "bitte", "den", "Stift."], hint: "gib mir — Dativ; предмет — Akkusativ: der Stift → den Stift." },
    { id: "a1-s23", type: "words", ru: "Я дарю сестре сумку.", answer: "Ich schenke meiner Schwester eine Tasche.", words: ["schenke", "meiner", "Schwester", "eine", "Tasche.", "Ich"], hint: "schenken: кому (Dativ) + что (Akkusativ). die Schwester → meiner Schwester." },
    /* --- вопросы --- */
    { id: "a1-s24", type: "words", ru: "Откуда ты?", answer: "Woher kommst du?", words: ["kommst", "Woher", "du?"], hint: "W-вопрос: слово (1) — глагол (2) — подлежащее (3)." },
    { id: "a1-s25", type: "words", ru: "Ты идёшь сегодня в магазин?", answer: "Gehst du heute in den Supermarkt?", words: ["Gehst", "du", "heute", "in", "den", "Supermarkt?"], hint: "Да/нет-вопрос начинается с глагола; in + Akkusativ → in den Supermarkt." },
    { id: "a1-s26", type: "words", ru: "Когда начинается фильм?", answer: "Wann beginnt der Film?", words: ["beginnt", "Wann", "der", "Film?"], hint: "Wann (1) → beginnt (2) → der Film." },
    { id: "a1-s27", type: "words", ru: "Что ты ешь на завтрак?", answer: "Was isst du zum Frühstück?", words: ["isst", "Was", "du", "zum", "Frühstück?"], hint: "zum Frühstück — устойчивое (zu + dem)." },
    /* --- отрицания --- */
    { id: "a1-s28", type: "words", ru: "У меня нет времени.", answer: "Ich habe keine Zeit.", words: ["habe", "keine", "Ich", "Zeit."], hint: "die Zeit → keine Zeit (kein с ж.р. = keine)." },
    { id: "a1-s29", type: "words", ru: "Это не мой дом.", answer: "Das ist nicht mein Haus.", words: ["nicht", "ist", "Das", "mein", "Haus."], hint: "nicht — после глагола ist." },
    { id: "a1-s30", type: "words", ru: "Я не говорю по-немецки.", answer: "Ich spreche nicht Deutsch.", words: ["spreche", "nicht", "Ich", "Deutsch."], hint: "Языки без артикля: spreche nicht Deutsch." },
    /* --- императив и вежливость --- */
    { id: "a1-s31", type: "words", ru: "Я хотел(а) бы кофе, пожалуйста.", answer: "Ich möchte bitte einen Kaffee.", words: ["möchte", "bitte", "Ich", "einen", "Kaffee."], hint: "möchte — вежливое «хотел бы»; einen Kaffee в Akkusativ." },
    { id: "a1-s32", type: "words", ru: "Открой, пожалуйста, окно!", answer: "Öffne bitte das Fenster!", words: ["Öffne", "bitte", "das", "Fenster!"], hint: "Императив: основа глагола + -e: öffnen → Öffne!" },
    /* --- перевод (ввод) --- */
    { id: "a1-t1", type: "write", ru: "Я живу в Берлине уже год.", answers: ["Ich wohne seit einem Jahr in Berlin.", "Seit einem Jahr wohne ich in Berlin."], hint: "seit + Dativ: seit einem Jahr. Глагол в обеих версиях — 2-м." },
    { id: "a1-t2", type: "write", ru: "Мне нужна помощь.", answers: ["Ich brauche Hilfe.", "Ich brauche eine Hilfe."], hint: "brauchen + Akkusativ; Hilfe обычно без артикля." },
    { id: "a1-t3", type: "write", ru: "Сколько это стоит?", answers: ["Wie viel kostet das?", "Was kostet das?"], hint: "Wie viel / Was + kostet + das." },
    { id: "a1-t4", type: "write", ru: "Я должен подписать бланк.", answers: ["Ich muss das Formular unterschreiben."], hint: "muss (2-м) + unterschreiben (в конце)." },
    { id: "a1-t5", type: "write", ru: "Где ближайшая аптека?", answers: ["Wo ist die nächste Apotheke?"], hint: "Wo ist …; nächste перед die Apotheke." },
    { id: "a1-t6", type: "write", ru: "У меня есть приём к врачу завтра.", answers: ["Ich habe morgen einen Termin beim Arzt."], hint: "einen Termin (Akkusativ); beim Arzt = bei + dem Arzt." },
    { id: "a1-t7", type: "write", ru: "Я еду на работу на поезде.", answers: ["Ich fahre mit dem Zug zur Arbeit.", "Mit dem Zug fahre ich zur Arbeit."], hint: "mit + Dativ (mit dem Zug); zur Arbeit = zu + der Arbeit." },
    { id: "a1-t8", type: "write", ru: "Мы встречаемся в 18:00 у вокзала.", answers: ["Wir treffen uns um 18 Uhr am Bahnhof."], hint: "um 18 Uhr; am Bahnhof = an + dem Bahnhof." },
    { id: "a1-t9", type: "write", ru: "Можно заплатить картой?", answers: ["Kann ich mit Karte zahlen?"], hint: "Kann ich … zahlen? mit Karte — Dativ." },
    { id: "a1-t10", type: "write", ru: "Он приходит домой поздно.", answers: ["Er kommt spät nach Hause.", "Spät kommt er nach Hause."], hint: "nach Hause — устойчиво «домой»." },
    { id: "a1-t11", type: "write", ru: "Я потерял(а) ключ.", answers: ["Ich habe den Schlüssel verloren."], hint: "Perfekt: habe … verloren; den Schlüssel в Akkusativ." },
    { id: "a1-t12", type: "write", ru: "Пожалуйста, говорите медленнее.", answers: ["Sprechen Sie bitte langsamer.", "Bitte sprechen Sie langsamer."], hint: "Вежливо на «вы»: Sprechen Sie bitte langsamer." },
  ],
};
