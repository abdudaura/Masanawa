import type {
  AudioPostModeration, AudioAssetAuthority, AudioPostRecord, AudioPostRepository,
  AudioPostComment, PublicAudioPostComment,
  PostActor, PublicAudioFeedPage, PublicAudioPostCommentPage, VerifiedAudioAsset,
} from "./contract.js";
import { toPublicAudioPost } from "./contract.js";

export class AudioPostError extends Error {
  constructor(public readonly code:
    "VALIDATION" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "CAPABILITY_UNAVAILABLE",
    message: string) { super(message); this.name = "AudioPostError"; }
}

const safeId = (value: unknown, label: string, max = 128): string => {
  if (typeof value !== "string" || value.length < 1 || value.length > max ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(value)) {
    throw new AudioPostError("VALIDATION", "Invalid " + label);
  }
  return value;
};

const safeTitle = (value: unknown): string => {
  if (typeof value !== "string") throw new AudioPostError("VALIDATION", "Title required");
  const v = value.trim();
  // Reject spoofed direction and control characters, not natural scripts.
  if (v.length < 1 || v.length > 100 || /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u.test(v)) {
    throw new AudioPostError("VALIDATION", "Invalid post title");
  }
  return v;
};

const assertActor = (a: PostActor): void => {
  safeId(a.tenantId, "tenant");
  safeId(a.accountId, "account");
  safeId(a.authorId, "author");
  if (a.authorKind !== "human" && a.authorKind !== "masana") {
    throw new AudioPostError("FORBIDDEN", "Unsupported author");
  }
};

const assertAudio = (asset: VerifiedAudioAsset, accountId: string, wantedId: string): void => {
  // The media lifecycle owns upload, content scanning and read permission.
  if (asset.state !== "ready" || asset.ownerAccountId !== accountId ||
      asset.assetId !== wantedId || !Number.isSafeInteger(asset.durationMs) ||
      asset.durationMs < 1000 || asset.durationMs > 180000 ||
      !Number.isSafeInteger(asset.bytes) || asset.bytes < 256 ||
      asset.bytes > 12 * 1024 * 1024 ||
      !["audio/mp4", "audio/aac", "audio/ogg", "audio/webm", "audio/mpeg"].includes(asset.mime)) {
    throw new AudioPostError("VALIDATION", "Audio must be an owned, verified recording of up to three minutes");
  }
};

