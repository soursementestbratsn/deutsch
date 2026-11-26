# Живая проверка: карточка по клику (оба направления), фото, звуки.
# Запуск: .venv\Scripts\python.exe tests\_qa_wordpop.py
import json
from patchright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123/"
out = []


def log(*a):
    print(*a)
    out.append(" ".join(str(x) for x in a))


with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page(viewport={"width": 1280, "height": 900})
    errs = []
    p.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    p.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    p.goto(URL)
    p.wait_for_timeout(2500)

    # --- настройки: reverse-перевод включаем программно
    p.evaluate("SETTINGS.set('ruTranslate', true)")
    p.wait_for_timeout(300)

    # --- 1. клик по немецкому слову на экране «Группы»
    p.evaluate("DQNav.go('groups')")
    p.wait_for_timeout(1500)
    de_el = p.query_selector(".pairs-list .de, .pair .de, .p-de, .gr-word, .pair-de, [data-de]")
    info = p.evaluate("""() => {
      const cands = ['.pairs-list .de','.pair .de','.p-de','.gr-word','.pair-de'];
      for (const c of cands) { const el = document.querySelector(c); if (el) return {c, t: el.textContent}; }
      return null;
    }""")
    log("немецкое слово на экране групп:", info)
    if info:
        el = p.query_selector(info["c"])
        el.click()
        p.wait_for_timeout(900)
        log("карточка открыта:", p.evaluate("document.querySelector('.wordpop').classList.contains('open')"))
        log("слово/перевод:", p.evaluate("[document.querySelector('.wordpop-de').textContent, document.querySelector('.wordpop-ru').textContent]"))

    # --- 2. русское → немецкое
    p.evaluate("DQWordPop.showRu('дом', 300, 300)")
    p.wait_for_timeout(700)
    log("RU->DE:", p.evaluate("document.querySelector('.wordpop-ru').textContent"))
    p.screenshot(path="tests/_qa_wordpop_ru.png")
    p.evaluate("DQWordPop.hide()")

    # --- 3. тренажёр: фото, клавиша Enter → ответ, звук
    p.evaluate("DQNav.go('train')")
    p.wait_for_timeout(1800)
    log("qPhoto в разметке:", p.evaluate("!!document.getElementById('qPhoto')"))
    log("фото в вопросе:", p.evaluate("(document.querySelector('#qPhoto img')||{}).src || ''"))
    p.screenshot(path="tests/_qa_train.png")

    # --- 4. звук: состояние контекста после клика
    p.click(".view.active .opt" if p.query_selector(".view.active .opt") else "#qText")
    p.wait_for_timeout(500)
    log("звук:", p.evaluate("JSON.stringify(DQSND.state)"))
    log("ошибки консоли:", [e for e in errs if "favicon" not in e][:8])
    b.close()
