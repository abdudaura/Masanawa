#!/usr/bin/env node
// F11/R16: evaluate the built APK, not Gradle/source manifests. No Android
// packages are installed or changed; all subprocesses are read-only.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const EXPECTED_PACKAGE = 'ng.unigeria.unigeria';
const PIN = /^[a-f\d]{64}$/i;

export class ApkQualificationError extends Error {
  constructor(code) { super(code); this.name = 'ApkQualificationError'; }
}
function requireCondition(ok, code) {
  if (!ok) throw new ApkQualificationError(code);
}
function normalizedPin(value) {
  requireCondition(typeof value === 'string' && PIN.test(value) && !/^0{64}$/i.test(value), 'release_certificate_pin_required');
  return value.toLowerCase();
}
function attribute(markup, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return markup.match(new RegExp(String.raw`(?:^|\s)${escaped}\s*=\s*(["'])(.*?)\1`, 's'))?.[2] ?? null;
}
function element(xml, name) {
  const matches = [...xml.matchAll(new RegExp(String.raw`<${name}\b([^>]+)>`, 'gs'))];
  requireCondition(matches.length === 1, `effective_manifest_${name}_invalid`);
  return matches[0][1];
}
/** Only accepts decoded, effective XML emitted by Android apkanalyzer. */
export function verifyEffectiveManifest(xml, minSdkText) {
  requireCondition(typeof xml === 'string' && xml.length > 80 && xml.length <= 1024 * 1024, 'effective_manifest_unavailable');
  requireCondition(/^24\s*$/.test(minSdkText), 'android_min_sdk_changed');
  const manifest = element(xml, 'manifest');
  requireCondition(attribute(manifest, 'package') === EXPECTED_PACKAGE, 'android_application_id_mismatch');
  const app = element(xml, 'application');
  for (const [name, value] of [
    ['android:allowBackup', 'false'],
    ['android:fullBackupContent', 'false'],
    ['android:usesCleartextTraffic', 'false'],
  ]) {
    requireCondition(attribute(app, name) === value, `effective_manifest_${name.replace(':','_')}_unsafe`);
  }
  requireCondition(attribute(app, 'android:networkSecurityConfig') !== null, 'effective_manifest_network_policy_missing');
  requireCondition(attribute(app, 'android:dataExtractionRules') !== null, 'effective_manifest_data_extraction_rules_missing');
  requireCondition(attribute(app, 'android:debuggable') !== 'true', 'debuggable_release_apk');
  // Security declaration is verified here; the referenced compiled XML rules
  // require separate resource/device confirmation, not inferred from an ID.
  return { packageName: EXPECTED_PACKAGE, minSdk: 24 };
}

export function verifyApkSigner(output, expectedPin) {
  const pin = normalizedPin(expectedPin);
  requireCondition(typeof output === 'string' && output.length < 1024 * 1024, 'apksigner_output_unavailable');
  requireCondition(/^Verifies\s*$/m.test(output), 'apk_signature_not_verified');
  // minSdk 24 includes Android 7/8: v3-only signatures are not supported there.
  // Require APK Signature Scheme v2, even if newer v3/v4 signatures also exist.
  requireCondition(/^Verified using v2 scheme[^:]*:\s*true\s*$/im.test(output), 'android24_signature_v2_missing');
  const fingerprints = [...output.matchAll(/^Signer #(\d+) certificate SHA-256 digest:\s*([a-f\d]{64})\s*$/gim)];
  requireCondition(fingerprints.length === 1 && fingerprints[0][1] === '1', 'apk_signer_count_invalid');
  const declared = output.match(/^Number of signers:\s*(\d+)\s*$/im);
  requireCondition(!declared || declared[1] === '1', 'apk_signer_count_invalid');
  requireCondition(fingerprints[0][2].toLowerCase() === pin, 'apk_release_certificate_mismatch');
  requireCondition(!/^Signer #\d+ certificate DN:.*(?:CN=Android Debug)(?:,|$)/im.test(output), 'android_debug_certificate_forbidden');
  return { certificateSha256: pin };
}

export function inspectApk({ apkPath, certificateSha256, run = execFileSync, read = readFileSync, stat = statSync }) {
  normalizedPin(certificateSha256);
  requireCondition(typeof apkPath === 'string' && apkPath.trim() !== '', 'apk_path_required');
  let meta;
  try { meta = stat(apkPath); } catch { throw new ApkQualificationError('apk_file_unavailable'); }
  requireCondition(meta.isFile() && meta.size > 0, 'apk_file_unavailable');
  const call = (tool, args) => {
    try {
      return run(tool, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true });
    } catch {
      throw new ApkQualificationError(`${tool}_unavailable_or_failed`);
    }
  };
  const signer = verifyApkSigner(call('apksigner', ['verify', '--verbose', '--print-certs', apkPath]), certificateSha256);
  const manifest = verifyEffectiveManifest(call('apkanalyzer', ['manifest', 'print', apkPath]), call('apkanalyzer', ['manifest', 'min-sdk', apkPath]));
  const content = read(apkPath);
  requireCondition(Buffer.isBuffer(content) && content.length === meta.size, 'apk_read_failed');
  return { ...manifest, ...signer, artifactSha256: createHash('sha256').update(content).digest('hex'), bytes: meta.size };
}

export function parseOptions(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const result = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1];
    requireCondition((key === '--apk' || key === '--cert-sha256') && typeof value === 'string' && !value.startsWith('--') && result[key] === undefined, 'usage_invalid');
    result[key] = value;
  }
  requireCondition(Object.keys(result).length === 2, 'usage_invalid');
  return { apkPath: result['--apk'], certificateSha256: result['--cert-sha256'] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseOptions(process.argv.slice(2));
    if (args.help) {
      console.log('Usage: node tools/android-apk-gate/qualify-apk.mjs --apk <signed-release.apk> --cert-sha256 <64-hex-release-signing-certificate-fingerprint>');
    } else {
      const verified = inspectApk(args);
      console.log(`PASS APK artifact SHA-256 ${verified.artifactSha256}; package ${verified.packageName}; minSdk ${verified.minSdk}; single pinned release certificate; manifest guards present`);
      console.log('NOTE: compiled XML resource behavior, signing custody, device, Firebase, backend, provider and deployment are separate unverified gates.');
    }
  } catch (error) {
    console.error(`FAIL APK qualification: ${error instanceof ApkQualificationError ? error.message : 'unexpected_failure'}`);
    process.exitCode = 1;
  }
}
