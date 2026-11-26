import json, urllib.request
body = json.dumps({"text": "дом", "kind": "word", "rev": True}, ensure_ascii=False).encode("utf-8")
req = urllib.request.Request("http://127.0.0.1:8123/api/tr/lookup", data=body,
                             headers={"Content-Type": "application/json"})
print(urllib.request.urlopen(req).read().decode())
