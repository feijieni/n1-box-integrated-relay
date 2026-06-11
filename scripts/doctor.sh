#!/usr/bin/env bash
set -euo pipefail

# Environment and repository diagnostic helper.
# Default mode is non-destructive. Use --fix to apply a small set of safe,
# local repairs such as executable bits, .gitignore safety patterns, and
# restrictive permissions for generated access/config files.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

warn_count=0
fail_count=0
fix_count=0
FIX_MODE=0

usage() {
  cat <<'EOF'
Linux Device AI Relay doctor

Usage:
  bash scripts/doctor.sh
  bash scripts/doctor.sh --fix

Default mode only diagnoses repository layout, host commands, ports, and known
service names.

--fix applies safe repairs only:
  - restore executable bits for installer/check scripts;
  - append missing .gitignore rules for runtime secrets/state;
  - restrict permissions on generated ACCESS/config files when they exist;
  - create expected local runtime directories under /opt when already installed.

It does not install packages, delete user files, kill processes, or start/stop
services.
EOF
}

for arg in "${@:-}"; do
  case "$arg" in
    --fix) FIX_MODE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$arg" >&2; usage; exit 2 ;;
  esac
done

info() { printf 'INFO: %s\n' "$*"; }
ok() { printf 'OK: %s\n' "$*"; }
warn() { warn_count=$((warn_count + 1)); printf 'WARN: %s\n' "$*"; }
fail() { fail_count=$((fail_count + 1)); printf 'FAIL: %s\n' "$*"; }
fixed() { fix_count=$((fix_count + 1)); printf 'FIXED: %s\n' "$*"; }

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

can_write_file() {
  local path="$1"
  [ -e "$path" ] && [ -w "$path" ] && return 0
  [ ! -e "$path" ] && [ -w "$(dirname "$path")" ] && return 0
  return 1
}

append_gitignore_rule() {
  local rule="$1"
  local file="$ROOT_DIR/.gitignore"

  if [ ! -f "$file" ]; then
    if [ "$FIX_MODE" -eq 1 ] && can_write_file "$file"; then
      printf '# Runtime state and secrets\n' > "$file"
      fixed "created .gitignore"
    else
      warn ".gitignore is missing"
      return 0
    fi
  fi

  if grep -Fxq "$rule" "$file"; then
    ok ".gitignore contains: $rule"
  elif [ "$FIX_MODE" -eq 1 ] && [ -w "$file" ]; then
    printf '%s\n' "$rule" >> "$file"
    fixed "added .gitignore rule: $rule"
  else
    warn ".gitignore is missing rule: $rule"
  fi
}

ensure_executable() {
  local path="$1"
  if [ ! -f "$path" ]; then
    return 0
  fi

  if [ -x "$path" ]; then
    ok "executable bit present: $path"
  elif [ "$FIX_MODE" -eq 1 ] && [ -w "$path" ]; then
    chmod 0755 "$path"
    fixed "restored executable bit: $path"
  else
    warn "executable bit missing: $path"
  fi
}

restrict_file_permission() {
  local path="$1"
  local mode="$2"
  if [ ! -e "$path" ]; then
    return 0
  fi

  if [ ! -f "$path" ]; then
    warn "expected file but found something else: $path"
    return 0
  fi

  local current
  current="$(stat -c '%a' "$path" 2>/dev/null || stat -f '%Lp' "$path" 2>/dev/null || echo unknown)"
  if [ "$current" = "$mode" ]; then
    ok "permission $mode already set: $path"
  elif [ "$FIX_MODE" -eq 1 ] && [ -w "$path" ]; then
    chmod "$mode" "$path"
    fixed "set permission $mode: $path"
  else
    warn "permission should be $mode but is $current: $path"
  fi
}

restrict_dir_permission() {
  local path="$1"
  local mode="$2"
  if [ ! -e "$path" ]; then
    return 0
  fi

  if [ ! -d "$path" ]; then
    warn "expected directory but found something else: $path"
    return 0
  fi

  local current
  current="$(stat -c '%a' "$path" 2>/dev/null || stat -f '%Lp' "$path" 2>/dev/null || echo unknown)"
  if [ "$current" = "$mode" ]; then
    ok "permission $mode already set: $path"
  elif [ "$FIX_MODE" -eq 1 ] && [ -w "$path" ]; then
    chmod "$mode" "$path"
    fixed "set permission $mode: $path"
  else
    warn "permission should be $mode but is $current: $path"
  fi
}

