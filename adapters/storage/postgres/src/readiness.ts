import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import {
  createPostgresPool,
  type PostgresPoolOptions,
} from "./pool.js";
import {
  readMigrationManifest,
  type MigrationFingerprint,
  type MigrationRoot,
} from "./migrations.js";

export type PostgresReadinessReason =
  | "database-unavailable"
  | "unsupported-version"
  | "schema-ledger-missing"
  | "schema-outdated"
  | "schema-drift"
  | "migration-artifacts-unavailable";

export type PostgresReadinessResult =
  | { readonly ready: true }
  | {
      readonly ready: false;
      readonly reason: PostgresReadinessReason;
    };

function packageMigrationDirectory(packageName: string): string {
  const entry = import.meta.resolve(packageName);
  return fileURLToPath(new URL("../migrations/", entry));
}

export function foundationMigrationRoots(): readonly MigrationRoot[] {
  return Object.freeze([
    Object.freeze({
      owner: "events",
      directory: packageMigrationDirectory("@masanawa/events"),
    }),
    Object.freeze({
      owner: "security",
      directory: packageMigrationDirectory("@masanawa/security"),
    }),
    Object.freeze({
      owner: "skills",
      directory: packageMigrationDirectory("@masanawa/skills"),
    }),
  ]);
}

/** Explicit composition root for CharacterSession consumers; no foreign schema mutation. */
export function characterSessionMigrationRoots(): readonly MigrationRoot[] {
  return Object.freeze([
    ...foundationMigrationRoots(),
    Object.freeze({ owner: "identity", directory: packageMigrationDirectory("@masanawa/identity") }),
    Object.freeze({ owner: "agents", directory: packageMigrationDirectory("@masanawa/agents") }),
  ]);
}

export function platformProductMigrationRoots(): readonly MigrationRoot[] {
  return Object.freeze([
    ...characterSessionMigrationRoots(),
    Object.freeze({
      owner: "commerce",
      directory: packageMigrationDirectory("@masanawa/commerce"),
    }),
    // These new domains are forward-only migrations. Existing owner hashes
    // and historical ledger, auth and money migrations remain untouched.
    ...["masana", "external-videos", "feed", "rooms"].map((owner) =>
      Object.freeze({
        owner,
        directory: fileURLToPath(new URL(`../../../../packages/${owner}/migrations/`, import.meta.url)),
      }),
    ),
    Object.freeze({
      owner: "talks",
      directory: fileURLToPath(
        new URL("../../../../packages/talks/migrations/", import.meta.url),
      ),
    }),
  ]);
}

function migrationKey(
  migration: Pick<MigrationFingerprint, "owner" | "name">,
): string {
  return `${migration.owner}/${migration.name}`;
}

export async function checkPostgresReadiness(
  pool: Pool,
  roots: readonly MigrationRoot[] = foundationMigrationRoots(),
): Promise<PostgresReadinessResult> {
  let expected: readonly MigrationFingerprint[];
  try {
    expected = await readMigrationManifest(roots);
  } catch {
    return Object.freeze({
      ready: false,
      reason: "migration-artifacts-unavailable",
    });
  }

  try {
    const version = await pool.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    const versionNumber = Number(version.rows[0]?.server_version_num);
    if (
      !Number.isSafeInteger(versionNumber) ||
      versionNumber < 180_000 ||
      versionNumber >= 190_000
    ) {
      return Object.freeze({
        ready: false,
        reason: "unsupported-version",
      });
    }

    const ledger = await pool.query<{ relation_name: string | null }>(
      "SELECT to_regclass('public.masanawa_schema_migrations')::text AS relation_name",
    );
    if (!ledger.rows[0]?.relation_name) {
      return Object.freeze({
        ready: false,
        reason: "schema-ledger-missing",
      });
    }

    const applied = await pool.query<{
      owner: string;
      name: string;
      sha256: string;
    }>(
      `SELECT owner, name, sha256
         FROM public.masanawa_schema_migrations`,
    );
    const appliedByKey = new Map(
      applied.rows.map((migration) => [
        migrationKey(migration),
        migration.sha256,
      ]),
    );

    for (const migration of expected) {
      const appliedHash = appliedByKey.get(migrationKey(migration));
      if (appliedHash === undefined) {
        return Object.freeze({
          ready: false,
          reason: "schema-outdated",
        });
      }
      if (appliedHash !== migration.sha256) {
        return Object.freeze({
          ready: false,
          reason: "schema-drift",
        });
      }
    }

    return Object.freeze({ ready: true });
  } catch {
    return Object.freeze({
      ready: false,
      reason: "database-unavailable",
    });
  }
}

export function createPostgresReadinessCheck(
  pool: Pool,
  roots: readonly MigrationRoot[] = foundationMigrationRoots(),
) {
  return Object.freeze({
    name: "database-schema",
    async check(): Promise<{
      readonly ready: boolean;
      readonly reason?: string;
    }> {
      const result = await checkPostgresReadiness(pool, roots);
      return result.ready
        ? Object.freeze({ ready: true })
        : Object.freeze({ ready: false, reason: result.reason });
    },
  });
}


export interface PostgresServiceDependency {
  readonly pool: Pool;
  readonly readinessCheck: ReturnType<typeof createPostgresReadinessCheck>;
  close(): Promise<void>;
}

export function createPostgresServiceDependency(
  options: PostgresPoolOptions & {
    readonly migrationRoots?: readonly MigrationRoot[];
  },
): PostgresServiceDependency {
  const pool = createPostgresPool(options);
  const roots = options.migrationRoots ?? foundationMigrationRoots();
  return Object.freeze({
    pool,
    readinessCheck: createPostgresReadinessCheck(pool, roots),
    close: () => pool.end(),
  });
}
