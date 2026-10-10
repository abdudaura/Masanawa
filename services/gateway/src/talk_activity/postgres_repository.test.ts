import { describe, expect, it } from "vitest";
import {
  createPostgresTalkActivityRepository,
  type TalkActivitySqlPool,
} from "./postgres_repository.js";

function row(overrides: Record<string, unknown> = {}) {
  return {
    tenant_id: "tenant_a",
    activity_id: "activity_a",
    user_id: "user_a",
    kind: "talk_invitation",
    title: "Invitation",
    detail: "Join this Talk",
    created_at: "2026-10-07T09:00:00.000Z",
    talk_id: "talk_a",
    profile_public_id: null,
    persona_id: null,
    transaction_id: null,
    amount_label: null,
    requires_action: true,
    action_label: "View Talk",
    unread: true,
    ...overrides,
  };
}

describe("Postgres Talk Activity repository", () => {
  it("scopes reads by tenant and user before applying filter kinds", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkActivitySqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, ...(values === undefined ? {} : { values }) });
        return { rowCount: 1, rows: [row()] as unknown as Row[] };
      },
    };

    const result = await createPostgresTalkActivityRepository(pool).list({
      tenantId: "tenant_a",
      userId: "user_a",
      filter: "talks",
      limit: 60,
    });

    expect(result).toHaveLength(1);
    expect(calls[0]?.text).toContain("tenant_id = $1");
    expect(calls[0]?.text).toContain("user_id = $2");
    expect(calls[0]?.values?.[0]).toBe("tenant_a");
    expect(calls[0]?.values?.[1]).toBe("user_a");
    expect(calls[0]?.values?.[2]).toContain("talk_invitation");
    expect(calls[0]?.values?.[2]).not.toContain("earning");
  });

  it("maps money activity without exposing raw ledger data", async () => {
    const pool: TalkActivitySqlPool = {
      async query<Row>() {
        return {
          rowCount: 1,
          rows: [
            row({
              kind: "earning",
              talk_id: null,
              transaction_id: "txn_public",
              amount_label: "₦500",
              requires_action: false,
              action_label: null,
            }),
          ] as unknown as Row[],
        };
      },
    };

    const [activity] = await createPostgresTalkActivityRepository(pool).list({
      tenantId: "tenant_a",
      userId: "user_a",
      filter: "money",
      limit: 10,
    });

    expect(activity).toMatchObject({
      kind: "earning",
      transactionId: "txn_public",
      amountLabel: "₦500",
    });
    expect(activity).not.toHaveProperty("ledgerEntryId");
  });

  it("atomically fences read acknowledgment by tenant, user and activity ID", async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const pool: TalkActivitySqlPool = {
      async query<Row>(text: string, values?: unknown[]) {
        calls.push({ text, values });
        return {
          rowCount: 1,
          rows: [{ activity_id: "activity_a" }] as unknown as Row[],
        };
      },
    };
    const result = await createPostgresTalkActivityRepository(pool).markRead({
      tenantId: "tenant_a",
      userId: "user_a",
      activityId: "activity_a",
    });
    expect(result).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toMatch(/UPDATE talks\.activity/);
    expect(calls[0]?.text).toContain("tenant_id = $1");
    expect(calls[0]?.text).toContain("user_id = $2");
    expect(calls[0]?.text).toContain("activity_id = $3");
    expect(calls[0]?.text).toContain("SET unread = false");
    expect(calls[0]?.values).toEqual(["tenant_a", "user_a", "activity_a"]);
  });

  it("does not confirm foreign or absent read acknowledgments", async () => {
    const pool: TalkActivitySqlPool = {
      async query<Row>() {
        return { rowCount: 0, rows: [] as Row[] };
      },
    };
    expect(await createPostgresTalkActivityRepository(pool).markRead({
      tenantId: "tenant_a",
      userId: "user_a",
      activityId: "activity_foreign",
    })).toBe(false);
  });

  it("rejects idempotency-key reuse across another user or kind", async () => {
    const pool: TalkActivitySqlPool = {
      async query<Row>() {
        return { rowCount: 0, rows: [] as unknown as Row[] };
      },
    };
    const repository = createPostgresTalkActivityRepository(pool);

    await expect(
      repository.append({
        tenantId: "tenant_a",
        activityId: "activity_same",
        userId: "user_b",
        kind: "follow",
        title: "New follower",
        detail: "Someone followed you",
        createdAt: "2026-10-07T09:05:00.000Z",
      }),
    ).rejects.toThrow("talks.activity_idempotency_conflict");
  });
});
