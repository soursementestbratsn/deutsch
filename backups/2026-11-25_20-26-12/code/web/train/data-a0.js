/* ============================================================
   Deutsch Quest — данные «Тренировка», уровень A0 (старт).
   Темы: приветствие, знакомство, числа, семья, цвета, еда.
   ============================================================ */
"use strict";
window.DQTrainData = window.DQTrainData || { levels: {} };

window.DQTrainData.levels.a0 = {
  /* ---------- Hören ---------- */
  hoeren: [
    { id: "a0-h1", say: "Guten Morgen!", ru: "Доброе утро!", options: ["Доброе утро!", "Спокойной ночи!", "До свидания"] },
    { id: "a0-h2", say: "Wie heißt du?", ru: "Как тебя зовут?", options: ["Как тебя зовут?", "Откуда ты?", "Сколько тебе лет?"] },
    { id: "a0-h3", say: "Danke schön.", ru: "Большое спасибо.", options: ["Большое спасибо.", "Пожалуйста.", "Извините."] },
    { id: "a0-h4", say: "Ich komme aus Russland.", ru: "Я из России.", options: ["Я из России.", "Я живу в Германии.", "Я учу немецкий."] },
    { id: "a0-h5", say: "Wo ist der Bahnhof?", ru: "Где вокзал?", options: ["Где вокзал?", "Где аптека?", "Где туалет?"] },
    { id: "a0-h6", say: "Auf Wiedersehen!", ru: "До свидания!", options: ["До свидания!", "Привет!", "Добрый вечер!"] },
    { id: "a0-h7", say: "Ich heiße Anna.", ru: "Меня зовут Анна.", options: ["Меня зовут Анна.", "Я — учительница.", "Это моя сестра."] },
    { id: "a0-h8", say: "Das ist mein Bruder.", ru: "Это мой брат.", options: ["Это мой брат.", "Это моя мама.", "Это моя сестра."] },
    { id: "a0-h9", say: "Ich habe zwei Kinder.", ru: "У меня двое детей.", options: ["У меня двое детей.", "У меня есть брат.", "Мне двадцать лет."] },
    { id: "a0-h10", say: "Entschuldigung, ich verstehe nicht.", ru: "Извините, я не понимаю.", options: ["Извините, я не понимаю.", "Извините, я не говорю по-немецки.", "Повторите, пожалуйста."] },
    { id: "a0-h11", say: "Wie viel kostet das Brot?", ru: "Сколько стоит хлеб?", options: ["Сколько стоит хлеб?", "Где хлеб?", "Мне нужен хлеб."] },
    { id: "a0-h12", say: "Ich trinke gern Kaffee.", ru: "Я люблю пить кофе.", options: ["Я люблю кофе.", "Я не пью кофе.", "Я пью чай."] },
    { id: "a0-h13", say: "Meine Adresse ist Hauptstraße zehn.", ru: "Мой адрес — Хауптштрассе, 10.", options: ["Мой адрес: Хауптштрассе 10.", "Я живу на вокзале.", "Мой номер 10."] },
    { id: "a0-h14", say: "Bis morgen!", ru: "До завтра!", options: ["До завтра!", "До понедельника!", "Пока!"] },
  ],

  /* ---------- Wortschatz ---------- */
  wortschatz: [
    { id: "a0-w1", word: "der Tisch", ru: "стол", options: ["стол", "стул", "окно"] },
    { id: "a0-w2", word: "die Schule", ru: "школа", options: ["школа", "магазин", "работа"] },
    { id: "a0-w3", word: "der Bus", ru: "автобус", options: ["автобус", "поезд", "машина"] },
    { id: "a0-w4", word: "das Brot", ru: "хлеб", options: ["хлеб", "молоко", "сыр"] },
    { id: "a0-w5", word: "die Wohnung", ru: "квартира", options: ["квартира", "дом", "комната"] },
    { id: "a0-w6", word: "der Apfel", ru: "яблоко", options: ["яблоко", "груша", "банан"] },
    { id: "a0-w7", word: "das Wasser", ru: "вода", options: ["вода", "сок", "чай"] },
    { id: "a0-w8", word: "die Mutter", ru: "мама", options: ["мама", "папа", "бабушка"] },
    { id: "a0-w9", word: "heute", ru: "сегодня", options: ["сегодня", "вчера", "завтра"] },
    { id: "a0-w10", word: "kaufen", ru: "покупать", options: ["покупать", "продавать", "платить"] },
    { id: "a0-w11", word: "rot", ru: "красный", options: ["красный", "зелёный", "синий"] },
    { id: "a0-w12", word: "die Straße", ru: "улица", options: ["улица", "площадь", "переулок"] },
    { art: true, id: "a0-a1", word: "Fenster", answer: "das", options: ["der", "die", "das"], ru: "окно" },
    { art: true, id: "a0-a2", word: "Stuhl", answer: "der", options: ["der", "die", "das"], ru: "стул" },
    { art: true, id: "a0-a3", word: "Tasche", answer: "die", options: ["der", "die", "das"], ru: "сумка" },
    { art: true, id: "a0-a4", word: "Buch", answer: "das", options: ["der", "die", "das"], ru: "книга" },
    { art: true, id: "a0-a5", word: "Schlüssel", answer: "der", options: ["der", "die", "das"], ru: "ключ" },
    { art: true, id: "a0-a6", word: "Milch", answer: "die", options: ["der", "die", "das"], ru: "молоко" },
    { art: true, id: "a0-a7", word: "Auto", answer: "das", options: ["der", "die", "das"], ru: "машина" },
    { art: true, id: "a0-a8", word: "Lehrer", answer: "der", options: ["der", "die", "das"], ru: "учитель" },
    { art: true, id: "a0-a9", word: "Lampe", answer: "die", options: ["der", "die", "das"], ru: "лампа" },
    { art: true, id: "a0-a10", word: "Haus", answer: "das", options: ["der", "die", "das"], ru: "дом" },
  ],

  /* ---------- Lesen ---------- */
  lesen: [
    {
      id: "a0-l1", title: "Im Café",
      text: "Guten Tag! Ich möchte einen Kaffee und ein Brötchen. Das kostet drei Euro. Danke!",
      questions: [
        { q: "Что человек хочет?", options: ["Кофе и булочку", "Чай и торт", "Воду и суп"], answer: "Кофе и булочку" },
        { q: "Сколько это стоит?", options: ["3 евро", "5 евро", "1 евро"], answer: "3 евро" },
      ],
    },
    {
      id: "a0-l2", title: "Mein Tag",
      text: "Ich stehe um sieben Uhr auf. Dann frühstücke ich. Um acht Uhr gehe ich zur Schule. Am Abend lese ich ein Buch.",
      questions: [
        { q: "Когда человек встаёт?", options: ["В 7:00", "В 8:00", "В 9:00"], answer: "В 7:00" },
        { q: "Что он делает вечером?", options: ["Читает книгу", "Смотрит телевизор", "Готовит ужин"], answer: "Читает книгу" },
        { q: "Куда он идёт в 8:00?", options: ["В школу", "На работу", "В магазин"], answer: "В школу" },
      ],
    },
    {
      id: "a0-l3", title: "Aushang: Supermarkt",
      text: "Supermarkt Sonne\nMontag bis Samstag: 8–20 Uhr\nSonntag: geschlossen.\nBrot ist heute im Angebot: 1,49 €.",
      questions: [
        { q: "Когда магазин закрыт?", options: ["В воскресенье", "В субботу", "В понедельник"], answer: "В воскресенье" },
        { q: "Сколько стоит хлеб сегодня?", options: ["1,49 €", "2,49 €", "1,99 €"], answer: "1,49 €" },
      ],
    },
    {
      id: "a0-l4", title: "Meine Familie",
      text: "Ich heiße Tom. Meine Mutter heißt Eva. Mein Vater heißt Paul. Ich habe eine Schwester. Sie ist zehn Jahre alt.",
      questions: [
        { q: "Как зовут маму?", options: ["Эва", "Паулина", "Анна"], answer: "Эва" },
        { q: "Сколько лет сестре?", options: ["10", "12", "8"], answer: "10" },
      ],
    },
    {
      id: "a0-l5", title: "Nachricht",
      text: "Hallo Papa, ich komme heute spät. Ich arbeite bis 18 Uhr. Bitte koch für mich nicht. Bis bald, Lena.",
      questions: [
        { q: "Кто пишет?", options: ["Лена", "Папа", "Мама"], answer: "Лена" },
        { q: "Почему она придёт поздно?", options: ["Работает до 18:00", "Встреча с другом", "Поезд опоздал"], answer: "Работает до 18:00" },
        { q: "О чём она просит?", options: ["Не готовить для неё", "Купить хлеб", "Позвонить ей"], answer: "Не готовить для неё" },
      ],
    },
    {
      id: "a0-l6", title: "Am Bahnhof",
      text: "Der Zug nach Köln fährt von Gleis 3. Abfahrt: 14:20. Bitte nicht rauchen.",
      questions: [
        { q: "Куда едет поезд?", options: ["В Кёльн", "В Берлин", "В Гамбург"], answer: "В Кёльн" },
        { q: "С какого пути?", options: ["С 3-го", "С 1-го", "С 5-го"], answer: "С 3-го" },
      ],
    },
  ],

  /* ---------- Schreiben ---------- */
  schreiben: [
    {
      id: "a0-s1", type: "words", ru: "Я из России.",
      answer: "Ich komme aus Russland.",
      words: ["komme", "Ich", "aus", "Russland."],
      hint: "Глагол в простом предложении стоит на 2-м месте: Ich (1) komme (2) …",
    },
    {
      id: "a0-s2", type: "words", ru: "Меня зовут Анна.",
      answer: "Ich heiße Anna.",
      words: ["heiße", "Anna.", "Ich"],
      hint: "heißt у «ты», а у «я» — heiße: Ich heiße Anna.",
    },
    {
      id: "a0-s3", type: "words", ru: "Где вокзал?",
      answer: "Wo ist der Bahnhof?",
      words: ["ist", "Wo", "der", "Bahnhof?"],
      hint: "Вопросительное слово Wo — 1-е место, глагол ist — сразу за ним, der Bahnhof мужского рода.",
    },
    {
      id: "a0-s4", type: "words", ru: "Я живу в Берлине.",
      answer: "Ich wohne in Berlin.",
      words: ["in", "wohne", "Ich", "Berlin."],
      hint: "Глагол wohne — на 2-м месте; город после «in» без артикля.",
    },
    {
      id: "a0-s5", type: "words", ru: "У меня есть брат.",
      answer: "Ich habe einen Bruder.",
      words: ["habe", "einen", "Ich", "Bruder."],
      hint: "haben + Akkusativ: der Bruder → einen Bruder.",
    },
    {
      id: "a0-s6", type: "words", ru: "Это не мой ключ.",
      answer: "Das ist nicht mein Schlüssel.",
      words: ["nicht", "ist", "Das", "mein", "Schlüssel."],
      hint: "Отрицание nicht — после глагола: Das ist nicht mein Schlüssel.",
    },
    {
      id: "a0-s7", type: "words", ru: "Я пью воду.",
      answer: "Ich trinke Wasser.",
      words: ["trinke", "Wasser.", "Ich"],
      hint: "ich trinke — окончание -e у глагола.",
    },
    {
      id: "a0-s8", type: "words", ru: "Сегодня хорошая погода.",
      answer: "Heute ist das Wetter gut.",
      words: ["Heute", "ist", "das", "Wetter", "gut."],
      hint: "Если начинаем с Heute, глагол всё равно 2-м: Heute (1) ist (2) …",
    },
    { id: "a0-s9", type: "write", ru: "доброе утро", answers: ["Guten Morgen"], hint: "Приветствие до полудня: Guten Morgen." },
    { id: "a0-s10", type: "write", ru: "большое спасибо", answers: ["Danke schön", "Vielen Dank"], hint: "Danke schön или Vielen Dank." },
    { id: "a0-s11", type: "write", ru: "Я учу немецкий.", answers: ["Ich lerne Deutsch."], hint: "lerne — 1-е лицо (ich lerne); название языка без артикля." },
    { id: "a0-s12", type: "write", ru: "до свидания", answers: ["Auf Wiedersehen"], hint: "Устойчивое прощание: Auf Wiedersehen." },
  ],
};