ensure_dir_if_parent_exists() {
  local path="$1"
  local mode="$2"
  local parent
  parent="$(dirname "$path")"

  if [ -d "$path" ]; then
    restrict_dir_permission "$path" "$mode"
    return 0
  fi

  if [ ! -d "$parent" ]; then
    return 0
  fi

  if [ "$FIX_MODE" -eq 1 ] && [ -w "$parent" ]; then
    mkdir -p "$path"
    chmod "$mode" "$path"
    fixed "created local runtime directory: $path"
  else
    warn "local runtime directory is missing: $path"
  fi
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

check_repository_safety_rules() {
  printf '\n'
  info "Checking repository safety rules"
  append_gitignore_rule "**/ACCESS.txt"
  append_gitignore_rule "**/config.yaml"
  append_gitignore_rule "**/auth-profiles.json"
  append_gitignore_rule "**/.env"
  append_gitignore_rule "**/.env.*"
  append_gitignore_rule "**/*.env"
  append_gitignore_rule "**/cookies*"
  append_gitignore_rule "**/*cookie*"
  append_gitignore_rule "**/.openclaw-upstream-state/"
  append_gitignore_rule "**/chrome-profile/"
  append_gitignore_rule "**/user-data/"
  append_gitignore_rule "**/User Data/"
}

check_executable_bits() {
  printf '\n'
  info "Checking executable bits"
  ensure_executable "install_linux_relay.sh"
  ensure_executable "install_n1.sh"
  ensure_executable "scripts/doctor.sh"
  ensure_executable "scripts/check-project-rules.sh"
  ensure_executable "scripts/check-repo-health.sh"
  ensure_executable "scripts/check-publish-safety.sh"
}

check_local_runtime_permissions() {
  printf '\n'
  info "Checking installed runtime permissions"
  ensure_dir_if_parent_exists "/opt/openclaw-zero-token/.openclaw-upstream-state" 700
  restrict_file_permission "/opt/cli-proxy-api/ACCESS.txt" 600
  restrict_file_permission "/opt/openclaw-zero-token/ACCESS.txt" 600
  restrict_file_permission "/opt/cli-proxy-api/config.yaml" 600
  restrict_file_permission "/opt/openclaw-zero-token/.openclaw-upstream-state/openclaw.json" 600
}

main() {
  printf 'Linux Device AI Relay doctor\n'
  if [ "$FIX_MODE" -eq 1 ]; then
    printf 'Mode: diagnose + safe auto-repair\n'
  else
    printf 'Mode: diagnose only\n'
  fi
  printf 'Repository: %s\n' "$ROOT_DIR"
  print_host_hint
  printf '\n'

  info "Checking repository layout"
  check_path "CLIProxyAPI/go.mod" "CLIProxyAPI Go module"
  check_path "openclaw-zero-token/package.json" "OpenClaw package.json"
  check_path "config/cliproxyapi.config.yaml.example" "CLIProxyAPI example config"
  check_path "config/openclaw.json.example" "OpenClaw example config"
  check_path "config/project-rules.json" "project rules config"
  check_path "haproxy/openclaw-api-queue.cfg" "HAProxy queue config"
  check_path "systemd/cliproxyapi.service" "CLIProxyAPI service template"
  check_path "systemd/openclaw-zero-token.service" "OpenClaw service template"
  check_path "install_linux_relay.sh" "generic installer entry point"
  check_path "install_n1.sh" "installer compatibility entry point"

  printf '\n'
  info "Checking source-first release artifacts"
  check_optional_path "CLIProxyAPI/bin" "CLIProxyAPI prebuilt binary directory"
  check_optional_path "openclaw-zero-token/dist" "OpenClaw built output directory"
  info "If these optional paths are missing, the installer can use a build-from-source path."

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

  check_repository_safety_rules
  check_executable_bits
  check_local_runtime_permissions

  printf '\n'
  if [ "$fail_count" -gt 0 ]; then
    printf 'Doctor finished with %s failure(s), %s warning(s), and %s fix(es).\n' "$fail_count" "$warn_count" "$fix_count"
    printf 'Fix missing required repository files before trying to install.\n'
    exit 1
  fi

  if [ "$warn_count" -gt 0 ]; then
    printf 'Doctor finished with %s warning(s) and %s fix(es). Review warnings before installing.\n' "$warn_count" "$fix_count"
  else
    printf 'Doctor finished without warnings. Applied %s fix(es).\n' "$fix_count"
  fi
}

main "$@"
