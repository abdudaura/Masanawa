import test from "node:test";
import assert from "node:assert/strict";
import { createPublishedAudioReportService, PublishedAudioReportError } from "./reporting.ts";

const actor = { tenantId: "tenant-1", accountId: "account-1", authorId: "user-1", authorKind: "human" };
const post = {tenantId: actor.tenantId, postId: "post-1", authorAccountId: "account-2", status: "published"};
function harness(overrides = {}) {
  let calls = [];
  let identityCalls = 0;
  const deps = {
    requireActor: async () => { identityCalls++; return actor; },
    repository: { byId: async () => post },
    visibility: { canView: async () => true },
    safety: { report: async (input) => {
      calls.push(input);
      return {reportId: "report-1", accepted: true};
    } },
    ...overrides,
  };
  return {
    service: createPublishedAudioReportService(deps),
    calls,
    get identityCalls() { return identityCalls; },
  };
}
const input = () => ({
  authorization: "Bearer current-session",
  postId: "post-1",
  body: {reason: "harassment", clientRequestId: "report-request-1", detail: "Abusive audio"},
});
async function denies(promise, code) {
  await assert.rejects(promise, error =>
    error instanceof PublishedAudioReportError && error.code === code);
}
test("valid published Talk reports via canonical TalkSafetyService with a disambiguated target", async () => {
  const h = harness();
  assert.deepEqual(await h.service.report(input()), {reportId: "report-1", accepted: true});
  assert.equal(h.identityCalls, 2);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0], {
    authorizationHeader: "Bearer current-session",
    targetKind: "talk",
    targetId: "published-audio:post-1",
    reason: "harassment",
    clientRequestId: "report-request-1",
    detail: "Abusive audio",
  });
});
test("hidden, removed, processing, foreign tenant and absent posts all deny without reporting", async () => {
  for (const p of [null, {...post,status: "removed"}, {...post,status: "processing"},
                   {...post,tenantId: "tenant-2"}]) {
    const h = harness({ repository: { byId: async () => p } });
    await denies(h.service.report(input()), "NOT_FOUND");
    assert.deepEqual(h.calls, []);
  }
  const h = harness({ visibility: {canView: async () => false} });
  await denies(h.service.report(input()), "NOT_FOUND");
  assert.equal(h.calls.length, 0);
});
test("rejects malformed bodies, IDs, unknown reasons and client-forged fields", async () => {
  for (const change of [
    { postId: "../../private" },
    { body: { reason: "spam", clientRequestId: "ok", tenantId: "other" } },
    { body: { reason: "unknown", clientRequestId: "ok" } },
    { body: { reason: "spam", clientRequestId: "" } },
    { body: { reason: "spam", clientRequestId: "ok", detail: "x".repeat(401) } },
  ]) {
    const h = harness();
    await denies(h.service.report({...input(),...change}), "VALIDATION");
    assert.deepEqual(h.calls, []);
  }
});
test("session rotation between lookup and safety write fails closed", async () => {
  let current = 0;
  const h = harness({requireActor: async () =>
    (++current === 1 ? actor : {...actor,accountId: "account-3"})});
  await denies(h.service.report(input()), "AUTH_REQUIRED");
  assert.equal(h.calls.length, 0);
});
test("an unavailable canonical safety receipt is not reported as a successful submission", async () => {
  const h = harness({safety: {report: async () => ({accepted: false})}});
  await denies(h.service.report(input()), "CAPABILITY_UNAVAILABLE");
});
test("unexpected visibility/backend faults propagate; no fabricated acceptance", async () => {
  const h = harness({visibility: {canView: async () => {throw new Error("db down")}}});
  await assert.rejects(h.service.report(input()), /db down/);
  assert.deepEqual(h.calls, []);
});
