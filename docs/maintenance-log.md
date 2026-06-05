# Maintenance log

This log records small maintenance updates that do not need a full release note but are useful for reviewers and future maintainers.

## Current maintenance state

The repository is being maintained as a source-first deployment project for Linux relay hosts. The current focus is not adding more bundled files, but making the public repository safer, easier to review, and easier to deploy on real devices.

## Recent maintenance work

### Deployment hardening

- Added `install_linux_relay.sh` as a generic installer entrypoint while keeping `install_n1.sh` for backward compatibility.
- Hardened `install_n1.sh` for source-first clones: missing `CLIProxyAPI/bin` no longer blocks installation because CLIProxyAPI can build from source.
- Hardened `install_n1.sh` for missing `openclaw-zero-token/dist`: the installer now attempts a source build before continuing.
- Reduced terminal secret exposure at the end of installation. Access details are written to local `ACCESS.txt` files with restrictive permissions instead of printing raw keys directly in the terminal summary.
- Added `umask 077` during install setup so generated local runtime files default to restrictive permissions.
- Retried Go download through the existing retry helper to reduce transient network install failures.
- Added `chmod 0644` for the NodeSource keyring file after dearmoring.

### Documentation and positioning

- Generalized the project from an N1-only bundle to a Linux device/server relay package.
- Updated README wording for Raspberry Pi, Linux-capable TV boxes, ARM boards, mini PCs, home servers, and small VPS instances.
- Added architecture and request-flow diagrams.
- Added deployment requirements, install commands, usage instructions, and service troubleshooting commands to README.
- Added a support matrix for target devices, operating systems, architectures, and runtime expectations.
- Added Chinese and Japanese documentation sections.

### Repository safety

- Added publish safety checks for tracked runtime files, large files, private machine identifiers, and obvious secret-shaped mistakes.
- Added GitHub Actions workflow to run repository checks automatically.
- Added issue templates that remind users not to paste cookies, bearer tokens, generated access files, or private account logs.

### Operational checks

- Added `scripts/doctor.sh` for non-destructive host and repository diagnostics.
- Added `scripts/check-repo-health.sh` for expected files, Markdown local links, and shell syntax checks.
- Kept the checks non-destructive so they can run before installation or in CI.

## Next maintenance tasks

- Update README and localized docs to recommend `install_linux_relay.sh` as the preferred generic entrypoint while keeping `install_n1.sh` documented as a compatibility entrypoint.
- Add tested install reports for at least one x86_64 VPS and one ARM64 board.
- Add troubleshooting docs for browser login, queue behavior, and public reverse-proxy deployment.
- Add release-bundle notes for users who prefer not to build or prepare generated artifacts manually.
- Review OpenClaw build time and memory requirements on small ARM devices.

## Maintainer rule of thumb

Prefer small, reviewable changes. This repository is most useful when another person can understand:

- what the host is supposed to become;
- which services will run;
- which files are generated locally;
- what should stay out of Git;
- how to diagnose a failed deployment without exposing secrets.
