# Linux Device AI Relay Package

This repository started from a practical problem: I wanted a small Linux device or server to behave like an always-on AI relay node, not like a fragile folder of scripts that only works on the machine where it was first assembled.

The project brings together two upstream codebases, `CLIProxyAPI` and `openclaw-zero-token`, and adds the deployment layer that is usually missing when people try to run this kind of stack on Raspberry Pi boards, Linux-capable TV boxes, ARM boxes, mini PCs, home servers, or small VPS instances running Ubuntu, Debian, Armbian, or similar Linux systems.

![Linux Device AI Relay architecture](./docs/assets/architecture.svg)

The important part of this repository is not just that those upstream trees are present. The important part is the working shape around them:

- service files for long-running operation;
- HAProxy queueing for devices that should not handle unlimited concurrent requests;
- Chrome/Chromium service management for browser-based model login and attach-only web workflows;
- install-time configuration for LAN and public access;
- a safer publish layout that keeps real cookies, access files, browser state, and local runtime data out of Git;
- notes and scripts that document how this setup is expected to run after reboot.

In short, this is an attempt to turn a one-off Linux relay setup into something other people can inspect, adapt, and reproduce on their own device or server.

## What problem it solves

Running AI relay tooling on a normal desktop is one thing. Running it on a small always-on host is different.

A small Linux device or low-cost server needs boring, conservative engineering:

- services should restart after boot;
- request bursts should be serialized or queued;
- browser login state must be handled carefully;
- LAN access should work without editing many files by hand;
- public access should be possible without mixing public examples with private secrets;
- generated files should stay on the target machine instead of being committed back to the repository.

Most failures I ran into were not caused by one single upstream project. They came from the gaps between projects: one process not starting after reboot, one port not matching the docs, a browser session not being available, a smaller host getting overloaded, or a private runtime file accidentally ending up next to publishable source.

This repository is mainly about closing those gaps.

## Supported targets

The project is not limited to N1 hardware. The N1-style setup was the starting point, but the deployment idea is broader.

It is intended for small and medium Linux hosts such as:

- Raspberry Pi devices;
- Linux-capable TV boxes;
- ARM64 development boards;
- mini PCs;
- home lab servers;
- small VPS instances;
- x86_64 or ARM64 Linux machines.

Typical operating systems include:

- Ubuntu;
- Debian;
- Armbian;
- other systemd-based Linux distributions with similar package and service behavior.

The project is most useful when the machine is meant to stay online and provide relay services for other devices, tools, or agent workflows.

## What is inside

```text
linux-ai-relay/
├── CLIProxyAPI/              # API proxy/provider compatibility source tree
├── openclaw-zero-token/      # OpenClaw runtime, tools, channels, and browser-related source tree
├── config/                   # publishable example configs
├── haproxy/                  # serialized API queue config
├── systemd/                  # service definitions
├── scripts/                  # non-destructive checks and maintainer helpers
├── docs/                     # install, security, design, and deployment notes
├── install_n1.sh             # Linux install entry point, kept for compatibility with the original name
├── .gitignore
├── LICENSE
└── README.md
```

The repo should be read as:

```text
upstream source trees + Linux device/server deployment layer + service orchestration + queueing + safety boundary
```

That last part matters. Without the deployment layer, this would mostly be a source mirror. Without the upstream projects, the deployment layer would not do anything useful. The value is in making the combined system understandable and repeatable across small Linux devices and servers.

## Quick checks before installing

The repository includes non-destructive checks that are safe to run before installing anything.

```bash
bash scripts/doctor.sh
```

`doctor.sh` checks the local machine and repository layout. It looks for required project files, optional build artifacts, useful host commands, common relay ports, and existing systemd service names. It does not install packages, start services, or write system files.

```bash
bash scripts/check-repo-health.sh
bash scripts/check-publish-safety.sh
```

These checks are also wired into GitHub Actions. They help keep the public repository useful and safe by checking shell syntax, local docs links, expected files, large tracked files, private machine identifiers, and obvious secret-shaped mistakes.

