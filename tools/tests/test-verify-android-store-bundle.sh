#!/usr/bin/env bash
# Hermetic release-verifier smoke tests using temporary signing identities.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
verify="$root/tools/verify-android-store-bundle.sh"
for command in keytool jarsigner jar unzip zip; do
  command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 69; }
done
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
printf 'test artifact\\n' > payload.txt
mkdir -p base/manifest
printf 'test manifest\\n' > base/manifest/AndroidManifest.xml
printf 'test bundle metadata\\n' > BundleConfig.pb
jar --create --file unsigned.aab payload.txt BundleConfig.pb base/manifest/AndroidManifest.xml

# Production-style upload key: locally generated test key, never committed.
keytool -genkeypair -alias release -keyalg RSA -keysize 2048 -validity 2 \
  -keystore release.p12 -storetype PKCS12 -storepass changeit -keypass changeit \
  -dname "CN=Masanawa Release Test, OU=Engineering, O=Masanawa, C=NG" -noprompt >/dev/null 2>&1
cp unsigned.aab signed.aab
jarsigner -keystore release.p12 -storetype PKCS12 -storepass changeit \
  -keypass changeit signed.aab release >/dev/null
fingerprint="$(keytool -list -v -keystore release.p12 -storepass changeit -alias release |
  grep -m1 'SHA256:' | sed -E 's/.*SHA256:[[:space:]]*//')"
bash "$verify" signed.aab "$fingerprint"

# A signed arbitrary JAR is not an Android App Bundle.
jar --create --file arbitrary.aab payload.txt
jarsigner -keystore release.p12 -storetype PKCS12 -storepass changeit \
  -keypass changeit arbitrary.aab release >/dev/null
if bash "$verify" arbitrary.aab "$fingerprint" >/dev/null 2>&1; then
  echo "FAIL: arbitrary signed JAR accepted as AAB" >&2; exit 1
fi

if bash "$verify" unsigned.aab "$fingerprint" >/dev/null 2>&1; then
  echo "FAIL: unsigned bundle accepted" >&2; exit 1
fi
if bash "$verify" signed.aab "00:00:00:00" >/dev/null 2>&1; then
  echo "FAIL: invalid fingerprint accepted" >&2; exit 1
fi
wrong="$(printf '%064d' 0)"
if bash "$verify" signed.aab "$wrong" >/dev/null 2>&1; then
  echo "FAIL: mismatched fingerprint accepted" >&2; exit 1
fi

# Replacing a signed entry invalidates its content digest.
cp signed.aab tampered.aab
printf 'tampered\n' > payload.txt
touch -d '+2 minutes' payload.txt
zip -q -u tampered.aab payload.txt
if bash "$verify" tampered.aab "$fingerprint" >/dev/null 2>&1; then
  echo "FAIL: modified signed bundle accepted" >&2; exit 1
fi

# Mixed-signature archives are not release artifacts even when their original
# payload and certificate remain valid.
cp signed.aab mixed.aab
printf 'extra unsigned payload\\n' > extra.txt
zip -q mixed.aab extra.txt
if bash "$verify" mixed.aab "$fingerprint" >/dev/null 2>&1; then
  echo "FAIL: mixed signed and unsigned entries accepted" >&2; exit 1
fi

# An additional signer must never extend authority beyond the pinned upload key.
keytool -genkeypair -alias second -keyalg RSA -keysize 2048 -validity 2 \
  -keystore second.p12 -storetype PKCS12 -storepass changeit -keypass changeit \
  -dname "CN=Other Release Signer, OU=Engineering, O=Masanawa, C=NG" -noprompt >/dev/null 2>&1
cp signed.aab dual-signed.aab
jarsigner -keystore second.p12 -storetype PKCS12 -storepass changeit \
  -keypass changeit dual-signed.aab second >/dev/null
if bash "$verify" dual-signed.aab "$fingerprint" >/dev/null 2>&1; then
  echo "FAIL: multiple signing identities accepted" >&2; exit 1
fi

keytool -genkeypair -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 2 \
  -keystore debug.p12 -storetype PKCS12 -storepass changeit -keypass changeit \
  -dname "CN=Android Debug, OU=Android, O=Android, C=US" -noprompt >/dev/null 2>&1
cp unsigned.aab debug.aab
jarsigner -keystore debug.p12 -storetype PKCS12 -storepass changeit \
  -keypass changeit debug.aab androiddebugkey >/dev/null
debugfingerprint="$(keytool -list -v -keystore debug.p12 -storepass changeit -alias androiddebugkey |
  grep -m1 'SHA256:' | sed -E 's/.*SHA256:[[:space:]]*//')"
if bash "$verify" debug.aab "$debugfingerprint" >/dev/null 2>&1; then
  echo "FAIL: Android debug signer accepted" >&2; exit 1
fi
echo "PASS: valid release, unsigned, wrong fingerprint, tampered artifact, mixed entries, non-AAB, multiple signers, debug signer"
