#!/usr/bin/env bash
set -euo pipefail
corepack enable
corepack prepare pnpm@12.8.2 --activate
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service... build
