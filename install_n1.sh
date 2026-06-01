#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIPROXY_SRC="$ROOT_DIR/CLIProxyAPI"
OPENCLAW_SRC="$ROOT_DIR/openclaw-zero-token"

detect_primary_ip() {
  ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}'
}

random_hex() {
  local bytes="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
  else
    od -An -N "$bytes" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

add_unique_item() {
  local value="$1"
  shift
  local item
  for item in "$@"; do
    if [ "$item" = "$value" ]; then
      return 1
    fi
  done
  return 0
}

warn() {
  echo "WARNING: $*" >&2
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

retry_command() {
  local attempts="$1"
  local delay="$2"
  shift 2

  local try=1
  local exit_code=0
  while true; do
    if "$@"; then
      return 0
    fi
    exit_code=$?
    if [ "$try" -ge "$attempts" ]; then
      return "$exit_code"
    fi
    warn "Command failed (attempt $try/$attempts): $*"
    sleep "$delay"
    try=$((try + 1))
  done
}

require_path() {
  local path="$1"
  [ -e "$path" ] || fail "Required bundle path is missing: $path"
}

verify_bundle_layout() {
  require_path "$CLIPROXY_SRC/go.mod"
  require_path "$CLIPROXY_SRC/bin/cli-proxy-api-linux-amd64"
  require_path "$CLIPROXY_SRC/bin/cli-proxy-api-linux-arm64"
  require_path "$OPENCLAW_SRC/package.json"
  require_path "$OPENCLAW_SRC/pnpm-lock.yaml"
  require_path "$OPENCLAW_SRC/openclaw.mjs"
  require_path "$OPENCLAW_SRC/dist"
  require_path "$OPENCLAW_SRC/server.sh"
  require_path "$OPENCLAW_SRC/auth-browser.sh"
  require_path "$OPENCLAW_SRC/chrome-debug-daemon.sh"
  require_path "$ROOT_DIR/config/cliproxyapi.config.yaml.example"
  require_path "$ROOT_DIR/config/openclaw.json.example"
  require_path "$ROOT_DIR/haproxy/openclaw-api-queue.cfg"
  require_path "$ROOT_DIR/systemd/cliproxyapi.service"
  require_path "$ROOT_DIR/systemd/openclaw-chrome-debug.service"
  require_path "$ROOT_DIR/systemd/openclaw-zero-token.service"
  require_path "$ROOT_DIR/systemd/openclaw-api-queue.service"
  require_path "$ROOT_DIR/systemd/openclaw-auth-browser.service"
}

normalize_linux_arch() {
  local raw_arch="${1:-}"
  case "$raw_arch" in
    x86_64|amd64)
      echo "amd64"
      ;;
    aarch64|arm64)
      echo "arm64"
      ;;
    i386|i686)
      echo "386"
      ;;
    armv6l|armv7l|armhf)
      echo "armv6l"
      ;;
    ppc64le)
      echo "ppc64le"
      ;;
    s390x)
      echo "s390x"
      ;;
    riscv64)
      echo "riscv64"
      ;;
    *)
      echo "$raw_arch"
      ;;
  esac
}

resolve_cliproxy_go_version() {
  awk '/^go / {print $2; exit}' "$1/go.mod"
}

resolve_openclaw_pnpm_version() {
  python3 - "$1" <<'PY'
import json
import pathlib
import sys

package_json = pathlib.Path(sys.argv[1])
data = json.loads(package_json.read_text(encoding="utf-8"))
value = data.get("packageManager", "")
if isinstance(value, str) and value.startswith("pnpm@"):
    print(value.split("@", 1)[1])
PY
}

resolve_openclaw_tsx_version() {
  python3 - "$1" <<'PY'
import json
import pathlib
import sys

package_json = pathlib.Path(sys.argv[1])
data = json.loads(package_json.read_text(encoding="utf-8"))
version = data.get("dependencies", {}).get("tsx") or data.get("devDependencies", {}).get("tsx") or ""
print(version.lstrip("^~"))
PY
}

