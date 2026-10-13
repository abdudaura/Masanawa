import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerMsnFundingStatusRoutes } from "./funding_routes.js";
import type { MsnFundingStatus } from "./quote_journal.js";

const row: MsnFundingStatus = {
  quoteId:"quote-1",fundingRail:"NGN_FLUTTERWAVE",
  fundingReference:"fund-1",ngnFundingKobo:"15025",
  backingAsset:"USDTTRC20",backingNetwork:"tron",
  state:"fiat_verified_backing_pending",issuedMsnMicro:null,
  issuedAt:"2026-10-13T09:00:00.000Z",expiresAt:"2026-10-13T10:00:00.000Z",
};
describe("Msn funding status authenticated read-only routes",()=>{
  it("never exposes funding to an unauthenticated customer",async()=>{
    const app=Fastify();let reads=0;
    registerMsnFundingStatusRoutes(app,{
      authorizer:{async authorize(){throw Error("expired");}},
      reader:{async listStatus(){reads++;return [row];}},
    });
    const reply=await app.inject({method:"GET",url:"/v1/wallet/msn/funding"});
    expect(reply.statusCode).toBe(401);
    expect(reply.json()).toEqual({error:"msn.funding.auth_required"});
    expect(reads).toBe(0);
    await app.close();
  });
  it("reads only authenticated principal, never request body or query account",async()=>{
    const app=Fastify();
    const seen:string[]=[];
    registerMsnFundingStatusRoutes(app,{
      authorizer:{async authorize({authorizationHeader}){
        expect(authorizationHeader).toBe("Bearer tokenA");
        return {tenantId:"tenantA",userId:"fanA"};
      }},
      reader:{async listStatus(tenant,user){seen.push(tenant,user);return [row];}},
    });
    const reply=await app.inject({
      method:"GET",url:"/v1/wallet/msn/funding?tenantId=attacker&userId=other",
      headers:{authorization:"Bearer tokenA"},
    });
    expect(reply.statusCode).toBe(200);
    expect(reply.json()).toEqual({items:[row]});
    expect(seen).toEqual(["tenantA","fanA"]);
    await app.close();
  });
  it("returns genuine empty list without manufacturing funds",async()=>{
    const app=Fastify();
    registerMsnFundingStatusRoutes(app,{
      authorizer:{async authorize(){return {tenantId:"t",userId:"u"};}},
      reader:{async listStatus(){return [];}},
    });
    const response=await app.inject({method:"GET",url:"/v1/wallet/msn/funding"});
    expect(response.json()).toEqual({items:[]});
    await app.close();
  });
  it("fails closed for PostgreSQL outages without leaking connection details",async()=>{
    const app=Fastify();
    registerMsnFundingStatusRoutes(app,{
      authorizer:{async authorize(){return {tenantId:"t",userId:"u"};}},
      reader:{async listStatus(){throw Error("db password leaked");}},
    });
    const response=await app.inject({method:"GET",url:"/v1/wallet/msn/funding"});
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("password");
    await app.close();
  });
  it("denies malformed projection and excess rows rather than reinterpreting balances",async()=>{
    const app=Fastify();
    registerMsnFundingStatusRoutes(app,{
      authorizer:{async authorize(){return {tenantId:"t",userId:"u"};}},
      reader:{async listStatus(){return [{...row,state:"paid"} as unknown as MsnFundingStatus];}},
    });
    const response=await app.inject({method:"GET",url:"/v1/wallet/msn/funding"});
    expect(response.statusCode).toBe(503);
    await app.close();
  });
});
