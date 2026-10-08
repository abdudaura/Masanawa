export interface TalkCardProjection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly hostName: string;
  readonly topic: string | null;
  readonly heroImageUrl: string | null;
  readonly hostAvatarUrl: string | null;
  readonly isLive: boolean;
  readonly listenerCount: number;
  readonly commentCount: number;
  readonly durationSeconds: number | null;
  readonly participants: readonly Readonly<{
    id: string;
    name: string;
    kind: "human" | "expert" | "twin";
    avatarUrl: string | null;
    isHost: boolean;
  }>[];
}

export interface HumanProfileRecord {
  readonly tenantId: string;
  readonly userId: string;
  readonly handle: string;
  readonly displayName: string;
  readonly bio: string;
  readonly avatarUrl: string | null;
  readonly liveTalkId: string | null;
  readonly twinPublicId: string | null;
  readonly twinDisplayName: string | null;
  readonly talks: readonly TalkCardProjection[];
}

export interface PersonaProfileRecord {
  readonly tenantId: string;
  readonly publicId: string;
  readonly displayName: string;
  readonly kind: "expert" | "twin";
  readonly seatFeeLabel: string;
  readonly isAvailable: boolean;
  readonly role: string;
  readonly bio: string;
  readonly avatarUrl: string | null;
  readonly ownerHandle: string | null;
  readonly ownerDisplayName: string | null;
  readonly topics: readonly string[];
  readonly appearances: readonly TalkCardProjection[];
  readonly isVerified: boolean;
}

export interface HumanProfileView extends Omit<HumanProfileRecord, "tenantId" | "userId"> {
  readonly followerCount: number;
  readonly followingCount: number;
  readonly isFollowing: boolean;
  readonly isLive: boolean;
}

export interface PersonaProfileView extends Omit<PersonaProfileRecord, "tenantId"> {}

export interface SelfProfileUpdate {
  readonly tenantId: string;
  readonly userId: string;
  readonly handle: string;
  readonly displayName: string;
  readonly bio: string;
}

export interface TalkProfileRepository {
  // Saved with the authorized session's tenant/user identity, never a
  // caller-supplied user ID. Existing avatar and Talk metadata are preserved.
  saveSelf(input: Readonly<SelfProfileUpdate>): Promise<HumanProfileView>;
  readHuman(input: Readonly<{
    tenantId: string;
    viewerUserId: string;
    handle: string;
  }>): Promise<HumanProfileView | null>;
  readHumanByUserId(input: Readonly<{
    tenantId: string;
    viewerUserId: string;
    userId: string;
  }>): Promise<HumanProfileView | null>;
  setFollowing(input: Readonly<{
    tenantId: string;
    viewerUserId: string;
    handle: string;
    following: boolean;
    changedAt: string;
  }>): Promise<HumanProfileView | null>;
  setFollowingByUserId(input: Readonly<{
    tenantId: string;
    viewerUserId: string;
    userId: string;
    following: boolean;
    changedAt: string;
  }>): Promise<HumanProfileView | null>;
  readPersona(input: Readonly<{
    tenantId: string;
    viewerUserId: string;
    publicId: string;
  }>): Promise<PersonaProfileView | null>;
  upsertHuman(input: HumanProfileRecord): Promise<void>;
  upsertPersona(input: PersonaProfileRecord): Promise<void>;
}
