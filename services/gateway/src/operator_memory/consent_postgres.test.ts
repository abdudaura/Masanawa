import { describe, expect, it } from "vitest";
import { createPostgresMemoryConsent, type ConsentSqlClient } from "./consent_postgres.js";

describe("U05 durable consent CAS PostgreSQL adapter", () => {
  const actor = { tenantId: "tenant_A", userId: "user_B" };
  it("defaults to disabled only for an absent row", async () => {
    const db: ConsentSqlClient = {
      async query<T extends object>() { return { rows: [] as T[] }; },
    };
    expect(await createPostgresMemoryConsent(db).get(actor)).toEqual({
      enabled: false, revision: 0,
    });
  });
  it("uses insert-once and expected revision to prevent stale device writes", async () => {
    const sql: string[] = [];
    const params: unknown[][] = [];
    const db: ConsentSqlClient = {
      async query<T extends object>(statement, values) {
        sql.push(statement);
        params.push([...values]);
        return { rows: [{ enabled: false, revision: "2" }] as T[] };
      },
    };
    const repo = createPostgresMemoryConsent(db);
    const updated = await repo.compareAndSet({ ...actor, enabled: false, expectedRevision: 1 });
    expect(updated).toEqual({ enabled: false, revision: 2 });
    expect(sql[0]).toContain("revision=$4 RETURNING");
    expect(params[0]).toEqual(["tenant_A", "user_B", false, 1]);
    await repo.compareAndSet({ ...actor, enabled: true, expectedRevision: 0 });
    expect(sql[1]).toContain("ON CONFLICT (tenant_id,user_id) DO NOTHING");
    expect(params[1]).toEqual(["tenant_A", "user_B", true]);
  });
  it("returns conflict on a lost CAS and rejects malformed PostgreSQL revisions", async () => {
    const db: ConsentSqlClient = {
      async query<T extends object>() { return { rows: [] as T[] }; },
    };
    expect(await createPostgresMemoryConsent(db).compareAndSet({
      ...actor, enabled: true, expectedRevision: 7,
    })).toBeNull();
    const badDb: ConsentSqlClient = {
      async query<T extends object>() {
        return { rows: [{ enabled: true, revision: "9007199254740999" }] as T[] };
      },
    };
    await expect(createPostgresMemoryConsent(badDb).get(actor))
      .rejects.toThrow("Invalid durable operator memory consent revision");
  });
});
