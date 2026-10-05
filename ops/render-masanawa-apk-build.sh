#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE="${HOME}/.cache/masanawa-apk"
TOOLS="${CACHE}/tools"
ANDROID_HOME="${CACHE}/android-sdk"
ANDROID_SDK_ROOT="${ANDROID_HOME}"
FLUTTER_HOME="${TOOLS}/flutter"
JDK_HOME="${TOOLS}/jdk17"
ARTIFACT_DIR="${ROOT}/build-artifacts"
mkdir -p "${TOOLS}" "${ANDROID_HOME}/cmdline-tools" "${ARTIFACT_DIR}"

if [[ ! -x "${JDK_HOME}/bin/java" ]]; then
  mkdir -p "${JDK_HOME}"
  curl -fsSL --retry 3 --retry-delay 2 "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" -o "${CACHE}/jdk17.tar.gz"
  tar -xzf "${CACHE}/jdk17.tar.gz" -C "${JDK_HOME}" --strip-components=1
fi
if [[ ! -x "${FLUTTER_HOME}/bin/flutter" ]]; then
  git clone --depth 1 --branch stable https://github.com/flutter/flutter.git "${FLUTTER_HOME}"
fi
if [[ ! -x "${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager" ]]; then
  curl -fsSL --retry 3 --retry-delay 2 "https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip" -o "${CACHE}/android-tools.zip"
  rm -rf "${CACHE}/android-tools" "${ANDROID_HOME}/cmdline-tools/latest"
  mkdir -p "${CACHE}/android-tools"
  unzip -q "${CACHE}/android-tools.zip" -d "${CACHE}/android-tools"
  mv "${CACHE}/android-tools/cmdline-tools" "${ANDROID_HOME}/cmdline-tools/latest"
fi

export JAVA_HOME="${JDK_HOME}"
export ANDROID_HOME ANDROID_SDK_ROOT
export ANDROID_USER_HOME="${CACHE}/android-user-home"
export GRADLE_USER_HOME="${CACHE}/gradle-user-home"
export PATH="${FLUTTER_HOME}/bin:${JAVA_HOME}/bin:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"
mkdir -p "${ANDROID_USER_HOME}" "${GRADLE_USER_HOME}"
yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"

cd "${ROOT}/apps/mobile"
printf 'sdk.dir=%s\nflutter.sdk=%s\n' "${ANDROID_HOME}" "${FLUTTER_HOME}" > android/local.properties
flutter --version
flutter pub get
flutter analyze --no-fatal-infos --no-fatal-warnings
flutter test
flutter build apk --release --dart-define=API_BASE_URL=https://masanawa-gateway.onrender.com
APK="build/app/outputs/flutter-apk/app-release.apk"
test -s "${APK}"
cp "${APK}" "${ARTIFACT_DIR}/masanawa-billing-release.apk"
cp pubspec.lock "${ARTIFACT_DIR}/pubspec.lock"
(cd "${ARTIFACT_DIR}" && sha256sum masanawa-billing-release.apk > masanawa-billing-release.apk.sha256)
cat > "${ARTIFACT_DIR}/index.html" <<'HTML'
<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:680px;margin:40px auto;padding:16px"><h1>Masanawa billing APK</h1><p><a href="/masanawa-billing-release.apk">Download APK</a></p><p><a href="/masanawa-billing-release.apk.sha256">SHA-256</a></p></body></html>
HTML
cat "${ARTIFACT_DIR}/masanawa-billing-release.apk.sha256"
