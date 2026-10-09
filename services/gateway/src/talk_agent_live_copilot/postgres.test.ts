import { describe, expect, it, vi } from "vitest";
import type { Pool } from "@masanawa/postgres";
import {
  createPostgresCopilotTurnStore,
  createPostgresStageHostAuthorizer,
} from "./postgres.js";

const claim = {
  tenantId: "tenant-A", talkId: "talk-A", seatId: "seat-A",
  userId: "host-A", requestId: "turn-1",
  transcript: "One Host-approved question", now: "2026-10-09T00:30:00Z",
  maxPerHour: 2,
};
function fakePool(input: Readonly<{
  existing?: {
    talk_id: string; seat_id: string; transcript_hash: string;
    state: "running" | "published" | "denied" | "unknown";
  };
  used?: number;
  failInsert?: boolean;
}> = {}) {
  const statements: Array<Readonly<{ sql: string; params: unknown[] }>> = [];
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    statements.push({ sql, params });
    if (sql.includes("SELECT talk_id,seat_id")) return { rows: input.existing ? [input.existing] : [] };
    if (sql.includes("COUNT(*)")) return { rows: [{ count: input.used ?? 0 }] };
    if (sql.startsWith("INSERT") && input.failInsert) throw new Error("DB write failed");
    if (sql.startsWith("UPDATE")) return { rows: [{ request_id: claim.requestId }] };
    return { rows: [] };
  });
  const release = vi.fn();
  const pool = {
    connect: vi.fn(async () => ({ query, release })),
  } as unknown as Pick<Pool, "connect">;
  return { pool, query, release, statements };
}

describe("U15 PostgreSQL durable turn admissions", () => {
  it("serializes the Host/Talk hour budget and inserts one hashed, not raw, turn", async () => {
    const source = fakePool();
    const store = createPostgresCopilotTurnStore(source.pool);
    expect(await store.acquire(claim)).toEqual({ kind: "acquired" });
    expect(source.statements.map(s => s.sql.split(" ")[0])).toContain("INSERT");
    expect(source.statements.some(s => s.sql.includes("pg_advisory_xact_lock"))).toBe(true);
    const insert = source.statements.find(s => s.sql.startsWith("INSERT"))!;
    expect(insert.params).toContain(claim.requestId);
    expect(insert.params).not.toContain(claim.transcript);
    expect(insert.params.some(p => typeof p === "string" && /^[0-9a-f]{64}$/u.test(p))).toBe(true);
    expect(source.statements.at(-1)?.sql).toBe("COMMIT");
    expect(source.release).toHaveBeenCalledOnce();
  });

  it("prevents costly turns when the one-hour quota is exhausted", async () => {
    const source = fakePool({ used: 2 });
    expect(await createPostgresCopilotTurnStore(source.pool).acquire(claim))
      .toEqual({ kind: "budget_exhausted" });
    expect(source.statements.some(s => s.sql.startsWith("INSERT"))).toBe(false);
    expect(source.statements.at(-1)?.sql).toBe("COMMIT");
  });

  it("a different Talk or seat under an existing request key cannot replay", async () => {
    const source = fakePool({ existing: {
      talk_id: "different-talk", seat_id: "seat-A",
      transcript_hash: "x".repeat(64), state: "published",
    } });
    expect(await createPostgresCopilotTurnStore(source.pool).acquire(claim))
      .toEqual({ kind: "conflict" });
    expect(source.statements.some(s => s.sql.startsWith("INSERT"))).toBe(false);
  });

  it("an orphaned running turn blocks re-execution until reconciliation", async () => {
    // Reuse the known transcript hash from an initial acquired turn.
    const source = fakePool();
    const store = createPostgresCopilotTurnStore(source.pool);
    await store.acquire(claim);
    const insert = source.statements.find(s => s.sql.startsWith("INSERT"))!;
    const hash = insert.params[5] as string;
    const replay = fakePool({ existing: {
      talk_id: claim.talkId, seat_id: claim.seatId,
      transcript_hash: hash, state: "running",
    } });
    expect(await createPostgresCopilotTurnStore(replay.pool).acquire(claim))
      .toEqual({ kind: "in_progress" });
  });

  it("rolls back on failed insert and never leaves the transaction open", async () => {
    const source = fakePool({ failInsert: true });
    await expect(createPostgresCopilotTurnStore(source.pool).acquire(claim))
      .rejects.toThrow("DB write failed");
    expect(source.statements.some(s => s.sql === "ROLLBACK")).toBe(true);
    expect(source.release).toHaveBeenCalledOnce();
  });

  it("finalizes only an owned running claim using its content hash", async () => {
    const source = fakePool();
    await createPostgresCopilotTurnStore(source.pool).finish({
      ...claim, outcome: "unknown",
    });
    const update = source.statements.find(s => s.sql.startsWith("UPDATE"))!;
    expect(update.sql).toContain("state='running'");
    expect(update.params).toContain("unknown");
    expect(update.params).not.toContain(claim.transcript);
    expect(source.release).toHaveBeenCalledOnce();
  });

  it("reads the Host from the existing session and scopes live Talk access to tenant", async () => {
    const query = vi.fn(async () => ({ rows: [{ "?column?": 1 }] }));
    const sessions = {
      authorize: vi.fn(async () => ({ tenantId: "tenant-A", userId: "host-A" })),
    };
    const auth = createPostgresStageHostAuthorizer(
      { query } as unknown as Pick<Pool, "query">,
      sessions as Parameters<typeof createPostgresStageHostAuthorizer>[1],
    );
    expect(await auth.authorize({ authorizationHeader: "Bearer real" })).toEqual({
      tenantId: "tenant-A", userId: "host-A",
    });
    expect(await auth.isCurrentHost({
      tenantId: "tenant-A", talkId: "talk-A", userId: "host-A",
    })).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("host_user_id=$3"),
      ["tenant-A", "talk-A", "host-A"],
    );
  });
});
