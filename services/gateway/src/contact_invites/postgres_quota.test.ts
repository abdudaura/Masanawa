import { describe, expect, it, vi } from "vitest";
import { PostgresInvitationQuota, type InviteSql } from "./postgres_quota.js";

describe("U23 durable daily issuing quota", () => {
  it("uses one atomic tenant/user/day upsert, not read-then-write", async () => {
    const query = vi.fn(async () => ({ rows: [{ uses: 1 }] }));
    const quota = new PostgresInvitationQuota({ query } as unknown as InviteSql);
    expect(await quota.consume({
      tenantId: "tenant_A", userId: "user_A", now: new Date("2026-10-08T23:59:59Z"),
    })).toBe(true);
    expect(query).toHaveBeenCalledOnce();
    const [sql, args] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("ON CONFLICT");
    expect(sql).toContain("WHERE masanawa_invite_daily_quota.uses < $4");
    expect(args).toEqual(["tenant_A", "user_A", "2026-10-08", 20]);
  });

  it("stops when durable quota is full and does not cache the denial", async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ uses: 1 }] });
    const quota = new PostgresInvitationQuota({ query } as unknown as InviteSql, 1);
    const input = {
      tenantId: "tenant_A", userId: "user_A", now: new Date("2026-10-09T00:00:00Z"),
    };
    expect(await quota.consume(input)).toBe(false);
    expect(await quota.consume(input)).toBe(true);
  });

  it("does not convert database outages into permission or success", async () => {
    const query = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const quota = new PostgresInvitationQuota({ query } as unknown as InviteSql);
    await expect(quota.consume({
      tenantId: "tenant_A", userId: "user_A", now: new Date(),
    })).rejects.toThrow("database unavailable");
    expect(() => new PostgresInvitationQuota({ query } as unknown as InviteSql, 0)).toThrow();
  });
});

