/** Canonical Published Audio/Following types shared by Gateway and storage.
 * No adapter imports a hosting service. Execution authorization remains server-only.
 */

export type AudioPostStatus = "processing" | "published" | "failed" | "removed";
export type AudioAuthorKind = "human" | "masana";

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
  /** Derived from persisted reactions and non-removed comments, never the client. */
  likeCount?: number;
  commentCount?: number;
  /** One authorized, qualified listen per viewer/post/day; not card impressions. */
  listenCount?: number;
}

export interface PublicFeedPage {
  items: AudioPostRecord[];
  nextCursor: string | null;
}

export interface FollowingRepository {
  /** Resolve a published Talk and canonical block/privacy policy BEFORE writing. */
  setFromVisiblePost(input: {
    tenantId: string;
    accountId: string;
    postId: string;
    enabled: boolean;
  }): Promise<{ authorId: string; authorKind: "human" | "masana"; following: boolean } | null>;
  statusFromVisiblePost(input: {
    tenantId: string; accountId: string; postId: string;
  }): Promise<{ authorId: string; authorKind: "human" | "masana"; following: boolean } | null>;
  /** A creator profile resolves against canonical author IDs and shared visibility. */
  creatorFeed(input: {
    tenantId: string; viewerId: string; authorId: string;
    authorKind: "human" | "masana"; limit: number; cursor: string | null;
  }): Promise<PublicFeedPage>;
  /** Read only published Talks by followed creators, with visibility checked per viewer. */
  feed(input: {
    tenantId: string;
    viewerId: string;
    limit: number;
    cursor: string | null;
  }): Promise<PublicFeedPage>;
}

/** Canonical persistence contract for verified listening, shared without adapter-to-Gateway imports. */
export interface TalkListenStore {
  open(input: { tenantId: string; postId: string; viewerId: string; revision: number; durationMs: number }): Promise<string>;
  complete(input: { tenantId: string; postId: string; viewerId: string; listenId: string; playedMs: number;
    canView: (authorAccountId: string) => Promise<boolean> }): Promise<{ counted: boolean; listenCount: number }>;
}

/** Shared persistent published-audio intent and repository types; authorization remains Gateway-owned. */
/** Audio posts are not legacy live Talk sessions. All IDs are typed by route. */
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

export interface NewAudioPost {
  actor: PostActor;
  postId: string;
  requestId: string;
  title: string;
  asset: VerifiedAudioAsset;
  createdAt: string;
}

/** Durable comments: author IDs are server-derived, never supplied in a body. */
export interface AudioPostComment {
  tenantId: string;
  postId: string;
  commentId: string;
  authorAccountId: string;
  requestId: string;
  body: string;
  createdAt: string;
  removed: boolean;
}

export interface AudioPostRepository {
  /** Unique constraint on tenant + account + requestId; conflicting payload rejected. */
  createOnce(intent: NewAudioPost): Promise<AudioPostRecord>;
  byRequest(tenantId: string, accountId: string, requestId: string): Promise<AudioPostRecord | null>;
  byId(tenantId: string, postId: string): Promise<AudioPostRecord | null>;
  /** Only published, unblocked, unremoved posts visible to viewer. */
  publicFeed(input: { tenantId: string; viewerId: string | null; cursor: string | null; limit: number }): Promise<PublicFeedPage>;
  mine(input: { tenantId: string; accountId: string; limit: number }): Promise<AudioPostRecord[]>;
  /** Additive cursor pages; legacy list reads remain available for existing clients. */
  minePage?(input: { tenantId: string; accountId: string; cursor: string | null; limit: number }): Promise<PublicFeedPage>;
  /** Hide an owned post from public feeds atomically; repeated owner deletion is safe. */
  removeOwn(input: { tenantId: string; accountId: string; postId: string }): Promise<AudioPostRecord | null>;
  /** Only the viewer's persisted saves, filtered through public visibility. */
  saved(input: { tenantId: string; viewerId: string; limit: number }): Promise<AudioPostRecord[]>;
  savedPage?(input: { tenantId: string; viewerId: string; cursor: string | null; limit: number }): Promise<PublicFeedPage>;
  /** Only comments on visible published posts; removal tombstones are hidden. */
  listComments(input: { tenantId: string; viewerId: string; postId: string; limit: number; beforeCommentId?: string | null }): Promise<AudioPostComment[]>;
  /** Atomic published-post + visibility check, replay-safe request key. */
  addComment(input: { tenantId: string; viewerId: string; postId: string; commentId: string; requestId: string; body: string; createdAt: string }): Promise<AudioPostComment>;
  /** Only authenticated comment author may remove; repeated removal is idempotent. */
  removeOwnComment(input: { tenantId: string; viewerId: string; postId: string; commentId: string }): Promise<boolean>;
  /** Worker/verified moderation only; atomic expected revision and status. */
  settle(input: { tenantId: string; postId: string; expectedRevision: number; status: "published" | "failed" }): Promise<AudioPostRecord>;
  /** Ensure visibility/account authorization in same transaction as reaction write. */
  setReaction(input: { tenantId: string; viewerId: string; postId: string; kind: "like" | "save"; enabled: boolean }): Promise<{ enabled: boolean }>;
}

export interface PendingAudioPost {
  tenantId: string;
  postId: string;
  revision: number;
  createdAt: string;
}
export interface PendingPage {
  items: PendingAudioPost[];
  nextCursor: string | null;
}
export interface AudioPostProcessingQueue {
  listPending(input: { tenantId: string; cursor: string | null; limit: number }): Promise<PendingPage>;
  /** Non-blocking cross-process lock; returns null if another worker owns post. */
  withLease<T>(input: { tenantId: string; postId: string }, work: () => Promise<T>): Promise<T | null>;
}
