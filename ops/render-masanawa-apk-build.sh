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
API_BASE_URL="https://masanawa-gateway-production.up.railway.app"
mkdir -p "${TOOLS}" "${ANDROID_HOME}/cmdline-tools" "${ARTIFACT_DIR}"

echo "==> Full workspace gate"
cd "${ROOT}"
npx -y pnpm@12.8.2 install --frozen-lockfile
npx -y pnpm@12.8.2 typecheck
rm -rf apps/ops/.next apps/web/.next
npx -y pnpm@12.8.2 test:ci
npx -y pnpm@12.8.2 build

echo "==> Production Gateway smoke"
curl -fsS "${API_BASE_URL}/healthz" | tee /tmp/masanawa-healthz.json
echo
curl -fsS "${API_BASE_URL}/readyz" | tee /tmp/masanawa-readyz.json
echo
curl -fsS "${API_BASE_URL}/auth/capabilities" | tee /tmp/masanawa-auth-capabilities.json
echo
for path in /agent/directory /creator/onboarding /offers /v1/financial/capabilities /v1/financial/crypto/routes; do
  code="$(curl -sS -o /tmp/masanawa-route-body -w '%{http_code}' "${API_BASE_URL}${path}")"
  echo "${path} -> ${code}"
  test "${code}" != "000"
  test "${code}" != "404"
done

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
sdkmanager "platform-tools" "platforms;android-36" "platforms;android-37.0" "build-tools;36.0.0"
if [[ -d "${ANDROID_HOME}/platforms/android-37.0" && ! -e "${ANDROID_HOME}/platforms/android-37" ]]; then
  ln -s "${ANDROID_HOME}/platforms/android-37.0" "${ANDROID_HOME}/platforms/android-37"
fi
NDK_VERSION="28.2.13676358"
NDK_DIR="${ANDROID_HOME}/ndk/${NDK_VERSION}"
if [[ ! -x "${NDK_DIR}/ndk-build" ]]; then
  rm -rf "${NDK_DIR}" "${CACHE}/ndk-r28c" "${CACHE}/android-ndk-r28c-linux.zip"
  curl -fL --retry 5 --retry-all-errors --retry-delay 3 "https://dl.google.com/android/repository/android-ndk-r28c-linux.zip" -o "${CACHE}/android-ndk-r28c-linux.zip"
  unzip -q -t "${CACHE}/android-ndk-r28c-linux.zip"
  mkdir -p "${CACHE}/ndk-r28c" "${ANDROID_HOME}/ndk"
  unzip -q "${CACHE}/android-ndk-r28c-linux.zip" -d "${CACHE}/ndk-r28c"
  mv "${CACHE}/ndk-r28c/android-ndk-r28c" "${NDK_DIR}"
  test -x "${NDK_DIR}/ndk-build"
fi
cd "${ROOT}/apps/mobile"
printf 'sdk.dir=%s\nflutter.sdk=%s\n' "${ANDROID_HOME}" "${FLUTTER_HOME}" > android/local.properties
flutter --version
flutter pub get
flutter analyze --no-fatal-infos --no-fatal-warnings
flutter test
flutter build apk --release --dart-define=API_BASE_URL="${API_BASE_URL}" --dart-define=AGENT_BASE_URL="${API_BASE_URL}"
APK="build/app/outputs/flutter-apk/app-release.apk"
test -s "${APK}"
cp "${APK}" "${ARTIFACT_DIR}/masanawa-production-release.apk"
cp pubspec.lock "${ARTIFACT_DIR}/pubspec.lock"
(cd "${ARTIFACT_DIR}" && sha256sum masanawa-production-release.apk > masanawa-production-release.apk.sha256)
cat > "${ARTIFACT_DIR}/index.html" <<'HTML'
<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:680px;margin:40px auto;padding:16px"><h1>Masanawa production APK</h1><p><a href="/masanawa-production-release.apk">Download APK</a></p><p><a href="/masanawa-production-release.apk.sha256">SHA-256</a></p></body></html>
HTML
cat "${ARTIFACT_DIR}/masanawa-production-release.apk.sha256"