## Deployment requirements

The current installer is meant for a real Linux host with:

- Debian, Ubuntu, Armbian, or a similar `apt-get` based system;
- systemd available and running;
- root or sudo access;
- network access during install;
- enough disk space to install Node.js, pnpm dependencies, browser packages, HAProxy, and build tools.

The installer is not designed for a minimal container shell because it needs systemd services, service health checks, local ports, and persistent runtime directories.

The public repository is source-first. Some generated outputs or prebuilt artifacts may be absent from a fresh clone. The installer already has source-build behavior for `CLIProxyAPI` when a bundled binary for the host architecture is missing, but release-bundle handling is still one of the next areas to improve.

## Deploy

The main installer is:

```bash
install_n1.sh
```

The file name is kept for compatibility with the original deployment, but the script is meant for Debian/Ubuntu/Armbian-style Linux hosts with `apt-get` and systemd.

### 1. Clone on the target host

Run this on the Raspberry Pi, TV box, mini PC, home server, VPS, or other Linux host that will become the relay:

```bash
git clone https://github.com/feijieni/n1-box-integrated-relay.git
cd n1-box-integrated-relay
```

### 2. Run preflight checks

```bash
bash scripts/doctor.sh
bash scripts/check-repo-health.sh
bash scripts/check-publish-safety.sh
```

If `doctor.sh` warns that optional build artifacts such as `CLIProxyAPI/bin` or `openclaw-zero-token/dist` are missing, that means the checkout is source-first. Review the warning before installing. Required repository files must be present before the installer can run.

### 3. Install for a LAN device or home server

```bash
chmod +x install_n1.sh
sudo N1_LAN_IP=192.168.1.100 ./install_n1.sh
```

Replace `192.168.1.100` with the LAN IP of your Raspberry Pi, TV box, mini PC, home server, VPS private interface, or other Linux relay host.

### 4. Install for a public server or reverse-proxy setup

```bash
sudo N1_LAN_IP=192.168.1.100 \
  PUBLIC_ACCESS_HOST=203.0.113.10 \
  PRIMARY_ACCESS_HOST=203.0.113.10 \
  CONTROL_UI_EXTRA_ORIGINS=https://openclaw.example.com \
  ./install_n1.sh
```

The variable name `N1_LAN_IP` is kept for script compatibility. It can be used for any LAN or primary private IP, not only N1 hardware.

### What the installer does

The installer currently expects a real root/systemd host, not a minimal container shell. It checks for `apt-get`, `systemctl`, and a working systemd environment before installing.

During installation it will:

- verify that required project files, configs, service templates, and queue config are present;
- install base packages such as `curl`, `jq`, `haproxy`, `xvfb`, `x11vnc`, `websockify`, `novnc`, build tools, Python, and related utilities;
- detect or install Chrome/Chromium for browser-assisted login and attach-only web model workflows;
- install Node.js 22 when needed;
- enable `pnpm` through Corepack;
- copy `CLIProxyAPI` into `/opt/cli-proxy-api`;
- copy `openclaw-zero-token` into `/opt/openclaw-zero-token`;
- install or build the `cli-proxy-api` binary depending on the host architecture;
- install OpenClaw runtime dependencies;
- install systemd service files;
- install HAProxy queue config;
- generate local API keys and gateway tokens if they are not provided;
- write local access information files;
- open UFW ports if UFW is active;
- start and health-check the services.

### Useful install variables

