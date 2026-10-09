import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditSnapshot, loadGithubSnapshot, parseArgs, main } from './audit-draft-pr-collisions.mjs';

const sha = (digit) => digit.repeat(40);
const create = (number, title, names, body = 'docs/workstreams/u00-handoff.md') => ({
  number, title, body, draft: true, head: { sha: sha((number % 10).toString()) },
  completeFiles: true, files: names.map(([filename, blob = sha('a')]) => ({ filename, sha: blob, status: 'modified' })),
});
const snap = (pulls) => ({ repository: 'Baatiku/masanawa', mainSha: sha('a'), pulls });
function capture() {
  let stdout = '', stderr = '';
  return {
    out: { write(value) { stdout += value; } },
    err: { write(value) { stderr += value; } },
    get stdout() { return stdout; }, get stderr() { return stderr; },
  };
}

test('C02 competing migrations and shared Gateway change produce reviewable evidence', () => {
  const result = auditSnapshot(snap([
    create(472, 'C02 original DM', [
      ['services/gateway/src/app.ts', sha('1')],
      ['packages/talks/migrations/0017_human_dm_core.sql', sha('1')],
    ]),
    create(475, 'C02 duplicate DM', [
      ['services/gateway/src/app.ts', sha('2')],
      ['packages/talks/migrations/0017_human_dm_messages.sql', sha('2')],
    ]),
  ]));
  assert.equal(result.summary.pathCollisions, 1);
  assert.equal(result.pathCollisions[0].risk, 'critical');
  assert.deepEqual(result.pathCollisions[0].prs.map(p => p.number), [472, 475]);
  assert.equal(result.pathCollisions[0].identicalBlob, false);
  assert.deepEqual(result.migrationCollisions.map(x => x.key), ['packages/talks/migrations/0017']);
  assert.equal(result.summary.incompletePullRequests, 0);
});

test('detects conflicting ownership titles only at beginning of PR title', () => {
  const result = auditSnapshot(snap([
    create(508, 'U21 Contacts Hub', []), create(518, 'U21: another Contacts Hub', []),
    create(519, 'Docs discussing U21', []),
  ]));
  assert.deepEqual(result.scopeCollisions.map(x => x.key), ['U21']);
  assert.deepEqual(result.scopeCollisions[0].prs.map(x => x.number), [508, 518]);
});

test('Firebase preservation overlapping blob is critical even with same SHA', () => {
  const path = 'apps/mobile/android/app/google-services.json';
  const result = auditSnapshot(snap([create(461, 'Firebase', [[path]]), create(497, 'Work', [[path]])]));
  assert.equal(result.summary.criticalPathCollisions, 1);
  assert.equal(result.pathCollisions[0].identicalBlob, true);
});

test('incomplete listing, missing HEAD and missing handoff are never silently green', () => {
  const first = create(100, 'F11 audit', [], '');
  first.completeFiles = false;
  first.head.sha = null;
  const result = auditSnapshot(snap([first]));
  assert.deepEqual(result.missingHandoffPointers, [100]);
  assert.equal(result.summary.incompletePullRequests, 1);
  assert.deepEqual(result.incomplete.map(x => x.reason), ['missing_head_sha', 'unverified_file_list']);
});

test('rejects malformed PRs, repeated files and duplicates', () => {
  assert.throws(() => auditSnapshot({ pulls: {} }), /snapshot.pulls/);
  assert.throws(() => auditSnapshot(snap([create(1, 'ok', []), create(1, 'duplicate', [])])), /duplicate PR/);
  assert.throws(() => auditSnapshot(snap([create(1, 'bad', [['a.ts'], ['a.ts']])])), /repeated file/);
});

test('CLI strict returns 2 for candidate collisions, emits JSON, and never changes GitHub', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'masanawa-audit-'));
  try {
    const source = join(dir, 'snapshot.json'), target = join(dir, 'report.json');
    await writeFile(source, JSON.stringify(snap([create(1, 'a', [['x.ts']]), create(2, 'b', [['x.ts']])])));
    const cap = capture();
    const exit = await main(['--snapshot', source, '--strict', '--output', target], { out: cap.out, err: cap.err });
    assert.equal(exit, 2);
    assert.match(cap.stderr, /REVIEW REQUIRED/);
    assert.equal(cap.stdout, '');
    assert.equal(JSON.parse(await readFile(target, 'utf8')).summary.pathCollisions, 1);
  } finally { await rm(dir, { force: true, recursive: true }); }
});

test('CLI fails closed on absent main SHA and credentials', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'masanawa-audit-'));
  try {
    const source = join(dir, 'snapshot.json');
    await writeFile(source, JSON.stringify({ pulls: [] }));
    const cap = capture();
    assert.equal(await main(['--snapshot', source], { out: cap.out, err: cap.err }), 3);
    assert.match(cap.stderr, /INCOMPLETE/);
  } finally { await rm(dir, { force: true, recursive: true }); }
  const cap = capture();
  assert.equal(await main(['--live', '--repo', 'Baatiku/masanawa'], { out: cap.out, err: cap.err, env: {} }), 3);
  assert.match(cap.stderr, /GITHUB_TOKEN/);
});

test('CLI argument validation disallows invalid source selection', () => {
  assert.throws(() => parseArgs(['--snapshot', 's', '--live', '--repo', 'r/a']), /not both/);
  assert.throws(() => parseArgs(['--other']), /unknown argument/);
});

