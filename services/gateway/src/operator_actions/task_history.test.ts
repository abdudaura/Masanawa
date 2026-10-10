import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createU04TaskHistory, TaskHistoryError,
  type TaskHistoryRecord, type TaskHistoryPrincipal, type TaskHistoryEvent,
} from "./task_history.js";

const principal: TaskHistoryPrincipal = Object.freeze({
  tenantId: "tenant_A", userId: "user_A", accountId: "account_A",
  sessionId: "session_A", deviceId: "device_A",
});
const taskId = "task_0199abcd-efab-7abc-8abc-abcdefabcdef";
const record: TaskHistoryRecord = Object.freeze({
  taskId, tenantId: "tenant_A", userId: "user_A",
  capabilityId: "human.message.send", capabilityVersion: 1,
  phase: "reconciling", version: 3, operationClass: "send",
  receiptRef: null, errorCode: "DOMAIN_UNCERTAIN",
  updatedAt: "2026-10-10T00:00:00.000Z",
});
const event: TaskHistoryEvent = Object.freeze({
  version: 3, phase: "reconciling", at: "2026-10-10T00:00:00.000Z",
  code: "DOMAIN_UNCERTAIN",
});
const request = { authorizationHeader: "Bearer access-session", principal };

function fixture(overrides: Readonly<{
  rows?: readonly TaskHistoryRecord[];
  task?: TaskHistoryRecord;
  entries?: readonly TaskHistoryEvent[];
  actorTenant?: string;
  actorUser?: string;
  digest?: string;
}> = {}) {
  const called: string[] = [];
  const source = createU04TaskHistory({
    resolveActor: async ({ authorizationHeader, principal: admitted }) => {
      called.push("authorize:" + authorizationHeader);
      assert.equal(admitted.accountId, principal.accountId);
      return Object.freeze({
        tenantId: overrides.actorTenant ?? admitted.tenantId,
        userId: overrides.actorUser ?? admitted.userId,
        sessionDigest: overrides.digest ?? "a".repeat(64),
      });
    },
    tasks: {
      list: async ({ actor, limit }) => {
        called.push("list:" + actor.userId);
        assert.equal(limit, 20);
        return overrides.rows ?? [record];
      },
      read: async ({ actor, taskId: id }) => {
        called.push("read:" + actor.userId);
        assert.equal(id, taskId);
        return overrides.task ?? record;
      },
      events: async ({ actor, taskId: id, afterVersion, limit }) => {
        called.push("events:" + actor.userId);
        assert.equal(id, taskId);
        assert.equal(afterVersion, 0);
        assert.equal(limit, 30);
        return overrides.entries ?? [event];
      },
    },
  });
  return { source, called };
}
function rejectsCode(p: Promise<unknown>, code: string) {
  return assert.rejects(p, (e: unknown) =>
    e instanceof TaskHistoryError && e.code === code);
}

describe("U04 canonical U02 task journal readback", () => {
  it("reads a durable pending task as pending, without a false receipt", async () => {
    const { source, called } = fixture();
    const recent = await source.recent(request);
    assert.equal(recent.length, 1);
    assert.deepEqual(recent[0], {
      taskId, capabilityId: "human.message.send", capabilityVersion: 1,
      phase: "reconciling", version: 3, operationClass: "send",
      receiptAvailable: false, errorCode: "DOMAIN_UNCERTAIN",
      updatedAt: "2026-10-10T00:00:00.000Z",
    });
    assert.deepEqual(called, ["authorize:Bearer access-session", "list:user_A"]);
    assert.equal(JSON.stringify(recent).includes("sessionDigest"), false);
  });
  it("reads authoritative history, never provider receipt secrets or raw task fields", async () => {
    const { source, called } = fixture({
      task: { ...record, phase: "succeeded", version: 4, receiptRef: "provider-private-reference" },
      entries: [{ version: 4, phase: "succeeded", code: "NOT SAFE: details", at: event.at }],
    });
    const out = await source.detail({ ...request, taskId });
    assert.equal(out.task.receiptAvailable, true);
    assert.equal(out.events[0]?.code, null);
    assert.equal(JSON.stringify(out).includes("provider-private-reference"), false);
    assert.deepEqual(called, [
      "authorize:Bearer access-session", "read:user_A", "events:user_A",
    ]);
  });
  it("fails closed when the server actor does not match the admitted principal", async () => {
    for (const input of [{ actorUser: "user_B" }, { actorTenant: "tenant_B" }, { digest: "bad" }]) {
      const { source, called } = fixture(input);
      await rejectsCode(source.recent(request), "OPERATOR_UNAUTHORIZED");
      assert.equal(called.some(x => x.startsWith("list:")), false);
    }
  });
  it("blocks cross-account task records even when the journal adapter errs", async () => {
    const { source } = fixture({ rows: [{ ...record, userId: "user_B" }] });
    await rejectsCode(source.recent(request), "OPERATOR_FORBIDDEN");
  });
  it("does not treat journal success without domain receipt as confirmed", async () => {
    const { source } = fixture({ task: { ...record, phase: "succeeded", receiptRef: null } });
    await rejectsCode(source.detail({ ...request, taskId }), "OPERATOR_SOURCE_UNAVAILABLE");
  });
  it("rejects unbounded pages, foreign task IDs and invalid event data", async () => {
    const bulk = fixture({ rows: Array(21).fill(record) });
    await rejectsCode(bulk.source.recent(request), "OPERATOR_SOURCE_UNAVAILABLE");
    const corrupt = fixture({ entries: [{ ...event, version: 99 }] });
    await rejectsCode(corrupt.source.detail({ ...request, taskId }), "OPERATOR_SOURCE_UNAVAILABLE");
    const normal = fixture();
    await rejectsCode(normal.source.detail({ ...request, taskId: "task_../other" }),
      "OPERATOR_INVALID_ARGUMENTS");
    assert.equal(normal.called.length, 0);
  });
  it("requires real Bearer session binding before canonical journal access", async () => {
    const h = fixture();
    await rejectsCode(h.source.recent({ ...request, authorizationHeader: "Basic forged" }),
      "OPERATOR_UNAUTHORIZED");
    assert.equal(h.called.length, 0);
  });
});
