import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectMobile, validateAndBuild, validGateway, main } from './mobile-build-check.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'mobile-check-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const mobile = join(root, 'apps/mobile');
  const sdk = join(root, 'sdk');
  for (const path of ['android/app', 'assets/brand', 'build/app/outputs/flutter-apk']) mkdirSync(join(mobile, path), { recursive: true });
  mkdirSync(join(sdk, 'platform-tools'), { recursive: true });
  mkdirSync(join(sdk, 'platforms/android-37'), { recursive: true });
  writeFileSync(join(sdk, 'platforms/android-37/android.jar'), 'fixture');
  writeFileSync(join(mobile, 'pubspec.yaml'), 'environment:\n  sdk: ^3.12.2\n');
  writeFileSync(join(mobile, 'android/app/build.gradle.kts'), 'compileSdk = 37\n');
  writeFileSync(join(mobile, 'assets/brand/masanawa_agent_logo.png'), 'fixture');
  const calls = [];
  const run = (command, args, cwd) => {
    calls.push({ command, args, cwd });
    return { ok: true, stdout: args.includes('--machine') ? JSON.stringify({ dartSdkVersion: '3.13.5 (stable)' }) : '' };
  };
  return { root, mobile, sdk, env: { ANDROID_HOME: sdk }, run, calls };
}

test('an ordinary complete workstation passes without compilation or authentication calls', t => {
  const f = fixture(t);
  assert.equal(inspectMobile(f).ok, true);
  assert.deepEqual(f.calls.map(c => c.args), [['--version', '--machine']]);
});

test('old Dart fails before dependency install or compilation', t => {
  const f = fixture(t);
  const report = validateAndBuild({ ...f, run: () => ({ ok: true, stdout: '{"dartSdkVersion":"3.12.1"}' }), build: true });
  assert.equal(report.ok, false);
  assert.equal(report.checks.find(c => c.id === 'dart-version').status, 'blocked');
  assert.deepEqual(report.stages, []);
});

test('a newer major Dart version does not satisfy the caret constraint', t => {
  const f = fixture(t);
  assert.equal(inspectMobile({ ...f, run: () => ({ ok: true, stdout: '{"dartSdkVersion":"4.0.0"}' }) }).ok, false);
});

test('missing or malformed Flutter metadata fails closed without exposing tool output', t => {
  const f = fixture(t);
  for (const result of [{ ok: false, stdout: 'secret-value' }, { ok: true, stdout: 'secret-value' }]) {
    const report = inspectMobile({ ...f, run: () => result });
    assert.equal(report.ok, false);
    assert.ok(!JSON.stringify(report).includes('secret-value'));
  }
});

test('local.properties wins over conflicting SDK environment configuration', t => {
  const f = fixture(t);
  writeFileSync(join(f.mobile, 'android/local.properties'), `sdk.dir=${f.sdk}\n`);
  assert.equal(inspectMobile({ ...f, env: { ANDROID_HOME: join(f.root, 'bad-sdk') } }).ok, true);
});

test('missing platform or approved artwork blocks the preflight', t => {
  const f = fixture(t);
  rmSync(join(f.sdk, 'platforms/android-37/android.jar'));
  rmSync(join(f.mobile, 'assets/brand/masanawa_agent_logo.png'));
  const report = inspectMobile(f);
  assert.equal(report.ok, false);
  assert.equal(report.checks.find(c => c.id === 'android-platform').status, 'blocked');
  assert.equal(report.checks.find(c => c.id === 'brand-asset').status, 'blocked');
});

