import type { FollowingRepository } from "@masanawa/contracts";
export type { FollowingRepository } from "@masanawa/contracts";
import type { PostActor, PublicFeedPage, PublicAudioFeedPage } from "./contract.js";
import { toPublicAudioPost } from "./contract.js";

/** AF09 following is a relation to the existing canonical creator, not a second identity store. */
export class FollowingError extends Error {
  readonly code: "VALIDATION" | "NOT_FOUND" | "FORBIDDEN" | "CAPABILITY_UNAVAILABLE";
  constructor(code: "VALIDATION" | "NOT_FOUND" | "FORBIDDEN" | "CAPABILITY_UNAVAILABLE", message: string) {
    super(message);
    this.code = code;
    this.name = "FollowingError";
  }
}

const safeId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0 && id.length <= 128 &&
  /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(id);

function requireActor(actor: PostActor): void {
  if (!actor || !safeId(actor.tenantId) || !safeId(actor.accountId) ||
      !safeId(actor.authorId) || !["human", "masana"].includes(actor.authorKind)) {
    throw new FollowingError("FORBIDDEN", "Authenticated creator context required");
  }
}

// The repository owns cursor decoding and row validation. Translate only its
// stable page errors; unexpected PostgreSQL/visibility failures remain failures.
async function readFollowingPage<T>(read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch (error) {
    if (error instanceof Error && error.message === "audio_posts.invalid_following_cursor") {
      throw new FollowingError("VALIDATION", "Invalid page cursor");
    }
    if (error instanceof Error && error.message === "audio_posts.invalid_following_row") {
      throw new FollowingError("CAPABILITY_UNAVAILABLE", "Creator page unavailable");
    }
    throw error;
  }
}

export function createFollowingService(repository: FollowingRepository) {
  return Object.freeze({
    async set(actor: PostActor, input: { postId: unknown; enabled: unknown }) {
      requireActor(actor);
      if (!safeId(input?.postId) || typeof input.enabled !== "boolean") {
        throw new FollowingError("VALIDATION", "Invalid follow request");
      }
      const stored = await repository.setFromVisiblePost({
        tenantId: actor.tenantId, accountId: actor.accountId,
        postId: input.postId, enabled: input.enabled,
      });
      // Hidden, removed, blocked and nonexistent resources have identical readback.
      if (!stored) throw new FollowingError("NOT_FOUND", "Talk creator unavailable");
      if (!safeId(stored.authorId) ||
          !["human", "masana"].includes(stored.authorKind) ||
          typeof stored.following !== "boolean") {
        throw new FollowingError("CAPABILITY_UNAVAILABLE", "Creator follow status unavailable");
      }
      return stored;
    },
    async status(actor: PostActor, postId: unknown) {
      requireActor(actor);
      if (!safeId(postId)) throw new FollowingError("VALIDATION", "Invalid Talk ID");
      const stored = await repository.statusFromVisiblePost({
        tenantId: actor.tenantId, accountId: actor.accountId, postId,
      });
      if (!stored) throw new FollowingError("NOT_FOUND", "Talk creator unavailable");
      if (!safeId(stored.authorId) ||
          !["human", "masana"].includes(stored.authorKind) ||
          typeof stored.following !== "boolean") {
        throw new FollowingError("CAPABILITY_UNAVAILABLE", "Creator follow status unavailable");
      }
      return stored;
    },
    async creatorFeed(actor: PostActor, input: {
      authorId: unknown; authorKind: unknown; cursor?: unknown; limit?: unknown;
    }): Promise<PublicAudioFeedPage> {
      requireActor(actor);
      if (!safeId(input?.authorId) ||
          (input.authorKind !== "human" && input.authorKind !== "masana")) {
        throw new FollowingError("VALIDATION", "Invalid creator");
      }
      // Narrow validated primitives before the repository callback; reading
      // unknown input again inside an async closure loses that guarantee.
      const authorId = input.authorId;
      const authorKind = input.authorKind;
      const limit = input.limit === undefined ? 20 : input.limit;
      if (!Number.isSafeInteger(limit) || (limit as number) < 1 ||
          (limit as number) > 30 ||
          (input.cursor != null && (typeof input.cursor !== "string" ||
            !/^[A-Za-z0-9_-]{12,256}$/.test(input.cursor)))) {
        throw new FollowingError("VALIDATION", "Invalid creator page");
      }
      const page = await readFollowingPage(() => repository.creatorFeed({
        tenantId: actor.tenantId, viewerId: actor.accountId,
        authorId, authorKind,
        limit: limit as number, cursor: (input.cursor as string | null | undefined) ?? null,
      }));
      if (!page || !Array.isArray(page.items) ||
          (page.nextCursor !== null && typeof page.nextCursor !== "string") ||
          page.items.some(post => post.authorKind !== input.authorKind ||
            post.authorId !== input.authorId || post.status !== "published")) {
        throw new FollowingError("CAPABILITY_UNAVAILABLE", "Creator Talks unavailable");
      }
      return {
        items: page.items.map(toPublicAudioPost), nextCursor: page.nextCursor,
      };
    },
    async feed(actor: PostActor, input: { cursor?: unknown; limit?: unknown } = {}): Promise<PublicAudioFeedPage> {
      requireActor(actor);
      const limit = input.limit === undefined ? 20 : input.limit;
      if (!Number.isSafeInteger(limit) || (limit as number) < 1 || (limit as number) > 30 ||
          (input.cursor != null &&
           (typeof input.cursor !== "string" || input.cursor.length > 256 ||
            !/^[A-Za-z0-9_-]{12,256}$/.test(input.cursor)))) {
        throw new FollowingError("VALIDATION", "Invalid following page");
      }
      const page = await readFollowingPage(() => repository.feed({
        tenantId: actor.tenantId, viewerId: actor.accountId,
        limit: limit as number, cursor: (input.cursor as string | null | undefined) ?? null,
      }));
      if (!page || !Array.isArray(page.items) ||
          (page.nextCursor !== null && typeof page.nextCursor !== "string")) {
        throw new FollowingError("CAPABILITY_UNAVAILABLE", "Following feed unavailable");
      }
      // Shared Discover/Saved projection: internal tenant, owner, asset and
      // idempotency keys must never reach the Following HTTP response.
      return {
        items: page.items.map(toPublicAudioPost),
        nextCursor: page.nextCursor,
      };
    },
  });
}
