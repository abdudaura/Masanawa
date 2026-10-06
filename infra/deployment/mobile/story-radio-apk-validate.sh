#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
source <(awk '/^CACHE_DIR=/ { emit=1 } /^# Install Node 24 only inside this isolated validation container\./ { exit } emit { print }' "$ROOT_DIR/infra/deployment/mobile/build.sh")

flutter config --no-analytics
set +o pipefail
yes | sdkmanager --licenses >/dev/null
license_status=${PIPESTATUS[1]}
set -o pipefail
[[ "$license_status" -eq 0 ]]
sdkmanager "platform-tools" "platforms;android-37.0" "build-tools;36.0.0" "ndk;28.2.13676358"

# Railway production validator is capped at 1 GB. Keep Gradle/Kotlin in-process
# and leave headroom for Flutter's AOT compiler and Android packaging.
cat > "$GRADLE_USER_HOME/gradle.properties" <<'PROPERTIES'
org.gradle.daemon=false
org.gradle.workers.max=1
org.gradle.parallel=false
org.gradle.vfs.watch=false
org.gradle.logging.stacktrace=all
org.gradle.jvmargs=-Xmx352m -XX:MaxMetaspaceSize=256m -XX:ReservedCodeCacheSize=24m -Dfile.encoding=UTF-8
kotlin.compiler.execution.strategy=in-process
kotlin.daemon.jvm.options=-Xmx96m
PROPERTIES
export GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.workers.max=1 -Dorg.gradle.parallel=false -Dorg.gradle.vfs.watch=false"

cd "$ROOT_DIR/apps/mobile"
flutter pub get
flutter build apk --release \
  --dart-define=API_BASE_URL="https://masanawa-gateway-production.up.railway.app" \
  --dart-define=AGENT_BASE_URL="https://masanawa-gateway-production.up.railway.app"
test -s build/app/outputs/flutter-apk/app-release.apk
sha256sum build/app/outputs/flutter-apk/app-release.apk
echo "STORY_RADIO_APK_BUILD_OK build/app/outputs/flutter-apk/app-release.apk"
