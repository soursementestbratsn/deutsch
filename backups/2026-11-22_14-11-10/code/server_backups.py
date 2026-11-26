# -*- coding: utf-8 -*-
"""Страницы «История версий» для веб-сервера Deutsch Quest.

Вынесено из server.py, потому что это чистая вёрстка: список бэкапов
(`/backups`) и карточка одной версии (`/backups/<ID>`). Данные берёт
из scripts/backup.py (индекс backups/index.json).

Откат делает server.py (маршрут /backups/<ID>/restore), чтобы не
передавать друг другу объекты запроса.
"""


def esc(text):
    return (str(text if text is not None else "")
            .replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def kb(n):
    n = int(n or 0)
    return f"{n / 1024:.0f} КБ" if n < 1024 * 1024 else f"{n / 1024 / 1024:.1f} МБ"


_CSS = """
:root{--bg:#0b0c10;--card:#15171c;--line:#262932;--text:#f2f3f5;--dim:#a7acb8;--acc:#2ee6a8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 "Segoe UI",system-ui,sans-serif;
  padding:28px 20px 60px}
.wrap{max-width:980px;margin:0 auto}
a{color:var(--acc);text-decoration:none} a:hover{text-decoration:underline}
h1{font-size:24px;margin:0 0 6px;letter-spacing:-.02em}
h1.h2t{font-size:18px;margin-top:26px}
.sub{color:var(--dim);margin:0 0 22px}
.top{display:flex;gap:10px;align-items:center;margin-bottom:22px;flex-wrap:wrap}
.top a{background:var(--card);border:1px solid var(--line);padding:7px 12px;border-radius:10px;font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:12px}
.card h2{font-size:17px;margin:0 0 4px}
.meta{color:var(--dim);font-size:13px;display:flex;gap:14px;flex-wrap:wrap}
.meta b{color:var(--text);font-weight:600}
.prompt{white-space:pre-wrap;background:#0f1116;border:1px solid var(--line);border-radius:12px;
  padding:12px 14px;font-size:14px;color:#dfe2e8;margin:10px 0}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--dim);font-weight:500}
code{background:#0f1116;padding:1px 5px;border-radius:5px;font-size:13px}
.btn{display:inline-block;border:1px solid var(--line);background:#1d2027;color:var(--text);
  padding:8px 14px;border-radius:10px;font:inherit;font-size:14px;cursor:pointer;text-decoration:none}
.btn:hover{border-color:var(--acc)}
.btn.danger{color:#ff8080;border-color:#5a2b2b;background:#221518}
.warn{color:#ffcf70;font-size:13px}
.k{display:inline-block;background:#0f1116;border:1px solid var(--line);border-radius:8px;
  padding:2px 8px;font-size:13px;margin:2px 4px 2px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
"""


def _shell(title, body):
    return f"""<!doctype html><html lang="ru"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)} · Deutsch Quest</title>
<style>{_CSS}</style>
<div class="wrap">
<div class="top">
  <a href="/">← Deutsch Quest</a>
  <a href="/backups">Все версии</a>
  <button class="btn" id="mk">Сделать снимок сейчас</button>
  <span class="warn" id="msg"></span>
</div>
{body}
</div>
<script>
document.getElementById('mk').onclick = async () => {{
  const label = prompt('Подпись для версии:', 'ручной снимок');
  if (label === null) return;
  const r = await fetch('/api/backup/now', {{method:'POST', headers:{{'Content-Type':'application/json'}},
    body: JSON.stringify({{label, prompt: 'Создано вручную из страницы версий'}})}});
  const d = await r.json();
  if (d.ok) location.href = '/backups/' + d.version.id;
  else document.getElementById('msg').textContent = 'Ошибка: ' + (d.error || 'неизвестно');
}};
</script></html>"""


def _html_page(title, body):
    return _shell(title, body)


def _render_versions_list(versions):
    if not versions:
        return ("<h1>История версий</h1>"
                '<p class="sub">Версий пока нет. Нажмите «Сделать снимок сейчас».</p>')
    cards = []
    total = len(versions)
    for i, v in enumerate(versions):
        st = v.get("stats") or {}
        pr = st.get("прогресс") or {}
        prompt = ""
        if v.get("prompt"):
            prompt = '<div class="prompt">{}</div>'.format(esc(str(v["prompt"])[:400]))
        cards.append(
            '<div class="card">'
            '<h2><a href="/backups/{}">№{} · {}</a></h2>'
            '<div class="meta">'
            '<span><b>{}</b></span>'
            '<span>ответов: <b>{}</b></span>'
            '<span>XP: <b>{}</b></span>'
            '<span>слов: <b>{}</b></span>'
            '<span>файлов: <b>{}</b></span>'
            '<span>изменено: <b>{}</b></span>'
            '<span>{}</span>'
            '</div>{}</div>'.format(
                esc(v["id"]), total - i, esc(v.get("label")),
                esc(v["id"]),
                esc(pr.get("answered", "—")), esc(pr.get("xp", "—")),
                esc(st.get("пар слов", "—")),
                esc(v.get("files", 0)), esc(v.get("changed", 0)),
                kb(v.get("size")), prompt,
            ))
    return ('<h1>История версий</h1>'
            '<p class="sub">{} снимков · лежат в папке <code>backups/</code> этого проекта</p>'
            .format(total) + "".join(cards))


def _render_version_detail(v, info):
    st = info.get("stats") or {}
    prog = st.get("прогресс") or {}
    chips = "".join('<span class="k">{}: <b>{}</b></span>'.format(esc(k), esc(val))
                    for k, val in prog.items())
    others = "".join('<span class="k">{}: <b>{}</b></span>'.format(esc(k), esc(val))
                     for k, val in st.items() if k != "прогресс")
    changes = v.get("changes") or []
    if changes:
        rows = "".join('<tr><td><code>{}</code></td><td>{}</td></tr>'.format(
            esc(c.get("файл")), esc(c.get("что"))) for c in changes)
        ch_block = '<table><tr><th>Файл</th><th>Что</th></tr>{}</table>'.format(rows)
    else:
        ch_block = '<p class="sub">Изменений нет (первый снимок или тот же код).</p>'
    prev = v.get("prev")
    prev_link = ('<a href="/backups/{}">{}</a>'.format(esc(prev), esc(prev))
                 if prev else "—")
    vid = esc(v["id"])
    return ('<h1>{}</h1>'
            '<p class="sub">{} · предыдущая версия: {}</p>'
            '<p><a class="btn" href="/backups/{}/restore">Вернуть код этой версии</a> '
            '<a class="btn danger" href="/backups/{}/restore?stats=1" '
            "onclick=\"return confirm('Вернуть вместе с прогрессом и настройками? "
            "Текущий прогресс будет заменён.')\">Вернуть КОД + ПРОГРЕСС</a></p>"
            '<h1 class="h2t">Мой запрос</h1>'
            '<div class="prompt">{}</div>'
            '<h1 class="h2t">Данные на момент снимка</h1>'
            '<div class="grid" style="margin:8px 0 14px">{}{}</div>'
            '<h1 class="h2t">Что изменилось</h1>{}'
            '<h1 class="h2t">Папка</h1>'
            '<p class="sub"><code>backups/{}/code</code> — полная копия проекта; '
            '<code>backups/{}/info/</code> и <code>ЗАМЕТКА.md</code> — запрос, '
            'изменения, статистика, список файлов.</p>'
            ).format(
                esc(v.get("label")), vid, prev_link, vid, vid,
                esc(info.get("prompt") or "—"), chips, others, ch_block, vid, vid)
