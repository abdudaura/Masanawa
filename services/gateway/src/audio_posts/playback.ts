/** AF09 Published Talks: authenticated post visibility -> canonical AF15 private-media ticket.
 * This module does not sign objects or replace AF15. AF00 must inject the real
 * session resolver, post repository, visibility policy and issuePrivateMediaUrl.
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import type { AudioPostRecord, PostActor } from "./contract.js";

export class TalkPlaybackError extends Error {
  readonly code: "VALIDATION" | "NOT_FOUND" | "AUTH_REQUIRED" | "CAPABILITY_UNAVAILABLE";
  constructor(code: "VALIDATION" | "NOT_FOUND" | "AUTH_REQUIRED" | "CAPABILITY_UNAVAILABLE") {
    super(code); this.name = "TalkPlaybackError"; this.code = code;
  }
}

export interface PublishedTalkPlaybackDeps {
  repository: { byId(tenantId: string, postId: string): Promise<AudioPostRecord | null> };
  visibility: { canView(input: { tenantId: string; viewerId: string; authorAccountId: string }): Promise<boolean> };
  /** Must bind to AF15 issuePrivateMediaUrl using the *current* authenticated principal,
   * matching both tenant and account; client-provided paths/URLs are never accepted. */
  media: { issue(input: { tenantId: string; accountId: string; mediaId: string }): Promise<{
    url: string; expiresAtMs: number; cacheControl: "private, no-store";
  }> };
  signerHost: string;
  nowMs?: () => number;
  /** Optional until AF00 installs the durable listen tables and wires the adapter.
   * Absence disables counting, not authenticated audio playback.
   */
  listens?: TalkListenStore;
}

export interface TalkListenStore {
  open(input: { tenantId: string; postId: string; viewerId: string; revision: number; durationMs: number }): Promise<string>;
  complete(input: { tenantId: string; postId: string; viewerId: string; listenId: string; playedMs: number;
    canView: (authorAccountId: string) => Promise<boolean> }): Promise<{ counted: boolean; listenCount: number }>;
}

const safeId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
const samePublished = (first: AudioPostRecord, latest: AudioPostRecord | null): boolean =>
  latest !== null && latest.status === "published" && first.status === "published" &&
  latest.tenantId === first.tenantId && latest.postId === first.postId &&
  latest.assetId === first.assetId && latest.authorAccountId === first.authorAccountId &&
  latest.revision === first.revision;

