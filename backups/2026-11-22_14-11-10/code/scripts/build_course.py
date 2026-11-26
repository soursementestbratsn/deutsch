# -*- coding: utf-8 -*-
"""Генерирует курс из 24 уроков в web/course/*.js на основе content/words.txt.

Каждый урок: {id, title, ru, group, rule:{title, body}, words:[[de,ru]], tasks:{...}}
Задания строятся из тех же слов, что в уроке, поэтому курс не расходится
с тренажёром. Запускать вручную: python scripts/build_course.py
"""
import json
import os
import random
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORDS = os.path.join(ROOT, "content", "words.txt")
OUT_DIR = os.path.join(ROOT, "web", "course")

# ---------------- словарь по группам ----------------
groups: dict[str, list[tuple[str, str]]] = {}
cur = None
for raw in open(WORDS, encoding="utf-8"):
    line = raw.strip()
    if not line:
        continue
    if line.startswith("#"):
        cur = line.lstrip("#").strip()
        groups[cur] = []
        continue
    if "=" in line and cur:
        de, ru = line.split("=", 1)
        groups[cur].append((de.strip(), ru.strip()))

BASE = groups.get("Базовый словарь из Duolingo и школы + повседневные слова", [])
EVERY = groups.get("Повседневные слова и выражения", [])
TOOLS = groups.get("Инструменты и предметы (Werkzeuge)", [])
CITY = groups.get("Здания и городские объекты (Gebäude und Orte in der Stadt)", [])
WAY = groups.get("Направления, движение и ориентация (Wegbeschreibung)", [])
BODY = groups.get("части тела", [])
NUM = groups.get("Математика", [])
KITCH = groups.get("Кухонная утварь (Küche)", [])

ALL = BASE + EVERY


def take(src, de_list):
    """Достаёт пары из группы по немецкому слову (без регистра)."""
    want = {d.lower() for d in de_list}
    out = []
    for de, ru in src:
        if de.lower() in want:
            out.append((de, ru))
        elif de.lower().split()[-1] in want:
            out.append((de, ru))
    return out


def fill(src, n, skip=()):
    """Добирает n пар из src, пропуская уже использованные."""
    skip_l = {s.lower() for s in skip}
    out = []
    for de, ru in src:
        if de.lower() in skip_l or len(de.split()) > 4:
            continue
        out.append((de, ru))
        skip_l.add(de.lower())
        if len(out) >= n:
            break
    return out


