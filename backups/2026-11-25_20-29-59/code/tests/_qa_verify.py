# Живая проверка трёх правок: RU→DE по клику (с фразой), фото к слову, звуки.
# Запуск: .venv\Scripts\python.exe tests\_qa_verify.py
import json, os, urllib.request
from patchright.sync_api import sync_playwright

URL = "http://127.0.0.1:8123/"


def log(*a):
    print(*a)


def post_photo(word, src):
    """Загружаем тестовое фото к слову через тот же API, что и экран «Словарь»."""
    data = "data:image/png;base64," + __import__("base64").b64encode(
        open(src, "rb").read()).decode()
    body = json.dumps({"word": word, "data": data}, ensure_ascii=False).encode()
    req = urllib.request.Request("http://127.0.0.1:8123/api/photo", data=body,
                                 headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read().decode())


with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page(viewport={"width": 1280, "height": 900})
    errs = []
    p.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    p.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    p.goto(URL)
    p.wait_for_timeout(2500)

    log("ruTranslate по умолчанию:", p.evaluate("SETTINGS.ui.ruTranslate"))
    log("photoMax:", p.evaluate("SETTINGS.ui.photoMax"))

    # --- 1. RU → DE: карточка и озвучка читают немецкий ответ
    p.evaluate("DQWordPop.showRu('дом', 300, 300)")
    p.wait_for_timeout(600)
    log("RU->DE:", p.evaluate("[document.querySelector('.wordpop-ru').textContent, document.querySelector('.wordpop-photo img')?.complete]"))
    p.screenshot(path="tests/_v_ru.png")
    p.evaluate("DQWordPop.hide()")

    # --- клик по русскому слову в «живом» тексте (фраза просматривается)
    p.evaluate("""() => {
      const host = document.createElement('div');
      host.id = 'qaLive'; host.className = 'rd-text'; host.style.position='fixed';
      host.style.left='20px'; host.style.top='120px'; host.style.zIndex='9999';
      host.textContent = 'Это мой дом и сад';
      document.body.appendChild(host);
    }""")
    p.wait_for_timeout(200)
    box = p.evaluate("(() => { const r = document.getElementById('qaLive').getBoundingClientRect(); return [r.left, r.top, r.height]; })()")
    target = p.evaluate("""() => {
      const el = document.getElementById('qaLive');
      const r = document.createRange();
      const node = el.firstChild; const i = node.textContent.indexOf('дом');
      r.setStart(node, i + 1); r.setEnd(node, i + 1);
      const rc = r.getBoundingClientRect();
      return [rc.left + 2, rc.top + 2];
    }""")
    p.mouse.click(target[0], target[1])
    p.wait_for_timeout(600)
    log("клик по русскому слову в тексте:", p.evaluate(
        "[document.querySelector('.wordpop').classList.contains('open'), document.querySelector('.wordpop-de').textContent, document.querySelector('.wordpop-ru').textContent]"))
    p.evaluate("DQWordPop.hide()")

    # --- 2. фото к слову
    src = os.path.join("tests", "_v_pic.png")
    if not os.path.exists(src):
        from PIL import Image
        im = Image.new("RGB", (640, 420), (40, 130, 220))
        for x in range(200, 440):
            for y in range(120, 300):
                im.putpixel((x, y), (250, 210, 40))
        im.save(src)
    log("загрузка фото:", post_photo("das Haus", src).get("ok"))
    p.evaluate("DQUI.reload()")
    p.wait_for_timeout(400)
    log("DQUI.photo('Haus'):", p.evaluate("DQUI.photo('Haus')"))
    log("photoHtml(Haus):", bool(p.evaluate("DQUI.photoHtml('Haus', {size: 200})")))

    p.evaluate("DQNav.go('train')")
    p.wait_for_timeout(2500)
    sizes = p.evaluate("""() => {
      const img = document.querySelector('#qPhoto img');
      if (!img) return null;
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      return {w: Math.round(r.width), h: Math.round(r.height), fit: cs.objectFit, src: img.getAttribute('src')};
    }""")
    log("фото в тренажёре:", sizes)
    p.screenshot(path="tests/_v_train.png")

    # --- 3. звук: слушаем вызовы DQSND из проверки ответа
    p.evaluate("""() => {
      window.__snd = [];
      const o = DQSND.correct, w = DQSND.wrong;
      DQSND.correct = () => { window.__snd.push('correct'); o.call(DQSND); };
      DQSND.wrong = () => { window.__snd.push('wrong'); w.call(DQSND); };
    }""")
    p.keyboard.press("Enter")
    p.wait_for_timeout(800)
    log("звук после ответа в тренажёре:", p.evaluate("window.__snd"))

    # --- звук в новой игре «Пары» (SFX через DQSND)
    p.evaluate("DQGames.open('pairs')")
    p.wait_for_timeout(800)
    p.evaluate("window.__snd = []")
    for i in range(3):
        cards = p.query_selector_all("#gBody [data-i]")
        if len(cards) > 1:
            cards[i % len(cards)].click()
            p.wait_for_timeout(250)
            cards[(i + 1) % len(cards)].click()
            p.wait_for_timeout(900)
    log("звук в «Парах»:", p.evaluate("window.__snd.slice(0,4)"), "контекст:", p.evaluate("DQSND.state.ready"))

    log("ошибки консоли:", [e for e in errs if "favicon" not in e][:8])
    b.close()
