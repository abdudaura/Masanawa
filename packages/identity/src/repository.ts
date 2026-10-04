import type {
  CharacterId,
  CharacterVersionId,
  ExternalSubjectRef,
  Instant,
  RelationshipId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import type {
  Character,
  CharacterConstitution,
  CharacterVersion,
  ExternalUserIdentityLink,
  Tenant,
  User,
  UserCharacterRelationship,
  CharacterOwnership,
  CharacterOwnershipKind,
} from "./model.js";

export interface CreateTenantInput {
  readonly tenantId: TenantId;
  readonly createdAt: Instant;
}
export interface CreateUserInput {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly createdAt: Instant;
}
export interface LinkExternalUserIdentityInput {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly subject: ExternalSubjectRef;
  readonly linkedAt: Instant;
}
export interface CreateCharacterInput {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly createdAt: Instant;
}
export interface CreateCharacterVersionInput {
  readonly tenantId: TenantId;
  readonly characterVersionId: CharacterVersionId;
  readonly characterId: CharacterId;
  readonly versionNumber: number;
  readonly constitution: CharacterConstitution;
  readonly createdAt: Instant;
}
export interface PublishCharacterVersionInput {
  readonly tenantId: TenantId;
  readonly characterVersionId: CharacterVersionId;
  readonly publishedAt: Instant;
}
export interface ActivateCharacterVersionInput {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly characterVersionId: CharacterVersionId;
  readonly expectedCharacterRevision: number;
  readonly activatedAt: Instant;
}
export interface AssignCharacterOwnershipInput {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly kind: CharacterOwnershipKind;
  readonly ownerUserId: UserId | null;
  readonly createdAt: Instant;
}

export interface GetOrCreateRelationshipInput {
  readonly tenantId: TenantId;
  readonly relationshipId: RelationshipId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly createdAt: Instant;
}

export interface IdentityRepository {
  createTenant(input: CreateTenantInput): Promise<Tenant>;
  createUser(input: CreateUserInput): Promise<User>;
  linkExternalUserIdentity(
    input: LinkExternalUserIdentityInput,
  ): Promise<ExternalUserIdentityLink>;
  resolveUserByExternalIdentity(
    tenantId: TenantId,
    subject: ExternalSubjectRef,
  ): Promise<UserId | null>;
  createCharacter(input: CreateCharacterInput): Promise<Character>;
  createCharacterVersion(
    input: CreateCharacterVersionInput,
  ): Promise<CharacterVersion>;
  publishCharacterVersion(
    input: PublishCharacterVersionInput,
  ): Promise<CharacterVersion>;
  activateCharacterVersion(
    input: ActivateCharacterVersionInput,
  ): Promise<Character>;
  getOrCreateRelationship(
    input: GetOrCreateRelationshipInput,
  ): Promise<UserCharacterRelationship>;
  assignCharacterOwnership(
    input: AssignCharacterOwnershipInput,
  ): Promise<CharacterOwnership>;
  readCharacterOwnership(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
  }): Promise<CharacterOwnership | null>;
  readPersonalCloneForUser(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
  }): Promise<CharacterOwnership | null>;
}


/** Narrow cross-domain reference check. Existence never grants authority. */
export interface CharacterVersionReferenceReader {
  assertCharacterVersion(input: {
    readonly tenantId: TenantId;
    readonly characterId: CharacterId;
    readonly characterVersionId: CharacterVersionId;
  }): Promise<void>;
}


/** Narrow runtime read port. Relationship existence does not grant execution authority. */
export interface UserRelationshipReader {
  readForUserCharacter(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly characterId: CharacterId;
  }): Promise<UserCharacterRelationship | null>;
  listForUser(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
  }): Promise<readonly UserCharacterRelationship[]>;
}