detect_browser_binary() {
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
    if [ -n "$candidate" ] && command_exists "$candidate"; then
      command -v "$candidate"
      return 0
    fi
  done
  return 1
}

install_google_chrome() {
  local arch
  local key_file="/var/tmp/openclaw-compile-cache/google-chrome-signing-key.pub"
  arch="$(dpkg --print-architecture)"
  if [ "$arch" != "amd64" ]; then
    return 1
  fi

  install -d -m 0755 /etc/apt/keyrings
  retry_command 3 5 curl -fsSL https://dl.google.com/linux/linux_signing_key.pub -o "$key_file"
  gpg --dearmor < "$key_file" > /etc/apt/keyrings/google-chrome.gpg
  chmod 0644 /etc/apt/keyrings/google-chrome.gpg
  cat > /etc/apt/sources.list.d/google-chrome.list <<EOF
deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main
EOF
  retry_command 3 5 apt-get update
  retry_command 3 5 apt-get install -y google-chrome-stable
}

ensure_browser_installed() {
  local package_name

  if detect_browser_binary >/dev/null 2>&1; then
    echo "Browser already present: $(detect_browser_binary)"
    return 0
  fi

  for package_name in chromium chromium-browser; do
    if apt-cache show "$package_name" >/dev/null 2>&1; then
      if retry_command 2 5 apt-get install -y "$package_name"; then
        break
      fi
    fi
  done

  if ! detect_browser_binary >/dev/null 2>&1; then
    warn "Chromium package was not available, trying Google Chrome..."
    install_google_chrome || true
  fi

  detect_browser_binary >/dev/null 2>&1 \
    || fail "Unable to install Chrome/Chromium automatically. Install chromium or google-chrome-stable and rerun."
}

install_go_toolchain() {
  local requested_version="$1"
  local raw_arch="$2"
  local go_arch
  local current_version
  local archive_path

  go_arch="$(normalize_linux_arch "$raw_arch")"
  if [ "$go_arch" = "armv6l" ]; then
    go_arch="armv6l"
  fi

  case "$go_arch" in
    amd64|arm64|386|armv6l|ppc64le|s390x|riscv64)
      ;;
    *)
      echo "No official Go binary mapping for architecture: $raw_arch"
      return 1
      ;;
  esac

  if command -v go >/dev/null 2>&1; then
    current_version="$(go version | awk '{print $3}' | sed 's/^go//')"
    if [ "$current_version" = "$requested_version" ]; then
      echo "Go $requested_version already present, skipping toolchain install..."
      return 0
    fi
  fi

  archive_path="/var/tmp/openclaw-compile-cache/go${requested_version}.linux-${go_arch}.tar.gz"
  echo "Installing Go $requested_version for $raw_arch from official distribution..."
  curl -fsSL "https://go.dev/dl/go${requested_version}.linux-${go_arch}.tar.gz" -o "$archive_path"
  rm -rf /usr/local/go
  tar -C /usr/local -xzf "$archive_path"
  ln -sf /usr/local/go/bin/go /usr/local/bin/go
  ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt
}

show_service_logs() {
  local service="$1"
  if command_exists journalctl; then
    journalctl -u "$service" -n 80 --no-pager || true
  fi
}

wait_for_service_active() {
  local service="$1"
  local timeout="$2"
  local elapsed=0
  local status=""

  while [ "$elapsed" -lt "$timeout" ]; do
    status="$(systemctl is-active "$service" 2>/dev/null || true)"
    if [ "$status" = "active" ]; then
      return 0
    fi
    if [ "$status" = "failed" ]; then
      return 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  return 1
}

wait_for_http_endpoint() {
  local url="$1"
  local timeout="$2"
  local header="${3:-}"
  local elapsed=0
  local code=""

  while [ "$elapsed" -lt "$timeout" ]; do
    if [ -n "$header" ]; then
      code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 -H "$header" "$url" || true)"
    else
      code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$url" || true)"
    fi
    case "$code" in
      2*|3*|401|403)
        return 0
        ;;
    esac
    sleep 1
    elapsed=$((elapsed + 1))
  done

  return 1
}

