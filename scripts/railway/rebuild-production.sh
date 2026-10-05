#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-masanawa}"
: "${RAILWAY_TOKEN:?RAILWAY_TOKEN is required}"

command -v railway >/dev/null || { echo "railway CLI is required" >&2; exit 69; }
command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 69; }

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SAFE_IAC="$ROOT/.railway/railway.ts"
REBUILD_IAC="$ROOT/.railway/rebuild.template.ts"
BACKUP_IAC="$(mktemp)"
cp "$SAFE_IAC" "$BACKUP_IAC"
cleanup() {
  cp "$BACKUP_IAC" "$SAFE_IAC" 2>/dev/null || true
  rm -f "$BACKUP_IAC"
}
trap cleanup EXIT

if ! railway status --json >/dev/null 2>&1; then
  railway init --name "$PROJECT_NAME"
fi

DB_PASSWORD="$(openssl rand -hex 32)"
node - "$REBUILD_IAC" "$SAFE_IAC" "$DB_PASSWORD" <<'NODE'
import { readFile, writeFile } from "node:fs/promises";
const [templatePath, targetPath, password] = process.argv.slice(2);
const template = await readFile(templatePath, "utf8");
if (!template.includes("__MASANAWA_DB_PASSWORD__")) {
  throw new Error("Railway rebuild template is missing DB password placeholder");
}
await writeFile(
  targetPath,
  template.replaceAll("__MASANAWA_DB_PASSWORD__", password),
  { mode: 0o600 },
);
NODE
unset DB_PASSWORD

set +e
railway config plan --detailed-exit-code
PLAN_STATUS=$?
set -e
if [[ "$PLAN_STATUS" -ne 0 && "$PLAN_STATUS" -ne 2 ]]; then
  echo "Railway IaC plan failed" >&2
  exit "$PLAN_STATUS"
fi
if [[ "$PLAN_STATUS" -eq 2 ]]; then
  railway config apply --yes
fi

set_secret() {
  local service="$1"
  local key="$2"
  local value="${!key:-}"
  [[ -n "$value" ]] || { echo "missing required portable secret: $key" >&2; exit 1; }
  railway variable set "$key=$value" --service "$service" >/dev/null
}

# Shared runtime cryptography.
for service in masanawa-gateway masanawa-worker masanawa-ops; do
  set_secret "$service" CREDENTIAL_ENCRYPTION_KEY
done

# Provider/billing/messaging credentials belong to the worker until those
# capabilities are split into dedicated main-branch services.
for key in \
  AGENT_TOKEN \
  CALL_GATEWAY_TOKEN \
  FLUTTERWAVE_ENCRYPTION_KEY \
  FLUTTERWAVE_OPERATOR_TEST_TOKEN \
  FLUTTERWAVE_PUBLIC_KEY \
  FLUTTERWAVE_SECRET_KEY \
  FLUTTERWAVE_WEBHOOK_SECRET_HASH \
  MASANAWA_AUTH_OTP_PEPPER \
  MASANAWA_BILLING_ACTION_SECRET \
  MASANAWA_FLUTTERWAVE_RELAY_TOKEN \
  NOWPAYMENTS_API_KEY \
  NOWPAYMENTS_IPN_SECRET \
  NOWPAYMENTS_PAYOUT_EMAIL \
  NOWPAYMENTS_PAYOUT_PASSWORD \
  RESEND_API_KEY \
  SUPABASE_SERVICE_ROLE_KEY \
  SUPABASE_URL \
  WPP_SESSION
do
  set_secret masanawa-worker "$key"
done

# Gemini credential pool is needed by agent/live-audio execution. Production
# Gateway uses the canonical name; worker compatibility may keep its own
# provider-specific import contract independently.
set_secret masanawa-gateway MASANAWA_GEMINI_CREDENTIALS_JSON

for service in masanawa-gateway masanawa-worker masanawa-ops; do
  railway variable set \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    --service "$service" >/dev/null
done

railway variable set \
  MASANAWA_PUBLIC_BASE_URL=https://api.masanawa.com \
  --service masanawa-worker >/dev/null

# Production auth derives the tenant from PostgreSQL automatically when exactly
# one active tenant exists. Multi-tenant deployments can still set
# MASANAWA_PLATFORM_TENANT_ID explicitly.
railway variable set \
  MASANAWA_PLATFORM_AUTH_BASE_URL=https://api.masanawa.com \
  MASANAWA_PLATFORM_AUTH_POLICY_REVISION=mobile-platform-session-v1 \
  --service masanawa-gateway >/dev/null

echo "Railway reconstruction completed from repository contracts."
