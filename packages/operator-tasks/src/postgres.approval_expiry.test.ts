import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createCanonicalId } from "@masanawa/contracts";
import { OperatorTaskError } from "./index.js";
import { createPostgresOperatorTaskRepository } from "./postgres.js";

/**
 * These are adapter/SQL-contract unit tests with a fake Pool, NOT real PG-clock
 * execution. Disposable PostgreSQL must independently prove the locked-row
 * race and clock_timestamp() behavior before production activation.
 */
function fixture(updateReturned: boolean) {
  const tenantId = createCanonicalId("tenant");
  const userId = createCanonicalId("user");
  const taskId = createCanonicalId("task");
  const actor = { tenantId, userId, sessionDigest: "a".repeat(64) };
  const row = {
    task_id: taskId, tenant_id: tenantId, user_id: userId, request_id: "approval-1",
    scope: "private-assistant", capability_id: "talks.create", capability_version: 1,
    argument_digest: "b".repeat(64), phase: "awaiting_approval", version: 2,
    operation_class: "send", operation_id: createCanonicalId("operation"),
    terms_digest: "c".repeat(64), approval_digest: "d".repeat(64),
    approval_session_digest: actor.sessionDigest,
    approval_expires_at: "2026-10-10T03:00:00.000Z",
    receipt_ref: null, error_code: null,
    created_at: "2026-10-10T02:00:00.000Z",
    updated_at: "2026-10-10T02:00:01.000Z",
  };
  const calls: { sql: string; values: unknown[] }[] = [];
  let releaseCount = 0;
  const client = {
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      if (sql.startsWith("SELECT * FROM operator_tasks.tasks")) return { rows: [row] };
      if (sql.startsWith("UPDATE operator_tasks.tasks")) {
        return { rows: updateReturned ? [{
          ...row, version: 3, phase: "running",
          approval_digest: null, approval_session_digest: null,
        }] : [] };
      }
      return { rows: [] };
    },
    release() { releaseCount++; },
  };
  const pool = { connect: async () => client } as unknown as Pool;
  const repository = createPostgresOperatorTaskRepository(pool);
  const change = () => repository.change({
    actor, taskId, expectedVersion: 2, allowedFrom: ["awaiting_approval"],
    patch: { phase: "running", approvalDigest: null, approvalSessionDigest: null },
    at: "2026-10-10T02:59:59.000Z",
    requireUnexpiredApproval: true,
  });
  return { calls, change, getReleaseCount: () => releaseCount };
}

describe("U02 PostgreSQL admission approval expiry", () => {
  it("requires the actual database clock at the atomic UPDATE, not a stale app timestamp", async () => {
    const f = fixture(true);
    const updated = await f.change();
    expect(updated.phase).toBe("running");
    const write = f.calls.find(x => x.sql.startsWith("UPDATE operator_tasks.tasks"));
    expect(write).toBeDefined();
    expect(write!.sql).toContain("approval_expires_at > clock_timestamp()");
    expect(write!.sql).toContain("phase='awaiting_approval'");
    expect(write!.values.at(-1)).toBe(true);
    expect(f.calls.filter(x => x.sql.includes("INSERT INTO operator_tasks.events"))).toHaveLength(1);
    expect(f.calls.some(x => x.sql === "COMMIT")).toBe(true);
    expect(f.getReleaseCount()).toBe(1);
  });

  it("rejects an expired or otherwise denied DB admission without journal or effect", async () => {
    // Fake DB simulates zero returned rows when its clock predicate denies admission.
    const f = fixture(false);
    await expect(f.change()).rejects.toMatchObject({
      code: "TASK_APPROVAL_INVALID", statusCode: 403,
    } satisfies Partial<OperatorTaskError>);
    expect(f.calls.filter(x => x.sql.includes("INSERT INTO operator_tasks.events"))).toHaveLength(0);
    expect(f.calls.some(x => x.sql === "ROLLBACK")).toBe(true);
    expect(f.calls.some(x => x.sql === "COMMIT")).toBe(false);
    expect(f.getReleaseCount()).toBe(1);
  });
});
