"""Authenticated cloud build downloads; no APK or embedded Alpha token is public."""
import hmac
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

root = Path('build-artifacts/mobile').resolve()
token = os.environ.get('MASANAWA_APK_DOWNLOAD_TOKEN', '')
if len(token) < 32:
    raise SystemExit('MASANAWA_APK_DOWNLOAD_TOKEN is required')

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/healthz':
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"status":"ok"}')
            return
        if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + token):
            self.send_response(401); self.end_headers(); return
        filename = {'/masanawa-alpha.apk': 'masanawa-alpha.apk', '/masanawa-alpha.apk.sha256': 'masanawa-alpha.apk.sha256', '/manifest.json': 'manifest.json'}.get(self.path)
        if not filename or not (root / filename).is_file():
            self.send_response(404); self.end_headers(); return
        file = root / filename
        self.send_response(200)
        self.send_header('Content-Type', 'application/vnd.android.package-archive' if filename.endswith('.apk') else 'application/json' if filename.endswith('.json') else 'text/plain')
        self.send_header('Content-Length', str(file.stat().st_size)); self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        with file.open('rb') as stream:
            while chunk := stream.read(65536):
                self.wfile.write(chunk)
    def log_message(self, format, *args):
        # Fixed paths only; never log request headers or bearer credentials.
        pass

HTTPServer(('0.0.0.0', int(os.environ.get('PORT', '3000'))), Handler).serve_forever()
