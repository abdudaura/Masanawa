import { describe, expect, it } from "vitest";
import { createPostgresAvatarRepository, type AvatarSqlPool } from "./repository.js";

describe("PostgreSQL avatar lifecycle and owner scoping", () => {
  it("pins each write to the owner and CAS expected avatar URL", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const pool = {
      async query(sql: string, values: readonly unknown[] = []) {
        calls.push({ sql, values });
        return { rows: [{ changed: true }], rowCount: 1 };
      },
    } as unknown as AvatarSqlPool;
    const repo = createPostgresAvatarRepository(pool);
    const changed = await repo.attach({
      tenantId: "tenant-1", userId: "user-1",
      key: "profiles/tenant-1/user-1/sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp",
      url: "https://cdn.example/new.png",
      expectedUrl: "https://cdn.example/old.png",
    });
    expect(changed).toBe(true);
    expect(calls[0]?.sql).toContain("avatar_url IS NOT DISTINCT FROM $3");
    expect(calls[0]?.sql).toContain("WHERE tenant_id=$1 AND user_id=$2");
    expect(calls[0]?.sql).toContain("state='orphaned'");
    expect(calls[0]?.values).toEqual([
      "tenant-1", "user-1", "https://cdn.example/old.png",
      "https://cdn.example/new.png", "profiles/tenant-1/user-1/sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp",
    ]);
  });

  it("does not replace an avatar if the concurrent CAS update lost", async () => {
    const pool = {
      async query() {
        return { rows: [{ changed: false }], rowCount: 1 };
      },
    } as unknown as AvatarSqlPool;
    const repo = createPostgresAvatarRepository(pool);
    expect(await repo.attach({
      tenantId: "t", userId: "u",
      key: "profiles/t/u/sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp", url: "https://cdn/a.png",
      expectedUrl: null,
    })).toBe(false);
  });

  it("claims only expired staged and orphaned objects with SKIP LOCKED", async () => {
    const calls: string[] = [];
    const pool = {
      async query(sql: string) {
        calls.push(sql);
        return {
          rows: [{ object_key: "profiles/t/u/sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp", tenant_id: "t", user_id: "u" }],
          rowCount: 1,
        };
      },
    } as unknown as AvatarSqlPool;
    const repo = createPostgresAvatarRepository(pool);
    expect(await repo.claimGarbage(20)).toEqual([{ key: "profiles/t/u/sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp", tenantId: "t", userId: "u" }]);
    expect(calls[0]).toContain("FOR UPDATE SKIP LOCKED");
    expect(calls[0]).toContain("interval '1 hour'");
    expect(calls[0]).toContain("state='staged' AND updated_at <");
    expect(calls[0]).not.toContain("state='staged' AND created_at <");
    expect(calls[0]).toContain("interval '15 minutes'");
    await expect(repo.claimGarbage(101)).rejects.toThrow();
  });

  it("refreshes an orphaned or already staged digest without renewing active/deleting objects", async () => {
    const key = "profiles/t/u/sha256-" + "a".repeat(64) + ".webp";
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const pool = {
      async query(sql: string, values: readonly unknown[] = []) {
        calls.push({ sql, values });
        return { rows: [{ object_key: key }], rowCount: 1 };
      },
    } as unknown as AvatarSqlPool;
    const repo = createPostgresAvatarRepository(pool);
    expect(await repo.stage({
      tenantId: "t", userId: "u", key, url: "https://cdn.example/" + key,
    })).toBe(true);
    expect(calls[0]?.values).toEqual(["t", "u", key, "https://cdn.example/" + key]);
    expect(calls[0]?.sql).toContain("state IN ('orphaned','staged')");
    expect(calls[0]?.sql).toContain("updated_at=clock_timestamp()");
    expect(calls[0]?.sql).toContain("tenant_id=EXCLUDED.tenant_id");
    expect(calls[0]?.sql).toContain("user_id=EXCLUDED.user_id");
    expect(calls[0]?.sql).toContain("public_url=EXCLUDED.public_url");
    expect(calls[0]?.sql).toContain("RETURNING object_key");
  });

  it("refuses a stage when durable row is active, deleting or owner metadata conflicts", async () => {
    const pool = {
      async query() { return { rows: [], rowCount: 0 }; },
    } as unknown as AvatarSqlPool;
    const repo = createPostgresAvatarRepository(pool);
    expect(await repo.stage({
      tenantId: "t", userId: "u", key: "profiles/t/u/sha256-" + "b".repeat(64) + ".webp",
      url: "https://cdn.example/photo.webp",
    })).toBe(false);
  });

  it("does not treat missing owner row as a successful image removal", async () => {
    const pool = {
      async query() {
        return { rows: [{ changed: false }], rowCount: 1 };
      },
    } as unknown as AvatarSqlPool;
    const repo = createPostgresAvatarRepository(pool);
    expect(await repo.remove({
      tenantId: "t", userId: "u",
      expectedUrl: "https://cdn.example/photo.png",
    })).toBe(false);
  });
});
