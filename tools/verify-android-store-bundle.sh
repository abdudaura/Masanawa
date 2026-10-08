#!/usr/bin/env bash
# Verify a signed Android App Bundle before submitting it to a store.
# Usage: bash tools/verify-android-store-bundle.sh path/to/app-release.aab [expected-sha256-fingerprint]
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 app-release.aab [expected SHA-256 certificate fingerprint]" >&2
  exit 64
fi
artifact="$1"
expected="${2:-${MASANAWA_RELEASE_CERT_SHA256:-}}"
[[ -f "$artifact" ]] || { echo "Bundle not found: $artifact" >&2; exit 66; }
command -v jarsigner >/dev/null || { echo "Missing JDK jarsigner" >&2; exit 69; }
command -v keytool >/dev/null || { echo "Missing JDK keytool" >&2; exit 69; }

# An unsigned bundle or a tampered entry must fail verification.
jarsigner -verify -strict "$artifact" >/dev/null || {
  echo "Bundle signature verification failed" >&2
  exit 1
}
certificate="$(keytool -printcert -jarfile "$artifact" 2>&1)" || {
  echo "Cannot read signed bundle certificate" >&2
  exit 1
}
if grep -Eiq 'CN=Android Debug|OU=Android|O=Android' <<<"$certificate"; then
  echo "Refusing Android debug signing certificate" >&2
  exit 1
fi
actual="$(grep -im1 'SHA256:' <<<"$certificate" | sed -E 's/.*SHA256:[[:space:]]*//; s/[^0-9A-Fa-f:]//g' | tr '[:lower:]' '[:upper:]' | tr -d ':')"
[[ "$actual" =~ ^[0-9A-F]{64}$ ]] || {
  echo "Could not extract certificate SHA-256 fingerprint" >&2
  exit 1
}
if [[ -z "$expected" ]]; then
  echo "Expected store certificate fingerprint is required (argument or MASANAWA_RELEASE_CERT_SHA256)" >&2
  exit 64
fi
normalized="$(tr '[:lower:]' '[:upper:]' <<<"$expected" | tr -d ':[:space:]')"
[[ "$normalized" =~ ^[0-9A-F]{64}$ ]] || {
  echo "Invalid expected certificate fingerprint" >&2
  exit 64
}
[[ "$actual" == "$normalized" ]] || {
  echo "Bundle signing certificate does not match the expected release certificate" >&2
  exit 1
}
echo "Verified: signed bundle matches pinned release certificate SHA-256."
