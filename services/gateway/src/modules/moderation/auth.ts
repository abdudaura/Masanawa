import type {PlatformSessionIdentity} from "@masanawa/security";
import {CaseError,type Actor,type CaseTarget} from "@masanawa/moderation";
import type {CaseAuthority} from "./service.js";

export interface ModerationIdentityAdapters {
 /** Must validate platform access token server-side; never trust client role claims. */
 readonly sessions:{
  authorize(input:{authorizationHeader:string|undefined}):Promise<PlatformSessionIdentity>;
 };
 /** Canonical staff RBAC assignment lookup, scoped by both tenant and subject. */
 readonly staffRoles:{
  roles(tenantId:string,userId:string):Promise<readonly string[]>;
 };
 /** Trusted, verified service credential only. Never accept a character ID from a fan. */
 readonly gwaniPrincipal?:{
  authorizeService(header:string|undefined):Promise<{tenantId:string;userId:string}|null>;
 };
 /** Must check source existence and the fan's visibility/ownership using canonical stores. */
 readonly targetAccess:{
  canRead(actor:Actor,target:{kind:CaseTarget;id:string}):Promise<boolean>;
 };
}

/** Auth composition boundary for AF00, fail-closed on missing grants or source access. */
export function createModerationAuthority(input:ModerationIdentityAdapters):CaseAuthority{
 return Object.freeze({
  async authorize(header:string|undefined):Promise<Actor>{
   if(!header)throw new CaseError("moderation.unauthorized",401);
   // All Gwani credentials require a separate trusted service verifier. Do not
   // grant agent authority via an ordinary signed-in customer's role or alias.
   if(header.startsWith("Bearer msw_agent_")){
    if(!input.gwaniPrincipal)throw new CaseError("moderation.unauthorized",401);
    const principal=await input.gwaniPrincipal.authorizeService(header);
    if(!principal||principal.userId!=="masana-gwani")
      throw new CaseError("moderation.unauthorized",401);
    return Object.freeze({tenantId:principal.tenantId,userId:principal.userId,
      roles:[] as readonly string[],kind:"gwani" as const});
   }
   const identity=await input.sessions.authorize({authorizationHeader:header});
   const rawRoles=await input.staffRoles.roles(identity.tenantId,identity.userId);
   // Verify whitelist, not arbitrary strings supplied from a user profile.
   const roles=rawRoles.filter(role=>role==="moderator"||role==="super_admin");
   return Object.freeze({tenantId:identity.tenantId,userId:identity.userId,
    roles,kind:roles.length?"staff" as const:"fan" as const});
  },
  async canReadTarget(actor:Actor,target:{kind:CaseTarget;id:string}){
   if(actor.kind!=="fan")throw new CaseError("moderation.fan_required",403);
   try{return await input.targetAccess.canRead(actor,target)===true;}
   catch{return false;}
  }
 });
}
