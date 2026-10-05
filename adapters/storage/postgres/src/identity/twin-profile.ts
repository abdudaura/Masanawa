import type {
  CharacterId,
  Instant,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import {
  assertStableTwinShareIdentity,
  normalizeTwinProfilePatch,
  normalizeTwinPublicId,
  type TwinProfilePatch,
  type TwinProfileRepository,
  type TwinPublicProfile,
} from "@masanawa/identity";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

type TwinProfileRow = {
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
  revision: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function asInstant(value: Date | string): Instant {
  return (value instanceof Date ? value : new Date(value)).toISOString() as Instant;
}

function strings(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("Stored Twin profile list is invalid");
  }
  return Object.freeze([...value] as string[]);
}

function fromRow(row: TwinProfileRow): TwinPublicProfile {
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("Stored Twin profile revision is invalid");
  }
  return Object.freeze({
    tenantId: row.tenant_id as TenantId,
    characterId: row.character_id as CharacterId,
    ownerUserId: row.owner_user_id as UserId,
    publicId: normalizeTwinPublicId(row.public_id),
    displayName: row.display_name,
    bio: row.bio,
    interests: strings(row.interests),
    languages: strings(row.languages),
    avatarUrl: row.avatar_url,
    discoverable: row.discoverable,
    revision,
    createdAt: asInstant(row.created_at),
    updatedAt: asInstant(row.updated_at),
  });
}

function deterministicPublicId(characterId: CharacterId): string {
  const suffix = String(characterId)
    .replace(/^character_/u, "")
    .replace(/-/gu, "")
    .toLowerCase();
  return normalizeTwinPublicId(`twin_${suffix.slice(0, 48)}`);
}

export interface PostgresTwinProfileRepository extends TwinProfileRepository {
  readForCharacter(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
  }): Promise<TwinPublicProfile | null>;

  ensureForOwner(input: {
    readonly tenantId: TenantId;
    readonly ownerUserId: UserId;
    readonly at?: Instant;
  }): Promise<TwinPublicProfile | null>;
}

