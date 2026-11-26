from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    errs = []
    p.on("console", lambda m: errs.append(m.type + ": " + m.text))
    p.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    p.on("requestfailed", lambda r: errs.append("FAILED " + r.url))
    p.goto("http://127.0.0.1:8123/", wait_until="load")
    p.wait_for_timeout(2500)
    print("globals:", p.evaluate("[typeof SETTINGS, typeof DQ, typeof DQUI, typeof DQSND]"))
    print("scripts:", p.evaluate("[...document.scripts].map(s => s.src.split('/').pop())"))
    print("log:", [e for e in errs if not e.startswith('FAILED')][:15])
    for name in ["theme.js?v=60", "settings.js?v=61"]:
        try:
            r = p.evaluate("u => fetch(u).then(r => r.text()).then(t => t.slice(-300))", "/" + name)
            print(name, "->", r[-160:])
        except Exception as ex:
            print(name, "ERR", ex)
    b.close()
