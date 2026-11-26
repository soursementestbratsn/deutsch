#!/usr/bin/env python3
# обновлять agents.md
"""
Launch admin panel - starts server and opens browser
Usage: python launch_admin.py [--port 8000] [--token YOUR_TOKEN]
"""
import sys
import os
import subprocess
import time
import webbrowser
import threading
import argparse
import signal

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_PY = os.path.join(BASE_DIR, "server.py")

def run_server(port, ready_event):
    """Run server in background thread"""
    cmd = [sys.executable, SERVER_PY, "--port", str(port), "--no-browser"]
    proc = subprocess.Popen(cmd, cwd=BASE_DIR)
    ready_event.set()
    proc.wait()

def wait_for_server(port, timeout=10):
    """Wait for server to be ready"""
    import urllib.request
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/api/data", timeout=1)
            return True
        except Exception:
            time.sleep(0.2)
    return False

def main():
    parser = argparse.ArgumentParser(description="Launch Deutsch Quest Admin Panel")
    parser.add_argument("--port", type=int, default=8000, help="Server port (default: 8000)")
    parser.add_argument("--token", help="Admin token (optional, reads from env DEUTSCH_QUEST_ADMIN_TOKEN)")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser")
    args = parser.parse_args()

    token = args.token or os.environ.get("DEUTSCH_QUEST_ADMIN_TOKEN", "")

    print(f"🚀 Starting server on port {args.port}...")
    ready = threading.Event()
    server_thread = threading.Thread(target=run_server, args=(args.port, ready), daemon=True)
    server_thread.start()

    ready.wait()  # wait for process to start
    print("⏳ Waiting for server to be ready...")
    if not wait_for_server(args.port):
        print("❌ Server failed to start")
        return 1

    url = f"http://127.0.0.1:{args.port}/admin.html"
    if token:
        url += f"?token={token}"

    print(f"✅ Server ready!")
    print(f"🌐 Opening: {url}")

    if not args.no_browser:
        webbrowser.open(url)

    print("📋 Admin panel loaded. Press Ctrl+C to stop server.")
    try:
        server_thread.join()
    except KeyboardInterrupt:
        print("\n👋 Stopping server...")
    return 0

if __name__ == "__main__":
    sys.exit(main())