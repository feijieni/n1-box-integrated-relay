# Publish to GitHub

Safe to publish:

- `CLIProxyAPI/`
- `openclaw-zero-token/`
- `config/`
- `systemd/`
- `haproxy/`
- `docs/`
- `install_n1.sh`

Do not publish live runtime state:

- `.openclaw-upstream-state/`
- `auth-profiles.json`
- real `ACCESS.txt`
- cookies
- bearer tokens
- logs with real account data

Suggested publish flow:

```bash
git init
git add .
git commit -m "Initial N1 integrated relay package"
```
