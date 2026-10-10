import type { AudioPostRecord, PostActor, VerifiedAudioAsset } from "@masanawa/contracts";
export type { AudioPostStatus, AudioAuthorKind, AudioPostRecord, PublicFeedPage, PostActor, VerifiedAudioAsset, NewAudioPost, AudioPostComment, AudioPostRepository } from "@masanawa/contracts";

/** Explicit wire shape: do not expose author account, tenant, asset or request keys. */
export type PublicAudioPost = Pick<AudioPostRecord,
  "postId" | "authorId" | "authorKind" | "title" | "durationMs" |
  "status" | "revision" | "createdAt" | "publishedAt"
> & { likeCount: number; commentCount: number; listenCount: number };

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
    listenCount: post.listenCount ?? 0,
  };
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

export interface AudioAssetAuthority {
  verifyOwnedReady(input: { tenantId: string; accountId: string; assetId: string }): Promise<VerifiedAudioAsset>;
}
export interface AudioPostModeration {
  /** Completed by trusted operator/worker; no model/client can self-approve. */
  approve(input: { tenantId: string; postId: string; assetId: string; authorId: string }): Promise<boolean>;
}
