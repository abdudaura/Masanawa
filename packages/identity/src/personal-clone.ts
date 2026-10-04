import type {
  CharacterId,
  CharacterVersionId,
  Instant,
  RelationshipId,
  TenantId,
  UserId,
} from "@masanawa/contracts";
import type {
  Character,
  CharacterConstitution,
  CharacterOwnership,
  CharacterVersion,
  UserCharacterRelationship,
} from "./model.js";

export interface ProvisionPersonalCloneInput {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly characterVersionId: CharacterVersionId;
  readonly relationshipId: RelationshipId;
  readonly constitution: CharacterConstitution;
  readonly createdAt: Instant;
}

export interface PersonalCloneProvision {
  readonly character: Character;
  readonly version: CharacterVersion;
  readonly ownership: CharacterOwnership;
  readonly relationship: UserCharacterRelationship;
  readonly created: boolean;
}

export interface PersonalCloneProvisioningRepository {
  getOrCreatePersonalClone(
    input: ProvisionPersonalCloneInput,
  ): Promise<PersonalCloneProvision>;
}
