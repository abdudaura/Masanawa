import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { createCanonicalId, nowInstant } from "@masanawa/contracts";
import {
  createPostgresPool,
  createPostgresPlatformIdentityBridge,
  runMigrations,
} from "../index.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;
const identityMigrationDirectory = fileURLToPath(
  new URL("../../../../../packages/identity/migrations", import.meta.url),
);

describePostgres("platform session tenant resolution", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "platform-session-tenant-test",
      max: 2,
    });
  });

  beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS identity CASCADE");
    await pool.query(
      "DROP TABLE IF EXISTS public.masanawa_schema_migrations CASCADE",
    );
    await runMigrations(pool, [
      { owner: "identity", directory: identityMigrationDirectory },
    ]);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("resolves the only active tenant", async () => {
    const tenantId = createCanonicalId("tenant");
    const at = nowInstant();
    await pool.query(
      `INSERT INTO identity.tenants(tenant_id, created_at, updated_at)
       VALUES ($1, $2, $2)`,
      [tenantId, at],
    );

    const bridge = createPostgresPlatformIdentityBridge(pool);
    await expect(bridge.resolveSingleActiveTenant()).resolves.toBe(tenantId);
  });

  it("fails closed when more than one active tenant exists", async () => {
    const at = nowInstant();
    await pool.query(
      `INSERT INTO identity.tenants(tenant_id, created_at, updated_at)
       VALUES ($1, $3, $3), ($2, $3, $3)`,
      [createCanonicalId("tenant"), createCanonicalId("tenant"), at],
    );

    const bridge = createPostgresPlatformIdentityBridge(pool);
    await expect(bridge.resolveSingleActiveTenant()).rejects.toThrow(
      "Multiple active Masanawa tenants require MASANAWA_PLATFORM_TENANT_ID",
    );
  });
});