test('Gateway accepts HTTPS and debug loopback and rejects credential-bearing or insecure remote URLs', () => {
  assert.equal(validGateway('https://example.com'), 'https://example.com');
  assert.equal(validGateway('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
  for (const value of ['http://remote.example', 'https://user:pass@example.com', 'https://example.com/path', 'https://example.com?token=secret', 'https://example.com#secret', 'file:///tmp', 'garbage']) assert.equal(validGateway(value), undefined);
});

test('a failed analysis stops tests and build and does not leak vendor diagnostics', t => {
  const f = fixture(t);
  const report = validateAndBuild({ ...f, build: true, run: (cmd, args, cwd) => args[0] === 'analyze' ? { ok: false, stdout: 'api-key-value' } : f.run(cmd, args, cwd) });
  assert.equal(report.ok, false);
  assert.deepEqual(report.stages.map(s => s.id), ['dependencies', 'analysis']);
  assert.ok(!JSON.stringify(report).includes('api-key-value'));
  assert.ok(!f.calls.some(c => c.args[0] === 'test' || c.args[0] === 'build'));
});

test('a dependency timeout never advances to analysis', t => {
  const f = fixture(t);
  const report = validateAndBuild({ ...f, run: (cmd, args, cwd) => args[0] === 'pub' ? { ok: false, timedOut: true } : f.run(cmd, args, cwd) });
  assert.equal(report.ok, false);
  assert.equal(report.stages.length, 1);
  assert.match(report.stages[0].detail, /Timed out/);
});

test('a debug build uses private temporary definitions without tokens and verifies the APK', t => {
  const f = fixture(t);
  let definitionsPath;
  const report = validateAndBuild({ ...f, build: true, env: { ...f.env, MASANAWA_MOBILE_GATEWAY: 'https://example.com', ALPHA_DEV_ACCESS_TOKEN: 'never-embed-this', GEMINI_API_KEY: 'never-embed-that' }, run: (cmd, args, cwd) => {
    if (args[0] === 'build') {
      definitionsPath = args.find(a => a.startsWith('--dart-define-from-file=')).split('=')[1];
      assert.deepEqual(JSON.parse(readFileSync(definitionsPath, 'utf8')), { AGENT_RUNTIME_ENABLED: 'true', AGENT_BASE_URL: 'https://example.com' });
      writeFileSync(join(f.mobile, 'build/app/outputs/flutter-apk/app-debug.apk'), Buffer.from([0x50, 0x4b, 0x03, 0x04, 1]));
    }
    return f.run(cmd, args, cwd);
  } });
  assert.equal(report.ok, true);
  assert.match(report.artifact.sha256, /^[a-f0-9]{64}$/);
  assert.equal(existsSync(definitionsPath), false);
  assert.ok(!JSON.stringify(report).includes('never-embed'));
  assert.deepEqual(f.calls.slice(1).map(c => c.args[0]), ['pub', 'analyze', 'test', 'build']);
});

test('failed builds clean definitions and never return an older APK as success', t => {
  const f = fixture(t);
  let temporary;
  writeFileSync(join(f.mobile, 'build/app/outputs/flutter-apk/app-debug.apk'), Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const report = validateAndBuild({ ...f, build: true, run: (cmd, args, cwd) => {
    if (args[0] === 'build') { temporary = args.at(-1).split('=')[1]; return { ok: false }; }
    return f.run(cmd, args, cwd);
  } });
  assert.equal(report.ok, false);
  assert.equal(report.artifact, undefined);
  assert.equal(existsSync(temporary), false);
});

test('successful Flutter exit without a valid APK archive is a failed artifact gate', t => {
  const f = fixture(t);
  writeFileSync(join(f.mobile, 'build/app/outputs/flutter-apk/app-debug.apk'), 'not-an-apk');
  const report = validateAndBuild({ ...f, build: true });
  assert.equal(report.ok, false);
  assert.equal(report.artifact, undefined);
});

test('missing checkout returns a bounded diagnostic', t => {
  const f = fixture(t);
  assert.equal(inspectMobile({ ...f, root: join(f.root, 'missing') }).ok, false);
});

test('unknown and incomplete options fail before any tool runs', () => {
  assert.equal(main(['--root']), 2);
  assert.equal(main(['--release']), 2);
});
