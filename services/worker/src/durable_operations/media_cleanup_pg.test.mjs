import { test } from "node:test";
import assert from "node:assert/strict";
import { createPgMediaCleanupRepository } from "./media_cleanup_pg.js";

const now = Date.now();
const key = "tenant_123456789012/audio_post/some-private-audio";
const candidate = Object.freeze({
  tenantId: "tenant_123456789012", objectKey: key,
  objectVersion: "version_v1234567890123456", kind: "audio_post",
  leaseToken: "secure_cleanup_lease_token_1234", referenceRevision: 3,
  createdAtMs: now - 72 * 3_600_000,
  retainUntilMs: now - 48 * 3_600_000,
});
const row = {
  tenant_id: candidate.tenantId, object_key: candidate.objectKey,
  object_version: candidate.objectVersion, kind: candidate.kind,
  lease_token: candidate.leaseToken, reference_revision: candidate.referenceRevision,
  created_at_ms: String(candidate.createdAtMs), retain_until_ms: String(candidate.retainUntilMs),
};
const ready = {
  reference_revision: candidate.referenceRevision,
  created_at_ms: String(candidate.createdAtMs), retain_until_ms: String(candidate.retainUntilMs),
  active_references: 0, active_holds: 0, immutable: true,
  link_guard_installed: true, domain_refs_reconciled: true,
};
function fixture(next = () => ({ rows: [], rowCount: 0 })) {
  const calls = [];
  let released = 0;
  const repo = createPgMediaCleanupRepository({
    async connect() {
      return {
        async query(sql, params) {
          calls.push({ sql, params });
          return next(sql, params);
        },
        release() { released++; },
      };
    },
  });
  return { repo, calls, get released() { return released; } };
}

test("claim enforces atomic SKIP LOCKED selection, live refs/holds and explicit attestation", async () => {
  const f = fixture(() => ({ rows: [row], rowCount: 1 }));
  const results = await f.repo.claim({ workerId: "worker_instance_12345678", nowMs: now, max: 5 });
  assert.deepEqual(results, [candidate]);
  assert.equal(f.released, 1);
  assert.deepEqual(f.calls[0].params, [5, "worker_instance_12345678"]);
  for (const necessary of [
    "FOR UPDATE OF o SKIP LOCKED", "delete_approved IS TRUE",
    "link_guard_installed IS TRUE", "domain_refs_reconciled IS TRUE",
    "ops.media_cleanup_references", "ops.media_cleanup_holds",
    "gen_random_uuid()", "status = 'deleting'", "RETURNING o.tenant_id",
  ]) assert.ok(f.calls[0].sql.includes(necessary), necessary);
});
test("rejects invalid limits and workers before touching PostgreSQL", async () => {
  const f = fixture();
  await assert.rejects(f.repo.claim({ workerId: "x", nowMs: now, max: 1 }), /invalid_claim/);
  await assert.rejects(f.repo.claim({ workerId: "worker_instance_12345678", nowMs: now, max: 51 }), /invalid_claim/);
  assert.equal(f.calls.length, 0);
});
test("a corrupt provider row is never returned to object deletion", async () => {
  const f = fixture(() => ({ rows: [{ ...row, object_key: "tenant_untrusted/../bad" }], rowCount: 1 }));
  await assert.rejects(f.repo.claim({ workerId: "worker_instance_12345678", nowMs: now, max: 1 }), /invalid_database_claim/);
  assert.equal(f.released, 1);
});
test("preflight verifies same tenant/key/version/lease/revision and current holds", async () => {
  const f = fixture(() => ({ rows: [ready], rowCount: 1 }));
  assert.deepEqual(await f.repo.preflight(candidate), {
    state: "ready", referenceRevision: 3,
    activeReferences: 0, activeHolds: 0, immutable: true,
  });
  assert.deepEqual(f.calls[0].params, [
    candidate.tenantId, candidate.objectKey, candidate.objectVersion,
    candidate.leaseToken, candidate.referenceRevision,
  ]);
  assert.ok(f.calls[0].sql.includes("lease_expires_at > clock_timestamp()"));
  assert.ok(f.calls[0].sql.includes("FOR UPDATE OF o"));
});
test("preflight fails closed on holds, references, incomplete fences or changed timestamps", async () => {
  for (const change of [
    { active_holds: 1 }, { active_references: 1 }, { domain_refs_reconciled: false },
    { link_guard_installed: false }, { created_at_ms: String(now - 1000) },
    { retain_until_ms: String(now + 5_000) }, { immutable: false },
  ]) {
    const f = fixture(() => ({ rows: [{ ...ready, ...change }], rowCount: 1 }));
    assert.deepEqual(await f.repo.preflight(candidate), { state: "blocked" });
  }
});
test("missing or expired lease is not confused with ready", async () => {
  const f = fixture();
  assert.deepEqual(await f.repo.preflight(candidate), { state: "lease-lost" });
  assert.equal(f.released, 1);
});
test("complete requires one durable lease-fenced update and live reference check", async () => {
  const good = fixture(() => ({ rows: [{ object_key: key }], rowCount: 1 }));
  assert.equal(await good.repo.complete(candidate), true);
  assert.ok(good.calls[0].sql.includes("NOT EXISTS"));
  assert.ok(good.calls[0].sql.includes("status = 'deleted'"));
  const denied = fixture(() => ({ rows: [], rowCount: 0 }));
  assert.equal(await denied.repo.complete(candidate), false);
});
test("an uncertain result quarantines the original lease rather than retrying deletion", async () => {
  const f = fixture(() => ({ rows: [], rowCount: 1 }));
  await f.repo.stop(candidate, "uncertain");
  assert.ok(f.calls[0].sql.includes("status = 'quarantined'"));
  assert.deepEqual(f.calls[0].params.slice(0, 5), [
    candidate.tenantId, candidate.objectKey, candidate.objectVersion,
    candidate.leaseToken, candidate.referenceRevision,
  ]);
  assert.equal(f.calls[0].params[5], "uncertain");
});
test("invalid candidate cannot update a foreign tenant or release an unrelated lease", async () => {
  const f = fixture();
  await f.repo.stop({ ...candidate, tenantId: "tenant_bad" }, "uncertain");
  assert.equal(f.calls.length, 0);
  await assert.rejects(f.repo.stop(candidate, "retry"), /invalid_stop_reason/);
});
test("always releases the connected client after a database exception", async () => {
  const f = fixture(() => { throw new Error("DB offline"); });
  await assert.rejects(f.repo.claim({ workerId: "worker_instance_12345678", nowMs: now, max: 1 }), /DB offline/);
  assert.equal(f.released, 1);
});
