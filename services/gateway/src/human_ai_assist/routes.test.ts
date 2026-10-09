import Fastify from "fastify";
import {describe,it,expect} from "vitest";
import {registerHumanAiAssistRoutes} from "./routes.js";
import {createHumanAiAssistService,HumanAiAssistError} from "./service.js";
import {randomBytes} from "node:crypto";

const conversationId="11111111-1111-4111-8111-111111111111";
const messageId="22222222-2222-4222-8222-222222222222";
const prepare={conversationId,messageIds:[messageId],purpose:"reply",language:"en",
  redact:"mask",disclosureConfirmed:true};
function setup(removeAdditional: boolean) {
  const headers:(string|undefined)[]=[];
  const sends:unknown[]=[];
  const app=Fastify({ajv:{customOptions:{removeAdditional}}});
  const service=createHumanAiAssistService({
    identity:{authorize:async header=>{
      headers.push(header);
      if(header!=="Bearer alice")throw new HumanAiAssistError("assist.unauthorized",401);
      return {tenantId:"tenant",userId:"alice"};
    }},
    source:{read:async()=>[{messageId,conversationId,senderUserId:"bob",body:"Hi",
      sequence:"1",editedAt:null,peerUserId:"bob"}]},
    budget:{reserve:async()=>true}, generator:{generate:async()=> "Reviewed draft"},
    sender:{send:async input=>{sends.push(input);return {messageId,conversationId}}},
    reviewSecret:randomBytes(32),
  });
  registerHumanAiAssistRoutes(app,service);
  return {app,headers,sends};
}
describe("U08 HTTP authority and canonical reviewed send",()=>{
  it.each([true,false])("rejects unknown authority before validation (removeAdditional=%s)",async mode=>{
    const d=setup(mode);
    try {
      for(const extra of [{authorizationHeader:"Bearer alice"},{tenantId:"forged"},{senderUserId:"bob"}]){
        const response=await d.app.inject({method:"POST",url:"/messages/ai/prepare",
          headers:{authorization:"Bearer alice"},payload:{...prepare,...extra}});
        expect(response.statusCode).toBe(400);
        expect(response.headers["cache-control"]).toBe("private, no-store");
      }
      expect(d.headers).toEqual([]);
      expect(d.sends).toEqual([]);
    }finally{await d.app.close()}
  });
  it("requires the genuine bearer and forwards its identity through prepare and send",async()=>{
    const d=setup(true);
    try{
      const denied=await d.app.inject({method:"POST",url:"/messages/ai/prepare",payload:prepare});
      expect(denied.statusCode).toBe(401);
      expect(denied.headers["cache-control"]).toBe("private, no-store");
      const response=await d.app.inject({method:"POST",url:"/messages/ai/prepare",
        headers:{authorization:"Bearer alice"},payload:prepare});
      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      const {reviewToken}=response.json<{reviewToken:string}>();
      const body={reviewToken,recipientUserId:"bob",reviewedBody:"My reviewed reply",confirmed:true};
      expect((await d.app.inject({method:"POST",url:"/messages/ai/send-reviewed",
        headers:{authorization:"Bearer alice"},payload:{...body,authorizationHeader:"Bearer other"}})).statusCode).toBe(400);
      const sent=await d.app.inject({method:"POST",url:"/messages/ai/send-reviewed",
        headers:{authorization:"Bearer alice"},payload:body});
      expect(sent.statusCode).toBe(200);
      expect(sent.headers["cache-control"]).toBe("private, no-store");
      expect(sent.json()).toEqual({messageId,conversationId});
      expect(d.sends).toHaveLength(1);
      expect(d.sends[0]).toMatchObject({authorizationHeader:"Bearer alice",body:"My reviewed reply"});
    }finally{await d.app.close()}
  });
});
