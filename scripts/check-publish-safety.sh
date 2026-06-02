#!/usr/bin/env bash
set -euo pipefail

# This script checks the public repository boundary.
# It does not prove that a repository is secret-free, but it catches the mistakes
# that are easiest to make when a private relay setup is turned into a public repo.
#
# The upstream source trees contain test fixtures with fake tokens and Windows
# paths. Those are allowed when they are clearly test data. This script focuses
# on private runtime files, machine-specific values from the original setup,
# large generated outputs, and unallowlisted real-looking secrets.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failures=0

say() {
  printf '%s\n' "$*"
}

fail() {
  failures=$((failures + 1))
  printf 'FAIL: %s\n' "$*" >&2
}

pass() {
  printf 'OK: %s\n' "$*"
}

require_git_repo() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    fail "not running inside a Git work tree"
    exit 1
  fi
}

check_forbidden_tracked_paths() {
  say "Checking tracked paths that should stay out of the public repo..."

  local matches
  matches="$(git ls-files | grep -E '(^|/)(ACCESS\.txt|config\.yaml|auth-profiles\.json|openclaw\.podman\.env|\.secrets\.baseline|\.env)$|(^|/)[^/]+\.env$|(^|/)(node_modules|dist|bin|build|logs|cache|tmp|temp)/' || true)"

  if [ -n "$matches" ]; then
    printf '%s\n' "$matches" >&2
    fail "forbidden runtime/build paths are tracked"
  else
    pass "no forbidden runtime/build paths are tracked"
  fi
}

check_large_tracked_files() {
  say "Checking large tracked files..."

  local limit_mb="${MAX_TRACKED_FILE_MB:-25}"
  local limit_bytes=$((limit_mb * 1024 * 1024))
  local found=0

  while IFS= read -r file; do
    [ -f "$file" ] || continue
    local size
    size="$(wc -c < "$file" | tr -d ' ')"
    if [ "$size" -gt "$limit_bytes" ]; then
      found=1
      printf '%s %s bytes\n' "$file" "$size" >&2
    fi
  done < <(git ls-files)

  if [ "$found" -eq 1 ]; then
    fail "one or more tracked files are larger than ${limit_mb}MB"
  else
    pass "no tracked file is larger than ${limit_mb}MB"
  fi
}

check_private_machine_examples() {
  say "Checking for private machine examples from the original setup..."

  local matches
  matches="$(git grep -n -I -E '10\.0\.0\.162|C:\\Users\\13235|C:/Users/13235' -- . \
    ':(exclude)scripts/check-publish-safety.sh' \
    ':(exclude)openclaw-zero-token/diffs/assets/viewer-runtime.js' \
    ':(exclude)openclaw-zero-token/extensions/diffs/assets/viewer-runtime.js' || true)"

  if [ -n "$matches" ]; then
    printf '%s\n' "$matches" >&2
    fail "private machine identifiers were found"
  else
    pass "no original private machine identifiers were found"
  fi
}

check_common_secret_shapes() {
  say "Checking for obvious real-looking secret shapes..."

  local raw_matches
  local matches

  raw_matches="$(git grep -n -I -E 'ghp_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,}|Bearer[ ]+[A-Za-z0-9._~+/=-]{30,}' -- . \
    ':(exclude)scripts/check-publish-safety.sh' \
    ':(exclude)openclaw-zero-token/diffs/assets/viewer-runtime.js' \
    ':(exclude)openclaw-zero-token/extensions/diffs/assets/viewer-runtime.js' || true)"

  # Upstream tests use fake credentials to test redaction logic. Keep the check
  # useful by ignoring explicit allowlist comments and obvious placeholder values.
  matches="$(printf '%s\n' "$raw_matches" \
    | grep -v 'pragma: allowlist secret' \
    | grep -v 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' \
    | grep -v 'ghp_abcdefghijklmnopqrstuvwxyz123456' \
    | grep -v 'sk-abcdefghijklmnopqrstuvwxyz123456' \
    | grep -v 'sk-1234567890abcdef1234567890abcdef' \
    || true)"

  if [ -n "$matches" ]; then
    printf '%s\n' "$matches" >&2
    fail "possible real-looking GitHub/Bearer token shape found"
  else
    pass "no unallowlisted GitHub/Bearer token shape found"
  fi
}

main() {
  require_git_repo
  check_forbidden_tracked_paths
  check_large_tracked_files
  check_private_machine_examples
  check_common_secret_shapes

  if [ "$failures" -gt 0 ]; then
    printf '\nPublish safety check failed with %s issue(s).\n' "$failures" >&2
    exit 1
  fi

  printf '\nPublish safety check passed.\n'
}

main "$@"
