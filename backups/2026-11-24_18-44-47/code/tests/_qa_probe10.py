from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    p.goto("http://127.0.0.1:8123/", wait_until="domcontentloaded")
    print(p.evaluate("""async () => {
      const out = [];
      for (const u of ['/fx.js', '/sound.js', '/dq-ui.js', '/phonetics.js', '/learn.js', '/nav.js']) {
        const txt = await (await fetch(u)).text();
        const s = document.createElement('script');
        s.textContent = txt;
        document.head.appendChild(s);
        out.push(u + ':' + (typeof window.DQFX !== 'undefined' || typeof window.DQSND !== 'undefined' || typeof window.DQUI !== 'undefined' || typeof window.DQPhon !== 'undefined' || typeof window.DQLearn !== 'undefined' || typeof window.DQNav !== 'undefined'));
      }
      return out;
    }"""))
    b.close()
