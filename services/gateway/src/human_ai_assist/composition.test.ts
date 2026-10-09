import {describe,it,expect} from "vitest";
import {randomBytes} from "node:crypto";
import {composeHumanAiAssist} from "./composition.js";
const conversationId="11111111-1111-4111-8111-111111111111";
const messageId="22222222-2222-4222-8222-222222222222";
describe("U08 composed canonical ports",()=>{
  it("binds header authorizer, SQL quota/source, bounded provider and C02 sender",async()=>{
    const headers:(string|undefined)[]=[];
    const sql:string[]=[];
    const sends:unknown[]=[];
    let inferenceInput:unknown;
    const service=composeHumanAiAssist({
      pool:{query:async<R extends Record<string,unknown>>(text:string)=>{
        sql.push(text);
        const rows=text.includes("INSERT INTO")?[{usage_count:1}]:[{
          message_id:messageId,conversation_id:conversationId,sender_user_id:"bob",
          body:"Only this selected message",sequence:1,edited_at:null,peer_user_id:"bob"
        }];
        return {rows:rows as unknown as R[]};
      }},
      authorizer:{authorize:async input=>{headers.push(input.authorizationHeader);return {tenantId:"t",userId:"alice"}}},
      inference:{generate:async input=>{inferenceInput=input;return {text:"Draft to review"}}},
      sender:{send:async input=>{sends.push(input);return {messageId,conversationId}}},
      reviewSecret:randomBytes(32),
    });
    const preview=await service.prepare({authorizationHeader:"Bearer alice",conversationId,
      messageIds:[messageId],purpose:"reply",language:"en",redact:"mask",disclosureConfirmed:true});
    expect(sends).toEqual([]);
    expect(sql.filter(text=>text.includes("INSERT INTO"))).toHaveLength(1);
    expect(inferenceInput).toMatchObject({input:{kind:"text"}});
    await service.sendReviewed({authorizationHeader:"Bearer alice",reviewToken:preview.reviewToken!,
      recipientUserId:"bob",reviewedBody:"My approved reply",confirmed:true});
    expect(headers).toEqual(["Bearer alice","Bearer alice","Bearer alice"]);
    expect(sends).toMatchObject([{authorizationHeader:"Bearer alice",conversationId,body:"My approved reply"}]);
  });
});
