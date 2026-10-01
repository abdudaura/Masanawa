import {
  PlatformError,
  toInstant,
  type ChannelAccountId,
  type CharacterId,
  type CharacterVersionId,
  type ExternalSubjectRef,
  type RelationshipId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  assertExternalUserSubjectLinkable,
  normalizeCharacterConstitution,
  type ActivateCharacterVersionInput,
  type Character,
  type CharacterConstitution,
  type CharacterVersion,
  type CreateCharacterInput,
  type CreateCharacterVersionInput,
  type CreateTenantInput,
  type CreateUserInput,
  type ExternalUserIdentityLink,
  type GetOrCreateRelationshipInput,
  type IdentityRepository,
  type LinkExternalUserIdentityInput,
  type PublishCharacterVersionInput,
  type Tenant,
  type User,
  type UserCharacterRelationship,
} from "@masanawa/identity";
import type { PoolClient } from "pg";

interface TenantRow {
  tenant_id: TenantId;
  state: Tenant["state"];
  revision: string;
  created_at: Date;
  updated_at: Date;
}
interface UserRow {
  tenant_id: TenantId;
  user_id: UserId;
  state: User["state"];
  revision: string;
  created_at: Date;
  updated_at: Date;
}
interface CharacterRow {
  tenant_id: TenantId;
  character_id: CharacterId;
  state: Character["state"];
  active_character_version_id: CharacterVersionId | null;
  revision: string;
  created_at: Date;
  updated_at: Date;
}
interface VersionRow {
  tenant_id: TenantId;
  character_version_id: CharacterVersionId;
  character_id: CharacterId;
  version_number: string;
  state: CharacterVersion["state"];
  constitution: CharacterConstitution;
  created_at: Date;
  published_at: Date | null;
  retired_at: Date | null;
}
interface RelationshipRow {
  tenant_id: TenantId;
  relationship_id: RelationshipId;
  user_id: UserId;
  character_id: CharacterId;
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
interface LinkRow {
  tenant_id: TenantId;
  user_id: UserId;
  system: string;
  namespace: string;
  account_id: ChannelAccountId | null;
  subject_value: string;
  authentication_strength: "linked" | "strong";
  observed_at: Date;
  expires_at: Date | null;
  provenance: Readonly<Record<string, string>>;
  linked_at: Date;
}

function revision(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Invalid identity revision returned by PostgreSQL");
  }
  return parsed;
}
function conflict(code: string, message: string): PlatformError {
  return new PlatformError({ code, category: "conflict", message, retryable: false });
}
function missing(code: string, message: string): PlatformError {
  return new PlatformError({ code, category: "not-found", message, retryable: false });
}
function tenant(row: TenantRow): Tenant {
  return Object.freeze({
    tenantId: row.tenant_id,
    state: row.state,
    revision: revision(row.revision),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}
function user(row: UserRow): User {
  return Object.freeze({
    tenantId: row.tenant_id,
    userId: row.user_id,
    state: row.state,
    revision: revision(row.revision),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}
function character(row: CharacterRow): Character {
  return Object.freeze({
    tenantId: row.tenant_id,
    characterId: row.character_id,
    state: row.state,
    activeCharacterVersionId: row.active_character_version_id,
    revision: revision(row.revision),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}
function version(row: VersionRow): CharacterVersion {
  return Object.freeze({
    tenantId: row.tenant_id,
    characterVersionId: row.character_version_id,
    characterId: row.character_id,
    versionNumber: revision(row.version_number),
    state: row.state,
    constitution: normalizeCharacterConstitution(row.constitution),
    createdAt: toInstant(row.created_at),
    ...(row.published_at ? { publishedAt: toInstant(row.published_at) } : {}),
    ...(row.retired_at ? { retiredAt: toInstant(row.retired_at) } : {}),
  });
}
function relationship(row: RelationshipRow): UserCharacterRelationship {
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
    revision: revision(row.revision),
    createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at),
  });
}
function link(row: LinkRow): ExternalUserIdentityLink {
  const subject: ExternalSubjectRef = Object.freeze({
    system: row.system,
    namespace: row.namespace,
    value: row.subject_value,
    subjectKind: "user",
    authenticationStrength: row.authentication_strength,
    observedAt: toInstant(row.observed_at),
    ...(row.account_id ? { accountId: row.account_id } : {}),
    ...(row.expires_at ? { expiresAt: toInstant(row.expires_at) } : {}),
    ...(Object.keys(row.provenance).length
      ? { provenance: Object.freeze({ ...row.provenance }) }
      : {}),
  });
  return Object.freeze({
    tenantId: row.tenant_id,
    userId: row.user_id,
    subject,
    linkedAt: toInstant(row.linked_at),
  });
}

export async function createTenant(
  client: PoolClient,
  input: CreateTenantInput,
): Promise<Tenant> {
  const result = await client.query<TenantRow>(
    `INSERT INTO identity.tenants
       (tenant_id, created_at, updated_at)
     VALUES ($1, $2, $2)
     RETURNING tenant_id, state, revision, created_at, updated_at`,
    [input.tenantId, input.createdAt],
  );
  return tenant(result.rows[0]!);
}

export async function createUser(
  client: PoolClient,
  input: CreateUserInput,
): Promise<User> {
  const result = await client.query<UserRow>(
    `INSERT INTO identity.users
       (tenant_id, user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $3)
     RETURNING tenant_id, user_id, state, revision, created_at, updated_at`,
    [input.tenantId, input.userId, input.createdAt],
  );
  return user(result.rows[0]!);
}

export async function linkExternalUserIdentity(
  client: PoolClient,
  input: LinkExternalUserIdentityInput,
): Promise<ExternalUserIdentityLink> {
  assertExternalUserSubjectLinkable(input.subject);
  const authStrength =
    input.subject.authenticationStrength === "strong" ? "strong" : "linked";
  const values: unknown[] = [
    input.tenantId,
    input.userId,
    input.subject.system.trim(),
    input.subject.namespace.trim(),
    input.subject.accountId ?? null,
    input.subject.value.trim(),
    authStrength,
    input.subject.observedAt,
    input.subject.expiresAt ?? null,
    JSON.stringify(input.subject.provenance ?? {}),
    input.linkedAt,
  ];
  const inserted = await client.query<LinkRow>(
    `INSERT INTO identity.external_user_identities
       (tenant_id, user_id, system, namespace, account_id, subject_value,
        authentication_strength, observed_at, expires_at, provenance, linked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    values,
  );
  if (inserted.rows[0]) return link(inserted.rows[0]);

  const existing = await client.query<LinkRow>(
    `SELECT *
       FROM identity.external_user_identities
      WHERE tenant_id = $1
        AND system = $2
        AND namespace = $3
        AND account_id IS NOT DISTINCT FROM $4
        AND subject_value = $5`,
    [
      input.tenantId,
      input.subject.system.trim(),
      input.subject.namespace.trim(),
      input.subject.accountId ?? null,
      input.subject.value.trim(),
    ],
  );
  const row = existing.rows[0];
  if (!row) {
    throw conflict("identity.external_subject_link_conflict", "External identity link conflicted");
  }
  if (row.user_id !== input.userId) {
    throw conflict(
      "identity.external_subject_already_linked",
      "External identity is already linked to another User",
    );
  }
  return link(row);
}

export async function resolveUserByExternalIdentity(
  client: PoolClient,
  tenantId: TenantId,
  subject: ExternalSubjectRef,
): Promise<UserId | null> {
  assertExternalUserSubjectLinkable(subject);
  const result = await client.query<{ user_id: UserId }>(
    `SELECT user_id
       FROM identity.external_user_identities
      WHERE tenant_id = $1
        AND system = $2
        AND namespace = $3
        AND account_id IS NOT DISTINCT FROM $4
        AND subject_value = $5
        AND (expires_at IS NULL OR expires_at > clock_timestamp())`,
    [
      tenantId,
      subject.system.trim(),
      subject.namespace.trim(),
      subject.accountId ?? null,
      subject.value.trim(),
    ],
  );
  return result.rows[0]?.user_id ?? null;
}

export async function createCharacter(
  client: PoolClient,
  input: CreateCharacterInput,
): Promise<Character> {
  const result = await client.query<CharacterRow>(
    `INSERT INTO identity.characters
       (tenant_id, character_id, created_at, updated_at)
     VALUES ($1, $2, $3, $3)
     RETURNING tenant_id, character_id, state, active_character_version_id,
               revision, created_at, updated_at`,
    [input.tenantId, input.characterId, input.createdAt],
  );
  return character(result.rows[0]!);
}

export async function createCharacterVersion(
  client: PoolClient,
  input: CreateCharacterVersionInput,
): Promise<CharacterVersion> {
  if (!Number.isSafeInteger(input.versionNumber) || input.versionNumber < 1) {
    throw new RangeError("versionNumber must be a positive safe integer");
  }
  const constitution = normalizeCharacterConstitution(input.constitution);
  const result = await client.query<VersionRow>(
    `INSERT INTO identity.character_versions
       (tenant_id, character_version_id, character_id, version_number,
        constitution, created_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6)
     RETURNING *`,
    [
      input.tenantId,
      input.characterVersionId,
      input.characterId,
      input.versionNumber,
      JSON.stringify(constitution),
      input.createdAt,
    ],
  );
  return version(result.rows[0]!);
}

export async function publishCharacterVersion(
  client: PoolClient,
  input: PublishCharacterVersionInput,
): Promise<CharacterVersion> {
  const result = await client.query<VersionRow>(
    `UPDATE identity.character_versions
        SET state = 'published', published_at = $3
      WHERE tenant_id = $1
        AND character_version_id = $2
        AND state = 'draft'
      RETURNING *`,
    [input.tenantId, input.characterVersionId, input.publishedAt],
  );
  if (!result.rows[0]) {
    throw conflict(
      "identity.character_version_publish_conflict",
      "Character version is absent or is no longer a draft",
    );
  }
  return version(result.rows[0]);
}

export async function loadCharacter(
  client: PoolClient,
  tenantId: TenantId,
  characterId: CharacterId,
  forUpdate = false,
): Promise<Character> {
  const result = await client.query<CharacterRow>(
    `SELECT tenant_id, character_id, state, active_character_version_id,
            revision, created_at, updated_at
       FROM identity.characters
      WHERE tenant_id = $1 AND character_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId, characterId],
  );
  if (!result.rows[0]) {
    throw missing("identity.character_not_found", "Character was not found");
  }
  return character(result.rows[0]);
}

export async function loadCharacterVersion(
  client: PoolClient,
  tenantId: TenantId,
  characterVersionId: CharacterVersionId,
): Promise<CharacterVersion> {
  const result = await client.query<VersionRow>(
    `SELECT *
       FROM identity.character_versions
      WHERE tenant_id = $1 AND character_version_id = $2`,
    [tenantId, characterVersionId],
  );
  if (!result.rows[0]) {
    throw missing("identity.character_version_not_found", "Character version was not found");
  }
  return version(result.rows[0]);
}

export async function activateCharacterVersion(
  client: PoolClient,
  input: ActivateCharacterVersionInput,
): Promise<Character> {
  const current = await loadCharacter(client, input.tenantId, input.characterId, true);
  if (current.revision !== input.expectedCharacterRevision) {
    throw conflict("identity.character_revision_conflict", "Character revision is stale");
  }
  const selected = await loadCharacterVersion(
    client,
    input.tenantId,
    input.characterVersionId,
  );
  if (selected.characterId !== input.characterId || selected.state !== "published") {
    throw conflict(
      "identity.character_version_not_activatable",
      "Only a published version of this Character may become active",
    );
  }
  const result = await client.query<CharacterRow>(
    `UPDATE identity.characters
        SET active_character_version_id = $3,
            revision = revision + 1,
            updated_at = $4
      WHERE tenant_id = $1
        AND character_id = $2
        AND revision = $5
      RETURNING tenant_id, character_id, state, active_character_version_id,
                revision, created_at, updated_at`,
    [
      input.tenantId,
      input.characterId,
      input.characterVersionId,
      input.activatedAt,
      input.expectedCharacterRevision,
    ],
  );
  if (!result.rows[0]) {
    throw conflict("identity.character_revision_conflict", "Character revision is stale");
  }
  return character(result.rows[0]);
}

export async function getOrCreateRelationship(
  client: PoolClient,
  input: GetOrCreateRelationshipInput,
): Promise<UserCharacterRelationship> {
  const inserted = await client.query<RelationshipRow>(
    `INSERT INTO identity.relationships
       (tenant_id, relationship_id, user_id, character_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$5)
     ON CONFLICT (tenant_id, user_id, character_id) DO NOTHING
     RETURNING *`,
    [
      input.tenantId,
      input.relationshipId,
      input.userId,
      input.characterId,
      input.createdAt,
    ],
  );
  if (inserted.rows[0]) return relationship(inserted.rows[0]);

  const existing = await client.query<RelationshipRow>(
    `SELECT *
       FROM identity.relationships
      WHERE tenant_id = $1 AND user_id = $2 AND character_id = $3`,
    [input.tenantId, input.userId, input.characterId],
  );
  if (!existing.rows[0]) {
    throw conflict("identity.relationship_create_conflict", "Relationship could not be created");
  }
  return relationship(existing.rows[0]);
}

export function createPostgresIdentityRepository(
  client: PoolClient,
): IdentityRepository {
  const repository: IdentityRepository = {
    createTenant: (input: CreateTenantInput) => createTenant(client, input),
    createUser: (input: CreateUserInput) => createUser(client, input),
    linkExternalUserIdentity: (input: LinkExternalUserIdentityInput) =>
      linkExternalUserIdentity(client, input),
    resolveUserByExternalIdentity: (
      tenantId: TenantId,
      subject: ExternalSubjectRef,
    ) => resolveUserByExternalIdentity(client, tenantId, subject),
    createCharacter: (input: CreateCharacterInput) =>
      createCharacter(client, input),
    createCharacterVersion: (input: CreateCharacterVersionInput) =>
      createCharacterVersion(client, input),
    publishCharacterVersion: (input: PublishCharacterVersionInput) =>
      publishCharacterVersion(client, input),
    activateCharacterVersion: (input: ActivateCharacterVersionInput) =>
      activateCharacterVersion(client, input),
    getOrCreateRelationship: (input: GetOrCreateRelationshipInput) =>
      getOrCreateRelationship(client, input),
  };
  return Object.freeze(repository);
}
