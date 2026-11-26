from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    p.goto("http://127.0.0.1:8124/", wait_until="domcontentloaded")
    p.wait_for_timeout(1200)
    print("inline eval:", p.evaluate("(() => { return 1 + 1; })()"))
    print("new Function:", p.evaluate("new Function('return 7')()"))
    print("script textContent:", p.evaluate("""() => {
      const s = document.createElement('script');
      s.textContent = 'window.__z = 42;';
      document.head.appendChild(s);
      return [s.parentNode && s.parentNode.tagName, !!document.querySelector('script:not([src])')];
    }"""))
    print("after:", p.evaluate("typeof window.__z"))
    b.close()
