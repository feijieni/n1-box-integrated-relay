# v0.1.1 release notes

This maintenance release focuses on making the repository more useful as a real Linux relay deployment project.

## Highlights

- Added a generic installer entrypoint: `install_linux_relay.sh`.
- Hardened the compatibility installer for source-first clones.
- Added project rules and CI checks.
- Added safe `doctor.sh --fix` mode.
- Added Chinese and Japanese documentation sections.
- Added read-only web control center MVP.
- Added support matrix and maintenance log.
- Added troubleshooting, contributing, and security docs.

## Installer improvements

- `CLIProxyAPI/bin` is now optional when a source build path is available.
- Missing `openclaw-zero-token/dist` can be handled through a source build path.
- Generated access details are written to local files instead of being printed directly in the terminal summary.
- Generated local runtime files use more restrictive permissions.

## Control center

The first control center version is read-only.

It can show:

- service status;
- port checks;
- local endpoint health;
- access file existence and permissions;
- key runtime path presence.

It does not show raw secrets, cookies, or `ACCESS.txt` contents.

## Documentation

Added or improved:

- `CONTRIBUTING.md`
- `SECURITY.md`
- `docs/troubleshooting.md`
- `docs/roadmap.md`
- `docs/control-center.md`
- `docs/project-rules.md`
- `docs/zh-CN/README.md`
- `docs/ja/README.md`

## Notes

This is still a source-first release. A future release-bundle path should reduce fresh-clone install friction for users who do not want to build missing artifacts manually.
