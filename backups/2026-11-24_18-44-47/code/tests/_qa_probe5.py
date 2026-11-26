from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    p.goto("about:blank")
    res = p.evaluate("""async () => {
      const s = document.createElement('script');
      s.src = 'http://127.0.0.1:8123/theme.js?probe=1';
      s.crossOrigin = 'anonymous';
      const done = new Promise(r => { s.onload = () => r('loaded'); s.onerror = () => r('error'); });
      document.head.appendChild(s);
      return await done;
    }""")
    print("external:", res, p.evaluate("typeof window.DQ_THEME"))
    try:
        p.evaluate("window.DQ_THEME = 1;")
        print("assignable")
    except Exception as e:
        print("assign blocked:", type(e).__name__, str(e).splitlines()[0])
    p.goto("http://127.0.0.1:8123/")
    p.wait_for_timeout(1500)
    print("via goto:", p.evaluate("typeof window.DQ_THEME"), p.evaluate("document.URL"))
    r = p.request.get("http://127.0.0.1:8123/")
    print("root len:", len(r.text()), "has DQ_THEME define:", "DQ_THEME" in r.text(), "theme script:", "theme.js?v=60" in r.text())
    b.close()
