import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "./transaction.js";

export interface MigrationRoot {
  readonly owner: string;
  readonly directory: string;
}

export interface MigrationFingerprint {
  readonly owner: string;
  readonly name: string;
  readonly sha256: string;
}

interface MigrationFile extends MigrationFingerprint {
  readonly owner: string;
  readonly name: string;
  readonly path: string;
  readonly sql: string;
  readonly sha256: string;
}

const migrationNamePattern = /^\d{4,}_[a-z0-9][a-z0-9_-]*\.sql$/u;

async function loadMigrationRoot(root: MigrationRoot): Promise<MigrationFile[]> {
  const entries = (await readdir(root.directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && migrationNamePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const migrations: MigrationFile[] = [];
  for (const name of entries) {
    const filePath = path.join(root.directory, name);
    const sql = await readFile(filePath, "utf8");
    migrations.push({
      owner: root.owner,
      name,
      path: filePath,
      sql,
      sha256: createHash("sha256").update(sql, "utf8").digest("hex"),
    });
  }
  return migrations;
}

export async function readMigrationManifest(
  roots: readonly MigrationRoot[],
): Promise<readonly MigrationFingerprint[]> {
  const migrations = (
    await Promise.all(roots.map((root) => loadMigrationRoot(root)))
  )
    .flat()
    .sort((left, right) =>
      left.owner === right.owner
        ? left.name.localeCompare(right.name)
        : left.owner.localeCompare(right.owner),
    );

  return Object.freeze(
    migrations.map(({ owner, name, sha256 }) =>
      Object.freeze({ owner, name, sha256 }),
    ),
  );
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.masanawa_schema_migrations (
      owner text NOT NULL,
      name text NOT NULL,
      sha256 text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY (owner, name)
    )
  `);
}

async function applyMigration(client: PoolClient, migration: MigrationFile): Promise<boolean> {
  const existing = await client.query<{ sha256: string }>(
    `SELECT sha256
       FROM public.masanawa_schema_migrations
      WHERE owner = $1 AND name = $2`,
    [migration.owner, migration.name],
  );

  if (existing.rowCount === 1) {
    if (existing.rows[0]!.sha256 !== migration.sha256) {
      throw new Error(
        `Applied migration changed: ${migration.owner}/${migration.name}`,
      );
    }
    return false;
  }

  await client.query(migration.sql);
  await client.query(
    `INSERT INTO public.masanawa_schema_migrations(owner, name, sha256)
     VALUES ($1, $2, $3)`,
    [migration.owner, migration.name, migration.sha256],
  );
  return true;
}

export async function runMigrations(
  pool: Pool,
  roots: readonly MigrationRoot[],
): Promise<readonly string[]> {
  // Apply roots in dependency order (identity before Masana; Masana before
  // Feed/Rooms), while preserving each root's numbered forward-only files.
  // Sorting by owner name could run a dependent schema before its authority.
  const migrations = (await Promise.all(roots.map(loadMigrationRoot))).flat();

  return withTransaction(
    pool,
    async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('masanawa:schema-migrations'))",
      );
      await ensureMigrationTable(client);

      const applied: string[] = [];
      for (const migration of migrations) {
        if (await applyMigration(client, migration)) {
          applied.push(`${migration.owner}/${migration.name}`);
        }
      }
      return Object.freeze(applied);
    },
    { isolation: "serializable" },
  );
}
