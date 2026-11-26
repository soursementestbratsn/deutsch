# Проверка логики тренажёра без браузера: повторки, варианты ответа, строгость.
# Запуск: python _smoke_via_eval.py
import io
import re

src = io.open("web/dq.js", encoding="utf-8").read()


def grab(name, kind="function"):
    """Вырезать текст объявления (const name = … или function name(…)) целиком."""
    m = re.search(r"(?:^|\n)(?:const %s = |function %s\()" % (name, name), src)
    assert m, name
    if m.group(0).strip().startswith("const"):
        # const name = <expr>;  — до конца выражения, но только тело - в скобках {}
        j = src.find("(", m.end())
    else:
        j = src.find("(", m.end() - 1)
    depth = 0
    k = j
    while k < len(src):
        if src[k] == "(": depth += 1
        elif src[k] == ")":
            depth -= 1
            if depth == 0: break
        k += 1
    sig = src[j:k + 1].strip()          # (a, b) — параметры
    pos = src.find("{", k)
    depth = 0
    end = pos
    while end < len(src):
        if src[end] == "{": depth += 1
        elif src[end] == "}":
            depth -= 1
            if depth == 0: break
        end += 1
    if m.group(0).strip().startswith("const"):
        return src[m.start():j] + sig + " =>" + src[pos:end + 1]
    return src[m.start():j] + sig + src[pos:end + 1]


# Собираем изолированный скрипт node из реального кода dq.js
parts = ["const state = { visible: [], taken: new Set(), wrong: new Set(), pool: [], roundStart: false, roundTotal: 0 };",
         "const window = { SETTINGS: { ui: { noRepeat: true, tolerance: 2 } } };",
         "const shuffle = (a) => a.slice();",
         "const toast = () => {};",
         src[src.index("const norm = (s)"):src.index(";\n\n/* «mit", src.index("const norm = (s)"))] + ";",
         "const similar = " + grab("similar") + ";",
         "const isTypo = " + grab("isTypo") + ";",
         "function typoLimit(len) { if (len <= 2) return 0; if (len <= 5) return 1; return 2; }",
         "const editDistance = " + grab("editDistance") + ";",
         "const typoDistance = " + grab("typoDistance") + ";",
         "const toleranceLevel = " + grab("toleranceLevel") + ";",
         "const matchAnswer = " + grab("matchAnswer") + ";",
         src[src.index("const splitVariants = (s)"):src.index(";\n\nfunction similar")] + ";",
         "const matchAnyAnswer = " + grab("matchAnyAnswer") + ";",
         grab("noRepeatOn"),
         "function nextFromPool() { if (noRepeatOn()) return nextFromRound(); }",
         grab("nextFromRound"),
         grab("roundProgress"),
         ]

test = r"""
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
"""

script = "\n".join(parts) + test
io.open("_smoke_via_eval.mjs", "w", encoding="utf-8").write(script)
print("ok")
