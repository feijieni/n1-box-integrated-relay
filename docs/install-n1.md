# Install on Linux or N1

Recommended target paths:

- `/opt/cli-proxy-api`
- `/opt/openclaw-zero-token`

Persistent services:

- `cliproxyapi.service`
- `openclaw-chrome-debug.service`
- `openclaw-zero-token.service`
- `openclaw-api-queue.service`

On-demand service:

- `openclaw-auth-browser.service`

Default ports:

- `8317` -> CLIProxyAPI
- `3001` -> OpenClaw control UI
- `3002` -> serialized OpenClaw API
- `9222` -> local Chrome CDP for attach-only web models
- `6080` -> noVNC auth browser

Install command:

```bash
chmod +x install_n1.sh
sudo ./install_n1.sh
```

CLIProxyAPI install behavior:

- `amd64` and `arm64` machines use the bundled prebuilt binary
- other Linux architectures fall back to the official Go toolchain version declared in `CLIProxyAPI/go.mod`
- this avoids the common Debian/Ubuntu `golang-go` version mismatch on public `x86_64` servers

Installer safety behavior:

- it checks that the bundle still contains the required source, dist, config, and service files before deploying
- it auto-detects a usable Chrome/Chromium package and falls back to Google Chrome on common `amd64` public servers
- it health-checks `CLIProxyAPI`, the Chrome debug browser, `openclaw-zero-token`, and HAProxy after startup

Useful variables:

- `N1_LAN_IP`
- `PUBLIC_ACCESS_HOST`
- `PRIMARY_ACCESS_HOST`
- `ACCESS_HOSTS_EXTRA`
- `CONTROL_UI_EXTRA_ORIGINS`
- `CLIPROXY_API_KEY`
- `CLIPROXY_MGMT_SECRET_RAW`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_MAIN_MAX_CONCURRENT`
- `OPENCLAW_SUBAGENT_MAX_CONCURRENT`
- `EXPOSE_NOVNC_PUBLIC`

Default relay behavior:

- `3002` is the serialized API entrypoint for third-party clients
- the installer also writes `agents.defaults.maxConcurrent=1`
- and `agents.defaults.subagents.maxConcurrent=1`
- so the box behaves like a one-request-at-a-time relay by default

Example with both LAN and public IP:

```bash
sudo N1_LAN_IP=192.168.1.100 \
  PUBLIC_ACCESS_HOST=203.0.113.10 \
  PRIMARY_ACCESS_HOST=203.0.113.10 \
  ./install_n1.sh
```

Example with HTTPS reverse proxy origin for OpenClaw UI:

```bash
sudo N1_LAN_IP=192.168.1.100 \
  PUBLIC_ACCESS_HOST=openclaw.example.com \
  PRIMARY_ACCESS_HOST=openclaw.example.com \
  CONTROL_UI_EXTRA_ORIGINS=https://openclaw.example.com \
  ./install_n1.sh
```


