#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULES_FILE="$ROOT_DIR/config/project-rules.json"
failures=0

fail() {
  failures=$((failures + 1))
  printf 'FAIL: %s\n' "$*" >&2
}

pass() {
  printf 'OK: %s\n' "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "required command is missing: $1"
    return 1
  fi
}

json_array() {
  local key="$1"
  python3 - "$RULES_FILE" "$key" <<'PY'
import json
import sys
from pathlib import Path
rules = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
for item in rules.get(sys.argv[2], []):
    print(item)
PY
}

check_required_files() {
  local file
  printf 'Checking required files from project rules...\n'
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    if [ -f "$ROOT_DIR/$file" ]; then
      pass "required file exists: $file"
    else
      fail "required file is missing: $file"
    fi
  done < <(json_array requiredFiles)
}

check_required_directories() {
  local dir
  printf 'Checking required directories from project rules...\n'
  while IFS= read -r dir; do
    [ -n "$dir" ] || continue
    if [ -d "$ROOT_DIR/$dir" ]; then
      pass "required directory exists: $dir"
    else
      fail "required directory is missing: $dir"
    fi
  done < <(json_array requiredDirectories)
}

check_readme_phrases() {
  local phrase
  printf 'Checking README project positioning rules...\n'
  while IFS= read -r phrase; do
    [ -n "$phrase" ] || continue
    if grep -Fq "$phrase" "$ROOT_DIR/README.md"; then
      pass "README contains: $phrase"
    else
      fail "README is missing required phrase: $phrase"
    fi
  done < <(json_array requiredReadmePhrases)
}

check_forbidden_tracked_paths() {
  local pattern
  local matches
  printf 'Checking forbidden tracked path patterns...\n'
  while IFS= read -r pattern; do
    [ -n "$pattern" ] || continue
    matches="$(git -C "$ROOT_DIR" ls-files | grep -E "$pattern" || true)"
    if [ -n "$matches" ]; then
      printf '%s\n' "$matches" >&2
      fail "tracked path matches forbidden pattern: $pattern"
    else
      pass "no tracked path matches forbidden pattern: $pattern"
    fi
  done < <(json_array forbiddenTrackedPathPatterns)
}

check_installer_entrypoints() {
  printf 'Checking installer entrypoint rules...\n'

  if grep -Fq 'exec "$SCRIPT_DIR/install_n1.sh" "$@"' "$ROOT_DIR/install_linux_relay.sh"; then
    pass "generic installer delegates to compatibility installer"
  else
    fail "install_linux_relay.sh should delegate to install_n1.sh"
  fi

  if grep -Fq 'verify_bundle_layout' "$ROOT_DIR/install_n1.sh" && grep -Fq 'install_openclaw_runtime' "$ROOT_DIR/install_n1.sh"; then
    pass "compatibility installer has layout verification and runtime install path"
  else
    fail "install_n1.sh is missing expected installer hardening hooks"
  fi
}

check_localized_docs() {
  printf 'Checking localized documentation sections...\n'

  if grep -Fq '中文专区' "$ROOT_DIR/README.md" && grep -Fq '日本語セクション' "$ROOT_DIR/README.md"; then
    pass "README links localized documentation sections"
  else
    fail "README should link both Chinese and Japanese documentation sections"
  fi

  if grep -Fq '一键部署' "$ROOT_DIR/docs/zh-CN/README.md"; then
    pass "Chinese documentation contains deployment section"
  else
    fail "Chinese documentation should contain deployment section"
  fi

  if grep -Fq 'デプロイ' "$ROOT_DIR/docs/ja/README.md"; then
    pass "Japanese documentation contains deployment section"
  else
    fail "Japanese documentation should contain deployment section"
  fi
}

main() {
  printf 'Project rules check\n\n'

  require_command python3 || true
  require_command git || true

  if [ ! -f "$RULES_FILE" ]; then
    fail "project rules file is missing: config/project-rules.json"
  else
    pass "project rules file exists"
  fi

  if [ "$failures" -eq 0 ]; then
    check_required_files
    check_required_directories
    check_readme_phrases
    check_forbidden_tracked_paths
    check_installer_entrypoints
    check_localized_docs
  fi

  if [ "$failures" -gt 0 ]; then
    printf '\nProject rules check failed with %s issue(s).\n' "$failures" >&2
    exit 1
  fi

  printf '\nProject rules check passed.\n'
}

main "$@"
