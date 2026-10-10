import {randomUUID} from "node:crypto";
import {assertActionTarget,choice,caseCategories,caseTargets,decisionRequiredApprovals,required,requireCaseViewer,requireModerator,CaseError,type Actor,type ActionKind,type ActionRecord,type CaseRecord,type CaseEvent,type AppealRecord,type CaseEvidence} from "@masanawa/moderation";
export type CaseSummary = CaseRecord & {events:readonly CaseEvent[];actions:readonly ActionRecord[];appeals:readonly AppealRecord[]};
export interface CaseRepository {
 create(input:CaseRecord & {clientRequestId:string}):Promise<CaseRecord>;
 find(tenantId:string,caseId:string):Promise<CaseSummary|null>;
 list(tenantId:string,reporterId:string|null,limit:number):Promise<readonly CaseRecord[]>;
 propose(action:ActionRecord,expectedCaseVersion:number):Promise<ActionRecord>;
 review(tenantId:string,caseId:string,actionId:string,reviewerId:string,approve:boolean,expectedVersion:number):Promise<ActionRecord>;
 appeal(tenantId:string,caseId:string,appealId:string,actorId:string,reason:string):Promise<void>;
 resolveAppeal(tenantId:string,caseId:string,appealId:string,actorId:string,uphold:boolean,expectedVersion:number):Promise<AppealRecord>;
 dismiss(tenantId:string,caseId:string,actorId:string,reason:string,expectedVersion:number):Promise<CaseRecord>;
}
export interface CaseAuthority {
 authorize(header:string|undefined):Promise<Actor>;
 /** Must resolve a real, readable source in the same tenant BEFORE evidence is stored. */
 canReadTarget(actor:Actor,target:{kind:typeof caseTargets[number];id:string}):Promise<boolean>;
}
export function createCaseService(options:{repository:CaseRepository;authority:CaseAuthority;now?:()=>Date;id?:()=>string}){
 const repo=options.repository;
 const now=options.now??(()=>new Date());
 const id=options.id??(()=>randomUUID());
 async function actor(header:string|undefined){return options.authority.authorize(header);}
 async function owned(header:string|undefined,caseId:string){
  const who=await actor(header);
  const rec=await repo.find(who.tenantId,required(caseId,"caseId",128));
  if(!rec)throw new CaseError("moderation.not_found",404);
  requireCaseViewer(who,rec);
  return {who,rec};
 }
 return Object.freeze({
  async report(header:string|undefined,input:{targetKind:unknown;targetId:unknown;category:unknown;details:unknown;clientRequestId:unknown}){
   const who=await actor(header);
   if(who.kind!=="fan")throw new CaseError("moderation.fan_required",403);
   const targetKind=choice(input.targetKind,caseTargets,"targetKind");
   const targetId=required(input.targetId,"targetId",128);
   if(!await options.authority.canReadTarget(who,{kind:targetKind,id:targetId}))
    throw new CaseError("moderation.target_unavailable",404);
   const t=now(),stamp=t.toISOString();
   const saved=await repo.create({
    tenantId:who.tenantId,caseId:"case_"+id(),reporterUserId:who.userId,
    targetKind,targetId,category:choice(input.category,caseCategories,"category"),
    details:input.details==null||(typeof input.details==="string"&&!input.details.trim())?"":required(input.details,"details",2000),
    clientRequestId:required(input.clientRequestId,"clientRequestId",128),
    state:"open",version:1,slaDueAt:new Date(t.getTime()+24*60*60*1000).toISOString(),
    createdAt:stamp,updatedAt:stamp
   });
   return {caseId:saved.caseId,state:saved.state};
  },
  async ownCases(header:string|undefined){
   const who=await actor(header);
   if(who.kind!=="fan")throw new CaseError("moderation.fan_required",403);
   return {cases:await repo.list(who.tenantId,who.userId,50)};
  },
  async read(header:string|undefined,caseId:string){return (await owned(header,caseId)).rec;},
  async adminCases(header:string|undefined){
   const who=await actor(header);requireModerator(who);
   return {cases:await repo.list(who.tenantId,null,100)};
  },
  async propose(header:string|undefined,caseId:string,input:{kind:unknown;reason:unknown;expectedCaseVersion:unknown;expiresAt?:unknown}){
   const {who,rec}=await owned(header,caseId);
   if(who.kind!=="gwani")requireModerator(who);
   if(["closed","dismissed"].includes(rec.state))throw new CaseError("moderation.case_closed",409);
   const kind=choice(input.kind,["hide_comment","rate_limit","room_mute","user_ban","user_unban"] as const,"kind") as ActionKind;
   assertActionTarget(kind,rec.targetKind);
   const expectedCaseVersion=Number(input.expectedCaseVersion);
   if(!Number.isSafeInteger(expectedCaseVersion)||expectedCaseVersion!==rec.version)
    throw new CaseError("moderation.version_conflict",409);
   const expiresAt=input.expiresAt===null||input.expiresAt===undefined?null:required(input.expiresAt,"expiresAt",64);
   if(expiresAt!==null && (!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=now().getTime()))
    throw new CaseError("moderation.expiry_invalid",400);
   if(["hide_comment","rate_limit","room_mute"].includes(kind) && expiresAt===null)
    throw new CaseError("moderation.expiry_required",400);
   if(decisionRequiredApprovals(kind)===2 && expiresAt!==null)
    throw new CaseError("moderation.permanent_action_review_required",400);
   return repo.propose({
    tenantId:who.tenantId,actionId:"action_"+id(),caseId:rec.caseId,
    targetKind:rec.targetKind,targetId:rec.targetId,kind,
    reason:required(input.reason,"reason",1000),state:"proposed",
    proposedBy:who.userId,approvedBy:null,secondApprovedBy:null,expiresAt,version:1
   },expectedCaseVersion);
  },
  async review(header:string|undefined,caseId:string,actionId:string,input:{approve:unknown;expectedVersion:unknown}){
   const {who}=await owned(header,caseId);requireModerator(who);
   if(typeof input.approve!=="boolean")throw new CaseError("moderation.decision_invalid",400);
   const expected=Number(input.expectedVersion);
   if(!Number.isSafeInteger(expected)||expected<1)throw new CaseError("moderation.version_invalid",400);
   return repo.review(who.tenantId,required(caseId,"caseId",128),required(actionId,"actionId",128),who.userId,input.approve,expected);
  },
  async dismiss(header:string|undefined,caseId:string,input:{reason:unknown;expectedVersion:unknown}){
   const {who}=await owned(header,caseId);requireModerator(who);
   const version=Number(input.expectedVersion);
   if(!Number.isSafeInteger(version)||version<1)throw new CaseError("moderation.version_invalid",400);
   return repo.dismiss(who.tenantId,required(caseId,"caseId",128),who.userId,
    required(input.reason,"reason",1000),version);
  },
  async reviewAppeal(header:string|undefined,caseId:string,appealId:string,input:{uphold:unknown;expectedVersion:unknown}){
   const {who}=await owned(header,caseId);requireModerator(who);
   if(typeof input.uphold!=="boolean")throw new CaseError("moderation.appeal_decision.invalid",400);
   const version=Number(input.expectedVersion);
   if(!Number.isSafeInteger(version)||version<1)throw new CaseError("moderation.version.invalid",400);
   return repo.resolveAppeal(who.tenantId,required(caseId,"caseId",128),required(appealId,"appealId",128),who.userId,input.uphold,version);
  },
  async appeal(header:string|undefined,caseId:string,reason:unknown){
   const {who,rec}=await owned(header,caseId);
   if(who.kind!=="fan"||rec.reporterUserId!==who.userId)throw new CaseError("moderation.fan_required",403);
   if(!["actioned","dismissed","closed"].includes(rec.state))throw new CaseError("moderation.appeal_not_ready",409);
   await repo.appeal(who.tenantId,rec.caseId,"appeal_"+id(),who.userId,required(reason,"reason",2000));
   return {accepted:true};
  }
 });
}
