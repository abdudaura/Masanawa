import type { Pool } from "pg";
import {
  normalizeTwinProfilePatch,
  normalizeTwinPublicId,
  type TwinProfileRepository,
  type TwinPublicProfile,
} from "@masanawa/identity";
import { parseCanonicalId, toInstant } from "@masanawa/contracts";

interface TwinProfileRow {
  tenant_id: string;
  character_id: string;
  owner_user_id: string;
  public_id: string;
  display_name: string;
  bio: string;
  interests: unknown;
  languages: unknown;
  avatar_url: string | null;
  discoverable: boolean;
  revision: string | number;
  created_at: string | Date;
  updated_at: string | Date;
}

function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid Twin profile ${field}`);
  }
  return Object.freeze(value.map((item) => item.trim()));
}

function decode(row: TwinProfileRow): TwinPublicProfile {
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("Invalid Twin profile revision");
  }
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", row.tenant_id),
    characterId: parseCanonicalId("character", row.character_id),
    ownerUserId: parseCanonicalId("user", row.owner_user_id),
    publicId: normalizeTwinPublicId(row.public_id),
    displayName: row.display_name.trim(),
    bio: row.bio,
    interests: stringList(row.interests, "interests"),
    languages: stringList(row.languages, "languages"),
    avatarUrl: row.avatar_url?.trim() || null,
    discoverable: row.discoverable === true,
    revision,
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}

export function createPostgresTwinProfileRepository(
  pool: Pool,
): TwinProfileRepository {
  return Object.freeze<TwinProfileRepository>({
    async create(input) {
      const result = await pool.query<TwinProfileRow>(
        `INSERT INTO identity.twin_public_profiles(
           tenant_id, character_id, owner_user_id, public_id, display_name, bio,
           interests, languages, avatar_url, discoverable, revision, created_at, updated_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13)
         ON CONFLICT (tenant_id, character_id) DO NOTHING
         RETURNING *`,
        [
          input.tenantId,
          input.characterId,
          input.ownerUserId,
          normalizeTwinPublicId(input.publicId),
          input.displayName,
          input.bio,
          JSON.stringify([...input.interests]),
          JSON.stringify([...input.languages]),
          input.avatarUrl,
          input.discoverable,
          input.revision,
          input.createdAt,
          input.updatedAt,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Twin profile already exists");
      return decode(row);
    },

    async readForOwner(input) {
      const result = await pool.query<TwinProfileRow>(
        `WITH seeded AS (
           INSERT INTO identity.twin_public_profiles(
             tenant_id, character_id, owner_user_id, public_id, display_name, bio,
             interests, languages, avatar_url, discoverable, revision, created_at, updated_at
           )
           SELECT
             s.tenant_id,
             s.result->>'characterId',
             s.user_id,
             'twin_' || substr(md5(s.result->>'characterId'), 1, 20),
             left(btrim(s.profile->>'displayName'), 80),
             left(coalesce(s.profile->>'biography', ''), 500),
             coalesce(s.profile->'expertise', '[]'::jsonb),
             s.profile->'languages',
             NULL,
             false,
             1,
             s.created_at,
             s.updated_at
           FROM identity.clone_setups s
           JOIN identity.character_ownership o
             ON o.tenant_id=s.tenant_id
            AND o.character_id=s.result->>'characterId'
            AND o.owner_user_id=s.user_id
            AND o.kind='personal-clone'
           WHERE s.tenant_id=$1
             AND s.user_id=$2
             AND s.state='ready'
             AND s.result IS NOT NULL
           ON CONFLICT DO NOTHING
           RETURNING *
         )
         SELECT *
           FROM identity.twin_public_profiles
          WHERE tenant_id=$1 AND owner_user_id=$2`,
        [input.tenantId, input.ownerUserId],
      );
      return result.rows[0] ? decode(result.rows[0]) : null;
    },

    async readPublicById(input) {
      const result = await pool.query<TwinProfileRow>(
        `SELECT *
           FROM identity.twin_public_profiles
          WHERE tenant_id=$1 AND public_id=$2`,
        [input.tenantId, normalizeTwinPublicId(input.publicId)],
      );
      return result.rows[0] ? decode(result.rows[0]) : null;
    },

    async searchPublic(input) {
      if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 50) {
        throw new RangeError("Twin directory limit must be between 1 and 50");
      }
      const query = input.query.trim();
      if (query.length > 80) throw new RangeError("Twin search query is too long");
      const like = `%${query}%`;
      const result = await pool.query<TwinProfileRow>(
        `SELECT *
           FROM identity.twin_public_profiles
          WHERE tenant_id=$1
            AND discoverable=true
            AND (
              $2 = ''
              OR display_name ILIKE $3
              OR bio ILIKE $3
              OR EXISTS (
                SELECT 1
                  FROM jsonb_array_elements_text(languages) AS language
                 WHERE language ILIKE $3
              )
              OR EXISTS (
                SELECT 1
                  FROM jsonb_array_elements_text(interests) AS interest
                 WHERE interest ILIKE $3
              )
            )
          ORDER BY updated_at DESC, public_id ASC
          LIMIT $4`,
        [input.tenantId, query, like, input.limit],
      );
      return Object.freeze(result.rows.map(decode));
    },

    async update(input) {
      const patch = normalizeTwinProfilePatch(input.patch);
      const result = await pool.query<TwinProfileRow>(
        `UPDATE identity.twin_public_profiles
            SET display_name = COALESCE($5, display_name),
                bio = COALESCE($6, bio),
                interests = COALESCE($7::jsonb, interests),
                languages = COALESCE($8::jsonb, languages),
                avatar_url = CASE WHEN $9::boolean THEN $10 ELSE avatar_url END,
                discoverable = COALESCE($11, discoverable),
                revision = revision + 1,
                updated_at = $12
          WHERE tenant_id=$1
            AND character_id=$2
            AND owner_user_id=$3
            AND revision=$4
          RETURNING *`,
        [
          input.tenantId,
          input.characterId,
          input.ownerUserId,
          input.expectedRevision,
          patch.displayName ?? null,
          patch.bio ?? null,
          patch.interests === undefined ? null : JSON.stringify([...patch.interests]),
          patch.languages === undefined ? null : JSON.stringify([...patch.languages]),
          patch.avatarUrl !== undefined,
          patch.avatarUrl ?? null,
          patch.discoverable ?? null,
          input.updatedAt,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Twin profile revision conflict");
      return decode(row);
    },
  });
}
