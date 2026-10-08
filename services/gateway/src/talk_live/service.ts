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
  onTalkEnded?: (input: Readonly<{
    tenantId:string;
    talkId:string;
    reason:"host_grace_expired"|"host_ended"|"platform_ended";
    now:string;
  }>)=>Promise<void>;
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
  async function finalizeIfEnded(
    tenantId:string,
    talkIdValue:string,
    state:Readonly<{state:string;endReason?:"host_grace_expired"|"host_ended"|"platform_ended"|null}>,
    at:string,
  ):Promise<void>{
    if(state.state==="ended"&&state.endReason&&input.onTalkEnded){
      await input.onTalkEnded({tenantId,talkId:talkIdValue,reason:state.endReason,now:at});
    }
  }

  return Object.freeze<TalkLiveService>({
    async connect(request) {
      const viewer = await identity(request.authorizationHeader);
      let connected: TalkLiveSessionView | null;
      try {
        connected = await input.repository.connect({
          tenantId: viewer.tenantId,
          userId: viewer.userId,
          talkId: talkId(request.talkId),
          sessionId: createSessionId(),
          now: now(),
          reconnectGraceMs,
        });
      } catch (error) {
        // A persisted ended Talk is a domain conflict, not an internal outage.
        // Preserve all unknown storage/provider errors as real server failures.
        if (error instanceof Error && error.message === "talks.live.ended") {
          throw new TalkLiveError("talks.live.ended", 409);
        }
        throw error;
      }
      if (!connected) throw new TalkLiveError("talks.not_found", 404);
      return connected;
    },

    async heartbeat(request) {
      const viewer = await identity(request.authorizationHeader);
      const at=now();
      const talkIdValue=talkId(request.talkId);
      const connected = await input.repository.heartbeat({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: talkIdValue,
        sessionId: sessionId(request.sessionId),
        now: at,
        reconnectGraceMs,
      });
      if (!connected) throw new TalkLiveError("talks.live.session_not_found", 404);
      await finalizeIfEnded(viewer.tenantId,talkIdValue,connected,at);
      return connected;
    },

    async disconnect(request) {
      const viewer = await identity(request.authorizationHeader);
      const at=now();
      const talkIdValue=talkId(request.talkId);
      const state = await input.repository.disconnect({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: talkIdValue,
        sessionId: sessionId(request.sessionId),
        now: at,
        reconnectGraceMs,
      });
      if (!state) throw new TalkLiveError("talks.live.session_not_found", 404);
      await finalizeIfEnded(viewer.tenantId,talkIdValue,state,at);
      return state;
    },

    async media(request) {
      if (!input.mediaTokens) {
        throw new TalkLiveError("talks.live.media_unavailable", 503);
      }
      const viewer = await identity(request.authorizationHeader);
      const at=now();
      const talkIdValue=talkId(request.talkId);
      const connected = await input.repository.heartbeat({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: talkIdValue,
        sessionId: sessionId(request.sessionId),
        now: at,
        reconnectGraceMs,
      });
      if (!connected) throw new TalkLiveError("talks.live.session_not_found", 404);
      await finalizeIfEnded(viewer.tenantId,talkIdValue,connected,at);
      if (connected.state === "ended") {
        throw new TalkLiveError("talks.live.ended", 409);
      }
      try {
        const credentials = await input.mediaTokens.mint({
          talkId: connected.talkId,
          sessionId: connected.sessionId,
          userId: viewer.userId,
          role: connected.role,
          canPublishAudio: connected.canPublishAudio,
        });
        // ListParticipants/RemoveParticipant involves remote network I/O. A
        // concurrent Host connect may revoke this lease while minting. Never
        // return the already-signed JWT unless authority is still identical.
        const latest = await input.repository.heartbeat({
          tenantId: viewer.tenantId,
          userId: viewer.userId,
          talkId: talkIdValue,
          sessionId: sessionId(request.sessionId),
          now: now(),
          reconnectGraceMs,
        });
        if (!latest || latest.state === "ended" ||
            latest.role !== connected.role ||
            latest.canHearAudio !== connected.canHearAudio ||
            latest.canPublishAudio !== connected.canPublishAudio) {
          throw new TalkLiveError("talks.live.session_changed", 409);
        }
        return credentials;
      } catch (error) {
        // If RoomService could not validate/evict a former Host track, media
        // credentials must not escape. Surface a retryable dependency failure.
        if (error instanceof Error &&
            error.message.startsWith("talks.live.media_admin_")) {
          throw new TalkLiveError("talks.live.media_unavailable", 503);
        }
        throw error;
      }
    },

    async state(request) {
      const viewer = await identity(request.authorizationHeader);
      const at=now();
      const talkIdValue=talkId(request.talkId);
      const state = await input.repository.state({
        tenantId: viewer.tenantId,
        userId: viewer.userId,
        talkId: talkIdValue,
        now: at,
        reconnectGraceMs,
      });
      if (!state) throw new TalkLiveError("talks.not_found", 404);
      await finalizeIfEnded(viewer.tenantId,talkIdValue,state,at);
      return state;
    },
  });
}

