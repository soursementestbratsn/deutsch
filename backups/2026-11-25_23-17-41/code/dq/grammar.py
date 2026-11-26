# -*- coding: utf-8 -*-
"""
dq.grammar — грамматика немецкого + тренажёр порядка слов.

Здесь две вещи:

1. GRAMMAR_LESSONS — короткие правила на русском (артикли, глагол на 2-м месте,
   порядок слов, Akkusativ/Dativ, Perfekt, модальные глаголы, отрицание, предлоги).
   Их можно просто читать на экране «Грамматика».

2. SentenceTemplate — шаблоны предложений, из которых собираются задания
   «составь правильный порядок слов». Каждый шаблон знает:
     * немецкую рамку: части в правильном порядке (правильный ответ),
     * русский перевод,
     * правило (подсказку), которое тренируется.

Генератор превращает шаблон в конкретное предложение, подставляя случайные
слова/числа, перемешивает части и отдаёт игрушке.
"""
import random

from .core import number_to_german, DQPair

# --------------------------------------------------------------------------- #
#  1. УРОКИ ГРАМАТИКИ
# --------------------------------------------------------------------------- #
GRAMMAR_LESSONS = [
    {
        "title": "Глагол на 2-м месте",
        "rule": "В простом немецком предложении глагол-сказуемое всегда стоит на ВТОРОМ месте. "
                "Если предложение начинается не с подлежащего, подлежащее уходит за глагол.",
        "examples": [
            ("Ich lerne Deutsch.", "Я учу немецкий."),
            ("Heute lerne ich Deutsch.", "Сегодня я учу немецкий."),
            ("Morgen fahre ich nach Berlin.", "Завтра я еду в Берлин."),
        ],
        "tip": "Спроси себя: «Что делает?» — этот глагол должен быть вторым словом.",
    },
    {
        "title": "Порядок слов: подлежащее → глагол → дополнение",
        "rule": "Базовый порядок: кто → что делает → что/куда. "
                "В вопросах без вопросительного слова глагол выходит на первое место.",
        "examples": [
            ("Der Mann kauft ein Auto.", "Мужчина покупает машину."),
            ("Kaufst du ein Auto?", "Ты покупаешь машину?"),
            ("Ich habe eine Frage.", "У меня есть вопрос."),
        ],
        "tip": "Вопрос «да/нет» = глагол первым, подлежащее вторым.",
    },
    {
        "title": "Артикли: der / die / das",
        "rule": "У каждого существительного есть род: der (мужской), die (женский), das (средний). "
                "Множественное число — всегда die.",
        "examples": [
            ("der Hammer", "молоток (м.)"),
            ("die Zange", "клещи (ж.)"),
            ("das Buch", "книга (ср.)"),
            ("die Bücher", "книги (мн.)"),
        ],
        "tip": "Учи слово сразу с артиклем: не «Buch», а «das Buch».",
    },
    {
        "title": "Модальные глаголы: глагол в конец",
        "rule": "С модальным глаголом (können, müssen, wollen, dürfen, sollen, mögen) "
                "спрягаемый модальный стоит на 2-м месте, а смысловой глагол уходит в самый конец.",
        "examples": [
            ("Ich kann gut Deutsch sprechen.", "Я могу хорошо говорить по-немецки."),
            ("Du musst mir helfen.", "Ты должен мне помочь."),
            ("Wir wollen heute einkaufen.", "Мы хотим сегодня закупиться."),
        ],
        "tip": "Рамка: [модальный на 2-м месте] … [смысловой глагол в конце].",
    },
    {
        "title": "Perfekt: haben/sein + Partizip II",
        "rule": "Прошедшее время в речи: haben или sein на 2-м месте, "
                "Partizip II (ge…t / ge…en) — в конце предложения.",
        "examples": [
            ("Ich habe Deutsch gelernt.", "Я учил немецкий."),
            ("Wir sind nach Hause gegangen.", "Мы пошли домой."),
            ("Er hat ein Buch gelesen.", "Он прочитал книгу."),
        ],
        "tip": "sein берут глаголы движения и изменения состояния: gehen, fahren, kommen.",
    },
    {
        "title": "Akkusativ: кого? что?",
        "rule": "Прямое дополнение (кого? что?) — Akkusativ. "
                "Мужской род меняется: der → den, ein → einen, mein → meinen. "
                "Женский, средний и мн. число не меняются.",
        "examples": [
            ("Ich kaufe den Hammer.", "Я покупаю молоток."),
            ("Ich sehe die Frau.", "Я вижу женщину."),
            ("Ich brauche einen Stift.", "Мне нужна ручка."),
        ],
        "tip": "Меняется только мужской род! der → den.",
    },
    {
        "title": "Dativ: кому?",
        "rule": "Косвенное дополнение (кому?) — Dativ. "
                "Меняются: der → dem, die → der, das → dem, die (мн.) → den (+ -n у слова).",
        "examples": [
            ("Ich helfe dem Mann.", "Я помогаю мужчине."),
            ("Ich danke der Frau.", "Я благодарю женщину."),
            ("Ich gebe dem Kind ein Buch.", "Я даю ребёнку книгу."),
        ],
        "tip": "helfen, danken, gefallen, gehören всегда требуют Dativ.",
    },
    {
        "title": "Отрицание: nicht и kein",
        "rule": "kein — отрицает существительное с неопределённым артиклем "
                "(kein, keine, keinen…). nicht — отрицает всё остальное "
                "(глагол, прилагательное, целую фразу).",
        "examples": [
            ("Ich habe keine Zeit.", "У меня нет времени."),
            ("Das ist nicht mein Buch.", "Это не моя книга."),
            ("Ich verstehe das nicht.", "Я этого не понимаю."),
        ],
        "tip": "kein склоняется как ein: kein / keine / keinen / keinem…",
    },
    {
        "title": "Вопросительные слова",
        "rule": "W-Fragen: wer (кто), was (что), wo (где), wohin (куда), "
                "woher (откуда), wann (когда), wie (как), warum (почему), "
                "wie viel (сколько). После вопросительного слова — глагол.",
        "examples": [
            ("Wo wohnst du?", "Где ты живёшь?"),
            ("Wie heißt du?", "Как тебя зовут?"),
            ("Wann kommst du?", "Когда ты придёшь?"),
        ],
        "tip": "Вопросительное слово + глагол + кто + что.",
    },
    {
        "title": "Предлоги места: in / an / auf / bei",
        "rule": "wo? (где) → Dativ: in dem = im, an dem = am, bei dem = beim. "
                "wohin? (куда) → Akkusativ: in das = ins, an das = ans.",
        "examples": [
            ("Ich bin in der Schule.", "Я в школе (где)."),
            ("Ich gehe in die Schule.", "Я иду в школу (куда)."),
            ("Das Buch liegt auf dem Tisch.", "Книга лежит на столе."),
        ],
        "tip": "«где» = Dativ, «куда» = Akkusativ.",
    },
    {
        "title": "Притяжательные: mein / dein / sein / ihr",
        "rule": "mein (мой), dein (твой), sein (его), ihr (её), unser (наш), "
                "euer (ваш), Ihr (Ваш). Склоняются как ein: mein / meine / meinen.",
        "examples": [
            ("Das ist mein Bruder.", "Это мой брат."),
            ("Das ist meine Schwester.", "Это моя сестра."),
            ("Ich liebe meinen Bruder.", "Я люблю своего брата."),
        ],
        "tip": "Окончание зависит от рода и падежа, а не от человека.",
    },
    {
        "title": "Числа и порядок слов в числах",
        "rule": "Двузначные числа читаются «с конца»: 21 = ein-und-zwanzig "
                "(буквально «один и двадцать»), 42 = zweiundvierzig. "
                "Сотни: 200 = zweihundert, 300 = dreihundert. "
                "Телефон диктуют по цифрам: 0176 = null eins sieben sechs.",
        "examples": [
            ("einundzwanzig", "21"),
            ("zweiundvierzig", "42"),
            ("einhundertfünfzig", "150"),
        ],
        "tip": "Сначала единицы, потом «und», потом десятки.",
    },
]


