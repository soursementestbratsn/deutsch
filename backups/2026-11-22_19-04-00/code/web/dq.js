/* ============================================================
   Deutsch Quest — веб-версия.
   Мультивыбор групп: числа + техника + фразы — в одном пуле.
   ============================================================ */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  groups: [],          // [{key, label, hint, count}]
  enabled: [],         // выбранные группы
  pending: [],         // черновик выбора на экране «Группы»
  stats: {},
  pool: [],            // пары [[de, ru], ...]
  taken: new Set(),    // уже показанные в текущей пачке
  queue: [],           // запас вопросов
  current: null,       // {de, ru}
  answered: false,
  direction: "de-ru",  // de-ru | ru-de
  inputType: "type",   // choice | type | speak
  sessionAnswered: 0,
  sessionCorrect: 0,
  streak: 0,
  poolLoading: null,
  dueMode: false,      // «Повторить забытое» — пул только из SRS
  hintShown: false,    // уже показана подсказка
  visible: [],         // текущий круг слов (без повторок): пока не пройден — пул не пересобирается
  roundStart: false,   // круг уже начат (для тоста «круг пройден»)
  roundTotal: 0,       // размер текущего круга
  wrong: new Set(),    // слова, по которым ошиблись в текущем круге (в конец круга)
};

