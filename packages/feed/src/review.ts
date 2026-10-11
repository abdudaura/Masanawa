import {FeedError,type Actor,type PostKind} from "./index.js";

export type EditorialState="draft"|"in_review"|"scheduled"|"published"|"hidden"|"removed";
export type EditorialAction="submit"|"revise"|"approve"|"schedule"|"take_down";
export interface EditorialPost {
 id:string; tenantId:string; authorMasanaId:string; kind:PostKind; body:string;
 media:readonly string[]; transcript:string|null; state:EditorialState;
 revision:number; createdBy:string; scheduledAt:string|null; updatedAt:string;
}
export interface DraftInput {
 authorMasanaId:string; kind:PostKind; body:string; media?:readonly string[];
 transcript?:string|null; idempotencyKey:string;
}
export interface EditorialRepository {
 create(tenant:string,editor:string,draft:Required<DraftInput>):Promise<EditorialPost>;
 get(tenant:string,id:string):Promise<EditorialPost|null>;
 list(tenant:string,states:readonly EditorialState[],limit:number):Promise<readonly EditorialPost[]>;
 change(tenant:string,post:string,actor:string,expectedRevision:number,
  action:EditorialAction,key:string,scheduledAt:string|null):Promise<EditorialPost>;
}
const identifier=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idempotency=/^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
const states:readonly EditorialState[]=["draft","in_review","scheduled","published","hidden","removed"];
const roles:Readonly<Record<EditorialAction,string>>={
 submit:"content_editor",revise:"content_editor",approve:"content_editor",
 schedule:"content_editor",take_down:"content_editor",
};
const fail=(code:string,status=422):never=>{throw new FeedError(status,code)};
function staff(actor:Actor,permission:string){
 if(actor.kind!=="staff"||!actor.permissions?.includes(permission))fail("editorial_permission_denied",403);
 if(!identifier.test(actor.tenantId)||!identifier.test(actor.id))fail("invalid_actor");
}
function validKey(key:string){if(!idempotency.test(key))fail("invalid_idempotency_key")}
export class EditorialReviewService {
 constructor(private readonly repo:EditorialRepository,
  private readonly approvedMasana:(tenant:string,id:string)=>Promise<boolean>,
  private readonly approvedMedia:(tenant:string,masana:string,media:string)=>Promise<boolean>){}
 async create(actor:Actor,input:DraftInput):Promise<EditorialPost>{
  staff(actor,"content_editor");validKey(input.idempotencyKey);
  if(!identifier.test(input.authorMasanaId))fail("invalid_masana");
  if(!["text","image","audio"].includes(input.kind))fail("invalid_post_kind");
  const body=input.body.trim(),media=input.media??[],transcript=input.transcript??null;
  if(body.length>5000||(input.kind==="text"&&!body)||!Array.isArray(media)
    ||media.length>(input.kind==="image"?10:input.kind==="audio"?1:0)
    ||(input.kind!=="text"&&media.length===0)
    ||(input.kind==="audio"&&!transcript?.trim())||(transcript?.length??0)>15000)
    ||media.some(x=>typeof x!=="string"||!/^media_[A-Za-z0-9_-]{8,128}$/.test(x)))
    fail("invalid_draft");
  if(!await this.approvedMasana(actor.tenantId,input.authorMasanaId))fail("masana_not_approved",403);
  for(const ref of media)if(!await this.approvedMedia(actor.tenantId,input.authorMasanaId,ref))fail("media_not_approved",403);
  return this.repo.create(actor.tenantId,actor.id,{authorMasanaId:input.authorMasanaId,
   kind:input.kind,body,media,transcript,idempotencyKey:input.idempotencyKey});
 }
 async get(actor:Actor,id:string){staff(actor,"content_editor");if(!uuid.test(id))fail("invalid_post_id");
  const item=await this.repo.get(actor.tenantId,id);if(!item)fail("editorial_not_found",404);return item!}
 async list(actor:Actor,statesFilter:readonly EditorialState[]=[]){staff(actor,"content_editor");
  if(statesFilter.some(s=>!states.includes(s)))fail("invalid_state");
  return this.repo.list(actor.tenantId,statesFilter,50)}
 async change(actor:Actor,id:string,action:EditorialAction,revision:number,key:string,scheduledAt:string|null=null){
  staff(actor,roles[action]??"__denied");validKey(key);
  if(!uuid.test(id))fail("invalid_post_id");
  if(!Number.isSafeInteger(revision)||revision<0)fail("invalid_revision");
  if(!Object.keys(roles).includes(action))fail("invalid_action");
  if(action==="schedule"){
   const target=Date.parse(scheduledAt??"");
   if(!Number.isFinite(target)||target<=Date.now()+60000)fail("invalid_schedule");
  }else if(scheduledAt!==null)fail("unexpected_schedule");
  const record=await this.repo.get(actor.tenantId,id);
  if(!record)fail("editorial_not_found",404);
  if((action==="approve"||action==="schedule")&&record!.createdBy===actor.id)
   fail("separate_reviewer_required",403);
  if(action==="approve"||action==="schedule"){
   if(!await this.approvedMasana(actor.tenantId,record!.authorMasanaId))fail("masana_not_approved",403);
   for(const media of record!.media)if(!await this.approvedMedia(actor.tenantId,record!.authorMasanaId,media))fail("media_not_approved",403);
  }
  return this.repo.change(actor.tenantId,id,actor.id,revision,action,key,scheduledAt);
 }
}
