import { PlatformError, type CharacterId, type CharacterVersionId, type RelationshipId, type TenantId, type UserId } from "@masanawa/contracts";
import type { CharacterVersionState, IdentityLifecycleState, RelationshipState } from "./model.js";

/** Minimal owning-port projection; contains no constitution or private relationship content. */
export interface InteractionIdentityKey {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
  readonly characterVersionId: CharacterVersionId;
}
export interface InteractionIdentity extends InteractionIdentityKey {
  readonly tenantState: IdentityLifecycleState;
  readonly userState: IdentityLifecycleState;
  readonly characterState: IdentityLifecycleState;
  readonly relationshipState: RelationshipState;
  readonly versionState: CharacterVersionState;
  readonly activeCharacterVersionId: CharacterVersionId | null;
}
/** Implementations hold lifecycle rows stable until the enclosing transaction ends. */
export interface InteractionIdentityReader {
  readInteraction(key: InteractionIdentityKey): Promise<InteractionIdentity | null>;
}

export function assertInteractionIdentity(
  key: InteractionIdentityKey,
  identity: InteractionIdentity | null,
  options: { readonly requireActiveVersion: boolean; readonly requirePublishedVersion: boolean },
): void {
  if (!identity || identity.tenantId !== key.tenantId || identity.userId !== key.userId ||
      identity.characterId !== key.characterId || identity.relationshipId !== key.relationshipId ||
      identity.characterVersionId !== key.characterVersionId || identity.tenantState !== "active" ||
      identity.userState !== "active" || identity.characterState !== "active" ||
      identity.relationshipState !== "active" ||
      (options.requirePublishedVersion && identity.versionState !== "published") ||
      (options.requireActiveVersion && identity.activeCharacterVersionId !== key.characterVersionId)) {
    throw new PlatformError({ code: "identity.interaction_unavailable", category: "authorization",
      message: "Identity does not admit this interaction", retryable: false });
  }
}