# --------------------------------------------------------------------------- #
#  2. ШАБЛОНЫ ПРЕДЛОЖЕНИЙ ДЛЯ ТРЕНАЖЁРА ПОРЯДКА СЛОВ
# --------------------------------------------------------------------------- #
# Каждый шаблон:
#   parts        — части немецкого предложения в ПРАВИЛЬНОМ порядке
#   ru           — перевод
#   rule         — подсказка-правило
#   vars         — необязательно: подстановки {name: [значения]}
#   distractors  — необязательно: лишние куски (игра «есть лишнее»)
#   allow_number — подставить случайное число вместо {zahl}

TEMPLATES = [
    # --- простой порядок: подлежащее → глагол → дополнение ------------------ #
    dict(parts=["Ich", "lerne", "Deutsch"], ru="Я учу немецкий.",
         rule="Глагол на 2-м месте: подлежащее → глагол → дополнение."),
    dict(parts=["Du", "trinkst", "Wasser"], ru="Ты пьёшь воду.",
         rule="Глагол на 2-м месте."),
    dict(parts=["Der", "Mann", "kauft", "ein", "Auto"], ru="Мужчина покупает машину.",
         rule="Артикль + существительное идут вместе; глагол на 2-м месте."),
    dict(parts=["Die", "Frau", "liest", "ein", "Buch"], ru="Женщина читает книгу.",
         rule="die = женский род; глагол на 2-м месте."),
    dict(parts=["Wir", "essen", "Brot"], ru="Мы едим хлеб.",
         rule="Простой порядок: кто → что делает → что."),
    dict(parts=["Das", "Kind", "spielt", "im", "Garten"],
         ru="Ребёнок играет в саду.",
         rule="«im Garten» = in dem Garten (Dativ, где?)."),
    dict(parts=["Meine", "Schwester", "ist", "lustig"],
         ru="Моя сестра весёлая.", rule="Прилагательное стоит после sein."),

    # --- инверсия: не подлежащее первым ------------------------------------ #
    dict(parts=["Heute", "lerne", "ich", "Deutsch"],
         ru="Сегодня я учу немецкий.",
         rule="Если первым стоит не подлежащее — глагол всё равно 2-й, подлежащее уходит за ним."),
    dict(parts=["Morgen", "fahre", "ich", "nach", "Berlin"],
         ru="Завтра я еду в Берлин.",
         rule="Инверсия: время → глагол → подлежащее."),
    dict(parts=["Am", "Montag", "arbeite", "ich"],
         ru="В понедельник я работаю.",
         rule="am = an dem (Dativ, день недели)."),
    dict(parts=["Jetzt", "kommt", "der", "Bus"],
         ru="Сейчас придёт автобус.", rule="Глагол на 2-м месте после обстоятельства."),

    # --- вопросы ----------------------------------------------------------- #
    dict(parts=["Wohnst", "du", "in", "Berlin", "?"],
         ru="Ты живёшь в Берлине?",
         rule="Вопрос без вопросительного слова: глагол на 1-м месте."),
    dict(parts=["Hast", "du", "Zeit", "?"], ru="У тебя есть время?",
         rule="Вопрос: глагол первым, подлежащее вторым."),
    dict(parts=["Wo", "wohnst", "du", "?"], ru="Где ты живёшь?",
         rule="W-вопрос: вопросительное слово → глагол → подлежащее."),
    dict(parts=["Wie", "heißt", "du", "?"], ru="Как тебя зовут?",
         rule="W-вопрос: глагол сразу после вопросительного слова."),
    dict(parts=["Wann", "kommt", "der", "Zug", "?"], ru="Когда придёт поезд?",
         rule="W-вопрос: wann + глагол + подлежащее."),

    # --- модальные глаголы ------------------------------------------------- #
    dict(parts=["Ich", "kann", "gut", "Deutsch", "sprechen"],
         ru="Я могу хорошо говорить по-немецки.",
         rule="Модальный на 2-м месте, смысловой глагол — в конце."),
    dict(parts=["Du", "musst", "mir", "helfen"],
         ru="Ты должен мне помочь.",
         rule="Модальный глагол + … + инфинитив в конце. helfen требует Dativ."),
    dict(parts=["Wir", "wollen", "heute", "einkaufen"],
         ru="Мы хотим сегодня закупиться.",
         rule="Модальный на 2-м месте, инфинитив в конце."),
    dict(parts=["Er", "möchte", "einen", "Kaffee", "trinken"],
         ru="Он хотел бы выпить кофе.",
         rule="möchte + Akkusativ (einen Kaffee) + инфинитив в конце."),

    # --- Perfekt ----------------------------------------------------------- #
    dict(parts=["Ich", "habe", "Deutsch", "gelernt"],
         ru="Я учил немецкий.",
         rule="Perfekt: haben на 2-м месте, Partizip II в конце."),
    dict(parts=["Wir", "sind", "nach", "Hause", "gegangen"],
         ru="Мы пошли домой.",
         rule="Perfekt с sein (движение), Partizip II в конце."),
    dict(parts=["Er", "hat", "ein", "Buch", "gelesen"],
         ru="Он прочитал книгу.",
         rule="Perfekt: haben + … + Partizip II."),

    # --- отрицание --------------------------------------------------------- #
    dict(parts=["Ich", "habe", "keine", "Zeit"],
         ru="У меня нет времени.",
         rule="kein отрицает существительное: keine Zeit."),
    dict(parts=["Das", "ist", "nicht", "mein", "Buch"],
         ru="Это не моя книга.",
         rule="nicht отрицает всё остальное (здесь — «моя книга»)."),
    dict(parts=["Ich", "verstehe", "das", "nicht"],
         ru="Я этого не понимаю.",
         rule="nicht в конце отрицает действие."),

    # --- Dativ / Akkusativ -------------------------------------------------- #
    dict(parts=["Ich", "helfe", "dem", "Mann"],
         ru="Я помогаю мужчине.",
         rule="helfen + Dativ: der Mann → dem Mann."),
    dict(parts=["Ich", "kaufe", "den", "Hammer"],
         ru="Я покупаю молоток.",
         rule="Akkusativ мужского рода: der → den."),
    dict(parts=["Ich", "gebe", "dem", "Kind", "ein", "Buch"],
         ru="Я даю ребёнку книгу.",
         rule="Dativ (dem Kind) + Akkusativ (ein Buch)."),
    dict(parts=["Sie", "dankt", "der", "Frau"],
         ru="Она благодарит женщину.",
         rule="danken + Dativ: die Frau → der Frau."),

    # --- предлоги ---------------------------------------------------------- #
    dict(parts=["Ich", "bin", "in", "der", "Schule"],
         ru="Я в школе.",
         rule="wo? (где) → Dativ: in der Schule."),
    dict(parts=["Ich", "gehe", "in", "die", "Schule"],
         ru="Я иду в школу.",
         rule="wohin? (куда) → Akkusativ: in die Schule."),
    dict(parts=["Das", "Buch", "liegt", "auf", "dem", "Tisch"],
         ru="Книга лежит на столе.",
         rule="auf + Dativ (где лежит)."),

    # --- притяжательные ----------------------------------------------------- #
    dict(parts=["Das", "ist", "mein", "Bruder"], ru="Это мой брат.",
         rule="mein + мужской род."),
    dict(parts=["Das", "ist", "meine", "Schwester"], ru="Это моя сестра.",
         rule="mein + женский род → meine."),

    # --- отделяемые приставки ---------------------------------------------- #
    dict(parts=["Ich", "stehe", "um", "sieben", "Uhr", "auf"],
         ru="Я встаю в семь часов.",
         rule="Отделяемая приставка auf- уходит в конец предложения."),
    dict(parts=["Er", "ruft", "seine", "Mutter", "an"],
         ru="Он звонит своей маме.",
         rule="anrufen → an уходит в конец."),

    # --- числа в предложении (динамические) -------------------------------- #
    dict(parts=["Ich", "bin", "{zahl}", "Jahre", "alt"], ru="Мне {zahl_ru} лет.",
         rule="Число читается «с конца»: 21 = einundzwanzig.", allow_number=True),
    dict(parts=["Das", "kostet", "{zahl}", "Euro"], ru="Это стоит {zahl_ru} евро.",
         rule="Числа до 100: сначала единицы, потом десятки.", allow_number=True),
    dict(parts=["Der", "Zug", "kommt", "um", "{uhr}", "Uhr"],
         ru="Поезд приходит в {uhr} часов.",
         rule="Время: um + время + Uhr.", number_range=(1, 12)),
]

