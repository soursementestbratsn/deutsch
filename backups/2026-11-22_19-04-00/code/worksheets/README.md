# Задания / Тесты (Übungsblätter)

Каждый файл `*.json` в этой папке — одно занятие (набор вариантов с заданиями).
Сервер сам подхватывает все файлы: **чтобы добавить новый набор, просто положите
сюда ещё один JSON** — перезапуск не нужен.

## Структура файла

```json
{
  "id": "grammatik-a1-a2",
  "title": "Deutsch Übungsblatt: Grammatik",
  "level": "A1–A2",
  "subtitle": "Артикли, падежи, времена, модальные глаголы, порядок слов",
  "order": 10,
  "variants": [
    {
      "name": "Вариант 1",
      "vocab": [ { "de": "der Mantel", "ru": "пальто" } ],
      "tasks": [ ... ]
    }
  ]
}
```

- `order` — сортировка на экране (меньше = выше).
- Вариантов может быть сколько угодно (не обязательно 3).
- `vocab` — словарик варианта (может отсутствовать).

## Задание (task)

```json
{
  "type": "gap",
  "title": "Artikel und Kasus",
  "instruction": "Ergänzen Sie den richtigen Artikel.",
  "badge": "6 пунктов",
  "help": { "summary": "Алгоритм решения", "text": "HTML с пояснением…" },
  "items": [ ... ]
}
```

`type` определяет вид упражнения и способ проверки. Сейчас поддерживаются:

| type        | что делает                                  |
|-------------|---------------------------------------------|
| `gap`       | пропуски в тексте (1–2 поля на пункт)        |
| `sentence`  | собрать придаточное: префикс + ввод до конца |

### `gap`

```json
{
  "before": "Ich kaufe heute",
  "after": "(ein) warmen Mantel.",
  "answers": ["einen"],
  "explanation": "Покупаю что? → Akkusativ…"
}
```

Два поля — просто два элемента в `answers` и, по желанию, `mid` между ними:

```json
{ "before": "Gestern", "mid": "wir nach Berlin", "after": ".",
  "answers": ["sind", "geflogen"], "explanation": "..." }
```

### `sentence`

```json
{
  "sentence1": "Ich gehe heute früh schlafen. Ich bin sehr müde. (weil)",
  "prefix": "→ Ich gehe heute früh schlafen,",
  "answers": ["weil ich sehr müde bin."],
  "explanation": "После weil глагол уходит в конец."
}
```

`answers` — все допустимые варианты ответа (регистр, лишние пробелы и
конечная точка не важны). Первый вариант показывается как правильный.

## Новый тип задания

1. Добавьте описание в `web/worksheets.js` в объект `TASK_TYPES`:
   `render(item, i) → HTML` и `check(item, i, root) → { ok, correct }`.
2. Используйте его в JSON: `"type": "ваш_тип"`.

Рендерер данных не требует правок, поэтому новые упражнения в существующих
типах добавляются вообще без программирования.