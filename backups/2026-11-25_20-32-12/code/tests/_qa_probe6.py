from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    p.on("requestfailed", lambda r: print("FAILED", r.url, r.failure))
    p.on("console", lambda m: print("CONSOLE", m.type, m.text[:200]))
    p.goto("http://127.0.0.1:8123/")
    p.wait_for_timeout(1500)
    print("typeof after goto:", p.evaluate("typeof window.DQ_THEME"))
    b.close()