export function createPostgresTwinProfileRepository(
  pool: Pool,
): PostgresTwinProfileRepository {
  async function readForOwner(input: {
    readonly tenantId: TenantId;
    readonly ownerUserId: UserId;
  }): Promise<TwinPublicProfile | null> {
    const result = await pool.query<TwinProfileRow>(
      `SELECT tenant_id, character_id, owner_user_id, public_id,
              display_name, bio, interests, languages, avatar_url,
              discoverable, revision::text, created_at, updated_at
         FROM identity.twin_profiles
        WHERE tenant_id = $1 AND owner_user_id = $2`,
      [input.tenantId, input.ownerUserId],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  return Object.freeze({
    async create(input) {
      return withTransaction(pool, async (client) => {
        const inserted = await client.query<TwinProfileRow>(
          `INSERT INTO identity.twin_profiles(
             tenant_id, character_id, owner_user_id, public_id,
             display_name, bio, interests, languages, avatar_url,
             discoverable, revision, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13)
           ON CONFLICT (tenant_id, character_id) DO NOTHING
           RETURNING tenant_id, character_id, owner_user_id, public_id,
                     display_name, bio, interests, languages, avatar_url,
                     discoverable, revision::text, created_at, updated_at`,
          [
            input.tenantId,
            input.characterId,
            input.ownerUserId,
            normalizeTwinPublicId(input.publicId),
            input.displayName,
            input.bio,
            JSON.stringify(input.interests),
            JSON.stringify(input.languages),
            input.avatarUrl,
            input.discoverable,
            input.revision,
            input.createdAt,
            input.updatedAt,
          ],
        );
        if (inserted.rows[0]) return fromRow(inserted.rows[0]);
        const existing = await client.query<TwinProfileRow>(
          `SELECT tenant_id, character_id, owner_user_id, public_id,
                  display_name, bio, interests, languages, avatar_url,
                  discoverable, revision::text, created_at, updated_at
             FROM identity.twin_profiles
            WHERE tenant_id=$1 AND character_id=$2`,
          [input.tenantId, input.characterId],
        );
        if (!existing.rows[0]) throw new Error("Twin profile create failed");
        const replay = fromRow(existing.rows[0]);
        assertStableTwinShareIdentity({ previous: input, next: replay });
        return replay;
      });
    },

    readForOwner,

    async readForCharacter(input) {
      const result = await pool.query<TwinProfileRow>(
        `SELECT tenant_id, character_id, owner_user_id, public_id,
                display_name, bio, interests, languages, avatar_url,
                discoverable, revision::text, created_at, updated_at
           FROM identity.twin_profiles
          WHERE tenant_id=$1 AND character_id=$2`,
        [input.tenantId, input.characterId],
      );
      return result.rows[0] ? fromRow(result.rows[0]) : null;
    },

    async readPublicById(input) {
      const result = await pool.query<TwinProfileRow>(
        `SELECT tenant_id, character_id, owner_user_id, public_id,
                display_name, bio, interests, languages, avatar_url,
                discoverable, revision::text, created_at, updated_at
           FROM identity.twin_profiles
          WHERE tenant_id=$1 AND public_id=$2 AND discoverable=true`,
        [input.tenantId, normalizeTwinPublicId(input.publicId)],
      );
      return result.rows[0] ? fromRow(result.rows[0]) : null;
    },

    async searchPublic(input) {
      const query = input.query.trim().toLowerCase();
      const limit = Math.max(1, Math.min(50, input.limit));
      const result = await pool.query<TwinProfileRow>(
        `SELECT tenant_id, character_id, owner_user_id, public_id,
                display_name, bio, interests, languages, avatar_url,
                discoverable, revision::text, created_at, updated_at
           FROM identity.twin_profiles
          WHERE tenant_id=$1
            AND discoverable=true
            AND ($2 = '' OR lower(display_name) LIKE '%' || $2 || '%'
                         OR lower(bio) LIKE '%' || $2 || '%')
          ORDER BY updated_at DESC, public_id
          LIMIT $3`,
        [input.tenantId, query, limit],
      );
      return Object.freeze(result.rows.map(fromRow));
    },

    async update(input) {
      const patch: TwinProfilePatch = normalizeTwinProfilePatch(input.patch);
      return withTransaction(pool, async (client) => {
        const currentResult = await client.query<TwinProfileRow>(
          `SELECT tenant_id, character_id, owner_user_id, public_id,
                  display_name, bio, interests, languages, avatar_url,
                  discoverable, revision::text, created_at, updated_at
             FROM identity.twin_profiles
            WHERE tenant_id=$1 AND character_id=$2 AND owner_user_id=$3
            FOR UPDATE`,
          [input.tenantId, input.characterId, input.ownerUserId],
        );
        if (!currentResult.rows[0]) throw new Error("Twin profile not found");
        const current = fromRow(currentResult.rows[0]);
        if (current.revision !== input.expectedRevision) {
          throw new Error("Twin profile revision conflict");
        }
        const next = {
          displayName: patch.displayName ?? current.displayName,
          bio: patch.bio ?? current.bio,
          interests: patch.interests ?? current.interests,
          languages: patch.languages ?? current.languages,
          avatarUrl:
            Object.prototype.hasOwnProperty.call(patch, "avatarUrl")
              ? patch.avatarUrl ?? null
              : current.avatarUrl,
          discoverable: patch.discoverable ?? current.discoverable,
        };
        const updated = await client.query<TwinProfileRow>(
          `UPDATE identity.twin_profiles
              SET display_name=$4, bio=$5, interests=$6::jsonb, languages=$7::jsonb,
                  avatar_url=$8, discoverable=$9, revision=revision+1, updated_at=$10
            WHERE tenant_id=$1 AND character_id=$2 AND owner_user_id=$3
            RETURNING tenant_id, character_id, owner_user_id, public_id,
                      display_name, bio, interests, languages, avatar_url,
                      discoverable, revision::text, created_at, updated_at`,
          [
            input.tenantId,
            input.characterId,
            input.ownerUserId,
            next.displayName,
            next.bio,
            JSON.stringify(next.interests),
            JSON.stringify(next.languages),
            next.avatarUrl,
            next.discoverable,
            input.updatedAt,
          ],
        );
        return fromRow(updated.rows[0]!);
      });
    },

    async ensureForOwner(input) {
      const existing = await readForOwner(input);
      if (existing) return existing;
      const at = input.at ?? (new Date().toISOString() as Instant);
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `twin-profile:${input.tenantId}:${input.ownerUserId}`,
        ]);
        const again = await client.query<TwinProfileRow>(
          `SELECT tenant_id, character_id, owner_user_id, public_id,
                  display_name, bio, interests, languages, avatar_url,
                  discoverable, revision::text, created_at, updated_at
             FROM identity.twin_profiles
            WHERE tenant_id=$1 AND owner_user_id=$2`,
          [input.tenantId, input.ownerUserId],
        );
        if (again.rows[0]) return fromRow(again.rows[0]);

        const source = await client.query<{
          character_id: string;
          constitution: Record<string, unknown>;
          created_at: Date | string;
        }>(
          `SELECT o.character_id, v.constitution, o.created_at
             FROM identity.character_ownership o
             JOIN identity.characters c
               ON c.tenant_id=o.tenant_id AND c.character_id=o.character_id
             JOIN identity.character_versions v
               ON v.tenant_id=c.tenant_id
              AND v.character_version_id=c.active_character_version_id
            WHERE o.tenant_id=$1 AND o.owner_user_id=$2
              AND o.kind='personal-clone'
              AND c.state='active' AND v.state='published'`,
          [input.tenantId, input.ownerUserId],
        );
        const row = source.rows[0];
        if (!row) return null;
        const displayName =
          typeof row.constitution.displayName === "string"
            ? row.constitution.displayName.trim()
            : "";
        const bio =
          typeof row.constitution.biography === "string"
            ? row.constitution.biography.trim().slice(0, 500)
            : "";
        const languages = Array.isArray(row.constitution.languages)
          ? row.constitution.languages.filter(
              (value): value is string => typeof value === "string",
            )
          : [];
        const interests = Array.isArray(row.constitution.expertise)
          ? row.constitution.expertise.filter(
              (value): value is string => typeof value === "string",
            )
          : [];
        if (!displayName || languages.length === 0) {
          throw new Error("Canonical personal clone is missing Twin profile fields");
        }
        const characterId = row.character_id as CharacterId;
        const createdAt = asInstant(row.created_at);
        const inserted = await client.query<TwinProfileRow>(
          `INSERT INTO identity.twin_profiles(
             tenant_id, character_id, owner_user_id, public_id,
             display_name, bio, interests, languages, avatar_url,
             discoverable, revision, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,NULL,false,1,$9,$10)
           RETURNING tenant_id, character_id, owner_user_id, public_id,
                     display_name, bio, interests, languages, avatar_url,
                     discoverable, revision::text, created_at, updated_at`,
          [
            input.tenantId,
            characterId,
            input.ownerUserId,
            deterministicPublicId(characterId),
            displayName.slice(0, 80),
            bio,
            JSON.stringify(interests.slice(0, 20)),
            JSON.stringify(languages.slice(0, 12)),
            createdAt,
            at,
          ],
        );
        return fromRow(inserted.rows[0]!);
      });
    },
  });
}