RULES = {
    "greet": ("Приветствия и «sein»",
              "**sein** — «быть»: ich **bin**, du **bist**, er/sie/es **ist**, wir **sind**, ihr **seid**, sie **sind**.\n"
              "Ich **bin** Igor. Du **bist** nett. Das **ist** gut."),
    "pron": ("Местоимения и глагол в Präsens",
             "Обычный глагол: основа + окончание: ich mach**e**, du mach**st**, er mach**t**, wir mach**en**, ihr mach**t**, sie mach**en**.\n"
             "В главном предложении глагол стоит на **2-м месте**: Ich **lerne** heute Deutsch."),
    "article": ("Артикли der / die / das",
                "Каждое существительное в немецком — с артиклем: **der** (муж.), **die** (жен.), **das** (ср.).\n"
                "Для людей и профессий — по полу: der Mann, die Frau, das Kind. У существительных всегда заглавная буква."),
    "plural": ("Множественное число",
               "Во множественном числе артикль всегда **die**: der Tisch → **die Tische**, die Frau → **die Frauen**, das Haus → **die Häuser**."),
    "neg": ("Отрицание nicht и kein",
            "**nicht** — «не» для глаголов и имён: Ich arbeite **nicht**. Das ist **nicht** gut.\n"
            "**kein** — «не» для существительных: Ich habe **kein** Geld. (kein/keine, в Akkusativ: keinen)"),
    "question": ("Вопросы и порядок слов",
                 "Вопрос без вопросительного слова — глагол на первое место: **Trinkst** du Kaffee? **Bist** du müde?\n"
                 "С вопросительным словом: **Wo** wohnst du? **Was** machst du? **Wann** kommst du?"),
    "modal": ("Модальные глаголы",
              "**können** (мочь): ich kann, du kannst, er kann … **müssen** (должен): muss, musst, muss …\n"
              "Второй глагол уходит в конец в инфинитиве: Ich **kann** heute gut **arbeiten**."),
    "akk": ("Akkusativ — «кого, что»",
            "Прямое дополнение — в Akkusativ. Мужской род меняется: **der** → **den**, **ein** → **einen**.\n"
            "Ich sehe **den** Mann. Ich kaufe **einen** Apfel. Женский и средний не меняются."),
    "dat": ("Dativ — «кому»",
            "«Кому я помогаю / даю / говорю» — Dativ. Мужской: der → **dem**, женский: die → **der**, средний: das → **dem**.\n"
            "Ich helfe **dem** Mann. Ich gebe **der** Frau das Buch. Предлоги: mit, nach, aus, bei, seit, von, zu **→ Dativ**."),
    "prep": ("Предлоги места и времени",
             "**in** — в, **auf** — на, **unter** — под, **über** — над, **neben** — рядом, **vor** — перед, **hinter** — за.\n"
             "Wohin? (+ Akkusativ) → Ich gehe **in die** Küche. Wo? (+ Dativ) → Ich bin **in der** Küche."),
    "perfekt": ("Perfekt — прошедшее разговорное",
                "**haben** или **sein** + Partizip II: Ich **habe** gelernt. Ich **bin** gefahren.\n"
                "Частое: gemacht, gelernt, gekauft, gegessen, getrunken, gelesen, gesehen, gesprochen."),
    "praet": ("Präteritum — прошедшее письменное",
              "Слабые глаголы: machen → **machte**, lernen → **lernte**. Сильные: gehen → **ging**, sein → **war**, haben → **hatte**.\n"
              "Нужно для письма и для истории; в речи чаще Perfekt."),
    "zu": ("Инфинитив с zu",
           "После **wichtig, gut, leicht, schwer, möglich** и глаголов вроде beginnen, helfen, versuchen — **zu + инфинитив**:\n"
           "Es ist wichtig, Deutsch **zu** lernen. Ich versuche, nicht **zu** schlafen."),
    "weil": ("Придаточное с weil / dass",
             "В придаточном глагол уходит **в конец**: Ich bleibe zu Hause, **weil** ich krank **bin**.\n"
             "Ich denke, **dass** er Recht **hat**."),
    "um-zu": ("Чтобы — um … zu",
              "Цель: **um … zu + инфинитив**: Ich lerne Deutsch, **um** in Deutschland **zu** arbeiten.\n"
              "Если подлежащие разные — с dass: Ich will, dass du kommst."),
    "komp": ("Сравнение",
             "Степени: schnell → **schneller** → **am schnellsten**. Основные: gut → **besser** → **am besten**.\n"
             "Сравнение: **so … wie** (так же), **als** (чем): Ich bin größer **als** du."),
    "perf2": ("Порядок слов и отрицание с Perfekt",
              "Perfekt в придаточном: Ich glaube, **dass** er **gekommen ist** (вспомогательный глагол — в самом конце)."),
    "passiv": ("Пассив",
               "**werden** + Partizip II: Das Haus **wird gebaut**. В прошлом: Das Haus **wurde** gebaut.\n"
               "Важно действие, а не кто его делает. Исполнитель — с **von**."),
    "konj": ("Konjunktiv II — вежливость и мечты",
             "**würde** + инфинитив: Ich **würde** gern kommen. Сильные: könnte, müsste, wäre, hätte.\n"
             "Вежливые просьбы: **Könnten** Sie bitte …? **Hätte** ich einen Termin?"),
    "rel": ("Относительные придаточные",
            "Связываем существительное: Der Mann, **der** dort steht, ist mein Lehrer.\n"
            "Падеж зависит от роли в придаточном: Das Buch, **das** ich lese … Das Buch, **dem** ich helfe …"),
    "comp": ("Сравнения и степени (A2)",
             "am …sten / der …ste: Er ist **der schnellste**. Сравнения для описания людей и мест."),
    "dialog": ("Реплика диалога",
               "Простые шаблоны: Guten Tag! · Danke, und dir? · Ich brauche … · Wie bitte? · Entschuldigung."),
    "work": ("Работа и документы",
             "Официальный стиль: Ich **möchte** einen Termin **vereinbaren**. Hier ist mein **Ausweis**. Bitte **unterschreiben** Sie hier."),
    "city": ("Город и путь",
             "Направления: geradeaus, links, rechts, **bis zur** Ampel, **an der** Kreuzung.\n"
             "Geste: Wo ist der Bahnhof? — **Geradeaus**, dann **links**."),
    "every": ("Повседневная речь и эмоции",
              "Оценочные слова: **glücklich, müde, krank, gesund, schön, richtig, falsch**."),
}

