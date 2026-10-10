import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { verifyEvidenceFile } from './evidence_path_guard.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');

test('accepts only a bounded regular artifact matching its SHA-256', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'af13-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'proof'));
  await writeFile(path.join(root, 'proof', 'result.json'), '{"ok":true}');
  assert.deepEqual(await verifyEvidenceFile(root, 'proof/result.json', sha('{"ok":true}')), {
    path: 'proof/result.json', sha256: sha('{"ok":true}'), bytes: 11
  });
  await assert.rejects(verifyEvidenceFile(root, 'proof/result.json', sha('altered')), { code: 'DIGEST_MISMATCH' });
  await assert.rejects(verifyEvidenceFile(root, 'proof/result.json', sha('{"ok":true}'), 4), { code: 'OVERSIZE' });
});

test('rejects traversal, absolute paths, odd separators and invalid digests', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'af13-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const bad of ['../secret', 'a/../b', '/etc/passwd', 'a//b', 'a/./b', 'a\\b', 'a/']) {
    await assert.rejects(verifyEvidenceFile(root, bad, sha('')), { code: 'UNSAFE_PATH' });
  }
  await assert.rejects(verifyEvidenceFile(root, 'safe', 'not-a-hash'), { code: 'INVALID_DIGEST' });
});

test('rejects both symlink leaves and symlink directories', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'af13-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'real'));
  await writeFile(path.join(root, 'real', 'file'), 'test');
  await symlink(path.join(root, 'real', 'file'), path.join(root, 'link'));
  await symlink(path.join(root, 'real'), path.join(root, 'alias'));
  await assert.rejects(verifyEvidenceFile(root, 'link', sha('test')), { code: 'SYMLINK' });
  await assert.rejects(verifyEvidenceFile(root, 'alias/file', sha('test')), { code: 'SYMLINK' });
});


test('empty evidence cannot satisfy a matching digest', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'af13-path-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'empty'), '');
  await assert.rejects(verifyEvidenceFile(root, 'empty', sha('')), { code: 'EMPTY' });
});
