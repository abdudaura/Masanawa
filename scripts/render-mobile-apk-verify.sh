#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
CACHE="$HOME/.masanawa-apk-toolchain"
mkdir -p "$CACHE"

export JAVA_HOME="${JAVA_HOME:-}"
if ! command -v java >/dev/null 2>&1; then
  mkdir -p "$CACHE/jdk"
  curl -fL --retry 4 --retry-delay 2 \
    "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" \
    -o "$CACHE/jdk.tar.gz"
  tar -xzf "$CACHE/jdk.tar.gz" -C "$CACHE/jdk" --strip-components=1
  export JAVA_HOME="$CACHE/jdk"
  export PATH="$JAVA_HOME/bin:$PATH"
fi
java -version

if [ ! -x "$CACHE/flutter/bin/flutter" ]; then
  rm -rf "$CACHE/flutter"
  git clone --depth 1 --branch stable https://github.com/flutter/flutter.git "$CACHE/flutter"
fi
export PATH="$CACHE/flutter/bin:$PATH"
flutter --version

export ANDROID_HOME="$CACHE/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
mkdir -p "$ANDROID_HOME/cmdline-tools"
if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  curl -fL --retry 4 --retry-delay 2 \
    "https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip" \
    -o "$CACHE/android-commandline.zip"
  rm -rf "$CACHE/android-cmdline-unpack" "$ANDROID_HOME/cmdline-tools/latest"
  mkdir -p "$CACHE/android-cmdline-unpack" "$ANDROID_HOME/cmdline-tools/latest"
  unzip -q "$CACHE/android-commandline.zip" -d "$CACHE/android-cmdline-unpack"
  mv "$CACHE/android-cmdline-unpack/cmdline-tools/"* "$ANDROID_HOME/cmdline-tools/latest/"
fi
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platform-tools" "platforms;android-37" "build-tools;37.0.0"
flutter config --android-sdk "$ANDROID_HOME"

API_BASE_URL="https://masanawa-gateway-production.up.railway.app"
AGENT_BASE_URL="$API_BASE_URL"

echo "== Production Gateway smoke =="
curl -fsS "$API_BASE_URL/readyz" | tee /tmp/masanawa-readyz.json
echo
curl -fsS "$API_BASE_URL/auth/capabilities" | tee /tmp/masanawa-auth-capabilities.json
echo
for path in \
  /agent/directory \
  /creator/onboarding \
  /offers \
  /v1/financial/capabilities \
  /v1/financial/crypto/routes; do
  code="$(curl -sS -o /tmp/masanawa-route-body -w '%{http_code}' "$API_BASE_URL$path")"
  echo "$path -> $code"
  test "$code" != "000"
  test "$code" != "404"
done

cd "$ROOT/apps/mobile"
flutter pub get
flutter analyze
flutter test

flutter build apk --release \
  --dart-define=API_BASE_URL="$API_BASE_URL" \
  --dart-define=AGENT_BASE_URL="$AGENT_BASE_URL"

APK="build/app/outputs/flutter-apk/app-release.apk"
test -s "$APK"
mkdir -p apk-output
cp "$APK" apk-output/masanawa-production.apk
sha256sum "$APK" | sed 's#  .*#  masanawa-production.apk#' | tee apk-output/masanawa-production.sha256
printf '%s\n' '<!doctype html><meta charset="utf-8"><title>Masanawa production APK</title><h1>Masanawa production APK</h1><p>Release-mode verification artifact; see SHA-256 alongside it.</p><a href="masanawa-production.apk">Download APK</a><br><a href="masanawa-production.sha256">SHA-256</a>' > apk-output/index.html
