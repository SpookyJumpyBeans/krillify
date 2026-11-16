"""Renders the Chrome Web Store images from the pages in this folder.

    python tools/store-art/capture.py

Serves this folder at / and extension/ at /ext/, then uses headless Edge (or Chrome) to
screenshot each page at the size the store asks for. Writes dist/store-art/*.png.
"""
import functools, http.server, os, shutil, subprocess, threading
from pathlib import Path

here = Path(__file__).resolve().parent
root = here.parent.parent
ext = root / "extension"
out = root / "dist" / "store-art"
out.mkdir(parents=True, exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = path.split("?", 1)[0]
        if path.startswith("/ext/"):
            return str(ext / path[len("/ext/"):])
        return str(here / path.lstrip("/"))
    def log_message(self, *args):
        pass

server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_address[1]}"

candidates = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    shutil.which("chromium") or "", shutil.which("google-chrome") or "",
]
browser = next((c for c in candidates if c and Path(c).exists()), None)
if not browser:
    raise SystemExit("Needs Edge or Chrome installed.")

shots = [
    ("screenshot-1-suggestions.png", "/party/demo/", 1280, 800),
    ("screenshot-2-settings.png", "/settings.html", 1280, 800),
    ("promo-tile-440x280.png", "/tile.html", 440, 280),
]
profile = out / ".profile"
for name, page, width, height in shots:
    target = out / name
    subprocess.run([browser, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
                    f"--user-data-dir={profile}", f"--window-size={width},{height}", "--virtual-time-budget=4000",
                    f"--screenshot={target}", base + page], check=True, capture_output=True, timeout=60)
    print("wrote", target)
server.shutdown()
shutil.rmtree(profile, ignore_errors=True)