| Variable | Purpose |
| --- | --- |
| `N1_LAN_IP` | LAN/private IP of the Linux relay host. Kept for compatibility with the original script name. |
| `PUBLIC_ACCESS_HOST` | Public IP or domain when the host is reachable from outside the LAN. |
| `PRIMARY_ACCESS_HOST` | Main address written into access URLs. Defaults to public host or LAN IP. |
| `ACCESS_HOSTS_EXTRA` | Extra comma-separated hosts that should be treated as valid access hosts. |
| `CONTROL_UI_EXTRA_ORIGINS` | Extra allowed origins for the OpenClaw control UI. |
| `CLIPROXY_API_KEY` | Optional pre-supplied CLIProxyAPI API key. Generated automatically if omitted. |
| `CLIPROXY_MGMT_SECRET_RAW` | Optional pre-supplied CLIProxyAPI management secret. Generated automatically if omitted. |
| `OPENCLAW_GATEWAY_TOKEN` | Optional pre-supplied OpenClaw gateway token. Generated automatically if omitted. |
| `OPENCLAW_MAIN_MAX_CONCURRENT` | Main OpenClaw concurrency. Defaults to `1` for small hosts. |
| `OPENCLAW_SUBAGENT_MAX_CONCURRENT` | Subagent concurrency. Defaults to `1` for small hosts. |
| `EXPOSE_NOVNC_PUBLIC` | Set to `1` only if you intentionally want UFW to allow noVNC port `6080`. |

## Use after deployment

After the installer finishes, it prints the main access URLs and writes them to local files on the target host.

Access files:

```text
/opt/cli-proxy-api/ACCESS.txt
/opt/openclaw-zero-token/ACCESS.txt
```

Read them with:

```bash
sudo cat /opt/cli-proxy-api/ACCESS.txt
sudo cat /opt/openclaw-zero-token/ACCESS.txt
```

Typical URLs and ports:

| Service | Default URL pattern |
| --- | --- |
| CLIProxyAPI management | `http://<host>:8317/management.html` |
| CLIProxyAPI API base | `http://<host>:8317` |
| OpenClaw control UI | `http://<host>:3001/#token=<OPENCLAW_GATEWAY_TOKEN>` |
| OpenClaw OpenAI-compatible API base | `http://<host>:3002/v1` |
| Chrome debug endpoint | `http://127.0.0.1:9222/json/version` |
| noVNC browser login page | `http://<host>:6080/vnc.html` |

For OpenClaw API clients, use:

```text
Base URL: http://<host>:3002/v1
API Key:  value from /opt/openclaw-zero-token/ACCESS.txt
```

For CLIProxyAPI clients, use:

```text
Base URL: http://<host>:8317
API Key:  value from /opt/cli-proxy-api/ACCESS.txt
```

When a web login is needed, start the browser login service manually:

```bash
sudo systemctl start openclaw-auth-browser.service
```

Then open the noVNC URL shown in `/opt/openclaw-zero-token/ACCESS.txt`.

### Service commands

Check service status:

```bash
sudo systemctl status cliproxyapi.service
sudo systemctl status openclaw-chrome-debug.service
sudo systemctl status openclaw-zero-token.service
sudo systemctl status openclaw-api-queue.service
```

View logs:

```bash
sudo journalctl -u cliproxyapi.service -n 100 --no-pager
sudo journalctl -u openclaw-zero-token.service -n 100 --no-pager
sudo journalctl -u openclaw-api-queue.service -n 100 --no-pager
sudo journalctl -u openclaw-chrome-debug.service -n 100 --no-pager
```

Restart services:

```bash
sudo systemctl restart cliproxyapi.service
sudo systemctl restart openclaw-zero-token.service
sudo systemctl restart openclaw-api-queue.service
sudo systemctl restart openclaw-chrome-debug.service
```

## Target behavior

The intended deployed system looks like this:

- `CLIProxyAPI` runs as a managed service;
- `openclaw-zero-token` runs as a managed service;
- a Chrome/Chromium debug browser can stay available for attach-only web model workflows;
- HAProxy exposes a serialized OpenClaw API port so smaller machines are not flooded by parallel requests;
- the host can be reached from LAN devices, and optionally through a public host or reverse proxy;
- local access information is generated on the target machine;
- services come back after reboot.

![Request flow through the relay](./docs/assets/request-flow.svg)

