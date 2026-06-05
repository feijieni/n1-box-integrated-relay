# Project rules

This repository includes a small rule system for protecting the public deployment layout.

The rules are intentionally simple. They are not meant to replace a full security scanner. They are meant to catch the mistakes that are most likely to happen in this project:

- deleting required deployment files;
- removing localized documentation by accident;
- losing the generic Linux installer entrypoint;
- committing local runtime files such as `ACCESS.txt`, `config.yaml`, cookies, browser state, or account state;
- changing README positioning so the project looks N1-only again;
- breaking the public source/runtime boundary.

## Files

```text
config/project-rules.json
scripts/check-project-rules.sh
```

`config/project-rules.json` is the machine-readable rule file.

`scripts/check-project-rules.sh` reads that file and checks the repository.

## Run locally

```bash
bash scripts/check-project-rules.sh
```

The script checks:

- required files;
- required directories;
- required README phrases;
- forbidden tracked runtime paths;
- installer entrypoint behavior;
- Chinese and Japanese documentation sections.

## CI behavior

The GitHub Actions workflow runs this check on:

- push to `main`;
- pull requests;
- manual workflow dispatch.

If the rule check fails, the repository check job fails before the broader health and doctor checks.

## Updating rules

When the project layout changes, update `config/project-rules.json` first. Then run:

```bash
bash scripts/check-project-rules.sh
bash scripts/check-repo-health.sh
bash scripts/check-publish-safety.sh
```

Keep the rule file focused on stable project boundaries. Do not put temporary development details into it.

## Current protected boundaries

The current rules protect these expectations:

- `install_linux_relay.sh` is the preferred generic installer;
- `install_n1.sh` remains as a compatibility installer;
- Chinese and Japanese docs remain linked from the main README;
- runtime secrets and machine-specific state stay out of Git;
- source-first deployment support remains documented;
- core service templates and HAProxy queue config remain present.
