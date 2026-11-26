# -*- coding: utf-8 -*-
"""ОТДЕЛЬНЫЙ САЙТ «История версий» Deutsch Quest.

Запуск (не зависит от основного сайта с его словарями и прогрессом):

    python server_backups.py            # http://127.0.0.1:8001
    python server_backups.py --port 8010

Ходит в ту же папку backups/ и тот же scripts/backup.py, что и основной
сайт, но имеет собственный процесс, свой порт и свою вёрстку. Даже если
основной сервер лежит/запускается в другом порту — история версий доступна.

Скрипт-ярлык для Windows: `Открыть-версии.ps1`.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))

import backup as _bak                      # noqa: E402
from server_backups import (_html_page, _render_versions_list,  # noqa: E402
                            _render_version_detail)

MAIN_PORTS = (8000, 9000)                  # куда вести «открыть сайт»


class VersionsHandler(SimpleHTTPRequestHandler):
    """Всё, кроме /api/*, отдаём сами — статики тут нет."""

    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def log_message(self, fmt, *args):
        pass                               # страница тихая: только по ошибкам
        if args and str(args).find("404") >= 0:
            sys.stderr.write("  ! %s\n" % (fmt % args))

    # ---- helpers
    def _html(self, title, body):
        raw = _html_page(title, body).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    # ---- routes
    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith("/backups/"):
            return self._version_route(path[len("/backups/"):])
        if path in ("/", "/backups", "/versions", "/index.html"):
            versions = list(reversed(_bak.load_index()))
            return self._html("История версий", _render_versions_list(versions))
        if path == "/api/versions":
            return self._json({"versions": _bak.load_index()})
        return self.send_error(404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            length = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            payload = {}
        if path == "/api/backup/now":
            entry = _bak.make_backup(prompt=str(payload.get("prompt") or ""),
                                     label=str(payload.get("label") or ""))
            return self._json({"ok": True, "version": entry})
        if path == "/api/backup/restore":
            try:
                done = _bak.restore(str(payload.get("id") or ""),
                                    with_stats=bool(payload.get("withStats")),
                                    only=str(payload.get("file") or ""))
            except SystemExit as exc:
                return self._json({"ok": False, "error": str(exc)}, 400)
            return self._json({"ok": True, "restored": done})
        return self.send_error(404)

    def _version_route(self, rest):
        vid, _, action = rest.partition("/")
        v = _bak.find(vid)
        if not v:
            return self.send_error(404, "версия не найдена")
        if action == "restore":
            qs = parse_qs(urlparse(self.path).query)
            with_stats = qs.get("stats", ["0"])[0] in ("1", "true")
            try:
                done = _bak.restore(vid, with_stats=with_stats)
            except SystemExit as exc:
                return self._html("Ошибка", f"<p>{exc}</p>")
            port = self.server.server_address[1]
            body = ("<h1>Файлы возвращены</h1>"
                    f"<p>Версия <b>{vid}</b>: восстановлено файлов — <b>{len(done)}</b>."
                    + (" Прогресс тоже возвращён." if with_stats else " Прогресс не тронут.")
                    + f"</p><p><a href='/'>← ко всем версиям</a> · "
                    f"<a href='http://127.0.0.1:{MAIN_PORTS[0]}/'>открыть сайт</a></p>")
            return self._html("Восстановлено", body)
        return self._html(f"Версия {vid}", _render_version_detail(v, _bak.read_info(vid)))


def serve(port=8001, open_browser=True):
    ThreadingHTTPServer.allow_reuse_address = True
    ThreadingHTTPServer.daemon_threads = True
    httpd = ThreadingHTTPServer(("127.0.0.1", port), VersionsHandler)
    url = f"http://127.0.0.1:{port}/"
    print(f"История версий (отдельный сайт) → {url}")
    print("Остановить: Ctrl+C")
    if open_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        print("\nОстановлен.")
    finally:
        httpd.server_close()


def main():
    ap = argparse.ArgumentParser(description="отдельный сайт истории версий")
    ap.add_argument("--port", type=int, default=8001)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()
    serve(args.port, open_browser=not args.no_browser)


if __name__ == "__main__":
    main()
