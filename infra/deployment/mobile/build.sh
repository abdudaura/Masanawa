#!/usr/bin/env bash
set -euo pipefail
# Does not seed the database or publish credentials. All build inputs are supplied by hosting.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CACHE_DIR="${XDG_CACHE_HOME:-${HOME}/.cache}/masanawa-apk"
ARTIFACT_DIR="${ROOT_DIR}/build-artifacts/mobile"
export ANDROID_HOME="${CACHE_DIR}/android-sdk"
export ANDROID_SDK_ROOT="${ANDROID_HOME}"
mkdir -p "$CACHE_DIR" "$ARTIFACT_DIR" "$ANDROID_HOME/cmdline-tools"
API_BASE_URL="https://masanawa-gateway-production.up.railway.app"
if ! command -v java >/dev/null; then
  mkdir -p "$CACHE_DIR/jdk17"
  curl -fsSL --retry 2 https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse -o "$CACHE_DIR/jdk17.tar.gz"
  tar -xzf "$CACHE_DIR/jdk17.tar.gz" -C "$CACHE_DIR/jdk17" --strip-components=1
  export JAVA_HOME="$CACHE_DIR/jdk17"
  export PATH="$JAVA_HOME/bin:$PATH"
fi
# Select an official stable archive and verify its SHA-256 from the official manifest.
if [[ ! -x "$CACHE_DIR/flutter/bin/flutter" ]]; then
  curl -fsSL --retry 2 https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json -o "$CACHE_DIR/releases.json"
  python3 - "$CACHE_DIR" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1]); data = json.loads((root / 'releases.json').read_text())
release = next(r for r in data['releases'] if r['hash'] == data['current_release']['stable'] and r.get('dart_sdk_arch', 'x64') == 'x64')
url = data['base_url'].rstrip('/') + '/' + release['archive']
if not url.startswith('https://storage.googleapis.com/flutter_infra_release/'):
    raise SystemExit('Unexpected Flutter archive origin')
(root / 'flutter-url').write_text(url)
(root / 'flutter.sha256').write_text(release['sha256'] + '  ' + str(root / 'flutter.tar.xz') + '\n')
PY
  curl -fsSL --retry 2 "$(cat "$CACHE_DIR/flutter-url")" -o "$CACHE_DIR/flutter.tar.xz"
  sha256sum -c "$CACHE_DIR/flutter.sha256"
  tar --no-same-owner -xf "$CACHE_DIR/flutter.tar.xz" -C "$CACHE_DIR"
fi
if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  curl -fsSL --retry 2 https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip -o "$CACHE_DIR/android-tools.zip"
  echo "4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583  $CACHE_DIR/android-tools.zip" | sha256sum -c -
  mkdir -p "$CACHE_DIR/android-tools"
  unzip -q "$CACHE_DIR/android-tools.zip" -d "$CACHE_DIR/android-tools"
  mv "$CACHE_DIR/android-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi
export PATH="$CACHE_DIR/flutter/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
export GRADLE_USER_HOME="$CACHE_DIR/gradle"
# Small hosted builders need a single JVM/worker; do not inherit the template's
# 8 GB heap or spawn a second Kotlin compiler daemon.
mkdir -p "$GRADLE_USER_HOME"
cat > "$GRADLE_USER_HOME/gradle.properties" <<'PROPERTIES'
org.gradle.daemon=false
org.gradle.workers.max=1
org.gradle.parallel=false
org.gradle.logging.stacktrace=all
org.gradle.jvmargs=-Xmx384m -XX:MaxMetaspaceSize=320m -XX:ReservedCodeCacheSize=48m -Dfile.encoding=UTF-8
kotlin.compiler.execution.strategy=in-process
PROPERTIES
export GRADLE_OPTS="-Dorg.gradle.daemon=false -Dorg.gradle.workers.max=1 -Dorg.gradle.parallel=false"
python3 - <<'PY'
from pathlib import Path
for file in ('/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes'):
    path = Path(file)
    if path.is_file():
        value = path.read_text().strip()
        print('APK builder cgroup memory limit: ' + value, flush=True)
        break
PY
# Install Node 24 only inside this isolated validation container.
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]]; then
  NODE_DIR="$CACHE_DIR/node24"
  mkdir -p "$NODE_DIR"
  curl -fsSL --retry 2 https://nodejs.org/dist/index.json -o "$CACHE_DIR/node-index.json"
  python3 - "$CACHE_DIR" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
