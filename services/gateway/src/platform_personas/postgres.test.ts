import { describe, expect, it, vi } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { createPostgresPersonaSeedReservations, type PersonaSeedSqlClient } from "./postgres.js";
import type { PersonaSeedBinding } from "./bootstrap.js";

function database() {
  const rows = new Map<string, { character_id: string; character_version_id: string }>();
  const trace: { sql: string; params: unknown[] }[] = [];
  let unlocked = 0;
  let released = 0;
  let poisoned = 0;
  const client: PersonaSeedSqlClient = {
    async query(sql, params = []) {
      trace.push({ sql, params });
      if (sql.includes("pg_advisory_unlock")) { unlocked++; return { rows: [{ unlocked: true }] }; }
      if (sql.includes("pg_try_advisory_lock")) return { rows: [{ acquired: true }] };
      if (sql.includes("INSERT INTO agents.platform_persona_seed_bindings")) {
        const [tenant, key, character_id, character_version_id] = params as string[];
        const rowKey = tenant + ":" + key;
        if (!rows.has(rowKey)) rows.set(rowKey, { character_id, character_version_id });
        return { rows: [] };
      }
      if (sql.includes("SELECT character_id, character_version_id")) {
        const [tenant, key] = params as string[];
        const row = rows.get(tenant + ":" + key);
        return { rows: row ? [row] : [] };
      }
      throw new Error("unrecognized test SQL");
    },
    release(error) { released++; if (error) poisoned++; },
  };
  return {
    rows, trace, client,
    pool: { connect: vi.fn(async () => client) },
    statistics: () => ({ unlocked, released, poisoned }),
  };
}
const allocate = (): PersonaSeedBinding => ({
  characterId: createCanonicalId("character"),
  characterVersionId: createCanonicalId("character-version"),
});

describe("F03 durable Postgres persona identity lease", () => {
  it("reuses the persisted immutable IDs after a retry", async () => {
    const f = database(), reservation = createPostgresPersonaSeedReservations(f.pool);
    const tenantId = createCanonicalId("tenant");
    const run = async () => reservation.withSeedLease({
      tenantId, seedKey: "platform.wazobia", allocate, run: async (binding) => binding,
    });
    const first = await run(), second = await run();
    expect(first).toEqual(second);
    expect(f.rows).toHaveProperty("size", 1);
    expect(f.statistics()).toEqual({ unlocked: 2, released: 2, poisoned: 0 });
    expect(f.trace.filter((x) => x.sql.includes("pg_try_advisory_lock"))).toHaveLength(2);
  });

  it("keeps tenant reservation scopes separate and uses SQL parameters", async () => {
    const f = database(), reservation = createPostgresPersonaSeedReservations(f.pool);
    const a = createCanonicalId("tenant"), b = createCanonicalId("tenant");
    const one = await reservation.withSeedLease({ tenantId: a, seedKey: "platform.naira", allocate, run: async x => x });
    const two = await reservation.withSeedLease({ tenantId: b, seedKey: "platform.naira", allocate, run: async x => x });
    expect(one.characterId).not.toBe(two.characterId);
    expect(f.rows.size).toBe(2);
    expect(f.trace.some(({ sql }) => sql.includes(a) || sql.includes(b))).toBe(false);
    expect(f.trace.some(({ params }) => params.includes(a))).toBe(true);
    expect(f.trace.some(({ params }) => params.includes(b))).toBe(true);
  });

  it("releases the advisory lease after callback failure without forgetting reservation", async () => {
    const f = database(), reservation = createPostgresPersonaSeedReservations(f.pool);
    const tenantId = createCanonicalId("tenant");
    await expect(reservation.withSeedLease({
      tenantId, seedKey: "platform.sardauna", allocate,
      run: async () => { throw new Error("interrupted provision"); },
    })).rejects.toThrow("interrupted provision");
    expect(f.statistics().released).toBe(1);
    expect(f.statistics().unlocked).toBe(1);
    expect(f.rows.size).toBe(1);
  });

  it("rejects malformed, SQL-injection and unauthorized seed keys before DB acquisition", async () => {
    const f = database(), reservation = createPostgresPersonaSeedReservations(f.pool);
    for (const seedKey of ["", "platform.", "platform.gwani';DROP TABLE users;", "custom.admin", "platform.UPPER"]) {
      await expect(reservation.withSeedLease({
        tenantId: createCanonicalId("tenant"), seedKey, allocate, run: async x => x,
      })).rejects.toThrow("invalid canonical persona seed key");
    }
    expect(f.pool.connect).not.toHaveBeenCalled();
  });

  it("fails closed on missing reservation or unlock failure", async () => {
    const f = database();
    const badClient = {
      ...f.client,
      async query(sql: string, params: unknown[] = []) {
        if (sql.includes("SELECT character_id")) return { rows: [] };
        return f.client.query(sql, params);
      },
    };
    const reservation = createPostgresPersonaSeedReservations({ connect: async () => badClient });
    await expect(reservation.withSeedLease({
      tenantId: createCanonicalId("tenant"), seedKey: "platform.hazika", allocate, run: async x => x,
    })).rejects.toThrow("reservation is missing");
    expect(f.statistics().released).toBe(1);

    const unlockClient = {
      ...f.client,
      async query(sql: string, params: unknown[] = []) {
        if (sql.includes("pg_advisory_unlock")) return { rows: [{ unlocked: false }] };
        return f.client.query(sql, params);
      },
    };
    const unsafe = createPostgresPersonaSeedReservations({ connect: async () => unlockClient });
    await expect(unsafe.withSeedLease({
      tenantId: createCanonicalId("tenant"), seedKey: "platform.gimbiya", allocate, run: async x => x,
    })).rejects.toThrow("advisory lock was not released");
    expect(f.statistics().poisoned).toBe(1);
  });
  it("fails immediately when a second process owns the seed lock", async () => {
    const f = database();
    const busy = {
      ...f.client,
      async query(sql: string, params: unknown[] = []) {
        if (sql.includes("pg_try_advisory_lock")) return { rows: [{ acquired: false }] };
        return f.client.query(sql, params);
      },
    };
    const reservation = createPostgresPersonaSeedReservations({ connect: async () => busy });
    const run = vi.fn(async (x: PersonaSeedBinding) => x);
    await expect(reservation.withSeedLease({
      tenantId: createCanonicalId("tenant"),
      seedKey: "platform.basira", allocate, run,
    })).rejects.toThrow("lease is busy");
    expect(run).not.toHaveBeenCalled();
    expect(f.rows.size).toBe(0);
    expect(f.statistics().released).toBe(1);
    expect(f.statistics().unlocked).toBe(0);
  });

});
