import { randomUUID } from "node:crypto";

export interface CallActor { tenantId: string; fanUserId: string }
export interface CallRecord {
  callId: string; tenantId: string; fanUserId: string; characterId: string;
  roomName: string; state: "connecting" | "active" | "ended" | "expired" | "failed";
  expiresAt: string;
}
export interface CallStore {
  qualified(scope: CallActor & {characterId: string}): Promise<boolean>;
  create(input: CallActor & { callId: string; characterId: string; requestId: string; roomName: string; expiresAt: string }): Promise<boolean>;
  markActive(input: CallActor & {callId: string}): Promise<boolean>;
  finish(input: CallActor & {callId: string; state: "ended" | "failed"; failureCode?: string}): Promise<boolean>;
  get(input: CallActor & {callId: string}): Promise<CallRecord | null>;
  findByRequest(input: CallActor & {characterId: string; requestId: string}): Promise<CallRecord | null>;
  stopConfirmed(input: CallActor & {callId: string}): Promise<void>;
}
export interface CallProvider {
  /** Dispatch must be idempotent on callId and must recheck active DB state each turn. */
  dispatch(input: {callId: string; roomName: string; tenantId: string; characterId: string}): Promise<void>;
  /** Only signed microphone publish and subscribe; no video, room-admin or data permission. */
  token(input: {callId: string; roomName: string; fanUserId: string}): Promise<{url: string; token: string; expiresAt: string}>;
  stop(input: {callId: string; roomName: string}): Promise<void>;
}
export class CallFault extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}
export function createMasanaCallService(input: {
  store: CallStore; provider: CallProvider;
  resolveFan: (authorization: string | undefined) => Promise<CallActor>;
  enabled: () => Promise<boolean>; now?: () => Date;
}) {
  const now = input.now ?? (() => new Date());
  async function actor(auth: string | undefined): Promise<CallActor> {
    if (!auth?.startsWith("Bearer ")) throw new CallFault("unauthorized",401);
    const fan = await input.resolveFan(auth);
    if (!fan?.tenantId || !fan.fanUserId) throw new CallFault("unauthorized",401);
    return fan;
  }
  async function requireEnabled(): Promise<void> {
    let enabled=false;
    try { enabled=await input.enabled(); } catch { /* fail closed */ }
    if (!enabled) throw new CallFault("calls_unavailable",503);
  }
  return Object.freeze({
    async start(auth: string | undefined, body: unknown) {
      await requireEnabled();
      const fan=await actor(auth);
      const o=body && typeof body==="object" && !Array.isArray(body) ? body as Record<string,unknown> : {};
      const characterId=o.characterId, requestId=o.requestId;
      if (typeof characterId!=="string" || !/^character_[0-9a-f-]{36}$/i.test(characterId) ||
          typeof requestId!=="string" || !/^[a-zA-Z0-9_-]{16,110}$/.test(requestId)) {
        throw new CallFault("invalid_call_request",422);
      }
      if (!await input.store.qualified({...fan,characterId})) throw new CallFault("masana_voice_unavailable",403);
      const callId="call_"+randomUUID();
      const roomName="masana-"+randomUUID();
      const expiresAt=new Date(now().getTime()+15*60*1000).toISOString();
      let created=false;
      try { created=await input.store.create({...fan,callId,characterId,requestId,roomName,expiresAt}); }
      catch (e) {
        if (!(e && typeof e==="object" && "code" in e && (e as {code?:unknown}).code==="23505"))
          throw e;
      }
      if (!created) {
        // A response may be lost after LiveKit dispatch. Re-issue only the
        // SAME fan's token for the SAME idempotency key, never a new dispatch.
        // An unrelated concurrent call remains a 409 with no token leak.
        const retry=await input.store.findByRequest({...fan,characterId,requestId});
        if (!retry || !["connecting","active"].includes(retry.state) ||
            !new Date(retry.expiresAt).getTime() ||
            new Date(retry.expiresAt).getTime()<=now().getTime())
          throw new CallFault("call_already_pending",409);
        try {
          const media=await input.provider.token({
            callId:retry.callId,roomName:retry.roomName,fanUserId:fan.fanUserId,
          });
          if (!/^wss:\/\//.test(media.url) || !media.token || !media.expiresAt)
            throw new Error("invalid_provider_token");
          return {callId:retry.callId,characterId,roomName:retry.roomName,
            url:media.url,token:media.token,
            tokenExpiresAt:media.expiresAt,expiresAt:retry.expiresAt,state:retry.state};
        } catch {throw new CallFault("calls_unavailable",503);}
      }
      try {
        await input.provider.dispatch({callId,roomName,tenantId:fan.tenantId,characterId});
        const media=await input.provider.token({callId,roomName,fanUserId:fan.fanUserId});
        if (!/^wss:\/\//.test(media.url) || !media.token || !media.expiresAt)
          throw new Error("invalid_provider_token");
        return {callId,characterId,roomName,url:media.url,token:media.token,
          tokenExpiresAt:media.expiresAt,expiresAt,state:"connecting" as const};
      } catch {
        await input.store.finish({...fan,callId,state:"failed",failureCode:"provider_unavailable"});
        try {
          await input.provider.stop({callId,roomName});
          await input.store.stopConfirmed({...fan,callId});
        } catch { /* Durable provider_stop_pending retried by J04 stop worker. */ }
        throw new CallFault("calls_unavailable",503);
      }
    },
    async markConnected(auth: string | undefined, id: string) {
      const fan=await actor(auth);
      if (!/^call_[0-9a-f-]{36}$/i.test(id)) throw new CallFault("invalid_call_id",422);
      await requireEnabled();
      if (!await input.store.markActive({...fan,callId:id})) throw new CallFault("call_not_active",409);
      return {connected:true};
    },
    async end(auth: string | undefined, id: string) {
      const fan=await actor(auth);
      if (!/^call_[0-9a-f-]{36}$/i.test(id)) throw new CallFault("invalid_call_id",422);
      const session=await input.store.get({...fan,callId:id});
      if (!session) throw new CallFault("call_not_found",404);
      if (session.state==="ended" || session.state==="failed" || session.state==="expired") return {ended:true};
      if (!await input.store.finish({...fan,callId:id,state:"ended"})) throw new CallFault("call_not_found",404);
      try {
        await input.provider.stop({callId:id,roomName:session.roomName});
        await input.store.stopConfirmed({...fan,callId:id});
      } catch { /* Durable provider_stop_pending remains until stop confirmed. */ }
      return {ended:true};
    },
    async status(auth: string | undefined, id: string) {
      const fan=await actor(auth);
      if (!/^call_[0-9a-f-]{36}$/i.test(id)) throw new CallFault("invalid_call_id",422);
      const record=await input.store.get({...fan,callId:id});
      if (!record) throw new CallFault("call_not_found",404);
      // No provider token or sensitive credentials in readback.
      return {callId:record.callId,characterId:record.characterId,state:record.state,expiresAt:record.expiresAt};
    },
  });
}
