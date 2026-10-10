import assert from 'node:assert/strict';
import test from 'node:test';
import { runOrphanCleanup } from './orphan_cleanup.ts';

const NOW = Date.parse('2026-10-10T00:00:00Z');
const DAY = 24 * 3600_000;
const candidate = (id, changes = {}) => ({ id, objectKey: "private/tenant_A/" + id + ".opus", revision: 3,
  createdAtMs: NOW - 3 * DAY, retainUntilMs: NOW - DAY, ...changes });
function fixture(rows, { claim, failDelete, failMark } = {}) {
  const events = [];
  const repository = {
    async listCandidates(arg) { events.push(['list', arg]); return rows; },
    async claimForPurge(arg) {
      events.push(['claim', arg]);
      if (claim === false) return null;
      if (typeof claim === 'function') return claim(arg);
      return { id: arg.id, objectKey: arg.objectKey, leaseId: 'lease_123', expiresAtMs: NOW + 60_000 };
    },
    async markPurged(lease) { events.push(['purged', lease.id]); if (failMark) throw Error('DB unavailable'); },
    async markRetryable(lease) { events.push(['retry', lease.id]); },
  };
  const objects = { async deleteObject(key) { events.push(['delete', key]); if (failDelete) throw Error('provider secret'); } };
  return { events, repository, objects,
    opts: { repository, objects, allowedPrefixes: ['private/tenant_A/'], nowMs: NOW, minAgeMs: DAY } };
}

test('dry run is the default: no reservation and no deletion', async () => {
  const f = fixture([candidate('a')]);
  assert.deepEqual(await runOrphanCleanup(f.opts), { scanned: 1, eligible: 1, skipped: 0,
    leased: 0, deleted: 0, failed: 0, dryRun: true });
  assert.deepEqual(f.events.map(e=>e[0]), ['list']);
});

test('leased eligible object is deleted once and transaction marked purged', async () => {
  const f = fixture([candidate('a')]);
  const result = await runOrphanCleanup({ ...f.opts, allowDelete: true });
  assert.equal(result.deleted, 1);
  assert.deepEqual(f.events.map(e=>e[0]), ['list','claim','delete','purged']);
  assert.equal(f.events[1][1].expectedRevision, 3);
});

test('referenced/financial held object denied by repository is never deleted', async () => {
  const f = fixture([candidate('a')], { claim: false });
  const result = await runOrphanCleanup({ ...f.opts, allowDelete: true });
  assert.equal(result.deleted, 0); assert.equal(result.skipped, 1);
  assert.deepEqual(f.events.map(e=>e[0]), ['list','claim']);
});

test('too young or retained objects are skipped before CAS', async () => {
  const f = fixture([candidate('a', { createdAtMs: NOW - 1 }),
    candidate('b', { retainUntilMs: NOW + 1 })]);
  const r = await runOrphanCleanup({ ...f.opts, allowDelete: true });
  assert.equal(r.skipped, 2); assert.equal(r.eligible, 0);
  assert.deepEqual(f.events.map(e=>e[0]), ['list']);
});

test('object errors trigger retryable status without leaking provider error', async () => {
  const f = fixture([candidate('a')], { failDelete: true });
  const result = await runOrphanCleanup({ ...f.opts, allowDelete: true });
  assert.equal(result.failed, 1); assert.equal(result.deleted, 0);
  assert.deepEqual(f.events.map(e=>e[0]), ['list','claim','delete','retry']);
});

test('database completion outage is not falsely reported as successful', async () => {
  const f = fixture([candidate('a')], { failMark: true });
  await assert.rejects(runOrphanCleanup({ ...f.opts, allowDelete: true }), /DB unavailable/);
});

test('invalid key and cross-tenant key fail before any lease or object call', async () => {
  for (const objectKey of ['/absolute/key','private/tenant_A/../secret',
    'private/tenant_B/nope', 'https://foreign.site/file', 'private/tenant_A/a?secret=1']) {
    const f = fixture([candidate('a', { objectKey })]);
    await assert.rejects(runOrphanCleanup({ ...f.opts, allowDelete: true }), TypeError);
    assert.deepEqual(f.events.map(e=>e[0]), ['list']);
  }
});

test('duplicate ids or keys and unbounded pages fail closed', async () => {
  for (const rows of [[candidate('a'), candidate('a')],
    [candidate('a'), candidate('b', { objectKey: candidate('a').objectKey })],
    [candidate('a'), candidate('b')]]) {
    const f = fixture(rows);
    await assert.rejects(runOrphanCleanup({ ...f.opts, maxCandidates: 1, allowDelete: true }), TypeError);
    assert.deepEqual(f.events.map(e=>e[0]), ['list']);
  }
});

test('malformed lease never authorizes a delete', async () => {
  for (const result of [
    { id: 'other', objectKey: candidate('a').objectKey, leaseId: 'l1', expiresAtMs: NOW + 1000 },
    { id: 'a', objectKey: 'private/tenant_B/z.opus', leaseId: 'l1', expiresAtMs: NOW + 1000 },
    { id: 'a', objectKey: candidate('a').objectKey, leaseId: 'l1', expiresAtMs: NOW - 1 },
  ]) {
    const f = fixture([candidate('a')], { claim: () => result });
    await assert.rejects(runOrphanCleanup({ ...f.opts, allowDelete: true }), TypeError);
    assert.deepEqual(f.events.map(e=>e[0]), ['list','claim']);
  }
});

test('bounded destructive sweep does not lease more than maxDeletes', async () => {
  const f = fixture([candidate('a'), candidate('b'), candidate('c')]);
  const r = await runOrphanCleanup({ ...f.opts, allowDelete: true, maxDeletes: 2 });
  assert.equal(r.deleted, 2); assert.equal(r.eligible, 3);
  assert.equal(f.events.filter(e=>e[0]==='claim').length, 2);
});

test('invalid configuration fails before reading repository', async () => {
  for (const changes of [
    { allowedPrefixes: ['*'] }, { allowedPrefixes: [] }, { allowedPrefixes: ['private/../'] },
    { allowedPrefixes: ['private/'] },
    { maxDeletes: 100 }, { maxCandidates: 0 }, { minAgeMs: 10 }, { nowMs: Number.NaN },
  ]) {
    const f = fixture([candidate('a')]);
    await assert.rejects(runOrphanCleanup({ ...f.opts, ...changes, allowDelete: true }), TypeError);
    assert.equal(f.events.length, 0);
  }
});

test('nonboolean truthy delete flag never authorizes deletion', async () => {
  const f = fixture([candidate('a')]);
  const r = await runOrphanCleanup({ ...f.opts, allowDelete: 1 });
  assert.equal(r.dryRun, true); assert.equal(r.deleted, 0);
  assert.deepEqual(f.events.map(e=>e[0]), ['list']);
});
