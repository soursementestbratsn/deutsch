from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    notes = []
    p.on("console", lambda m: notes.append(m.type + ": " + m.text[:200]))
    p.on("pageerror", lambda e: notes.append("PAGEERROR " + str(e)[:300]))
    p.on("requestfailed", lambda r: notes.append("FAILED " + r.url.split("/")[-1]))
    p.on("response", lambda r: notes.append("RESP %d %s" % (r.status, r.url.split("/")[-1]))
         if r.url.endswith((".js", ".css")) or "?v=" in r.url else None)
    p.goto("http://127.0.0.1:8123/", wait_until="load")
    p.wait_for_timeout(2000)
    print("\n".join(notes[:40]))
    print("globals:", p.evaluate("[typeof window.DQ_THEME, typeof window.SETTINGS, typeof window.DQSND]"))
    print("inline scripts:", p.evaluate("document.querySelectorAll('script:not([src])').length"))
    b.close()
