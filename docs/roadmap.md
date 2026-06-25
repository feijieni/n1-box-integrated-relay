# Roadmap

This roadmap keeps the project focused on practical deployment value rather than adding unrelated features.

## v0.1.x - Public source hardening

Current focus:

- source-first repository cleanup;
- README deployment clarity;
- project rules and CI checks;
- Chinese and Japanese documentation sections;
- read-only control center MVP;
- safer installer defaults;
- issue templates and maintenance logs.

## v0.2.x - Install validation and reports

Planned work:

- test clean x86_64 Ubuntu/Debian VPS install;
- test ARM64 board or Linux TV box install;
- add sanitized install reports;
- document common failure cases;
- improve OpenClaw source build behavior on small machines;
- add device-specific notes for Raspberry Pi, Armbian, and mini PCs.

## v0.3.x - Release bundle path

Planned work:

- define what should be built from source and what can be released as artifacts;
- add release-bundle documentation;
- reduce fresh-clone install friction;
- keep runtime secrets and browser state outside release artifacts.

## v0.4.x - Control center improvements

Planned work:

- one-click read-only doctor check from the dashboard;
- optional protected restart buttons;
- filtered log summaries with secret redaction;
- troubleshooting hints per service;
- mobile UI refinements.

Write actions should remain disabled by default and must be token-protected.

## Long-term goals

- make small Linux AI relay deployment easier to reproduce;
- keep upstream integration changes understandable;
- support multiple device classes without hard-coding one hardware target;
- maintain a clear public source/runtime secret boundary;
- provide enough diagnostics for users to fix deployment problems without exposing private data.
