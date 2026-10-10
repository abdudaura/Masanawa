/** Audio posts are not legacy live Talk sessions. All IDs are typed by route. */
export type AudioPostStatus = "processing" | "published" | "failed" | "removed";
export type AudioAuthorKind = "human" | "masana";

export interface PostActor {
  tenantId: string;
  accountId: string;
  authorKind: AudioAuthorKind;
  /** Resolved by the authenticated server, never from a client body. */
  authorId: string;
}

export interface VerifiedAudioAsset {
  assetId: string;
  ownerAccountId: string;
  durationMs: number;
  bytes: number;
  mime: string;
  /** Media authority must confirm a durable, non-public object. */
  state: "ready";
}

export interface AudioPostRecord {
  tenantId: string;
  postId: string;
  authorId: string;
  authorAccountId: string;
  authorKind: AudioAuthorKind;
  assetId: string;
  requestId: string;
  title: string;
  durationMs: number;
  status: AudioPostStatus;
  revision: number;
  createdAt: string;
  publishedAt: string | null;
}

export interface NewAudioPost {
  actor: PostActor;
  postId: string;
  requestId: string;
  title: string;
  asset: VerifiedAudioAsset;
  createdAt: string;
}

export interface PublicFeedPage {
  items: AudioPostRecord[];
  nextCursor: string | null;
}

export interface AudioPostRepository {
  /** Unique constraint on tenant + account + requestId; conflicting payload rejected. */
  createOnce(intent: NewAudioPost): Promise<AudioPostRecord>;
  byRequest(tenantId: string, accountId: string, requestId: string): Promise<AudioPostRecord | null>;
  byId(tenantId: string, postId: string): Promise<AudioPostRecord | null>;
  /** Only published, unblocked, unremoved posts visible to viewer. */
  publicFeed(input: { tenantId: string; viewerId: string | null; cursor: string | null; limit: number }): Promise<PublicFeedPage>;
  mine(input: { tenantId: string; accountId: string; limit: number }): Promise<AudioPostRecord[]>;
  /** Hide an owned post from public feeds atomically; repeated owner deletion is safe. */
  removeOwn(input: { tenantId: string; accountId: string; postId: string }): Promise<AudioPostRecord | null>;
  /** Worker/verified moderation only; atomic expected revision and status. */
  settle(input: { tenantId: string; postId: string; expectedRevision: number; status: "published" | "failed" }): Promise<AudioPostRecord>;
  /** Ensure visibility/account authorization in same transaction as reaction write. */
  setReaction(input: { tenantId: string; viewerId: string; postId: string; kind: "like" | "save"; enabled: boolean }): Promise<{ enabled: boolean }>;
}

export interface AudioAssetAuthority {
  verifyOwnedReady(input: { tenantId: string; accountId: string; assetId: string }): Promise<VerifiedAudioAsset>;
}
export interface AudioPostModeration {
  /** Completed by trusted operator/worker; no model/client can self-approve. */
  approve(input: { tenantId: string; postId: string; assetId: string; authorId: string }): Promise<boolean>;
}
