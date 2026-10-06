import type {
  CharacterId,
  ExternalReference,
  ExternalSubjectRef,
  Instant,
  SocialContentId,
  TenantId,
  UserId,
} from "@masanawa/contracts";

export type SocialAccountBindingState = "active" | "revoked";
export type SocialContentState = "draft" | "ready" | "archived";
export type SocialAudienceIntent = "public" | "followers" | "private";

export interface SocialAccountBinding {
  readonly tenantId: TenantId;
  readonly characterId: CharacterId;
  readonly accountKey: string;
  readonly account: ExternalSubjectRef;
  readonly linkedByUserId: UserId;
  readonly state: SocialAccountBindingState;
  readonly revision: number;
  readonly linkedAt: Instant;
  readonly updatedAt: Instant;
  readonly revokedAt: Instant | null;
}

export interface SocialContent {
  readonly tenantId: TenantId;
  readonly socialContentId: SocialContentId;
  readonly characterId: CharacterId;
  readonly accountKey: string;
  readonly state: SocialContentState;
  readonly text: string | null;
  readonly media: readonly ExternalReference[];
  readonly audience: SocialAudienceIntent;
  readonly revision: number;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly archivedAt: Instant | null;
}
