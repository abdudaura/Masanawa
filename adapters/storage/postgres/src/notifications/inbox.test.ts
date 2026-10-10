import { describe, expect, it, vi } from "vitest";
import { createPostgresInboxRepository } from "./inbox.js";
describe("C08 Postgres account fencing", () => {
  it("reads with tenant and fan predicates, keysets instead of offsets", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const db = createPostgresInboxRepository({ query } as never);
    expect(await db.list({ tenantId: "t1", fanUserId: "u1" }, 10))
      .toEqual({ items: [], nextCursor: null });
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("tenant_id = $1 AND fan_user_id = $2");
    expect(sql).toContain("created_at, notification_id");
    expect(values.slice(0, 2)).toEqual(["t1", "u1"]);
  });
  it("marks read only for the same verified fan", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const db = createPostgresInboxRepository({ query } as never);
    expect(await db.acknowledge({ tenantId: "t1", fanUserId: "u1" }, "ntf_2")).toBe(false);
    expect(query.mock.calls[0][0]).toContain("fan_user_id = $2 AND notification_id = $3");
    expect(query.mock.calls[0][1]).toEqual(["t1", "u1", "ntf_2"]);
  });
  it("inserts idempotently on tenant/fan/event without queuing push", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const db = createPostgresInboxRepository({ query } as never);
    await db.deliver({ tenantId: "t", fanUserId: "u", eventId: "evt1",
      kind: "room_answer", targetKind: "room", targetId: "room1", title: "Answered", body: "See Room" });
    expect(query.mock.calls[0][0]).toContain("ON CONFLICT (tenant_id, fan_user_id, source_event_id) DO NOTHING");
  });
  it("rejects identity and invalid cursor before IO", async () => {
    const query = vi.fn();
    const db = createPostgresInboxRepository({ query } as never);
    await expect(db.list({ tenantId: "", fanUserId: "u" }, 10)).rejects.toThrow();
    await expect(db.list({ tenantId: "t", fanUserId: "u" }, 10, "!!!")).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
