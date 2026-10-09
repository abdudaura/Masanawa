import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { checkFirebaseContinuity } from './check.mjs';

const files = {
  'apps/mobile/android/app/build.gradle.kts': 'plugins { id("com.android.application"); id("com.google.gms.google-services") }\nandroid { defaultConfig { applicationId = "com.masanawa.app" } }',
  'apps/mobile/android/settings.gradle.kts': 'plugins { id("com.google.gms.google-services") version "4.5.0" apply false }',
  'apps/mobile/android/app/src/main/AndroidManifest.xml': '<manifest><uses-permission android:name="android.permission.POST_NOTIFICATIONS"/><application android:allowBackup="false"/></manifest>',
  'apps/mobile/pubspec.yaml': 'dependencies:\n  firebase_core: ^4.0.0\n  firebase_messaging: ^16.0.0\n',
  'scripts/qualify-first10-android.ps1': '$FirebaseDefinesFile = $args[0]; flutter build apk --dart-define-from-file $FirebaseDefinesFile',
  'apps/mobile/android/app/google-services.json': JSON.stringify({ project_info: { project_id: 'synthetic-project', project_number: '1234567' }, client: [{ client_info: { android_client_info: { package_name: 'com.masanawa.app' }, mobilesdk_app_id: '1:1234567:android:sample' }, api_key: [{ current_key: 'synthetic-public-key' }] }] }),
  'apps/mobile/ios/Runner/GoogleService-Info.plist': '<?xml version="1.0"?><plist><dict><key>PROJECT_ID</key><string>synthetic-project</string><key>GCM_SENDER_ID</key><string>1234567</string><key>BUNDLE_ID</key><string>com.masanawa.app</string><key>GOOGLE_APP_ID</key><string>1:1234567:ios:sample</string><key>API_KEY</key><string>synthetic-public-key</string></dict></plist>',
};

function fixture(changes = {}) {
  const root = mkdtempSync(join(tmpdir(), 'masanawa-firebase-guard-'));
  for (const [path, content] of Object.entries({ ...files, ...changes })) {
    if (content === null) continue;
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return { root, clean: () => rmSync(root, { recursive: true, force: true }) };
}
function assertCode(changes, code) {
  const f = fixture(changes);
  try {
    const result = checkFirebaseContinuity(f.root);
    assert.equal(result.ok, false);
    assert(result.codes.some(x => x.startsWith(code + ':')), JSON.stringify(result.codes));
    assert(!JSON.stringify(result).includes('synthetic-public-key'), 'No credential values in output');
  } finally { f.clean(); }
}
test('valid app configs, dependencies and build-define handoff pass', () => {
  const f = fixture();
  try { assert.deepEqual(checkFirebaseContinuity(f.root), { ok: true, codes: [], checked: 7 }); }
  finally { f.clean(); }
});
test('missing Android config fails closed', () => assertCode({ 'apps/mobile/android/app/google-services.json': null }, 'missing'));
test('missing iOS config fails closed', () => assertCode({ 'apps/mobile/ios/Runner/GoogleService-Info.plist': null }, 'missing'));
test('malformed Android JSON fails closed', () => assertCode({ 'apps/mobile/android/app/google-services.json': '{' }, 'invalid-json'));
test('malformed iOS plist fails closed', () => assertCode({ 'apps/mobile/ios/Runner/GoogleService-Info.plist': 'not a plist' }, 'invalid-plist'));
test('wrong package in build cannot pass', () => assertCode({ 'apps/mobile/android/app/build.gradle.kts': files['apps/mobile/android/app/build.gradle.kts'].replace('applicationId = "com.masanawa.app"', 'applicationId = "wrong.app"') }, 'android-package'));
test('unregistered Android Firebase client cannot pass', () => assertCode({ 'apps/mobile/android/app/google-services.json': files['apps/mobile/android/app/google-services.json'].replace('com.masanawa.app', 'wrong.app') }, 'android-client'));
test('project mixup across platforms cannot pass', () => assertCode({ 'apps/mobile/ios/Runner/GoogleService-Info.plist': files['apps/mobile/ios/Runner/GoogleService-Info.plist'].replace('synthetic-project', 'different-project') }, 'project-mismatch'));
test('FCM sender mismatch cannot pass', () => assertCode({ 'apps/mobile/ios/Runner/GoogleService-Info.plist': files['apps/mobile/ios/Runner/GoogleService-Info.plist'].replace('1234567</string>', '99999</string>') }, 'sender-mismatch'));
test('wrong iOS bundle cannot pass', () => assertCode({ 'apps/mobile/ios/Runner/GoogleService-Info.plist': files['apps/mobile/ios/Runner/GoogleService-Info.plist'].replace('com.masanawa.app', 'wrong.app') }, 'ios-bundle'));
test('service-account private key embedded in client JSON is rejected without printing it', () => assertCode({ 'apps/mobile/android/app/google-services.json': files['apps/mobile/android/app/google-services.json'].replace('"client":', '"private_key":"VERY_PRIVATE_VALUE","type":"service_account","client":') }, 'credential-material'));
test('service-account secret embedded in client plist is rejected', () => assertCode({ 'apps/mobile/ios/Runner/GoogleService-Info.plist': files['apps/mobile/ios/Runner/GoogleService-Info.plist'].replace('</dict>', '<key>PRIVATE_KEY</key><string>VERY_PRIVATE_VALUE</string></dict>') }, 'credential-material'));
test('missing Android Gradle Firebase plugin fails closed', () => assertCode({ 'apps/mobile/android/app/build.gradle.kts': files['apps/mobile/android/app/build.gradle.kts'].replace('id("com.google.gms.google-services")', '') }, 'android-plugin'));
test('missing Android plugin version fails closed', () => assertCode({ 'apps/mobile/android/settings.gradle.kts': 'plugins {}' }, 'plugin-version'));
test('missing notification permission fails closed', () => assertCode({ 'apps/mobile/android/app/src/main/AndroidManifest.xml': '<manifest><application android:allowBackup="false"/></manifest>' }, 'notification-permission'));
test('unsafe Android backup fails closed', () => assertCode({ 'apps/mobile/android/app/src/main/AndroidManifest.xml': '<manifest><uses-permission android:name="android.permission.POST_NOTIFICATIONS"/><application android:allowBackup="true"/></manifest>' }, 'private-backup'));
test('missing Flutter Firebase messaging dependency fails closed', () => assertCode({ 'apps/mobile/pubspec.yaml': 'dependencies:\n  firebase_core: ^4.0.0\n' }, 'flutter-dependency'));
test('lost build defines path fails closed', () => assertCode({ 'scripts/qualify-first10-android.ps1': 'flutter build apk' }, 'build-defines'));
test('missing API key in Android client fails closed', () => assertCode({ 'apps/mobile/android/app/google-services.json': files['apps/mobile/android/app/google-services.json'].replace('synthetic-public-key', '') }, 'android-client-values'));
test('missing API key in iOS plist fails closed', () => assertCode({ 'apps/mobile/ios/Runner/GoogleService-Info.plist': files['apps/mobile/ios/Runner/GoogleService-Info.plist'].replace('synthetic-public-key', '') }, 'ios-values'));
test('no actual config bytes leak into structured diagnostics', () => {
  const f = fixture();
  try { assert(!JSON.stringify(checkFirebaseContinuity(f.root)).includes('synthetic-public-key')); }
  finally { f.clean(); }
});