#: дополнительные «лишние» куски — игра с отвлекающими элементами
DISTRACTOR_POOL = [
    "nicht", "kein", "und", "aber", "sehr", "auch", "immer", "nie", "oft",
    "gestern", "heute", "morgen", "hier", "dort", "schnell", "langsam",
]


def _fill_vars(template, rng):
    """Подставляет случайное число/значение в шаблон. Возвращает (parts, ru)."""
    parts = list(template["parts"])
    ru = template["ru"]
    if template.get("allow_number") or "{zahl}" in " ".join(parts):
        lo, hi = template.get("number_range", (1, 99))
        n = rng.randint(lo, hi)
        word = number_to_german(n)
        parts = [p.replace("{zahl}", word).replace("{uhr}", word) for p in parts]
        ru = ru.replace("{zahl_ru}", str(n)).replace("{uhr}", str(n))
    return parts, ru


def build_sentence(pair_pool, rng=random, distractors=False, rule_filter=None):
    """Собирает одно задание «порядок слов».

    Возвращает dict: {parts, answer, ru, rule, shuffled, distractors} или None.
    """
    templates = TEMPLATES
    if rule_filter:
        templates = [t for t in templates if rule_filter in t["rule"]]
    if not templates:
        templates = TEMPLATES
    template = rng.choice(templates)
    parts, ru = _fill_vars(template, rng)
    answer = " ".join(parts)

    extra = []
    if distractors:
        parts_flat = " ".join(parts).lower()
        pool = [w for w in DISTRACTOR_POOL if w not in parts_flat.split()]
        if pool:
            extra = rng.sample(pool, min(len(pool), rng.randint(1, 2)))

    shuffled = parts[:]
    rng.shuffle(shuffled)
    if len(shuffled) > 1 and shuffled == parts:
        rng.shuffle(shuffled)

    return {
        "parts": parts,
        "answer": answer,
        "ru": ru,
        "rule": template["rule"],
        "shuffled": shuffled + extra,
        "has_distractors": bool(extra),
        "pair": DQPair(answer, ru, group="Грамматика", kind="grammar",
                       image="", audio=answer, meta={"parts": parts}),
    }


def build_sentence_batch(count=40, rng=random, distractors=False):
    return [build_sentence(None, rng, distractors) for _ in range(count)]


def lessons():
    """Список уроков для экрана грамматики."""
    return GRAMMAR_LESSONS


def sentences_as_pairs():
    """Все шаблоны как DQPair — чтобы вставить их в общий датасет тренировки."""
    pairs = []
    for t in TEMPLATES:
        answer = " ".join(t["parts"])
        pairs.append(DQPair(answer, t["ru"], group="Грамматика", kind="grammar",
                            image="", audio=answer))
    return pairs
