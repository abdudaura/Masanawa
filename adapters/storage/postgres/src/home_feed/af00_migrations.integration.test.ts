import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  characterSessionMigrationRoots, platformProductMigrationRoots,
  checkPostgresReadiness, runMigrations,
} from "../readiness.js";

const url = process.env.MASANAWA_TEST_DATABASE_URL;
const withDatabase = Boolean(url);
describe.skipIf(!withDatabase)("AF00 forward-only PG18 migration composition", () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 20);
  const names = ["af00_fresh_" + suffix, "af00_upgrade_" + suffix];
  let admin: Pool;
  const pools: Pool[] = [];
  beforeAll(async () => {
    admin = new Pool({ connectionString: url! });
    for (const name of names) {
      await admin.query('CREATE DATABASE "' + name + '"');
      const dsn = new URL(url!);
      dsn.pathname = "/" + name;
      pools.push(new Pool({ connectionString: dsn.toString() }));
    }
  }, 30_000);
  afterAll(async () => {
    await Promise.all(pools.map(async pool => pool.end()));
    if (admin) {
      for (const name of names) {
        await admin.query('DROP DATABASE IF EXISTS "' + name + '" WITH (FORCE)');
      }
      await admin.end();
    }
  }, 30_000);
  it("installs canonical Masana Feed and Rooms from an empty database", async () => {
    const roots = platformProductMigrationRoots();
    const applied = await runMigrations(pools[0]!, roots);
    expect(applied).toContain("masana/0001_masana_profiles.sql");
    expect(applied).toContain("masana/0002_chat_inbox.sql");
    expect(applied).toContain("feed/0001_feed.sql");
    expect(applied).toContain("rooms/0001_rooms_free.sql");
    expect(await checkPostgresReadiness(pools[0]!, roots)).toEqual({ ready: true });
    expect(await runMigrations(pools[0]!, roots)).toEqual([]);
  }, 60_000);
  it("upgrades the existing foundation/agent schema without replacing historical migrations", async () => {
    const roots = platformProductMigrationRoots();
    await runMigrations(pools[1]!, characterSessionMigrationRoots());
    const applied = await runMigrations(pools[1]!, roots);
    expect(applied.some(x => x.startsWith("masana/"))).toBe(true);
    expect(applied.some(x => x.startsWith("feed/"))).toBe(true);
    expect(applied.some(x => x.startsWith("rooms/"))).toBe(true);
    expect(await checkPostgresReadiness(pools[1]!, roots)).toEqual({ ready: true });
    expect(await runMigrations(pools[1]!, roots)).toEqual([]);
  }, 60_000);
});
