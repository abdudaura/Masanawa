import { describe, expect, it, vi } from "vitest";
import { createPostgresLinkRepository } from "./postgres_repository.js";

function harness(active = true) {
  const commands: Array<{ sql: string; values: unknown[] }> = [];
  let issuedCount = 0;
  const release = vi.fn();
  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    commands.push({ sql, values });
    if (sql.includes("SELECT state FROM identity.users")) {
      return { rows: active ? [{ state: "active" }] : [{ state: "disabled" }], rowCount: 1 };
    }
    if (sql.includes("SELECT issued_at, window_started_at, issued_count")) {
      return { rows: issuedCount ? [{
        issued_at: new Date("2026-10-08T17:00:00Z"),
        window_started_at: new Date("2026-10-08T17:00:00Z"),
        issued_count: issuedCount,
      }] : [], rowCount: issuedCount ? 1 : 0 };
    }
    if (sql.startsWith("INSERT INTO security.channel_link_intents")) {
      issuedCount = Number(values[7]);
    }
    return { rows: [], rowCount: 0 };
  });
  return {
    pool: {
      connect: async () => ({ query, release }),
      query,
    },
    query, release, commands,
  };
}
const alice = { tenantId: "tenant-A", userId: "user-A" };
const at = new Date("2026-10-08T17:00:00Z");
const expiry = new Date("2026-10-08T17:05:00Z");

describe("U26 transactional database security", () => {
  it("only issues a challenge while the canonical owner account is active", async () => {
    const db = harness(false);
    const repo = createPostgresLinkRepository(db.pool as never);
    await expect(repo.begin({
      owner: alice, channel: "telegram", codeHash: "f".repeat(64),
      now: at, expiresAt: expiry,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const sql = db.commands.map((q) => q.sql);
    expect(sql).toContain("BEGIN");
    expect(sql).toContain("ROLLBACK");
    expect(sql).not.toContain("COMMIT");
    expect(sql.some((s) => s.startsWith("INSERT INTO security.channel_link_intents"))).toBe(false);
    expect(db.release).toHaveBeenCalledOnce();
  });

  it("serializes challenge creation with a user lock and commits only one code", async () => {
    const db = harness();
    const repo = createPostgresLinkRepository(db.pool as never);
    await repo.begin({
      owner: alice, channel: "telegram", codeHash: "e".repeat(64),
      now: at, expiresAt: expiry,
    });
    const sql = db.commands.map((q) => q.sql);
    expect(sql[0]).toBe("BEGIN");
    expect(sql[1]).toContain("FOR UPDATE");
    expect(sql.at(-1)).toBe("COMMIT");
    expect(db.release).toHaveBeenCalledOnce();
    expect(sql.some((s) => s.includes("INSERT INTO security.channel_link_intents"))).toBe(true);
    await expect(repo.begin({
      owner: alice, channel: "telegram", codeHash: "d".repeat(64),
      now: new Date(at.getTime() + 10_000), expiresAt: new Date(expiry.getTime() + 10_000),
    })).rejects.toMatchObject({ code: "LINK_COOLDOWN" });
    expect(db.commands.at(-1)?.sql).toBe("ROLLBACK");
  });

  it("unlinks transactionally and clears both verified identity and future challenges", async () => {
    const db = harness();
    const repo = createPostgresLinkRepository(db.pool as never);
    await repo.unlink(alice, "telegram", at);
    expect(db.commands.some((c) =>
      c.sql.includes("DELETE FROM security.customer_channel_links") &&
      c.values[0] === "tenant-A" && c.values[1] === "user-A")).toBe(true);
    expect(db.commands.some((c) =>
      c.sql.includes("verified_external_id=NULL,verified_chat_id=NULL"))).toBe(true);
    expect(db.commands.at(-1)?.sql).toBe("COMMIT");
  });

  it("checks the verified provider identity AND active owner state before assistant ingress", async () => {
    const db = harness();
    const repo = createPostgresLinkRepository(db.pool as never);
    expect(await repo.isVerifiedSender(alice, "whatsapp", "+2347000000100", "2347000000100@s.whatsapp.net"))
      .toBe(false);
    const query = db.commands[0];
    expect(query?.sql).toContain("u.state='active'");
    expect(query?.sql).toContain("l.external_user_id=i.verified_external_id");
    expect(query?.sql).toContain("l.chat_id=i.verified_chat_id");
    expect(query?.values).toEqual([
      "tenant-A", "user-A", "whatsapp",
      "+2347000000100", "2347000000100@s.whatsapp.net",
    ]);
  });
});
