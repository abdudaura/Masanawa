#!/usr/bin/env bash
set -euo pipefail

GATEWAY_URL="${AGENT_BASE_URL:-http://127.0.0.1:3000}"
ALPHA_TOKEN="${ALPHA_DEV_ACCESS_TOKEN:-}"

if [[ -z "$ALPHA_TOKEN" ]]; then
  echo "Set ALPHA_DEV_ACCESS_TOKEN before running this script." >&2
  exit 1
fi

cd "$(dirname "$0")/.."

flutter pub get
flutter build apk --debug \
  --dart-define=AGENT_RUNTIME_ENABLED=true \
  --dart-define=AGENT_BASE_URL="$GATEWAY_URL" \
  --dart-define=ALPHA_DEV_ACCESS_TOKEN="$ALPHA_TOKEN" \
  --dart-define=ALPHA_TTS_ENABLED=true

APK="$PWD/build/app/outputs/flutter-apk/app-debug.apk"
echo
echo "Alpha APK: $APK"

if [[ "${1:-}" == "--install" ]]; then
  adb reverse tcp:3000 tcp:3000
  adb install -r "$APK"
  echo
  echo "Installed. USB reverse maps the phone to the laptop Gateway on port 3000."
fi
