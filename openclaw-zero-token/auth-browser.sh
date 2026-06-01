#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./browser-detect.sh
. "$SCRIPT_DIR/browser-detect.sh"

WORKDIR=/opt/openclaw-zero-token
LOGDIR="$WORKDIR/logs/auth-browser"
PROFILE_DIR="$WORKDIR/.chrome-openclaw"
DISPLAY_NUM=:99
XVFB_SCREEN=1366x768x24
VNC_PORT=5900
NOVNC_PORT=6080
CDP_PORT=9222
NOVNC_DIR="${OPENCLAW_NOVNC_DIR:-$(resolve_openclaw_novnc_dir || true)}"
NOVNC_BIND_HOST="${OPENCLAW_NOVNC_BIND_HOST:-0.0.0.0}"
CHROMIUM_BIN="${OPENCLAW_CHROME_BIN:-$(resolve_openclaw_browser_bin || true)}"

if [ -z "$NOVNC_DIR" ]; then
  echo "Unable to find the noVNC web root. Install the novnc package first." >&2
  exit 1
fi

if [ -z "$CHROMIUM_BIN" ]; then
  echo "Unable to find Chrome/Chromium. Install chromium or google-chrome-stable first." >&2
  exit 1
fi

mkdir -p "$LOGDIR" "$PROFILE_DIR"
rm -f /tmp/.X99-lock

cleanup() {
  for pid in ${WEBSOCKIFY_PID:-} ${X11VNC_PID:-} ${CHROMIUM_PID:-} ${XVFB_PID:-}; do
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  sleep 1
  pkill -f "Xvfb $DISPLAY_NUM" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

pkill -f "Xvfb $DISPLAY_NUM" 2>/dev/null || true
pkill -f "x11vnc.*rfbport $VNC_PORT" 2>/dev/null || true
pkill -f "websockify.*:$NOVNC_PORT" 2>/dev/null || true
pkill -f "chromium.*remote-debugging-port=$CDP_PORT" 2>/dev/null || true
sleep 1

Xvfb "$DISPLAY_NUM" -screen 0 "$XVFB_SCREEN" -nolisten tcp > "$LOGDIR/xvfb.log" 2>&1 &
XVFB_PID=$!
sleep 2

export DISPLAY="$DISPLAY_NUM"
"$CHROMIUM_BIN" \
  --no-sandbox \
  --disable-dev-shm-usage \
  --user-data-dir="$PROFILE_DIR" \
  --remote-debugging-port="$CDP_PORT" \
  --no-first-run \
  --no-default-browser-check \
  --window-size=1366,768 \
  about:blank > "$LOGDIR/chromium.log" 2>&1 &
CHROMIUM_PID=$!
sleep 4

x11vnc -display "$DISPLAY_NUM" -forever -shared -nopw -localhost -rfbport "$VNC_PORT" > "$LOGDIR/x11vnc.log" 2>&1 &
X11VNC_PID=$!
sleep 2

websockify --web="$NOVNC_DIR" "$NOVNC_BIND_HOST:$NOVNC_PORT" "127.0.0.1:$VNC_PORT" > "$LOGDIR/websockify.log" 2>&1 &
WEBSOCKIFY_PID=$!

echo "Auth browser ready"
echo "noVNC: http://PRIMARY_ACCESS_HOST:$NOVNC_PORT/vnc.html"
echo "CDP: http://127.0.0.1:$CDP_PORT/json/version"
echo "Profile: $PROFILE_DIR"

wait -n "$XVFB_PID" "$CHROMIUM_PID" "$X11VNC_PID" "$WEBSOCKIFY_PID"
