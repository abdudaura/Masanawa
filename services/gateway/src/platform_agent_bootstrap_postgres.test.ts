import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { createPostgresPool, runMigrations } from "@masanawa/postgres";

import {
  bootstrapDefaultPlatformAgentsFromPostgres,
  lockPlatformAgentSeedTransaction,
} from "./platform_agent_bootstrap_postgres.js";

describe("R03 atomic support bootstrap lock contract", () => {
  it("takes a bounded xact-scoped PostgreSQL lock before tenant reads", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] }));
    const tenantId = createCanonicalId("tenant");
    await lockPlatformAgentSeedTransaction({ query }, tenantId);
    expect(query.mock.calls.map((call) => call[0])).toEqual([
      "SET LOCAL lock_timeout = '15s'",
      "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))",
    ]);
    expect(query.mock.calls[1]?.[1]).toEqual([
      "masanawa:platform-agents:bootstrap:v1:" + tenantId,
    ]);
  });

  it("uses different advisory keys for unrelated tenants", async () => {
    const queries: string[] = [];
    const query = vi.fn(async (_sql: string, params?: unknown[]) => {
      if (params) queries.push(String(params[0]));
      return { rows: [] };
    });
    await lockPlatformAgentSeedTransaction({ query }, createCanonicalId("tenant"));
    await lockPlatformAgentSeedTransaction({ query }, createCanonicalId("tenant"));
    expect(queries[0]).not.toEqual(queries[1]);
  });

  it("fails closed when lock acquisition fails", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("advisory_xact_lock")) throw new Error("lock_timeout");
      return { rows: [] };
    });
    await expect(
      lockPlatformAgentSeedTransaction({ query }, createCanonicalId("tenant")),
    ).rejects.toThrow("lock_timeout");
  });
});

// Real Postgres only; no in-memory substitutes can validate race/rollback.
// CI must provide a disposable admin database, NEVER a production URL.
// This creates and destroys an independently named throwaway DB.
const url = process.env.MASANAWA_TEST_DATABASE_URL;
const dbName = "masanawa_r03_" + randomUUID().replaceAll("-", "");
describe.skipIf(!url)("R03 support bootstrap — PostgreSQL atomic integration", () => {
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: url!,
      applicationName: "r03-bootstrap-test-admin",
      max: 1,
    });
    const version = await admin.query("SHOW server_version_num");
    expect(Number(version.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(180000);
    await admin.query("CREATE DATABASE " + dbName + " TEMPLATE template0");
    created = true;
    const target = new URL(url!);
    target.pathname = "/" + dbName;
    pool = createPostgresPool({
      connectionString: target.toString(),
      applicationName: "r03-bootstrap-test",
      max: 8,
    });
    await runMigrations(pool, [
      {
        owner: "identity",
        directory: fileURLToPath(new URL("../../../packages/identity/migrations", import.meta.url)),
      },
      {
        owner: "skills",
        directory: fileURLToPath(new URL("../../../packages/skills/migrations", import.meta.url)),
      },
      {
        owner: "agents",
        directory: fileURLToPath(new URL("../../../packages/agents/migrations", import.meta.url)),
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    try {
      if (pool) await pool.end();
      if (created) await admin.query("DROP DATABASE " + dbName);
    } finally {
      if (admin) await admin.end();
    }
  });

  async function tenant() {
    const tenantId = createCanonicalId("tenant");
    await pool.query(
      "INSERT INTO identity.tenants (tenant_id, created_at, updated_at) VALUES ($1, now(), now())",
      [tenantId],
    );
    return tenantId;
  }

  async function count(table: "identity.characters" | "agents.agent_presentations" |
    "agents.character_skill_assignments" | "agents.platform_agent_profiles", tenantId: string) {
    const rows = await pool.query("SELECT count(*) AS total FROM " + table + " WHERE tenant_id=$1", [tenantId]);
    return Number(rows.rows[0]?.total);
  }

  it("serializes separate gateway replicas; one pair and one default survive retries", async () => {
    const tenantId = await tenant();
    const results = await Promise.all([
      bootstrapDefaultPlatformAgentsFromPostgres({ pool, tenantId }),
      bootstrapDefaultPlatformAgentsFromPostgres({ pool, tenantId }),
    ]);
    expect(results.map((x) => x.changed).sort()).toEqual([false, true]);
    for (const r of results) expect(r.supportAgentCount).toBe(2);
    expect(await count("identity.characters", tenantId)).toBe(2);
    expect(await count("agents.agent_presentations", tenantId)).toBe(2);
    expect(await count("agents.character_skill_assignments", tenantId)).toBe(2);
    expect(await count("agents.platform_agent_profiles", tenantId)).toBe(2);
    const profiles = await pool.query(
      "SELECT support_agent, default_for_new_users, voice_name FROM agents.platform_agent_profiles WHERE tenant_id=$1 ORDER BY voice_name",
      [tenantId],
    );
    expect(profiles.rows).toEqual([
      expect.objectContaining({ support_agent: true, default_for_new_users: true, voice_name: "Bodi" }),
      expect.objectContaining({ support_agent: true, default_for_new_users: false, voice_name: "Sulafat" }),
    ]);
    expect((await bootstrapDefaultPlatformAgentsFromPostgres({ pool, tenantId })).changed).toBe(false);
  });

  it("rolls back every identity, version, presentation and profile on late failure; restart is clean", async () => {
    const tenantId = await tenant();
    await pool.query(`
      CREATE FUNCTION agents.r03_abort_last_profile() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.voice_name = 'Sulafat' THEN
          RAISE EXCEPTION 'deliberate disposable-db interruption';
        END IF;
        RETURN NEW;
      END;
      $$`);
    await pool.query(`
      CREATE TRIGGER r03_abort_last_profile
        BEFORE INSERT ON agents.platform_agent_profiles
        FOR EACH ROW EXECUTE FUNCTION agents.r03_abort_last_profile()`);
    try {
      await expect(
        bootstrapDefaultPlatformAgentsFromPostgres({ pool, tenantId }),
      ).rejects.toThrow("deliberate disposable-db interruption");
      for (const table of [
        "identity.characters", "agents.agent_presentations",
        "agents.character_skill_assignments", "agents.platform_agent_profiles",
      ] as const) expect(await count(table, tenantId)).toBe(0);
    } finally {
      await pool.query("DROP TRIGGER r03_abort_last_profile ON agents.platform_agent_profiles");
      await pool.query("DROP FUNCTION agents.r03_abort_last_profile()");
    }
    const restored = await bootstrapDefaultPlatformAgentsFromPostgres({ pool, tenantId });
    expect(restored.supportAgentCount).toBe(2);
    expect(await count("identity.characters", tenantId)).toBe(2);
  });

  it("isolates two separate tenants without sharing support profiles", async () => {
    const [a, b] = await Promise.all([tenant(), tenant()]);
    const [first, second] = await Promise.all([
      bootstrapDefaultPlatformAgentsFromPostgres({ pool, tenantId: a }),
      bootstrapDefaultPlatformAgentsFromPostgres({ pool, tenantId: b }),
    ]);
    expect(first.changed && second.changed).toBe(true);
    expect(await count("agents.platform_agent_profiles", a)).toBe(2);
    expect(await count("agents.platform_agent_profiles", b)).toBe(2);
    expect(new Set([...first.characterIds, ...second.characterIds]).size).toBe(4);
  });
});
