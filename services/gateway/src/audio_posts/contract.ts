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
  /** Derived from persisted reactions and non-removed comments, never the client. */
  likeCount?: number;
  commentCount?: number;
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

/** Explicit wire shape: do not expose author account, tenant, asset or request keys. */
export type PublicAudioPost = Pick<AudioPostRecord,
  "postId" | "authorId" | "authorKind" | "title" | "durationMs" |
  "status" | "revision" | "createdAt" | "publishedAt"
> & { likeCount: number; commentCount: number };

export interface PublicAudioFeedPage {
  items: PublicAudioPost[];
  nextCursor: string | null;
}

/** Shared projection for Discover, Saved, My Talks and AF09 Following routes. */
export function toPublicAudioPost(post: AudioPostRecord): PublicAudioPost {
  return {
    postId: post.postId, authorId: post.authorId, authorKind: post.authorKind,
    title: post.title, durationMs: post.durationMs, status: post.status,
    revision: post.revision, createdAt: post.createdAt, publishedAt: post.publishedAt,
    likeCount: post.likeCount ?? 0, commentCount: post.commentCount ?? 0,
  };
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

/** Public comments never reveal another account's internal identity key. */
/** Bounded, keyset-paginated public comment listing. Cursor is only a scoped comment ID. */
export interface PublicAudioPostCommentPage {
  items: PublicAudioPostComment[];
  nextCursor: string | null;
}

export interface PublicAudioPostComment {
  postId: string;
  commentId: string;
  body: string;
  createdAt: string;
  removed: boolean;
  isMine: boolean;
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
  /** Only the viewer's persisted saves, filtered through public visibility. */
  saved(input: { tenantId: string; viewerId: string; limit: number }): Promise<AudioPostRecord[]>;
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

export interface AudioAssetAuthority {
  verifyOwnedReady(input: { tenantId: string; accountId: string; assetId: string }): Promise<VerifiedAudioAsset>;
}
export interface AudioPostModeration {
  /** Completed by trusted operator/worker; no model/client can self-approve. */
  approve(input: { tenantId: string; postId: string; assetId: string; authorId: string }): Promise<boolean>;
}
