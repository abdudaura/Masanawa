#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-empowering-education}"
: "${RAILWAY_TOKEN:?RAILWAY_TOKEN is required}"

# This script intentionally owns only reconstructible infrastructure.
# It must never contain plaintext application secrets.
if ! railway status --json >/dev/null 2>&1; then
  railway init --name "$PROJECT_NAME"
fi

# Deploy the repo first. Railway creates/links the app service in the selected project.
railway up -y --detach

# Secret values come from GitHub Environment secrets, not from this file.
for key in \
  CREDENTIAL_ENCRYPTION_KEY \
  FLUTTERWAVE_ENCRYPTION_KEY \
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
  value="${!key:-}"
  [[ -n "$value" ]] || { echo "missing required secret: $key" >&2; exit 1; }
  railway variable set "$key=$value"
done

railway variable set \
  NODE_ENV=production \
  MASANAWA_PUBLIC_BASE_URL=https://api.masanawa.com \
  MASANAWA_PLATFORM_AUTH_BASE_URL=https://api.masanawa.com \
  MASANAWA_PLATFORM_AUTH_POLICY_REVISION=mobile-platform-session-v1

echo "Base runtime reconstructed. Database provisioning/restoration and custom-domain attachment remain explicit provider operations; application code continues to use only *.masanawa.com endpoints."
