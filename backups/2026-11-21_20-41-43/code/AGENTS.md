# AGENTS.md — паспорт проекта «Deutsch Quest» (для агента, не для пользователя)

Читать ПЕРВЫМ при любой задаче. Это карта: где что лежит, что можно трогать, что нельзя.
Пользовательскую инструкцию см. в `README.md`, идеи развития — в `ИДЕИ-100.md`.
Обновлять этот файл после крупных изменений (новый экран, игра, API, папка).

---

## 0. СТАТУС И ЗАПУСК

> **ПРАВИЛО ВЕРСИЙ (обязательно, в конце КАЖДОЙ задачи).**
> Последний шаг любой работы — полный снимок проекта:
> ```
> python scripts/backup.py now --label "NN: короткое имя этапа" --prompt-file <файл с запросом пользователя>
> ```
> В `--label` — номер этапа и суть ("05: фикс настроек"), в `--prompt-file` — дословный запрос
> пользователя из этого хода. Снимок сам посчитает изменения и статистику и покажет пользователю
> на странице `/backups`. Без этого задача не считается законченной.
> Восстановление: `python scripts/backup.py restore <ID> [--with-stats] [--file путь]`.

WEB (основной) — `python main.py` → `server.py` (stdlib http.server) → `web/*` (vanilla JS, без сборки).
DESKTOP (legacy, не трогать без просьбы) — `python main.py --desktop` → `dq/app.py` (Tkinter, ~3900 строк).

| Запуск | Команда |
|---|---|
| сайт + браузер | `Запустить-сайт.ps1` (или `python main.py`) |
| другой порт, без браузера | `python main.py --port 9000 --no-browser` |
| только сервер | `python server.py --port 8000 --no-browser` |
| старое Tk-окно | `python main.py --desktop` |
| скачать всю озвучку | `python main.py --prefetch-audio` |
| сгенерить картинки | `python main.py --prefetch-images [--online-images] [--limit N]` |
| проверка сайта в браузере | `Проверить-сайт.ps1` (headless Playwright) |
| уборка мусора | `Убрать-мусор.ps1` / `python scripts/cleanup.py --apply` |
| версии/бэкапы | `Сделать-бэкап.ps1` · `Список-версий.ps1` · `python scripts/backup.py list` |
| история версий в браузере | `http://127.0.0.1:8000/backups` (кнопка с часиками в шапке) |
| страницы версий (код) | `server.py:_versions_page/_version_route` + `server_backups.py` |

Зависимостей у веба нет (только stdlib). `pillow` — только для prefetch картинок.
Кодировка везде UTF-8. PowerShell: `Get-Content file -Encoding UTF8`.

---

## 1. ДЕРЕВО (актуальное)

