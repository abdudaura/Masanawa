#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-}"
if [[ -z "$OUT" ]]; then
  echo "usage: DATABASE_URL=postgresql://... $0 <output.dump>" >&2
  exit 64
fi
: "${DATABASE_URL:?DATABASE_URL is required}"

mkdir -p "$(dirname "$OUT")"
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-acl \
  --file="$OUT"

echo "Database export written to $OUT"
