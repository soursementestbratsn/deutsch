from patchright.sync_api import sync_playwright

JS = r"""
() => new Promise((resolve) => {
  const out = [];
  const s = document.createElement('script');
  s.src = '/theme.js?probe=' + Date.now();
  s.onload = () => { out.push('onload typeof=' + typeof window.DQ_THEME); resolve(out); };
  s.onerror = (e) => { out.push('onerror'); resolve(out); };
  document.head.appendChild(s);
  setTimeout(() => { out.push('timeout typeof=' + typeof window.DQ_THEME); resolve(out); }, 3000);
});
"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    p.on("requestfailed", lambda r: print("FAILED", r.url, r.failure))
    p.on("console", lambda m: print("CONSOLE", m.type, m.text[:200]))
    p.goto("http://127.0.0.1:8123/", wait_until="domcontentloaded")
    print(p.evaluate(JS))
    b.close()
