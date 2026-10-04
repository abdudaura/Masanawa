import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { characterContextMigrationRoots, checkPostgresReadiness } from "./readiness.js";
import { readMigrationManifest } from "./migrations.js";

describe("Character context schema readiness", () => {
  it("fails closed when the session ledger exists but relationship memory migrations are missing", async () => {
    const roots = characterContextMigrationRoots();
    const manifest = await readMigrationManifest(roots);
    const pool = { async query(sql: string) {
      if (sql.includes("server_version_num")) return { rows: [{ server_version_num: "180006" }] };
      if (sql.includes("to_regclass")) return { rows: [{ relation_name: "masanawa_schema_migrations" }] };
      return { rows: manifest.filter(m => m.owner !== "memory") };
    } } as unknown as Pool;
    expect(await checkPostgresReadiness(pool, roots)).toEqual({ ready: false, reason: "schema-outdated" });
  });
  it("admits the complete session, memory and public World ledger", async () => {
    const roots = characterContextMigrationRoots();
    const manifest = await readMigrationManifest(roots);
    const pool = { async query(sql: string) {
      if (sql.includes("server_version_num")) return { rows: [{ server_version_num: "180006" }] };
      if (sql.includes("to_regclass")) return { rows: [{ relation_name: "masanawa_schema_migrations" }] };
      return { rows: manifest };
    } } as unknown as Pool;
    expect(await checkPostgresReadiness(pool, roots)).toEqual({ ready: true });
  });
});
