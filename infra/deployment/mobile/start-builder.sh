#!/usr/bin/env bash
set -euo pipefail
bash infra/deployment/mobile/build.sh
# Downloads start only after Flutter checks and APK generation succeed.
exec python3 infra/deployment/mobile/serve-artifacts.py
