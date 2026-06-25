# Troubleshooting

This guide collects common deployment checks for Linux Device AI Relay Package.

## Start with doctor

Run the non-destructive check first:

```bash
bash scripts/doctor.sh
```

For safe local repairs:

```bash
bash scripts/doctor.sh --fix
```

`--fix` can restore executable bits, append missing `.gitignore` safety rules, and restrict local generated file permissions. It does not install packages, delete files, kill processes, or restart services.

## Check service status

```bash
sudo systemctl status cliproxyapi.service
sudo systemctl status openclaw-zero-token.service
sudo systemctl status openclaw-api-queue.service
sudo systemctl status openclaw-chrome-debug.service
sudo systemctl status openclaw-auth-browser.service
sudo systemctl status linux-relay-control-center.service
```

## Read recent logs

```bash
sudo journalctl -u cliproxyapi.service -n 120 --no-pager
sudo journalctl -u openclaw-zero-token.service -n 120 --no-pager
sudo journalctl -u openclaw-api-queue.service -n 120 --no-pager
sudo journalctl -u openclaw-chrome-debug.service -n 120 --no-pager
sudo journalctl -u linux-relay-control-center.service -n 120 --no-pager
```

Remove tokens, cookies, and private account data before sharing logs.

## Port checks

Default ports:

| Port | Service |
| --- | --- |
| `8317` | CLIProxyAPI |
| `3001` | OpenClaw control UI |
| `3002` | OpenClaw serialized API queue |
| `9222` | Chrome debug endpoint |
| `6080` | noVNC browser login page |
| `3099` | Control center |

Check listening ports:

```bash
sudo ss -ltnp | grep -E ':(8317|3001|3002|9222|6080|3099)\b'
```

If a port is already used by another process, change the relevant service/config or stop the conflicting process after confirming it is safe.

## Access files missing

Expected files after install:

```text
/opt/cli-proxy-api/ACCESS.txt
/opt/openclaw-zero-token/ACCESS.txt
```

If they are missing, the installer may have failed before the config step. Check installer output and service logs.

## Permission warnings

Recommended permissions:

```text
/opt/cli-proxy-api/ACCESS.txt -> 600
/opt/openclaw-zero-token/ACCESS.txt -> 600
/opt/cli-proxy-api/config.yaml -> 600
/opt/openclaw-zero-token/.openclaw-upstream-state/openclaw.json -> 600
```

Run:

```bash
bash scripts/doctor.sh --fix
```

## OpenClaw build is slow or fails

A source-first checkout may build missing OpenClaw `dist` output during install. On small ARM devices this can take time and memory.

Try:

- ensure enough free disk space;
- close other heavy processes;
- test first on a stronger machine if possible;
- use a future release bundle when available.

## Browser login problems

The browser login service is separate from the main API path.

Start it manually:

```bash
sudo systemctl start openclaw-auth-browser.service
```

Then open the noVNC URL from:

```bash
sudo cat /opt/openclaw-zero-token/ACCESS.txt
```

Do not expose noVNC directly to the public internet without a reverse proxy, HTTPS, and authentication.

## Control center cannot open

Install it:

```bash
sudo bash control-center/install_control_center.sh
```

Check service:

```bash
sudo systemctl status linux-relay-control-center.service
sudo journalctl -u linux-relay-control-center.service -n 100 --no-pager
```

Read token:

```bash
sudo cat /opt/linux-relay-control-center/control-token
```

Open locally or through SSH forwarding:

```bash
ssh -L 3099:127.0.0.1:3099 user@relay-host
```

## Public server notes

For public deployment:

- prefer HTTPS through a reverse proxy;
- keep Chrome debug on localhost;
- avoid direct public noVNC exposure;
- keep the control center token-protected;
- do not share raw `ACCESS.txt` contents.
