const state = { visible: [], taken: new Set(), wrong: new Set(), pool: [], roundStart: false, roundTotal: 0 };
const window = { SETTINGS: { ui: { noRepeat: true, tolerance: 2 } } };
const shuffle = (a) => a.slice();
const toast = () => {};
const norm = (s) => String(s || "")
  .toLowerCase()
  .replace(/[„“"'`’]/g, "")
  .replace(/[.,;:!?…]/g, "")
  .replace(/\s+/g, " ")
  .trim();
const similar = 
function similar(a, b){
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
};
const isTypo = 
function isTypo(user, expected){
  if (!user || !expected) return false;
  return similar(user.replace(/\s+/g, ""), expected.replace(/\s+/g, "")) >= 0.82;
};
function typoLimit(len) { if (len <= 2) return 0; if (len <= 5) return 1; return 2; }
const editDistance = 
function editDistance(a, b){
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
};
const typoDistance = 
function typoDistance(user, expected){
  const u = norm(user).replace(/\s+/g, ""), e = norm(expected).replace(/\s+/g, "");
  if (!u || !e) return Infinity;
  return editDistance(u, e);
};
const toleranceLevel = 
function toleranceLevel(){
  const v = Number((window.SETTINGS && window.SETTINGS.ui.tolerance));
  return Number.isFinite(v) ? Math.max(0, Math.min(3, Math.round(v))) : 2;
};
const matchAnswer = 
function matchAnswer(user, expected){
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
};
const splitVariants = (s) => String(s || "")
  .split(/[;\/|]|\s+или\s+/i)
  .map((v) => v.trim())
  .filter((v) => v && v !== "-" && v !== "—");
const matchAnyAnswer = 
function matchAnyAnswer(user, expected){
  return splitVariants(expected).some((v) => matchAnswer(user, v));
};

const noRepeatOn = () =>{
  let v = null;
  try {
    v = window.SETTINGS && window.SETTINGS.ui ? window.SETTINGS.ui.noRepeat : null;
  } catch (e) { v = null; }
  if (v === undefined || v === null) return true;   // по умолчанию включено
  return v !== false;
}
function nextFromPool() { if (noRepeatOn()) return nextFromRound(); }

function nextFromRound(){
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

function roundProgress(){
  const total = state.roundTotal || state.visible.length || state.pool.length;
  return { done: Math.max(0, total - state.visible.length), total };
}
// ---- тесты ----
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// 1) «с/из/имеющий»
ok(matchAnyAnswer("с", "с; из; имеющий"), "ответ «с» должен засчитываться");
ok(matchAnyAnswer("из", "с; из; имеющий"), "ответ «из» должен засчитываться");
ok(matchAnyAnswer("имеющий", "с; из; имеющий"), "ответ «имеющий» должен засчитываться");
ok(!matchAnyAnswer("нет", "с; из; имеющий"), "«нет» не должно засчитываться");

// 2) строгость
window.SETTINGS.ui.tolerance = 0;
ok(!matchAnswer("Hauz", "Haus"), "идеально: опечатка не проходит");
ok(matchAnswer("Haus", "Haus"), "идеально: точное проходит");
window.SETTINGS.ui.tolerance = 1;
ok(matchAnswer("Hauz", "Haus"), "1 буква: typo проходит");
ok(!matchAnswer("Hauzze", "Haus"), "1 буква: две ошибки не проходят");
window.SETTINGS.ui.tolerance = 3;
ok(matchAnswer("Hauz", "Haus"), "чуть не так: typo проходит");
ok(!matchAnswer("Hauzze", "Haus"), "чуть не так: две ошибки не проходят");
ok(!matchAnswer("Auto", "Haus"), "чуть не так: другое слово не проходит");
ok(matchAnswer("Wohnung", "Wohnung"), "чуть не так: точное проходит");
window.SETTINGS.ui.tolerance = 2;
ok(!matchAnswer("Haus", "Hausen"), "обычно: лишнее окончание — это уже не опечатка");

// 3) круг без повторок: 5 слов — 5 уникальных, потом круг начинается заново
state.pool = [["a","1"],["b","2"],["c","3"],["d","4"],["e","5"]];
state.visible = []; state.taken = new Set(); state.roundStart = false;
const seen = [];
for (let i = 0; i < 5; i++) {
  const q = nextFromRound();
  seen.push(q.de);
}
ok(new Set(seen).size === 5, "в первом круге 5 уникальных: " + seen.join(","));
const after = nextFromRound();
ok(seen.includes(after.de), "второй круг начался: " + after.de);

console.log(JSON.stringify({ seen, firstOfNextRound: after.de, fails }, null, 1));
