/* ============================================================
   Deutsch Quest — данные раздела «Тренировка», уровень B1.
   Schreiben: Nebensätze (dass/ob/obwohl), Konnektoren (trotzdem,
   deshalb), Konjunktiv II, Passiv, zu-Infinitiv, Relativsätze.
   ============================================================ */
"use strict";

window.DQTrainData = window.DQTrainData || { levels: {} };

window.DQTrainData.levels.b1 = {
  /* ============================ Hören ============================ */
  hoeren: [
    { id: "b1-h1", say: "Wenn ich mehr Zeit hätte, würde ich mehr lesen.", ru: "Если бы у меня было больше времени, я бы больше читал.", options: ["Если бы было больше времени, я бы читал больше.", "Я читаю, когда есть время.", "У меня нет книг."] },
    { id: "b1-h2", say: "Obwohl es geregnet hat, sind wir wandern gegangen.", ru: "Хотя шёл дождь, мы пошли в поход.", options: ["Несмотря на дождь, мы пошли в поход.", "Из-за дождя мы остались дома.", "Мы гуляли до дождя."] },
    { id: "b1-h3", say: "Die Stelle muss bis Montag besetzt werden.", ru: "Должность должна быть занята до понедельника.", options: ["Вакансию надо закрыть до понедельника.", "Место уже занято.", "Собеседование в понедельник."] },
    { id: "b1-h4", say: "Ich hätte gern einen Rückruf von der Personalabteilung.", ru: "Я хотел(а) бы, чтобы мне перезвонили из отдела кадров.", options: ["Хочу, чтобы перезвонили из отдела кадров.", "Хочу встречу с директором.", "Хочу отправить резюме."] },
    { id: "b1-h5", say: "Es wäre besser, sich vorher zu informieren.", ru: "Было бы лучше заранее уточнить информацию.", options: ["Лучше сначала уточнить информацию.", "Уже поздно спрашивать.", "Информации нет."] },
    { id: "b1-h6", say: "Trotz der Verspätung wurde der Antrag angenommen.", ru: "Несмотря на задержку, заявление приняли.", options: ["Заявление приняли, хотя и с задержкой.", "Заявление отклонили.", "Заявление потеряли."] },
    { id: "b1-h7", say: "Ich bin mir nicht sicher, ob das so stimmt.", ru: "Я не уверен(а), так ли это.", options: ["Сомневаюсь, что это так.", "Уверен, что это так.", "Не знаю, что делать."] },
    { id: "b1-h8", say: "Der Vertrag wurde fristgerecht gekündigt.", ru: "Договор был расторгнут в срок.", options: ["Договор расторгли вовремя.", "Договор продлили.", "Договор потерян."] },
    { id: "b1-h9", say: "Wir sollten die Kosten genauer prüfen.", ru: "Нам стоит внимательнее проверить расходы.", options: ["Нужно перепроверить расходы.", "Расходы уже приняты.", "Кто-то оплатит расходы."] },
    { id: "b1-h10", say: "Falls Sie Fragen haben, melden Sie sich bitte.", ru: "Если у вас есть вопросы — пожалуйста, обращайтесь.", options: ["При вопросах обращайтесь.", "Вопросов нет.", "Спросите в отделе кадров."] },
  ],

  /* ============================ Wortschatz ============================ */
  wortschatz: [
    { id: "b1-w1", word: "die Kündigungsfrist", ru: "срок расторжения договора", options: ["срок расторжения", "штраф", "продление"] },
    { id: "b1-w2", word: "die Zusage", ru: "положительный ответ; согласие", options: ["согласие", "отказ", "отсрочка"] },
    { id: "b1-w3", word: "die Absage", ru: "отказ", options: ["отказ", "подтверждение", "напоминание"] },
    { id: "b1-w4", word: "der Nachweis", ru: "подтверждающий документ", options: ["доказательство; справка", "заявка", "печать"] },
    { id: "b1-w5", word: "sich bewerben um", ru: "подавать заявку на", options: ["подавать заявку", "увольняться", "повышать"] },
    { id: "b1-w6", word: "die Widerspruchsfrist", ru: "срок подачи возражения", options: ["срок возражения", "срок оплаты", "гарантийный срок"] },
    { id: "b1-w7", word: "die Nebentätigkeit", ru: "подработка", options: ["подработка", "отпуск", "смена"] },
    { id: "b1-w8", word: "die Beitragserhöhung", ru: "повышение взноса", options: ["повышение взноса", "снижение налогов", "возврат"] },
    { id: "b1-w9", word: "etwas in Anspruch nehmen", ru: "воспользоваться чем-либо", options: ["воспользоваться", "отказаться", "оплатить"] },
    { id: "b1-w10", word: "verbindlich", ru: "обязательный, обязывающий", options: ["обязательный", "вероятный", "бесплатный"] },
    { id: "b1-w11", word: "die Zuständigkeit", ru: "компетенция, ответственность", options: ["компетенция", "должность", "отдел"] },
    { id: "b1-w12", word: "sich erkundigen", ru: "осведомляться", options: ["осведомляться", "жаловаться", "снимать"] },
    { custom: "context", id: "b1-c1", sentence: "Wenn Sie anderer Meinung sind, können Sie ___ einlegen.", answer: "Widerspruch", options: ["Widerspruch", "Urlaub", "Rabatt"], hint: "Возражение против решения — Widerspruch." },
    { custom: "context", id: "b1-c2", sentence: "Die Firma sucht Mitarbeiter für den ___ .", answer: "Kundenservice", options: ["Kundenservice", "Urlaub", "Bahnhof"], hint: "Service für Kunden — Kundenservice." },
    { custom: "context", id: "b1-c3", sentence: "Ich habe die Wohnung ___ gekündigt.", answer: "fristgerecht", options: ["fristgerecht", "freiwillig", "kostenlos"], hint: "В срок — fristgerecht." },
    { art: true, id: "b1-a1", word: "Frist", answer: "die", options: ["der", "die", "das"], ru: "срок" },
    { art: true, id: "b1-a2", word: "Nachweis", answer: "der", options: ["der", "die", "das"], ru: "справка" },
    { art: true, id: "b1-a3", word: "Angebot", answer: "das", options: ["der", "die", "das"], ru: "предложение" },
    { art: true, id: "b1-a4", word: "Zusage", answer: "die", options: ["der", "die", "das"], ru: "согласие" },
    { art: true, id: "b1-a5", word: "Arbeitsvertrag", answer: "der", options: ["der", "die", "das"], ru: "трудовой договор" },
    { art: true, id: "b1-a6", word: "Abschluss", answer: "der", options: ["der", "die", "das"], ru: "окончание; диплом" },
    { art: true, id: "b1-a7", word: "Zeugnis", answer: "das", options: ["der", "die", "das"], ru: "аттестат, справка" },
    { art: true, id: "b1-a8", word: "Bewerbung", answer: "die", options: ["der", "die", "das"], ru: "заявка" },
  ],

  /* ============================ Lesen ============================ */
  lesen: [
    {
      id: "b1-l1", title: "Stellenanzeige",
      text: "Wir suchen zum 1. September eine Aushilfe im Kundenservice (20 Std./Woche). Voraussetzungen: gute Deutschkenntnisse (B1), PC-Kenntnisse, Freundlichkeit. Wir bieten: flexible Arbeitszeiten, faire Bezahlung, Einarbeitung. Bewerbungen mit Lebenslauf bis 15. Juli an: jobs@example.de. Bitte keine Anrufe.",
      questions: [
        { q: "Какой уровень немецкого нужен?", options: ["B1", "A1", "C1"], answer: "B1" },
        { q: "Как отправить заявку?", options: ["По e-mail", "Позвонить", "Прийти лично"], answer: "По e-mail" },
        { q: "Сколько часов в неделю?", options: ["20", "40", "30"], answer: "20" },
      ],
    },
    {
      id: "b1-l2", title: "Mietvertrag: Kündigung",
      text: "Die Kündigung muss schriftlich erfolgen. Die Kündigungsfrist beträgt drei Monate zum Monatsende. Ein Formular erhalten Sie bei der Verwaltung. Bei Auszug ist die Wohnung gestrichen zu übergeben.",
      questions: [
        { q: "Срок расторжения?", options: ["3 месяца", "1 месяц", "6 месяцев"], answer: "3 месяца" },
        { q: "В каком виде подать уведомление?", options: ["Письменно", "По телефону", "Устно"], answer: "Письменно" },
        { q: "В каком виде сдавать квартиру при выезде?", options: ["Покрашенной", "В старом виде", "Только убранной"], answer: "Покрашенной" },
      ],
    },
    {
      id: "b1-l3", title: "Weiterbildung",
      text: "Unsere Volkshochschule bietet ab Oktober einen Kurs „Deutsch für den Beruf“ (Niveau B1) an. Der Kurs findet zweimal pro Woche abends statt und dauert zwölf Wochen. Eine Prüfung ist freiwillig, aber nützlich für Bewerbungen. Anmeldung online oder im Büro.",
      questions: [
        { q: "Когда проходит курс?", options: ["Вечером дважды в неделю", "Утром ежедневно", "По выходным"], answer: "Вечером дважды в неделю" },
        { q: "Нужно ли сдавать экзамен?", options: ["Нет, по желанию", "Да, обязательно", "Только для B2"], answer: "Нет, по желанию" },
      ],
    },
    {
      id: "b1-l4", title: "Bescheid der Krankenkasse",
      text: "Ihr Antrag auf Erstattung wurde geprüft. Leider können wir nur 60 % der Kosten übernehmen, da eine ärztliche Verordnung fehlt. Sie haben vier Wochen Zeit, Widerspruch einzulegen und die Verordnung nachzureichen.",
      questions: [
        { q: "Почему возмещают только 60 %?", options: ["Нет рецепта врача", "Лимит исчерпан", "Другая страховая"], answer: "Нет рецепта врача" },
        { q: "Сколько времени на возражение?", options: ["4 недели", "2 недели", "3 месяца"], answer: "4 недели" },
      ],
    },
    {
      id: "b1-l5", title: "Vereinbarung im Team",
      text: "Da immer mehr Kollegen im Homeoffice arbeiten, führen wir ab Januar feste Homeoffice-Tage ein. Wer möchte, kann bis zu drei Tage pro Woche zu Hause arbeiten. Wichtig: Die Erreichbarkeit während der Kernzeiten (10–15 Uhr) muss garantiert sein.",
      questions: [
        { q: "Сколько дней максимум дома?", options: ["Три в неделю", "Все пять дней", "Только два дня"], answer: "Три в неделю" },
        { q: "Что обязательно?", options: ["Доступность с 10 до 15 часов", "Работа в офисе по пятницам", "Отчёт каждый день"], answer: "Доступность с 10 до 15 часов" },
      ],
    },
    {
      id: "b1-l6", title: "Kontolöschung",
      text: "Sehr geehrter Kunde,\nwir haben festgestellt, dass seit zwei Monaten keine Zahlung eingegangen ist. Bitte überweisen Sie den offenen Betrag innerhalb von 14 Tagen. Andernfalls werden weitere Kosten berechnet.\nIhre Bank",
      questions: [
        { q: "Какова проблема?", options: ["Не было платежа два месяца", "Счёт закрыт", "Смена адреса"], answer: "Не было платежа два месяца" },
        { q: "Сколько времени на оплату?", options: ["14 дней", "2 месяца", "1 день"], answer: "14 дней" },
      ],
    },
  ],

  /* ============================ Schreiben ============================ */
  schreiben: [
    /* --- dass / ob / obwohl / wenn --- */
    { id: "b1-s1", type: "words", ru: "Я не знаю, придёт ли он завтра.", answer: "Ich weiß nicht, ob er morgen kommt.", words: ["weiß", "nicht,", "ob", "er", "morgen", "kommt.", "Ich"], hint: "ob-придаточное: глагол в конце (kommt)." },
    { id: "b1-s2", type: "words", ru: "Хотя у меня нет времени, я тебе помогу.", answer: "Obwohl ich keine Zeit habe, helfe ich dir.", words: ["Obwohl", "ich", "keine", "Zeit", "habe,", "helfe", "ich", "dir."], hint: "В придаточном с obwohl глагол в конце; в главной части после него — инверсия." },
    { id: "b1-s3", type: "words", ru: "Он сказал, что завтра переезжает.", answer: "Er hat gesagt, dass er morgen umzieht.", words: ["hat", "gesagt,", "dass", "er", "morgen", "umzieht.", "Er"], hint: "dass-придаточное: глагол в конце." },
    /* --- Konnektoren --- */
    { id: "b1-s4", type: "words", ru: "Было холодно, но (тем не менее) мы поехали купаться.", answer: "Es war kalt, trotzdem sind wir schwimmen gegangen.", words: ["war", "kalt,", "trotzdem", "sind", "wir", "schwimmen", "gegangen.", "Es"], hint: "trotzdem — наречие, после него глагол на 2-м месте." },
    { id: "b1-s5", type: "words", ru: "Она ищет квартиру, поэтому переезжает в центр.", answer: "Sie sucht eine Wohnung, deshalb zieht sie ins Zentrum.", words: ["sucht", "eine", "Wohnung,", "deshalb", "zieht", "sie", "ins", "Zentrum.", "Sie"], hint: "deshalb + глагол сразу за ним; ins Zentrum = in + das Zentrum." },
    { id: "b1-s6", type: "words", ru: "Мы остались дома, потому что было слишком жарко.", answer: "Wir sind zu Hause geblieben, weil es zu heiß war.", words: ["sind", "zu", "Hause", "geblieben,", "weil", "es", "zu", "heiß", "war.", "Wir"], hint: "Perfekt sein: sind … geblieben; в придаточном глагол war — в конце." },
    /* --- Konjunktiv II --- */
    { id: "b1-s7", type: "words", ru: "Если бы я был(а) богат(а), я бы купил(а) дом.", answer: "Wenn ich reich wäre, würde ich ein Haus kaufen.", words: ["Wenn", "ich", "reich", "wäre,", "würde", "ich", "ein", "Haus", "kaufen."], hint: "Konjunktiv II: wäre (в придаточном — в конце), в главной — würde + инфинитив." },
    { id: "b1-s8", type: "words", ru: "Я бы с удовольствием пришёл, но у меня встреча.", answer: "Ich würde gern kommen, aber ich habe einen Termin.", words: ["würde", "gern", "kommen,", "aber", "ich", "habe", "einen", "Termin.", "Ich"], hint: "würde + gern + инфинитив; aber — сочинительный союз, порядок прямой." },
    { id: "b1-s9", type: "words", ru: "Ты мог бы мне позвонить.", answer: "Du könntest mich anrufen.", words: ["könntest", "mich", "anrufen.", "Du"], hint: "können → Konjunktiv II: könntest + инфинитив в конце." },
    /* --- Passiv --- */
    { id: "b1-s10", type: "words", ru: "Дом ремонтируется в этом году.", answer: "Das Haus wird dieses Jahr renoviert.", words: ["wird", "dieses", "Jahr", "renoviert.", "Das", "Haus"], hint: "Passiv Präsens: werden + Partizip II → wird renoviert." },
    { id: "b1-s11", type: "words", ru: "Письмо было отправлено вчера.", answer: "Der Brief wurde gestern geschickt.", words: ["wurde", "gestern", "geschickt.", "Der", "Brief"], hint: "Passiv Präteritum: wurde + Partizip II." },
    /* --- Relativsätze --- */
    { id: "b1-s12", type: "words", ru: "Человек, который стоит у двери, — мой сосед.", answer: "Der Mann, der an der Tür steht, ist mein Nachbar.", words: ["Der", "Mann,", "der", "an", "der", "Tür", "steht,", "ist", "mein", "Nachbar."], hint: "Относительное der (Nominativ, м.р.), глагол steht — в конце." },
    { id: "b1-s13", type: "words", ru: "Книга, которую я читаю, интересная.", answer: "Das Buch, das ich lese, ist interessant.", words: ["Das", "Buch,", "das", "ich", "lese,", "ist", "interessant."], hint: "das Buch (ср.р.) → относительное das; глагол в конце." },
    /* --- zu + Infinitiv --- */
    { id: "b1-s14", type: "words", ru: "Важно регулярно повторять.", answer: "Es ist wichtig, regelmäßig zu wiederholen.", words: ["Es", "ist", "wichtig,", "regelmäßig", "zu", "wiederholen."], hint: "es ist wichtig + zu + инфинитив." },
    /* --- перевод (ввод) --- */
    { id: "b1-t1", type: "write", ru: "Я подаю заявку на эту должность.", answers: ["Ich bewerbe mich um diese Stelle.", "Ich bewerbe mich für diese Stelle."], hint: "sich bewerben um/für + Akkusativ." },
    { id: "b1-t2", type: "write", ru: "Не могли бы вы прислать мне подтверждение?", answers: ["Könnten Sie mir eine Bestätigung schicken?"], hint: "Könnten + инфинитив в конце." },
    { id: "b1-t3", type: "write", ru: "Прошу сообщить сроки.", answers: ["Bitte teilen Sie mir die Fristen mit.", "Bitte nennen Sie mir die Fristen."], hint: "teilen … mit — отделяемая приставка в конце." },
    { id: "b1-t4", type: "write", ru: "Я хотел(а) бы получить информацию об условиях.", answers: ["Ich würde gern Informationen über die Bedingungen erhalten."], hint: "würde gern + инфинитив erhalten в конце." },
    { id: "b1-t5", type: "write", ru: "Я не смогу прийти завтра, потому что у меня встреча с врачом.", answers: ["Ich kann morgen nicht kommen, weil ich einen Termin beim Arzt habe."], hint: "weil-придаточное: глагол habe в конце." },
    { id: "b1-t6", type: "write", ru: "Если у меня будет время, я тебе позвоню.", answers: ["Wenn ich Zeit habe, rufe ich dich an."], hint: "wenn-придаточное → инверсия в главной: rufe ich…; an- в конце." },
    { id: "b1-t7", type: "write", ru: "Вам следует вовремя подать документы.", answers: ["Sie sollten die Unterlagen rechtzeitig einreichen."], hint: "sollten (Konjunktiv II) + инфинитив einreichen в конце." },
    { id: "b1-t8", type: "write", ru: "Я согласен(на) с вашим предложением.", answers: ["Ich bin mit Ihrem Angebot einverstanden."], hint: "einverstanden sein mit + Dativ: mit Ihrem Angebot." },
  ],
};
