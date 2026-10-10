/** Must be dispatched by canonical events.outbox, not a new queue. */
export interface Candidate {content:string;category:string;messageId:string;confidence:number;sourceHash:string}
const allowedCategories=new Set(["preference","non_sensitive_fact"]);
export function allowedCandidates(items:readonly Candidate[]):readonly Candidate[]{
 return items.filter(i=>i && typeof i.category==="string"&&allowedCategories.has(i.category.toLowerCase())&&
  typeof i.content==="string"&&i.content.trim().length>=3&&i.content.length<=1000&&
  i.confidence>=0.6&&i.confidence<=1&&/^[a-f0-9]{64}$/u.test(i.sourceHash)&&
  typeof i.messageId==="string"&&i.messageId.length>0&&i.messageId.length<=200).slice(0,8);
}
export interface ExtractionPort {
 enabled(t:string,r:string):Promise<boolean>;
 /** Rechecks enabled+message ACL with row lock within the same DB transaction as canonical memory insert. */
 commit(t:string,r:string,items:readonly Candidate[],ttlDays:180):Promise<number>;
}
export async function runFanExtraction(port:ExtractionPort,input:{
 tenantId:string;relationshipId:string;authorizedMessageIds:readonly string[]
},extract:()=>Promise<readonly Candidate[]>):Promise<number>{
 if(!input.authorizedMessageIds.length||!await port.enabled(input.tenantId,input.relationshipId))return 0;
 const items=allowedCandidates(await extract()).filter(i=>input.authorizedMessageIds.includes(i.messageId));
 return items.length?port.commit(input.tenantId,input.relationshipId,items,180):0;
}
