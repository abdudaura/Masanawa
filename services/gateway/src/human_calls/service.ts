import type { PlatformSessionIdentity } from "@masanawa/security";

export type HumanCallKind = "audio" | "video";
export type HumanCallState = "ringing" | "active" | "declined" | "cancelled" | "missed" | "ended";
export interface HumanCall {
  readonly callId: string;
  readonly conversationId: string;
  readonly callerUserId: string;
  readonly calleeUserId: string;
  readonly kind: HumanCallKind;
  readonly state: HumanCallState;
  readonly createdAt: string;
  readonly answeredAt: string | null;
  readonly endedAt: string | null;
}
export interface CallCredentials {
  readonly server_url: string;
  readonly participant_token: string;
  readonly room_name: string;
  readonly participant_identity: string;
  readonly expires_at: string;
}
export interface HumanCallRepository {
  start(input: {
    tenantId: string; actorId: string; conversationId: string;
    requestId: string; kind: HumanCallKind;
  }): Promise<HumanCall | "not_allowed" | "busy" | "request_conflict">;
  transition(input: {
    tenantId: string; actorId: string; callId: string; action: "accept" | "decline" | "end";
  }): Promise<HumanCall | null>;
  get(input: { tenantId: string; actorId: string; callId: string }): Promise<HumanCall | null>;
  recent(input: { tenantId: string; actorId: string; limit: number }): Promise<readonly HumanCall[]>;
}
export interface HumanCallAuthorizer {
  authorize(input: { authorizationHeader?: string }): Promise<PlatformSessionIdentity>;
}
export interface HumanCallMediaIssuer {
  mint(input: { call: HumanCall; userId: string }): Promise<CallCredentials>;
  /** Must disconnect both users at call termination, not merely let JWT expire. */
  terminate?(callId: string): Promise<void>;
}
export interface HumanCallAdmission {
  /** Canonical C01/C02/R15 live authorization: accepted pair, current user,
   * reciprocal blocks and platform restrictions. Fail closed when unavailable. */
  permitted(input: { tenantId: string; userId: string; conversationId: string }): Promise<boolean>;
}
export class HumanCallError extends Error {
  constructor(readonly code: string, readonly statusCode: number) {
    super(code);
    this.name = "HumanCallError";
  }
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
function uuid(value: string): string {
  if (!uuidPattern.test(value)) throw new HumanCallError("calls.id_invalid", 400);
  return value.toLowerCase();
}
function requestKey(value: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{11,127}$/u.test(value)) {
    throw new HumanCallError("calls.request_id_invalid", 400);
  }
  return value;
}
function typeOfCall(value: string): HumanCallKind {
  if (value !== "audio" && value !== "video") throw new HumanCallError("calls.kind_invalid",400);
  return value;
}
export function createHumanCallService(input: {
  repository: HumanCallRepository;
  authorizer: HumanCallAuthorizer;
  admission: HumanCallAdmission;
  media: HumanCallMediaIssuer;
}) {
  async function who(authorizationHeader?: string) {
    const p = await input.authorizer.authorize({ authorizationHeader });
    return { tenantId: p.tenantId as string, userId: p.userId as string };
  }
  async function requirePermission(tenantId: string,userId: string,conversationId: string) {
    if (!await input.admission.permitted({ tenantId,userId,conversationId })) {
      throw new HumanCallError("calls.unavailable",404);
    }
  }
  async function readable(tenantId: string,userId: string,callId: string) {
    const call = await input.repository.get({ tenantId,actorId:userId,callId });
    if (!call) throw new HumanCallError("calls.unavailable",404);
    await requirePermission(tenantId,userId,call.conversationId);
    return call;
  }
  return Object.freeze({
    async start(request: {
      authorizationHeader?: string; conversationId: string;
      requestId: string; kind: string;
    }) {
      const p = await who(request.authorizationHeader);
      const conversationId = uuid(request.conversationId);
      const kind = typeOfCall(request.kind), requestId = requestKey(request.requestId);
      await requirePermission(p.tenantId,p.userId,conversationId);
      const created = await input.repository.start({
        tenantId:p.tenantId,actorId:p.userId,conversationId,requestId,kind,
      });
      if (created === "not_allowed") throw new HumanCallError("calls.unavailable",404);
      if (created === "busy") throw new HumanCallError("calls.busy",409);
      if (created === "request_conflict") throw new HumanCallError("calls.request_conflict",409);
      // No token is returned while ringing; caller must await explicit acceptance.
      return created;
    },
    async act(request: { authorizationHeader?: string; callId: string; action: "accept" | "decline" | "end" }) {
      const p = await who(request.authorizationHeader);
      const callId = uuid(request.callId);
      if (!["accept","decline","end"].includes(request.action)) {
        throw new HumanCallError("calls.action_invalid",400);
      }
      const previous = await readable(p.tenantId,p.userId,callId);
      const changed = await input.repository.transition({
        tenantId:p.tenantId,actorId:p.userId,callId,action:request.action,
      });
      if (!changed) throw new HumanCallError("calls.stale_or_forbidden",409);
      // R15 blocks can race the transition; recheck before returning state.
      await requirePermission(p.tenantId,p.userId,previous.conversationId);
      if (changed.state === "ended" || changed.state === "cancelled" ||
          changed.state === "declined" || changed.state === "missed") {
        // Provider disconnect must be integrated before production admission.
        await input.media.terminate?.(changed.callId);
      }
      return changed;
    },
    async get(request: {authorizationHeader?: string;callId: string}) {
      const p = await who(request.authorizationHeader);
      return readable(p.tenantId,p.userId,uuid(request.callId));
    },
    async recent(request: {authorizationHeader?: string;limit?: number}) {
      const p = await who(request.authorizationHeader);
      const limit = request.limit ?? 30;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
        throw new HumanCallError("calls.limit_invalid",400);
      }
      const rows = await input.repository.recent({tenantId:p.tenantId,actorId:p.userId,limit});
      const visible: HumanCall[] = [];
      for (const row of rows) {
        if (await input.admission.permitted({
          tenantId:p.tenantId,userId:p.userId,conversationId:row.conversationId,
        })) visible.push(row);
      }
      return Object.freeze({calls:Object.freeze(visible)});
    },
    async media(request: {authorizationHeader?: string;callId: string}) {
      const p = await who(request.authorizationHeader);
      const call = await readable(p.tenantId,p.userId,uuid(request.callId));
      if (call.state !== "active") throw new HumanCallError("calls.not_active",409);
      if (p.userId !== call.callerUserId && p.userId !== call.calleeUserId) {
        throw new HumanCallError("calls.unavailable",404);
      }
      const issued = await input.media.mint({call,userId:p.userId});
      // Revocation/reassignment can happen during provider token issue.
      const current = await readable(p.tenantId,p.userId,call.callId);
      if (current.state !== "active") throw new HumanCallError("calls.not_active",409);
      return issued;
    },
  });
}
export type HumanCallService = ReturnType<typeof createHumanCallService>;
