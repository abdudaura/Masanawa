import {createHash,createHmac,timingSafeEqual} from "node:crypto";

/** Telegram's official webhook JSON is untrusted, even with a configured secret. */
export interface TelegramPrivateUpdate {
 readonly updateId:number;
 readonly chatId:string;
 readonly text:string;
 readonly command:"start"|"agree"|"stop"|null;
}
export class TelegramIngressError extends Error {
 constructor(readonly status:400|403|410|422|503,readonly code:string){super(code);}
}
const obj=(v:unknown):Record<string,unknown> =>
 v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function parseTelegramPrivateUpdate(body:unknown):TelegramPrivateUpdate {
 const v=obj(body),m=obj(v.message),chat=obj(m.chat),from=obj(m.from);
 const id=v.update_id,chatId=chat.id;
 if(!Number.isSafeInteger(id)||Number(id)<0)throw new TelegramIngressError(422,"telegram_update_id_invalid");
 if(chat.type!=="private"||!Number.isSafeInteger(chatId)||
   !Number.isSafeInteger(from.id)||from.is_bot===true||from.id!==chatId)
   throw new TelegramIngressError(403,"telegram_private_fan_required");
 const t=m.text;
 if(typeof t!=="string"||t.length<1||t.length>4096||t.includes("\u0000"))
   throw new TelegramIngressError(422,"telegram_text_required");
 const text=t.trim();
 if(!text)throw new TelegramIngressError(422,"telegram_text_required");
 const cmd=/^\/(start|agree|stop)(?:@[A-Za-z_0-9]{5,32})?(?:\s|$)/u.exec(text)?.[1]??null;
 return {updateId:id as number,chatId:String(chatId),text,
  command:cmd==="start"||cmd==="agree"||cmd==="stop"?cmd:null};
}
/** Secrets come from the server vault, never from route/query/identity records. */
export function validTelegramSecret(expected:string|undefined,received:unknown):boolean{
 if(!expected||expected.length<32||expected.length>256||
    !/^[A-Za-z0-9_-]+$/u.test(expected)||typeof received!=="string"||
    received.length<32||received.length>256||!/^[A-Za-z0-9_-]+$/u.test(received))return false;
 const a=createHash("sha256").update(expected).digest();
 const b=createHash("sha256").update(received).digest();
 return timingSafeEqual(a,b);
}
/** Hash the external Telegram ID with an independent server-only HMAC key. */
export function telegramFanHash(tenant:string,identity:string,chatId:string,key:string):string{
 if(!tenant||!identity||!/^\d{1,20}$/u.test(chatId)||key.length<32)
  throw new TelegramIngressError(503,"telegram_fan_key_unavailable");
 return createHmac("sha256",key).update(JSON.stringify([tenant,identity,chatId])).digest("hex");
}
export function telegramEventId(identity:string,updateId:number):string{
 if(!/^[A-Za-z0-9_-]{4,180}$/u.test(identity)||!Number.isSafeInteger(updateId)||updateId<0)
  throw new TelegramIngressError(422,"telegram_event_invalid");
 return identity+":"+updateId;
}
