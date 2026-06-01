# Quick Start

Copy this whole directory to the target Linux machine and run:

```bash
chmod +x install_n1.sh
sudo ./install_n1.sh
```

On common public Debian/Ubuntu servers:

- `amd64` and `arm64` use bundled `CLIProxyAPI` binaries
- other architectures automatically fall back to the official Go toolchain plus local build
- the installer will auto-check the bundle, install a compatible browser package, and verify each service after startup

For a box that should support both LAN and public access:

```bash
sudo N1_LAN_IP=192.168.1.100 \
  PUBLIC_ACCESS_HOST=203.0.113.10 \
  PRIMARY_ACCESS_HOST=203.0.113.10 \
  ./install_n1.sh
```

For a public domain with HTTPS reverse proxy in front of OpenClaw UI:

```bash
sudo N1_LAN_IP=192.168.1.100 \
  PUBLIC_ACCESS_HOST=openclaw.example.com \
  PRIMARY_ACCESS_HOST=openclaw.example.com \
  CONTROL_UI_EXTRA_ORIGINS=https://openclaw.example.com \
  ./install_n1.sh
```

After install:

- read `/opt/cli-proxy-api/ACCESS.txt`
- read `/opt/openclaw-zero-token/ACCESS.txt`
- `openclaw-chrome-debug.service` should be running for attach-only web models
- start `openclaw-auth-browser.service` only when you need web login


