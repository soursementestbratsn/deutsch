from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p1 = b.new_page()
    p2 = b.new_page()
    for p in (p1, p2):
        p.goto("about:blank")
        print(p.evaluate("""() => {
          const s = document.createElement('script');
          s.textContent = 'window.__z = 42;';
          document.head.appendChild(s);
          return window.__z;
        }"""))
    b.close()
