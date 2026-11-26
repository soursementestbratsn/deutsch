from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_page()
    p.goto("http://127.0.0.1:8123/", wait_until="networkidle")
    p.evaluate("window.__errs=[]; window.addEventListener('error', e => window.__errs.push((e.message||'')+' @ '+(e.filename||'')+':'+e.lineno), true);")
    r = p.evaluate("""(() => {
      const s=document.createElement('script'); s.src='/theme.js?v=58';
      document.head.appendChild(s);
      return new Promise(res => { s.onload=()=>res('loaded'); s.onerror=()=>res('error'); setTimeout(()=>res('timeout'),3000); });
    })()""")
    print("load:", r, "types:", p.evaluate("[typeof window.DQ_THEME, window.__errs]"))
    b.close()
