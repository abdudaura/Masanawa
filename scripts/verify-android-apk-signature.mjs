#!/usr/bin/env node
// Read-only Android APK release identity gate. It does not sign or publish APKs.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const CANONICAL_PACKAGE = 'ng.unigeria.unigeria';

export function normalizeCertificateFingerprint(value) {
  const input = String(value ?? '').trim();
  if (!/^(?:[a-f\d]{64}|(?:[a-f\d]{2}:){31}[a-f\d]{2})$/i.test(input)) {
    throw new Error('A pinned, 32-byte release certificate SHA-256 fingerprint is required.');
  }
  return input.replaceAll(':', '').toLowerCase();
}

export function parseApkSignerOutput(output, expectedFingerprint) {
  const lines = String(output).split(/\r?\n/);
  const certs = lines.flatMap(line => {
    const hit = line.match(/^Signer #(\d+) certificate SHA-256 digest:\s*([a-f\d:]+)\s*$/i);
    return hit ? [{ signer: Number(hit[1]), fingerprint: normalizeCertificateFingerprint(hit[2]) }] : [];
  });
  if (certs.length !== 1 || certs[0].signer !== 1) {
    throw new Error('APK must have exactly one inspectable signing certificate.');
  }
  if (certs[0].fingerprint !== normalizeCertificateFingerprint(expectedFingerprint)) {
    throw new Error('APK signing certificate does not match the independently pinned release fingerprint.');
  }
  if (lines.some(line => /^Signer #\d+ certificate DN:\s*.*\bCN\s*=\s*Android Debug\b/i.test(line))) {
    throw new Error('Android debug signing certificate is forbidden for distribution.');
  }
  if (!lines.some(line => /^Verified using v(?:2|3)(?:\.1)? scheme\b.*:\s*true\s*$/i.test(line))) {
    throw new Error('APK needs a verified v2 or v3 Android signature, not v1-only signing.');
  }
  return certs[0].fingerprint;
}

export function parseAaptBadging(output, expectedPackage = CANONICAL_PACKAGE) {
  const text = String(output);
  const match = text.match(/^package:\s+name='([^']+)'/m);
  if (!match || match[1] !== expectedPackage) {
    throw new Error('APK applicationId differs from the reviewed Masanawa package.');
  }
  if (/^application-debuggable(?:\s|$)/m.test(text)) {
    throw new Error('APK manifest is debuggable. Distribution refused.');
  }
  return match[1];
}

function defaultRunBinary(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 512 * 1024, shell: false });
  if (result.error) throw new Error(`${command} unavailable or timed out; install Android SDK build-tools and retry.`);
  if (result.status !== 0) throw new Error(`${command} rejected the APK; signature or manifest verification failed.`);
  return String(result.stdout ?? '');
}

export async function verifyAndroidApk({ apkPath, expectedFingerprint, expectedPackage = CANONICAL_PACKAGE, runBinary = defaultRunBinary }) {
  // Never infer a trusted release certificate from an APK, Gradle config or local debug key.
  const pin = normalizeCertificateFingerprint(expectedFingerprint);
  if (typeof apkPath !== 'string' || !/\.apk$/i.test(apkPath)) throw new Error('A .apk artifact path is required.');
  const info = await lstat(apkPath);
  if (!info.isFile() || info.size === 0) throw new Error('APK must be a nonempty regular file (not a symlink).');
  const signature = await runBinary('apksigner', ['verify', '--verbose', '--print-certs', apkPath]);
  parseApkSignerOutput(signature, pin);
  const badging = await runBinary('aapt', ['dump', 'badging', apkPath]);
  const packageId = parseAaptBadging(badging, expectedPackage);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(apkPath)) hash.update(chunk);
  return { packageId, certificateSha256: pin, apkSha256: hash.digest('hex'), bytes: info.size };
}

async function main() {
  try {
    const [apkPath, fingerprintArg] = process.argv.slice(2);
    const verified = await verifyAndroidApk({ apkPath, expectedFingerprint: fingerprintArg || process.env.MASANAWA_RELEASE_CERT_SHA256 });
    console.log(`PASS: ${verified.packageId} ${verified.bytes} bytes; APK SHA-256 ${verified.apkSha256}; cert SHA-256 ${verified.certificateSha256}`);
  } catch (error) {
    console.error(`BLOCKED: ${error instanceof Error ? error.message : 'Android APK verification failed.'}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
