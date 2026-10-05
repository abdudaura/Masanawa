import type {
  UserCharacterRelationship,
  UserRelationshipProvisioner,
  UserRelationshipReader,
} from "@masanawa/identity";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

interface RelationshipRow {
  tenant_id: UserCharacterRelationship["tenantId"];
  relationship_id: UserCharacterRelationship["relationshipId"];
  user_id: UserCharacterRelationship["userId"];
  character_id: UserCharacterRelationship["characterId"];
  state: UserCharacterRelationship["state"];
  stage: string | null;
  tone: string | null;
  preferences: UserCharacterRelationship["preferences"];
  disclosures: UserCharacterRelationship["disclosures"];
  permissions: UserCharacterRelationship["permissions"];
  revision: string;
  created_at: Date;
  updated_at: Date;
}

function fromRow(row: RelationshipRow): UserCharacterRelationship {
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("Invalid relationship revision");
  }
  return Object.freeze({
    tenantId: row.tenant_id,
    relationshipId: row.relationship_id,
    userId: row.user_id,
    characterId: row.character_id,
    state: row.state,
    stage: row.stage,
    tone: row.tone,
    preferences: Object.freeze({ ...row.preferences }),
    disclosures: Object.freeze({ ...row.disclosures }),
    permissions: Object.freeze({ ...row.permissions }),
    revision,
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}

export function createPostgresUserRelationshipReader(
  pool: Pool,
): UserRelationshipReader {
  return Object.freeze<UserRelationshipReader>({
    async readForUserCharacter(input) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<RelationshipRow>(
            `SELECT * FROM identity.relationships
              WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3
                AND state='active'`,
            [input.tenantId, input.userId, input.characterId],
          );
          return result.rows[0] ? fromRow(result.rows[0]) : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },
    async listForUser(input) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<RelationshipRow>(
            `SELECT * FROM identity.relationships
              WHERE tenant_id=$1 AND user_id=$2 AND state='active'
              ORDER BY created_at, character_id`,
            [input.tenantId, input.userId],
          );
          return Object.freeze(result.rows.map(fromRow));
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },
  });
}


export function createPostgresUserRelationshipProvisioner(
  pool: Pool,
): UserRelationshipProvisioner {
  return Object.freeze<UserRelationshipProvisioner>({
    async getOrCreateForUserCharacter(input) {
      return withTransaction(
        pool,
        async (client) => {
          await client.query(
            "SELECT pg_advisory_xact_lock(hashtext($1))",
            [
              `relationship:${input.tenantId}:${input.userId}:${input.characterId}`,
            ],
          );
          const inserted = await client.query<RelationshipRow>(
            `INSERT INTO identity.relationships(
               tenant_id,relationship_id,user_id,character_id,state,stage,tone,
               preferences,disclosures,permissions,revision,created_at,updated_at
             )
             VALUES ($1,$2,$3,$4,'active',NULL,NULL,'{}'::jsonb,'{}'::jsonb,
                     '{}'::jsonb,1,$5,$5)
             ON CONFLICT (tenant_id,user_id,character_id) DO NOTHING
             RETURNING *`,
            [
              input.tenantId,
              createCanonicalId("relationship"),
              input.userId,
              input.characterId,
              input.createdAt,
            ],
          );
          if (inserted.rows[0]) return fromRow(inserted.rows[0]);

          const existing = await client.query<RelationshipRow>(
            `SELECT * FROM identity.relationships
              WHERE tenant_id=$1 AND user_id=$2 AND character_id=$3
                AND state='active'
              FOR SHARE`,
            [input.tenantId,input.userId,input.characterId],
          );
          if (!existing.rows[0]) {
            throw new Error("identity.relationship_unavailable");
          }
          return fromRow(existing.rows[0]);
        },
        { isolation: "serializable" },
      );
    },
  });
}
