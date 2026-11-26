from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for ch in ("chromium", ):
        ctx = getattr(b, "new_context")()
        p = ctx.new_page()
        p.goto("http://127.0.0.1:8124/", wait_until="domcontentloaded")
        p.wait_for_timeout(1200)
        print("csp meta:", p.evaluate("[...document.querySelectorAll('meta[http-equiv]')].map(m=>m.outerHTML)"))
        print("strict-dynamic?", p.evaluate("document.querySelector('script') && document.querySelector('script').src"))
        p2 = b.new_page()
        p2.goto("http://127.0.0.1:8124/", wait_until="domcontentloaded")
        p2.wait_for_timeout(1200)
        print("page2 typeof DQ:", p2.evaluate("typeof window.DQ"))
        print("page1 again:", p.evaluate("typeof window.DQ"))
    b.close()
