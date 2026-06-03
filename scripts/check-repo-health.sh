#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failures=0

fail() {
  failures=$((failures + 1))
  printf 'FAIL: %s\n' "$*" >&2
}

pass() {
  printf 'OK: %s\n' "$*"
}

check_file() {
  local path="$1"
  if [ -f "$path" ]; then
    pass "file exists: $path"
  else
    fail "missing file: $path"
  fi
}

check_dir() {
  local path="$1"
  if [ -d "$path" ]; then
    pass "directory exists: $path"
  else
    fail "missing directory: $path"
  fi
}

check_markdown_links_basic() {
  printf 'Checking basic local markdown links...\n'

  local found=0
  local md_file
  local link
  local clean
  local base_dir
  local target

  while IFS= read -r md_file; do
    base_dir="$(dirname "$md_file")"

    while IFS= read -r link; do
      [ -n "$link" ] || continue

      case "$link" in
        http://*|https://*|mailto:*|\#*)
          continue
          ;;
      esac

      clean="$link"
      clean="${clean%%#*}"
      clean="${clean#./}"
      [ -n "$clean" ] || continue

      if [ "$base_dir" = "." ]; then
        target="$clean"
      else
        target="$base_dir/$clean"
      fi

      if [ ! -e "$target" ]; then
        found=1
        printf 'Broken local link in %s: %s -> %s\n' "$md_file" "$link" "$target" >&2
      fi
    done < <(grep -hoE '\[[^]]+\]\(([^)]+)\)' "$md_file" 2>/dev/null | sed -E 's/^.*\]\(([^)]+)\).*$/\1/')
  done < <(find README.md docs -name '*.md' -type f -print)

  if [ "$found" -eq 1 ]; then
    fail "one or more local markdown links are broken"
  else
    pass "basic local markdown links look valid"
  fi
}

check_shell_syntax() {
  printf 'Checking shell script syntax...\n'

  local found=0
  while IFS= read -r file; do
    if ! bash -n "$file"; then
      found=1
    fi
  done < <(find . -path './.git' -prune -o -name '*.sh' -type f -print)

  if [ "$found" -eq 1 ]; then
    fail "one or more shell scripts failed bash -n"
  else
    pass "shell scripts pass bash -n"
  fi
}

main() {
  printf 'Repository health check\n\n'

  check_file README.md
  check_file CHANGELOG.md
  check_file MAINTAINING.md
  check_file install_n1.sh
  check_file scripts/check-publish-safety.sh
  check_file scripts/doctor.sh
  check_file scripts/check-repo-health.sh
  check_file docs/design-decisions.md
  check_file docs/why-this-project.md
  check_file docs/release-v0.1.0.md
  check_file docs/support-matrix.md
  check_file docs/maintenance-log.md
  check_file docs/zh-CN/README.md
  check_file docs/ja/README.md
  check_file docs/assets/architecture.svg
  check_file docs/assets/request-flow.svg

  check_dir CLIProxyAPI
  check_dir openclaw-zero-token
  check_dir config
  check_dir haproxy
  check_dir systemd
  check_dir docs

  check_markdown_links_basic
  check_shell_syntax

  if [ "$failures" -gt 0 ]; then
    printf '\nRepository health check failed with %s issue(s).\n' "$failures" >&2
    exit 1
  fi

  printf '\nRepository health check passed.\n'
}

main "$@"
