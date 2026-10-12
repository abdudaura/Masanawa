import {describe,it,expect} from "vitest";
import {parseTelegramPrivateUpdate,validTelegramSecret,telegramFanHash,telegramEventId} from "./telegram.js";
const input={update_id:42,message:{text:"/agree",chat:{id:123456,type:"private"},from:{id:123456,is_bot:false}}};
describe("J22 Telegram authenticated private inbound boundary",()=>{
 it("parses only a real private fan message",()=>{
  expect(parseTelegramPrivateUpdate(input).command).toBe("agree");
  expect(parseTelegramPrivateUpdate({...input,message:{...input.message,text:"hello"}}).command).toBeNull();
 });
 it("rejects groups, bot messages, mismatched senders and unsafe text",()=>{
  for(const message of [
   {...input.message,chat:{id:123456,type:"group"}},
   {...input.message,from:{id:999,is_bot:false}},
   {...input.message,from:{id:123456,is_bot:true}},
   {...input.message,text:"x".repeat(4097)},
  ])expect(()=>parseTelegramPrivateUpdate({...input,message})).toThrow();
 });
 it("denies malformed/absent or forged webhook secrets without weak equality",()=>{
  const good="AbC0123_random_SECURE_webhook_key_more_than32";
  expect(validTelegramSecret(good,good)).toBe(true);
  expect(validTelegramSecret(good,good+"a")).toBe(false);
  expect(validTelegramSecret(good,undefined)).toBe(false);
  expect(validTelegramSecret("short","short")).toBe(false);
 });
 it("isolates fan hashes by bot and tenant and never includes raw ID",()=>{
  const key="local_test_key_with_more_than_32_chars_123";
  const a=telegramFanHash("t1","social_first","123456",key);
  expect(a).toMatch(/^[0-9a-f]{64}$/u);
  expect(a).not.toContain("123456");
  expect(a).not.toBe(telegramFanHash("t1","social_second","123456",key));
  expect(a).not.toBe(telegramFanHash("t2","social_first","123456",key));
  expect(telegramEventId("social_first",42)).toBe("social_first:42");
 });
});
