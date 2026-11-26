from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    p.goto("http://127.0.0.1:8123/", wait_until="domcontentloaded")
    p.wait_for_timeout(800)
    for url in ["/theme.js", "/sound.js", "/dq-ui.js", "/settings.js"]:
        src = p.request.get("http://127.0.0.1:8123" + url).text()
        r = p.evaluate("""async ([u, s]) => {
          try { await (0, eval)(s); return 'eval-ok'; } catch (e) { return 'eval ' + e.message + ' @' + (e.stack||'').split('\\n')[1]; }
        }""", [url, src])
        print(url, "->", r, "| now:", p.evaluate("typeof window.DQ_THEME + '/' + typeof window.DQSND"))
    b.close()
