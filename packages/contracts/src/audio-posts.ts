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
