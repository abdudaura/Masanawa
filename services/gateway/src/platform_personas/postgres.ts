import { parseCanonicalId, type TenantId, type CharacterId, type CharacterVersionId } from "@masanawa/contracts";
import type { PersonaSeedBinding, PersonaSeedReservations } from "./bootstrap.js";

/** Narrow pg Pool adapter; never uses a shared transaction/client from a
 * caller and never calls a model or an untrusted script. A session advisory
 * lease serializes all F03 participants across pods while the callback runs. */
export interface PersonaSeedSqlClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(error?: Error): void;
}
export interface PersonaSeedSqlPool {
  connect(): Promise<PersonaSeedSqlClient>;
}

const LOCK_SQL = "SELECT pg_try_advisory_lock(hashtextextended($1::text, 0)) AS acquired";
const UNLOCK_SQL = "SELECT pg_advisory_unlock(hashtextextended($1::text, 0)) AS unlocked";

/** Requires migration platform_personas/0001_seed_bindings.sql to be applied
 * first by the sole F11 migration owner. No startup CREATE TABLE/DDL. */
export function createPostgresPersonaSeedReservations(pool: PersonaSeedSqlPool): PersonaSeedReservations {
  return Object.freeze({
    async withSeedLease<T>(input: {
      readonly tenantId: TenantId;
      readonly seedKey: string;
      readonly allocate: () => PersonaSeedBinding;
      readonly run: (binding: PersonaSeedBinding) => Promise<T>;
    }): Promise<T> {
      const tenantId = parseCanonicalId("tenant", input.tenantId);
      if (!/^platform\.[a-z]+$/.test(input.seedKey) || input.seedKey.length > 80) {
        throw new TypeError("invalid canonical persona seed key");
      }
      const lockKey = `${tenantId}:${input.seedKey}`;
      const client = await pool.connect();
      let locked = false;
      let damaged: Error | undefined;
      try {
        const lock = await client.query(LOCK_SQL, [lockKey]);
        if (lock.rows[0]?.acquired !== true) {
          throw new Error("persona seed lease is busy; retry after reconciliation");
        }
        locked = true;
        const allocated = input.allocate();
        await client.query(
          `INSERT INTO agents.platform_persona_seed_bindings
            (tenant_id, seed_key, character_id, character_version_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [tenantId, input.seedKey, allocated.characterId, allocated.characterVersionId],
        );
        const rows = (await client.query(
          `SELECT character_id, character_version_id
           FROM agents.platform_persona_seed_bindings
           WHERE tenant_id = $1 AND seed_key = $2`,
          [tenantId, input.seedKey],
        )).rows;
        if (rows.length !== 1) {
          throw new Error("persona seed reservation is missing or ambiguous");
        }
        const identity: PersonaSeedBinding = Object.freeze({
          characterId: parseCanonicalId("character", rows[0]!.character_id as string) as CharacterId,
          characterVersionId: parseCanonicalId("character-version", rows[0]!.character_version_id as string) as CharacterVersionId,
        });
        return await input.run(identity);
      } finally {
        if (locked) {
          try {
            const released = await client.query(UNLOCK_SQL, [lockKey]);
            if (released.rows[0]?.unlocked !== true) {
              throw new Error("Postgres persona seed advisory lock was not released");
            }
          } catch (error) {
            damaged = error instanceof Error ? error : new Error("Failed to release persona seed lease");
          }
        }
        client.release(damaged);
        if (damaged) throw damaged;
      }
    },
  });
}
