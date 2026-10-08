
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerCustomerSupportRoutes } from "./routes.js";
import { createCustomerSupportService } from "./service.js";
import { CustomerAuthError } from "../customer_auth.js";

describe("U29 support HTTP route authorization", () => {
  it("blocks guest status/ticket listing, forbids unconsented ticket writes and rejects extras", async () => {
    const app=Fastify();
    const service=createCustomerSupportService({
      authorizer:{async authorize({authorizationHeader}) {
        if(authorizationHeader!=="Bearer good")throw new CustomerAuthError("UNAUTHORIZED",401);
        return {tenantId:"T",userId:"A"} as never;
      }},
      operations:{async read(){return null;}},
      tickets:{
        async create(){throw new Error("not reachable");},
        async list(){return [];},
        async read(){return null;},
      },
    });
    registerCustomerSupportRoutes(app,service);
    const anon=await app.inject({method:"GET",url:"/v1/support/tickets"});
    expect(anon.statusCode).toBe(401);
    const guessed=await app.inject({method:"POST",url:"/v1/support/operations/status",payload:{kind:"billing_quote",reference:"guessed"},headers:{authorization:"Bearer good"}});
    expect(guessed.statusCode).toBe(404);
    const noConsent=await app.inject({method:"POST",url:"/v1/support/tickets",headers:{authorization:"Bearer good"},payload:{
      requestKey:"123e4567-e89b-42d3-a456-426614174000",kind:"general",
      summary:"Please help with this account problem.",shareWithSupport:false,
    }});
    expect(noConsent.statusCode).toBe(400);
    expect(noConsent.json()).toMatchObject({error:"SUPPORT_CONSENT_REQUIRED"});
    const extras=await app.inject({method:"POST",url:"/v1/support/tickets",headers:{authorization:"Bearer good"},payload:{
      requestKey:"123e4567-e89b-42d3-a456-426614174000",kind:"general",
      summary:"Please help with this account problem.",shareWithSupport:true,refund:true,
    }});
    expect(extras.statusCode).toBe(400);
    await app.close();
  });
});
