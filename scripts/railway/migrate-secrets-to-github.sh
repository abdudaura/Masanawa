#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-Baatiku/masanawa}"
ENVIRONMENT="${2:-production}"
SERVICES=(${MASANAWA_SECRET_SOURCE_SERVICES:-"@nurain/worker @nurain/call-gateway @nurain/dashboard masanawa-gateway"})

command -v railway >/dev/null || { echo "railway CLI is required" >&2; exit 69; }
command -v gh >/dev/null || { echo "GitHub CLI (gh) is required" >&2; exit 69; }
command -v node >/dev/null || { echo "Node.js is required" >&2; exit 69; }

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MANIFEST="$ROOT/infra/portable/secrets.manifest.json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for service in "${SERVICES[@]}"; do
  railway variable list --service "$service" --json > "$TMP/${service//[^a-zA-Z0-9]/_}.json" 2>/dev/null || true
done

node - "$MANIFEST" "$TMP" "$REPO" "$ENVIRONMENT" <<'NODE'
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const [manifestPath, tempDir, repo, environment] = process.argv.slice(2);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const files = await readdir(tempDir);
const values = new Map();

function absorb(value) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) absorb(item);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && manifest.providerIndependentSecrets.includes(key)) {
      if (!values.has(key) && item) values.set(key, item);
    } else if (item && typeof item === "object") {
      absorb(item);
    }
  }
}

for (const file of files) {
  try {
    absorb(JSON.parse(await readFile(`${tempDir}/${file}`, "utf8")));
  } catch {}
}

const missing = [];
for (const key of manifest.providerIndependentSecrets) {
  const value = values.get(key);
  if (!value) {
    missing.push(key);
    continue;
  }
  const result = spawnSync(
    "gh",
    ["secret", "set", key, "--repo", repo, "--env", environment, "--body", value],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  process.stdout.write(`stored ${key} in GitHub ${environment} secrets\n`);
}

if (missing.length) {
  process.stderr.write(
    `No current Railway value found for: ${missing.join(", ")}\n` +
      "Add only the genuinely required missing credentials before relying on automated rebuilds.\n",
  );
  process.exitCode = 2;
}
NODE
