import {describe,it,expect,vi} from "vitest";
import {dispatchTelegramInbound} from "./telegram.js";
import type {TelegramInboxStore} from "@masanawa/masana-social";
const bot={tenantId:"tenant",characterId:"masana_a",identityId:"social_bot123456",consentVersion:"v1"};
const event={...bot,fanHash:"f".repeat(64),providerEventId:"social_bot123456:42",
 encryptedRef:"private:opaque/payload123"};
function make(enabled=true,consent=true){
 const deliver=vi.fn(async()=>"accepted" as const);
 const inbox={authorizedBot:vi.fn(async()=>bot),
  canDispatch:vi.fn(async()=>consent)} as unknown as TelegramInboxStore;
 return {p:{enabled:()=>enabled,inbox,dispatch:{deliver}},deliver};
}
describe("J22 job-time consent and character isolation",()=>{
 it("blocks when disabled without contacting a provider",async()=>{
  const x=make(false);expect(await dispatchTelegramInbound(event,x.p)).toBe("disabled");
  expect(x.deliver).not.toHaveBeenCalled();
 });
 it("stops on consent revocation and cross-Masana spoofing",async()=>{
  const x=make(true,false);expect(await dispatchTelegramInbound(event,x.p)).toBe("denied");
  const y=make();expect(await dispatchTelegramInbound({...event,characterId:"masana_other"},y.p)).toBe("denied");
  expect(y.deliver).not.toHaveBeenCalled();
 });
 it("hands one opaque event to canonical dispatcher and never emits text or chat ID",async()=>{
  const x=make();expect(await dispatchTelegramInbound(event,x.p)).toBe("accepted");
  expect(x.deliver).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(x.deliver.mock.calls)).not.toMatch(/message|554433|telegram_token/);
 });
});
