import type {TelegramInboxStore,TelegramMasanaDispatcher} from "@masanawa/masana-social";
import {TelegramIngressError} from "@masanawa/masana-social";
export interface TelegramInboundEvent {
 readonly tenantId:string;readonly characterId:string;readonly identityId:string;
 readonly fanHash:string;readonly providerEventId:string;readonly encryptedRef:string;
}
export interface TelegramInboundJobPorts {
 readonly enabled:()=>boolean;
 readonly inbox:TelegramInboxStore;
 readonly dispatch:TelegramMasanaDispatcher;
}
/** Called by the canonical events.outbox lease consumer; never self-polls or replays
 * an ambiguous provider send. It does not create a second chat/session authority. */
export async function dispatchTelegramInbound(event:TelegramInboundEvent,p:TelegramInboundJobPorts):
 Promise<"disabled"|"denied"|"accepted"|"duplicate"|"retry">{
 if(!p.enabled())return "disabled";
 if(!event.tenantId||!event.characterId||!event.identityId||
   !/^[0-9a-f]{64}$/u.test(event.fanHash)||!event.encryptedRef.startsWith("private:")||
   !event.providerEventId.startsWith(event.identityId+":"))
  throw new TelegramIngressError(422,"telegram_event_invalid");
 const bot=await p.inbox.authorizedBot(event.identityId);
 if(!bot||bot.tenantId!==event.tenantId||bot.characterId!==event.characterId||
   !await p.inbox.canDispatch(bot,event.fanHash))return "denied";
 return p.dispatch.deliver({tenantId:bot.tenantId,characterId:bot.characterId,
  identityId:bot.identityId,fanHash:event.fanHash,eventId:event.providerEventId,
  encryptedRef:event.encryptedRef});
}
