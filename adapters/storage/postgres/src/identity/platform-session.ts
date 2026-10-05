import {
  createCanonicalId,
  nowInstant,
  type CharacterId,
  type ExternalSubjectRef,
  type RelationshipId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import { createPostgresIdentityRepository } from "./repository.js";
import { withTransaction } from "../transaction.js";
import type { Pool } from "pg";

export interface PostgresPlatformIdentityBridge {
  resolveOrCreateUser(input: {
    readonly tenantId: TenantId;
    readonly externalUserId: string;
  }): Promise<UserId>;
  relationshipFor(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly characterId: CharacterId;
  }): Promise<RelationshipId>;
  listCharacterIdsForUser(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
  }): Promise<readonly CharacterId[]>;
  resolveSingleActiveTenant(): Promise<TenantId>;
}

function subject(externalUserId: string): ExternalSubjectRef {
  const value = externalUserId.trim();
  if (!value || value.length > 512 || /[\r\n\0]/u.test(value)) {
    throw new TypeError("External platform user id is invalid");
  }
  return Object.freeze({
    system: "unigeria",
    namespace: "platform-user",
    value,
    subjectKind: "user" as const,
    authenticationStrength: "strong" as const,
    observedAt: nowInstant(),
    provenance: Object.freeze({ source: "platform-session" }),
  });
}

export function createPostgresPlatformIdentityBridge(
  pool: Pool,
): PostgresPlatformIdentityBridge {
  const bridge: PostgresPlatformIdentityBridge = {
    async resolveOrCreateUser(input) {
      return withTransaction(pool, async (client) => {
        const externalSubject = subject(input.externalUserId);
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [`${input.tenantId}|unigeria|platform-user|${externalSubject.value}`],
        );
        const repository = createPostgresIdentityRepository(client);
        const existing = await repository.resolveUserByExternalIdentity(
          input.tenantId,
          externalSubject,
        );
        if (existing) return existing;

        const userId = createCanonicalId("user");
        const now = nowInstant();
        await repository.createUser({
          tenantId: input.tenantId,
          userId,
          createdAt: now,
        });
        await repository.linkExternalUserIdentity({
          tenantId: input.tenantId,
          userId,
          subject: externalSubject,
          linkedAt: now,
        });
        return userId;
      });
    },

    async relationshipFor(input) {
      return withTransaction(pool, async (client) => {
        const repository = createPostgresIdentityRepository(client);
        const relationship = await repository.getOrCreateRelationship({
          tenantId: input.tenantId,
          relationshipId: createCanonicalId("relationship"),
          userId: input.userId,
          characterId: input.characterId,
          createdAt: nowInstant(),
        });
        return relationship.relationshipId;
      });
    },

    async listCharacterIdsForUser(input) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ character_id: CharacterId }>(
            `SELECT character_id
               FROM identity.relationships
              WHERE tenant_id = $1 AND user_id = $2 AND state = 'active'
              ORDER BY character_id`,
            [input.tenantId, input.userId],
          );
          return Object.freeze(result.rows.map((row) => row.character_id));
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async resolveSingleActiveTenant() {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ tenant_id: TenantId }>(
            `SELECT tenant_id
               FROM identity.tenants
              WHERE state = 'active'
              ORDER BY created_at
              LIMIT 2`,
          );
          if (result.rowCount !== 1) {
            throw new Error(
              result.rowCount === 0
                ? "No active Masanawa tenant exists"
                : "Multiple active Masanawa tenants require MASANAWA_PLATFORM_TENANT_ID",
            );
          }
          return result.rows[0]!.tenant_id;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },
  };
  return Object.freeze(bridge);
}