restart_and_verify_service() {
  local service="$1"
  local timeout="$2"
  local url="${3:-}"
  local header="${4:-}"
  local attempt

  for attempt in 1 2; do
    if [ "$attempt" -gt 1 ]; then
      warn "Retrying service startup: $service"
      systemctl reset-failed "$service" || true
      sleep 2
    fi

    systemctl restart "$service"
    if ! wait_for_service_active "$service" "$timeout"; then
      show_service_logs "$service"
      continue
    fi

    if [ -n "$url" ] && ! wait_for_http_endpoint "$url" "$timeout" "$header"; then
      warn "Service $service became active, but endpoint did not answer yet: $url"
      show_service_logs "$service"
      continue
    fi

    return 0
  done

  fail "Service failed health checks: $service"
}

need_node_install=1
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
  if [ "${NODE_MAJOR:-0}" -ge 22 ]; then
    need_node_install=0
  fi
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root."
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This script currently targets Debian/Ubuntu/Armbian style systems."
  exit 1
fi

if ! command_exists systemctl; then
  fail "systemctl is required. Use a Debian/Ubuntu host with systemd."
fi

if ! systemctl list-unit-files >/dev/null 2>&1; then
  fail "systemd is not responding. This installer expects a real systemd host, not a container shell."
fi

verify_bundle_layout
export DEBIAN_FRONTEND=noninteractive
mkdir -p /var/tmp/openclaw-compile-cache

N1_LAN_IP="${N1_LAN_IP:-$(detect_primary_ip || true)}"
N1_LAN_IP="${N1_LAN_IP:-127.0.0.1}"
PUBLIC_ACCESS_HOST="${PUBLIC_ACCESS_HOST:-}"
PRIMARY_ACCESS_HOST="${PRIMARY_ACCESS_HOST:-${PUBLIC_ACCESS_HOST:-$N1_LAN_IP}}"
ACCESS_HOSTS_EXTRA="${ACCESS_HOSTS_EXTRA:-}"
CONTROL_UI_EXTRA_ORIGINS="${CONTROL_UI_EXTRA_ORIGINS:-}"
CLIPROXY_API_KEY="${CLIPROXY_API_KEY:-CPA-$(random_hex 16)}"
CLIPROXY_MGMT_SECRET_RAW="${CLIPROXY_MGMT_SECRET_RAW:-CPA-MGMT-$(random_hex 12)}"
OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-$(random_hex 32)}"
EXPOSE_NOVNC_PUBLIC="${EXPOSE_NOVNC_PUBLIC:-0}"
OPENCLAW_MAIN_MAX_CONCURRENT="${OPENCLAW_MAIN_MAX_CONCURRENT:-1}"
OPENCLAW_SUBAGENT_MAX_CONCURRENT="${OPENCLAW_SUBAGENT_MAX_CONCURRENT:-1}"

ACCESS_HOSTS=()
for host in "$N1_LAN_IP" "$PUBLIC_ACCESS_HOST"; do
  if [ -n "$host" ] && add_unique_item "$host" "${ACCESS_HOSTS[@]:-}"; then
    ACCESS_HOSTS+=("$host")
  fi
done
IFS=',' read -r -a EXTRA_HOST_ITEMS <<< "$ACCESS_HOSTS_EXTRA"
for host in "${EXTRA_HOST_ITEMS[@]}"; do
  host="$(printf '%s' "$host" | xargs)"
  if [ -n "$host" ] && add_unique_item "$host" "${ACCESS_HOSTS[@]:-}"; then
    ACCESS_HOSTS+=("$host")
  fi
done

echo "[1/12] Installing base packages..."
retry_command 3 5 apt-get update
retry_command 3 5 apt-get install -y curl jq haproxy xvfb x11vnc websockify novnc lsof ca-certificates gnupg apache2-utils build-essential python3 iproute2 procps xz-utils tar
ensure_browser_installed

