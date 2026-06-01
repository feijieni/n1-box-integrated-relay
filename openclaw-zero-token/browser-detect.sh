#!/bin/bash

resolve_openclaw_browser_bin() {
  local candidate
  for candidate in \
    "${OPENCLAW_CHROME_BIN:-}" \
    /usr/bin/chromium \
    /usr/bin/chromium-browser \
    /usr/bin/google-chrome \
    /usr/bin/google-chrome-stable \
    /opt/google/chrome/google-chrome \
    /snap/bin/chromium \
    chromium \
    chromium-browser \
    google-chrome \
    google-chrome-stable; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
    if [ -n "$candidate" ] && command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done
  return 1
}

resolve_openclaw_novnc_dir() {
  local candidate
  for candidate in \
    "${OPENCLAW_NOVNC_DIR:-}" \
    /usr/share/novnc \
    /usr/share/noVNC; do
    if [ -n "$candidate" ] && [ -d "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}
