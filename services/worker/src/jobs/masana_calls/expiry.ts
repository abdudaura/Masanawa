/**
 * Called by the existing shared leased outbox scheduler (AF00 owner).
 * Never creates a second worker, queue, scheduler or participant authority.
 * Repository must atomically claim due sessions using SKIP LOCKED and set
 * state=expired before returning so racing workers cannot bill/stop twice.
 */
export interface ExpiredCall {
  readonly callId: string; readonly roomName: string;
}
export async function expireMasanaCalls(input: {
  readonly enabled: boolean;
  readonly claimExpired: (limit: number) => Promise<readonly ExpiredCall[]>;
  readonly stop: (roomName: string, callId: string) => Promise<void>;
  readonly retryStop: (roomName: string, callId: string) => Promise<void>;
}, limit=40): Promise<number> {
  if (!input.enabled) return 0;
  if (!Number.isInteger(limit) || limit<1 || limit>100) throw new TypeError("invalid_limit");
  const expired=await input.claimExpired(limit);
  for (const row of expired) {
    try { await input.stop(row.roomName,row.callId); }
    catch { await input.retryStop(row.roomName,row.callId); }
  }
  return expired.length;
}


/** Periodic existing worker hook; the PostgreSQL lease is the durable retry authority.
 * A 30-second delay between attempts prevents provider storms.
 * Each acknowledged stop is idempotent and removes the pending room shutdown.
 */
export async function reconcileMasanaCallStops(input:{
  readonly enabled:boolean;
  readonly claimPendingStops:(limit:number)=>Promise<readonly {
    tenantId:string;callId:string;roomName:string}[]>;
  readonly stop:(roomName:string,callId:string)=>Promise<void>;
  readonly ackStop:(scope:{tenantId:string;callId:string})=>Promise<void>;
},limit=40):Promise<{attempted:number;confirmed:number}> {
  if(!input.enabled)return {attempted:0,confirmed:0};
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new TypeError("invalid_limit");
  const due=await input.claimPendingStops(limit);
  let confirmed=0;
  for(const item of due){
    try{
      await input.stop(item.roomName,item.callId);
      await input.ackStop({tenantId:item.tenantId,callId:item.callId});
      confirmed++;
    }catch {
      // Persistently pending in PG. Next lease retries after the delay.
    }
  }
  return {attempted:due.length,confirmed};
}
