export type TalkFeedKind = "explore" | "live";
export type TalkLifecycleState = "draft" | "live" | "reconnecting" | "ended";
export type TalkParticipantKind = "human" | "expert" | "twin";

export interface TalkParticipantPreview {
  readonly id: string;
  readonly name: string;
  readonly kind: TalkParticipantKind;
  readonly avatarUrl: string | null;
  readonly isHost: boolean;
}

export interface TalkDiscoveryItem {
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
  readonly viewerIsHost?: boolean;
  readonly participants: readonly TalkParticipantPreview[];
}

export interface TalkCommentView {
  readonly id: string;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;
  readonly authorAvatarUrl: string | null;
  readonly likeCount: number;
}

export interface TalkDetailView {
  readonly talk: TalkDiscoveryItem;
  readonly comments: readonly TalkCommentView[];
}

export interface TalkRecord {
  readonly tenantId: string;
  readonly talkId: string;
  readonly hostUserId: string;
  readonly hostName: string;
  readonly title: string;
  readonly topic: string;
  readonly summary: string;
  readonly state: TalkLifecycleState;
  readonly listenerCount: number;
  readonly durationSeconds: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TalkListRow {
  readonly talk: TalkRecord;
  readonly commentCount: number;
  readonly reactionCount: number;
  readonly followedHost: boolean;
  readonly participants?: readonly TalkParticipantPreview[];
}

export interface TalkCommentRecord {
  readonly tenantId: string;
  readonly talkId: string;
  readonly commentId: string;
  readonly authorUserId: string;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface TalkRepository {
  createTalk(input: Readonly<{
    tenantId: string;
    talkId: string;
    hostUserId: string;
    hostName: string;
    title: string;
    topic: string;
    createdAt: string;
  }>): Promise<TalkRecord>;
  listTalks(input: Readonly<{
    tenantId: string;
    viewerUserId: string;
    feed: TalkFeedKind;
    limit: number;
  }>): Promise<readonly TalkListRow[]>;
  getTalk(input: Readonly<{
    tenantId: string;
    talkId: string;
    viewerUserId: string;
  }>): Promise<Readonly<{
    talk: TalkRecord;
    commentCount: number;
    // Preserve the already-persisted projection returned by the PostgreSQL adapter.
    // This is legacy readback only; R0 disables new Talk stages and publishing.
    participants?: readonly TalkParticipantPreview[];
  }> | null>;
  updateMetadata(input: Readonly<{
    tenantId: string;
    talkId: string;
    hostUserId: string;
    title?: string;
    topic?: string;
    summary?: string;
    updatedAt: string;
  }>): Promise<TalkRecord | null>;
  listComments(input: Readonly<{
    tenantId: string;
    talkId: string;
    limit: number;
  }>): Promise<readonly TalkCommentRecord[]>;
  addComment(input: Readonly<{
    tenantId: string;
    talkId: string;
    commentId: string;
    authorUserId: string;
    authorName: string;
    body: string;
    createdAt: string;
  }>): Promise<TalkCommentRecord | null>;
}

export function toTalkDiscoveryItem(
  row: Readonly<{ talk: TalkRecord; commentCount: number; participants?: readonly TalkParticipantPreview[] }>,
): TalkDiscoveryItem {
  const talk = row.talk;
  return Object.freeze({
    id: talk.talkId,
    title: talk.title,
    summary: talk.summary,
    hostName: talk.hostName,
    topic: talk.topic,
    heroImageUrl: null,
    hostAvatarUrl: null,
    isLive: talk.state === "live",
    listenerCount: talk.listenerCount,
    commentCount: row.commentCount,
    durationSeconds: talk.durationSeconds,
    participants: Object.freeze([
      Object.freeze({
        id: talk.hostUserId,
        name: talk.hostName,
        kind: "human" as const,
        avatarUrl: null,
        isHost: true,
      }),
      ...(row.participants ?? []).filter((participant) =>
        !(participant.kind === "human" && participant.id === talk.hostUserId)
      ),
    ]),
  });
}

export function toTalkCommentView(comment: TalkCommentRecord): TalkCommentView {
  return Object.freeze({
    id: comment.commentId,
    authorName: comment.authorName,
    body: comment.body,
    createdAt: comment.createdAt,
    authorAvatarUrl: null,
    likeCount: 0,
  });
}
