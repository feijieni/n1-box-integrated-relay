#!/usr/bin/env python3
"""Read-only web control center for Linux Device AI Relay.

The control center is intentionally conservative:
- it shows service, port, and endpoint health;
- it does not start, stop, restart, or edit services;
- it does not print API keys, cookies, or ACCESS.txt contents;
- when bound to a non-local address, it requires a token.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import time
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

HOST = os.environ.get("CONTROL_CENTER_HOST", "127.0.0.1")
PORT = int(os.environ.get("CONTROL_CENTER_PORT", "3099"))
TOKEN = os.environ.get("CONTROL_CENTER_TOKEN", "").strip()
TOKEN_FILE = os.environ.get("CONTROL_CENTER_TOKEN_FILE", "").strip()
REQUEST_TIMEOUT_SECONDS = float(os.environ.get("CONTROL_CENTER_TIMEOUT", "2.0"))

SERVICES = [
    {
        "id": "cliproxyapi",
        "name": "CLIProxyAPI",
        "unit": "cliproxyapi.service",
        "port": 8317,
        "url": "http://127.0.0.1:8317/management.html",
        "public_url": "http://<host>:8317/management.html",
    },
    {
        "id": "openclaw-ui",
        "name": "OpenClaw Control UI",
        "unit": "openclaw-zero-token.service",
        "port": 3001,
        "url": "http://127.0.0.1:3001/",
        "public_url": "http://<host>:3001/",
    },
    {
        "id": "openclaw-api-queue",
        "name": "OpenClaw Serialized API Queue",
        "unit": "openclaw-api-queue.service",
        "port": 3002,
        "url": "http://127.0.0.1:3002/v1/models",
        "public_url": "http://<host>:3002/v1",
    },
    {
        "id": "chrome-debug",
        "name": "Chrome Debug Browser",
        "unit": "openclaw-chrome-debug.service",
        "port": 9222,
        "url": "http://127.0.0.1:9222/json/version",
        "public_url": "http://127.0.0.1:9222/json/version",
    },
    {
        "id": "auth-browser",
        "name": "noVNC Auth Browser",
        "unit": "openclaw-auth-browser.service",
        "port": 6080,
        "url": "http://127.0.0.1:6080/vnc.html",
        "public_url": "http://<host>:6080/vnc.html",
    },
]

ACCESS_FILES = [
    "/opt/cli-proxy-api/ACCESS.txt",
    "/opt/openclaw-zero-token/ACCESS.txt",
]

RUNTIME_PATHS = [
    "/opt/cli-proxy-api/config.yaml",
    "/opt/openclaw-zero-token/.openclaw-upstream-state/openclaw.json",
    "/opt/openclaw-zero-token/.openclaw-upstream-state",
]


def load_token() -> str:
    if TOKEN:
        return TOKEN
    if TOKEN_FILE:
        try:
            return Path(TOKEN_FILE).read_text(encoding="utf-8").strip()
        except FileNotFoundError:
            return ""
    return ""


def token_required() -> bool:
    token = load_token()
    if token:
        return True
    return HOST not in {"127.0.0.1", "localhost", "::1"}


def is_authorized(headers: Any, query: dict[str, list[str]]) -> bool:
    token = load_token()
    if not token:
        return not token_required()

    query_token = query.get("token", [""])[0]
    if query_token == token:
        return True

    header_token = headers.get("X-Control-Token", "")
    if header_token == token:
        return True

    auth_header = headers.get("Authorization", "")
    if auth_header == f"Bearer {token}":
        return True

    return False


def run_command(args: list[str], timeout: float = REQUEST_TIMEOUT_SECONDS) -> tuple[int, str, str]:
    try:
        proc = subprocess.run(
            args,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except FileNotFoundError:
        return 127, "", f"command not found: {args[0]}"
    except subprocess.TimeoutExpired:
        return 124, "", f"command timed out: {' '.join(args)}"


def systemd_status(unit: str) -> dict[str, Any]:
    active_code, active_stdout, active_stderr = run_command(["systemctl", "is-active", unit])
    enabled_code, enabled_stdout, enabled_stderr = run_command(["systemctl", "is-enabled", unit])

    return {
        "unit": unit,
        "active": active_stdout or "unknown",
        "activeOk": active_code == 0,
        "enabled": enabled_stdout or "unknown",
        "enabledOk": enabled_code == 0,
        "error": active_stderr or enabled_stderr,
    }


def check_port(host: str, port: int) -> dict[str, Any]:
    started = time.time()
    try:
        with socket.create_connection((host, port), timeout=REQUEST_TIMEOUT_SECONDS):
            return {
                "port": port,
                "open": True,
                "latencyMs": round((time.time() - started) * 1000, 1),
            }
    except OSError as exc:
        return {
            "port": port,
            "open": False,
            "latencyMs": round((time.time() - started) * 1000, 1),
            "error": str(exc),
        }


def check_http(url: str) -> dict[str, Any]:
    started = time.time()
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "linux-relay-control-center/0.1"})
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            code = response.getcode()
            return {
                "url": url,
                "ok": 200 <= code < 400,
                "status": code,
                "latencyMs": round((time.time() - started) * 1000, 1),
            }
    except urllib.error.HTTPError as exc:
        return {
            "url": url,
            "ok": exc.code in {401, 403},
            "status": exc.code,
            "latencyMs": round((time.time() - started) * 1000, 1),
            "note": "401/403 can be healthy for authenticated endpoints",
        }
    except Exception as exc:  # noqa: BLE001 - diagnostic endpoint should not crash on unknown error
        return {
            "url": url,
            "ok": False,
            "status": None,
            "latencyMs": round((time.time() - started) * 1000, 1),
            "error": str(exc),
        }


def file_info(path: str) -> dict[str, Any]:
    file_path = Path(path)
    exists = file_path.exists()
    info: dict[str, Any] = {
        "path": path,
        "exists": exists,
    }
    if exists:
        stat = file_path.stat()
        info["mode"] = oct(stat.st_mode & 0o777)
        info["sizeBytes"] = stat.st_size if file_path.is_file() else None
        info["kind"] = "directory" if file_path.is_dir() else "file"
    return info


def collect_status() -> dict[str, Any]:
    service_results = []
    for service in SERVICES:
        service_results.append(
            {
                **service,
                "systemd": systemd_status(service["unit"]),
                "portCheck": check_port("127.0.0.1", service["port"]),
                "httpCheck": check_http(service["url"]),
            }
        )

    return {
        "project": "Linux Device AI Relay Package",
        "controlCenter": {
            "mode": "read-only",
            "host": HOST,
            "port": PORT,
            "authRequired": token_required(),
        },
        "services": service_results,
        "accessFiles": [file_info(path) for path in ACCESS_FILES],
        "runtimePaths": [file_info(path) for path in RUNTIME_PATHS],
        "generatedAt": int(time.time()),
    }


HTML = r"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Linux Device AI Relay Control Center</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f7fb; color: #18202f; }
    header { padding: 28px 36px; background: #111827; color: white; }
    header h1 { margin: 0 0 8px; font-size: 30px; }
    header p { margin: 0; color: #cbd5e1; }
    main { padding: 28px 36px; max-width: 1180px; margin: 0 auto; }
    .toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 18px; flex-wrap: wrap; }
    input { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px; min-width: 280px; }
    button { padding: 10px 14px; border: 0; border-radius: 10px; background: #2563eb; color: white; cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .card { background: white; border: 1px solid #dbe2ef; border-radius: 18px; padding: 18px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06); }
    .card h2 { margin: 0 0 12px; font-size: 18px; }
    .meta { font-size: 13px; color: #64748b; margin: 4px 0; }
    .badge { display: inline-flex; align-items: center; padding: 4px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .ok { background: #dcfce7; color: #166534; }
    .bad { background: #fee2e2; color: #991b1b; }
    .warn { background: #fef3c7; color: #92400e; }
    table { width: 100%; border-collapse: collapse; margin-top: 18px; background: white; border-radius: 14px; overflow: hidden; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 11px 12px; text-align: left; font-size: 14px; }
    th { background: #f8fafc; }
    code { background: #eef2ff; padding: 2px 5px; border-radius: 6px; }
    .error { color: #b91c1c; white-space: pre-wrap; }
    @media (prefers-color-scheme: dark) {
      body { background: #0b1120; color: #e5e7eb; }
      .card, table { background: #111827; border-color: #243044; }
      th { background: #172033; }
      td, th { border-color: #243044; }
      .meta { color: #94a3b8; }
      code { background: #1f2a44; }
      input { background: #0f172a; color: white; border-color: #334155; }
    }
  </style>
</head>
<body>
<header>
  <h1>Linux Device AI Relay Control Center</h1>
  <p>Read-only service dashboard for CLIProxyAPI, OpenClaw, HAProxy queue, Chrome debug browser, and noVNC login.</p>
</header>
<main>
  <div class="toolbar">
    <input id="token" type="password" placeholder="Control token, if required">
    <button onclick="saveToken()">Save token</button>
    <button onclick="loadStatus()">Refresh</button>
    <span id="summary" class="meta"></span>
  </div>
  <div id="error" class="error"></div>
  <section id="services" class="grid"></section>
  <section>
    <h2>Local files</h2>
    <table>
      <thead><tr><th>Path</th><th>Exists</th><th>Mode</th><th>Kind</th></tr></thead>
      <tbody id="files"></tbody>
    </table>
  </section>
</main>
<script>
  const params = new URLSearchParams(location.search);
  const initialToken = params.get('token') || localStorage.getItem('relayControlToken') || '';
  document.getElementById('token').value = initialToken;

  function saveToken() {
    localStorage.setItem('relayControlToken', document.getElementById('token').value.trim());
    loadStatus();
  }

  function badge(ok, text) {
    return `<span class="badge ${ok ? 'ok' : 'bad'}">${text}</span>`;
  }

  async function loadStatus() {
    const token = document.getElementById('token').value.trim();
    const error = document.getElementById('error');
    error.textContent = '';
    const headers = token ? {'X-Control-Token': token} : {};
    try {
      const res = await fetch('/api/status', {headers});
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      render(data);
    } catch (err) {
      error.textContent = String(err);
    }
  }

  function render(data) {
    const serviceRoot = document.getElementById('services');
    const filesRoot = document.getElementById('files');
    const okCount = data.services.filter(s => s.systemd.activeOk && s.portCheck.open && s.httpCheck.ok).length;
    document.getElementById('summary').textContent = `${okCount}/${data.services.length} services look healthy · auth ${data.controlCenter.authRequired ? 'required' : 'not required'}`;

    serviceRoot.innerHTML = data.services.map(s => `
      <article class="card">
        <h2>${s.name}</h2>
        <div>${badge(s.systemd.activeOk, s.systemd.active || 'unknown')} ${badge(s.portCheck.open, `port ${s.port}`)} ${badge(s.httpCheck.ok, `HTTP ${s.httpCheck.status || 'down'}`)}</div>
        <p class="meta">Unit: <code>${s.unit}</code></p>
        <p class="meta">Endpoint: <code>${s.url}</code></p>
        <p class="meta">Latency: port ${s.portCheck.latencyMs}ms · http ${s.httpCheck.latencyMs}ms</p>
        ${s.systemd.error ? `<p class="error">${s.systemd.error}</p>` : ''}
        ${s.httpCheck.error ? `<p class="error">${s.httpCheck.error}</p>` : ''}
      </article>
    `).join('');

    const files = [...data.accessFiles, ...data.runtimePaths];
    filesRoot.innerHTML = files.map(f => `
      <tr>
        <td><code>${f.path}</code></td>
        <td>${f.exists ? 'yes' : 'no'}</td>
        <td>${f.mode || '-'}</td>
        <td>${f.kind || '-'}</td>
      </tr>
    `).join('');
  }

  loadStatus();
  setInterval(loadStatus, 15000);
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    server_version = "LinuxRelayControlCenter/0.1"

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 - follows stdlib API
        print(f"{self.address_string()} - {format % args}")

    def parsed(self) -> tuple[Any, dict[str, list[str]]]:
        parsed_url = urlparse(self.path)
        return parsed_url, parse_qs(parsed_url.query)

    def send_json(self, data: Any, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, text: str, status: int = 200, content_type: str = "text/plain; charset=utf-8") -> None:
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def require_auth(self, query: dict[str, list[str]]) -> bool:
        if is_authorized(self.headers, query):
            return True
        self.send_json({"error": "unauthorized"}, HTTPStatus.UNAUTHORIZED)
        return False

    def do_GET(self) -> None:  # noqa: N802 - stdlib method name
        parsed_url, query = self.parsed()
        if parsed_url.path == "/":
            self.send_text(HTML, content_type="text/html; charset=utf-8")
            return

        if parsed_url.path == "/api/status":
            if not self.require_auth(query):
                return
            self.send_json(collect_status())
            return

        if parsed_url.path == "/healthz":
            self.send_json({"ok": True, "authRequired": token_required()})
            return

        self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)


def main() -> None:
    if token_required() and not load_token():
        raise SystemExit(
            "CONTROL_CENTER_TOKEN or CONTROL_CENTER_TOKEN_FILE is required when binding outside localhost"
        )

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Linux relay control center listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
