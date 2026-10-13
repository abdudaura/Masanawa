import {
  claimOutboxBatch, settleOutboxClaim, withTransaction, type Pool,
} from "@masanawa/postgres";
import { processYouTubeOutbox, type YouTubeSyncSource } from "./reconcile.js";

const destination = "external-videos.youtube.reconcile";
/**
 * Uses the canonical PostgreSQL events.outbox lease/fence/retry mechanism.
 * AF00 injects a server-derived source loader and video reconciler, then
 * schedules this function from the one existing worker process.
 */
export async function runYoutubeOutboxBatch(input: {
  pool: Pool;
  workerId: string;
  loadSource: (tenantId:string,sourceId:string)=>Promise<YouTubeSyncSource|null>;
  reconcile: (source:YouTubeSyncSource)=>Promise<unknown>;
  limit?:number;
  leaseMs?:number;
}): Promise<{claimed:number;acknowledged:number;retried:number;deadLetter:number}> {
  const claims=await claimOutboxBatch(input.pool,{
    workerId:input.workerId,destination,limit:input.limit??5,
    leaseMs:input.leaseMs??120000,
  });
  let acknowledged=0,retried=0,deadLetter=0;
  for(const event of claims) {
    let state:"acknowledged"|"retry-scheduled"|"dead-letter"="acknowledged";
    let safeErrorCode:string|undefined;
    try {
      const payload=event.payload;
      if(!payload || typeof payload!=="object" || Array.isArray(payload)) throw new Error("invalid_payload");
      const value=payload as Record<string,unknown>;
      if(typeof value.tenantId!=="string" || typeof value.sourceId!=="string" ||
        value.tenantId!==event.tenantId) throw new Error("invalid_payload");
      await processYouTubeOutbox({
        tenantId:value.tenantId,sourceId:value.sourceId,eventType:event.eventType,
      },input.loadSource,input.reconcile);
    } catch(error) {
      const code=error instanceof Error && "code" in error && typeof error.code==="string"
        ? error.code : "youtube_sync_failed";
      safeErrorCode=["quota_exhausted","unauthorized_source","invalid_source"].includes(code)?code:"youtube_sync_failed";
      state=code==="unauthorized_source" || code==="invalid_source" || event.attempt>=8
        ? "dead-letter" : "retry-scheduled";
    }
    await withTransaction(input.pool,client=>settleOutboxClaim(client,{
      outboxEventId:event.outboxEventId,workerId:input.workerId,fence:event.fence,state,
      ...(safeErrorCode===undefined?{}:{safeErrorCode}),
      ...(state==="retry-scheduled"?{
        availableAt:new Date(Date.now()+Math.min(3600000,30000*2**Math.min(event.attempt,7))).toISOString() as
          NonNullable<Parameters<typeof settleOutboxClaim>[1]["availableAt"]>,
      }:{}),
    }));
    if(state==="acknowledged") acknowledged++;
    else if(state==="retry-scheduled") retried++;
    else deadLetter++;
  }
  return {claimed:claims.length,acknowledged,retried,deadLetter};
}
