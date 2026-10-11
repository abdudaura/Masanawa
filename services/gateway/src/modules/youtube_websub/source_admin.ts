import { randomUUID } from "node:crypto";
import type { VideoPrincipal } from "../external_videos/contract.js";

export interface AdminYouTubeSource {
  readonly id:string;
  readonly channelId:string;
  readonly channelName:string;
  readonly targetRegion:string;
  readonly enabled:boolean;
  readonly syncMode:"manual"|"authorized_api";
}
export interface AdminYouTubeSourceStore {
  list(tenantId:string):Promise<readonly AdminYouTubeSource[]>;
  create(input:{tenantId:string;id:string;channelId:string;channelName:string;targetRegion:string;actorId:string}):Promise<AdminYouTubeSource>;
  pause(input:{tenantId:string;id:string;actorId:string}):Promise<boolean>;
}
export class SourceAdminError extends Error {
  constructor(readonly status:number,readonly code:string){super(code);}
}
function requireStaff(actor:VideoPrincipal):{tenantId:string;actorId:string}{
  // The shared resolver must supply a real authenticated tenant and actor.
  // Reject blank/control-only authorities even when a caller's role is staff.
  if(!actor.tenantId || actor.tenantId.length>200 ||
    !actor.tenantId.trim() || /[\\u0000-\\u001f\\u007f]/u.test(actor.tenantId) ||
    !actor.actorId || !actor.actorId.trim() ||
    /[\\u0000-\\u001f\\u007f]/u.test(actor.actorId) ||
    !actor.staffRoles.some(x=>x==="content_editor"||x==="ops_admin"||x==="super_admin")){
    throw new SourceAdminError(403,"video_source_staff_required");
  }
  return {tenantId:actor.tenantId,actorId:actor.actorId};
}
export function createYouTubeSourceAdminService(store:AdminYouTubeSourceStore){
  return {
    list(actor:VideoPrincipal){
      const a=requireStaff(actor);
      return store.list(a.tenantId);
    },
    async create(actor:VideoPrincipal,payload:unknown){
      const a=requireStaff(actor);
      if(!payload||typeof payload!=="object"||Array.isArray(payload)) throw new SourceAdminError(422,"invalid_source");
      const x=payload as Record<string,unknown>;
      if(Object.keys(x).sort().join(",")!=="channelId,channelName,targetRegion") throw new SourceAdminError(422,"unexpected_source_field");
      const channelId=x.channelId,channelName=x.channelName,targetRegion=x.targetRegion;
      if(typeof channelId!=="string" || !/^UC[A-Za-z0-9_-]{22}$/u.test(channelId) ||
        typeof channelName!=="string" || !channelName.trim() || channelName.trim().length>100 ||
        typeof targetRegion!=="string" || !/^[A-Z]{2}$/u.test(targetRegion)) {
        throw new SourceAdminError(422,"invalid_source");
      }
      // This endpoint never accepts an authorization flag or credentials.
      // Source creation is manual and PAUSED until independently qualified.
      return store.create({tenantId:a.tenantId,id:randomUUID(),channelId,
        channelName:channelName.trim(),targetRegion,actorId:a.actorId});
    },
    async pause(actor:VideoPrincipal,id:string){
      const a=requireStaff(actor);
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)) throw new SourceAdminError(422,"invalid_source_id");
      const ok=await store.pause({tenantId:a.tenantId,id,actorId:a.actorId});
      if(!ok) throw new SourceAdminError(404,"source_missing");
      return {paused:true};
    },
  };
}
