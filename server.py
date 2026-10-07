#!/usr/bin/env python3
"""
Google look-alike page with a hidden soundboard (search "ניק" to open it).

Zero dependencies - runs on any Python 3.8+:
    python server.py            -> http://localhost:3000

Env vars: PORT (default 3000), HOST (default 0.0.0.0), DATA_DIR (default ./data),
          OPEN_BROWSER=1 (open the site in the default browser on start).

Real-time delivery uses Server-Sent Events (/events): plain HTTP, works through
proxies, and the browser's EventSource reconnects on its own. The client adds a
watchdog on top so a silently dead connection is replaced.
"""

import json
import math
import os
import queue
import re
import socket
import socketserver
import sys
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(ROOT, "public")
DATA_DIR = os.path.abspath(os.environ.get("DATA_DIR") or os.path.join(ROOT, "data"))
SOUNDS_DIR = os.path.join(DATA_DIR, "sounds")
INDEX_FILE = os.path.join(DATA_DIR, "sounds.json")

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "3000"))

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_SOUNDS = 100
MAX_JSON_BYTES = 8 * 1024
PING_SECONDS = 10
MIN_BOOST, MAX_BOOST, DEFAULT_BOOST = 1.0, 5.0, 3.0

AUDIO_TYPES = {
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "ogg": "audio/ogg",
    "oga": "audio/ogg",
    "opus": "audio/ogg",
    "m4a": "audio/mp4",
    "aac": "audio/aac",
    "flac": "audio/flac",
    "webm": "audio/webm",
    "weba": "audio/webm",
    "mp4": "video/mp4",
}
MIME_TO_EXT = {
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mpeg3": "mp3", "audio/x-mpeg-3": "mp3",
    "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/vnd.wave": "wav",
    "audio/ogg": "ogg", "audio/opus": "opus",
    "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a",
    "audio/aac": "aac", "audio/x-aac": "aac",
    "audio/flac": "flac", "audio/x-flac": "flac",
    "audio/webm": "webm", "video/mp4": "mp4",
}
STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}
SOUND_FILE_RE = re.compile(r"^[0-9a-f]{32}\.[a-z0-9]{2,5}$")
SOUND_ID_RE = re.compile(r"^[0-9a-f]{32}$")
RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


def log(msg):
    print(time.strftime("[%H:%M:%S] ") + msg, flush=True)


def delete_file(path, tries=10):
    """Remove a file; on Windows a file being streamed is locked, so retry later."""
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    except OSError:
        if tries > 0:
            t = threading.Timer(3, delete_file, (path, tries - 1))
            t.daemon = True
            t.start()