export function createAudioPostService(deps: {
  repository: AudioPostRepository;
  assets: AudioAssetAuthority;
  moderation: AudioPostModeration;
  newId: () => string;
  now: () => string;
}) {
  const { repository, assets, moderation, newId, now } = deps;
  // Normalize only canonical repository denial/cursor failures. In particular,
  // hidden/removed posts must not become HTTP 500 or reveal their existence.
  // Unexpected PostgreSQL/provider errors stay visible to the server error path.
  const mapRepositoryError = (error: unknown): never => {
    if (error instanceof Error && error.message === "audio_posts.not_visible") {
      throw new AudioPostError("NOT_FOUND", "Audio post not found");
    }
    if (error instanceof Error && error.message === "audio_posts.invalid_cursor") {
      throw new AudioPostError("VALIDATION", "Invalid feed cursor");
    }
    if (error instanceof Error && error.message === "audio_posts.invalid_comment_cursor") {
      throw new AudioPostError("VALIDATION", "Invalid comment cursor");
    }
    if (error instanceof Error && error.message === "audio_posts.comment_conflict") {
      throw new AudioPostError("CONFLICT", "Comment request key already used");
    }
    throw error;
  };
  const publish = async (actor: PostActor, body: unknown): Promise<AudioPostRecord> => {
    assertActor(actor);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AudioPostError("VALIDATION", "Invalid publish request");
    }
    const input = body as Record<string, unknown>;
    // No author/user/AI status/URL/status field is client-authoritative.
    if (Object.keys(input).some((key) => !["requestId", "assetId", "title"].includes(key))) {
      throw new AudioPostError("VALIDATION", "Unknown publish field");
    }
    const requestId = safeId(input.requestId, "request", 96);
    const assetId = safeId(input.assetId, "asset");
    const title = safeTitle(input.title);
    const old = await repository.byRequest(actor.tenantId, actor.accountId, requestId);
    if (old) {
      if (old.assetId !== assetId || old.title !== title || old.authorId !== actor.authorId ||
          old.authorKind !== actor.authorKind) {
        throw new AudioPostError("CONFLICT", "Publish key was used with different content");
      }
      return old;
    }
    const asset = await assets.verifyOwnedReady({
      tenantId: actor.tenantId, accountId: actor.accountId, assetId,
    });
    assertAudio(asset, actor.accountId, assetId);
    const created = await repository.createOnce({
      actor, asset, title, requestId, postId: safeId(newId(), "post"), createdAt: now(),
    });
    if (created.assetId !== assetId || created.title !== title ||
        created.authorAccountId !== actor.accountId || created.authorId !== actor.authorId ||
        created.authorKind !== actor.authorKind || created.requestId !== requestId) {
      throw new AudioPostError("CONFLICT", "Publish key raced with different content");
    }
    return created;
  };

  const settle = async (input: { tenantId: string; postId: string; expectedRevision: number }) => {
    safeId(input.tenantId, "tenant");
    safeId(input.postId, "post");
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
      throw new AudioPostError("VALIDATION", "Invalid revision");
    }
    const post = await repository.byId(input.tenantId, input.postId);
    if (!post || post.status !== "processing" || post.revision !== input.expectedRevision) {
      throw new AudioPostError("CONFLICT", "Post changed during processing");
    }
    const approved = await moderation.approve({
      tenantId: post.tenantId, postId: post.postId,
      assetId: post.assetId, authorId: post.authorId,
    });
    return repository.settle({
      tenantId: post.tenantId, postId: post.postId,
      expectedRevision: post.revision,
      status: approved ? "published" : "failed",
    });
  };

  const feed = async (input: {
    tenantId: string; viewerId: string | null; cursor?: string | null; limit?: number;
  }): Promise<PublicAudioFeedPage> => {
    safeId(input.tenantId, "tenant");
    if (input.viewerId !== null) safeId(input.viewerId, "viewer");
    const limit = input.limit ?? 20;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 30) {
      throw new AudioPostError("VALIDATION", "Invalid feed page size");
    }
    if (input.cursor !== undefined && input.cursor !== null) safeId(input.cursor, "cursor", 256);
    const page = await repository.publicFeed({
      tenantId: input.tenantId, viewerId: input.viewerId, limit, cursor: input.cursor ?? null,
    }).catch(mapRepositoryError);
    return { items: page.items.map(toPublicAudioPost), nextCursor: page.nextCursor };
  };

  // Recovery after a lost publish response: a read-only, authenticated lookup
  // of the exact durable idempotency key, scoped to the session's account and
  // tenant. A missing key reveals nothing about another account's post.
  const receiptByRequest = async (actor: PostActor, requestId: string) => {
    assertActor(actor);
    safeId(requestId, "request", 96);
    const post = await repository.byRequest(actor.tenantId, actor.accountId, requestId);
    return post ? toPublicAudioPost(post) : null;
  };

  const mine = async (actor: PostActor) => {
    assertActor(actor);
    const posts = await repository.mine({ tenantId: actor.tenantId, accountId: actor.accountId, limit: 50 });
    return posts.map(toPublicAudioPost);
  };

  const saved = async (actor: PostActor) => {
    assertActor(actor);
    const posts = await repository.saved({ tenantId: actor.tenantId, viewerId: actor.accountId, limit: 50 });
    return posts.map(toPublicAudioPost);
  };

  // Small account-scoped history pages avoid silently hiding posts after 50.
  const libraryPage = async (actor: PostActor, input: {
    kind: "mine" | "saved"; cursor?: unknown; limit?: unknown;
  }): Promise<PublicAudioFeedPage> => {
    assertActor(actor);
    const limit = input.limit === undefined ? 20 : input.limit;
    if (!Number.isSafeInteger(limit) || (limit as number) < 1 || (limit as number) > 30 ||
        (input.cursor != null && (typeof input.cursor !== "string" ||
          !/^[A-Za-z0-9_-]{1,256}$/.test(input.cursor)))) {
      throw new AudioPostError("VALIDATION", "Invalid library page");
    }
    const cursor = (input.cursor as string | null | undefined) ?? null;
    const page = input.kind === "mine"
      ? await repository.minePage?.({tenantId:actor.tenantId,accountId:actor.accountId,
          cursor,limit:limit as number}).catch(mapRepositoryError)
      : await repository.savedPage?.({tenantId:actor.tenantId,viewerId:actor.accountId,
          cursor,limit:limit as number}).catch(mapRepositoryError);
    if (!page || !Array.isArray(page.items) ||
        (page.nextCursor !== null && typeof page.nextCursor !== "string")) {
      throw new AudioPostError("CAPABILITY_UNAVAILABLE", "Audio library pagination unavailable");
    }
    return {items:page.items.map(toPublicAudioPost),nextCursor:page.nextCursor};
  };

  const removeOwn = async (actor: PostActor, postId: string) => {
    assertActor(actor);
    safeId(postId, "post");
    const removed = await repository.removeOwn({
      tenantId: actor.tenantId, accountId: actor.accountId, postId,
    });
    // Same response for missing and another account's post: no existence leak.
    if (!removed) throw new AudioPostError("NOT_FOUND", "Audio post not found");
    return removed;
  };

  const reaction = async (actor: PostActor, input: {
    postId: string; kind: "like" | "save"; enabled: boolean;
  }) => {
    assertActor(actor);
    safeId(input.postId, "post");
    if ((input.kind !== "like" && input.kind !== "save") ||
        typeof input.enabled !== "boolean") {
      throw new AudioPostError("VALIDATION", "Invalid reaction");
    }
    return repository.setReaction({
      tenantId: actor.tenantId, viewerId: actor.accountId,
      postId: input.postId, kind: input.kind, enabled: input.enabled,
    }).catch(mapRepositoryError);
  };

  const commentText = (value: unknown): string => {
    if (typeof value !== "string") throw new AudioPostError("VALIDATION", "Comment text required");
    const trimmed = value.trim();
    if (trimmed.length < 1 || trimmed.length > 400 ||
        /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u.test(trimmed)) {
      throw new AudioPostError("VALIDATION", "Comment must be 1–400 plain-text characters");
    }
    return trimmed;
  };
  const commentView = (item: AudioPostComment, viewerId: string): PublicAudioPostComment => ({
    postId: item.postId, commentId: item.commentId, body: item.body,
    createdAt: item.createdAt, removed: item.removed,
    isMine: item.authorAccountId === viewerId,
  });
  const comments = async (actor: PostActor, postId: string) => {
    assertActor(actor);
    safeId(postId, "post");
    try {
      const items = await repository.listComments({
        tenantId: actor.tenantId, viewerId: actor.accountId, postId, limit: 50,
      });
      return items.map(item => commentView(item, actor.accountId));
    } catch (error) { return mapRepositoryError(error); }
  };
  // Existing comments() remains wire-compatible for prior clients. New readers
  // fetch older comments with a scoped immutable comment ID cursor and limit+1.
  const commentsPage = async (
    actor: PostActor, postId: string, cursor?: string,
  ): Promise<PublicAudioPostCommentPage> => {
    assertActor(actor);
    safeId(postId, "post");
    if (cursor !== undefined) safeId(cursor, "comment cursor");
    try {
      const rows = await repository.listComments({
        tenantId: actor.tenantId, viewerId: actor.accountId, postId,
        limit: 51, beforeCommentId: cursor ?? null,
      });
      const page = rows.slice(0, 50);
      return {
        items: page.map(item => commentView(item, actor.accountId)),
        nextCursor: rows.length > 50 && page.length > 0
          ? page[page.length - 1]!.commentId : null,
      };
    } catch (error) { return mapRepositoryError(error); }
  };
  const comment = async (actor: PostActor, postId: string, body: unknown) => {
    assertActor(actor);
    safeId(postId, "post");
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AudioPostError("VALIDATION", "Invalid comment");
    }
    const payload = body as Record<string, unknown>;
    if (Object.keys(payload).some(k => k !== "requestId" && k !== "body")) {
      throw new AudioPostError("VALIDATION", "Unknown comment field");
    }
    const requestId = safeId(payload.requestId, "request", 96);
    const text = commentText(payload.body);
    try {
      const record = await repository.addComment({
        tenantId: actor.tenantId, viewerId: actor.accountId, postId,
        commentId: safeId(newId(), "comment"), requestId, body: text, createdAt: now(),
      });
      return commentView(record, actor.accountId);
    } catch (error) { return mapRepositoryError(error); }
  };
  const removeOwnComment = async (actor: PostActor, postId: string, commentId: string) => {
    assertActor(actor);
    safeId(postId, "post");
    safeId(commentId, "comment");
    const removed = await repository.removeOwnComment({
      tenantId: actor.tenantId, viewerId: actor.accountId, postId, commentId,
    });
    if (!removed) throw new AudioPostError("NOT_FOUND", "Comment not found");
    return { removed: true };
  };
  return Object.freeze({ publish, settle, feed, receiptByRequest, mine, saved, libraryPage, removeOwn, reaction, comments, commentsPage, comment, removeOwnComment });
}
