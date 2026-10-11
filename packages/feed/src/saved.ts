import type {Actor} from "./index.js";

export type SavedKind="post"|"video";
export type SavedCursor={at:string;kind:SavedKind;id:string};
export type SavedItem={
  kind:SavedKind; id:string; savedAt:string;
  post?:Record<string,unknown>; video?:Record<string,unknown>;
};
export interface SavedRepository {
  list(tenantId:string,fanId:string,before:SavedCursor|null,limit:number):Promise<readonly SavedItem[]>;
  setVideoSaved(tenantId:string,fanId:string,videoId:string,enabled:boolean):Promise<boolean>;
}
export class SavedError extends Error {
  constructor(readonly status:number,readonly code:string){super(code);}
}
const actorId=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fanOnly(actor:Actor):{tenant:string;fan:string}{
  if(actor.kind!=="fan")throw new SavedError(403,"fan_only_action");
  if(!actorId.test(actor.tenantId)||!actorId.test(actor.id))throw new SavedError(403,"invalid_principal");
  return {tenant:actor.tenantId,fan:actor.id};
}
function decode(value?:string):SavedCursor|null {
  if(value===undefined||value==="")return null;
  if(value.length>240||!/^[A-Za-z0-9_-]+$/.test(value))throw new SavedError(422,"invalid_cursor");
  try {
    const v:unknown=JSON.parse(Buffer.from(value,"base64url").toString("utf8"));
    if(!Array.isArray(v)||v.length!==3||typeof v[0]!=="string"||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/.test(v[0])||\n      !Number.isFinite(Date.parse(v[0]))||(v[1]!=="post"&&v[1]!=="video")||
      typeof v[2]!=="string"||!uuid.test(v[2]))throw Error("invalid");
    return {at:v[0],kind:v[1],id:v[2]};
  } catch {throw new SavedError(422,"invalid_cursor");}
}
export class SavedLibraryService {
  constructor(private readonly repository:SavedRepository){}
  async list(actor:Actor,cursor?:string){
    const {tenant,fan}=fanOnly(actor);
    const rows=await this.repository.list(tenant,fan,decode(cursor),21);
    const items=rows.slice(0,20);
    const last=items.at(-1);
    return {items,nextCursor:rows.length>20&&last?
      Buffer.from(JSON.stringify([last.savedAt,last.kind,last.id])).toString("base64url"):null};
  }
  async saveVideo(actor:Actor,videoId:string,enabled:boolean){
    const {tenant,fan}=fanOnly(actor);
    if(!uuid.test(videoId))throw new SavedError(422,"invalid_video_id");
    if(typeof enabled!=="boolean")throw new SavedError(422,"invalid_saved_state");
    const saved=await this.repository.setVideoSaved(tenant,fan,videoId,enabled);
    if(enabled&&!saved)throw new SavedError(404,"approved_video_not_found");
    return {saved};
  }
}
