import type {
  CharacterId,
  CharacterVersionId,
  ExternalReference,
  ExternalSubjectRef,
  Instant,
  RelationshipId,
  TenantId,
  UserId,
} from "@masanawa/contracts";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };

export type IdentityLifecycleState = "active" | "disabled" | "archived";
export type CharacterVersionState = "draft" | "published" | "retired";
export type RelationshipState = "active" | "archived";

export interface Tenant {
  readonly tenantId: TenantId;
  readonly state: IdentityLifecycleState;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface User {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly state: IdentityLifecycleState;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface ExternalUserIdentityLink {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly subject: ExternalSubjectRef;
  readonly linkedAt: Instant;
}

export interface CharacterAssetReference extends ExternalReference {
  readonly mediaType?: string;
}

export interface CharacterConstitution {
  readonly schemaVersion: 1;
  readonly displayName: string;
  readonly biography: string;
  readonly personality: readonly string[];
  readonly boundaries: readonly string[];
  readonly disclosurePolicy: JsonObject;
  readonly languages: readonly string[];
  readonly voiceReferences: readonly CharacterAssetReference[];
  readonly appearanceReferences: readonly CharacterAssetReference[];
  readonly expertise: readonly string[];
}

export interface Character {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly state: IdentityLifecycleState;
  readonly activeCharacterVersionId: CharacterVersionId | null;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface CharacterVersion {
  readonly tenantId: TenantId;
  readonly characterVersionId: CharacterVersionId;
  readonly characterId: CharacterId;
  readonly versionNumber: number;
  readonly state: CharacterVersionState;
  readonly constitution: CharacterConstitution;
  readonly createdAt: Instant;
  readonly publishedAt?: Instant;
  readonly retiredAt?: Instant;
}

export interface UserCharacterRelationship {
  readonly tenantId: TenantId;
  readonly relationshipId: RelationshipId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly state: RelationshipState;
  readonly stage: string | null;
  readonly tone: string | null;
  readonly preferences: JsonObject;
  readonly disclosures: JsonObject;
  readonly permissions: JsonObject;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}


export const characterOwnershipKinds = [
  "platform",
  "personal-clone",
  "business",
] as const;

export type CharacterOwnershipKind =
  (typeof characterOwnershipKinds)[number];

export interface CharacterOwnership {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly kind: CharacterOwnershipKind;
  readonly ownerUserId: UserId | null;
  readonly createdAt: Instant;
}