/* ---------------- утилиты ---------------- */
const norm = (s) => String(s || "")
  .toLowerCase()
  .replace(/[„“"'`’]/g, "")
  .replace(/[.,;:!?…]/g, "")
  .replace(/\s+/g, " ")
  .trim();

/* «mit = с; из; имеющий» — ответ принимается, если он совпал
   с любым из вариантов. Без этого навык «без повторок» по такому
   слову никогда не мог бы закончиться. */
const splitVariants = (s) => String(s || "")
  .split(/[;\/|]|\s+или\s+/i)
  .map((v) => v.trim())
  .filter((v) => v && v !== "-" && v !== "—");

function similar(a, b) {
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  let prev = [];
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

function isTypo(user, expected) {
  if (!user || !expected) return false;
  return similar(user.replace(/\s+/g, ""), expected.replace(/\s+/g, "")) >= 0.82;
}

/** Сколько букв можно напутать (по длине ответа). Э.д. расстояния Левештейна. */
function typoLimit(len) {
  if (len <= 2) return 0;
  if (len <= 5) return 1;
  return 2;
}
function editDistance(a, b) {
  const m = a.length, n = b.length;
  let prev = [];
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
/* Сколько «букв напутано» между ответом и вариантом: число или Infinity. */
function typoDistance(user, expected) {
  const u = norm(user).replace(/\s+/g, ""), e = norm(expected).replace(/\s+/g, "");
  if (!u || !e) return Infinity;
  return editDistance(u, e);
}

/**
 * Насколько «жёстко» проверяем ввод. Порог берётся из настроек строгости
 * (SETTINGS.ui.tolerance):
 *   0 — только точное написание;
 *   1 — можно одну букву;
 *   2 — общая «нейтральная» планка (как было всегда);
 *   3 — «чуть не так»: до 2 букв и похожий ответ (≥82%).
 * Длинные слова не дают «пробраться» случайным ответам: допуск растёт
 * только вместе с длиной слова (см. typoLimit).
 */
function toleranceLevel() {
  const v = Number((window.SETTINGS && window.SETTINGS.ui.tolerance));
  return Number.isFinite(v) ? Math.max(0, Math.min(3, Math.round(v))) : 2;
}
function matchAnswer(user, expected) {
  const u = norm(user), e = norm(expected);
  if (!u || !e) return false;
  if (u === e) return true;
  const level = toleranceLevel();
  if (level === 0) return false;
  const dist = typoDistance(u, e);
  const base = Math.max(u.replace(/\s+/g, "").length, e.replace(/\s+/g, "").length);
  const hard = typoLimit(base);            // «жёсткий» допуск по длине
  if (level === 1) return dist <= Math.min(1, hard);
  if (level === 2) return isTypo(u, e);    // прежнее поведение (≈82% похожести)
  // «чуть не так»: для длинных слов — до 2 букв и ≥82% похожести;
  // для коротких (3–5 букв) — одна буква (у «Haus» одна замена = уже 75%).
  if (base <= 5) return dist <= 1;
  return dist <= hard && similar(u, e) >= 0.82;
}

/** Совпал ли ввод хотя бы с одним вариантом ответа («с», «из», «имеющий»). */
function matchAnyAnswer(user, expected) {
  return splitVariants(expected).some((v) => matchAnswer(user, v));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toast(text, kind = "", action) {
  const el = $("#toast");
  // не растягиваем на экран: длинное — в одну строку с многоточием
  const s = String(text);
  el.textContent = s.length > 90 ? s.slice(0, 90) + "…" : s;
  el.title = s;
  if (action && action.label) {
    const b = document.createElement("button");
    b.className = "toast-act";
    b.textContent = action.label;
    b.onclick = (e) => { e.stopPropagation(); action.run && action.run(); el.className = "toast " + kind; };
    el.appendChild(b);
  }
  el.className = "toast show " + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = "toast " + kind; }, action ? 5200 : 2400);
}

/* ---------------- произношение: голос, транскрипция, «S» ---------------- */
const say = (text, lang = "de", opts) => (window.DQVoice || { say: () => {} }).say(text, lang, opts);
const saySlow = (text, lang = "de") => (window.DQVoice || { slow: () => {} }).slow(text, lang);

function pronCard(word, opts) {
  return (window.DQPhon && window.DQPhon.card(word, opts)) || "";
}

/** Показать карточку транскрипции под вопросом (настраиваемо). */
function renderPhon(word) {
  const box = $("#phonBox");
  if (!box) return;
  const ui = (window.SETTINGS && window.SETTINGS.ui) || {};
  if (ui.showPron === false || !word || !/[A-Za-zÄÖÜäöüß]/.test(word)) { box.innerHTML = ""; return; }
  const html = pronCard(word);
  box.innerHTML = html;
  if (html) window.DQPhon.bind(box);
}

/* ---------------- сервер ---------------- */
async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(path + " → HTTP " + res.status);
  return res.json();
}

function saveStats(patch) {
  Object.assign(state.stats, patch);
  // Оптимизация: не шлём POST на каждый ответ. Копим изменения и отправляем
  // одним запросом не чаще раза в 700 мс (+ гарантированно при уходе со страницы).
  saveStats._queue = { ...(saveStats._queue || {}), ...patch };
  clearTimeout(saveStats._t);
  saveStats._t = setTimeout(flushStats, 700);
}

function flushStats() {
  const body = saveStats._queue;
  if (!body) return;
  saveStats._queue = null;
  const json = JSON.stringify(body);
  if (navigator.sendBeacon) {
    // не держит вкладку и не теряется при закрытии
    try {
      navigator.sendBeacon("/api/save", new Blob([json], { type: "application/json" }));
      return;
    } catch (e) { /* fallback ниже */ }
  }
  fetch("/api/save", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: json,
  }).catch(() => {});
}
window.addEventListener("pagehide", flushStats);
window.addEventListener("beforeunload", flushStats);

/* ---------------- группы ---------------- */
const groupLabelRaw = (key) => (state.groups.find((g) => g.key === key) || {}).label || key;
// В интерфейсе названия короче: «Базовый словарь из Duolingo и школы + повседневные слова»
// → «Базовый словарь».
/* Короткие имена для длинных заголовков групп (ключ — начало полного названия). */
const SHORT_GROUPS = [
  [/^Базовый словарь/i, "Базовый словарь"],
  [/^Повседневные/i, "Повседневные"],
  [/^Здания/i, "Здания и город"],
  [/^Направления/i, "Направления"],
  [/^Безопасность/i, "Безопасность"],
  [/^Опасности/i, "Опасности"],
  [/^Кухонная/i, "Кухня"],
  [/^Стороны света/i, "Стороны света"],
  [/^Инструменты/i, "Инструменты"],
  [/^Математика/i, "Математика"],
];
const groupLabel = (key) => {
  const raw = groupLabelRaw(key);
  const hit = SHORT_GROUPS.find(([re]) => re.test(raw));
  if (hit) return hit[1];
  // общий случай: убираем хвост «… и …», если получилось длинно
  const cut = raw.split(/[,+(]/)[0].replace(/\s+(и|из|с)\s+.*$/i, "").trim();
  return cut.length >= 3 ? cut : raw;
};
const groupCount = (key) => (state.groups.find((g) => g.key === key) || {}).count || 0;
const toggleKey = (list, key) => list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

function renderChips() {
  const box = $("#sideChips");
  box.innerHTML = "";
  if (!state.enabled.length) {
    box.innerHTML = '<span class="muted">Ничего не выбрано</span>';
    return;
  }
  // первые 4 группы — словами, остальное — «+N», иначе список занимает пол-экрана
  const MAX = 4;
  state.enabled.slice(0, MAX).forEach((key) => {
    const el = document.createElement("span");
    el.className = "chip on static";
    el.innerHTML = '<i class="dot"></i>';
    el.append(document.createTextNode(groupLabel(key)));
    el.title = groupLabel(key);
    box.appendChild(el);
  });
  if (state.enabled.length > MAX) {
    const more = document.createElement("span");
    more.className = "chip on static";
    more.textContent = `+${state.enabled.length - MAX}`;
    more.title = state.enabled.slice(MAX).map(groupLabel).join(", ");
    box.appendChild(more);
  }
}

function renderSelectedDraft() {
  const box = $("#selectedChips");
  box.innerHTML = "";
  if (!state.pending.length) {
    box.innerHTML = '<span class="muted">Ни одной группы — отметьте хотя бы одну.</span>';
  }
  state.pending.forEach((key) => {
    const el = document.createElement("span");
    el.className = "chip on";
    el.innerHTML = '<i class="dot"></i>';
    el.append(document.createTextNode(groupLabel(key)));
    const x = document.createElement("span");
    x.textContent = "×";
    x.style.marginLeft = "2px";
    x.onclick = (e) => {
      e.stopPropagation();
      state.pending = toggleKey(state.pending, key);
      renderGroupsScreen();
    };
    el.appendChild(x);
    box.appendChild(el);
  });
  $("#pickedInfo").textContent = `Выбрано: ${state.pending.length} из ${state.groups.length}`;
}

function renderGroupsScreen() {
  const grid = $("#groupGrid");
  const filter = norm($("#groupSearch").value);
  grid.innerHTML = "";
  state.groups.forEach((g) => {
    const on = state.pending.includes(g.key);
    const card = document.createElement("div");
    card.className = "group-card fx-item" + (on ? " on" : "");
    card.dataset.key = g.key;
    card.innerHTML = '<div class="gc-check">' + (on ? "✓" : "") + "</div>";
    const text = document.createElement("div");
    text.innerHTML = '<div class="gc-name"></div><div class="gc-hint"></div>';
    text.querySelector(".gc-name").textContent = g.label;
    text.querySelector(".gc-hint").textContent = g.hint;
    card.appendChild(text);
    if (filter && !norm(g.label + " " + g.hint).includes(filter)) card.classList.add("hidden");
    card.onclick = () => {
      state.pending = toggleKey(state.pending, g.key);
      renderGroupsScreen();
    };
    grid.appendChild(card);
  });
  renderSelectedDraft();
}

function renderNavBadge() {
  $("#navGroupsBadge").textContent = state.enabled.length;
  const total = state.enabled.map(groupCount).filter((n) => n > 0).reduce((a, b) => a + b, 0);
  // короткая строка в шапке; полный список — в подсказке (title)
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  const groups = state.enabled.length;
  const gTxt = `${groups} ${plural(groups, "группа", "группы", "групп")}`;
  const wTxt = `${total} ${plural(total, "слово", "слова", "слов")}`;
  $("#poolInfo").textContent = groups ? `${gTxt} · ${wTxt}` : "выберите группы";
  $("#poolInfo").title = state.enabled.map(groupLabel).join(", ");
}

function openGroupsView() {
  state.pending = [...state.enabled];
  $("#groupSearch").value = "";
  renderGroupsScreen();
  showView("groups");
  if (window.DQFX) window.DQFX.stagger($("#groupGrid"));
}

function applyMode() {
  $$("#direction button").forEach((b) => b.classList.toggle("active", b.dataset.dir === state.direction));
  $$("#inputType button").forEach((b) => b.classList.toggle("active", b.dataset.input === state.inputType));
}

async function applyGroups(keys) {
  if (!keys.length) { toast("Выберите хотя бы одну группу", "bad"); return; }
  state.enabled = keys.slice();
  state.dueMode = false;
  state.stats.needs_choice = false;
  state.direction = state.stats.direction === "ru-de" ? "ru-de" : "de-ru";
  state.inputType = state.stats.input_type === "choice" ? "choice" : "type";
  saveStats({ enabled_groups: state.enabled, mode: "Мультивыбор", needs_choice: false });
  renderChips();
  renderNavBadge();
  applyMode();
  state.pool = [];
  state.queue = [];
  state.visible = [];
  await loadPool();
  newSession();
  showView("train");
  toast(`Групп выбрано: ${keys.length}`, "ok");
  window.DQSND && window.DQSND.open();
  if (window.DQFX) window.DQFX.confetti();
}

/* ---------------- пул слов ---------------- */
async function loadPool() {
  if (!state.enabled.length) {
    state.pool = [];
    state.poolLoading = null;
    return;
  }
  const keys = encodeURIComponent(state.enabled.join(","));
  const due = state.dueMode ? "&due=1" : "";
  try {
    const data = await api(`/api/pairs?keys=${keys}${due}`);
    state.pool = data.pairs || [];
    // без повторок: пул можно менять только когда круг слов пройден,
    // иначе следующая догрузка вернёт уже пройденные слова
    state.visible = noRepeatOn() ? [] : state.pool.slice();
    window._poolByGroup = data.byGroup || {};
    // транскрипция пришла вместе со словами — ничего дополнительно не грузим
    if (data.pron && window.DQPhon) window.DQPhon.seed?.(data.pron);
    if (state.dueMode && !state.pool.length) {
      state.dueMode = false;
      toast("На сегодня всё повторено", "ok");
      return loadPool();
    }
  } catch (e) {
    state.pool = [];
    toast("Не удалось загрузить слова: " + e.message, "bad");
  }
  state.taken = new Set();
  state.poolLoading = null;
}

/* НАСТРОЙКА «без повторок»: ON — каждое слово в круге по одному разу,
   OFF — прошлое поведение (случайные слова, повторы возможны). */
const noRepeatOn = () => {
  let v = null;
  try {
    v = window.SETTINGS && window.SETTINGS.ui ? window.SETTINGS.ui.noRepeat : null;
  } catch (e) { v = null; }
  if (v === undefined || v === null) return true;   // по умолчанию включено
  return v !== false;
};

function nextFromPool() {
  if (noRepeatOn()) return nextFromRound();
  const fresh = state.pool.filter((p) => !state.taken.has(p[0]));
  if (!fresh.length) {
    state.taken = new Set();
    return nextFromPool();
  }
  const pair = fresh[Math.floor(Math.random() * fresh.length)];
  state.taken.add(pair[0]);
  return { de: pair[0], ru: pair[1] };
}

/**
 * Слова «по одному разу»: каждый круг — перемешанный список всех слов.
 * Верно ответил / «показал ответ» / пропустил — слово больше не спросится,
 * пока круг не закончится. Новые догруженные слова ставим в начало круга.
 */
function nextFromRound() {
  if (!state.visible.length) {
    // круг пуст: либо пройден, либо ещё не начат → новый круг всех слов
    const wasStarted = state.roundStart;
    const fresh = state.pool.filter((p) => !state.taken.has(p[0]));
    // догруженные слова (если пул вырос) — в начало нового круга
    state.visible = shuffle(fresh.length ? fresh : state.pool.slice());
    state.taken = new Set();
    state.roundTotal = state.visible.length;
    state.roundStart = true;
    if (wasStarted && state.visible.length) {
      toast("Круг пройден — те же слова заново, в другом порядке", "ok");
      window.DQSND && window.DQSND.levelUp();
    }
  }
  const pair = state.visible.shift();
  state.taken.add(pair[0]);
  return { de: pair[0], ru: pair[1] };
}

/** Пройдено / всего в текущем круге (для бейджа сессии). */
function roundProgress() {
  const total = state.roundTotal || state.visible.length || state.pool.length;
  return { done: Math.max(0, total - state.visible.length), total };
}

/** Сменить режим повторок «на лету» (из настроек): обновить круг и бейдж. */
function syncNoRepeat() {
  if (!noRepeatOn()) {
    state.visible = [];
    state.taken = new Set();
    state.wrong.clear();
  } else if (!state.visible.length && state.pool.length) {
    // начинаем круг прямо сейчас; текущий (ещё не отвеченный) вопрос
    // сразу учтём в нём, чтобы не было двойного счётчика
    state.visible = shuffle(state.pool.slice());
    state.roundTotal = state.visible.length;
    state.roundStart = true;
    const cur = state.current;
    if (cur && !state.answered) {
      const idx = state.visible.findIndex((p) => p[0] === cur.de);
      if (idx > 0) [state.visible[0], state.visible[idx]] = [state.visible[idx], state.visible[0]];
    }
    state.taken = new Set();
  }
  updateSessionStats(true);
}

/* ---------------- тренажёр ---------------- */
function newSession() {
  state.queue = [];
  state.sessionAnswered = 0;
  state.sessionCorrect = 0;
  state.streak = 0;
  state.visible = [];
  state.taken = new Set();
  state.wrong.clear();
  state.roundStart = false;
  state.roundTotal = 0;
  // загрузка пула уже идёт (или завершена) — не дублируем запрос
  state.poolLoading = state.poolLoading || (state.pool.length ? null : loadPool());
  updateSessionStats(true);
  nextQuestion();
}

function updateSessionStats(skipPool) {
  const answered = state.sessionAnswered;
  $("#sAnswered").textContent = answered;
  $("#sCorrect").textContent = state.sessionCorrect;
  $("#sAcc").textContent = answered ? Math.round((state.sessionCorrect / answered) * 100) + "%" : "–";
  const streakEl = $("#streakVal");
  if (streakEl) streakEl.textContent = state.streak;
  const streakBox = $("#streak");
  if (streakBox) streakBox.title = `Серия: ${state.streak}`;
  const goal = Math.max(1, Number((window.SETTINGS && window.SETTINGS.ui.dailyGoal) || 10));
  $("#bar").style.width = Math.min(100, (answered / goal) * 100) + "%";
  $("#tAnswered").textContent = state.stats.answered || 0;
  $("#tStreak").textContent = state.stats.best_streak || 0;
  $("#lvl").textContent = Math.max(1, Math.floor((state.stats.xp || 0) / 100) + 1);
  $("#xp").textContent = state.stats.xp || 0;
  const learnedEl = $("#tLearned");
  if (learnedEl) learnedEl.textContent = srsLearned();
  const badgeEl = $("#badge");
  if (badgeEl) {
    const r = roundProgress();
    const n = state.sessionAnswered;
    const nTxt = n === 0 ? "Сессия" : `Сессия · ${n} ${n === 1 ? "ответ" : n < 5 ? "ответа" : "ответов"}`;
    badgeEl.textContent = (noRepeatOn() && state.roundStart)
      ? `${nTxt} · круг ${r.done}/${r.total}`
      : nTxt;
  }
  updateGoals();
  updateDueBadge();
  // минимальный пул для игр — общий для тренажёра и игр; без рекурсии при ошибке
  if (!skipPool && !state.pool.length && !state.poolLoading) state.poolLoading = loadPool();
}

/* --- цель дня: кольцо + счётчик (daily_answers приходит с сервера) --- */
function updateGoals() {
  const ring = $("#goalRing");
  const txt = $("#goalTxt"), pctEl = $("#goalPct");
  if (!ring || !txt) return;
  const goal = Math.max(1, Number((window.SETTINGS && window.SETTINGS.ui.dailyGoal) || 10));
  // дневной счётчик сбрасывается на новый день (сервер хранит last_day)
  const d = new Date();
  const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (state.stats.last_day && state.stats.last_day !== todayKey && (state.stats.daily_answers || 0) > 0) {
    state.stats.daily_answers = 0;
    state.stats.last_day = todayKey;
    saveStats({ daily_answers: 0, last_day: todayKey });
  }
  const today = Math.max(0, Number(state.stats.daily_answers) || 0);
  const pct = Math.min(100, Math.round((today / goal) * 100));
  ring.style.setProperty("--p", pct);
  if (pctEl) pctEl.textContent = pct + "%";
  txt.textContent = pct >= 100 ? `${today} готово` : `${today} / ${goal}`;
  ring.title = pct >= 100 ? `Цель дня выполнена: ${today} из ${goal}` : `Ещё ${goal - today} — и цель дня`;
  if (pct >= 100 && !updateGoals._fired) {
    updateGoals._fired = true;
    toast("Цель дня выполнена", "ok");
    window.DQSND && window.DQSND.levelUp();
  }
  if (pct < 100) updateGoals._fired = false;
}

/* --- бейдж «повторить N» в шапке и кнопка в тренажёре --- */
function updateDueBadge() {
  const due = srsDue();
  const n = due.length;
  const pill = $("#duePill"), btn = $("#dueBtn"), cnt = $("#dueCount"), bc = $("#dueBtnCount");
  if (pill) { pill.hidden = !n; }
  if (btn) { btn.hidden = !n; }
  if (cnt) cnt.textContent = n;
  if (bc) bc.textContent = n;
}

/** «Повторить забытое»: новый пул только из слов, у которых прошёл интервал. */
async function startDueSession() {
  const due = srsDue();
  if (!due.length) { toast("Повторять нечего — всё свежее", "ok"); return; }
  state.dueMode = true;
  state.enabled = state.enabled.length ? state.enabled : state.groups.map((g) => g.key);
  await loadPool();
  newSession();
  showView("train");
  toast(`Повторяем ${due.length} слов`, "ok");
}

function valueKind(v) {
  const s = String(v || "").trim();
  if (!s) return "other";
  if (/^\+?[\d][\d\s./()-]{5,}$/.test(s)) return "phone";
  if (/^[\d][\d\s.,]*$/.test(s)) return "number";
  // фраза = есть точка/вопрос/восклицание или 4+ слова
  if (/[.!?]\s*$/.test(s) || s.split(/\s+/).length >= 4) return "phrase";
  return "word";
}

function pickDistractors(correct, n = 3) {
  // Дистракторы — того же вида, что и правильный ответ:
  // на фразу не подставляем одно слово и наоборот. Фраза — только фразы.
  const want = valueKind(correct);
  const seen = new Set([norm(correct)]);
  const same = [], other = [];
  for (const p of shuffle(state.pool)) {
    const val = state.direction === "de-ru" ? p[1] : p[0];
    const k = norm(val);
    if (seen.has(k)) continue;
    seen.add(k);
    (valueKind(val) === want ? same : other).push(val);
  }
  let pool = same;
  // для слов допустимо добирать другими словами (не фразами и не цифрами)
  if (pool.length < n && want === "word") {
    pool = pool.concat(other.filter((v) => valueKind(v) === "word"));
  }
  // последний шанс для числа/телефона — то же семейство «цифр»
  if (pool.length < n && (want === "number" || want === "phone")) {
    pool = pool.concat(other.filter((v) => ["number", "phone"].includes(valueKind(v))));
  }
  return pool.slice(0, n);
}

let opening = null;

/** Пары из пула, по которым были ошибки (stats.mistakes хранит [de, ru]). */
function mistakePairs(src) {
  const list = Array.isArray(state.stats.mistakes) ? state.stats.mistakes : [];
  const bad = new Set(list.map((m) => (Array.isArray(m) ? m[0] : m && m.de)).filter(Boolean));
  if (!bad.size) return [];
  const pool = src && src.length ? src : state.pool;
  return pool.filter((p) => bad.has(p[0]));
}

async function nextQuestion() {
  state.answered = false;
  $("#feedback").textContent = "";
  $("#feedback").className = "feedback";
  $("#nextBtn").disabled = true;

  if (!state.pool.length) {
    if (!opening) opening = loadPool().then(() => { opening = null; });
    await opening;
  }
  // Фишка 4/5: сначала вернуть слово, где ошиблись, потом — обратный вопрос
  const L = window.DQLearn;
  let q = null;
  if (L && state.pool.length) {
    const src = noRepeatOn() && state.visible.length ? state.visible : state.pool;
    const rev = L.takeReverse(state.current && state.current.de);
    q = rev || L.dueSoon(src, state.current && state.current.de);
  }
  // «Только слова с ошибками» — тренажёр по слабым местам (ui.mistakeOnly)
  if (!q) {
    const ui = (window.SETTINGS && window.SETTINGS.ui) || {};
    if (ui.mistakeOnly) {
      const src = noRepeatOn() && state.visible.length ? state.visible : state.pool;
      const bad = mistakePairs(src);
      if (bad.length) q = bad[Math.floor(Math.random() * Math.min(8, bad.length))];
      else if (state.pool.length) window.DQ.toast("Слабых слов пока нет — учим всё подряд");
    }
  }
  presentQuestion(q || (state.queue.length ? state.queue.shift() : nextFromPool()));
}

function presentQuestion(q) {
  $("#nextBtn").disabled = true;
  if (!q) {
    // пустой пул = пользователь ещё не выбрал группы: показываем действие, а не тупик
    $("#qText").textContent = state.enabled.length
      ? "В выбранных группах нет слов"
      : "Сначала выберите группы";
    $("#qGroup").textContent = "";
    $("#answerArea").innerHTML = `
      <div class="g-actions">
        <button class="btn primary" id="goGroups">Отметить группы</button>
        ${state.enabled.length ? '<button class="btn ghost" id="goGroupsOne">Добавить ещё</button>' : ""}
      </div>`;
    const go = () => { window.DQSND && window.DQSND.open(); openGroupsView(); };
    const a = $("#goGroups"); if (a) a.onclick = go;
    const b = $("#goGroupsOne"); if (b) b.onclick = go;
    return;
  }
  state.current = q;
  const askDe = state.direction === "de-ru";
  state.hintShown = false;
  // новая карточка: мягкое появление + тишина (звук выбора уже сыграл)
  if (window.DQFX) {
    window.DQFX.stagger($("#answerArea"));
    window.DQFX.pop($("#question"));
  }
  const ui = (window.SETTINGS && window.SETTINGS.ui) || {};
  const isDeQuestion = askDe && /[A-Za-zÄÖÜäöüß]/.test(q.de);
  $("#qGroup").textContent = askDe ? "Переведите на русский" : "Übersetze ins Deutsche";
  $("#qText").textContent = askDe ? q.de : q.ru;
  $("#badge").textContent = state.sessionAnswered ? `Сессия · ${state.sessionAnswered}` : "Сессия";
  $("#qText").classList.remove("q-blur");

  const area = $("#answerArea");
  area.innerHTML = "";

  /* --- кнопки озвучки --- */
  const tools = $("#qTools");
  if (tools) {
    tools.innerHTML = "";
    if (/[A-Za-zÄÖÜäöüß]/.test(q.de)) {
      const b1 = document.createElement("button");
      b1.className = "q-say";
      b1.innerHTML = '<span class="ico ico-vol"></span> Слушать';
      b1.title = "Произнести по-немецки (S)";
      b1.onclick = () => { say(q.de, "de"); b1.classList.add("pulse"); setTimeout(() => b1.classList.remove("pulse"), 700); };
      const b2 = document.createElement("button");
      b2.className = "q-say";
      b2.innerHTML = '<span class="ico ico-slow"></span> Медленно';
      b2.onclick = () => saySlow(q.de, "de");
      tools.append(b1, b2);
    }
    if (state.inputType === "speak") $("#qText").classList.add("q-blur");
  }

  /* --- подсказка / показать ответ --- */
  const help = $("#qHelp");
  if (help) {
    help.innerHTML = "";
    const hb = document.createElement("button");
    hb.className = "link-btn";
    hb.textContent = "подсказка";
    hb.onclick = () => showHint();
    const ab = document.createElement("button");
    ab.className = "link-btn";
    ab.textContent = "показать ответ";
    ab.onclick = () => revealAnswer();
    help.append(hb, ab);
  }

  const correct = askDe ? q.ru : q.de;
  const isWords = !!q && /[A-Za-zÄÖÜäöüß]/.test(askDe ? q.de : q.ru);

  if (state.inputType === "choice") {
    const grid = document.createElement("div");
    grid.className = "options";
    shuffle([correct, ...pickDistractors(correct)]).forEach((opt) => {
      const b = document.createElement("button");
      b.className = "opt";
      b.textContent = opt;
      b.onclick = () => checkChoice(b, opt);
      grid.appendChild(b);
    });
    area.appendChild(grid);
  } else if (state.inputType === "speak") {
    const row = document.createElement("div");
    row.className = "type-row";
    row.innerHTML = `<button class="mic-btn" id="micBtn" title="Нажми и говори"><span class="ico ico-mic"></span></button>
      <div class="mic-hint" id="micHint">Нажми на микрофон и произнеси ответ по-немецки</div>`;
    area.appendChild(row);
    const mb = $("#micBtn");
    mb.onclick = () => startSpeaking(mb);
    $("#qText").classList.add("q-blur");   // слышим по-русски — отвечаем по-немецки
    $("#qText").onclick = () => { $("#qText").classList.remove("q-blur"); speakRu(q.ru); };
  } else {
    const row = document.createElement("div");
    row.className = "type-row";
    const input = document.createElement("input");
    input.className = "input";
    input.placeholder = askDe ? "Перевод на русский…" : "Auf Deutsch…";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.onkeydown = (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (state.answered) nextQuestion();
      else checkTyped(input);
    };
    row.appendChild(input);
    area.appendChild(row);
    setTimeout(() => input.focus(), 30);
  }

  /* --- транскрипция и автоозвучка --- */
  const showPron = ui.showPron !== false;
  const sayText = isDeQuestion ? q.de : (/[A-Za-zÄÖÜäöüß]/.test(q.de) ? q.de : "");
  if (showPron && sayText) {
    if (window.DQPhon && !window.DQPhon.get(sayText)) {
      // нет в кэше — догружаем и рисуем по приходу
      $("#phonBox").innerHTML = "";
      window.DQPhon.prepare([sayText]).then(() => {
        if (state.current === q) renderPhon(sayText);
      });
    } else renderPhon(sayText);
  } else $("#phonBox").innerHTML = "";

  if (ui.autoSay !== false && /[A-Za-zÄÖÜäöüß]/.test(q.de)) {
    // Фишка «Первое слово — медленно»: новое слово проговариваем помедленнее
    const first = !state.taken.has(q.de) && ui.slowFirstAnswer !== false;
    setTimeout(() => { if (state.current === q && !state.answered) (first ? saySlow : say)(q.de, "de"); }, 260);
  }
  // Фишки 1/2/9: слово дня, подсказка по фразе, «куда нажать»
  if (window.DQLearn) {
    window.DQLearn.renderWordOfDay();
    const tipEl = $("#learnTip");
    if (tipEl) tipEl.textContent = window.DQLearn.tip();
    const ex = window.DQLearn.explain(askDe ? q.de : "", askDe ? q.ru : "");
    const box = $("#learnExplain");
    if (box) box.innerHTML = ex;
  }
  // следующее слово уже готово к моменту нажатия «Дальше»
  if (window.DQVoice && state.pool.length) {
    const src = noRepeatOn() ? state.visible : state.pool;
    const fresh = src.filter((p) => !state.taken.has(p[0]));
    const nxt = (fresh.length ? fresh : src)[Math.floor(Math.random() * Math.min(6, (fresh.length ? fresh : src).length))];
    if (nxt && /[A-Za-zÄÖÜäöüß]/.test(nxt[0])) window.DQVoice.prewarm(nxt[0], "de");
  }
}

/* --- «понимание на слух» прямо в тренажёре --- */
function speakRu(text) {
  if (!text) return;
  say(text, "ru");
}

/** Подсказка: первая буква + длина + перевод-синоним. */
function showHint() {
  const q = state.current;
  if (!q || state.answered) return;
  if (state.hintShown) return;        // повторное нажатие — без второго штрафа
  state.hintShown = true;
  const correct = expectedAnswer();
  const first = correct.charAt(0);
  const words = correct.split(/\s+/).length;
  const box = document.createElement("div");
  box.className = "q-hint";
  box.innerHTML = state.direction === "de-ru"
    ? `Начинается на «<b>${first}</b>», ${correct.length} букв. ${words > 1 ? `Слов: ${words}.` : ""}`
    : `Немецкое слово начинается на «<b>${first}</b>» · ${correct.length} букв`;
  $("#phonBox").appendChild(box);
  window.DQSND && window.DQSND.tap();
}

/** «Показать ответ» — это проигранный вопрос (без XP, запоминается). */
function revealAnswer() {
  if (state.answered || !state.current) return;
  const correct = expectedAnswer();
  const fb = $("#feedback");
  fb.className = "feedback warn";
  fb.textContent = "Ответ: " + correct;
  if (/[A-Za-zÄÖÜäöüß]/.test(state.current.de)) say(state.current.de, "de");
  registerAnswer(false, 0);            // 0 XP: посмотрел ответ — всё равно помним слово
  autoAdvance(1400);
}

function expectedAnswer() {
  const q = state.current;
  if (!q) return "";
  return state.direction === "de-ru" ? q.ru : q.de;
}

function registerAnswer(correct, points) {
  const gain = typeof points === "number" ? points : (correct ? 10 : 2);
  state.answered = true;
  state.sessionAnswered++;
  if (correct) { state.sessionCorrect++; state.streak++; }
  else {
    // Фишка «Опечатка не сбрасывает серию» (ui.typoStreakFreeze)
    const uic = (window.SETTINGS && window.SETTINGS.ui) || {};
    const typo = uic.typoStreakFreeze !== false && state.streak > 0 && !state.hintShown;
    if (!typo) state.streak = 0;
  }
  if (window.DQFX) window.DQFX.flip($("#streakVal"), state.streak);
  const st = state.stats;
  state.stats.answered = (st.answered || 0) + 1;
  state.stats.correct = (st.correct || 0) + (correct ? 1 : 0);
  state.stats.xp = (st.xp || 0) + gain;
  state.stats.best_streak = Math.max(st.best_streak || 0, state.streak);
  // интервальное повторение: отметка слова (время меняется только здесь)
  srsRecord(state.current && state.current.de, correct);
  // «Слабые места»: запоминаем ошибки (de, ru), максимум 200 последних
  if (!correct && state.current && /[A-Za-zÄÖÜäöüß]/.test(state.current.de)) {
    const list = Array.isArray(state.stats.mistakes) ? state.stats.mistakes.slice() : [];
    const de = state.current.de;
    const at = list.findIndex((m) => m && m[0] === de);
    if (at >= 0) list.splice(at, 1);          // не дублируем: слово переезжает в конец
    list.push([de, state.current.ru]);
    state.stats.mistakes = list.slice(-200);
  }
  // Фишки 4/5: умные повторки и обратный вопрос после ошибки
  if (window.DQLearn && state.current) {
    window.DQLearn.noteAnswer(state.current.de, correct);
    if (!correct) window.DQLearn.askReverse(state.current);
  }
  // Фишка «Новые слова — в карточки»
  const uia = (window.SETTINGS && window.SETTINGS.ui) || {};
  if (correct && state.current && uia.autoCards !== false) {
    if (!state.autoCoded) state.autoCoded = new Set();
    if (!state.autoCoded.has(state.current.de)) {
      state.autoCoded.add(state.current.de);
      try { const k = "dq.cards.v1"; const cur = JSON.parse(localStorage.getItem(k) || "{}"); if (!cur[state.current.de]) { cur[state.current.de] = { de: state.current.de, ru: state.current.ru, at: Date.now() }; localStorage.setItem(k, JSON.stringify(cur).slice(0, 200000)); } } catch (e) { }
    }
  }
  // «без повторок»: верное слово выбывает из текущего круга,
  // ошибочное / «посмотрел ответ» / пропуск — уходит в конец круга.
  // Круг заканчивается, когда в нём не остаётся слов — тогда новый.
  if (noRepeatOn() && state.current && state.current.de) {
    const de = state.current.de;
    if (!state.visible.length) state.visible = state.pool.slice();
    const idx = state.visible.findIndex((p) => p[0] === de);
    if (correct) {
      if (idx >= 0) state.visible.splice(idx, 1);
      state.taken.add(de);
    } else if (idx >= 0 && !state.wrong.has(de)) {
      // ошиблись впервые в этом круге — слово уходит в конец очереди
      state.visible.push(state.visible.splice(idx, 1)[0]);
      state.wrong.add(de);
      state.taken.delete(de);
    }
  }
  saveStats({
    answered: state.stats.answered,
    correct: state.stats.correct,
    xp: state.stats.xp,
    best_streak: state.stats.best_streak,
    daily_answers: (st.daily_answers || 0) + 1,
    srs: state.stats.srs,
    mistakes: state.stats.mistakes || [],
  });
  updateSessionStats();
  $("#nextBtn").disabled = false;
  bumpHistory(correct);

  // ---- новое: звук, тактильность, анимация ----
  const prevLevel = Math.max(1, Math.floor(((state.stats.xp || 0) - gain) / 100) + 1);
  const nowLevel = Math.max(1, Math.floor((state.stats.xp || 0) / 100) + 1);
  if (correct) {
    window.DQSND && window.DQSND.correct();
    if (state.streak > 1) setTimeout(() => window.DQSND && window.DQSND.star(), 180);
  } else {
    window.DQSND && window.DQSND.wrong();
  }
  if (nowLevel > prevLevel) {
    setTimeout(() => window.DQSND && window.DQSND.levelUp(), 380);
    toast(`Уровень ${nowLevel}!`, "ok");
    if (window.DQFX) window.DQFX.confetti();
  }
  if (!window.SETTINGS || window.SETTINGS.ui.haptics !== false) {
    navigator.vibrate && navigator.vibrate(correct ? 10 : [18, 60, 18]);
  }
  if (window.DQFX) window.DQFX.flip($("#xp"), state.stats.xp || 0);

  // транскрипция у ответа (настраиваемо) + озвучка правильного немецкого
  const q = state.current;
  const ui = (window.SETTINGS && window.SETTINGS.ui) || {};
  // Фишка «Читать и по-русски» (ui.readRu)
  if (q && ui.readRu && !correct && /[А-Яа-яЁё]/.test(q.ru)) {
    setTimeout(() => { if (state.current === q) say(q.ru, "ru"); }, 900);
  }
  // Фишки 2/3/6: подсказка по фразе и похожие слова в разборе
  if (q && window.DQLearn) {
    const box = $("#learnExplain");
    if (box) box.innerHTML = window.DQLearn.explain(q.de, q.ru);
  }
  if (q && ui.showPronAnswer !== false && /[A-Za-zÄÖÜäöüß]/.test(q.de)) {
    if (window.DQPhon && !window.DQPhon.get(q.de)) {
      window.DQPhon.prepare([q.de]).then(() => { if (state.current === q) renderPhon(q.de); });
    } else if (!ui.showPron || ui.showPron === false) renderPhon(q.de);
  }
  if (!correct && q && /[A-Za-zÄÖÜäöüß]/.test(q.de)) setTimeout(() => say(q.de, "de"), 420);
};

/* ------------ интервальное повторение (лёгкая SM-2) ------------ */
const SRS_DAYS = [0, 1, 3, 7, 16, 35, 75, 150];

function srsState() {
  const st = state.stats;
  if (!st.srs || typeof st.srs !== "object") st.srs = { box: {}, due: [] };
  if (!st.srs.box || typeof st.srs.box !== "object") st.srs.box = {};
  if (!Array.isArray(st.srs.due)) st.srs.due = [];
  return st.srs;
}

function todayISO() {
  return dayKey(new Date());
}

function srsRecord(de, correct) {
  if (!de || (window.SETTINGS && window.SETTINGS.ui.srs === false)) return;
  const srs = srsState();
  const box = srs.box[de] || { b: 0, n: 0 };
  if (correct) {
    box.b = Math.min(SRS_DAYS.length - 1, (box.b || 0) + 1);
    box.n = (box.n || 0) + 1;
    box.last = todayISO();          // следующий повтор — когда интервал пройдёт
  } else {
    box.b = Math.max(0, (box.b || 0) - 1);
    box.n = Math.max(0, (box.n || 0) - 1);
    box.last = "1970-01-01";        // ошибся — повторяем сразу
  }
  srs.box[de] = box;
}

/** Слова, которые пора повторить сегодня (= интервал прошёл). */
function srsDue() {
  const srs = srsState();
  const today = new Date();
  const out = [];
  for (const [de, box] of Object.entries(srs.box)) {
    const days = SRS_DAYS[Math.min(box.b || 0, SRS_DAYS.length - 1)];
    if (!box.last) continue;
    const last = new Date(box.last + "T00:00:00");
    const diff = Math.round((today - last) / 86400000);
    if (diff >= days) out.push(de);
  }
  srs.due = out;
  return out;
}



function srsLearned() {
  const srs = srsState();
  return Object.values(srs.box).filter((b) => (b.b || 0) >= 2).length;
}

function checkChoice(btn, opt) {
  if (state.answered) return;
  const correct = expectedAnswer();
  const ok = norm(opt) === norm(correct);
  $$(".opt", $("#answerArea")).forEach((b) => {
    b.disabled = true;
    if (norm(b.textContent) === norm(correct)) b.classList.add("correct");
  });
  if (!ok) btn.classList.add("wrong");
  if (window.DQFX) {
    if (ok) { window.DQFX.pop(btn); window.DQFX.confettiAt(btn); }
    else window.DQFX.shake($("#answerArea"));
  }
  const fb = $("#feedback");
  if (ok) {
    fb.className = "feedback ok";
    fb.textContent = state.hintShown ? "Верно! +6 XP" : "Верно! +10 XP";
  } else {
    fb.className = "feedback bad";
    fb.innerHTML = "";
    fb.append(document.createTextNode("Неверно. Правильно: "));
    const b = document.createElement("b");
    b.textContent = correct;
    fb.append(b);
  }
  registerAnswer(ok, state.hintShown ? 6 : 10);
  autoAdvance(ok ? 700 : 1500);
}

/** Переход дальше: с авто-режимом, если он включён. */
/** Красочный diff ответа: <mark> — отличие от правильного (идея «посимвольная подсветка»). */
function diffHtml(user, correct) {
  const u = String(user || ""), c = String(correct || "");
  const safe = (s) => s.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
  // общий префикс
  let p = 0;
  while (p < u.length && p < c.length && u[p].toLowerCase() === c[p].toLowerCase()) p++;
  const wrong = u.slice(p);
  const right = c.slice(p);
  const head = c.slice(0, p);
  // одна замена (одна и та же длина) — подчёркиваем не ту букву
  let out = `<b>${safe(head)}`;
  if (wrong.length && wrong.length === right.length) {
    let marked = 0;
    for (let i = 0; i < right.length; i++) {
      if (u[p + i] !== c[p + i] && !marked) {
        out += `<mark class="ws-mark">${safe(right[i])}</mark>`;
        marked++;
      } else out += safe(right[i]);
    }
    out += "</b>";
    if (right.length) out += ` <span class="ws-tip">у вас: ${safe(wrong)}</span>`;
  } else if (right.length) {
    out += `<mark class="ws-mark">${safe(right)}</mark></b>`;
    if (wrong.length) out += ` <span class="ws-tip">у вас: ${safe(wrong)}</span>`;
  } else {
    out += "</b>";
  }
  return out;
}

function autoAdvance(ms) {
  const auto = !window.SETTINGS || window.SETTINGS.ui.autoNext !== false;
  if (!auto) return;
  setTimeout(() => { if (state.answered) nextQuestion(); }, ms);
}

function checkTyped(input) {
  if (state.answered) return;
  const user = input.value.trim();
  const correct = expectedAnswer();
  const ok = matchAnyAnswer(user, correct);
  const fb = $("#feedback");
  if (ok) {
    input.classList.add("ok");
    fb.className = "feedback ok";
    fb.textContent = state.hintShown ? "Верно! +6 XP" : "Верно! +10 XP";
    if (window.DQFX) window.DQFX.confettiAt(input);
  } else {
    input.classList.add("bad");
    if (window.DQFX) window.DQFX.shake($("#answerArea"));
    const close = similar(norm(user), norm(correct)) > 0.85;
    fb.className = "feedback " + (close ? "warn" : "bad");
    fb.innerHTML = "";
    fb.append(document.createTextNode(close ? "Почти! Правильно: " : "Неверно. Правильно: "));
    // подсветка расхождений: какие буквы не совпали с ответом
    fb.insertAdjacentHTML("beforeend", diffHtml(user, correct));
  }
  input.disabled = true;
  registerAnswer(ok, state.hintShown ? 6 : 10);
  autoAdvance(ok ? 900 : 1600);
}

/* ============================================================
   ГОЛОСОВОЙ ОТВЕТ (Web Speech Recognition)
   ============================================================ */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null;
let recogWanted = false;

function startSpeaking(btn) {
  if (state.answered) return;
  if (!SR) {
    toast("Голосовой ввод: браузер не поддерживает. Попробуйте Chrome или Edge.", "bad");
    return;
  }
  const hint = $("#micHint");
  recogWanted = true;
  try { recog && recog.abort(); } catch (e) {}
  recog = new SR();
  recog.lang = "de-DE";
  recog.interimResults = true;
  recog.maxAlternatives = 3;
  recog.continuous = false;
  let done = false;

  recog.onstart = () => {
    btn.classList.add("listening");
    if (hint) { hint.className = "mic-hint live"; hint.textContent = "Слушаю… говорите"; }
    window.DQSND && window.DQSND.tap();
  };
  recog.onresult = (ev) => {
    let best = "", alts = [];
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      for (let k = 0; k < r.length; k++) alts.push(r[k].transcript);
      if (r.isFinal) best = r[0].transcript;
    }
    if (hint && alts.length) hint.textContent = "Услышано: " + alts[alts.length - 1];
    if (best && !done) {
      done = true;
      evaluateSpeech(best, alts, btn);
    }
  };
  recog.onerror = (e) => {
    btn.classList.remove("listening");
    if (hint) { hint.className = "mic-hint"; hint.textContent = e.error === "not-allowed"
      ? "Нет доступа к микрофону — разрешите его в браузере"
      : "Не расслышал, попробуйте ещё раз"; }
  };
  recog.onend = () => {
    btn.classList.remove("listening");
    if (!done && hint) { hint.className = "mic-hint"; hint.textContent = "Ничего не услышал — нажмите и говорите громче"; }
    recogWanted = false;
  };
  try { recog.start(); } catch (e) { toast("Микрофон занят", "bad"); }
}

function evaluateSpeech(spoken, alts, btn) {
  if (state.answered) return;
  const correct = expectedAnswer();
  const candidates = [spoken, ...(alts || [])];
  // «mit = с; из; имеющий» — проговаривание любого варианта тоже верно
  const okAny = candidates.some((c) => matchAnyAnswer(c, correct));
  const fb = $("#feedback");
  const hint = $("#micHint");
  if (hint) { hint.className = "mic-hint live"; hint.textContent = "Услышано: «" + spoken + "»"; }
  if (okAny) {
    fb.className = "feedback ok";
    fb.textContent = "Верно! +10 XP";
    if (window.DQFX) window.DQFX.confettiAt(btn || $("#qText"));
  } else {
    fb.className = "feedback bad";
    fb.textContent = "Неверно. Правильно: " + correct;
    if (window.DQFX) window.DQFX.shake($("#answerArea"));
  }
  registerAnswer(okAny);
  autoAdvance(okAny ? 1000 : 1800);
}

/* ---------- навигация ---------- */
function showView(name) {
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
  if (name === "groups") renderGroupsScreen();
  if (name === "stats") renderStats();
  if (name === "games") window.DQGames.renderCatalog();
  if (name === "worksheets") window.DQWorksheets && window.DQWorksheets.renderIndex();
  if (name === "reading") window.DQReading && window.DQReading.render && window.DQReading.init();
  if (name === "tables") window.DQTables && window.DQTables.init();
  if (name === "sounds") window.DQSounds && window.DQSounds.init();
  if (name === "words") window.DQMyWords && window.DQMyWords.open();
  if (name === "lernen") window.DQTrain && window.DQTrain.init();
  if (name === "journal" && window.DQExtras) window.DQExtras.renderJournal();
  if (name === "plan" && window.DQExtras) window.DQExtras.renderPlan();
  if (name === "cards" && window.DQExtras) window.DQExtras.renderCards();
  if (name === "grammar") window.DQGrammarView && window.DQGrammarView.init();
  if (name === "speech") window.DQSpeech && window.DQSpeech.init();
  if (name === "content") window.DQContent && window.DQContent.init();
  if (name === "modes") window.DQModes && window.DQModes.init();
  if (name === "course") window.DQCourse && window.DQCourse.init();
  // идеи (web/ideas.js): колода, цифры, «что повторить»
  if (window.DQIdeas) setTimeout(() => window.DQIdeas.refresh(name), 0);
  if (name === "dictation" && window.DQExtras) window.DQExtras.renderDictation();
  if (name === "exam" && window.DQExtras) { window.DQExtras.renderExam(); }
  // анимация смены экрана + звук перехода (речь не должна переезжать на другой экран)
  if (window.DQVoice) window.DQVoice.stop();
  if (window.DQFX) window.DQFX.view($("#view-" + name));
  if (window.DQSND) window.DQSND.switch();
  // «Задания» занимают низ экрана собственной панелью действий
  document.body.classList.toggle("ws-mode", name === "worksheets");
  if (name !== "worksheets") {
    // уходим с «Заданий» — нижняя панель проверки не должна висеть
    const bar = $("#wsAction");
    if (bar) { bar.classList.remove("open", "done"); bar.innerHTML = ""; }
    if (window.DQWorksheets && window.DQWorksheets.leave) window.DQWorksheets.leave();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------------- статистика: карточки, график, игры, задания ---------------- */
const STAT = { days: 30 };

const GAME_NAMES = {
  speed: "Скорость", listen: "Слух", typing: "Диктант", images: "Картинки",
  sentence: "Порядок слов", anagram: "Анаграммы", pairs: "Пары", quiz: "Правда/ложь",
  oddone: "Лишнее слово", chain: "Цепочка", flash: "Вспышки",
  gender: "der·die·das", letter: "Пропущенная буква",
  mic: "Микрофон", shadow: "Эхо", dictation: "Фразы на слух",
};

function dayKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** История ответов по дням: stats.history = { "2026-11-16": {a: 40, c: 33} } */
function historyOf() {
  const st = state.stats;
  if (!st.history || typeof st.history !== "object" || Array.isArray(st.history)) st.history = {};
  // Если истории ещё нет — засеваем сегодняшним итогом (daily_answers), чтобы график был живым
  if (!Object.keys(st.history).length && (st.daily_answers || 0) > 0) {
    st.history[dayKey(new Date())] = { a: Number(st.daily_answers) || 0, c: 0 };
  }
  return st.history;
}

function bumpHistory(correct) {
  const h = historyOf();
  const k = dayKey(new Date());
  const cur = h[k] || { a: 0, c: 0 };
  cur.a += 1;
  if (correct) cur.c += 1;
  h[k] = cur;
  // храним не больше года
  const keys = Object.keys(h).sort();
  if (keys.length > 366) keys.slice(0, keys.length - 366).forEach((x) => delete h[x]);
  saveStats({ history: h });
}

function renderStats() {
  const st = state.stats;
  const answered = st.answered || 0, correct = st.correct || 0;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set("#stAnswered", answered);
  set("#stCorrect", correct);
  set("#stAcc", answered ? Math.round((correct / answered) * 100) + "%" : "–");
  set("#stStreak", st.best_streak || 0);
  set("#stXp", st.xp || 0);
  set("#stLvl", Math.max(1, Math.floor((st.xp || 0) / 100) + 1));
  set("#stLearned", srsLearned());
  set("#stDue", srsDue().length);
  renderChart();
  renderErrors();
  renderGamesStats();
  renderWorksheetStats();
  renderGroupStats();
  if (window.DQIdeas) window.DQIdeas.refresh("stats");
}

function renderChart() {
  const box = $("#statChart");
  if (!box) return;
  const days = STAT.days;
  const h = historyOf();
  const today = new Date();
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const k = dayKey(d);
    const rec = h[k] || { a: 0, c: 0 };
    series.push({ k, d, a: rec.a, c: rec.c });
  }
  const max = Math.max(1, ...series.map((s) => s.a));
  // шаг подписей: 7 дней — все, 30 — каждая 5-я, 90 — только начало месяца
  const step = days <= 7 ? 1 : days <= 30 ? 5 : 30;
  box.innerHTML = series.map((s, idx) => {
    const hPct = s.a ? Math.max(8, Math.round((s.a / max) * 100)) : 0;
    const acc = s.a ? (s.c ? Math.round((s.c / s.a) * 100) : 100) : 0;
    const title = `${s.d.toLocaleDateString("ru-RU")}: ${s.a} ответов` +
      (s.c ? `, точность ${acc}%` : "");
    const showLabel = (idx % step === 0) || idx === series.length - 1;
    const label = days > 30 && s.d.getDate() <= 7
      ? s.d.toLocaleDateString("ru-RU", { month: "short" })
      : s.d.getDate();
    return `<div class="bar-col" title="${title}">
      <div class="bar-fill" style="height:${hPct}%"><i style="height:${acc}%"></i></div>
      <span class="bar-lbl${s.a ? " on" : ""}${showLabel ? "" : " is-hidden"}">${label}</span>
    </div>`;
  }).join("");

  if (days > 30) {
    box.querySelectorAll(".bar-lbl:not(.on)").forEach((l) => l.classList.add("is-hidden"));
  }

  // серия дней подряд и сегодняшняя активность
  const keys = Object.keys(h).sort();
  let streak = 0;
  const cur = new Date(today);
  for (;;) {
    const k = dayKey(cur);
    if (h[k] && h[k].a > 0) { streak++; cur.setDate(cur.getDate() - 1); }
    else if (dayKey(cur) === dayKey(today)) { cur.setDate(cur.getDate() - 1); } // сегодня ещё можно
    else break;
  }
  const todayA = (h[dayKey(today)] || { a: 0 }).a;
  const goal = Number(state.stats.daily_goal || 10);
  const s = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  s("#stDayStreak", streak);
  s("#stToday", todayA);
  // склонение: «1 день», «2 дня», «5 дней»
  const n = streak, mod10 = n % 10, mod100 = n % 100;
  const word = (mod10 === 1 && mod100 !== 11) ? "день"
    : (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) ? "дня" : "дней";
  const unit = $("#stDayStreak") && $("#stDayStreak").parentElement.querySelector("span");
  if (unit) unit.textContent = word + " подряд";
  // цель дня: если выполнена — показываем «✓», а не непонятный 0
  s("#stGoal", todayA >= goal ? `✓ ${goal}` : goal - todayA);
}

function renderErrors() {
  const box = $("#statErrors");
  if (!box) return;
  const mistakes = Array.isArray(state.stats.mistakes) ? state.stats.mistakes : [];
  if (!mistakes.length) {
    box.innerHTML = `<div class="stat-empty">Ошибок нет — отличная работа</div>`;
    return;
  }
  const items = mistakes.slice(-12).reverse();
  box.innerHTML = items.map((m) => `
    <div class="err-row">
      <span class="err-de">${String(m[0] || "").replace(/[<>&]/g, "")}</span>
      <span class="err-ru">${String(m[1] || "").replace(/[<>&]/g, "")}</span>
    </div>`).join("");
}

function renderGamesStats() {
  const box = $("#statGames");
  if (!box) return;
  const g = state.stats.games || {};
  const rows = Object.keys(GAME_NAMES)
    .map((k) => ({ k, v: Number(g[k] || 0) }))
    .filter((r) => r.v > 0)
    .sort((a, b) => b.v - a.v);
  const total = rows.reduce((n, r) => n + r.v, 0);
  const tot = $("#stGamesTotal");
  if (tot) tot.textContent = `всего ${total}`;
  if (!rows.length) { box.innerHTML = `<div class="stat-empty">Ещё не играли — начните с «Скорости».</div>`; return; }
  const max = rows[0].v;
  box.innerHTML = rows.map((r) => `
    <div class="bar-row">
      <span class="bar-name">${GAME_NAMES[r.k]}</span>
      <div class="bar-track"><i style="width:${Math.round((r.v / max) * 100)}%"></i></div>
      <span class="bar-val">${r.v}</span>
    </div>`).join("");
}

function renderWorksheetStats() {
  const box = $("#statWorksheets");
  if (!box) return;
  const ws = state.stats.worksheets || {};
  const rows = Object.entries(ws).filter(([, v]) => v && typeof v === "object");
  const tot = $("#stWsTotal");
  if (tot) tot.textContent = `${rows.length} наборов`;
  if (!rows.length) { box.innerHTML = `<div class="stat-empty">Задания ещё не проходили.</div>`; return; }
  box.innerHTML = rows.map(([id, v]) => {
    const total = Number(v.total || 0);
    // best — за всё время, а «last» (если есть) — последняя попытка; показываем лучшее
    const last = Object.values(v.last || {}).map(Number).filter((n) => Number.isFinite(n));
    const best = Math.max(Number(v.best || 0), ...(last.length ? last : [0]));
    const pct = total ? Math.round((best / total) * 100) : 0;
    // красивое имя набора (из каталога), иначе — id без папки
    const known = (window.DQWorksheets && window.DQWorksheets.titles) ? window.DQWorksheets.titles[id] : null;
    const label = known || id.replace(/^.*\//, "").replace(/-/g, " ");
    return `
      <div class="bar-row">
        <span class="bar-name" title="${label}">${label}</span>
        <div class="bar-track"><i style="width:${pct}%;background:var(--ok)"></i></div>
        <span class="bar-val">${best}/${total}</span>
      </div>`;
  }).join("");
}

function renderGroupStats() {
  const box = $("#statGroups");
  if (!box) return;
  if (!state.enabled.length) {
    box.innerHTML = `<span class="muted">Группы не выбраны</span>`;
    return;
  }
  box.innerHTML = state.enabled.map((k) =>
    `<span class="chip on static" title="${groupLabel(k)} · ${groupCount(k)} записей">${groupLabel(k)}</span>`).join("");
}

function bindUI() {
  $$("#nav button").forEach((b) => {
    b.onclick = () => {
      showView(b.dataset.view);
      $$("#nav button").forEach((x) => x.classList.toggle("active", x === b));
    };
  });

  $("#gClose").onclick = () => window.DQGames.close();
  $("#gameModal").onclick = (e) => {
    if (e.target.id === "gameModal") window.DQGames.close();
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && window.DQGames.isOpen()) window.DQGames.close();
  });

  $("#openGroups").onclick = openGroupsView;
  $("#groupSearch").oninput = renderGroupsScreen;
  $("#allOn").onclick = () => { state.pending = state.groups.map((g) => g.key); renderGroupsScreen(); };
  $("#allOff").onclick = () => { state.pending = []; renderGroupsScreen(); };
  $("#saveGroups").onclick = () => applyGroups(state.pending);

  $$("#direction button").forEach((b) => {
    b.onclick = () => {
      state.direction = b.dataset.dir;
      applyMode();
      saveStats({ direction: state.direction });
      // направление — другой вид вопроса: круг начинаем заново
      state.visible = [];
      state.roundStart = false;
      state.wrong.clear();
      nextQuestion();
    };
  });

  $$("#inputType button").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.input === "speak" && !SR) {
        toast("Голосовой ввод не поддерживается этим браузером — нужен Chrome или Edge", "bad");
        return;
      }
      state.inputType = b.dataset.input;
      applyMode();
      saveStats({ input_type: state.inputType });
      // другой способ ответа — новый круг (без «уже спрошенных»)
      state.visible = [];
      state.roundStart = false;
      state.wrong.clear();
      nextQuestion();
    };
  });

  // «повторить забытое»
  const duePill = $("#duePill"), dueBtn = $("#dueBtn");
  if (duePill) duePill.onclick = startDueSession;
  if (dueBtn) dueBtn.onclick = startDueSession;

  // переключатели в боковой панели (транскрипция / автоозвучка)
  const bindSwitch = (id, key) => {
    const el = $(id);
    if (!el) return;
    const paint = () => el.classList.toggle("on", (window.SETTINGS.ui[key]) !== false);
    paint();
    el.onclick = () => {
      const next = !(window.SETTINGS.ui[key] !== false);
      window.SETTINGS.set(key, next);
      paint();
      window.DQSND && window.DQSND.switch();
      if (key === "showPron") renderPhon(state.current && state.current.de);
    };
  };
  bindSwitch("#pronRow", "showPron");
  bindSwitch("#autoSayRow", "autoSay");
  // «без повторок» — прямо в панели тренажёра, меняет текущий круг сразу
  bindSwitch("#noRepeatRow", "noRepeat");
  const noRep = $("#noRepeatRow");
  if (noRep) {
    const prevNoRep = noRep.onclick;
    noRep.onclick = () => { prevNoRep && prevNoRep(); syncNoRepeat(); };
  }
  // быстрый доступ к строгости: порог «Идеально» ↔ значение из настроек
  const strictRow = $("#strictRow");
  if (strictRow) {
    const paintStrict = () => strictRow.classList.toggle("on", Number(window.SETTINGS.ui.tolerance) === 0);
    paintStrict();
    strictRow.onclick = () => {
      const next = Number(window.SETTINGS.ui.tolerance) === 0 ? 2 : 0;
      window.SETTINGS.set("tolerance", next);
      paintStrict();
      window.DQSND && window.DQSND.switch();
    };
  }

  $("#settingsOpen").onclick = () => {
    window.DQSND.click();
    window.SETTINGS.open();
  };

  // диапазон графика активности
  $$("#statRange button").forEach((b) => {
    b.onclick = () => {
      STAT.days = Number(b.dataset.days) || 30;
      $$("#statRange button").forEach((x) => x.classList.toggle("active", x === b));
      window.DQSND && window.DQSND.tap();
      renderChart();
    };
  });

  $("#nextBtn").onclick = () => { if (state.answered) nextQuestion(); };
  $("#skipBtn").onclick = () => nextQuestion();

  $("#resetBtn").onclick = async () => {
    if (!confirm("Сбросить статистику (ответы, XP, серии)?")) return;
    try {
      const data = await api("/api/reset", { method: "POST", body: "{}" });
      state.stats = data.stats;
      newSession();
      renderStats();
      toast("Прогресс сброшен", "ok");
    } catch (e) {
      toast("Не удалось сбросить: " + e.message, "bad");
    }
  };

  // Экспорт прогресса в файл — страховка «всё пропало»
  const expBtn = $("#exportBtn");
  if (expBtn) expBtn.onclick = () => {
    const a = document.createElement("a");
    a.href = "/api/export";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Файл прогресса скачивается", "ok");
  };
  // Импорт: выбрать файл, сервер сольёт его с текущим
  const impBtn = $("#importBtn");
  const impFile = $("#importFile");
  if (impBtn && impFile) {
    impBtn.onclick = () => impFile.click();
    impFile.onchange = () => {
      const f = impFile.files && impFile.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const data = await api("/api/import", { method: "POST", body: JSON.stringify({ stats: parsed }) });
          if (data && data.stats) {
            state.stats = data.stats;
            renderStats();
            toast("Импорт готов: прогресс объединён", "ok");
          } else {
            toast("Сервер не принял файл", "bad");
          }
        } catch (e) {
          toast("Не похоже на наш файл прогресса", "bad");
        }
        impFile.value = "";
      };
      reader.readAsText(f);
    };
  }

  // «R» — быстрый переход к чтению (цифры оставляем вариантам ответа)
  document.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.isContentEditable)) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "r" || e.key === "R") showView("reading");
  });

  document.addEventListener("keydown", (e) => {
    if (e.target && e.target.tagName === "INPUT") return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter" && state.answered) nextQuestion();
    if (/^[1-4]$/.test(e.key)) {
      const opts = $$(".opt", $("#answerArea"));
      const idx = parseInt(e.key, 10) - 1;
      if (opts[idx] && !state.answered) opts[idx].click();
    }
    // S — слушать немецкое слово (и из игры это работает)
    if ((e.key === "s" || e.key === "S" || e.key === "ы" || e.key === "Ы") && state.current) {
      if (!state.answered && /[A-Za-zÄÖÜäöüß]/.test(state.current.de)) {
        e.preventDefault();
        say(state.current.de, "de");
      }
    }
    if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
      e.preventDefault();
      showHint();
    }
  });
}

