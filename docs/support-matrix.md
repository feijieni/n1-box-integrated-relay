# Support matrix

This file records the intended support scope for the Linux Device AI Relay Package.

The project started from an N1-style deployment, but the target is broader: small Linux devices and small servers that can run systemd services and the required runtime dependencies.

## Target classes

| Target class | Status | Notes |
| --- | --- | --- |
| Raspberry Pi | Intended target | Best matched when running a Debian/Ubuntu/Armbian-style system with systemd. |
| Linux-capable TV boxes | Intended target | Useful when the box can run a normal Linux userspace and persistent services. |
| ARM64 development boards | Intended target | Should be treated like other ARM64 Linux hosts. |
| Mini PCs | Intended target | Usually the easiest small-device target because x86_64 support is common. |
| Home lab servers | Intended target | Good fit for LAN relay use and always-on operation. |
| Small VPS instances | Intended target | Good fit for public or reverse-proxy deployment. |
| Minimal containers | Not a target | The installer expects systemd, local ports, persistent runtime paths, and service health checks. |

## Operating systems

| OS family | Status | Notes |
| --- | --- | --- |
| Ubuntu | Primary target | `apt-get` and systemd expected. |
| Debian | Primary target | `apt-get` and systemd expected. |
| Armbian | Primary target for ARM boxes | Common on ARM boards and TV-box-style devices. |
| Other systemd Linux distributions | Possible | May need package-name or install-step adjustments. |
| Non-systemd systems | Not currently supported | The installer installs and verifies systemd services. |

## CPU architectures

| Architecture | Status | Notes |
| --- | --- | --- |
| x86_64 / amd64 | Intended target | Common for mini PCs and VPS hosts. |
| ARM64 / aarch64 | Intended target | Common for Raspberry Pi, ARM boards, and some TV boxes. |
| 32-bit ARM | Experimental | May need more testing and build fixes. |
| Other Linux architectures | Experimental | Depends on Go, Node.js, browser, and package availability. |

## Runtime expectations

The current installer expects:

- root or sudo access;
- `apt-get` package management;
- systemd available and running;
- network access during installation;
- enough disk space for Node.js, pnpm dependencies, browser packages, HAProxy, and build tools;
- local ports available for the relay services.

## Default service ports

| Port | Service |
| --- | --- |
| `8317` | CLIProxyAPI API and management UI |
| `3001` | OpenClaw control UI |
| `3002` | Serialized OpenClaw OpenAI-compatible API path |
| `9222` | Local Chrome debug endpoint |
| `6080` | noVNC browser login page |

## Maintenance notes

When a new target is tested, add a short install report with:

- device or VPS type;
- CPU architecture;
- RAM;
- OS version;
- deployment style;
- what worked;
- what needed manual changes;
- logs with secrets removed.
