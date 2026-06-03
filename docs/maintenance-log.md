# Maintenance log

This log records small maintenance updates that do not need a full release note but are useful for reviewers and future maintainers.

## Current maintenance state

The repository is being maintained as a source-first deployment project for Linux relay hosts. The current focus is not adding more bundled files, but making the public repository safer, easier to review, and easier to deploy on real devices.

## Recent maintenance work

### Documentation and positioning

- Generalized the project from an N1-only bundle to a Linux device/server relay package.
- Updated README wording for Raspberry Pi, Linux-capable TV boxes, ARM boards, mini PCs, home servers, and small VPS instances.
- Added architecture and request-flow diagrams.
- Added deployment requirements, install commands, usage instructions, and service troubleshooting commands to README.
- Added a support matrix for target devices, operating systems, architectures, and runtime expectations.

### Repository safety

- Added publish safety checks for tracked runtime files, large files, private machine identifiers, and obvious secret-shaped mistakes.
- Added GitHub Actions workflow to run repository checks automatically.
- Added issue templates that remind users not to paste cookies, bearer tokens, generated access files, or private account logs.

### Operational checks

- Added `scripts/doctor.sh` for non-destructive host and repository diagnostics.
- Added `scripts/check-repo-health.sh` for expected files, Markdown local links, and shell syntax checks.
- Kept the checks non-destructive so they can run before installation or in CI.

## Next maintenance tasks

- Rename or wrap `install_n1.sh` with a more generic `install_linux_relay.sh` entry point while keeping backward compatibility.
- Improve build-artifact handling for source-first clones.
- Add tested install reports for at least one x86_64 VPS and one ARM64 board.
- Add troubleshooting docs for browser login, queue behavior, and public reverse-proxy deployment.
- Add release-bundle notes for users who prefer not to build or prepare generated artifacts manually.

## Maintainer rule of thumb

Prefer small, reviewable changes. This repository is most useful when another person can understand:

- what the host is supposed to become;
- which services will run;
- which files are generated locally;
- what should stay out of Git;
- how to diagnose a failed deployment without exposing secrets.