The default design favors reliability over maximum throughput. That is intentional. A low-cost Linux host is more useful as a stable relay than as a machine that accepts too much work and then becomes unreliable.

## Why this is useful beyond one device

Although the repository originally grew out of an N1-style setup, the goal is broader than a single piece of hardware.

The project is useful anywhere a developer wants to turn a low-cost Linux host into a stable AI relay node with:

- managed services;
- serialized request handling;
- browser-assisted model access;
- LAN or public deployment options;
- a clear boundary between source code and runtime secrets;
- a repeatable service layout that can be inspected and modified.

That makes it relevant not only for TV-box-style devices, but also for Raspberry Pi boards, home lab machines, mini PCs, and small cloud servers.

## Deployment styles

### LAN device or home server

For a home or lab network, the host can be reached through a LAN address such as:

```text
192.168.1.100
```

### Public server

The same layout can be adapted to a public Linux server. For public access, a reverse proxy and HTTPS should be used for the UI side. The noVNC/browser login service should not be exposed directly to the public internet unless the operator understands the risk.

The variable name `N1_LAN_IP` is kept for compatibility with the original script, but it can represent any LAN IP for a Raspberry Pi, TV box, mini PC, home server, or other Linux relay host.

## Source-first public release

This public repository is kept source-first on purpose.

It should not contain real local runtime state, browser cookies, generated access files, account logs, or private machine configuration. Those files belong on the machine that is actually running the services.

For a completely offline one-shot install, generated artifacts such as prebuilt binaries or compiled runtime/frontend outputs should be produced through one of these paths:

- build them from source during install;
- publish them as GitHub Release artifacts;
- keep a private machine-specific deployment bundle outside the public source repository.

The current public branch is the integration source and documentation base. The next step is to make the build/release artifact path cleaner so a fresh clone can be turned into a ready-to-run bundle with fewer manual steps.

## Security boundary

These should not be committed:

- `.openclaw-upstream-state/`
- `auth-profiles.json`
- real `ACCESS.txt`
- real `config.yaml`
- cookies
- bearer tokens
- account logs
- local browser profiles
- machine-specific runtime directories

The repository should contain source, examples, templates, and deployment logic. Real secrets and runtime state should be generated or stored on the target machine.

## Project direction

This is an early public release, but the direction is clear:

- make the install path more reproducible on fresh Linux devices and servers;
- separate source, generated artifacts, and private runtime state more cleanly;
- add a release-bundle path for users who do not want to build everything manually;
- record tested device/server reports for Raspberry Pi, TV boxes, mini PCs, VPS hosts, Ubuntu, Debian, Armbian, and similar systems;
- document failure cases such as browser login problems, queue behavior, proxy access, and service startup failures;
- keep upstream synchronization understandable instead of hiding changes in a private bundle.

## Why it is not just an integration dump

A simple integration dump would only place two upstream projects in one folder.

This repository tries to define how the combined stack should behave on a real Linux host:

- what should be a system service;
- which port should be exposed directly;
- which port should be serialized;
- which files are safe to publish;
- which files must stay local;
- how browser login should be separated from the API relay path;
- how the same setup can move between a TV box, Raspberry Pi, mini PC, home server, and public VPS.

That is the part I want to keep improving.

## Docs

- [Why this project matters](./docs/why-this-project.md)
- [Design decisions](./docs/design-decisions.md)
- [Install on Linux or N1](./docs/install-n1.md)
- [Quick start](./docs/quick-start.md)
- [Public server deployment](./docs/public-server.md)
- [Publish to GitHub](./docs/publish-github.md)
- [Security and secrets](./docs/security-and-secrets.md)
- [Changelog](./CHANGELOG.md)

## Short description

A Linux deployment project for running self-hosted AI relay nodes on Raspberry Pi boards, TV boxes, mini PCs, home servers, and small VPS hosts. It combines CLIProxyAPI, OpenClaw Zero Token, systemd services, HAProxy queueing, browser-based model login, safety checks, and safe publish rules into one reproducible layout.
