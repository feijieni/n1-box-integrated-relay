#!/usr/bin/env bash
set -euo pipefail

# Non-destructive environment and repository diagnostic helper.
# It is safe to run before installation. It does not install packages, write
# system files, start services, or modify the machine.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

warn_count=0
fail_count=0

info() { printf 'INFO: %s\n' "$*"; }
ok() { printf 'OK: %s\n' "$*"; }
warn() { warn_count=$((warn_count + 1)); printf 'WARN: %s\n' "$*"; }
fail() { fail_count=$((fail_count + 1)); printf 'FAIL: %s\n' "$*"; }

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

check_path() {
  local path="$1"
  local label="$2"
  if [ -e "$path" ]; then
    ok "$label exists: $path"
  else
    fail "$label is missing: $path"
  fi
}

check_optional_path() {
  local path="$1"
  local label="$2"
  if [ -e "$path" ]; then
    ok "$label exists: $path"
  else
    warn "$label is not present in the source checkout: $path"
  fi
}

check_command() {
  local cmd="$1"
  local label="$2"
  if has_cmd "$cmd"; then
    ok "$label found: $(command -v "$cmd")"
  else
    warn "$label not found in PATH: $cmd"
  fi
}

check_port() {
  local port="$1"
  if has_cmd ss; then
    if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${port}$"; then
      warn "port ${port} is already listening"
    else
      ok "port ${port} appears free"
    fi
  elif has_cmd netstat; then
    if netstat -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "(^|:)${port}$"; then
      warn "port ${port} is already listening"
    else
      ok "port ${port} appears free"
    fi
  else
    warn "cannot check port ${port}; neither ss nor netstat is available"
  fi
}

check_systemd_unit() {
  local unit="$1"
  if has_cmd systemctl; then
    if systemctl list-unit-files "$unit" >/dev/null 2>&1; then
      info "systemd knows about ${unit} on this machine"
    else
      info "${unit} is not installed yet; this is normal before installation"
    fi
  fi
}

print_host_hint() {
  printf 'Target style: Raspberry Pi, Linux TV box, ARM board, mini PC, home server, or VPS\n'
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    printf 'Detected OS: %s\n' "${PRETTY_NAME:-unknown}"
  fi
  if command -v uname >/dev/null 2>&1; then
    printf 'Kernel/arch: %s / %s\n' "$(uname -srm 2>/dev/null || true)" "$(uname -m 2>/dev/null || true)"
  fi
}

main() {
  printf 'Linux Device AI Relay doctor\n'
  printf 'Repository: %s\n' "$ROOT_DIR"
  print_host_hint
  printf '\n'

  info "Checking repository layout"
  check_path "CLIProxyAPI/go.mod" "CLIProxyAPI Go module"
  check_path "openclaw-zero-token/package.json" "OpenClaw package.json"
  check_path "config/cliproxyapi.config.yaml.example" "CLIProxyAPI example config"
  check_path "config/openclaw.json.example" "OpenClaw example config"
  check_path "haproxy/openclaw-api-queue.cfg" "HAProxy queue config"
  check_path "systemd/cliproxyapi.service" "CLIProxyAPI service template"
  check_path "systemd/openclaw-zero-token.service" "OpenClaw service template"
  check_path "install_n1.sh" "installer compatibility entry point"

  printf '\n'
  info "Checking source-first release artifacts"
  check_optional_path "CLIProxyAPI/bin" "CLIProxyAPI prebuilt binary directory"
  check_optional_path "openclaw-zero-token/dist" "OpenClaw built output directory"
  info "If these optional paths are missing, use a build-from-source path or a future release bundle."

  printf '\n'
  info "Checking useful host commands"
  check_command bash "bash"
  check_command git "git"
  check_command curl "curl"
  check_command systemctl "systemd/systemctl"
  check_command haproxy "HAProxy"
  check_command node "Node.js"
  check_command pnpm "pnpm"
  check_command go "Go"
  check_command chromium "Chromium"
  check_command google-chrome "Google Chrome"

  printf '\n'
  info "Checking common relay ports"
  check_port 8317
  check_port 3001
  check_port 3002
  check_port 9222
  check_port 6080

  printf '\n'
  info "Checking installed service names, if systemd is available"
  check_systemd_unit cliproxyapi.service
  check_systemd_unit openclaw-zero-token.service
  check_systemd_unit openclaw-api-queue.service
  check_systemd_unit openclaw-chrome-debug.service
  check_systemd_unit openclaw-auth-browser.service

  printf '\n'
  if [ "$fail_count" -gt 0 ]; then
    printf 'Doctor finished with %s failure(s) and %s warning(s).\n' "$fail_count" "$warn_count"
    printf 'Fix missing required repository files before trying to install.\n'
    exit 1
  fi

  if [ "$warn_count" -gt 0 ]; then
    printf 'Doctor finished with %s warning(s). Review them before installing.\n' "$warn_count"
  else
    printf 'Doctor finished without warnings.\n'
  fi
}

main "$@"