# ---------------- 24 урока ----------------
LESSONS = [
    ("Приветствия", "Знакомство и «sein»", "greet",
     ["ich", "du", "gut", "Freut mich", "das ist", "mein"] + [d for d, _ in take(BASE, ["Danke", "Tschüss", "und"])]),
    ("Кто я", "Род, имя, откуда", "pron",
     ["ich komme aus", "und du", "Sohn", "Tochter", "Bruder", "Schwester", "Mama", "Papa",
      "Familie", "Freund", "nett", "lustig"]),
    ("Еда", "Заказ и вежливость", "article",
     ["Hungrig", "Essen", "Trinken", "Kaffee", "Tee", "lecker", "Wurst", "Pizza",
      "Salat", "Käse", "Schnitzel", "Brot", "frisch", "satt"]),
    ("В ресторане", "«Маж ты?» и деньги", "question",
     ["Magst du", "Trinkst du", "mache", "bestelle", "billig", "Preis", "Geld", "bezahlen", "kaufen"]),
    ("Школа и вещи", "Артикли и предметы", "article",
     ["Schule", "Lehrer", "Schüler", "Buch", "Stift", "Tisch", "Stuhl", "Haus", "Auto", "Zimmer"]),
    ("Время суток", "Дни и слова времени", "neg",
     ["Tag", "Nacht", "Morgen", "Abend", "heute", "morgen", "gestern", "jetzt", "später", "früh", "spät"]),
    ("Распорядок дня", "Глаголы в Präsens", "pron",
     ["immer", "oft", "manchmal", "nie", "arbeiten", "lernen", "spielen", "gehen", "kommen", "sein", "haben"]),
    ("Модальность", "«Могу, должен, хочу»", "modal",
     ["wollen", "können", "müssen", "wissen", "machen", "sagen", "geben"]),
    ("Дом и жильё", "Предлоги места", "prep",
     ["Zimmer", "Tür", "Fenster", "Weg", "Straße", "Stadt", "Platz", "Laden"]),
    ("В городе", "Путь и транспорт", "city",
     WAY + CITY),
    ("Люди и работа", "Профессии и офис", "work",
     ["Mensch", "Mann", "Frau", "Kind", "Leute", "Arbeit", "Hilfe", "Problem", "Frage", "Antwort", "Idee"]),
    ("Одежда и внешность", "Описание человека", "art",
     ["groß", "klein", "neu", "alt", "schön", "warm", "kalt", "heiß", "schlecht"]),
    ("Прилагательные", "Какой предмет", "compar",
     ["schnell", "langsam", "teuer", "richtig", "falsch", "gut"]),
    ("Чувства и здоровье", "Эмоции и тело", "every",
     ["glücklich", "müde", "krank", "gesund", "helfen", "fragen", "antworten"]),
    ("Тело человека", "Части тела", "article", BODY),
    ("Инструменты", "Мастерская", "article", TOOLS),
    ("Кухня", "Утварь и готовка", "modal",
     [d for d, _ in KITCH] + ["kochen", "Essen", "Salz", "Butter", "Suppe", "Kuchen"]),
    ("Математика", "Числа и вычисления", "question", NUM),
    ("Прошедшее время", "Perfekt в речи", "perfekt",
     ["sehen", "hören", "sprechen", "nehmen", "finden", "geben"]),
    ("Рассказ о вчера", "Präteritum в письме", "praet",
     ["sein", "haben", "gehen", "kommen", "sehen", "finden"]),
    ("Просьбы и вежливость", "Konjunktiv II", "konj",
     ["bitte", "Danke", "Frage", "Hilfe", "können", "wollen", "haben", "sein"]),
    ("Планы и причины", "weil, um … zu", "because",
     ["wollen", "arbeiten", "lernen", "spielen", "leben", "lieben"]),
    ("Письмо читаю так", "Понимание текста", "rel", EVERY[:12]),
    ("Финальный урок", "Всё вместе", "dialog", EVERY[12:24]),
]
RULE_MAP = {"because": "weil", "compar": "komp", "art": "article"}


