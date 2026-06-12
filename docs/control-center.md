# Control center

The control center is a small read-only web dashboard for Linux Device AI Relay deployments.

It gives one page for checking:

- CLIProxyAPI service status;
- OpenClaw control UI service status;
- OpenClaw serialized API queue status;
- Chrome debug browser status;
- noVNC auth browser status;
- local port availability;
- local HTTP endpoint health;
- generated access file presence and permissions;
- important runtime config paths.

## Design

The first version is intentionally read-only.

It does not:

- restart services;
- edit config files;
- show API keys;
- show cookies;
- print `ACCESS.txt` contents;
- manage browser sessions;
- expose system logs directly.

This keeps the dashboard useful without turning it into a high-risk remote admin panel.

## Files

```text
control-center/control_center.py
control-center/install_control_center.sh
systemd/linux-relay-control-center.service
```

The implementation uses Python standard library only. This keeps it light enough for Raspberry Pi, TV boxes, mini PCs, home servers, and small VPS hosts.

## Install

Run on the Linux relay host:

```bash
sudo bash control-center/install_control_center.sh
```

The installer copies the control center to:

```text
/opt/linux-relay-control-center
```

It installs the service:

```text
linux-relay-control-center.service
```

The service listens on localhost by default:

```text
http://127.0.0.1:3099
```

A local token is generated at:

```text
/opt/linux-relay-control-center/control-token
```

## Open the page

On the relay host:

```bash
TOKEN="$(sudo cat /opt/linux-relay-control-center/control-token)"
echo "http://127.0.0.1:3099/?token=$TOKEN"
```

If you use SSH port forwarding from another machine:

```bash
ssh -L 3099:127.0.0.1:3099 user@relay-host
```

Then open the local browser URL printed above.

## Service commands

```bash
sudo systemctl status linux-relay-control-center.service
sudo journalctl -u linux-relay-control-center.service -n 100 --no-pager
sudo systemctl restart linux-relay-control-center.service
```

## API

```text
GET /healthz
GET /api/status
```

`/api/status` requires the control token when authentication is enabled.

Token can be supplied by:

```text
?token=<token>
X-Control-Token: <token>
Authorization: Bearer <token>
```

## Security notes

Default binding is localhost only:

```text
CONTROL_CENTER_HOST=127.0.0.1
```

If you change it to `0.0.0.0`, keep `CONTROL_CENTER_TOKEN_FILE` or `CONTROL_CENTER_TOKEN` configured. Do not expose the dashboard publicly without a reverse proxy, HTTPS, and authentication.

The control center is read-only, but it still reveals operational information such as service names, ports, and runtime paths.

## Future ideas

Possible future features:

- protected restart buttons;
- short log tail with token filtering;
- config validation preview;
- controlled noVNC start helper;
- one-click doctor check;
- basic mobile layout refinements;
- per-service troubleshooting hints.

Any write action should be token-protected, auditable, and disabled by default.
