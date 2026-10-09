import test from 'node:test';
import assert from 'node:assert/strict';
import { assessHandoff, checkGitHubHandoff, githubReadOnlyRequest } from './check.mjs';
const head = 'a'.repeat(40);
const base = 'b'.repeat(40);
const path = 'docs/workstreams/f11-handoff-evidence-integrity-20261009.md';
const note = 'PARTIAL_IMPLEMENTATION; draft, unmerged; tests NOT_RUN pending device verification.';
const pr = { number: 999, state: 'open', draft: true, merged_at: null, head: { sha: head }, base: { ref: 'main', sha: base }, body: `Handoff: ${path}\nHEAD ${head}` };
const check = (patch = {}, files = [path], docs = { [path]: note }) => assessHandoff({ ...pr, ...patch }, files, docs);
test('valid handoff is only structure-pass, never E2E', () => {
  const r = check(); assert.equal(r.verdict, 'STRUCTURE_PASS_NOT_E2E'); assert.equal(r.evidence.length, 1); assert.match(r.warnings[0], /unverified/);
});
test('stale SHA fails', () => { assert.match(check({ body: `Handoff: ${path} HEAD ${base}` }).errors.join(), /current head SHA/); });
test('no handoff link fails', () => { assert.match(check({ body: head }).errors.join(), /does not link/); });
test('doc not actually changed fails', () => { assert.match(check({}, []).errors.join(), /not among PR/); });
test('missing pinned handoff fails', () => { assert.match(check({}, [path], {}).errors.join(), /Missing committed/); });
test('missing test notes or disposition fails', () => { const r = check({}, [path], { [path]: 'PARTIAL_IMPLEMENTATION' }); assert.equal(r.errors.length, 2); });
test('merged or ready-for-review PR fails', () => { assert.match(check({ draft: false }).errors.join(), /not open/); assert.match(check({ merged_at: 'today' }).errors.join(), /not open/); });
test('protects against body-linked parent traversal', () => { const p = 'docs/workstreams/../other.md'; assert.equal(check({ body: `${head} ${p}` }, [p], { [p]: note }).verdict, 'STRUCTURE_FAIL'); });
test('reads exact pinned handoff content through injected API', async () => {
  const seen = []; const request = async pathValue => { seen.push(pathValue); if (pathValue.endsWith('/pulls/999')) return pr; if (pathValue.includes('/files?')) return [{ filename: path }]; if (pathValue.includes('/contents/')) return { encoding: 'base64', content: Buffer.from(note).toString('base64') }; throw Error('unexpected'); };
  const r = await checkGitHubHandoff({ repo: 'Baatiku/masanawa', number: 999, request });
  assert.equal(r.verdict, 'STRUCTURE_PASS_NOT_E2E'); assert.ok(seen.at(-1).endsWith(`?ref=${head}`));
});
test('rejects invalid repo, PR number and oversized pagination', async () => {
  await assert.rejects(checkGitHubHandoff({ repo: 'x/../y', number: 1, request: async()=>[] }), /Expected/);
  await assert.rejects(checkGitHubHandoff({ repo: 'x/y', number: -3, request: async()=>[] }), /Expected/);
  const request = async p => p.endsWith('/pulls/999') ? pr : Array(100).fill({ filename: 'x' });
  await assert.rejects(checkGitHubHandoff({ repo: 'x/y', number: 999, request }), /exceeds bounded/);
});
test('rejects arbitrary GitHub endpoint before any network request', async () => { await assert.rejects(githubReadOnlyRequest()('/repos/x/y/actions/runs'), /Disallowed/); });
