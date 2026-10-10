import test from "node:test";
import assert from "node:assert/strict";
import { createAudioPostProcessingWorker } from "./processing_worker.ts";

const pending = {
  tenantId: "tenantA", postId: "postA", revision: 0,
  createdAt: "2026-10-10T00:00:00.000Z",
};

async function sweep(failure) {
  const observed = { calls: [], logged: [] };
  const worker = createAudioPostProcessingWorker({
    queue: {
      async listPending(scope) {
        observed.calls.push(["page", scope]);
        return { items: [pending], nextCursor: null };
      },
      async withLease(scope, work) {
        observed.calls.push(["lock", scope]);
        return work();
      },
    },
    settler: {
      async settle(scope) {
        observed.calls.push(["settle", scope]);
        throw failure;
      },
    },
    onError: event => observed.logged.push(event),
  });
  return { result: await worker.runOnce({tenantId: "tenantA"}), ...observed };
}

test("PostgreSQL settle CAS miss after post removal is changed, not a retryable moderation failure", async () => {
  const out = await sweep(new Error("audio_posts.settle_conflict"));
  assert.equal(out.result.scanned, 1);
  assert.equal(out.result.changed, 1);
  assert.equal(out.result.published, 0);
  assert.equal(out.result.rejected, 0);
  assert.equal(out.result.retryableErrors, 0);
  assert.equal(out.logged.length, 0);
  assert.deepEqual(out.calls[2], ["settle", {
    tenantId: "tenantA", postId: "postA", expectedRevision: 0,
  }]);
});

test("typed service revision conflict is also changed, without re-settling", async () => {
  const out = await sweep(Object.assign(new Error("Post changed"), {code: "CONFLICT"}));
  assert.equal(out.result.changed, 1);
  assert.equal(out.result.retryableErrors, 0);
  assert.equal(out.calls.filter(([operation]) => operation === "settle").length, 1);
});

test("real database query errors remain retryable and observable", async () => {
  const original = Object.assign(new Error("db connection lost"), {code: "57P01"});
  const out = await sweep(original);
  assert.equal(out.result.changed, 0);
  assert.equal(out.result.retryableErrors, 1);
  assert.equal(out.logged.length, 1);
  assert.equal(out.logged[0].error, original);
  assert.equal(out.logged[0].stage, "settle");
});

test("unrecognized fake CAS labels must not hide actual failures", async () => {
  const out = await sweep(new Error("some other operation has a conflict"));
  assert.equal(out.result.changed, 0);
  assert.equal(out.result.retryableErrors, 1);
  assert.equal(out.logged.length, 1);
});

test("plain object spoofing PostgreSQL error message is not silently discarded", async () => {
  const out = await sweep({message: "audio_posts.settle_conflict"});
  assert.equal(out.result.changed, 0);
  assert.equal(out.result.retryableErrors, 1);
  assert.equal(out.logged.length, 1);
});
