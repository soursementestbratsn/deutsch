from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    p.goto("http://127.0.0.1:8124/", wait_until="domcontentloaded")
    p.wait_for_timeout(1200)
    print(p.evaluate("""() => {
      const marks = [];
      try {
        marks.push('main1 ' + (window.DQ === undefined));
        const fr = document.createElement('iframe');
        document.body.appendChild(fr);
        const d = fr.contentDocument;
        const s = d.createElement('script');
        s.textContent = 'window.__m = 5; parent.postMessage("in","*");';
        d.head.appendChild(s);
        marks.push('iframe eval=' + fr.contentWindow.__m);
        marks.push('main2 ' + (window.DQ === undefined));
        let ev = [];
        document.addEventListener('securitypolicyviolation', e => ev.push(e.violatedDirective + ' ' + e.blockedURI));
        window.__ev = ev;
      } catch (e) { marks.push('ERR ' + e.message); }
      return marks;
    }"""))
    print("violations:", p.evaluate("window.__ev"))
    print("console direct:", p.evaluate("(() => { try { return eval('1+1'); } catch (e) { return 'eval blocked: ' + e.message; } })()"))
    b.close()
