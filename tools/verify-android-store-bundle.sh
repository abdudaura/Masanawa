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
command -v jar >/dev/null || { echo "Missing JDK jar" >&2; exit 69; }
# A successfully signed arbitrary JAR is not necessarily an Android App Bundle.
# Bundletool remains the final structural validator, but require core AAB entries.
entries="$(jar tf "$artifact" 2>/dev/null)" || {
  echo "Not a readable Android App Bundle ZIP" >&2
  exit 1
}
for required in "BundleConfig.pb" "base/manifest/AndroidManifest.xml"; do
  if ! grep -Fxq "$required" <<<"$entries"; then
    echo "Bundle is missing required AAB entry: $required" >&2
    exit 1
  fi
done

# An unsigned bundle or a tampered entry must fail verification.
verification="$(jarsigner -verify -verbose "$artifact" 2>&1)" || {
  echo "Bundle signature verification failed" >&2
  exit 1
}
# jarsigner can return zero for an unsigned jar; require positive verification.
if ! grep -qi 'jar verified' <<<"$verification"; then
  echo "Bundle is unsigned or was not verified" >&2
  exit 1
fi
# jarsigner permits mixed signed/unsigned archives by default. A release AAB
# must not contain any unsigned payload entries (except unsigned META-INF
# manifest/signature bookkeeping).
if grep -Eiq 'contains unsigned entries|unsigned entries which have not been integrity-checked' <<<"$verification"; then
  echo "Bundle contains unsigned payload entries" >&2
  exit 1
fi
certificate="$(keytool -printcert -jarfile "$artifact" 2>&1)" || {
  echo "Cannot read signed bundle certificate" >&2
  exit 1
}
# Every payload must be signed by one explicitly pinned upload identity.
# Multiple signers can leave a valid signature with additional unpinned authority.
signerCount="$(grep -Ec '^Signer #[0-9]+:' <<<"$certificate" || true)"
if [[ "$signerCount" != "1" ]]; then
  echo "Bundle must have exactly one signing identity (found $signerCount)" >&2
  exit 1
fi
if grep -Eiq 'CN=Android Debug([,[:space:]]|$)' <<<"$certificate"; then
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
