import { randomUUID } from "node:crypto";
import type { PlatformSessionIdentity } from "@masanawa/security";
import type { TalkMediaTokenIssuer, TalkMediaCredentials } from "./livekit_media.js";
import type {
  TalkLiveRepository,
  TalkLiveSessionView,
  TalkLiveStateView,
} from "./model.js";

export interface TalkLiveAuthorizer {
  authorize(input: Readonly<{
    authorizationHeader: string | undefined;
  }>): Promise<PlatformSessionIdentity>;
}

export class TalkLiveError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "TalkLiveError";
  }
}

export interface TalkLiveService {
  connect(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<TalkLiveSessionView>;
  heartbeat(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    sessionId: string;
  }>): Promise<TalkLiveSessionView>;
  disconnect(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    sessionId: string;
  }>): Promise<TalkLiveStateView>;
  state(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
  }>): Promise<TalkLiveStateView>;
  media(input: Readonly<{
    authorizationHeader: string | undefined;
    talkId: string;
    sessionId: string;
  }>): Promise<TalkMediaCredentials>;
}

function talkId(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160) {
    throw new TalkLiveError("talks.live.talk_id_invalid", 400);
  }
  return normalized;
}

function sessionId(value: string): string {
  const normalized = value.trim();
  if (!/^talk-live_[A-Za-z0-9-]{8,100}$/u.test(normalized)) {
    throw new TalkLiveError("talks.live.session_id_invalid", 400);
  }
  return normalized;
}

export function createTalkLiveService(input: Readonly<{
  repository: TalkLiveRepository;
  authorizer: TalkLiveAuthorizer;
  now?: () => string;
  reconnectGraceMs?: number;
  createSessionId?: () => string;
  mediaTokens?: TalkMediaTokenIssuer;
}>): TalkLiveService {
  const now = input.now ?? (() => new Date().toISOString());
  const reconnectGraceMs = input.reconnectGraceMs ?? 30_000;
  const createSessionId =
    input.createSessionId ?? (() => `talk-live_${randomUUID()}`);
  if (reconnectGraceMs < 5_000 || reconnectGraceMs > 120_000) {
    throw new TypeError("Talk reconnect grace must be between 5s and 120s");
  }

  async function identity(header: string | undefined) {
    return input.authorizer.authorize({ authorizationHeader: header });
  }

  return Object.freeze({
    async connect(request) {
      const viewer = await identity(request.authorizationHeader);
      const connected = await input.repository.connect({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: talkId(request.talkId),
        sessionId: createSessionId(),
        now: now(),
        reconnectGraceMs,
      });
      if (!connected) throw new TalkLiveError("talks.not_found", 404);
      return connected;
    },

    async heartbeat(request) {
      const viewer = await identity(request.authorizationHeader);
      const connected = await input.repository.heartbeat({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: talkId(request.talkId),
        sessionId: sessionId(request.sessionId),
        now: now(),
        reconnectGraceMs,
      });
      if (!connected) throw new TalkLiveError("talks.live.session_not_found", 404);
      return connected;
    },

    async disconnect(request) {
      const viewer = await identity(request.authorizationHeader);
      const state = await input.repository.disconnect({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: talkId(request.talkId),
        sessionId: sessionId(request.sessionId),
        now: now(),
        reconnectGraceMs,
      });
      if (!state) throw new TalkLiveError("talks.live.session_not_found", 404);
      return state;
    },

    async media(request) {
      if (!input.mediaTokens) {
        throw new TalkLiveError("talks.live.media_unavailable", 503);
      }
      const viewer = await identity(request.authorizationHeader);
      const connected = await input.repository.heartbeat({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: talkId(request.talkId),
        sessionId: sessionId(request.sessionId),
        now: now(),
        reconnectGraceMs,
      });
      if (!connected) throw new TalkLiveError("talks.live.session_not_found", 404);
      if (connected.state === "ended") {
        throw new TalkLiveError("talks.live.ended", 409);
      }
      return input.mediaTokens.mint({
        talkId: connected.talkId,
        sessionId: connected.sessionId,
        userId: viewer.userId,
        role: connected.role,
        canPublishAudio: connected.canPublishAudio,
      });
    },

    async state(request) {
      const viewer = await identity(request.authorizationHeader);
      const state = await input.repository.state({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: talkId(request.talkId),
        now: now(),
        reconnectGraceMs,
      });
      if (!state) throw new TalkLiveError("talks.not_found", 404);
      return state;
    },
  });
}
