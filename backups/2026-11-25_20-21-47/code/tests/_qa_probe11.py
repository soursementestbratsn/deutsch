from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    p.on("console", lambda m: print("CONSOLE", m.type, m.text[:300]))
    p.on("pageerror", lambda e: print("PAGEERR", str(e)[:300]))
    p.goto("http://127.0.0.1:8123/", wait_until="domcontentloaded")
    r = p.evaluate("""async () => {
      const txt = await (await fetch('/theme.js')).text();
      try { new Function(txt); return 'syntax ok len=' + txt.length; }
      catch (e) { return 'SYNTAX ' + e.message; }
    }""")
    print(r)
    print(p.evaluate("""() => {
      const s = document.createElement('script');
      s.textContent = 'window.__z = 42; window.DQ_THEME = {a:1};';
      document.head.appendChild(s);
      return [window.__z, typeof window.DQ_THEME];
    }"""))
    b.close()
