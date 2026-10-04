import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Quiet subprocesses deliberately keep credentials and vendor output out of reports.
export function runTool(command, args, cwd, timeout = 120000) {
  try {
    const options = { cwd, timeout, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
    let stdout;
    if (process.platform === 'win32') {
      const quote = value => "'" + value.replaceAll("'", "''") + "'";
      const source = `& ${quote(command)} ${args.map(quote).join(' ')}; exit $LASTEXITCODE`;
      stdout = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')], options);
    } else {
      stdout = execFileSync(command, args, options);
    }
    return { ok: true, stdout };
  } catch (error) {
    return { ok: false, timedOut: error.code === 'ETIMEDOUT', missing: error.code === 'ENOENT' };
  }
}

export function validGateway(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) return undefined;
    return url.origin;
  } catch { return undefined; }
}

function version(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\s|$)/.exec(value ?? '');
  return match ? match.slice(1).map(Number) : undefined;
}

function atLeast(actual, required) {
  for (let i = 0; i < 3; i++) {
    if (actual[i] !== required[i]) return actual[i] > required[i];
  }
  return true;
}

export function inspectMobile({ root, env = process.env, run = runTool }) {
  const mobile = join(root, 'apps/mobile');
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, status: ok ? 'passed' : 'blocked', detail });
  const read = path => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };
  const pubspec = read(join(mobile, 'pubspec.yaml'));
  const gradle = read(join(mobile, 'android/app/build.gradle.kts'));
  add('checkout', Boolean(pubspec && gradle), 'Run against a checkout containing apps/mobile/pubspec.yaml and Android Kotlin Gradle config.');
  if (!pubspec || !gradle) return { ok: false, checks };
  const required = /\bsdk:\s*["']?\^(\d+)\.(\d+)\.(\d+)/.exec(pubspec)?.slice(1).map(Number);
  add('dart-constraint', Boolean(required), 'Read the Dart caret version from the actual mobile pubspec; unsupported constraints require a checker update.');
  const flutter = run('flutter', ['--version', '--machine'], mobile);
  let machine;
  try { machine = JSON.parse(flutter.stdout ?? ''); } catch { /* malformed tool output fails closed */ }
  const actual = version(machine?.dartSdkVersion);
  add('flutter', Boolean(flutter.ok && actual), 'Flutter must be on PATH and return valid machine-readable Dart SDK metadata.');
  if (required && actual) add('dart-version', actual[0] === required[0] && atLeast(actual, required), `Dart must satisfy ^${required.join('.')}.`);
  const compileSdk = Number(/\bcompileSdk\s*=\s*(\d+)\b/.exec(gradle)?.[1]);
  add('android-config', Number.isInteger(compileSdk) && compileSdk > 0, 'Read the pinned compileSdk from the current Gradle config.');
  const properties = read(join(mobile, 'android/local.properties'));
  const configuredSdk = /^sdk\.dir\s*=\s*(.+)$/m.exec(properties)?.[1]?.trim().replace(/\\([\\: ])/g, '$1');
  const sdk = configuredSdk || env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  add('android-sdk', Boolean(sdk && existsSync(join(sdk, 'platform-tools'))), 'Configure android/local.properties sdk.dir or ANDROID_HOME with an installed Android SDK.');
  if (compileSdk > 0) add('android-platform', Boolean(sdk && existsSync(join(sdk, `platforms/android-${compileSdk}/android.jar`))), `Install Android platform ${compileSdk} in the selected SDK.`);
  add('brand-asset', existsSync(join(mobile, 'assets/brand/masanawa_agent_logo.png')), 'The approved Masanawa Agent Blue source logo must be present.');
  const gateway = env.MASANAWA_MOBILE_GATEWAY;
  if (gateway) add('gateway', Boolean(validGateway(gateway)), 'Use an HTTPS Gateway origin, or HTTP loopback for local debug testing; no embedded credentials, path, query or fragment.');
  checks.push({ id: 'authentication', status: 'info', detail: 'Enter the hosted Alpha token in Settings > Developer > Connect test app after installation. Server/provider secrets are never compiled by this runner.' });
  return { ok: checks.every(check => check.status !== 'blocked'), checks };
}

export function validateAndBuild({ root, env = process.env, build = false, run = runTool }) {
  const report = inspectMobile({ root, env, run });
  report.stages = [];
  if (!report.ok) return report;
  const mobile = join(root, 'apps/mobile');
  const stages = [
    ['dependencies', ['pub', 'get']],
    ['analysis', ['analyze', '--no-fatal-infos', '--no-fatal-warnings']],
    ['tests', ['test']],
  ];
  for (const [id, args] of stages) {
    const result = run('flutter', args, mobile, 15 * 60 * 1000);
    report.stages.push({ id, status: result.ok ? 'passed' : 'blocked', detail: result.ok ? 'Completed.' : result.timedOut ? 'Timed out; later stages were not run.' : 'Failed; rerun this Flutter command locally to inspect diagnostics. Later stages were not run.' });
    if (!result.ok) { report.ok = false; return report; }
  }
  if (!build) return report;
  let temporary;
  try {
    temporary = mkdtempSync(join(tmpdir(), 'masanawa-mobile-'));
    const definitions = { AGENT_RUNTIME_ENABLED: 'true' };
    if (env.MASANAWA_MOBILE_GATEWAY) definitions.AGENT_BASE_URL = validGateway(env.MASANAWA_MOBILE_GATEWAY);
    const file = join(temporary, 'defines.json');
    writeFileSync(file, JSON.stringify(definitions), { mode: 0o600 });
    const result = run('flutter', ['build', 'apk', '--debug', `--dart-define-from-file=${file}`], mobile, 30 * 60 * 1000);
    report.stages.push({ id: 'debug-apk', status: result.ok ? 'passed' : 'blocked', detail: result.ok ? 'Debug build completed.' : 'Debug build failed; no APK qualification is claimed.' });
    if (!result.ok) { report.ok = false; return report; }
    const apk = join(mobile, 'build/app/outputs/flutter-apk/app-debug.apk');
    if (!existsSync(apk) || statSync(apk).size < 4) throw new Error('missing artifact');
    const bytes = readFileSync(apk);
    if (bytes.readUInt32LE(0) !== 0x04034b50) throw new Error('invalid artifact');
    report.artifact = { path: apk, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), mode: 'debug' };
  } catch {
    report.ok = false;
    report.stages.push({ id: 'artifact', status: 'blocked', detail: 'Could not prepare build configuration or verify the generated APK archive.' });
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
  return report;
}

export function main(args = process.argv.slice(2)) {
  let root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let validate = false, build = false, json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) root = resolve(args[++i]);
    else if (args[i] === '--validate') validate = true;
    else if (args[i] === '--build') build = validate = true;
    else if (args[i] === '--json') json = true;
    else if (args[i] === '--help') { console.log('node scripts/mobile-build-check.mjs [--root <checkout>] [--validate | --build] [--json]'); return 0; }
    else { console.error('Unknown or incomplete option. Use --help.'); return 2; }
  }
  const report = validate ? validateAndBuild({ root, build }) : inspectMobile({ root });
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const check of [...report.checks, ...(report.stages ?? [])]) console.log(`${check.status.toUpperCase()} ${check.id}: ${check.detail}`);
    if (report.artifact) console.log(`APK ${report.artifact.path}\nSHA256 ${report.artifact.sha256}`);
    console.log(report.ok ? 'Checks passed. Physical-device acceptance remains required.' : 'Blocked. Resolve the listed checks before compiling.');
  }
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main();