test('authenticated live reader paginates file lists without missing second page', async () => {
  const firstPage = Array.from({ length: 100 }, (_, i) => ({ filename: 'file' + i + '.ts', sha: sha('a') }));
  const seen = [];
  const fetcher = async (url, init) => {
    const u = new URL(url);
    seen.push({ path: u.pathname, page: u.searchParams.get('page'), auth: init.headers.Authorization });
    let json;
    if (u.pathname === '/repos/test/repo') json = { default_branch: 'main' };
    else if (u.pathname === '/repos/test/repo/branches/main') json = { commit: { sha: sha('a') } };
    else if (u.pathname === '/repos/test/repo/pulls') json = [{ number: 3, title: 'U21', body: '', head: { sha: sha('3') }, changed_files: 101 }];
    else if (u.pathname === '/repos/test/repo/pulls/3/files')
      json = u.searchParams.get('page') === '1' ? firstPage : [{ filename: 'last.ts', sha: sha('b') }];
    else if (u.pathname === '/repos/test/repo/pulls/3') json = { head: { sha: sha('3') }, changed_files: 101 };
    else throw new Error('wrong URL');
    return { ok: true, json: async () => json };
  };
  const result = await loadGithubSnapshot({ repo: 'test/repo', token: 'testing', fetcher });
  assert.equal(result.pulls[0].completeFiles, true);
  assert.equal(result.pulls[0].headStable, true);
  assert.equal(result.pulls[0].files.length, 101);
  assert.ok(seen.some(x => x.path.endsWith('/files') && x.page === '2'));
  assert.ok(seen.every(x => x.auth === 'Bearer testing'));
});

test('GitHub failures never echo authentication tokens or remote bodies', async () => {
  await assert.rejects(
    loadGithubSnapshot({ repo: 'test/repo', token: 'private-secret', fetcher: async () => ({ ok: false, status: 403 }) }),
    (error) => /HTTP 403/.test(error.message) && !error.message.includes('private-secret'),
  );
  await assert.rejects(loadGithubSnapshot({ repo: '../evil', token: 'private-secret' }), /expected owner\/repo/);
});

test('one PR with two migration filenames at the same sequence is critical', () => {
  const result = auditSnapshot(snap([create(600, 'F15 migration', [
    ['packages/talks/migrations/0017_first.sql'],
    ['packages/talks/migrations/0017_second.sql'],
  ])]));
  assert.equal(result.summary.pathCollisions, 0);
  assert.equal(result.summary.migrationCollisions, 1);
  assert.equal(result.migrationCollisions[0].withinPullRequest, true);
  assert.deepEqual(result.migrationCollisions[0].prs.map(p => p.filename), [
    'packages/talks/migrations/0017_first.sql',
    'packages/talks/migrations/0017_second.sql',
  ]);
});

test('live snapshot becomes incomplete if PR head moves during file retrieval', async () => {
  const oldSha = sha('1'), newSha = sha('2');
  const fetcher = async url => {
    const u = new URL(url);
    let json;
    if (u.pathname === '/repos/test/repo') json = { default_branch: 'main' };
    else if (u.pathname.endsWith('/branches/main')) json = { commit: { sha: sha('a') } };
    else if (u.pathname === '/repos/test/repo/pulls') json = [{ number: 1, title: 'U21', head: { sha: oldSha } }];
    else if (u.pathname.endsWith('/pulls/1/files')) json = [{ filename: 'new-code.ts', sha: sha('b') }];
    else if (u.pathname.endsWith('/pulls/1')) json = { head: { sha: newSha }, changed_files: 1 };
    else throw new Error('wrong URL');
    return { ok: true, json: async () => json };
  };
  const result = await loadGithubSnapshot({ repo: 'test/repo', token: 'fake', fetcher });
  assert.equal(result.pulls[0].headStable, false);
  assert.equal(result.pulls[0].completeFiles, false);
  const report = auditSnapshot(result);
  assert.equal(report.summary.incompletePullRequests, 1);
  assert.deepEqual(report.incomplete.map(x => x.reason), ['unverified_file_list', 'head_changed_during_audit']);
});

test('live snapshot becomes incomplete when authenticated detail count disagrees', async () => {
  const fetcher = async url => {
    const u = new URL(url);
    let json;
    if (u.pathname === '/repos/test/repo') json = { default_branch: 'main' };
    else if (u.pathname.endsWith('/branches/main')) json = { commit: { sha: sha('a') } };
    else if (u.pathname === '/repos/test/repo/pulls') json = [{ number: 1, title: 'U21', head: { sha: sha('1') } }];
    else if (u.pathname.endsWith('/pulls/1/files')) json = [{ filename: 'a.ts', sha: sha('b') }];
    else if (u.pathname.endsWith('/pulls/1')) json = { head: { sha: sha('1') }, changed_files: 2 };
    else throw new Error('wrong URL');
    return { ok: true, json: async () => json };
  };
  const result = await loadGithubSnapshot({ repo: 'test/repo', token: 'fake', fetcher });
  assert.equal(result.pulls[0].headStable, true);
  assert.equal(result.pulls[0].completeFiles, false);
  assert.equal(auditSnapshot(result).summary.incompletePullRequests, 1);
});
