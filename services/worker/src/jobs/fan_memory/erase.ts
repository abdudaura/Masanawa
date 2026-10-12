/** Full erasure must call canonical approved memory tombstone, never DELETE memory.records. */
export interface EraseJob {tenantId:string;requestId:string;relationshipId:string;targetRecordId:string|null}
export interface ErasePort {
 claim():Promise<EraseJob|null>;
 scopedActive(req:EraseJob):Promise<readonly string[]>;
 /** Existing prepare/approve/execute memory tombstone authority; never generate approval IDs. */
 approvedTombstone(req:EraseJob,recordId:string):Promise<boolean>;
 complete(req:EraseJob):Promise<void>;
 needsReview(req:EraseJob):Promise<void>;
}
export async function runFanErasure(port:ErasePort):Promise<"idle"|"completed"|"review">{
 const req=await port.claim();if(!req)return "idle";
 const ids=req.targetRecordId?[req.targetRecordId]:await port.scopedActive(req);
 for(const id of ids)if(!await port.approvedTombstone(req,id)){
  await port.needsReview(req);return "review";
 }
 await port.complete(req);return "completed";
}
