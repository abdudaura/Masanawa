import type {FastifyInstance,FastifyRequest} from "fastify";
import {parseTelegramPrivateUpdate,telegramEventId,telegramFanHash,
 validTelegramSecret,TelegramIngressError} from "@masanawa/masana-social";
import type {TelegramInboxStore,TelegramPrivateContentStore,TelegramSecretVault} from "@masanawa/masana-social";
/** An official Telegram Bot API webhook. No unofficial personal-account session. */
export interface TelegramIngressPorts {
 readonly enabled:()=>boolean;
 readonly inbox:TelegramInboxStore;
 readonly vault:TelegramSecretVault;
 readonly privateContent:TelegramPrivateContentStore;
}
export function registerTelegramIngressRoutes(app:FastifyInstance,p:TelegramIngressPorts):void {
 app.post("/v1/webhooks/telegram/:identityId",{bodyLimit:16384},async(req:FastifyRequest,reply)=>{
  try{
   if(!p.enabled())throw new TelegramIngressError(410,"telegram_automation_disabled");
   const identity=(req.params as {identityId?:unknown}).identityId;
   if(typeof identity!=="string"||!/^social_[A-Za-z0-9_-]{8,160}$/u.test(identity))
    throw new TelegramIngressError(403,"telegram_webhook_forbidden");
   const [bot,expected]=await Promise.all([
    p.inbox.authorizedBot(identity),p.vault.webhookSecret(identity)]);
   if(!bot||bot.identityId!==identity||!validTelegramSecret(expected??undefined,
     req.headers["x-telegram-bot-api-secret-token"]))
    throw new TelegramIngressError(403,"telegram_webhook_forbidden");
   const update=parseTelegramPrivateUpdate(req.body);
   const hash=telegramFanHash(bot.tenantId,identity,update.chatId,await p.vault.fanHashKey());
   let encryptedRef:string|null=null;
   if(update.command===null && await p.inbox.isConsented(bot,hash)){
    encryptedRef=await p.privateContent.put({tenantId:bot.tenantId,identityId:identity,
      eventId:telegramEventId(identity,update.updateId),chatId:update.chatId,text:update.text});
   }
   let result;
   try{result=await p.inbox.admit(bot,update,hash,encryptedRef);}
   catch(e){
    if(encryptedRef){try{await p.privateContent.discard({tenantId:bot.tenantId,
      identityId:identity,encryptedRef});}catch{throw new TelegramIngressError(503,"telegram_private_cleanup_unavailable");}}
    throw e;
   }
   if(encryptedRef&&result!=="queued"){
    await p.privateContent.discard({tenantId:bot.tenantId,identityId:identity,encryptedRef});
   }
   // Never reflect message text, chat ID, token or private payload reference to Telegram.
   return reply.code(result==="queued"?202:200).send({ok:true});
  }catch(e){
   if(e instanceof TelegramIngressError)return reply.code(e.status).send({code:e.code});
   // Do not acknowledge unpersisted updates; Telegram will retry with same update_id.
   return reply.code(503).send({code:"telegram_ingress_unavailable"});
  }
 });
}
