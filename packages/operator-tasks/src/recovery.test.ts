import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import {
  createPostgresRecoveryJournal,
  createStatusOnlyRecovery,
  type RecoveryJournal,
  type RecoveryOperation,
} from "./recovery.js";
import type { OperatorDomainOutcome } from "./index.js";

const operation: RecoveryOperation = Object.freeze({
  tenantId: "tenant_1", userId: "user_1", taskId: "task_1",
  operationId: "operation_1", capabilityId: "talks.publish", version: 4,
});

function setup(
  outcome: OperatorDomainOutcome = { status: "unknown" },
  settle: "settled" | "stale" | "unknown" = "settled",
) {
  const readback = vi.fn(async () => outcome);
  const claim = vi.fn(async () => [operation]);
  const persist = vi.fn(async () => settle);
  const journal: RecoveryJournal = { claim, settle: persist };
  const worker = createStatusOnlyRecovery({
    journal, status: { readback },
    now: () => new Date("2026-10-10T00:10:00.000Z"),
    minAgeMs: 60_000, timeoutMs: 100, limit: 1,
  });
  return { worker, readback, claim, persist };
}

describe("U02 durable status-only recovery", () => {
  it("claims only mature unfinished operations with finite bounds", async () => {
    const f = setup();
    expect(await f.worker.runOnce()).toEqual({
      claimed: 1, confirmed: 0, rejected: 0, unknown: 1, stale: 0,
    });
    expect(f.claim).toHaveBeenCalledWith({
      before: "2026-10-10T00:09:00.000Z",
      now: "2026-10-10T00:10:00.000Z", limit: 1,
    });
    expect(f.persist).toHaveBeenCalledWith({
      operation, outcome: { status: "unknown" },
      now: "2026-10-10T00:10:00.000Z",
    });
  });

  it("records only a trusted readback receipt without executing a purchase", async () => {
    const f = setup({ status: "confirmed", receiptRef: "talk:receipt-124" });
    expect(await f.worker.runOnce()).toMatchObject({
      claimed: 1, confirmed: 1, rejected: 0, unknown: 0,
    });
    expect(f.readback).toHaveBeenCalledTimes(1);
    expect(f.readback).toHaveBeenCalledWith(operation);
    expect(f.persist).toHaveBeenCalledWith({
      operation, outcome: { status: "confirmed", receiptRef: "talk:receipt-124" },
      now: "2026-10-10T00:10:00.000Z",
    });
  });

  it("retains separate rejected, stale and unknown outcomes", async () => {
    const denied = setup({ status: "rejected", code: "QUOTE_EXPIRED" });
    expect(await denied.worker.runOnce()).toMatchObject({ rejected: 1 });
    const stale = setup({ status: "confirmed", receiptRef: "receipt:2" }, "stale");
    expect(await stale.worker.runOnce()).toMatchObject({
      confirmed: 0, stale: 1,
    });
    const unknown = setup({ status: "confirmed", receiptRef: "receipt:3" }, "unknown");
    expect(await unknown.worker.runOnce()).toMatchObject({
      confirmed: 0, unknown: 1,
    });
  });

  it("converts domain connection errors and stalled reads into retryable unknown", async () => {
    const journal: RecoveryJournal = {
      claim: async () => [operation],
      settle: vi.fn(async () => "unknown" as const),
    };
    const rejected = createStatusOnlyRecovery({
      journal, status: { readback: async () => { throw new Error("external private error"); } },
      now: () => new Date("2026-10-10T00:10:00.000Z"),
    });
    expect(await rejected.runOnce()).toMatchObject({ unknown: 1 });
    const stalled = createStatusOnlyRecovery({
      journal, status: { readback: () => new Promise<OperatorDomainOutcome>(() => undefined) },
      now: () => new Date("2026-10-10T00:10:00.000Z"),
      timeoutMs: 50,
    });
    expect(await stalled.runOnce()).toMatchObject({ unknown: 1 });
    expect(journal.settle).toHaveBeenCalledTimes(2);
    expect(vi.mocked(journal.settle).mock.calls[1]?.[0].outcome).toEqual({ status: "unknown" });
  });

  it("rejects missing/unsafe worker bounds", () => {
    const f = setup();
    expect(() => createStatusOnlyRecovery({
      journal: { claim: f.claim, settle: f.persist },
      status: { readback: f.readback }, limit: 26,
    })).toThrow("RECOVERY_INVALID_LIMIT");
    expect(() => createStatusOnlyRecovery({
      journal: { claim: f.claim, settle: f.persist },
      status: { readback: f.readback }, minAgeMs: 0,
    })).toThrow("RECOVERY_INVALID_CONFIGURATION");
  });
});

