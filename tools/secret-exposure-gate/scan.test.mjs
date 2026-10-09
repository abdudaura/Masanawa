import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanRepository, runCli } from './scan.mjs';

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'masanawa-secret-gate-'));
  const write = (name, content) => {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  try { return run({ root, write }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function rules(result) { return result.findings.map(item => item.rule); }

// Construct synthetic signals without embedding a live-looking token in the test source.
const syntheticGithub = ['ghp', '_', 'A'.repeat(36)].join('');
const syntheticPayment = ['sk', 'live', 'B'.repeat(24)].join('_');
const syntheticPrivate = ['-----BEGIN', 'RSA PRIVATE KEY-----'].join(' ');

test('clean source and documented sample env pass', () => fixture(({ root, write }) => {
  write('src/main.ts', 'export const message = "hello";');
  write('.env.example', 'TOKEN=placeholder');
  const result = scanRepository(root);
  assert.equal(result.findings.length, 0);
  assert.deepEqual(result.errors, []);
  assert.equal(result.stats.scannedFiles, 2);
}));

test('sensitive env files fail even when empty, while templates remain allowed', () => fixture(({ root, write }) => {
  write('.env', ''); write('nested/.env.production', ''); write('.env.sample', '');
  const result = scanRepository(root);
  assert.equal(rules(result).filter(x => x === 'SENSITIVE_ENV_FILE').length, 2);
  assert.equal(result.findings.some(x => x.path === '.env.sample'), false);
}));

test('private key detection uses rule and line without exposing content', () => fixture(({ root, write }) => {
  write('config/keys.txt', `heading\n${syntheticPrivate}\nsecret-bytes-should-not-leak`);
  const result = scanRepository(root);
  assert.deepEqual(result.findings, [{ path: 'config/keys.txt', line: 2, rule: 'PRIVATE_KEY' }]);
  assert.equal(JSON.stringify(result).includes('secret-bytes-should-not-leak'), false);
}));

test('synthetic provider tokens are identified and values withheld', () => fixture(({ root, write }) => {
  write('src/leak.ts', `${syntheticGithub}\n${syntheticPayment}`);
  const result = scanRepository(root);
  assert.deepEqual(rules(result), ['GITHUB_TOKEN', 'LIVE_PAYMENT_SECRET']);
  assert.equal(JSON.stringify(result).includes(syntheticGithub), false);
  assert.equal(JSON.stringify(result).includes(syntheticPayment), false);
}));

test('service account JSON is detected, ordinary Firebase client JSON is not', () => fixture(({ root, write }) => {
  write('firebase.json', JSON.stringify({ type: 'service_account', private_key_id: 'synthetic' }));
  write('google-services.json', JSON.stringify({ project_info: { project_id: 'test' }, client: [] }));
  const result = scanRepository(root);
  assert.deepEqual(rules(result), ['SERVICE_ACCOUNT_CREDENTIAL']);
}));

test('malformed JSON still scans high-confidence text signals', () => fixture(({ root, write }) => {
  write('corrupt.json', '{"credential": "' + syntheticGithub + '"');
  assert.deepEqual(rules(scanRepository(root)), ['GITHUB_TOKEN']);
}));

test('short non-credential examples are ignored', () => fixture(({ root, write }) => {
  write('docs/readme.md', 'ghp_fake\nsk_live_example\n-----BEGIN PUBLIC KEY-----');
  assert.deepEqual(rules(scanRepository(root)), []);
}));

test('skips symlink rather than dereferencing a secret outside root', () => fixture(({ root, write }) => {
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-secret-gate-'));
  try {
    fs.writeFileSync(path.join(external, 'secret.txt'), syntheticPrivate);
    try { fs.symlinkSync(path.join(external, 'secret.txt'), path.join(root, 'link.txt')); }
    catch (error) { if (error.code === 'EPERM') return; throw error; }
    const result = scanRepository(root);
    assert.equal(result.stats.skippedSymlinks, 1);
    assert.deepEqual(result.findings, []);
  } finally { fs.rmSync(external, { recursive: true, force: true }); }
}));

test('does not interpret NUL-containing binaries as text', () => fixture(({ root, write }) => {
  write('data.bin', Buffer.from([0, 1, 2, 3]));
  const result = scanRepository(root);
  assert.equal(result.stats.skippedBinary, 1);
  assert.deepEqual(result.findings, []);
}));

test('unscanned oversized text is a fail-closed error', () => fixture(({ root, write }) => {
  write('oversized.ts', 'a'.repeat(100));
  const result = scanRepository(root, { maxBytes: 16 });
  assert.deepEqual(result.errors, ['OVERSIZED_TEXT_FILE:oversized.ts']);
  assert.throws(() => scanRepository(root, { maxBytes: 0 }), TypeError);
}));

test('missing root reports incomplete scan, not clean', () => {
  const result = scanRepository('/nonexistent-masanawa-secret-gate-123456789');
  assert.deepEqual(result.errors, ['ROOT_UNREADABLE']);
});

test('CLI exit codes: clean 0, finding 1, invalid arguments and nonexistent root 2', () => fixture(({ root, write }) => {
  const messages = [], io = { log: s => messages.push(s), error: s => messages.push(s) };
  assert.equal(runCli(['--root', root, '--json'], io), 0);
  write('secret.ts', syntheticGithub);
  assert.equal(runCli(['--root', root, '--json'], io), 1);
  assert.equal(runCli(['--nope'], io), 2);
  assert.equal(runCli(['--root', '/nonexistent-masanawa-secret-gate-123456789'], io), 2);
  assert.equal(messages.join('').includes(syntheticGithub), false);
}));

test('real CLI subprocess succeeds on clean directory and fails on finding', () => fixture(({ root, write }) => {
  const script = fileURLToPath(new URL('./scan.mjs', import.meta.url));
  const run = () => spawnSync(process.execPath, [script, '--root', root, '--json'], { encoding: 'utf8' });
  let proc = run();
  assert.equal(proc.status, 0);
  assert.equal(JSON.parse(proc.stdout).status, 'CLEAN');
  write('.env', '');
  proc = run();
  assert.equal(proc.status, 1);
  assert.equal(JSON.parse(proc.stdout).status, 'FINDINGS');
}));
