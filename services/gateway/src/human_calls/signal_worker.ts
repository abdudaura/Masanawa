import type {HumanCallSqlPool} from "./postgres_repository.js";
import type {HumanCallRoomRevoker} from "./livekit_media.js";

interface SignalRow extends Record<string,unknown> {
  signal_id:string|number;tenant_id:string;call_id:string;
  recipient_user_id:string;event_type:string;lease_token:string;
}
export interface HumanCallPrivateSignalSender {
  /** Generic high-priority hint only: no name, phone, media or chat body.
   * R14 must resolve current tenant/account device tokens and DND preferences. */
  notify(input:{
    tenantId:string;recipientUserId:string;callId:string;
    eventType:"ringing"|"active"|"declined"|"cancelled"|"missed"|"ended";
    idempotencyKey:string;
  }):Promise<void>;
}
const kinds=["ringing","active","declined","cancelled","missed","ended"];
/**
 * A bounded one-pass operator/worker primitive. It is not scheduled until
 * R14/F10 and DB migration owners compose it with authenticated push delivery.
 * Worker crash or duplicate processing is safe if sender deduplicates signalId,
 * and the room revoker is idempotent.
 */
export async function processHumanCallSignals(input:{
  pool:HumanCallSqlPool;
  sender:HumanCallPrivateSignalSender;
  revoker:HumanCallRoomRevoker;
  maxBatch?:number;
}):Promise<{handled:number;failed:number}> {
  const limit=input.maxBatch??20;
  if(!Number.isSafeInteger(limit)||limit<1||limit>50)throw new TypeError("unsafe signal batch size");
  // Sweeping is essential: JWT expiry does NOT kick a participant already
  // connected to LiveKit. Turn overdue states into durable terminal signals
  // even when neither phone polls the API or foregrounds Chats.
  await input.pool.query(`
    WITH victims AS (
      SELECT tenant_id,call_id FROM talks.human_private_calls
      WHERE state IN ('ringing','active') AND expires_at<=clock_timestamp()
      ORDER BY expires_at,call_id FOR UPDATE SKIP LOCKED LIMIT $1
    ), expired AS (
      UPDATE talks.human_private_calls c
        SET state=CASE WHEN c.state='ringing' THEN 'missed' ELSE 'ended' END,
          ended_at=clock_timestamp()
      FROM victims v
      WHERE c.tenant_id=v.tenant_id AND c.call_id=v.call_id
      RETURNING c.tenant_id,c.call_id,c.caller_user_id,c.callee_user_id,c.state
    )
    INSERT INTO talks.human_call_signal_outbox
      (tenant_id,call_id,recipient_user_id,event_type)
    SELECT e.tenant_id,e.call_id,u.user_id,e.state
    FROM expired e CROSS JOIN LATERAL
      (VALUES(e.caller_user_id),(e.callee_user_id)) u(user_id)`,[limit]);
  const claimed=await input.pool.query<SignalRow>(`
    WITH selected AS(
      SELECT signal_id FROM talks.human_call_signal_outbox
      WHERE delivered_at IS NULL AND attempt_count < 10
        AND (leased_until IS NULL OR leased_until<clock_timestamp())
      ORDER BY signal_id FOR UPDATE SKIP LOCKED LIMIT $1
    )
    UPDATE talks.human_call_signal_outbox s
      SET lease_token=gen_random_uuid(),
        leased_until=clock_timestamp()+interval '30 seconds',
        attempt_count=attempt_count+1
    FROM selected WHERE selected.signal_id=s.signal_id
    RETURNING s.signal_id,s.tenant_id,s.call_id,s.recipient_user_id,
      s.event_type,s.lease_token`,[limit]);
  let handled=0,failed=0;
  for(const signal of claimed.rows) {
    const kind=signal.event_type;
    const key=String(signal.signal_id);
    try {
      if(!kinds.includes(kind))throw new TypeError("unknown signal");
      // Ending call/expiry/revocation must kick media participants, not just
      // rely on short JWT expiry. It is safe to repeat deleteRoom.
      if(["declined","cancelled","missed","ended"].includes(kind)) {
        await input.revoker.closeRoom("human-call_"+signal.call_id);
      }
      await input.sender.notify({
        tenantId:signal.tenant_id,recipientUserId:signal.recipient_user_id,
        callId:signal.call_id,
        eventType:kind as "ringing"|"active"|"declined"|"cancelled"|"missed"|"ended",
        idempotencyKey:key,
      });
      const ack=await input.pool.query(`
        UPDATE talks.human_call_signal_outbox SET delivered_at=clock_timestamp(),
          leased_until=NULL,lease_token=NULL,last_error_code=NULL
        WHERE signal_id=$1 AND lease_token=$2 AND delivered_at IS NULL`,
        [signal.signal_id,signal.lease_token]);
      if(ack.rowCount!==1)throw new Error("stale signal lease");
      handled++;
    } catch (_) {
      failed++;
      // No auth/token/payload/error messages are ever logged or persisted.
      await input.pool.query(`
        UPDATE talks.human_call_signal_outbox
        SET last_error_code='delivery_unavailable',lease_token=NULL,
          leased_until=clock_timestamp()+interval '30 seconds'
        WHERE signal_id=$1 AND lease_token=$2 AND delivered_at IS NULL`,
        [signal.signal_id,signal.lease_token]);
    }
  }
  return {handled,failed};
}
