# N1 Box Integrated Relay Package

N1 Box Integrated Relay Package is an open-source deployment integration project for turning low-cost Linux machines, N1-style TV boxes, and small public servers into reproducible AI relay nodes.

It integrates upstream AI relay/runtime components with a practical deployment layer:

- `CLIProxyAPI` source tree for API proxying and provider compatibility.
- `openclaw-zero-token` source tree for OpenClaw runtime, web-model access, browser-assisted authentication, channels, tools, and control services.
- N1/Linux deployment layout with `config/`, `systemd/`, `haproxy/`, and `install_n1.sh`.
- Serialized request handling through HAProxy so small devices can act as stable relay nodes instead of being overwhelmed by concurrent requests.
- Chrome/Chromium service integration for attach-only web models and browser-based login workflows.
- LAN and public-server deployment examples for self-hosted AI agent infrastructure.

The goal is not to publish another isolated proxy or another isolated runtime tree. The goal is to make a complex AI relay stack reproducible on low-cost hardware.

## Why this project exists

AI agent tooling is becoming more powerful, but many deployment examples assume a desktop workstation, a cloud server, or a manually configured environment. Low-cost always-on machines such as N1 boxes, ARM Linux boxes, and small VPS servers are useful for personal AI relay infrastructure, but setting them up is error-prone:

- multiple upstream projects need to be installed together;
- services need to start automatically after reboot;
- browser-based model login needs a persistent Chrome/Chromium environment;
- API access needs to be reachable from other devices;
- small devices need queueing instead of uncontrolled concurrency;
- runtime secrets, cookies, logs, and generated state must not be mixed with publishable source code.

This repository packages those concerns into a public, reproducible integration layer.

## What this bundle is for

After someone clones this repository to their own Linux box, the intended deployment flow is:

```bash
chmod +x install_n1.sh
sudo ./install_n1.sh
```

The target behavior is:

- `CLIProxyAPI` runs as a service;
- a dedicated Chrome debug browser stays up for attach-only web models;
- `openclaw-zero-token` runs as a service;
- services are reachable from other devices on LAN or from a configured public host;
- services start automatically on boot;
- `openclaw-zero-token` exposes a serialized API port;
- one main OpenClaw request runs at a time by default on small machines;
- a noVNC browser service can be started on demand for web login.

## Project value

This project is useful because it turns a fragile manual setup into a repeatable deployment pattern:

1. **Lower-cost AI relay infrastructure**

   Instead of keeping a full desktop or cloud VM running, users can experiment with always-on N1/Linux boxes as local AI relay nodes.

2. **Practical OpenClaw/agent deployment path**

   It provides a concrete deployment layout for OpenClaw-style runtime services, browser login, API relay, service supervision, and serialized request handling.

3. **Safer publishable layout**

   Runtime state, real access files, cookies, bearer tokens, logs, and private machine-specific configuration are intentionally kept out of the public repository.

4. **Reproducible service operation**

   systemd service files and HAProxy queue configuration make the relay easier to restart, observe, and run after boot.

5. **Bridge between upstream tools and real devices**

   The repository connects upstream projects with a hardware-aware deployment layer for small Linux machines.

## Content sources

This bundle has two kinds of content.

### 1. Upstream source trees

- `CLIProxyAPI/`
- `openclaw-zero-token/`

These folders started from upstream open-source projects and are included here so the integration can be inspected and reproduced as one repository.

### 2. N1/Linux deployment integration layer

- `config/`
- `systemd/`
- `haproxy/`
- `install_n1.sh`
- `docs/`

These files define the N1/Linux deployment behavior: service installation, generated configuration, serialized queueing, browser service startup, access information, and safety notes.

The most accurate description is:

```text
upstream source + Linux/N1 deployment integration + one-command installer + serialized AI relay operation
```

## Source release note

This public GitHub repository is a source-first release. It intentionally does **not** publish live runtime state or private machine state.

Do not expect real local secrets, cookies, generated access files, logs, or private runtime directories to exist in the repository.

For production-ready one-shot offline installation, generated artifacts such as prebuilt binaries or compiled frontend/runtime outputs should be produced by one of these paths:

- build from source during installation;
- publish release artifacts through GitHub Releases;
- provide a separate private deployment bundle for a specific machine.

This keeps the public repository safe for review while still preserving the integration logic.

## Directory layout

```text
n1-box/
├── CLIProxyAPI/
├── openclaw-zero-token/
├── config/
├── haproxy/
├── systemd/
├── docs/
├── install_n1.sh
├── .gitignore
├── LICENSE
└── README.md
```

## Supported deployment styles

This bundle can be used in two common ways.

### 1. N1 or other LAN box

Example LAN access:

```text
192.168.1.100
```

### 2. Public server

The same layout can also be deployed on a public Linux server, optionally with an HTTPS reverse proxy in front of the control UI.

The installer supports both styles through:

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

- the LAN IP;
- the public IP or domain;
- optional HTTPS reverse proxy origins for the OpenClaw control UI.

## What the installer is designed to do

The installer is designed to:

- verify the bundle layout before touching the target machine;
- install runtime packages;
- auto-detect and install a usable Chrome/Chromium package;
- install Node.js 22 and pnpm when needed;
- copy both projects into `/opt`;
- install OpenClaw runtime dependencies;
- install `tsx` so web authentication helpers can run on a fresh machine;
- install systemd service files;
- install HAProxy queue config;
- generate API keys and tokens if they are not provided;
- write local access information files on the target machine;
- enable auto start;
- start services;
- health-check services and stop with logs if one does not come up.

## Important outputs

After installation, access details are written on the target machine to:

- `/opt/cli-proxy-api/ACCESS.txt`
- `/opt/openclaw-zero-token/ACCESS.txt`

Typical ports:

- `8317` -> CLIProxyAPI
- `3001` -> OpenClaw control UI
- `3002` -> serialized OpenClaw API
- `9222` -> local Chrome CDP for attach-only web models
- `6080` -> noVNC auth browser

## Security and publish safety

Do not commit live runtime state:

- `.openclaw-upstream-state/`
- `auth-profiles.json`
- real `ACCESS.txt`
- real `config.yaml`
- cookies
- bearer tokens
- logs with account data
- local browser profiles
- machine-specific runtime directories

The public repository is meant to contain source, examples, service templates, and deployment logic, not private account/session state.

## Current status

This repository is an early public integration release. The main focus is to make the deployment pattern reviewable and reproducible.

Planned improvements:

- make build/release artifact handling clearer;
- improve installer behavior when prebuilt outputs are absent;
- add release packages for easier one-shot deployment;
- add tested install reports for common Linux/N1-style environments;
- add troubleshooting examples for network, browser login, and queue behavior.

## Docs

- [Why this project matters](./docs/why-this-project.md)
- [Install on Linux or N1](./docs/install-n1.md)
- [Quick start](./docs/quick-start.md)
- [Public server deployment](./docs/public-server.md)
- [Publish to GitHub](./docs/publish-github.md)
- [Security and secrets](./docs/security-and-secrets.md)

## Suggested short description

> A reproducible Linux/N1 deployment bundle that turns low-cost boxes into AI relay nodes by integrating CLIProxyAPI, OpenClaw Zero Token, systemd services, HAProxy serialized queues, browser-based model login, and LAN/public access configuration.
