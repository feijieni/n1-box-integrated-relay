#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="/opt/linux-relay-control-center"
SERVICE_FILE="/etc/systemd/system/linux-relay-control-center.service"
TOKEN_FILE="$TARGET_DIR/control-token"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

random_hex() {
  local bytes="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
  else
    od -An -N "$bytes" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

if [ "$(id -u)" -ne 0 ]; then
  fail "Please run as root."
fi

command -v python3 >/dev/null 2>&1 || fail "python3 is required"
command -v systemctl >/dev/null 2>&1 || fail "systemctl is required"

mkdir -p "$TARGET_DIR"
install -m 0755 "$ROOT_DIR/control-center/control_center.py" "$TARGET_DIR/control_center.py"
install -m 0644 "$ROOT_DIR/systemd/linux-relay-control-center.service" "$SERVICE_FILE"

if [ ! -f "$TOKEN_FILE" ]; then
  umask 077
  random_hex 24 > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
fi

systemctl daemon-reload
systemctl enable linux-relay-control-center.service
systemctl restart linux-relay-control-center.service

sleep 1
if ! systemctl is-active linux-relay-control-center.service >/dev/null 2>&1; then
  journalctl -u linux-relay-control-center.service -n 80 --no-pager || true
  fail "control center failed to start"
fi

TOKEN="$(cat "$TOKEN_FILE")"
cat <<EOF

Linux relay control center installed.

Local URL:
  http://127.0.0.1:3099/?token=$TOKEN

If you expose it through a reverse proxy, keep authentication enabled and do not publish the token.

Token file:
  $TOKEN_FILE

Service commands:
  sudo systemctl status linux-relay-control-center.service
  sudo journalctl -u linux-relay-control-center.service -n 100 --no-pager
  sudo systemctl restart linux-relay-control-center.service
EOF