/* ---------------- мост для мини-игр (web/games.js) ---------------- */
const _numCache = { numbers: null, phones: null };

async function _gamePool(kind, count) {
  if (kind === "numbers") {
    if (!_numCache.numbers) {
      const d = await api("/api/game/numbers");
      _numCache.numbers = (d.numbers || []).map((n) => ({ de: n.de, ru: n.ru, n: n.n, kind: "number" }));
    }
    return _numCache.numbers;
  }
  if (kind === "phones") {
    if (!_numCache.phones) {
      const d = await api("/api/game/phones");
      _numCache.phones = (d.phones || []).map((p) => ({ de: p.de, ru: p.raw, raw: p.raw, kind: "phone" }));
    }
    return _numCache.phones;
  }
  return [];
}

window.DQ = {
  get stats() { return state.stats; },
  get direction() { return state.direction; },
  get enabledGroups() { return state.enabled; },
  get pool() { return state.pool; },
  api,
  toast,
  batch(patch) { saveStats(patch); },
  renderGames() { window.DQGames.renderCatalog(); },
  /* «mit = с; из; имеющий» — ответ принимается, если он совпал
     с любым из вариантов. Игры используют ту же логику и строгость. */
  matchAnswer,
  matchAnyAnswer,
  splitVariants,
  /* режим повторок в играх: каждый предмет колоды — один раз */
  noRepeat() { return noRepeatOn(); },
  syncRepeatMode: syncNoRepeat,
  pron(word) { return (window.DQPhon && window.DQPhon.get(word)) || null; },
  pronCard(word, opts) { return pronCard(word, opts); },
  say,
  saySlow,
  progress: () => ({ learned: srsLearned(), due: srsDue().length, goal: (window.SETTINGS && window.SETTINGS.ui.dailyGoal) || 10,
                     today: Number(state.stats.daily_answers) || 0 }),
  pairPool(n) {
    const src = state.pool.length ? state.pool : [];
    return shuffle(src).slice(0, n || 400);
  },
  /* короткое имя группы для компактных заголовков */
  srs: { due: () => srsDue(), box: () => srsState().box, record: srsRecord, learned: srsLearned },
  dueSession() { return startDueSession(); },
  groupShort(label) {
    const key = state.enabled.find((k) => groupLabel(k) === label);
    if (!key) return String(label || "").split(/[,;(]/)[0].trim();
    const full = groupLabel(key);
    const cut = full.split(/[,;(]/)[0].trim();
    return cut.length > 28 ? (state.groups.find((g) => g.key === key) || {}).label || cut : cut;
  },
  /* Пары, разложенные по выбранным группам — для игр, где важна тематика */
  groupedPairs() {
    return state.enabled.map((key) => ({
      group: groupLabel(key),
      pairs: (window._poolByGroup && window._poolByGroup[key]) || [],
    }));
  },
  numberPool() { return (_numCache.numbers || []).slice(); },
  phonePool() { return (_numCache.phones || []).slice(); },
  async loadGameData() {
    await Promise.all([_gamePool("numbers"), _gamePool("phones")]);
  },
  award(points) {
    state.stats.xp = (state.stats.xp || 0) + points;
    saveStats({ xp: state.stats.xp });
    updateSessionStats();
  },
  registerMistake(de) { if (de) toast("Добавлено в ошибки", "bad"); },
  /* применить статистику, которую вернул сервер (например, после проверки задания) */
  applyStats(next) {
    if (!next || typeof next !== "object") return;
    state.stats = next;
    updateSessionStats();
    renderStats();
  },
  speak: null,
  stopAudio() {
    try { speechSynthesis.cancel(); } catch (e) { }
  },
  audio: {
    play(text, lang) {
      if (!text || !window.speechSynthesis) return;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === "ru" ? "ru-RU" : "de-DE";
        u.rate = 0.92;
        speechSynthesis.speak(u);
      } catch (e) { /* браузер без синтеза речи */ }
    },
  },
};
window.DQ.speak = (text, lang) => window.DQ.audio.play(text, lang);

function init() {
  bindUI();
  return api("/api/data").then((data) => boot(data));
}

async function boot(data) {
  state.groups = data.groups;
  state.stats = data.stats;

  // ---- новый слой: тема/движение/звук из общей панели настроек ----
  window.SETTINGS.init(data.stats);
  window.DQFX.init();
  window.DQSND.init();
  document.body.dataset.glow = (window.SETTINGS.ui.answerGlow !== false) ? "on" : "off";

  const needsChoice = !!data.stats.needs_choice;
  const enabled = (data.stats.enabled_groups || []).filter((k) => state.groups.some((g) => g.key === k));
  state.enabled = needsChoice ? [] : enabled;
  if (!needsChoice) {
    state.direction = data.stats.direction === "ru-de" ? "ru-de" : "de-ru";
    state.inputType = ["choice", "type", "speak"].includes(data.stats.input_type)
      ? data.stats.input_type : "type";
    if (state.inputType === "speak" && !SR) state.inputType = "type";
  }
  window.DQVoice && window.DQVoice.set(window.SETTINGS.ui);

  renderChips();
  renderNavBadge();
  applyMode();
  window.DQGames.renderCatalog();
  window.DQ.loadGameData();
  window.DQWorksheets.init();
  window.DQReading && window.DQReading.init();
  window.DQTables && window.DQTables.init();
  window.DQSounds && window.DQSounds.init();
  window.DQMyWords && window.DQMyWords.init();
  window.DQTrain && window.DQTrain.init();
  window.DQExtras && window.DQExtras.init();

  newSession();
  // 10 фишек учёбы: слово дня, таймер сессии, приветствие (web/learn.js)
  if (window.DQLearn) {
    window.DQLearn.renderWordOfDay();
    window.DQLearn.renderTimer();
    window.DQLearn.greeting(data.stats);
  }
  // нет выбора групп — показываем экран «Группы» с уже отмеченными
  if (needsChoice) {
    state.pending = state.groups.map((g) => g.key);
    showView("groups");
    $$("#nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === "groups"));
  }
}

/* Старт — в самом конце файла: до объявления init/boot стоит TDZ и вызов
   бросал бы ReferenceError, оставляя тренажёр без window.SETTINGS. */
try {
  init().catch((e) => {
    console.error("DQ init failed:", e);
    const q = $("#qText");
    if (q) q.textContent = "Ошибка инициализации: " + e.message;
  });
} catch (e) {
  console.error("DQ init failed:", e);
}