def clean_name(s):
    s = re.sub(r"[\x00-\x1f\x7f​-‏‪-‮]", "", s)
    s = re.sub(r"_+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:60].strip()


def parse_filename(raw_header, content_type):
    """Returns (display_name, extension). Extension is '' when not an accepted audio file."""
    raw = unquote(raw_header or "")
    base = raw.replace("\\", "/").rsplit("/", 1)[-1]
    stem, dot, ext = base.rpartition(".")
    if not dot:
        stem, ext = base, ""
    ext = ext.lower()
    if ext not in AUDIO_TYPES:
        ext = MIME_TO_EXT.get((content_type or "").split(";")[0].strip().lower(), "")
    return clean_name(stem) or "סאונד", ext


def clamp_boost(value):
    try:
        b = float(value)
    except (TypeError, ValueError):
        return DEFAULT_BOOST
    if not math.isfinite(b):
        return DEFAULT_BOOST
    return round(min(MAX_BOOST, max(MIN_BOOST, b)), 2)


def sse(event, data):
    return "event: %s\ndata: %s\n\n" % (event, json.dumps(data, ensure_ascii=False))


class SoundStore:
    def __init__(self):
        os.makedirs(SOUNDS_DIR, exist_ok=True)
        self._lock = threading.Lock()
        self._sounds = self._load()

    def _load(self):
        try:
            with open(INDEX_FILE, encoding="utf-8") as f:
                items = json.load(f)
        except (OSError, ValueError):
            items = []
        if not isinstance(items, list):
            return []
        keep = []
        for s in items:
            if (isinstance(s, dict)
                    and isinstance(s.get("id"), str) and SOUND_ID_RE.match(s["id"])
                    and isinstance(s.get("file"), str) and SOUND_FILE_RE.match(s["file"])
                    and os.path.isfile(os.path.join(SOUNDS_DIR, s["file"]))):
                s.setdefault("name", "סאונד")
                s.setdefault("size", os.path.getsize(os.path.join(SOUNDS_DIR, s["file"])))
                s.setdefault("createdAt", int(time.time() * 1000))
                keep.append(s)
        return keep

    def _save(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        payload = json.dumps(self._sounds, ensure_ascii=False)
        tmp = INDEX_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(payload)
        for _ in range(10):
            try:
                os.replace(tmp, INDEX_FILE)
                return
            except PermissionError:  # Windows: briefly locked by antivirus/indexer
                time.sleep(0.05)
        with open(INDEX_FILE, "w", encoding="utf-8") as f:
            f.write(payload)

    @staticmethod
    def public(s):
        return {
            "id": s["id"],
            "name": s["name"],
            "url": "/sounds/" + s["file"],
            "size": s["size"],
            "createdAt": s["createdAt"],
        }

    def list(self):
        with self._lock:
            return [self.public(s) for s in self._sounds]

    def count(self):
        with self._lock:
            return len(self._sounds)

    def get(self, sound_id):
        with self._lock:
            for s in self._sounds:
                if s["id"] == sound_id:
                    return self.public(s)
        return None

    def add(self, sound_id, name, file, size):
        rec = {"id": sound_id, "name": name, "file": file, "size": size,
               "createdAt": int(time.time() * 1000)}
        with self._lock:
            if len(self._sounds) >= MAX_SOUNDS:
                return None
            self._sounds.append(rec)
            self._save()
        return self.public(rec)

    def remove(self, sound_id):
        with self._lock:
            idx = next((i for i, s in enumerate(self._sounds) if s["id"] == sound_id), None)
            if idx is None:
                return False
            rec = self._sounds.pop(idx)
            self._save()
        delete_file(os.path.join(SOUNDS_DIR, rec["file"]))
        return True


class Hub:
    """Fan-out of server-sent events to every connected browser tab."""

    def __init__(self):
        self._lock = threading.Lock()
        self._clients = set()

    def add(self):
        q = queue.Queue()
        with self._lock:
            self._clients.add(q)
            n = len(self._clients)
        self.broadcast("online", {"online": n})
        return q

    def remove(self, q):
        with self._lock:
            if q not in self._clients:
                return
            self._clients.discard(q)
            n = len(self._clients)
        self.broadcast("online", {"online": n})

    def count(self):
        with self._lock:
            return len(self._clients)

    def broadcast(self, event, data):
        msg = sse(event, data)
        with self._lock:
            targets = list(self._clients)
        for q in targets:
            q.put(msg)

    def close_all(self):
        with self._lock:
            targets = list(self._clients)
        for q in targets:
            q.put(None)


store = SoundStore()
hub = Hub()
PING = sse("ping", {})


class Handler(BaseHTTPRequestHandler):
    server_version = "gws"
    sys_version = ""
    timeout = 120  # per-socket read/write timeout; SSE waits on a queue, not the socket

    def log_message(self, fmt, *args):
        pass

    # ---- dispatch -------------------------------------------------------

    def do_GET(self):
        self._dispatch(self._get)

    def do_HEAD(self):
        self._dispatch(self._get)

    def do_POST(self):
        self._dispatch(self._post)

    def do_DELETE(self):
        self._dispatch(self._delete)

    def _dispatch(self, fn):
        try:
            fn(urlsplit(self.path).path)
        except (ConnectionError, TimeoutError):
            self.close_connection = True
        except Exception as e:  # never let one bad request take anything else down
            log("error on %s %s: %r" % (self.command, self.path, e))
            self.close_connection = True
            try:
                self._json(500, {"error": "server"})
            except Exception:
                pass

    def _get(self, path):
        if path == "/events" and self.command == "GET":
            return self._events()
        if path == "/api/sounds":
            return self._json(200, {"sounds": store.list()})
        if path == "/healthz":
            return self._send(200, b"ok")
        if path.startswith("/sounds/"):
            return self._sound_file(path[len("/sounds/"):])
        return self._static(path)

    def _post(self, path):
        if path == "/api/upload":
            return self._upload()
        if path == "/api/play":
            return self._play()
        if path == "/api/stop":
            return self._stop()
        self._drain_body()
        return self._json(404, {"error": "not_found"})

    def _delete(self, path):
        m = re.match(r"^/api/sounds/([0-9a-f]{32})$", path)
        if not m:
            return self._json(404, {"error": "not_found"})
        if not store.remove(m.group(1)):
            return self._json(404, {"error": "not_found"})
        hub.broadcast("sounds", {"sounds": store.list()})
        log("deleted sound %s" % m.group(1))
        return self._json(200, {"ok": True})

    # ---- helpers --------------------------------------------------------

    def _send(self, status, body=b"", ctype="text/plain; charset=utf-8", extra=None):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if body and self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self._send(status, body, "application/json; charset=utf-8", {"Cache-Control": "no-store"})

    def _content_length(self):
        try:
            n = int(self.headers.get("Content-Length", ""))
        except ValueError:
            return None
        return n if n >= 0 else None

    def _drain_body(self, limit=MAX_UPLOAD_BYTES):
        """Read and discard the request body so the client sees our response, not a reset."""
        n = self._content_length() or 0
        if n > limit:
            self.close_connection = True
            return
        while n > 0:
            chunk = self.rfile.read(min(65536, n))
            if not chunk:
                return
            n -= len(chunk)

    def _read_json(self):
        n = self._content_length()
        if n is None or n > MAX_JSON_BYTES:
            self.close_connection = True
            return None
        raw = self.rfile.read(n) if n else b""
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
        except (UnicodeDecodeError, ValueError):
            return None
        return data if isinstance(data, dict) else None

    # ---- static files ---------------------------------------------------

    def _static(self, path):
        rel = unquote(path).lstrip("/") or "index.html"
        full = os.path.normpath(os.path.join(PUBLIC_DIR, rel))
        if not full.startswith(PUBLIC_DIR + os.sep):
            return self._send(404, b"not found")
        if not os.path.isfile(full):
            if "." in os.path.basename(rel):
                return self._send(404, b"not found")
            full = os.path.join(PUBLIC_DIR, "index.html")  # any page path shows the home page
        ext = os.path.splitext(full)[1].lower()
        with open(full, "rb") as f:
            body = f.read()
        self._send(200, body, STATIC_TYPES.get(ext, "application/octet-stream"),
                   {"Cache-Control": "no-cache"})

    def _sound_file(self, name):
        if not SOUND_FILE_RE.match(name):
            return self._send(404, b"not found")
        path = os.path.join(SOUNDS_DIR, name)
        try:
            size = os.path.getsize(path)
            f = open(path, "rb")
        except OSError:
            return self._send(404, b"not found")
        with f:
            start, end, status = 0, size - 1, 200
            m = RANGE_RE.match((self.headers.get("Range") or "").strip())
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1))
                    end = min(int(m.group(2)), size - 1) if m.group(2) else size - 1
                else:
                    start, end = max(0, size - int(m.group(2))), size - 1
                if start >= size or start > end:
                    return self._send(416, b"", extra={"Content-Range": "bytes */%d" % size})
                status = 206
            length = end - start + 1
            self.send_response(status)
            self.send_header("Content-Type", AUDIO_TYPES.get(name.rsplit(".", 1)[1], "application/octet-stream"))
            self.send_header("Content-Length", str(length))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            if status == 206:
                self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
            self.end_headers()
            if self.command == "HEAD":
                return
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    # ---- API ------------------------------------------------------------

    def _events(self):
        self.close_connection = True
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store, no-transform")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        q = hub.add()
        try:
            hello = sse("hello", {"sounds": store.list(), "online": hub.count()})
            self.wfile.write(("retry: 2000\n\n" + hello).encode("utf-8"))
            self.wfile.flush()
            while True:
                try:
                    msg = q.get(timeout=PING_SECONDS)
                except queue.Empty:
                    msg = PING
                if msg is None:
                    break
                self.wfile.write(msg.encode("utf-8"))
                self.wfile.flush()
        except OSError:
            pass
        finally:
            hub.remove(q)

    def _upload(self):
        n = self._content_length()
        if n is None:
            self.close_connection = True
            return self._json(411, {"error": "length_required"})
        if n == 0:
            return self._json(400, {"error": "empty"})
        if n > MAX_UPLOAD_BYTES:
            self.close_connection = True
            return self._json(413, {"error": "too_big"})
        name, ext = parse_filename(self.headers.get("X-Filename"), self.headers.get("Content-Type"))
        if not ext:
            self._drain_body()
            return self._json(415, {"error": "bad_type"})
        if store.count() >= MAX_SOUNDS:
            self._drain_body()
            return self._json(409, {"error": "too_many"})

        sound_id = uuid.uuid4().hex
        file = "%s.%s" % (sound_id, ext)
        final = os.path.join(SOUNDS_DIR, file)
        part = final + ".part"
        os.makedirs(SOUNDS_DIR, exist_ok=True)
        try:
            with open(part, "wb") as f:
                remaining = n
                while remaining > 0:
                    chunk = self.rfile.read(min(65536, remaining))
                    if not chunk:
                        raise ConnectionAbortedError("upload cut short")
                    f.write(chunk)
                    remaining -= len(chunk)
            os.replace(part, final)
        except BaseException:
            delete_file(part)
            raise

        sound = store.add(sound_id, name, file, n)
        if sound is None:
            delete_file(final)
            return self._json(409, {"error": "too_many"})
        hub.broadcast("sounds", {"sounds": store.list()})
        log("uploaded %r (%d KB)" % (name, n // 1024))
        return self._json(201, {"sound": sound})

    def _play(self):
        data = self._read_json()
        if data is None:
            return self._json(400, {"error": "bad_request"})
        sound = store.get(str(data.get("id", "")))
        if not sound:
            return self._json(404, {"error": "not_found"})
        boost = clamp_boost(data.get("boost"))
        hub.broadcast("play", {
            "id": sound["id"],
            "name": sound["name"],
            "url": sound["url"],
            "boost": boost,
            "from": str(data.get("from", ""))[:64],
            "ts": int(time.time() * 1000),
        })
        online = hub.count()
        log("play %r x%s -> %d listener(s)" % (sound["name"], boost, online))
        return self._json(200, {"ok": True, "online": online})

    def _stop(self):
        data = self._read_json() or {}
        hub.broadcast("stop", {"from": str(data.get("from", ""))[:64]})
        log("stop all")
        return self._json(200, {"ok": True})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 128
    # On Windows SO_REUSEADDR lets two servers bind the same port; never allow that.
    allow_reuse_address = os.name != "nt"

    def server_bind(self):
        # Skip HTTPServer's reverse-DNS lookup (can stall startup for seconds on Windows).
        socketserver.TCPServer.server_bind(self)
        self.server_name, self.server_port = self.server_address[:2]

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))  # no packet is sent; just picks the outbound interface
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def main():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except Exception:
            pass
    try:
        httpd = Server((HOST, PORT), Handler)
    except OSError as e:
        print("Could not start on port %d: %s" % (PORT, e))
        print("The server is probably already running. Close the other window, or run with another PORT.")
        sys.exit(1)

    print("")
    print("  Server is running")
    print("  Local:    http://localhost:%d" % PORT)
    ip = lan_ip() if HOST in ("0.0.0.0", "") else None
    if ip:
        print("  Network:  http://%s:%d   (same Wi-Fi)" % (ip, PORT))
    print("  Sounds:   %d saved in %s" % (store.count(), SOUNDS_DIR))
    print("  Stop:     Ctrl+C")
    print("", flush=True)

    if os.environ.get("OPEN_BROWSER") == "1":
        t = threading.Timer(0.8, webbrowser.open, ("http://localhost:%d" % PORT,))
        t.daemon = True
        t.start()
    try:
        httpd.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        hub.close_all()
        httpd.server_close()


if __name__ == "__main__":
    main()