export function createAudioPostPlaybackService(deps: PublishedTalkPlaybackDeps) {
  if (typeof deps.signerHost !== "string" || !/^[a-z0-9.-]+$/.test(deps.signerHost) ||
      deps.signerHost.startsWith(".") || deps.signerHost.endsWith(".")) {
    throw new Error("audio_posts.invalid_signer_host");
  }
  return {
    async ticket(input: {
      actor: PostActor; postId: string;
      /** Resolve the AF08 session *again* after signing to fence logout/switch. */
      currentActor: () => Promise<PostActor>;
    }): Promise<{ url: string; expiresAtMs: number; listenSessionId?: string }> {
      const { actor, postId } = input;
      if (!actor || !safeId(actor.tenantId) || !safeId(actor.accountId)) {
        throw new TalkPlaybackError("AUTH_REQUIRED");
      }
      if (!safeId(postId)) throw new TalkPlaybackError("VALIDATION");
      // Snapshot the session scalars; auth providers may return mutable objects.
      const tenantId = actor.tenantId, accountId = actor.accountId;
      const first = await deps.repository.byId(tenantId, postId);
      if (!first || first.tenantId !== tenantId || first.postId !== postId ||
          first.status !== "published" || !safeId(first.assetId) ||
          !safeId(first.authorAccountId) || !Number.isSafeInteger(first.revision)) {
        throw new TalkPlaybackError("NOT_FOUND");
      }
      if (!await deps.visibility.canView({ tenantId, viewerId: accountId,
        authorAccountId: first.authorAccountId })) throw new TalkPlaybackError("NOT_FOUND");
      let ticket: Awaited<ReturnType<PublishedTalkPlaybackDeps["media"]["issue"]>>;
      try {
        ticket = await deps.media.issue({ tenantId, accountId, mediaId: first.assetId });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "unauthenticated") {
          throw new TalkPlaybackError("AUTH_REQUIRED");
        }
        if (error && typeof error === "object" && "code" in error && error.code === "not_found") {
          throw new TalkPlaybackError("NOT_FOUND");
        }
        throw new TalkPlaybackError("CAPABILITY_UNAVAILABLE");
      }
      // Fail closed on a broken media adapter. AF15 independently verifies URL
      // origin, principal and access revision before returning its ticket.
      const now = deps.nowMs?.() ?? Date.now();
      let url: URL;
      try { url = new URL(ticket?.url); }
      catch { throw new TalkPlaybackError("CAPABILITY_UNAVAILABLE"); }
      if (url.protocol !== "https:" || url.hostname !== deps.signerHost ||
          url.username || url.password || url.hash || ticket.cacheControl !== "private, no-store" ||
          !Number.isSafeInteger(now) || !Number.isSafeInteger(ticket.expiresAtMs) ||
          ticket.expiresAtMs <= now || ticket.expiresAtMs > now + 60_000) {
        throw new TalkPlaybackError("CAPABILITY_UNAVAILABLE");
      }
      // Recheck both AF08 session and post visibility after async signing.
      // Deletion, moderation and blocking during issuance must not release URL.
      let freshActor: PostActor;
      try { freshActor = await input.currentActor(); }
      catch { throw new TalkPlaybackError("AUTH_REQUIRED"); }
      if (!freshActor || freshActor.accountId !== accountId || freshActor.tenantId !== tenantId) {
        throw new TalkPlaybackError("AUTH_REQUIRED");
      }
      const latest = await deps.repository.byId(tenantId, postId);
      if (!samePublished(first, latest) ||
          !await deps.visibility.canView({ tenantId, viewerId: accountId,
            authorAccountId: first.authorAccountId })) throw new TalkPlaybackError("NOT_FOUND");
      // A server-minted durable view grant is returned only after all existing
      // AF08/AF15 visibility checks. Ticket alone never increments a counter.
      let listenSessionId: string | undefined;
      if (deps.listens) {
        try {
          listenSessionId = await deps.listens.open({
            tenantId, postId, viewerId: accountId,
            revision: first.revision, durationMs: first.durationMs,
          });
        } catch {
          throw new TalkPlaybackError("CAPABILITY_UNAVAILABLE");
        }
        // Session can rotate while the DB grants a listen: never return ticket.
        let current: PostActor;
        try { current = await input.currentActor(); }
        catch { throw new TalkPlaybackError("AUTH_REQUIRED"); }
        if (!current || current.accountId !== accountId || current.tenantId !== tenantId ||
            !samePublished(first, await deps.repository.byId(tenantId,postId)) ||
            !await deps.visibility.canView({tenantId,viewerId:accountId,
              authorAccountId:first.authorAccountId})) {
          throw new TalkPlaybackError("AUTH_REQUIRED");
        }
      }
      return { url: ticket.url, expiresAtMs: ticket.expiresAtMs,
        ...(listenSessionId ? { listenSessionId } : {}) };
    },
    async countListen(input: {
      actor: PostActor; postId: string; body: unknown;
      currentActor: () => Promise<PostActor>;
    }): Promise<{counted:boolean;listenCount:number}> {
      if (!deps.listens) throw new TalkPlaybackError("CAPABILITY_UNAVAILABLE");
      const {actor,postId,body} = input;
      if (!actor || !safeId(actor.tenantId) || !safeId(actor.accountId)) {
        throw new TalkPlaybackError("AUTH_REQUIRED");
      }
      if (!safeId(postId) || !body || typeof body !== "object" || Array.isArray(body)) {
        throw new TalkPlaybackError("VALIDATION");
      }
      const b = body as Record<string,unknown>;
      if (Object.keys(b).length !== 2 || typeof b.listenSessionId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(b.listenSessionId) ||
          !Number.isSafeInteger(b.playedMs) || (b.playedMs as number) < 0 ||
          (b.playedMs as number) > 180000 || !("playedMs" in b)) {
        throw new TalkPlaybackError("VALIDATION");
      }
      const tenantId = actor.tenantId, accountId = actor.accountId;
      let current: PostActor;
      try { current = await input.currentActor(); }
      catch { throw new TalkPlaybackError("AUTH_REQUIRED"); }
      if (!current || current.tenantId !== tenantId || current.accountId !== accountId) {
        throw new TalkPlaybackError("AUTH_REQUIRED");
      }
      try {
        return await deps.listens.complete({
          tenantId,postId,viewerId:accountId,
          listenId:b.listenSessionId,playedMs:b.playedMs as number,
          canView: authorAccountId => deps.visibility.canView({
            tenantId,viewerId:accountId,authorAccountId,
          }),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "";
        if (reason === "audio_posts.listen_not_visible" || reason === "audio_posts.listen_expired") {
          throw new TalkPlaybackError("NOT_FOUND");
        }
        if (reason === "audio_posts.listen_insufficient_progress" ||
            reason === "audio_posts.listen_invalid_input") {
          throw new TalkPlaybackError("VALIDATION");
        }
        throw new TalkPlaybackError("CAPABILITY_UNAVAILABLE");
      }
    },
  };
}

/** AF00 calls this route factory only after installing canonical auth/media bindings. */
export function registerAudioPostPlaybackRoutes(app: FastifyInstance, deps: {
  service: ReturnType<typeof createAudioPostPlaybackService>;
  requireActor: (authorization: string | undefined) => Promise<PostActor>;
}): void {
  const respond = (reply: FastifyReply,error: unknown) => {
    if (error instanceof TalkPlaybackError) {
      const status = error.code === "AUTH_REQUIRED" ? 401 : error.code === "NOT_FOUND" ? 404 :
        error.code === "CAPABILITY_UNAVAILABLE" ? 503 : 400;
      return reply.code(status).send({ code: error.code });
    }
    throw error;
  };
  app.post("/audio-posts/:postId/listen", async (request, reply: FastifyReply) => {
    reply.header("Cache-Control", "private, no-store");
    try {
      const auth = request.headers.authorization;
      const actor = await deps.requireActor(auth);
      const params = request.params as { postId?: unknown };
      if (!safeId(params?.postId)) throw new TalkPlaybackError("VALIDATION");
      return await deps.service.countListen({actor,postId:params.postId,
        body:request.body,currentActor:()=>deps.requireActor(auth)});
    } catch (error) { return respond(reply,error); }
  });
  app.get("/audio-posts/:postId/playback", async (request, reply: FastifyReply) => {
    reply.header("Cache-Control", "private, no-store");
    try {
      const current = await deps.requireActor(request.headers.authorization);
      const params = request.params as { postId?: unknown };
      if (!safeId(params?.postId)) throw new TalkPlaybackError("VALIDATION");
      return await deps.service.ticket({ actor: current, postId: params.postId,
        currentActor: () => deps.requireActor(request.headers.authorization) });
    } catch (error) {
      return respond(reply,error);
    }
  });
}
