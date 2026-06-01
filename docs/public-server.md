# Public Server Deployment

Yes, this can be deployed in a way that keeps both LAN access and public access.

## Direct public IP mode

If the machine has a public IP and you want direct access on the native ports:

```bash
sudo N1_LAN_IP=192.168.1.100 \
  PUBLIC_ACCESS_HOST=203.0.113.10 \
  PRIMARY_ACCESS_HOST=203.0.113.10 \
  ./install_n1.sh
```

That gives you:

- LAN access, for example `http://192.168.1.100:8317`
- public access, for example `http://203.0.113.10:8317`

## Domain and reverse proxy mode

Recommended for public use:

- keep backend services on the same ports
- place HTTPS reverse proxy in front of public UI and API entrypoints
- add the public HTTPS origin to `CONTROL_UI_EXTRA_ORIGINS`

Example:

```bash
sudo N1_LAN_IP=192.168.1.100 \
  PUBLIC_ACCESS_HOST=openclaw.example.com \
  PRIMARY_ACCESS_HOST=openclaw.example.com \
  CONTROL_UI_EXTRA_ORIGINS=https://openclaw.example.com \
  ./install_n1.sh
```

## Practical recommendation

- LAN users can keep using the LAN IP
- public users should use a domain plus HTTPS reverse proxy
- third-party clients should hit `3002`, not `3001`, because `3002` is the serialized queue entrypoint
- do not expose noVNC publicly unless you really need it
- if you must expose noVNC, set `EXPOSE_NOVNC_PUBLIC=1`

## CLIProxyAPI build compatibility

For common public Debian/Ubuntu servers:

- `amd64` and `arm64` install from bundled `CLIProxyAPI` binaries
- the installer no longer relies on the distro `golang-go` package for those machines

For less common Linux architectures:

- the installer reads the required Go version from `CLIProxyAPI/go.mod`
- it downloads the matching official Go toolchain from `go.dev`
- then it builds `CLIProxyAPI` locally

That means the typical public `x86_64` deployment path is now binary-first instead of source-first.

The installer also performs post-start health checks. If one of the services fails on the server, it now stops and prints the related `systemd` logs instead of reporting a false success.

By default the installer also forces OpenClaw agent concurrency to `1` for both main runs and subagent runs, so bursty public traffic is serialized instead of hitting the web-model browser session in parallel.


