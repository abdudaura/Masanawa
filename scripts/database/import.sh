#!/usr/bin/env bash
set -euo pipefail

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "usage: TARGET_DATABASE_URL=postgresql://... $0 <input.dump>" >&2
  exit 64
fi
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL is required}"

pg_restore \
  --dbname="$TARGET_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --exit-on-error \
  "$DUMP"

echo "Database restore completed. Run the repository migrations before switching traffic."
