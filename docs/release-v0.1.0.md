# v0.1.0 release notes

This is the first public source release of N1 Box Integrated Relay Package.

The release is meant to make the project reviewable first: what the system is for, how it is arranged, which parts belong to the public repository, and which parts should stay on the machine that runs the relay.

## What is included

- Integrated source layout for `CLIProxyAPI` and `openclaw-zero-token`.
- N1/Linux deployment layer.
- systemd service templates.
- HAProxy serialized queue configuration.
- Install script entry point.
- LAN and public-server deployment notes.
- Security notes for secrets, cookies, runtime state, and generated access files.
- README diagrams showing architecture and request flow.
- Design notes explaining small-machine-first tradeoffs.

## What is intentionally not included

The public source release does not include live runtime state:

- generated `ACCESS.txt` files;
- real `config.yaml` files;
- cookies;
- bearer tokens;
- browser profiles;
- account logs;
- machine-specific runtime directories.

Those files are generated or stored on the target machine.

## Known limitation

The repository is source-first. Some deployment paths may still need clearer build or release-artifact handling before a fresh clone becomes a completely offline one-shot install.

This is the main focus for the next release.

## Next release goals

- Improve build-from-source behavior when generated artifacts are absent.
- Add a release-bundle path for users who prefer a simpler install.
- Add tested install notes for more Linux/N1-style machines.
- Add troubleshooting notes for browser login, queueing, proxy access, and service startup.
