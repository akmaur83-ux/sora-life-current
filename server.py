#!/usr/bin/env python3
"""Tiny static server with SPA fallback for the Sora Life prototype.
Serves the project root; any path without a file extension falls back to
index.html so client-side routes (e.g. /shop, /product/...) load directly.
Pure standard library — no native binaries, no dependencies.
"""
import http.server
import socketserver
import os
from urllib.parse import urlparse

PORT = int(os.environ.get("PORT", "4173"))
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = urlparse(self.path).path
        candidate = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        # Serve real files as-is; otherwise fall back to index.html (SPA routes).
        if path != "/" and os.path.isfile(candidate):
            return super().do_GET()
        if path == "/" or "." not in os.path.basename(path):
            self.path = "/index.html"
        return super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Sora Life running at http://localhost:{PORT}")
        httpd.serve_forever()
