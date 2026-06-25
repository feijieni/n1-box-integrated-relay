# Security policy

This repository contains deployment code for a self-hosted AI relay stack. Some deployments involve browser sessions, API keys, generated gateway tokens, and local access files, so security reports should be handled carefully.

## Supported versions

The public repository is currently source-first and early-stage.

| Version | Supported |
| --- | --- |
| `main` | Yes, best-effort |
| `v0.1.x` | Yes, best-effort |

## What to report

Please report issues such as:

- committed secrets or secret-like data;
- unsafe default exposure of control, noVNC, Chrome debug, or API ports;
- control center authentication bypass;
- service files that expose unnecessary privileges;
- installer behavior that prints secrets into logs;
- unsafe file permissions for generated access files;
- documentation that encourages unsafe public exposure.

## What not to include in reports

Do not paste real:

- API keys;
- gateway tokens;
- cookies;
- browser profiles;
- account logs;
- generated `ACCESS.txt` contents;
- private `config.yaml` contents.

Use sanitized examples instead.

## Reporting process

For low-risk documentation issues, open a normal GitHub issue.

For sensitive issues, avoid posting secrets publicly. Open a minimal issue describing the category of the problem and say that details are sensitive. The maintainer can then coordinate a safer disclosure path.

## Security boundaries

The intended public repository boundary is:

- source code;
- example configs;
- service templates;
- install scripts;
- checks;
- docs.

The target host boundary is:

- generated access files;
- real config;
- cookies;
- browser state;
- account logs;
- local runtime directories.

## Control center security

The control center is read-only by default. It must not display raw secrets or `ACCESS.txt` contents.

If it is bound outside localhost, a token must be configured. Public exposure should use a reverse proxy with HTTPS and authentication.
