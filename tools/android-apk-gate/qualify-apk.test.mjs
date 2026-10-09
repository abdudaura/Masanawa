import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectApk, parseOptions, verifyApkSigner, verifyEffectiveManifest } from './qualify-apk.mjs';

const PIN = 'a'.repeat(64);
const xml = '<?xml version="1.0" encoding="utf-8"?><manifest xmlns:android="http://schemas.android.com/apk/res/android" package="ng.unigeria.unigeria"><application android:label="Masanawa" android:allowBackup="false" android:fullBackupContent="false" android:usesCleartextTraffic="false" android:networkSecurityConfig="@xml/masanawa_network_security_config" android:dataExtractionRules="@xml/masanawa_data_extraction_rules" android:debuggable="false"></application></manifest>';
const sig = 'Verifies\nVerified using v1 scheme (JAR signing): false\nVerified using v2 scheme (APK Signature Scheme v2): true\nVerified using v3 scheme (APK Signature Scheme v3): true\nNumber of signers: 1\nSigner #1 certificate DN: CN=Masanawa Release, O=Test\nSigner #1 certificate SHA-256 digest: ' + PIN + '\n';
const rejects = (fn, code) => assert.throws(fn, e => e.name === 'ApkQualificationError' && e.message === code);

test('accepts the canonical effective APK metadata and pinned release signer', () => {
  assert.equal(verifyEffectiveManifest(xml, '24\n').packageName, 'ng.unigeria.unigeria');
  assert.equal(verifyApkSigner(sig, PIN).certificateSha256, PIN);
});
test('refuses unsafe or missing backup and cleartext flags', () => {
  for (const key of ['allowBackup', 'fullBackupContent', 'usesCleartextTraffic']) {
    rejects(() => verifyEffectiveManifest(xml.replace('android:' + key + '="false"', 'android:' + key + '="true"'), '24'), 'effective_manifest_android_' + key + '_unsafe');
    rejects(() => verifyEffectiveManifest(xml.replace('android:' + key + '="false"', ''), '24'), 'effective_manifest_android_' + key + '_unsafe');
  }
});
test('refuses missing packaged policy references', () => {
  rejects(() => verifyEffectiveManifest(xml.replace(/android:networkSecurityConfig="[^"]+"/, ''), '24'), 'effective_manifest_network_policy_missing');
  rejects(() => verifyEffectiveManifest(xml.replace(/android:dataExtractionRules="[^"]+"/, ''), '24'), 'effective_manifest_data_extraction_rules_missing');
});
test('refuses spoofed app, SDK drift, debuggable or invalid manifest', () => {
  rejects(() => verifyEffectiveManifest(xml.replace('ng.unigeria.unigeria', 'org.spoof.app'), '24'), 'android_application_id_mismatch');
  rejects(() => verifyEffectiveManifest(xml, '26'), 'android_min_sdk_changed');
  rejects(() => verifyEffectiveManifest(xml.replace('android:debuggable="false"', 'android:debuggable="true"'), '24'), 'debuggable_release_apk');
  rejects(() => verifyEffectiveManifest('not XML', '24'), 'effective_manifest_unavailable');
  rejects(() => verifyEffectiveManifest(xml.replace('</manifest>', '<application other="yes"></application></manifest>'), '24'), 'effective_manifest_application_invalid');
});
test('refuses unsigned, old, debug, multi-signed or wrong-pin artifacts', () => {
  rejects(() => verifyApkSigner(sig.replace('Verifies\n', ''), PIN), 'apk_signature_not_verified');
  rejects(() => verifyApkSigner(sig.replace(/v[23] scheme[^\n]+: true/g, s => s.replace('true', 'false')), PIN), 'modern_apk_signature_missing');
  rejects(() => verifyApkSigner(sig.replace('CN=Masanawa Release', 'CN=Android Debug'), PIN), 'android_debug_certificate_forbidden');
  rejects(() => verifyApkSigner(sig + 'Signer #2 certificate SHA-256 digest: ' + PIN + '\n', PIN), 'apk_signer_count_invalid');
  rejects(() => verifyApkSigner(sig.replace('Number of signers: 1', 'Number of signers: 2'), PIN), 'apk_signer_count_invalid');
  rejects(() => verifyApkSigner(sig, 'b'.repeat(64)), 'apk_release_certificate_mismatch');
  rejects(() => verifyApkSigner(sig, '0'.repeat(64)), 'release_certificate_pin_required');
});
test('runs against one APK via read-only Android tools and outputs a SHA-256', () => {
  const calls = [];
  const bytes = Buffer.from('fixture-file');
  const result = inspectApk({
    apkPath: '/tmp/app-release.apk', certificateSha256: PIN,
    stat: () => ({ isFile: () => true, size: bytes.length }),
    read: () => bytes,
    run: (command, args, opts) => {
      calls.push([command, args]);
      assert.equal(opts.timeout, 30000);
      assert.equal(opts.shell, undefined);
      if (command === 'apksigner') return sig;
      return args[1] === 'print' ? xml : '24\n';
    },
  });
  assert.match(result.artifactSha256, /^[a-f\d]{64}$/);
  assert.deepEqual(calls, [
    ['apksigner', ['verify', '--verbose', '--print-certs', '/tmp/app-release.apk']],
    ['apkanalyzer', ['manifest', 'print', '/tmp/app-release.apk']],
    ['apkanalyzer', ['manifest', 'min-sdk', '/tmp/app-release.apk']],
  ]);
});
test('fails closed when the APK or Android tooling is unavailable', () => {
  rejects(() => inspectApk({
    apkPath: '/tmp/absent.apk', certificateSha256: PIN, stat: () => { throw new Error('missing'); },
  }), 'apk_file_unavailable');
  rejects(() => inspectApk({
    apkPath: '/tmp/test.apk', certificateSha256: PIN,
    stat: () => ({ isFile: () => true, size: 1 }),
    read: () => Buffer.of(1), run: () => { throw new Error('ENOENT'); },
  }), 'apksigner_unavailable_or_failed');
});
test('requires explicit fingerprint and APK path; cannot skip either via CLI', () => {
  assert.deepEqual(parseOptions(['--apk', 'out.apk', '--cert-sha256', PIN]), { apkPath: 'out.apk', certificateSha256: PIN });
  rejects(() => parseOptions(['--apk', 'out.apk']), 'usage_invalid');
  rejects(() => parseOptions(['--apk', 'a.apk', '--apk', 'b.apk', '--cert-sha256', PIN]), 'usage_invalid');
});
