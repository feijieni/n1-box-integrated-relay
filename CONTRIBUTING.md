# Contributing

Thanks for your interest in improving Linux Device AI Relay Package.

This repository is mainly a deployment and integration project. Contributions should keep the public source tree reviewable, safe to publish, and useful for real Linux hosts such as Raspberry Pi boards, TV boxes, mini PCs, home servers, and small VPS instances.

## Useful contribution types

Good first contributions include:

- tested install reports for a new device or VPS;
- fixes to installation docs;
- safer systemd or HAProxy defaults;
- troubleshooting notes with secrets removed;
- improvements to `scripts/doctor.sh` or repository checks;
- control center read-only status improvements;
- clearer localized documentation.

## Before opening a pull request

Run the checks:

```bash
bash scripts/check-project-rules.sh
bash scripts/check-repo-health.sh
bash scripts/check-publish-safety.sh
bash scripts/doctor.sh
```

When you need safe local repair before installing, run:

```bash
bash scripts/doctor.sh --fix
```

`--fix` is intentionally limited to safe repairs. It should not install packages, delete files, kill processes, or start/stop services.

## Do not commit secrets or runtime state

Do not commit:

- real `ACCESS.txt` files;
- real `config.yaml` files;
- `.env` files;
- cookies;
- bearer tokens;
- browser profiles;
- account logs;
- `.openclaw-upstream-state/`;
- machine-specific runtime directories.

If a log is needed, remove tokens, cookies, private IPs when needed, account data, and private hostnames.

## Installer changes

Installer changes need extra care.

Keep these rules:

- `install_linux_relay.sh` is the preferred generic installer entrypoint;
- `install_n1.sh` remains as a backward-compatible entrypoint;
- source-first clones should not fail just because optional build artifacts are absent;
- generated secrets should be written to local files with restrictive permissions;
- terminal output should avoid printing raw secrets by default.

## Control center changes

The control center is read-only by default.

Do not add write actions such as restart, config edit, or log tail without:

- token protection;
- explicit documentation;
- safety review;
- no secret output;
- a clear reason why the action belongs in the web UI.

## Pull request checklist

- [ ] I ran the repository checks.
- [ ] I did not commit real secrets or runtime state.
- [ ] I updated README or docs if behavior changed.
- [ ] I kept small-device constraints in mind.
- [ ] I avoided exposing tokens, cookies, or browser state.
