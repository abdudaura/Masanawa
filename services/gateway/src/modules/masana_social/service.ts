import { randomUUID } from "node:crypto";
import {approvedPublicUrl, isSocialProvider, publicLink, type SocialStore} from "@masanawa/masana-social";

export type StaffRole = "content_editor"|"ops_admin"|"moderator"|"super_admin";
export interface TrustedStaffActor {
  readonly tenantId: string; readonly userId: string; readonly roles: readonly StaffRole[];
  readonly principalType: "staff";
}
export class SocialHttpError extends Error {
  constructor(readonly statusCode:403|404|409|422,readonly code:string,message=code){super(message);}
}
const requiredRoles: Record<"create"|"list"|"verify"|"publish"|"pause"|"resume"|"revoke"|"edit",readonly StaffRole[]> = {
  create:["ops_admin","super_admin"], list:["ops_admin","content_editor","super_admin"],
  verify:["ops_admin","super_admin"], publish:["content_editor","super_admin"],
  pause:["ops_admin","super_admin"], resume:["ops_admin","super_admin"],
  revoke:["ops_admin","super_admin"], edit:["ops_admin","super_admin"],
};
function staff(actor: TrustedStaffActor|undefined, action: keyof typeof requiredRoles):TrustedStaffActor {
  if(!actor || actor.principalType!=="staff" || !requiredRoles[action].some(r=>actor.roles.includes(r)))
    throw new SocialHttpError(403,"social_role_denied");
  if(!actor.tenantId || !actor.userId) throw new SocialHttpError(403,"social_actor_missing");
  return actor;
}
function field(value:unknown,name:string,max=160):string {
  if(typeof value!=="string" || !value.trim() || value.trim().length>max)
    throw new SocialHttpError(422,"invalid_"+name);
  return value.trim();
}
function rev(value:unknown):number{
  if(!Number.isSafeInteger(value) || Number(value)<1) throw new SocialHttpError(422,"invalid_revision");
  return Number(value);
}
function id(value:unknown):string{
  return field(value,"identity_id",180);
}
export interface SocialVerificationEvidence {
  /** Must validate durable proof for THIS tenant, character and identity (e.g. staff-attested phone ownership). */
  verify(input:Readonly<{tenantId:string;characterId:string;identityId:string;actorId:string;
    evidenceRef:string}>):Promise<boolean>;
}
export function createMasanaSocialService(store:SocialStore, evidence?:SocialVerificationEvidence){
 return {
  async publicLinks(tenantId:string, characterId:string){
    if(!tenantId || !characterId) throw new SocialHttpError(404,"masana_not_found");
    const rows=await store.publicForCharacter(tenantId,characterId);
    return {links:rows.map(publicLink).filter((x):x is NonNullable<typeof x>=>x!==null)};
  },
  async adminList(actor:TrustedStaffActor|undefined,characterId:string){
    const a=staff(actor,"list");
    return {identities:await store.adminForCharacter(a.tenantId,field(characterId,"character_id"))};
  },
  async create(actor:TrustedStaffActor|undefined,characterId:string,body:Record<string,unknown>){
    const a=staff(actor,"create");
    if(!isSocialProvider(body.provider))throw new SocialHttpError(422,"invalid_provider");
    const provider=body.provider, providerAccountId=field(body.providerAccountId,"provider_account_id"),
      handle=field(body.handle,"handle"),publicUrl=field(body.publicUrl,"public_url",400);
    let canonical:string;
    try {canonical=approvedPublicUrl(provider,providerAccountId,publicUrl);}
    catch {throw new SocialHttpError(422,"invalid_public_url");}
    return store.create({identityId:"social_"+randomUUID(),tenantId:a.tenantId,
       characterId:field(characterId,"character_id"),actorId:a.userId,provider,providerAccountId,handle,publicUrl:canonical});
  },
  async transition(actor:TrustedStaffActor|undefined,characterId:string,identityId:string,
     action:"verify"|"publish"|"pause"|"resume"|"revoke"|"edit",body:Record<string,unknown>){
    const a=staff(actor,action), revision=rev(body.revision);
    const extras:{evidenceRef?:string;providerAccountId?:string;handle?:string;publicUrl?:string}={};
    if(action==="verify") {
      extras.evidenceRef=field(body.evidenceRef,"evidence_ref",200);
      const accepted=await evidence?.verify({tenantId:a.tenantId,characterId:field(characterId,"character_id"),
        identityId:id(identityId),actorId:a.userId,evidenceRef:extras.evidenceRef});
      if(accepted!==true)throw new SocialHttpError(403,"social_evidence_unverified");
    }
    if(action==="edit"){
       extras.providerAccountId=field(body.providerAccountId,"provider_account_id");
       extras.handle=field(body.handle,"handle");
       extras.publicUrl=field(body.publicUrl,"public_url",400);
    }
    return store.transition({tenantId:a.tenantId,characterId:field(characterId,"character_id"),
      identityId:id(identityId),actorId:a.userId,revision,action,...extras});
  },
 };
}
