from patchright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for route in ["/theme.js", "/theme.js?v=60", "/sound.js", "/settings.js"]:
        pg = b.new_page()
        r = pg.request.get("http://127.0.0.1:8123" + route)
        body = r.text()
        ct = r.headers.get("content-type")
        print(route, r.status, ct, "chars:", len(body), "lines:", body.count("\n"),
              "head:", body[:40].replace("\n", " "))
        pg.close()
    b.close()
