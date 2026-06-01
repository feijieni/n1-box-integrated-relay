#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=./browser-detect.sh
. "$SCRIPT_DIR/browser-detect.sh"

CHROME_BIN="$(resolve_openclaw_browser_bin || true)"
PROFILE_DIR="${OPENCLAW_CHROME_PROFILE_DIR:-/root/.config/chrome-openclaw-debug}"

if [ -z "$CHROME_BIN" ]; then
  echo "Unable to find Chrome/Chromium. Install chromium or google-chrome-stable first." >&2
  exit 1
fi

mkdir -p "$PROFILE_DIR"

exec "$CHROME_BIN" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-networking \
  --disable-sync \
  --disable-translate \
  --disable-features=TranslateUI \
  --remote-allow-origins=* \
  --disable-dev-shm-usage \
  --no-sandbox \
  --disable-setuid-sandbox \
  --headless=new \
  --disable-gpu \
  about:blank