releases = json.loads((root / 'node-index.json').read_text())
release = next(r for r in releases if r['version'].startswith('v24.') and 'linux-x64' in r.get('files', []))
version = release['version']
(root / 'node-version').write_text(version)
PY
  NODE_VERSION="$(cat "$CACHE_DIR/node-version")"
  curl -fsSL --retry 2 "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz" -o "$CACHE_DIR/node.tar.xz"
  curl -fsSL --retry 2 "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$CACHE_DIR/node-SHASUMS256.txt"
  grep " node-$NODE_VERSION-linux-x64.tar.xz$" "$CACHE_DIR/node-SHASUMS256.txt" | sed "s#  node-$NODE_VERSION-linux-x64.tar.xz#  $CACHE_DIR/node.tar.xz#" | sha256sum -c -
  rm -rf "$NODE_DIR"/*
  tar --no-same-owner -xf "$CACHE_DIR/node.tar.xz" -C "$NODE_DIR" --strip-components=1
  export PATH="$NODE_DIR/bin:$PATH"
fi

cd "$ROOT_DIR"
npx -y pnpm@12.8.2 install --frozen-lockfile
npx -y pnpm@12.8.2 exec tsc -p packages/content/tsconfig.json
npx -y pnpm@12.8.2 exec tsc -p adapters/storage/postgres/tsconfig.json
npx -y pnpm@12.8.2 exec tsc -p services/gateway/tsconfig.json
npx -y pnpm@12.8.2 exec vitest run \
  packages/content/src/index.test.ts \
  services/gateway/src/story_radio.test.ts \
  services/gateway/src/story_radio_routes.test.ts \
  test/architecture/package-boundaries.test.ts

flutter config --no-analytics
# Avoid masking license/setup failures (yes may exit with SIGPIPE after sdkmanager exits).
set +o pipefail
yes | sdkmanager --licenses >/dev/null
license_status=${PIPESTATUS[1]}
set -o pipefail
[[ "$license_status" -eq 0 ]]
sdkmanager "platform-tools" "platforms;android-37.0" "build-tools;36.0.0"
cd "$ROOT_DIR/apps/mobile"
flutter pub get
echo "Skipping full flutter analyze in 1 GB Railway verifier; focused tests + release compiler are the acceptance gates."
timeout --signal=TERM --kill-after=30s 12m flutter test --concurrency=1 --reporter=expanded --timeout=2m \
  test/home/home_continuation_test.dart \
  test/story_radio/story_radio_model_test.dart \
  test/story_radio/story_radio_state_test.dart \
  test/story_radio/story_radio_http_transport_test.dart \
  test/twin_home_shell_test.dart \
  test/twin_production_integration_test.dart

cd "$ROOT_DIR/apps/admin_mobile"
flutter pub get
timeout --signal=TERM --kill-after=30s 6m flutter test --concurrency=1 --reporter=expanded --timeout=2m \
  test/story_radio_admin_api_test.dart

cd "$ROOT_DIR/apps/mobile"
flutter build apk --release --dart-define=API_BASE_URL="$API_BASE_URL" --dart-define=AGENT_BASE_URL="$API_BASE_URL"
cp build/app/outputs/flutter-apk/app-release.apk "$ARTIFACT_DIR/masanawa-production-release.apk"
(cd "$ARTIFACT_DIR" && sha256sum masanawa-production-release.apk > masanawa-production-release.apk.sha256)
python3 - "$ARTIFACT_DIR" <<'PY'
import hashlib, json, os, pathlib, re, subprocess, sys
root = pathlib.Path(sys.argv[1]); apk = root / 'masanawa-production-release.apk'
commit = os.environ.get('MASANAWA_APK_SOURCE_COMMIT') or os.environ.get('RAILWAY_GIT_COMMIT_SHA')
if not commit:
    commit = subprocess.check_output(['git','rev-parse','HEAD'], text=True).strip()
if not re.fullmatch(r'[0-9a-f]{40}', commit):
    raise SystemExit('An exact 40-character source commit is required for APK provenance')
manifest = {'schemaVersion': 1, 'commit': commit,
 'gatewayUrl': 'https://masanawa-gateway-production.up.railway.app', 'byteLength': apk.stat().st_size,
 'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'flutterAnalyze': 'release-compiler-gate', 'flutterTest': 'story-radio-focused-passed', 'apkBuild': 'passed'}
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
PY
