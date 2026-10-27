#!/usr/bin/env python3
"""HELIX · server di sviluppo locale.

I moduli ES e il caricamento di shader/JSON non funzionano da file:// ,
quindi per provare la versione "sorgente" serve un piccolo server HTTP.
Uso:  python tools/serve.py   →   apri http://localhost:8000
"""
import http.server
import socketserver
import os
import webbrowser

PORT = int(os.environ.get("PORT", 8000))
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript",
                      ".glsl": "text/plain", ".json": "application/json"}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # niente cache durante lo sviluppo
        super().end_headers()


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"HELIX in esecuzione su {url}  (Ctrl+C per fermare)")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        httpd.serve_forever()