if [ "$need_node_install" -eq 1 ]; then
  echo "[2/12] Installing Node.js 22..."
  install -d -m 0755 /etc/apt/keyrings
  retry_command 3 5 curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /var/tmp/openclaw-compile-cache/nodesource.gpg.key
  gpg --dearmor < /var/tmp/openclaw-compile-cache/nodesource.gpg.key > /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  retry_command 3 5 apt-get update
  retry_command 3 5 apt-get install -y nodejs
else
  echo "[2/12] Node.js >= 22 already present, skipping install..."
fi

echo "[3/12] Enabling pnpm..."
OPENCLAW_PNPM_VERSION="$(resolve_openclaw_pnpm_version "$OPENCLAW_SRC/package.json")"
OPENCLAW_PNPM_VERSION="${OPENCLAW_PNPM_VERSION:-10.23.0}"
corepack enable
retry_command 3 5 corepack prepare "pnpm@$OPENCLAW_PNPM_VERSION" --activate

CLIPROXY_MGMT_SECRET_HASH="$(htpasswd -bnBC 10 "" "$CLIPROXY_MGMT_SECRET_RAW" | tr -d ':\n')"

echo "[4/12] Preparing target directories..."
mkdir -p /opt/cli-proxy-api
mkdir -p /opt/openclaw-zero-token
mkdir -p /var/tmp/openclaw-compile-cache

echo "[5/12] Syncing project files..."
cp -a "$CLIPROXY_SRC"/. /opt/cli-proxy-api/
cp -a "$OPENCLAW_SRC"/. /opt/openclaw-zero-token/

echo "[6/12] Fixing executable permissions..."
if [ -d /opt/openclaw-zero-token ]; then
  find /opt/openclaw-zero-token -maxdepth 1 -type f \( -name '*.sh' -o -name '*.mjs' \) -exec chmod 0755 {} +
fi

echo "[7/12] Installing CLIProxyAPI binary..."
CLI_ARCH_RAW="$(uname -m)"
CLI_ARCH="$(normalize_linux_arch "$CLI_ARCH_RAW")"
BUNDLED_CLIPROXY_BINARY="/opt/cli-proxy-api/bin/cli-proxy-api-linux-$CLI_ARCH"
if [ -f "$BUNDLED_CLIPROXY_BINARY" ]; then
  echo "Using bundled CLIProxyAPI binary for $CLI_ARCH_RAW ($CLI_ARCH)..."
  install -m 0755 "$BUNDLED_CLIPROXY_BINARY" /usr/local/bin/cli-proxy-api
else
  CLIPROXY_GO_VERSION="$(resolve_cliproxy_go_version /opt/cli-proxy-api)"
  if [ -z "${CLIPROXY_GO_VERSION:-}" ]; then
    echo "Unable to determine CLIProxyAPI Go version from go.mod"
    exit 1
  fi
  echo "No bundled CLIProxyAPI binary for $CLI_ARCH_RAW ($CLI_ARCH), building from source with Go $CLIPROXY_GO_VERSION..."
  install_go_toolchain "$CLIPROXY_GO_VERSION" "$CLI_ARCH_RAW"
  cd /opt/cli-proxy-api
  export GOTOOLCHAIN=local
  /usr/local/go/bin/go build -o /usr/local/bin/cli-proxy-api ./cmd/server
  chmod 0755 /usr/local/bin/cli-proxy-api
fi

echo "[8/12] Installing OpenClaw runtime dependencies..."
cd /opt/openclaw-zero-token
if ! retry_command 2 5 pnpm install --prod --frozen-lockfile; then
  echo "Frozen install failed, retrying without --frozen-lockfile..."
  retry_command 2 5 pnpm install --prod
fi
if [ ! -d /opt/openclaw-zero-token/node_modules/tsx ]; then
  TSX_VERSION="$(resolve_openclaw_tsx_version /opt/openclaw-zero-token/package.json)"
  TSX_VERSION="${TSX_VERSION:-4.21.0}"
  echo "Installing tsx for the webauth runner..."
  retry_command 2 5 pnpm add -w --prod "tsx@$TSX_VERSION"
