# Security and Secrets

Never commit:

- cookies
- bearer tokens
- OAuth callback traces with real codes
- `.openclaw-upstream-state/`
- `auth-profiles.json`
- real `ACCESS.txt`
- logs with account information

Public deployment notes:

- public API access is possible
- public UI access is possible
- public noVNC access is possible but risky
- HTTPS reverse proxy is strongly recommended for public UI access
- if you only need public API, do not expose noVNC