```
дойч/
├─ Запустить-сайт.ps1 / Убрать-мусор.ps1 / Проверить-сайт.ps1   скрипты для пользователя
├─ Сделать-бэкап.ps1 / Список-версий.ps1                        версии (ручной снимок / список)
├─ README.md               инструкция для человека
├─ ИДЕИ-100.md             100 идей развития (источник вдохновения, новые правила НЕ отсюда)
├─ AGENTS.md    этот файл
├─ main.py                 точка входа: аргументы, режимы
├─ server.py               WEB-СЕРВЕР + вся серверная логика API
├─ server_backups.py       вёрстка страниц /backups (список и карточка версии)
│
├─ content/                ← ДАННЫЕ (всё, что меняется руками и не является кодом)
│  ├─ words.txt            276 пар, 10 групп (`# Группа`, `de = ru`)
│  ├─ phrases.txt          школьные фразы `de = ru`
│  ├─ numbers.txt          числа `de = число`
│  ├─ de_lernen_stats.json ПРОГРЕСС пользователя — НИКОГДА не удалять
│  ├─ user_words.json      «Мои слова» + кэш переводов
│  └─ pronunciation.json   IPA (читает dq/phonetics.py)
│
├─ web/                    ← САЙТ
│  ├─ index.html           разметка всех экранов (+ ?v=N у css/js)
│  ├─ dq.js                ядро: state, API, тренажёр, группы, статистика, window.DQ
│  ├─ learn.js             window.DQLearn — 10 «фишек» учёбы
│  ├─ games.js             window.DQGames — 16 мини-игр
│  ├─ worksheets.js        window.DQWorksheets — задания (TASK_TYPES)
│  ├─ reading.js           window.DQReading — 21 генератор текстов A0–A2
│  ├─ tables.js            window.DQTables — таблицы грамматики
│  ├─ train.js             window.DQTrain — раздел «Тренировка» A0–B1 × 4 навыка
│  ├─ train/data-<lv>.js   контент тренировки (a0/a1/a2/b1)
│  ├─ extras.js            window.DQExtras — дневник/план/карточки/диктант/экзамен, Ctrl+K
│  ├─ mywords.js           window.DQMyWords — «Мои слова»
│  ├─ wordpop.js           карточка перевода по клику
│  ├─ sounds.js            экран «Немецкие звуки»
│  ├─ phonetics.js         window.DQVoice — голос/IPA в браузере
│  ├─ settings.js          window.SETTINGS — панель настроек (SCHEMA)
│  ├─ theme.js             window.DQ_THEME — палитры, DEFAULTS, apply()
│  ├─ fx.js / sound.js     анимации / WebAudio
│  ├─ nav.js               верхнее меню (группы с выпадашками)
│  ├─ glass.js             качество «жидкого стекла», авто-даунгрейд
│  ├─ glass.css            ГЛАВНЫЙ слой оформления (iOS, стекло, кнопки)
│  ├─ nav.css              меню и слой наложения шапки
│  ├─ extras.css           стили extras + сцена с var(--scene-bg)
│  ├─ style.css            база + панель настроек + «10 фишек»
│  ├─ stats.css / reading.css / train.css
│  └─ skin.css             старый слой (перекрывается glass.css)
│
├─ worksheets/*.json       задания/тесты (подхватываются без перезапуска)
│  ├─ a1-test.json         полный тест A1 (большой)
│  ├─ grammatik-a1-a2.json / zeitformen-6.json / wortschatz-themen.json
│  └─ grammatik-tables.json (только sections → экран «Таблицы»)
│
├─ dq/                     Python-пакет (web + desktop)
│  ├─ core.py              пути (BASE_DIR/CONTENT_DIR), темы, сравнение ответов, load/save stats
│  ├─ grammar.py           GRAMMAR_LESSONS, TEMPLATES, build_sentence (/api/game/sentences)
│  ├─ media.py             TTS-кэш, AudioPlayer, картинки (Wikipedia/Commons/PIL)
│  ├─ phonetics.py         IPA по словарю + правилам (/api/pron)
│  ├─ translate.py         перевод по клику, кэш в content/user_words.json
│  ├─ widgets.py / gamebase.py / app.py   Tk legacy — НЕ ТРОГАТЬ
│
├─ images/                 444 png + image_cache.json
├─ audio_cache/            mp3 (md5("<lang>_<text>")[:12].mp3); neural/ — «живой» голос
├─ pronunciations/         ipa_seed.py (ручной IPA)
├─ scripts/                cleanup.py, build_ipa.py, backup.py, Dockerfile, requirements.txt
├─ server_backups.py       вёрстка страниц /backups
├─ backups/                ВЕРСИИ: <ID>/code + <ID>/info + <ID>/ЗАМЕТКА.md + index.json
├─ backups/                снимки версий: <ID>/code + <ID>/info (prompt, changes, stats) + index.json
├─ tests/                  _smoke_via_eval.py/.mjs (живой QA через headless-браузер)
├─ _черновики/             старые deutsch_*.html (источники JSON) — только история
└─ .venv/                  локальное окружение (не коммитить)
```

---

## 2. ПОТОК ДАННЫХ (web)

```
GET  /api/data                 → группы (key,label,hint,count) + stats
GET  /api/pairs?keys=a,b       → {pairs, byGroup}
POST /api/save {patch}         → merge в stats (whitelist) → content/de_lernen_stats.json
POST /api/reset                → обнуление answered/correct/streak/xp/daily
GET  /api/worksheets, /api/worksheet/<id>
POST /api/worksheet/result     → best/attempts + xp
GET  /api/tables               → worksheets/grammatik-tables.json
GET  /api/game/sentences|emoji|phones|numbers
POST /api/game/record {key,value,mode,xp}
GET  /api/pron (POST со словами), /api/tts, /images/<file>
```

Сервер — единственное хранилище прогресса; JS шлёт патчи через `saveStats()` (дебаунс).

---

## 3. ПРАВИЛА ПРАВОК (обязательные)

1. **Пути** — только через `BASE_DIR` / `CONTENT_DIR` (dq/core.py). Новый файл данных — в `content/`.
2. **Кэш**: у css/js в `index.html` есть `?v=N` — при правке файла поднимать N.
3. **CSS-порядок**: правила побеждают по порядку и `!important`. Стиль панели настроек — в `glass.css` (блок 5),
   сцена — `var(--scene-bg)` (цвет ставит `theme.js:apply()`), НЕ хардкодить `#000`.
4. **Новое поле прогресса** → `handle_save.allowed` (server.py) **и** `_stats().allowed_ui` (для `ui.*`) **и**
   `DEFAULT_STATS` (dq/core.py).
5. **Новая настройка** → `theme.js:DEFAULTS` + `settings.js:SCHEMA` + (если влияет на вид) `theme.js:apply()` +
   `server.py:_stats().allowed_ui` + `handle_save.allowed`.
6. **Новый экран/раздел** → section в `index.html` + `nav.js:GROUPS`/`META` + `dq.js:showView` + CSS.
7. **Новый набор заданий** → просто `worksheets/*.json` (схема в `worksheets/README.md`).
8. **Задания «Тренировки»** → объект в `web/train/data-<lv>.js`. Варианты ответов в данных лежат с верным
   ПЕРВЫМ; `train.js:mixOptions()` перемешивает их при старте задания. В «Экзамене» — `extras.js:shuffleAnswers()`.
   Проверка правильности всегда **по индексу**, а не по тексту (бывают одинаковые варианты).
9. **Без `?v`-дырок**: новые файлы css/js не хардкодить без версии.
10. **Не трогать** `dq/app.py`, `dq/widgets.py`, `dq/gamebase.py` (Tk legacy) без прямой просьбы.
11. **Не трогать** `content/de_lernen_stats.json` руками — это прогресс пользователя.
12. **Не удалять** `.venv/`, `content/`, `images/`, `audio_cache/`, `worksheets/`, `_черновики/`.

---

## 4. ЭКРАНЫ (index.html → dq.js:showView)

`view-train` (тренажёр), `view-lernen` (Тренировка), `view-groups`, `view-games`, `view-worksheets`,
`view-reading`, `view-tables`, `view-stats`, `view-sounds`, `view-words`, + extras: `view-journal`,
`view-plan`, `view-cards`, `view-dictation`, `view-exam`.
Вне main: `#gameModal`, `#wsAction`, `#settingsOverlay`, `#cmdOverlay`, `#toast`, `#focusPill`.

Группы меню (nav.js): Учиться / Практика / Ритм / Моё / Статистика.

---

## 5. ГДЕ ЧТО ИСКАТЬ (типовые задачи)

| Задача | Файлы |
|---|---|
| Слова/группа | `content/words.txt` |
| Числа/фразы | `content/numbers.txt`, `content/phrases.txt` |
| Задание/тест | новый `worksheets/*.json`; новый тип — `web/worksheets.js:TASK_TYPES` |
| Текст чтения | `web/reading.js:TEMPLATES` |
| Задание «Тренировки» | `web/train/data-<a0|a1|a2|b1>.js` |
| Мини-игра | `web/games.js` (CATALOG + round + START) |
| Новый экран/фича | `web/extras.js` + section в index.html + nav.js |
| Настройки/темы | `web/theme.js`, `web/settings.js` |
| Фишка учёбы | `web/learn.js` + хуки в `dq.js` |
| Внешний вид | `web/glass.css` (файл последней правды) |
| Статистика | конец `web/style.css` + `web/stats.css` |
| Грамматические шаблоны | `dq/grammar.py` (общие для web/Tk) |
| IPA / транскрипция | `dq/phonetics.py` + `content/pronunciation.json`, `scripts/build_ipa.py` |
| Перевод по клику | `dq/translate.py` + `web/wordpop.js` |
| Прогресс (ключи) | `server.py:handle_save` + `_stats()`, `dq/core.py:DEFAULT_STATS` |

---

## 6. ГРАБЛИ (проверено)

1. `?v=N` в index.html — поднимать всегда.
2. `glass.css` лежит **позже** `nav.css` → его правила побеждают; `!important` без нужды не добавлять, но для позиции/слоёв можно.
3. `header.topbar { display:flex }` обязателен — иначе правило `article, aside, header…` в nav.css делает шапку
   flex-элементом, и `position: sticky` перестаёт работать.
4. Шапка — родитель выпадающих меню: у неё нужен свой слой (`z-index`), иначе `.wrap` перекрывает меню.
5. `learn.js` — IIFE с `const` внизу: не обращаться к переменной до её объявления (TDZReferenceError
   валит весь модуль, а заодно `SETTINGS.apply()` — симптом «настройки не применяются»).
6. Панель настроек — отдельная палитра `--set-*` в `.settings-card`; прокрутка — `.settings-body{overflow-y:auto}`.
7. PowerShell + кириллица: `Get-Content ... -Encoding UTF8`; для JSON `-Raw -Encoding UTF8`.
8. Проверка фронта — headless-браузером (`tests/_smoke_via_eval.mjs`, patchright), потом удалить скриншоты.
9. Уборка после работы: `python scripts/cleanup.py --dry`, потом `--apply`. В корне не должно быть `_*`-мусора,
   `node_modules`, `package.json`. Документация (`_*.md`) защищена в скрипте.
10. Два вида проверки ответа: `norm/similarity/is_typo_match` (Python) и `norm/similar/matchAnswer` (JS).
    Ответ «mit = с; из» принимается по любому варианту (`splitVariants`).
11. Числа/телефоны не смешивать со словами в дистракторах (`looks_numeric`).
12. **`backups/`** не входит в снимки и не редактируется руками; `index.json` — источник истины
    для страницы `/backups`. `SKIP_DIRS` в `scripts/backup.py` держит кэши (images/audio_cache) снаружи.
