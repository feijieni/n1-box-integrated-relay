# Maintaining this repository

This project is an integration repository, so maintenance is not only about changing code. It is also about keeping the public source safe, the deployment path understandable, and the upstream relationship clear.

## Maintainer priorities

1. Keep the public repository free of runtime secrets and machine-specific state.
2. Keep the install path understandable for small Linux/N1-style machines.
3. Prefer conservative defaults over maximum concurrency.
4. Document changes that affect service layout, ports, browser login, queueing, or generated files.
5. Keep upstream source changes distinguishable from deployment-layer changes.

## Before publishing changes

Run the publish safety check:

```bash
bash scripts/check-publish-safety.sh
```

The check looks for common mistakes:

- real access files committed by accident;
- private config files;
- generated runtime state;
- large build outputs;
- original private machine identifiers;
- obvious GitHub or bearer token shapes.

This script is not a replacement for human review, but it catches the mistakes that are easy to make when turning a private relay setup into a public repository.

## Changes that need extra care

Review carefully before changing:

- `install_n1.sh`
- `systemd/`
- `haproxy/`
- `config/*.example`
- browser login helpers
- generated access file handling
- ports and public/LAN exposure
- `.gitignore`
- release packaging

## Upstream source trees

The repository includes upstream source trees because the deployment stack needs to be inspected as a whole.

When updating upstream content, try to record:

- which upstream tree changed;
- what local deployment assumptions may be affected;
- whether service files or install steps need to change;
- whether new runtime state paths need to be added to `.gitignore`.

## Release checklist

Before a release:

- [ ] README reflects the current install behavior.
- [ ] `CHANGELOG.md` has an entry for the release.
- [ ] `docs/release-*.md` exists for the release.
- [ ] `scripts/check-publish-safety.sh` passes.
- [ ] No real cookies, tokens, browser state, or access files are committed.
- [ ] Known limitations are documented.
- [ ] The release notes say whether it is source-only or includes artifacts.

## What success looks like

A new user should be able to understand:

- what the box is supposed to become;
- which services are involved;
- which path is queued;
- where secrets are generated;
- what should never be committed;
- how to report install results without leaking private data.