fi

echo "[9/12] Installing templates..."
mkdir -p /etc/systemd/system
cp "$ROOT_DIR/systemd/cliproxyapi.service" /etc/systemd/system/
cp "$ROOT_DIR/systemd/openclaw-chrome-debug.service" /etc/systemd/system/
cp "$ROOT_DIR/systemd/openclaw-zero-token.service" /etc/systemd/system/
cp "$ROOT_DIR/systemd/openclaw-api-queue.service" /etc/systemd/system/
cp "$ROOT_DIR/systemd/openclaw-auth-browser.service" /etc/systemd/system/
cp "$ROOT_DIR/haproxy/openclaw-api-queue.cfg" /etc/openclaw-api-queue.cfg

echo "[10/12] Preparing config files..."
if [ ! -f /opt/cli-proxy-api/config.yaml ]; then
  cp "$ROOT_DIR/config/cliproxyapi.config.yaml.example" /opt/cli-proxy-api/config.yaml
fi

python3 - "$CLIPROXY_API_KEY" "$CLIPROXY_MGMT_SECRET_HASH" <<'PY'
import pathlib
import sys

config_path = pathlib.Path("/opt/cli-proxy-api/config.yaml")
text = config_path.read_text(encoding="utf-8")
text = text.replace("CHANGE_ME_API_KEY", sys.argv[1])
text = text.replace("CHANGE_ME_BCRYPT_HASH", sys.argv[2])
config_path.write_text(text, encoding="utf-8")
PY

mkdir -p /opt/openclaw-zero-token/.openclaw-upstream-state
if [ ! -f /opt/openclaw-zero-token/.openclaw-upstream-state/openclaw.json ]; then
  cp "$ROOT_DIR/config/openclaw.json.example" /opt/openclaw-zero-token/.openclaw-upstream-state/openclaw.json
fi

ALLOWED_ORIGINS_JSON='["http://localhost:3001","http://127.0.0.1:3001"]'
for host in "${ACCESS_HOSTS[@]}"; do
  origin="http://$host:3001"
  ALLOWED_ORIGINS_JSON="$(jq -cn --argjson arr "$ALLOWED_ORIGINS_JSON" --arg origin "$origin" '$arr + [$origin] | unique')"
done

IFS=',' read -r -a EXTRA_ORIGIN_ITEMS <<< "$CONTROL_UI_EXTRA_ORIGINS"
for origin in "${EXTRA_ORIGIN_ITEMS[@]}"; do
  origin="$(printf '%s' "$origin" | xargs)"
  if [ -n "$origin" ]; then
    ALLOWED_ORIGINS_JSON="$(jq -cn --argjson arr "$ALLOWED_ORIGINS_JSON" --arg origin "$origin" '$arr + [$origin] | unique')"
  fi
done

python3 - "$OPENCLAW_GATEWAY_TOKEN" "$ALLOWED_ORIGINS_JSON" "$OPENCLAW_MAIN_MAX_CONCURRENT" "$OPENCLAW_SUBAGENT_MAX_CONCURRENT" <<'PY'
import json
import pathlib
import sys

config_path = pathlib.Path("/opt/openclaw-zero-token/.openclaw-upstream-state/openclaw.json")
data = json.loads(config_path.read_text(encoding="utf-8"))
data.setdefault("gateway", {}).setdefault("auth", {})["token"] = sys.argv[1]
data.setdefault("gateway", {}).setdefault("controlUi", {})["allowedOrigins"] = json.loads(sys.argv[2])
agents_defaults = data.setdefault("agents", {}).setdefault("defaults", {})
agents_defaults["maxConcurrent"] = max(1, int(sys.argv[3]))
agents_defaults.setdefault("subagents", {})["maxConcurrent"] = max(1, int(sys.argv[4]))
config_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY

