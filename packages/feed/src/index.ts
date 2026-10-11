
export type PostKind = "text"|"image"|"audio";
export type FeedMode = "for_you"|"following";
export type Actor = {kind:"fan"|"masana"|"staff"; tenantId:string; id:string; permissions?:readonly string[]; approved?:boolean};
export interface Post {id:string; tenantId:string; authorMasanaId:string;authorName?:string;kind:PostKind;body:string;media:readonly string[];transcript:string|null;publishedAt:string;likeCount:number;commentCount:number;viewerLiked:boolean;viewerSaved:boolean}
export interface Comment {id:string;postId:string;body:string;state:"pending"|"visible";createdAt:string;parentId?:string|null}
export interface Publish {authorMasanaId:string;kind:PostKind;body:string;media?:readonly string[];transcript?:string|null;idempotencyKey:string}
export class FeedError extends Error {constructor(readonly status:number,readonly code:string){super(code)}}
export interface Repository {
 list(tenant:string,viewer:string|null,mode:FeedMode,cursor:{at:string;id:string}|null,limit:number):Promise<readonly Post[]>;
 find(tenant:string,viewer:string|null,id:string):Promise<Post|null>;
 publish(tenant:string,publisher:string,value:Required<Publish>):Promise<Post>;
 setLike(tenant:string,fan:string,post:string,enabled:boolean):Promise<boolean>;
 setSave(tenant:string,fan:string,post:string,enabled:boolean):Promise<boolean>;
 comment(tenant:string,fan:string,post:string,text:string,key:string,pending:boolean,parentId?:string|null):Promise<Comment>;
 comments(tenant:string,post:string,viewer:string|null,before:string|null,limit:number,sort?:"newest"|"oldest"):Promise<readonly Comment[]>;
}
const ident=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const uid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const key=/^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/;
function requireId(id:string){if(!ident.test(id))throw new FeedError(422,"invalid_id")}
function requirePostId(id:string){if(!uid.test(id))throw new FeedError(422,"invalid_post_id")}
export function decodeCursor(value?:string):{at:string;id:string}|null{
 if(!value)return null;
 if(value.length>240||!/^[\w-]+$/.test(value))throw new FeedError(422,"invalid_cursor");
 try{const decoded:unknown=JSON.parse(Buffer.from(value,"base64url").toString("utf8"));
 if(!Array.isArray(decoded)||decoded.length!==2||typeof decoded[0]!=="string"||typeof decoded[1]!=="string"||!Number.isFinite(Date.parse(decoded[0]))||!uid.test(decoded[1]))throw Error("invalid");
 return {at:decoded[0],id:decoded[1]};}catch{throw new FeedError(422,"invalid_cursor")}
}
export class FeedService {
 constructor(private readonly repo:Repository,private readonly approvedMasana:(tenant:string,id:string)=>Promise<boolean>,
  private readonly approvedMedia:(tenant:string,masana:string,mediaId:string)=>Promise<boolean> = async () => false){}
 async list(tenant:string,viewer:string|null,mode:FeedMode,cursor?:string){
  requireId(tenant);if(viewer)requireId(viewer);
  if(mode!=="for_you"&&mode!=="following")throw new FeedError(422,"invalid_mode");
  if(mode==="following"&&!viewer)throw new FeedError(401,"authentication_required");
  const rows=await this.repo.list(tenant,viewer,mode,decodeCursor(cursor),21);
  const items=rows.slice(0,20);
  return {items,nextCursor:rows.length>20&&items.length>0?Buffer.from(JSON.stringify([items[items.length-1]!.publishedAt,items[items.length-1]!.id])).toString("base64url"):null};
 }
 async detail(tenant:string,viewer:string|null,id:string){requireId(tenant);requirePostId(id);
  const post=await this.repo.find(tenant,viewer,id);if(!post)throw new FeedError(404,"post_not_found");return post}
 async publish(actor:Actor,value:Publish){
  if(actor.kind==="fan"||(actor.kind==="staff"&&!actor.permissions?.includes("content_editor"))||(actor.kind==="masana"&&(!actor.approved||actor.id!==value.authorMasanaId)))throw new FeedError(403,"masana_only_publish");
  requireId(actor.tenantId);requireId(value.authorMasanaId);
  if(!await this.approvedMasana(actor.tenantId,value.authorMasanaId))throw new FeedError(403,"masana_not_approved");
  if(!key.test(value.idempotencyKey))throw new FeedError(422,"invalid_idempotency_key");
  if(!["text","image","audio"].includes(value.kind))throw new FeedError(422,"invalid_post_kind");
  const media=value.media??[];
  if(!Array.isArray(media)||media.length>(value.kind==="image"?10:value.kind==="audio"?1:0)||(value.kind!=="text"&&media.length===0)||
    media.some(x=>typeof x!=="string"||!/^media_[A-Za-z0-9_-]{8,128}$/.test(x)))throw new FeedError(422,"invalid_media_reference");
  if((value.kind==="text"&&!value.body.trim())||value.body.length>5000||(value.transcript?.length??0)>15000)throw new FeedError(422,"invalid_post_text");
  if(value.kind==="audio"&&!value.transcript?.trim())throw new FeedError(422,"audio_transcript_required");
  for(const mediaId of media){if(!await this.approvedMedia(actor.tenantId,value.authorMasanaId,mediaId))throw new FeedError(403,"media_not_approved");}
  return this.repo.publish(actor.tenantId,actor.id,{...value,body:value.body.trim(),media,transcript:value.transcript??null});
 }
 private fan(actor:Actor){if(actor.kind!=="fan")throw new FeedError(403,"fan_only_action");requireId(actor.tenantId);requireId(actor.id);return actor.id}
 async like(actor:Actor,post:string,enabled:boolean){const fan=this.fan(actor);requirePostId(post);
  await this.detail(actor.tenantId,fan,post);return this.repo.setLike(actor.tenantId,fan,post,enabled)}
 async save(actor:Actor,post:string,enabled:boolean){const fan=this.fan(actor);requirePostId(post);
  await this.detail(actor.tenantId,fan,post);return this.repo.setSave(actor.tenantId,fan,post,enabled)}
 async comment(actor:Actor,post:string,body:string,idempotencyKey:string,isNewAccount:boolean,parentId?:string|null){
  const fan=this.fan(actor);requirePostId(post);if(!key.test(idempotencyKey))throw new FeedError(422,"invalid_idempotency_key");
  const text=body.trim();if(!text||text.length>1000)throw new FeedError(422,"invalid_comment");
  if(parentId!=null&&!uid.test(parentId))throw new FeedError(422,"invalid_parent_comment");
  await this.detail(actor.tenantId,fan,post);return this.repo.comment(actor.tenantId,fan,post,text,idempotencyKey,isNewAccount,parentId??null)}
 async comments(tenant:string,post:string,viewer:string|null,before?:string,sort:"newest"|"oldest"="newest"){
  await this.detail(tenant,viewer,post);if(before&&!uid.test(before))throw new FeedError(422,"invalid_cursor");
  if(sort!=="newest"&&sort!=="oldest")throw new FeedError(422,"invalid_sort");
  return this.repo.comments(tenant,post,viewer,before??null,30,sort)}
}

// A05/A06 canonical editorial lifecycle (reuses feed.posts and reviewer audit).
export {EditorialReviewService} from './review.js';
export type {EditorialPost,EditorialRepository,EditorialAction,EditorialState,DraftInput} from './review.js';
