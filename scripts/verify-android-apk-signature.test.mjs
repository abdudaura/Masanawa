import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  normalizeCertificateFingerprint, parseApkSignerOutput,
  parseAaptBadging, verifyAndroidApk,
} from './verify-android-apk-signature.mjs';

const PIN = 'ab'.repeat(32);
const SIGNED = `Verifies\nVerified using v1 scheme (JAR signing): false\nVerified using v2 scheme (APK Signature Scheme v2): true\nVerified using v3 scheme (APK Signature Scheme v3): false\nSigner #1 certificate DN: CN=Masanawa Release, O=Masanawa\nSigner #1 certificate SHA-256 digest: ${PIN}\n`;
const BADGING = "package: name='ng.unigeria.unigeria' versionCode='42' versionName='1.0'\napplication: label='Masanawa'\n";

function tools({ signer = SIGNED, badging = BADGING, failing = '' } = {}) {
  const calls = [];
  const runBinary = (command, args) => {
    calls.push({ command, args });
    if (command === failing) throw new Error(`${command} rejected the APK`);
    return command === 'apksigner' ? signer : badging;
  };
  return { runBinary, calls };
}

async function withApk(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'masanawa-apk-check-'));
  const apkPath = join(dir, 'release candidate space.apk');
  await writeFile(apkPath, 'fixture, NOT a real signed APK');
  try { return await fn(apkPath, dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('accepts exact or colon-separated certificate pin, refuses malformed', () => {
  assert.equal(normalizeCertificateFingerprint(PIN.toUpperCase()), PIN);
  assert.equal(normalizeCertificateFingerprint(Array(32).fill('AB').join(':')), PIN);
  for (const invalid of ['', 'AA', PIN + 'a', 'aa:bb', 'zz'.repeat(32)]) {
    assert.throws(() => normalizeCertificateFingerprint(invalid), /pinned/);
  }
});

test('accepts one v2 signer matching pin and release identity', () => {
  assert.equal(parseApkSignerOutput(SIGNED, PIN), PIN);
  assert.equal(parseAaptBadging(BADGING), 'ng.unigeria.unigeria');
});

test('rejects mismatched signing certificate', () => {
  assert.throws(() => parseApkSignerOutput(SIGNED, 'cd'.repeat(32)), /does not match/);
});

test('rejects Android Debug DN even if a caller pinned its digest', () => {
  assert.throws(() => parseApkSignerOutput(SIGNED.replace('CN=Masanawa Release', 'CN=Android Debug'), PIN), /debug signing/);
});

test('rejects missing signer, second signer, and v1-only APK', () => {
  assert.throws(() => parseApkSignerOutput(SIGNED.replace(/^Signer #1 certificate SHA-256 digest:.*$/m, ''), PIN), /exactly one/);
  assert.throws(() => parseApkSignerOutput(SIGNED + `Signer #2 certificate SHA-256 digest: ${PIN}\n`, PIN), /exactly one/);
  assert.throws(() => parseApkSignerOutput(SIGNED.replace('Scheme v2): true', 'Scheme v2): false'), PIN), /v2 or v3/);
});

test('rejects wrong package ID and debuggable manifest', () => {
  assert.throws(() => parseAaptBadging(BADGING.replace('ng.unigeria.unigeria', 'com.attacker')), /applicationId/);
  assert.throws(() => parseAaptBadging(BADGING + 'application-debuggable\n'), /debuggable/);
});

test('validates tool arguments as array, streams hash and never alters artifact', async () => {
  await withApk(async apkPath => {
    const tool = tools();
    const result = await verifyAndroidApk({ apkPath, expectedFingerprint: PIN, runBinary: tool.runBinary });
    assert.equal(result.packageId, 'ng.unigeria.unigeria');
    assert.equal(result.certificateSha256, PIN);
    assert.match(result.apkSha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(tool.calls.map(x => x.command), ['apksigner', 'aapt']);
    assert.deepEqual(tool.calls[0].args, ['verify', '--verbose', '--print-certs', apkPath]);
    assert.deepEqual(tool.calls[1].args, ['dump', 'badging', apkPath]);
  });
});

test('fails closed before invoking tools without pin', async () => {
  await withApk(async apkPath => {
    const tool = tools();
    await assert.rejects(verifyAndroidApk({ apkPath, runBinary: tool.runBinary }), /pinned/);
    assert.equal(tool.calls.length, 0);
  });
});

test('rejects empty APK and symlink without tool execution', async () => {
  await withApk(async (apkPath, dir) => {
    const empty = join(dir, 'empty.apk');
    const link = join(dir, 'link.apk');
    await writeFile(empty, '');
    await symlink(apkPath, link);
    const tool = tools();
    for (const candidate of [empty, link]) {
      await assert.rejects(verifyAndroidApk({ apkPath: candidate, expectedFingerprint: PIN, runBinary: tool.runBinary }), /nonempty regular/);
    }
    assert.equal(tool.calls.length, 0);
  });
});

test('propagates signer tool failure and never trusts package check alone', async () => {
  await withApk(async apkPath => {
    const tool = tools({ failing: 'apksigner' });
    await assert.rejects(verifyAndroidApk({ apkPath, expectedFingerprint: PIN, runBinary: tool.runBinary }), /apksigner rejected/);
    assert.deepEqual(tool.calls.map(x=>x.command), ['apksigner']);
  });
});

test('propagates aapt failure after signature verification', async () => {
  await withApk(async apkPath => {
    const tool = tools({ failing: 'aapt' });
    await assert.rejects(verifyAndroidApk({ apkPath, expectedFingerprint: PIN, runBinary: tool.runBinary }), /aapt rejected/);
  });
});
