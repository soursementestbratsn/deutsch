/* ============================================================
   Deutsch Quest — данные раздела «Тренировка», уровень A2.
   Schreiben: Nebensätze, Perfekt, Dativ/Akkusativ, zu + Infinitiv,
   weil/deshalb/denn, отделяемые приставки, Konnektoren.
   ============================================================ */
"use strict";

window.DQTrainData = window.DQTrainData || { levels: {} };

window.DQTrainData.levels.a2 = {
  /* ============================ Hören ============================ */
  hoeren: [
    { id: "a2-h1", say: "Ich habe den Termin leider verpasst.", ru: "К сожалению, я пропустил(а) приём.", options: ["К сожалению, я пропустил приём.", "К сожалению, я опоздал на поезд.", "К сожалению, приём отменили."] },
    { id: "a2-h2", say: "Könnten Sie das bitte wiederholen?", ru: "Не могли бы вы это повторить?", options: ["Не могли бы вы повторить?", "Не могли бы вы говорить тише?", "Не могли бы вы подождать?"] },
    { id: "a2-h3", say: "Der Antrag muss bis Freitag eingereicht werden.", ru: "Заявление нужно подать до пятницы.", options: ["Заявление подать до пятницы.", "Заявление уже принято.", "Заявление можно сдать позже."] },
    { id: "a2-h4", say: "Ich würde lieber mit dem Zug fahren.", ru: "Я бы лучше поехал(а) на поезде.", options: ["Я бы поехал на поезде.", "Я поеду на машине.", "Я не хочу ехать."] },
    { id: "a2-h5", say: "Das Paket ist bei der Nachbarin abgegeben worden.", ru: "Посылку оставили у соседки.", options: ["Посылку отдали соседке.", "Посылку вернули отправителю.", "Посылка потерялась."] },
    { id: "a2-h6", say: "Meine Kollegin ist krank, deshalb komme ich später.", ru: "Моя коллега заболела, поэтому я приду позже.", options: ["Я приду позже — коллега болеет.", "Коллега придёт позже.", "Я сегодня не приду."] },
    { id: "a2-h7", say: "Die Anmeldung ist nur mit Ausweis gültig.", ru: "Регистрация действительна только с документом.", options: ["Нужен документ, удостоверяющий личность.", "Нужна фотография.", "Нужна оплата наличными."] },
    { id: "a2-h8", say: "Sie sollten sich beim Bürgeramt anmelden.", ru: "Вам следует зарегистрироваться в бюргерамте.", options: ["Нужно оформиться в бюро прописки.", "Нужно получить визу.", "Нужно заплатить налоги."] },
    { id: "a2-h9", say: "Die Zahlung ist bis zum Fünften fällig.", ru: "Оплата должна быть произведена до 5-го числа.", options: ["Заплатить до 5-го.", "Заплатить в конце месяца.", "Оплата не нужна."] },
    { id: "a2-h10", say: "Wir haben die Prüfung alle bestanden.", ru: "Мы все сдали экзамен.", options: ["Все сдали экзамен.", "Экзамен отменили.", "Никто не сдал."] },
    { id: "a2-h11", say: "Sie dürfen hier nicht parken.", ru: "Здесь нельзя парковаться.", options: ["Парковка запрещена.", "Парковка бесплатная.", "Парковка в другом месте."] },
    { id: "a2-h12", say: "Ich habe mich um die Stelle beworben.", ru: "Я подал(а) заявку на эту вакансию.", options: ["Я подал заявку на вакансию.", "Я получил должность.", "Я отозвал заявку."] },
  ],

  /* ============================ Wortschatz ============================ */
  wortschatz: [
    { id: "a2-w1", word: "die Verspätung", ru: "опоздание (транспорта)", options: ["опоздание", "пересадка", "задержка рейса (авиа)"] },
    { id: "a2-w2", word: "der Antrag", ru: "заявление", options: ["заявление", "справка", "договор"] },
    { id: "a2-w3", word: "die Bescheinigung", ru: "справка", options: ["справка", "квитанция", "прописка"] },
    { id: "a2-w4", word: "die Kaution", ru: "залог (за квартиру)", options: ["залог", "аренда", "коммунальные"] },
    { id: "a2-w5", word: "der Lebenslauf", ru: "резюме", options: ["резюме", "собеседование", "диплом"] },
    { id: "a2-w6", word: "die Nebenkosten", ru: "коммунальные расходы", options: ["коммунальные расходы", "квартплата", "гарантийный взнос"] },
    { id: "a2-w7", word: "die Mahnung", ru: "напоминание об оплате", options: ["напоминание об оплате", "чек", "скидка"] },
    { id: "a2-w8", word: "die Bewerbung", ru: "заявка на работу", options: ["заявка на работу", "повышение", "отпуск"] },
    { id: "a2-w9", word: "die Sprechstunde", ru: "часы приёма", options: ["часы приёма", "обеденный перерыв", "дежурство"] },
    { id: "a2-w10", word: "die Quittung", ru: "квитанция", options: ["квитанция", "скидочная карта", "договор"] },
    { id: "a2-w11", word: "die Frist", ru: "срок", options: ["срок", "цена", "правило"] },
    { id: "a2-w12", word: "sich beschweren", ru: "жаловаться", options: ["жаловаться", "извиняться", "благодарить"] },
    { id: "a2-w13", word: "die Vereinbarung", ru: "договорённость", options: ["договорённость", "разногласие", "извещение"] },
    { id: "a2-w14", word: "die Umbauarbeiten", ru: "ремонтные работы", options: ["ремонтные работы", "переезд", "стройка"] },
    { custom: "context", id: "a2-c1", sentence: "Ich kann den Termin nicht einhalten, ich muss ihn ___ .", answer: "absagen", options: ["absagen", "bezahlen", "bestellen"], hint: "Отменить приём — absagen." },
    { custom: "context", id: "a2-c2", sentence: "Die Wohnung hat eine Küche, ein Bad und zwei ___ .", answer: "Zimmer", options: ["Zimmer", "Schulden", "Straßen"], hint: "Комнаты — Zimmer." },
    { custom: "context", id: "a2-c3", sentence: "Für die Bewerbung brauche ich einen ___ .", answer: "Lebenslauf", options: ["Lebenslauf", "Fahrplan", "Ausweis"], hint: "Резюме — Lebenslauf." },
    { custom: "context", id: "a2-c4", sentence: "Die Flasche ist leer, ich werfe sie in den ___ .", answer: "Müll", options: ["Müll", "Garten", "Kühlschrank"], hint: "Мусор — Müll." },
    { art: true, id: "a2-a1", word: "Antrag", answer: "der", options: ["der", "die", "das"], ru: "заявление" },
    { art: true, id: "a2-a2", word: "Versicherung", answer: "die", options: ["der", "die", "das"], ru: "страховка" },
    { art: true, id: "a2-a3", word: "Zeugnis", answer: "das", options: ["der", "die", "das"], ru: "аттестат/справка" },
    { art: true, id: "a2-a4", word: "Vertrag", answer: "der", options: ["der", "die", "das"], ru: "договор" },
    { art: true, id: "a2-a5", word: "Kündigung", answer: "die", options: ["der", "die", "das"], ru: "расторжение" },
    { art: true, id: "a2-a6", word: "Konto", answer: "das", options: ["der", "die", "das"], ru: "счёт в банке" },
    { art: true, id: "a2-a7", word: "Bewerbung", answer: "die", options: ["der", "die", "das"], ru: "заявка" },
    { art: true, id: "a2-a8", word: "Visum", answer: "das", options: ["der", "die", "das"], ru: "виза" },
    { art: true, id: "a2-a9", word: "Termin", answer: "der", options: ["der", "die", "das"], ru: "приём" },
    { art: true, id: "a2-a10", word: "Frist", answer: "die", options: ["der", "die", "das"], ru: "срок" },
  ],

  /* ============================ Lesen ============================ */
  lesen: [
    {
      id: "a2-l1", title: "Wohnungsanzeige",
      text: "2-Zimmer-Wohnung, 54 m², 3. OG, Balkon, ab 1. März frei. Miete 690 € kalt + 180 € Nebenkosten. Kaution: 2 Monatsmieten. Keine Haustiere. Kontakt: Frau Lang, Tel. 0176 223344.",
      questions: [
        { q: "Сколько всего в месяц без залога?", options: ["870 €", "690 €", "180 €"], answer: "870 €" },
        { q: "Что запрещено?", options: ["Домашние животные", "Курение на балконе", "Субаренда"], answer: "Домашние животные" },
        { q: "Какой залог?", options: ["Две месячные платы", "Одна плата", "180 €"], answer: "Две месячные платы" },
      ],
    },
    {
      id: "a2-l2", title: "Terminabsage",
      text: "Sehr geehrte Damen und Herren,\nleider muss ich meinen Termin am Mittwoch, 14. März, um 10 Uhr absagen. Ich bin krank. Ich möchte einen neuen Termin vereinbaren, am besten nächste Woche. Vielen Dank.\nA. Nowak",
      questions: [
        { q: "Почему отменяют приём?", options: ["Болезнь", "Отпуск", "Деловая поездка"], answer: "Болезнь" },
        { q: "Когда хотят новый приём?", options: ["На следующей неделе", "В пятницу", "Через месяц"], answer: "На следующей неделе" },
      ],
    },
    {
      id: "a2-l3", title: "Im Jobcenter",
      text: "Hinweis: Anträge müssen vollständig sein. Fehlende Nachweise führen zu einer Bearbeitungszeit von bis zu vier Wochen. Bitte bringen Sie Ihren Ausweis und Ihre letzte Mietquittung mit.",
      questions: [
        { q: "Что будет при неполных документах?", options: ["Задержка до 4 недель", "Отказ сразу", "Штраф"], answer: "Задержка до 4 недель" },
        { q: "Что взять с собой?", options: ["Удостоверение и квитанцию об аренде", "Только паспорт", "Справку от врача"], answer: "Удостоверение и квитанцию об аренде" },
      ],
    },
    {
      id: "a2-l4", title: "Paketbenachrichtigung",
      text: "Ihr Paket konnte nicht zugestellt werden. Sie können es ab Montag in der Filiale in der Hauptstraße 12 abholen. Bitte bringen Sie diesen Benachrichtigungsschein und Ihren Ausweis mit. Öffnungszeiten: Mo–Fr 8–18 Uhr.",
      questions: [
        { q: "Где забрать посылку?", options: ["В отделении на Hauptstraße 12", "У соседа", "В почтовом ящике"], answer: "В отделении на Hauptstraße 12" },
        { q: "До скольки работает отделение?", options: ["До 18:00", "До 20:00", "До 16:00"], answer: "До 18:00" },
      ],
    },
    {
      id: "a2-l5", title: "Verkehrsmeldung",
      text: "Wegen Bauarbeiten fährt die Straßenbahn Linie 4 bis Ende Mai nur bis zur Haltestelle Marktplatz. Ab dort fahren Ersatzbusse alle zehn Minuten Richtung Hauptbahnhof.",
      questions: [
        { q: "Почему изменили маршрут?", options: ["Ремонтные работы", "Авария", "Праздник"], answer: "Ремонтные работы" },
        { q: "Как ехать дальше?", options: ["Автобусом-заменителем", "На такси", "Пешком до вокзала"], answer: "Автобусом-заменителем" },
      ],
    },
    {
      id: "a2-l6", title: "Elternbrief",
      text: "Sehr geehrte Eltern,\nwegen einer Fortbildung endet der Unterricht am Donnerstag bereits um 11:30 Uhr. Die Betreuung im Hort ist wie gewohnt bis 16 Uhr geöffnet. Wir bitten um Verständnis.\nDie Schulleitung",
      questions: [
        { q: "Когда заканчиваются уроки в четверг?", options: ["В 11:30", "В 13:30", "В 16:00"], answer: "В 11:30" },
        { q: "Почему?", options: ["Повышение квалификации учителей", "Праздник", "Каникулы"], answer: "Повышение квалификации учителей" },
      ],
    },
  ],

  /* ============================ Schreiben (приоритет) ============================ */
  schreiben: [
    /* --- weil / deshalb / denn --- */
    { id: "a2-s1", type: "words", ru: "Я остаюсь дома, потому что я болен.", answer: "Ich bleibe zu Hause, weil ich krank bin.", words: ["bleibe", "zu", "Hause,", "weil", "ich", "krank", "bin.", "Ich"], hint: "После weil глагол уходит В КОНЕЦ: weil ich krank bin." },
    { id: "a2-s2", type: "words", ru: "Она не пришла, потому что автобус опоздал.", answer: "Sie ist nicht gekommen, weil der Bus Verspätung hatte.", words: ["ist", "nicht", "gekommen,", "weil", "der", "Bus", "Verspätung", "hatte.", "Sie"], hint: "Perfekt: ist … gekommen; в придаточном с weil глагол hatte — в самом конце." },
    { id: "a2-s3", type: "words", ru: "Я устал(а), поэтому иду спать.", answer: "Ich bin müde, deshalb gehe ich schlafen.", words: ["bin", "müde,", "deshalb", "gehe", "ich", "schlafen.", "Ich"], hint: "deshalb — наречие, после него ГЛАГОЛ 2-м: deshalb (1) gehe (2) ich…" },
    { id: "a2-s4", type: "words", ru: "Она учит немецкий, потому что хочет работать в Германии.", answer: "Sie lernt Deutsch, denn sie will in Deutschland arbeiten.", words: ["lernt", "Deutsch,", "denn", "sie", "will", "in", "Deutschland", "arbeiten.", "Sie"], hint: "denn — сочинительный союз: порядок слов прямой (sie will … arbeiten)." },
    /* --- Perfekt --- */
    { id: "a2-s5", type: "words", ru: "Вчера я купил(а) новую куртку.", answer: "Gestern habe ich eine neue Jacke gekauft.", words: ["habe", "ich", "eine", "neue", "Jacke", "gekauft.", "Gestern"], hint: "Perfekt: habe (2-м) + gekauft (в конце)." },
    { id: "a2-s6", type: "words", ru: "Мы ехали на поезде два часа.", answer: "Wir sind zwei Stunden mit dem Zug gefahren.", words: ["sind", "zwei", "Stunden", "mit", "dem", "Zug", "gefahren.", "Wir"], hint: "fahren с sein: sind … gefahren; mit dem Zug — Dativ." },
    { id: "a2-s7", type: "words", ru: "Он забыл мой адрес.", answer: "Er hat meine Adresse vergessen.", words: ["hat", "meine", "Adresse", "vergessen.", "Er"], hint: "vergessen + Akkusativ: meine Adresse." },
    /* --- zu + Infinitiv --- */
    { id: "a2-s8", type: "words", ru: "Я забыл(а) позвонить.", answer: "Ich habe vergessen anzurufen.", words: ["habe", "vergessen", "anzurufen.", "Ich"], hint: "При отделяемой приставке zu встаёт внутрь: an + zu + rufen." },
    { id: "a2-s9", type: "words", ru: "У меня нет времени готовить.", answer: "Ich habe keine Zeit zu kochen.", words: ["habe", "keine", "Zeit", "zu", "kochen.", "Ich"], hint: "keine Zeit (kein + Akkusativ) + zu + инфинитив." },
    { id: "a2-s10", type: "words", ru: "Трудно понять этот фильм.", answer: "Es ist schwer, diesen Film zu verstehen.", words: ["Es", "ist", "schwer,", "diesen", "Film", "zu", "verstehen."], hint: "es ist schwer + zu + инфинитив; diesen Film — Akkusativ." },
    /* --- Dativ / Akkusativ --- */
    { id: "a2-s11", type: "words", ru: "Я помогаю своему соседу с переездом.", answer: "Ich helfe meinem Nachbarn beim Umzug.", words: ["helfe", "meinem", "Nachbarn", "beim", "Umzug.", "Ich"], hint: "helfen + Dativ: der Nachbar → meinem Nachbarn; beim = bei + dem." },
    { id: "a2-s12", type: "words", ru: " Она объясняет ученикам грамматику.", answer: "Sie erklärt den Schülern die Grammatik.", words: ["erklärt", "den", "Schülern", "die", "Grammatik.", "Sie"], hint: "erklären: кому (Dativ) + что (Akkusativ)." },
    { id: "a2-s13", type: "words", ru: "Мы едем в отпуск на море.", answer: "Wir fahren an die Ostsee in den Urlaub.", words: ["fahren", "an", "die", "Ostsee", "in", "den", "Urlaub.", "Wir"], hint: "Направление → Akkusativ: an die Ostsee, in den Urlaub." },
    { id: "a2-s14", type: "words", ru: "Я дарю маме книгу.", answer: "Ich schenke meiner Mutter ein Buch.", words: ["schenke", "meiner", "Mutter", "ein", "Buch.", "Ich"], hint: "die Mutter → meiner Mutter (Dativ), das Buch → ein Buch (Akkusativ)." },
    /* --- отделяемые приставки --- */
    { id: "a2-s15", type: "words", ru: "Пожалуйста, выключи свет!", answer: "Mach bitte das Licht aus!", words: ["Mach", "bitte", "das", "Licht", "aus!"], hint: "ausmachen: приставка aus- уходит в конец." },
    { id: "a2-s16", type: "words", ru: "Я записываю новые слова в тетрадь.", answer: "Ich schreibe neue Wörter ins Heft auf.", words: ["schreibe", "neue", "Wörter", "ins", "Heft", "auf.", "Ich"], hint: "aufschreiben: auf- в конце; ins Heft = in + das Heft." },
    /* --- вопросы --- */
    { id: "a2-s17", type: "words", ru: "С кем ты идёшь на вечеринку?", answer: "Mit wem gehst du zur Party?", words: ["Mit", "wem", "gehst", "du", "zur", "Party?"], hint: "mit + Dativ → вопрос к Dativ: Mit wem?" },
    { id: "a2-s18", type: "words", ru: "О чём ты говоришь?", answer: "Wovon sprichst du?", words: ["Wovon", "sprichst", "du?"], hint: "sprechen von → Wovon (о чём)." },
    { id: "a2-s19", type: "words", ru: "Почему ты не пришёл?", answer: "Warum bist du nicht gekommen?", words: ["Warum", "bist", "du", "nicht", "gekommen?"], hint: "W-вопрос: Warum (1) bist (2) du …" },
    /* --- отрицания --- */
    { id: "a2-s20", type: "words", ru: "Суббота — не мой свободный день.", answer: "Der Samstag ist kein freier Tag.", words: ["ist", "kein", "freier", "Tag.", "Der", "Samstag"], hint: "der Samstag → kein; прилагательное без артикля: freier Tag." },
    { id: "a2-s21", type: "words", ru: "Я ещё ничего не нашёл.", answer: "Ich habe noch nichts gefunden.", words: ["habe", "noch", "nichts", "gefunden.", "Ich"], hint: "Perfekt: habe … gefunden; nichts — «ничего»." },
    /* --- перевод (ввод) --- */
    { id: "a2-t1", type: "write", ru: "Не могли бы вы мне помочь?", answers: ["Könnten Sie mir helfen?", "Könnten Sie mir bitte helfen?"], hint: "Вежливо: Könnten Sie … helfen? (инфинитив в конце)." },
    { id: "a2-t2", type: "write", ru: "Я хотел(а) бы записаться к врачу.", answers: ["Ich möchte einen Termin beim Arzt machen.", "Ich möchte mich beim Arzt anmelden."], hint: "einen Termin (Akkusativ); beim Arzt = bei + dem Arzt." },
    { id: "a2-t3", type: "write", ru: "Мне нужно подать заявление до конца месяца.", answers: ["Ich muss den Antrag bis Ende des Monats einreichen."], hint: "muss … einreichen (в конце); bis Ende des Monats — Genitiv." },
    { id: "a2-t4", type: "write", ru: "Мой поезд отменили, поэтому я опоздал(а).", answers: ["Mein Zug ist ausgefallen, deshalb bin ich zu spät gekommen."], hint: "ausfallen → ist ausgefallen; после deshalb инверсия." },
    { id: "a2-t5", type: "write", ru: "Он сказал, что приедет завтра.", answers: ["Er hat gesagt, dass er morgen kommt."], hint: "dass-придаточное: глагол в конце (kommt)." },
    { id: "a2-t6", type: "write", ru: "Я не уверен(а), открыт ли магазин в воскресенье.", answers: ["Ich bin nicht sicher, ob der Supermarkt am Sonntag geöffnet ist."], hint: "ob-придаточное: глагол в конце (ist)." },
    { id: "a2-t7", type: "write", ru: "Мы должны экономить электричество.", answers: ["Wir müssen Strom sparen."], hint: "müssen + инфинитив в конце; Strom без артикля." },
    { id: "a2-t8", type: "write", ru: "Я жду ответа с прошлой недели.", answers: ["Ich warte seit letzter Woche auf eine Antwort."], hint: "warten auf + Akkusativ; seit + Dativ (seit letzter Woche)." },
    { id: "a2-t9", type: "write", ru: "Вчера я забыл(а) ключи дома.", answers: ["Gestern habe ich die Schlüssel zu Hause vergessen."], hint: "Perfekt: habe … vergessen; zu Hause — «дома»." },
    { id: "a2-t10", type: "write", ru: "Если погода хорошая, мы гуляем.", answers: ["Wenn das Wetter gut ist, gehen wir spazieren."], hint: "wenn-придаточное → в главной части инверсия: gehen wir." },
  ],
};
