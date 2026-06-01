# Changelog

## v0.1.0 - First public source release

This is the first public source release of N1 Box Integrated Relay Package.

The release focuses on making the original N1/Linux relay setup readable, publishable, and easier to reproduce.

### Added

- Public source layout for the integrated N1/Linux relay setup.
- `CLIProxyAPI` source tree included as part of the relay stack.
- `openclaw-zero-token` source tree included as part of the relay stack.
- Linux/N1 deployment layer with:
  - `install_n1.sh` install entry point;
  - systemd service templates;
  - HAProxy serialized queue config;
  - publishable example configuration;
  - docs for LAN and public-server deployment.
- Safety rules for keeping local runtime state out of Git.
- Maintainer notes explaining why the project is not just a source-tree bundle.
- Architecture and request-flow diagrams for the README.

### Changed

- README rewritten to describe the real deployment problem, design tradeoffs, and project direction.
- Project documentation now separates source, generated artifacts, and target-machine runtime state.

### Notes

This release is source-first. It does not include private runtime state, local browser cookies, generated access files, account logs, or machine-specific configuration.

For one-shot offline installs, future releases should provide either build-from-source improvements or GitHub Release artifacts.
