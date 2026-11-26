import asyncio
import json
import os
import sys

from patchright.async_api import async_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8124"
OUT = os.path.dirname(os.path.abspath(__file__))


async def main():
    logs = []
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1440, "height": 950})
        page.on("console", lambda m: logs.append("console.%s: %s" % (m.type, m.text)))
        page.on("pageerror", lambda e: logs.append("pageerror: %s" % e))
        await page.goto(BASE + "/", wait_until="networkidle")
        await page.wait_for_timeout(2500)

        info = {}
        info["hasDQUI"] = await page.evaluate("!!window.DQUI")
        info["hasDict"] = await page.evaluate("!!window.DQDict")
        info["views"] = await page.evaluate("document.querySelectorAll('.view').length")
        info["photos"] = await page.evaluate("window.DQUI ? Object.keys(window.DQUI.photos()).length : -1")

        # 1) Артикли: тренажёр немецкий вопрос
        await page.evaluate("window.DQNav && window.DQNav.go('train')")
        await page.wait_for_timeout(1200)
        # ставим немецкий вопрос и выбор вариантов
        await page.click("#direction button[data-dir='de-ru']")
        await page.click("#inputType button[data-input='choice']")
        await page.wait_for_timeout(1200)
        await page.screenshot(path=os.path.join(OUT, "_dbg1.png"))
        info["dbg"] = await page.evaluate("({view: (document.querySelector('.view.active')||{}).id, q: document.querySelector('#qText').textContent, dir: window.DQ.direction})")
        info["art_markup"] = await page.evaluate("document.querySelector('#qText') ? document.querySelector('#qText').innerHTML.slice(0,160) : ''")
        info["arts"] = await page.evaluate("document.querySelectorAll('.view.active .dq-art, #qText .dq-art').length")
        info["art_colors"] = await page.evaluate(
            "(() => { const a=document.querySelector('.art-der'); const b=document.querySelector('.art-die'); const c=document.querySelector('.art-das');"
            " const g=(x)=>x?getComputedStyle(x).color:''; return {der:g(a),die:g(b),das:g(c)}; })()")
        await page.screenshot(path=os.path.join(OUT, "_shot_train.png"))

        # 2) RU → DE: озвучку немецкого не должно быть
        await page.click("#direction button[data-dir='ru-de']")
        await page.wait_for_timeout(1500)
        info["ru_de"] = await page.evaluate(
            "(() => { const t=document.querySelector('#qTools'); return {toolsShown: t ? t.style.display : null,"
            " toolsText: t ? t.textContent.trim() : null, pron: (document.querySelector('#phonBox')||{}).textContent || ''}; })()")
        await page.screenshot(path=os.path.join(OUT, "_shot_ru_de.png"))

        # 3) Курс: проверка подсветки выбора и Enter
        await page.evaluate("window.DQNav && window.DQNav.go('course')")
        await page.wait_for_timeout(1500)
        info["course_view"] = await page.evaluate("({view:(document.querySelector('.view.active')||{}).id, body: document.querySelector('#courseBody').innerHTML.slice(0,200)})")
        await page.screenshot(path=os.path.join(OUT, "_dbg2.png"))
        info["err"] = "course"
        await browser.close()
        print(json.dumps(info, ensure_ascii=False, indent=1))
        for l in logs[:60]:
            print(l)
        return
        await page.click(".cr-node")
        await page.wait_for_timeout(700)
        # доходим до практики: слова → правило → практика
        for _ in range(60):
            step = await page.evaluate("(document.querySelector('#crRule')||{}).className || ''")
            if await page.locator("#crAnswer").count():
                break
            if await page.locator("#crNext").count():
                await page.click("#crNext")
            await page.wait_for_timeout(120)
        info["course_task"] = await page.evaluate("!!document.querySelector('#crAnswer')")
        if await page.locator("#crAnswer .opt").count():
            await page.click("#crAnswer .opt")
            info["sel_color"] = await page.evaluate(
                "(() => { const b=document.querySelector('#crAnswer .opt.sel'); return b ? getComputedStyle(b).borderColor : ''; })()")
        await page.screenshot(path=os.path.join(OUT, "_shot_course.png"))
        info["course_opts"] = await page.locator("#crAnswer .opt").count()
        await page.wait_for_timeout(300)
        before = await page.evaluate("document.querySelector('#crFb').textContent.trim()")
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(400)
        after = await page.evaluate("document.querySelector('#crFb').textContent.trim()")
        nexttext = await page.evaluate("document.querySelector('#crCheck') ? document.querySelector('#crCheck').textContent : ''")
        before2 = await page.evaluate("document.body.innerText.includes('Практика')")
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(600)
        advanced = await page.evaluate("(document.querySelector('.cr-head')||{}).textContent || ''")
        info["course_enter"] = {"before": before, "afterCheck": after, "btn": nexttext, "advanced": advanced.strip()[:60]}

        # 4) Словарь
        await page.evaluate("window.DQNav && window.DQNav.go('dict')")
        await page.wait_for_timeout(1500)
        info["dict_rows"] = await page.locator(".dt-row").count()
        info["dict_stats"] = await page.evaluate("document.querySelector('#dictStats').textContent")
        await page.screenshot(path=os.path.join(OUT, "_shot_dict.png"), full_page=False)
        # отметить первое слово
        await page.click(".dt-row .dt-check")
        await page.wait_for_timeout(700)
        info["picked"] = await page.evaluate("(document.querySelector('.dt-row')||{}).className")
        # загрузка фото через API моделируем напрямую (файловый диалог не поднять)
        ok = await page.evaluate("""async () => {
            const c = document.createElement('canvas'); c.width = c.height = 60;
            const x = c.getContext('2d'); x.fillStyle = '#2ee6a8'; x.fillRect(0,0,60,60);
            const data = c.toDataURL('image/png');
            const w = document.querySelector('.dt-row .dt-de').textContent.replace(/^(der|die|das)\\s+/, '');
            const r = await fetch('/api/photo', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({word: w, data})});
            return await r.json();
        }""")
        info["upload"] = {"ok": ok.get("ok"), "count": len(ok.get("photos") or {})}
        await page.evaluate("window.DQDict.open()")
        await page.wait_for_timeout(1200)
        info["photo_imgs"] = await page.locator(".dt-ph img").count()
        await page.screenshot(path=os.path.join(OUT, "_shot_dict_photo.png"))
        # «учить выбранные»
        await page.click("#dictGo")
        await page.wait_for_timeout(1800)
        info["train_after_pick"] = await page.evaluate("({view: (document.querySelector('.view.active')||{}).id, words: window.DQ.enabledWords.length, pool: window.DQ.pool.length, q: document.querySelector('#qText').textContent})")
        await page.screenshot(path=os.path.join(OUT, "_shot_after_pick.png"))

        # убрать тестовое фото, чтобы не мешать пользователю
        await page.evaluate("""async () => {
            const w = window.DQ.enabledWords && window.DQ.enabledWords[0];
            await fetch('/api/photo/delete', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({word: w || ''})});
        }""")
        # вернуть группы (снять выбор слов) и прежнее направление
        await page.evaluate("window.DQ.clearWords()")
        await page.click("#direction button[data-dir='de-ru']")
        await page.wait_for_timeout(800)

        await browser.close()
    print(json.dumps(info, ensure_ascii=False, indent=1))
    print("---- LOGS ----")
    for l in logs[:40]:
        print(l)


asyncio.run(main())
