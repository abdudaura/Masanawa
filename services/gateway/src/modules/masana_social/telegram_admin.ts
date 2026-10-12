import type {FastifyInstance,FastifyRequest} from "fastify";
import type {TelegramAuthorizationStore,TelegramCredentialVerifier,TelegramBotVault,
 VerifiedTelegramBotCredential} from "@masanawa/masana-social";
import type {TrustedStaffActor} from "./service.js";
import {TelegramIngressError} from "@masanawa/masana-social";

type JObject=Record<string,unknown>;
const object=(v:unknown):JObject=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as JObject:{};
/** Only exact official Bot API response allows staff activation; no received token is logged. */
export function createOfficialTelegramVerifier(input:{
 vault:TelegramBotVault;
 expectedWebhookUrl:(identityId:string)=>string;
 http?:typeof fetch;clock?:()=>number;
}):TelegramCredentialVerifier {
 const http=input.http??fetch,clock=input.clock??Date.now;
 return {async verify({tenantId,identityId,credentialAlias}){
  const entry=await input.vault.get({tenantId,identityId,alias:credentialAlias});
  if(!entry||!entry.webhookSecretConfigured||!/^[0-9]{6,14}:[A-Za-z0-9_-]{30,120}$/u.test(entry.token)||
     !/^vault:[a-zA-Z0-9/_-]{4,180}$/u.test(entry.authorizationRef)||
     !/^evidence:[a-zA-Z0-9/_-]{4,180}$/u.test(entry.evidenceRef))
   throw new TelegramIngressError(403,"telegram_vault_proof_missing");
  const base="https://api.telegram.org/bot"+entry.token+"/";
  async function get(method:"getMe"|"getWebhookInfo"):Promise<JObject>{
   try{
    const response=await http(base+method,{method:"GET",redirect:"error",
     signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error("provider_rejected");
    const result=object(await response.json());
    if(result.ok!==true)throw new Error("provider_denied");
    return object(result.result);
   }catch{throw new TelegramIngressError(503,"telegram_provider_verification_unavailable");}
  }
  const me=await get("getMe"),webhook=await get("getWebhookInfo");
  const expected=input.expectedWebhookUrl(identityId);
  if(typeof expected!=="string"||!expected.startsWith("https://")||
    !/^https:\/\/[a-z0-9.-]+(?::443)?\/v1\/webhooks\/telegram\/social_[A-Za-z0-9_-]{8,160}$/u.test(expected)||
    webhook.url!==expected||me.is_bot!==true||
    !Number.isSafeInteger(me.id)||Number(me.id)<=0||
    typeof me.username!=="string"||! /^[A-Za-z0-9_]{5,32}$/u.test(me.username))
    throw new TelegramIngressError(403,"telegram_bot_identity_or_webhook_mismatch");
  const checked=clock();
  return {botId:String(me.id),username:me.username,authorizationRef:entry.authorizationRef,
   evidenceRef:entry.evidenceRef,checkedAt:new Date(checked).toISOString(),
   expiresAt:new Date(checked+24*3600000).toISOString()} satisfies VerifiedTelegramBotCredential;
 }};
}
export interface TelegramStaffAuth {
 authenticateStaff(request:FastifyRequest):Promise<TrustedStaffActor|undefined>;
}
export function registerTelegramAuthorizationRoutes(app:FastifyInstance,input:{
 readonly enabled:()=>boolean;readonly auth:TelegramStaffAuth;
 readonly verifier:TelegramCredentialVerifier;readonly store:TelegramAuthorizationStore;
}):void {
 app.post("/v1/admin/masana/:characterId/telegram/:identityId/authorize",
 async(req:FastifyRequest,reply)=>{
  try{
   if(!input.enabled())throw new TelegramIngressError(410,"telegram_automation_disabled");
   const staff=await input.auth.authenticateStaff(req);
   if(!staff||staff.principalType!=="staff"||!staff.tenantId||!staff.userId||
     !staff.roles.some(r=>r==="ops_admin"||r==="super_admin"))
    throw new TelegramIngressError(403,"telegram_admin_role_denied");
   const params=object(req.params),body=object(req.body);
   const id=params.identityId,character=params.characterId;
   if(typeof id!=="string"||!/^social_[A-Za-z0-9_-]{8,160}$/u.test(id)||
     typeof character!=="string"||! /^[A-Za-z0-9_-]{4,180}$/u.test(character)||
     typeof body.credentialAlias!=="string"||
     !/^[A-Za-z0-9_-]{4,80}$/u.test(body.credentialAlias)||
     !Number.isSafeInteger(body.revision)||Number(body.revision)<1)
    throw new TelegramIngressError(422,"telegram_authorization_input_invalid");
   const bot=await input.verifier.verify({
    tenantId:staff.tenantId,identityId:id,credentialAlias:body.credentialAlias});
   const result=await input.store.authorize({
    tenantId:staff.tenantId,characterId:character,identityId:id,
    actorId:staff.userId,revision:body.revision as number,bot});
   return reply.code(200).send(result);
  }catch(e){
   if(e instanceof TelegramIngressError)return reply.code(e.status).send({code:e.code});
   const code=(e as {code?:unknown}).code;
   if(code==="SOCIAL_REVISION_CONFLICT")return reply.code(409).send({code:"social_revision_conflict"});
   if(code==="SOCIAL_NOT_FOUND")return reply.code(404).send({code:"telegram_identity_not_found"});
   if(code==="TELEGRAM_BOT_ID_MISMATCH")return reply.code(403).send({code:"telegram_identity_mismatch"});
   return reply.code(503).send({code:"telegram_authorization_unavailable"});
  }
 });
}
