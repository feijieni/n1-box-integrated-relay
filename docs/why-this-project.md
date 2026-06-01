# Why this project matters

N1 Box Integrated Relay Package is a deployment integration project for self-hosted AI relay infrastructure.

It is designed for people who want to run AI agent relay services on low-cost, always-on Linux hardware such as N1 boxes, ARM boxes, mini PCs, or small public servers.

## Problem

Modern AI agent workflows often depend on several moving parts:

- an API proxy or provider compatibility layer;
- an agent/runtime service;
- browser-based model login or web-model attach flows;
- service startup after reboot;
- safe storage of local access information;
- network access from other machines;
- queueing or concurrency limits for small devices.

Each part can be solved manually, but the combined deployment is easy to break. A setup that works on one machine may be hard to reproduce on another machine.

Low-cost boxes are especially sensitive to this because they usually have limited CPU, memory, storage speed, and cooling. They need conservative defaults and serialized request handling rather than uncontrolled concurrency.

## What this project adds

This project adds an integration layer around upstream source trees:

- `CLIProxyAPI` for API proxying and provider compatibility;
- `openclaw-zero-token` for OpenClaw runtime, channels, tools, browser-assisted authentication, and control services;
- systemd service definitions for repeatable service startup;
- HAProxy queue configuration for serialized request handling;
- example configuration for LAN and public access;
- an installation script that encodes the target deployment behavior;
- documentation focused on publishing safely without leaking runtime state.

The value is not only in the upstream source code. The value is in making the combined stack easier to reproduce on real Linux/N1-style hardware.

## Why low-cost hardware matters

A small always-on relay node can be useful for:

- personal AI tool infrastructure;
- local LAN access from multiple devices;
- experiments with OpenClaw-style agent workflows;
- browser-based model access without keeping a desktop session active;
- low-cost self-hosted relay testing;
- educational deployment examples for AI agent infrastructure.

This kind of deployment makes AI infrastructure more accessible to users who do not want to rely only on a cloud VM or a full desktop workstation.

## Safety model

The repository intentionally avoids publishing live runtime state.

The public source should not contain:

- real access files;
- cookies;
- bearer tokens;
- account logs;
- local browser profiles;
- private `config.yaml` files;
- machine-specific runtime directories.

Instead, the installer generates local access details on the target machine.

## Relationship to upstream projects

This repository includes and integrates upstream project source trees, but its primary purpose is deployment integration.

It should be understood as:

```text
upstream source trees + small-device deployment layer + service orchestration + queueing + safe publish layout
```

The project is useful when the question is not only "how do I run one tool?" but "how do I reproduce a full AI relay node on a small Linux machine?"

## Current maturity

This is an early public release. The current focus is to make the structure, safety model, and deployment goal visible.

Important next steps are:

- improve build artifact handling;
- publish release bundles or build-from-source paths;
- test installation on more Linux/N1-style devices;
- document common failure modes;
- add clearer maintenance notes for upstream synchronization.

## Application summary

A concise description for grant, sponsorship, or OSS support applications:

> N1 Box Integrated Relay Package is a reproducible Linux/N1 deployment bundle that turns low-cost always-on machines into AI relay nodes. It integrates CLIProxyAPI, OpenClaw Zero Token, systemd service management, HAProxy serialized queues, Chrome-based web model login, and LAN/public access configuration. The project aims to make self-hosted AI agent relay infrastructure easier to deploy, safer to publish, and more accessible on low-cost hardware.
