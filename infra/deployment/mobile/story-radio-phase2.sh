#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
source <(awk '/^# Install Node 24 only inside this isolated validation container\./ { exit } { print }' "$ROOT_DIR/infra/deployment/mobile/build.sh")

flutter config --no-analytics
set +o pipefail
yes | sdkmanager --licenses >/dev/null
license_status=${PIPESTATUS[1]}
set -o pipefail
[[ "$license_status" -eq 0 ]]
sdkmanager "platform-tools" "platforms;android-37.0" "build-tools;36.0.0"

cd "$ROOT_DIR/apps/admin_mobile"
flutter pub get
flutter test --concurrency=1 --reporter=expanded --timeout=2m test/story_radio_admin_api_test.dart

cd "$ROOT_DIR/apps/mobile"
flutter pub get
flutter build apk --release --dart-define=API_BASE_URL="https://masanawa-gateway-production.up.railway.app" --dart-define=AGENT_BASE_URL="https://masanawa-gateway-production.up.railway.app"
echo "STORY_RADIO_PHASE2_APK_OK build/app/outputs/flutter-apk/app-release.apk"
