from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    p.on("pageerror", lambda e: print("PAGEERR", str(e)[:300]))
    p.goto("http://127.0.0.1:8124/", wait_until="domcontentloaded")
    p.wait_for_timeout(1500)
    print(p.evaluate("""() => {
      const s = document.createElement('script');
      s.textContent = 'window.__z = 42; window.DQ_THEME = {a:1};';
      document.head.appendChild(s);
      return [window.__z, typeof window.DQ_THEME, typeof window.SETTINGS, typeof window.DQSND, typeof window.DQ];
    }"""))
    print(p.evaluate("document.title"))
    b.close()