describe("U02 PostgreSQL service principal CAS recovery repository", () => {
  function database() {
    const statements: { sql: string; params: unknown[] }[] = [];
    let claimed = false;
    let selected: { phase: string; version: number } | undefined = {
      phase: "reconciling", version: operation.version,
    };
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        statements.push({ sql, params });
        if (sql.includes("WITH eligible")) {
          if (claimed) return { rows: [] };
          claimed = true;
          return { rows: [{
            tenant_id: operation.tenantId, user_id: operation.userId,
            task_id: operation.taskId, operation_id: operation.operationId,
            capability_id: operation.capabilityId, version: operation.version,
          }] };
        }
        if (sql.includes("SELECT phase,version")) return { rows: selected ? [selected] : [] };
        if (sql.includes("UPDATE operator_tasks.tasks SET phase=$5")) return { rows: [{ version: 5 }] };
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
    return { pool, client, statements, setSelected: (v?: { phase: string; version: number }) => {
      selected = v;
    } };
  }

  it("claims under SKIP LOCKED, atomically appends an event and commits", async () => {
    const db = database();
    const journal = createPostgresRecoveryJournal(db.pool);
    expect(await journal.claim({
      before: "2026-10-10T00:09:00Z", now: "2026-10-10T00:10:00Z", limit: 3,
    })).toEqual([operation]);
    expect(db.statements.some(s => s.sql.includes("FOR UPDATE SKIP LOCKED") &&
      s.sql.includes("INSERT INTO operator_tasks.events"))).toBe(true);
    expect(db.statements.map(s=>s.sql)).toEqual(expect.arrayContaining(["BEGIN", "COMMIT"]));
    expect(await journal.claim({
      before: "2026-10-10T00:09:00Z", now: "2026-10-10T00:10:00Z", limit: 3,
    })).toEqual([]);
  });

  it("settles by owner/operation/version CAS with immutable event and no replay", async () => {
    const db = database();
    const journal = createPostgresRecoveryJournal(db.pool);
    expect(await journal.settle({
      operation, outcome: { status: "confirmed", receiptRef: "ledger:confirmed_1" },
      now: "2026-10-10T00:10:00Z",
    })).toBe("settled");
    const update = db.statements.find(s => s.sql.includes("UPDATE operator_tasks.tasks SET phase=$5"));
    expect(update?.sql).toContain("version=$9 AND phase='reconciling'");
    expect(update?.params.slice(0,4)).toEqual([
      operation.tenantId,operation.userId,operation.taskId,operation.operationId,
    ]);
    expect(db.statements.some(s => s.sql.includes("INSERT INTO operator_tasks.events")
      && s.params.includes(5))).toBe(true);
  });

  it("refuses fabricated receipts or changed revision without changing SQL", async () => {
    const db = database(), journal = createPostgresRecoveryJournal(db.pool);
    expect(await journal.settle({
      operation, outcome: { status: "confirmed", receiptRef: "forged\nreceipt" },
      now: "2026-10-10T00:10:00Z",
    })).toBe("unknown");
    expect(db.statements).toHaveLength(0);
    db.setSelected({ phase: "reconciling", version: 6 });
    expect(await journal.settle({
      operation, outcome: { status: "rejected", code: "DENIED" },
      now: "2026-10-10T00:10:00Z",
    })).toBe("stale");
    expect(db.statements.some(s => s.sql.includes("UPDATE operator_tasks.tasks SET phase=$5"))).toBe(false);
  });
});
