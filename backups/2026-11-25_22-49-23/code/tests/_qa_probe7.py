from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    p.goto("http://127.0.0.1:8123/", wait_until="domcontentloaded")
    p.wait_for_timeout(1000)
    print(p.evaluate("""() => ({
      t: typeof window.DQ_THEME,
      scripts: document.scripts.length,
      first: document.scripts[0] && document.scripts[0].src,
      ready: document.readyState,
      body: !!document.body,
      settings: typeof window.SETTINGS,
    })"""))
    print("ctxs:", [type(c).__name__ for c in p.context.pages])
    print("frames:", [f.url for f in p.frames])
    b.close()