python3 - "$PRIMARY_ACCESS_HOST" <<'PY'
import pathlib
import sys

path = pathlib.Path("/opt/openclaw-zero-token/auth-browser.sh")
if path.exists():
    text = path.read_text(encoding="utf-8")
    text = text.replace("PRIMARY_ACCESS_HOST", sys.argv[1])
    text = text.replace("N1_LAN_IP", sys.argv[1])
    path.write_text(text, encoding="utf-8")
PY

cat > /opt/cli-proxy-api/ACCESS.txt <<EOF
CLIProxyAPI Management URL: http://$PRIMARY_ACCESS_HOST:8317/management.html
CLIProxyAPI API URL: http://$PRIMARY_ACCESS_HOST:8317
CLIProxyAPI API Key: $CLIPROXY_API_KEY
CLIProxyAPI Management Secret (raw): $CLIPROXY_MGMT_SECRET_RAW
Also allowed from host list: ${ACCESS_HOSTS[*]}
EOF
chmod 600 /opt/cli-proxy-api/ACCESS.txt

cat > /opt/openclaw-zero-token/ACCESS.txt <<EOF
OpenClaw UI: http://$PRIMARY_ACCESS_HOST:3001/#token=$OPENCLAW_GATEWAY_TOKEN
OpenClaw API Base URL: http://$PRIMARY_ACCESS_HOST:3002/v1
OpenClaw API Key: $OPENCLAW_GATEWAY_TOKEN
OpenClaw noVNC URL (start service first): http://$PRIMARY_ACCESS_HOST:6080/vnc.html
OpenClaw allowed host list: ${ACCESS_HOSTS[*]}
EOF
chmod 600 /opt/openclaw-zero-token/ACCESS.txt

echo "[11/12] Opening firewall ports if UFW is active..."
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 8317/tcp >/dev/null || true
  ufw allow 3001/tcp >/dev/null || true
  ufw allow 3002/tcp >/dev/null || true
  if [ "$EXPOSE_NOVNC_PUBLIC" = "1" ]; then
    ufw allow 6080/tcp >/dev/null || true
  fi
fi

echo "[12/12] Enabling and starting services..."
systemctl daemon-reload
systemctl enable cliproxyapi.service
systemctl enable openclaw-chrome-debug.service
systemctl enable openclaw-zero-token.service
systemctl enable openclaw-api-queue.service
restart_and_verify_service cliproxyapi.service 45 "http://127.0.0.1:8317/management.html"
restart_and_verify_service openclaw-chrome-debug.service 45 "http://127.0.0.1:9222/json/version"
restart_and_verify_service openclaw-zero-token.service 90 "http://127.0.0.1:3001/"
restart_and_verify_service openclaw-api-queue.service 45 "http://127.0.0.1:3002/v1/models" "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN"

echo
echo "Deployment finished."
echo
echo "Primary host: $PRIMARY_ACCESS_HOST"
echo "LAN IP: $N1_LAN_IP"
if [ -n "$PUBLIC_ACCESS_HOST" ]; then
  echo "Public host: $PUBLIC_ACCESS_HOST"
fi
echo "CLIProxyAPI management: http://$PRIMARY_ACCESS_HOST:8317/management.html"
echo "CLIProxyAPI API URL: http://$PRIMARY_ACCESS_HOST:8317"
echo "CLIProxyAPI API key: $CLIPROXY_API_KEY"
echo "CLIProxyAPI management secret: $CLIPROXY_MGMT_SECRET_RAW"
echo
echo "OpenClaw UI: http://$PRIMARY_ACCESS_HOST:3001/#token=$OPENCLAW_GATEWAY_TOKEN"
echo "OpenClaw API Base URL: http://$PRIMARY_ACCESS_HOST:3002/v1"
echo "OpenClaw API key: $OPENCLAW_GATEWAY_TOKEN"
echo "OpenClaw noVNC: http://$PRIMARY_ACCESS_HOST:6080/vnc.html"
echo
echo "When you need web login, start: systemctl start openclaw-auth-browser.service"
