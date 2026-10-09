#!/usr/bin/env node
/**
 * Read-only structural Firebase integration guard. No network, SDK, or secrets.
 * This is deliberately not an FCM delivery test.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FILES = Object.freeze({
  androidJson: 'apps/mobile/android/app/google-services.json',
  androidApp: 'apps/mobile/android/app/build.gradle.kts',
  androidSettings: 'apps/mobile/android/settings.gradle.kts',
  androidManifest: 'apps/mobile/android/app/src/main/AndroidManifest.xml',
  iosPlist: 'apps/mobile/ios/Runner/GoogleService-Info.plist',
  pubspec: 'apps/mobile/pubspec.yaml',
  qualification: 'scripts/qualify-first10-android.ps1',
});

const isPresent = (value) => typeof value === 'string' && value.trim().length > 0;
const exactString = (text, key) => {
  const match = text.match(new RegExp('\\b' + key + '\\s*=\\s*"([^"]+)"'));
  return match?.[1] ?? null;
};

// Read only ordinary, bounded text files. Never include file bytes in reports.
const read = (root, relative, report) => {
  try {
    const bytes = readFileSync(join(root, relative));
    if (bytes.length > 256 * 1024) {
      report('oversize', relative);
      return null;
    }
    return bytes.toString('utf8');
  } catch {
    report('missing', relative);
    return null;
  }
};

function parsePlistKeys(raw) {
  if (!raw.includes('<plist') || !raw.includes('<dict>')) return null;
  const entries = [...raw.matchAll(/<key>\s*([^<]+)\s*<\/key>\s*<string>\s*([^<]*)\s*<\/string>/g)];
  const result = Object.create(null);
  for (const match of entries) {
    const key = match[1].trim();
    if (Object.hasOwn(result, key)) return null;
    result[key] = match[2].trim();
  }
  return result;
}

/** @returns {{ok: boolean, codes: string[], checked: number}} */
export function checkFirebaseContinuity(root) {
  const errors = [];
  const report = (code, filename) => errors.push(code + ':' + filename);
  const sources = Object.fromEntries(Object.entries(FILES).map(([name, file]) =>
    [name, read(root, file, report)]));
  const a = sources;
  const requireMatch = (name, matched, code) => {
    if (a[name] !== null && !matched) report(code, FILES[name]);
  };

  if (a.androidApp !== null) {
    const pkg = exactString(a.androidApp, 'applicationId');
    if (pkg !== 'com.masanawa.app') report('android-package', FILES.androidApp);
    requireMatch('androidApp', /id\("com\.google\.gms\.google-services"\)/.test(a.androidApp), 'android-plugin');
  }
  requireMatch('androidSettings', /id\("com\.google\.gms\.google-services"\)\s+version\s+"[^"]+"/.test(a.androidSettings ?? ''), 'plugin-version');
  requireMatch('androidManifest', /android\.permission\.POST_NOTIFICATIONS/.test(a.androidManifest ?? ''), 'notification-permission');
  requireMatch('androidManifest', /android:allowBackup="false"/.test(a.androidManifest ?? ''), 'private-backup');
  requireMatch('pubspec', /^\s+firebase_core:\s*\S+/m.test(a.pubspec ?? '') && /^\s+firebase_messaging:\s*\S+/m.test(a.pubspec ?? ''), 'flutter-dependency');
  requireMatch('qualification', /FirebaseDefinesFile/.test(a.qualification ?? '') && /--dart-define-from-file/.test(a.qualification ?? ''), 'build-defines');

  let android = null;
  if (a.androidJson !== null) {
    try { android = JSON.parse(a.androidJson); }
    catch { report('invalid-json', FILES.androidJson); }
    if (android !== null) {
      // Never serialize credentials or raw configuration into diagnostics.
      if (a.androidJson.includes('"private_key"') || a.androidJson.includes('"private_key_id"') ||
          /"type"\s*:\s*"service_account"/.test(a.androidJson)) {
        report('credential-material', FILES.androidJson);
      }
      const project = android?.project_info;
      if (!isPresent(project?.project_id) || !isPresent(project?.project_number))
        report('android-project', FILES.androidJson);
      const matches = Array.isArray(android?.client) ? android.client.filter(client =>
        client?.client_info?.android_client_info?.package_name === 'com.masanawa.app') : [];
      if (matches.length !== 1) report('android-client', FILES.androidJson);
      else if (!isPresent(matches[0]?.client_info?.mobilesdk_app_id) ||
               !Array.isArray(matches[0]?.api_key) ||
               !matches[0].api_key.some(key => isPresent(key?.current_key)))
        report('android-client-values', FILES.androidJson);
    }
  }

  let ios = null;
  if (a.iosPlist !== null) {
    if (/<key>\s*(?:PRIVATE_KEY|PRIVATE_KEY_ID)\s*<\/key>/i.test(a.iosPlist) ||
        /-----BEGIN PRIVATE KEY-----/.test(a.iosPlist)) report('credential-material', FILES.iosPlist);
    ios = parsePlistKeys(a.iosPlist);
    if (ios === null) report('invalid-plist', FILES.iosPlist);
    else if (!['BUNDLE_ID', 'PROJECT_ID', 'GCM_SENDER_ID', 'GOOGLE_APP_ID', 'API_KEY']
      .every(key => isPresent(ios[key]))) report('ios-values', FILES.iosPlist);
    else if (ios.BUNDLE_ID !== 'com.masanawa.app') report('ios-bundle', FILES.iosPlist);
  }
  if (android?.project_info && ios) {
    if (isPresent(ios.PROJECT_ID) && ios.PROJECT_ID !== android.project_info.project_id)
      report('project-mismatch', 'android/ios');
    if (isPresent(ios.GCM_SENDER_ID) && ios.GCM_SENDER_ID !== String(android.project_info.project_number))
      report('sender-mismatch', 'android/ios');
  }
  return { ok: errors.length === 0, codes: [...new Set(errors)].sort(), checked: Object.keys(FILES).length };
}

function main(args) {
  if (args.length > 2 || args.some(arg => !['--json', '--help'].includes(arg) && !arg.startsWith('--root='))) {
    process.stderr.write('Usage: node check.mjs [--root=REPO_DIRECTORY] [--json]\n');
    process.exitCode = 2;
    return;
  }
  if (args.includes('--help')) {
    process.stdout.write('Read-only Firebase structural check; not an FCM delivery qualification.\n');
    return;
  }
  const root = resolve(args.find(arg => arg.startsWith('--root='))?.slice(7) ?? '.');
  const result = checkFirebaseContinuity(root);
  if (args.includes('--json')) process.stdout.write(JSON.stringify(result) + '\n');
  else process.stdout.write(result.ok ? 'Firebase source continuity: PASS (structural only)\n' :
    'Firebase source continuity: FAIL (' + result.codes.length + ' findings)\n' + result.codes.join('\n') + '\n');
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2));
