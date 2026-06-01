# Design decisions

This document records the design choices behind this repository. It is written from the maintainer side, because most of the useful work in this project lives in the operational decisions around the upstream code.

## 1. Small machine first

The first target is not a large cloud server. The first target is a small always-on Linux box.

That changes the defaults. A small machine should not accept every request at the same time just because the software can technically do it. It needs boring limits, predictable startup, and a way to recover after reboot.

That is why the deployment layer uses systemd services and an HAProxy queue. The goal is to keep the box usable under real conditions, not to produce the highest benchmark number.

## 2. Queue before overload

For an N1-style box, uncontrolled concurrency is usually worse than waiting.

The OpenClaw API path is designed to be serialized by default. This makes the system slower under a burst, but much more predictable. It also makes failures easier to read because only one main request is active at a time.

This is a deliberate tradeoff. Users with stronger hardware can loosen the limits later, but the default should protect weaker machines.

## 3. Runtime state stays on the target machine

Real access files, cookies, browser profiles, account state, and generated tokens do not belong in the public repository.

The repository should contain:

- source code;
- example configuration;
- service templates;
- install logic;
- documentation.

The target machine should contain:

- generated access information;
- browser login state;
- local runtime directories;
- machine-specific config;
- logs.

This split is important because it lets the project be published and reviewed without turning the repository into a copy of one private machine.

## 4. Browser login is treated as infrastructure

Some model access flows need a browser session. Treating that as a manual side step makes the deployment fragile.

This project keeps the browser side explicit: Chrome/Chromium service handling, debug port assumptions, and noVNC login support are part of the deployment story.

The browser service is not the same thing as the public API relay. It should be controlled carefully, especially on public servers.

## 5. The project is not only a wrapper

A wrapper starts a program.

This repository tries to define a working environment:

- how the services are laid out;
- how they start after reboot;
- where generated files are written;
- what is safe to publish;
- which access paths are meant for LAN use;
- which access paths need a reverse proxy;
- how a small box avoids overload.

That is why the repository includes docs, service files, queue config, example config, and install logic instead of only a launch script.

## 6. Source-first now, release bundles later

The current public repository is source-first. That keeps it reviewable and safer to publish.

For everyday users, a future release bundle will be more convenient. The intended path is:

1. keep source and private runtime state separate;
2. make build steps reproducible;
3. publish release artifacts for users who want a simpler install;
4. keep the repository itself clean enough for review and maintenance.

## 7. Upstream sync should stay understandable

The two upstream source trees are large. If this project changes behavior around them, those changes should be documented instead of hidden.

The long-term goal is to keep integration changes understandable:

- what came from upstream;
- what was adjusted for deployment;
- what is N1/Linux specific;
- what is generated locally;
- what should never be committed.

This makes the repository more useful to other people than a private zip file or one-off backup.

## 8. Practical success criteria

For this project, success means a user can read the repository and understand:

- what the box is supposed to become;
- which services will run;
- how requests are routed;
- where secrets are generated;
- what should not be pushed to GitHub;
- how to adapt the setup for LAN or a public server.

That is the standard this repository should move toward.
