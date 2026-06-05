#!/usr/bin/env bash
set -euo pipefail

# Generic installer entrypoint.
# The original installer file is still named install_n1.sh for backward
# compatibility with the first deployment target, but the project now targets
# Raspberry Pi, Linux-capable TV boxes, mini PCs, home servers, and small VPS
# instances as well.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/install_n1.sh" "$@"
