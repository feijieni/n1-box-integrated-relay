# N1 Box Integrated Relay Package

This directory is the publishable integration bundle for your N1 setup.

It is not only a docs repo and it is not only two upstream source trees.
It combines:

- the full `CLIProxyAPI` source tree
- the full `openclaw-zero-token` source tree
- the N1-style deployment layout
- systemd service files
- HAProxy queue config
- an install script that tries to reproduce the same behavior on another box

## What this bundle is for

After someone copies this directory to their own Linux box, they should be able to deploy a setup close to your N1 by running:

```bash
chmod +x install_n1.sh
sudo ./install_n1.sh
```

The target behavior is:

- `CLIProxyAPI` runs as a service
- a dedicated Chrome debug browser stays up for attach-only web models
- `openclaw-zero-token` runs as a service
- both are reachable from other devices
- both start automatically on boot
- `openclaw-zero-token` has a serialized API port
- `openclaw-zero-token` runs one main request at a time by default
- a noVNC browser service can be started on demand for web login

## Content sources

This bundle has two kinds of content:

1. Upstream project source trees

- `CLIProxyAPI/`
- `openclaw-zero-token/`

These folders started from the official GitHub repositories.

2. N1 deployment integration layer

- `config/`
- `systemd/`
- `haproxy/`
- `install_n1.sh`

These files were shaped from the real N1 deployment layout and adjusted so they can be published safely.

The bundle also includes important N1-derived artifacts:

- `CLIProxyAPI/bin/cli-proxy-api-linux-amd64`
- `CLIProxyAPI/bin/cli-proxy-api-linux-arm64`
- `openclaw-zero-token/dist/`
- `openclaw-zero-token/auth-browser.sh`

So the most accurate description is:

`upstream source + N1 deployment integration + one-command installer`

## Directory layout

```text
n1-box/
鈹溾攢鈹€ CLIProxyAPI/
鈹溾攢鈹€ openclaw-zero-token/
鈹溾攢鈹€ config/
鈹溾攢鈹€ haproxy/
鈹溾攢鈹€ systemd/
鈹溾攢鈹€ docs/
鈹溾攢鈹€ install_n1.sh
鈹溾攢鈹€ .gitignore
鈹溾攢鈹€ LICENSE
鈹斺攢鈹€ README.md
```

## Supported deployment styles

This bundle can be used in two common ways:

1. N1 or other LAN box

- access via LAN IP, for example `192.168.1.100`

2. Public server

- access via public IP or domain
- optionally keep LAN access at the same time

The installer supports both by using:

- `N1_LAN_IP`
- `PUBLIC_ACCESS_HOST`
- `PRIMARY_ACCESS_HOST`
- `ACCESS_HOSTS_EXTRA`
- `CONTROL_UI_EXTRA_ORIGINS`

Example:

```bash
sudo N1_LAN_IP=192.168.1.100 \
  PUBLIC_ACCESS_HOST=203.0.113.10 \
  PRIMARY_ACCESS_HOST=203.0.113.10 \
  CONTROL_UI_EXTRA_ORIGINS=https://openclaw.example.com \
  ./install_n1.sh
```

That lets the same backend stay reachable from:

- the LAN IP
- the public IP or domain
- optional HTTPS reverse proxy origins for the OpenClaw control UI

## What the installer does

The installer tries to:

- verify that the published bundle is complete before touching the target machine
- install runtime packages
- auto-detect and install a usable Chrome/Chromium package
- install Node.js 22 and pnpm when needed
- copy both projects into `/opt`
- install OpenClaw runtime dependencies
- install `tsx` so `./onboard.sh webauth` works on a fresh machine
- install service files
- install HAProxy queue config
- generate API keys and tokens if you do not provide them
- write access info files
- enable auto start
- start the services
- health-check the services and stop with logs if one of them does not actually come up

For `CLIProxyAPI`:

- on common Linux servers (`amd64` and `arm64`), it uses bundled prebuilt binaries
- on other Linux architectures, it installs the official Go toolchain version from `go.mod` and then builds from source

## Important outputs

After install, access details are written to:

- `/opt/cli-proxy-api/ACCESS.txt`
- `/opt/openclaw-zero-token/ACCESS.txt`

Typical ports:

- `8317` -> CLIProxyAPI
- `3001` -> OpenClaw control UI
- `3002` -> serialized OpenClaw API
- `9222` -> local Chrome CDP for attach-only web models
- `6080` -> noVNC auth browser

## Publish safely

Do not commit live runtime state:

- `.openclaw-upstream-state/`
- `auth-profiles.json`
- real `ACCESS.txt`
- real `config.yaml`
- cookies
- bearer tokens
- logs with account data

## Notes

- This package is tuned first for Linux on N1 style machines.
- Debian/Ubuntu public servers on `x86_64` no longer depend on the distro `golang-go` package for `CLIProxyAPI`.
- The installer writes `agents.defaults.maxConcurrent=1` and `agents.defaults.subagents.maxConcurrent=1` into `openclaw.json` so the box behaves like a serialized relay by default.
- If you need to change that at install time, set `OPENCLAW_MAIN_MAX_CONCURRENT` and `OPENCLAW_SUBAGENT_MAX_CONCURRENT`.
- If you deploy to a public server, HTTPS reverse proxy is recommended for public UI access.
- Exposing the noVNC browser service directly to the public internet is possible, but not recommended.

## Docs

- [Install on Linux or N1](./docs/install-n1.md)
- [Quick start](./docs/quick-start.md)
- [Public server deployment](./docs/public-server.md)
- [Publish to GitHub](./docs/publish-github.md)
- [Security and secrets](./docs/security-and-secrets.md)


