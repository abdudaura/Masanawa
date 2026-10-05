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
  echo "==> Downloading Temurin JDK 17"
  mkdir -p "${JDK_HOME}"
  curl -fsSL --retry 3 --retry-delay 2     "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"     -o "${CACHE}/jdk17.tar.gz"
  tar -xzf "${CACHE}/jdk17.tar.gz" -C "${JDK_HOME}" --strip-components=1
fi

if [[ ! -x "${FLUTTER_HOME}/bin/flutter" ]]; then
  echo "==> Cloning Flutter stable"
  rm -rf "${FLUTTER_HOME}"
  git clone --depth 1 --branch stable https://github.com/flutter/flutter.git "${FLUTTER_HOME}"
fi

ANDROID_COMMANDLINE_TOOLS="15859902"
if [[ ! -x "${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "==> Installing Android command-line tools"
  curl -fsSL --retry 3 --retry-delay 2     "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_COMMANDLINE_TOOLS}_latest.zip"     -o "${CACHE}/android-tools.zip"
  rm -rf "${ANDROID_HOME}/cmdline-tools/latest" "${CACHE}/android-tools"
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

echo "==> Installing Android SDK 37"
yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platform-tools" "platforms;android-37" "build-tools;37.0.0"

cd "${ROOT}/apps/mobile"
printf 'sdk.dir=%s\nflutter.sdk=%s\n' "${ANDROID_HOME}" "${FLUTTER_HOME}" > android/local.properties

echo "==> Flutter version"
flutter --version

echo "==> Installing Dart dependencies"
flutter pub get

echo "==> Analyzing mobile app"
flutter analyze

echo "==> Running Flutter tests"
flutter test

echo "==> Building release APK"
flutter build apk --release --dart-define=API_BASE_URL=https://masanawa-gateway.onrender.com

APK="build/app/outputs/flutter-apk/app-release.apk"
test -s "${APK}"
cp "${APK}" "${ARTIFACT_DIR}/masanawa-billing-release.apk"
(
  cd "${ARTIFACT_DIR}"
  sha256sum masanawa-billing-release.apk > masanawa-billing-release.apk.sha256
)

cat > "${ARTIFACT_DIR}/index.html" <<'HTML'
<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Masanawa APK</title></head>
<body style="font-family:system-ui,sans-serif;max-width:680px;margin:40px auto;padding:16px">
<h1>Masanawa billing validation APK</h1>
<p>Release APK built from work/billing-main-integration-20261005.</p>
<p><a href="/masanawa-billing-release.apk">Download APK</a></p>
<p><a href="/masanawa-billing-release.apk.sha256">SHA-256</a></p>
</body>
</html>
HTML

echo "==> APK ready"
cat "${ARTIFACT_DIR}/masanawa-billing-release.apk.sha256"
