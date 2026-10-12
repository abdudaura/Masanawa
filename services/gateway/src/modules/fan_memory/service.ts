/** J11: server-owned fan-to-Masana memory scopes and consent. */
export interface FanPrincipal {readonly tenantId:string;readonly userId:string}
export interface FanMemoryItem {readonly id:string;readonly content:string;readonly updatedAt:string;readonly expiresAt:string|null}
export interface FanMemoryView {readonly characterId:string;readonly enabled:boolean;readonly revision:number;readonly items:readonly FanMemoryItem[]}
export interface FanMemoryStore {
 read(actor:FanPrincipal,characterId:string):Promise<FanMemoryView|null>;
 setEnabled(actor:FanPrincipal,characterId:string,enabled:boolean,revision:number):Promise<FanMemoryView|null>;
 enqueueErase(actor:FanPrincipal,characterId:string,recordId:string|null,key:string):Promise<{requestId:string;state:string}|null>;
}
export class FanMemoryError extends Error {
 constructor(readonly status:number,readonly code:string){super(code);}
}
const character=/^character_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const memory=/^memory-record_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
function gate(actor:FanPrincipal,id:string):void {
 if(!actor?.tenantId?.startsWith("tenant_")||!actor?.userId?.startsWith("user_"))
  throw new FanMemoryError(401,"fan_login_required");
 if(!character.test(id))throw new FanMemoryError(400,"invalid_character");
}
export function createFanMemoryService(store:FanMemoryStore){
 return {
  async view(actor:FanPrincipal,characterId:string):Promise<FanMemoryView>{
   gate(actor,characterId);
   const v=await store.read(actor,characterId);
   if(!v)throw new FanMemoryError(404,"fan_relationship_missing");
   return v.enabled?v:{...v,items:[]};
  },
  async consent(actor:FanPrincipal,characterId:string,raw:unknown):Promise<FanMemoryView>{
   gate(actor,characterId);
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new FanMemoryError(400,"invalid_consent");
   const x=raw as Record<string,unknown>;
   if(Object.keys(x).sort().join(",")!=="enabled,expectedRevision"||typeof x.enabled!=="boolean"||
    !Number.isSafeInteger(x.expectedRevision)||(x.expectedRevision as number)<0)
    throw new FanMemoryError(400,"invalid_consent");
   const v=await store.setEnabled(actor,characterId,x.enabled,x.expectedRevision as number);
   if(!v)throw new FanMemoryError(409,"consent_revision_conflict");
   return v.enabled?v:{...v,items:[]};
  },
  async erase(actor:FanPrincipal,characterId:string,recordId:unknown,key:unknown){
   gate(actor,characterId);
   if(recordId!==null&&(typeof recordId!=="string"||!memory.test(recordId)))
     throw new FanMemoryError(400,"invalid_memory_record");
   if(typeof key!=="string"||!/^[-\w.:]{8,128}$/u.test(key))
     throw new FanMemoryError(400,"idempotency_required");
   const result=await store.enqueueErase(actor,characterId,recordId as string|null,key);
   if(!result)throw new FanMemoryError(404,"memory_not_owned");
   return result; // queued is NOT a successful erasure
  }
 };
}