def lesson_words(spec):
    if isinstance(spec, list):
        words = take(ALL, [s for s in spec if isinstance(s, str)])
        extra_city = []
        for de, ru in spec:
            pass
        return words
    return spec


def build_words(spec):
    """spec — список строк или пар (de, ru)."""
    out, seen = [], set()

    def add(pairs):
        for de, ru in pairs:
            if de.lower() in seen:
                continue
            seen.add(de.lower())
            out.append([de, ru])

    str_specs = [s for s in spec if isinstance(s, str)]
    add(take(ALL, str_specs))
    add([p for p in spec if isinstance(p, (list, tuple))])
    # не меньше 12 слов: добираем из повседневных
    if len(out) < 12:
        add(fill(EVERY + BASE, 12 - len(out), skip=seen))
    return out[:20]


def make_tasks(words):
    pairs = [tuple(w) for w in words]
    tasks = []
    # 1) значение: выбираем правильный перевод
    for de, ru in pairs[:6]:
        wrong = random.sample([r for _, r in pairs if r != ru] or [r for _, r in EVERY if r != ru], 2)
        opts = [ru] + wrong
        random.shuffle(opts)
        tasks.append({"type": "choice", "q": f"Что значит «{de}»?", "options": opts, "answer": ru})
    # 2) перевод RU → DE
    for de, ru in pairs[6:10]:
        tasks.append({"type": "sentence", "q": f"Напишите по-немецки: {ru}", "prefix": "", "answer": de})
    # 3) порядок слов
    de, ru = pairs[10] if len(pairs) > 10 else pairs[0]
    if de.split() and len(de.split()) > 0:
        tasks.append({"type": "sentence", "q": f"Соберите фразу: {ru}", "prefix": "", "answer": de})
    return tasks


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    lessons_out = []
    for i, (title, ru, rule, spec) in enumerate(LESSONS, start=1):
        rule_key = RULE_MAP.get(rule, rule)
        r_title, r_body = RULES[rule_key]
        words = build_words(spec)
        tasks = make_tasks(words)
        lessons_out.append({
            "id": f"l{i:02d}",
            "n": i,
            "title": title,
            "ru": ru,
            "rule": {"title": r_title, "body": r_body},
            "words": words,
            "tasks": tasks[:8],
        })

    # режем на 3 файла по 8 уроков
    for part in range(3):
        chunk = lessons_out[part * 8:(part + 1) * 8]
        path = os.path.join(OUT_DIR, f"lessons-{part + 1}.js")
        body = json.dumps(chunk, ensure_ascii=False, indent=1)
        with open(path, "w", encoding="utf-8") as f:
            f.write("/* Сгенерировано scripts/build_course.py — правьте там, не здесь */\n")
            f.write("window.DQCourseData = (window.DQCourseData || []).concat(")
            f.write(body)
            f.write(");\n")
    print("уроков:", len(lessons_out), "| слов всего:", sum(len(l["words"]) for l in lessons_out))


if __name__ == "__main__":
    random.seed(7)
    main()
