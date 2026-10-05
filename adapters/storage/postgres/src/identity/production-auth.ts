import {
  createCanonicalId,
  type CharacterId,
  type Instant,
  type RelationshipId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

export interface ProductionUserIdentityRepository {
  resolveOrCreateSupabaseUser(input: {
    readonly tenantId: TenantId;
    readonly projectRef: string;
    readonly subject: string;
    readonly observedAt: Instant;
    readonly expiresAt?: Instant;
  }): Promise<UserId>;

  getOrCreateRelationship(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly characterId: CharacterId;
    readonly createdAt: Instant;
  }): Promise<RelationshipId>;
}

function bounded(value: string, name: string, max: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\r\n\0]/u.test(normalized)) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

export function createPostgresProductionUserIdentityRepository(
  pool: Pool,
): ProductionUserIdentityRepository {
  return Object.freeze({
    async resolveOrCreateSupabaseUser(input) {
      const projectRef = bounded(input.projectRef, "projectRef", 128);
      const subject = bounded(input.subject, "subject", 256);
      return withTransaction(pool, async (client) => {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [`supabase-auth:${input.tenantId}:${projectRef}:${subject}`],
        );

        const tenant = await client.query<{ state: string }>(
          `SELECT state FROM identity.tenants WHERE tenant_id = $1`,
          [input.tenantId],
        );
        if (tenant.rows[0]?.state !== "active") {
          throw new Error("Production tenant is unavailable");
        }

        const existing = await client.query<{ user_id: UserId; state: string }>(
          `SELECT e.user_id, u.state
             FROM identity.external_user_identities e
             JOIN identity.users u
               ON u.tenant_id = e.tenant_id AND u.user_id = e.user_id
            WHERE e.tenant_id = $1
              AND e.system = 'supabase-auth'
              AND e.namespace = $2
              AND e.account_id IS NULL
              AND e.subject_value = $3
              AND (e.expires_at IS NULL OR e.expires_at > clock_timestamp())
            LIMIT 1`,
          [input.tenantId, projectRef, subject],
        );
        if (existing.rows[0]) {
          if (existing.rows[0].state !== "active") {
            throw new Error("User account is unavailable");
          }
          return existing.rows[0].user_id;
        }

        const userId = createCanonicalId("user");
        await client.query(
          `INSERT INTO identity.users
             (tenant_id, user_id, state, revision, created_at, updated_at)
           VALUES ($1, $2, 'active', 1, $3, $3)`,
          [input.tenantId, userId, input.observedAt],
        );
        await client.query(
          `INSERT INTO identity.external_user_identities
             (tenant_id, user_id, system, namespace, account_id, subject_value,
              authentication_strength, observed_at, expires_at, provenance, linked_at)
           VALUES ($1,$2,'supabase-auth',$3,NULL,$4,'strong',$5,$6,'{}'::jsonb,$5)`,
          [
            input.tenantId,
            userId,
            projectRef,
            subject,
            input.observedAt,
            input.expiresAt ?? null,
          ],
        );
        return userId;
      }, { isolation: "serializable" });
    },

    async getOrCreateRelationship(input) {
      return withTransaction(pool, async (client) => {
        const existing = await client.query<{ relationship_id: RelationshipId }>(
          `SELECT relationship_id
             FROM identity.relationships
            WHERE tenant_id = $1 AND user_id = $2 AND character_id = $3
            LIMIT 1`,
          [input.tenantId, input.userId, input.characterId],
        );
        if (existing.rows[0]) return existing.rows[0].relationship_id;

        const relationshipId = createCanonicalId("relationship");
        const inserted = await client.query<{ relationship_id: RelationshipId }>(
          `INSERT INTO identity.relationships
             (tenant_id, relationship_id, user_id, character_id, state,
              preferences, disclosures, permissions, revision, created_at, updated_at)
           VALUES ($1,$2,$3,$4,'active','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,1,$5,$5)
           ON CONFLICT (tenant_id, user_id, character_id) DO NOTHING
           RETURNING relationship_id`,
          [
            input.tenantId,
            relationshipId,
            input.userId,
            input.characterId,
            input.createdAt,
          ],
        );
        if (inserted.rows[0]) return inserted.rows[0].relationship_id;

        const raced = await client.query<{ relationship_id: RelationshipId }>(
          `SELECT relationship_id
             FROM identity.relationships
            WHERE tenant_id = $1 AND user_id = $2 AND character_id = $3
            LIMIT 1`,
          [input.tenantId, input.userId, input.characterId],
        );
        if (!raced.rows[0]) throw new Error("Relationship provisioning failed");
        return raced.rows[0].relationship_id;
      }, { isolation: "serializable" });
    },
  });
}
