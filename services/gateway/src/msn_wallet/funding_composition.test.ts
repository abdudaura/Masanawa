import { describe,expect,it } from "vitest";
import { createGatewayApp } from "../app.js";
import type { MsnFundingStatus } from "./quote_journal.js";

const item:MsnFundingStatus={
  quoteId:"quoteA",fundingRail:"NGN_FLUTTERWAVE",fundingReference:"fundA",
  ngnFundingKobo:"15025",backingAsset:"USDTTRC20",backingNetwork:"tron",
  state:"fiat_verified_backing_pending",issuedMsnMicro:null,
  issuedAt:"2026-10-13T10:00:00.000Z",expiresAt:"2026-10-13T10:05:00.000Z",
};
describe("Gateway MSN funding readback composition",()=>{
  it("never mounts a financial status endpoint on the default app",async()=>{
    const app=createGatewayApp();
    const result=await app.inject({method:"GET",url:"/v1/wallet/msn/funding"});
    expect(result.statusCode).toBe(404);
    await app.close();
  });
  it("composes only authenticated owner-scoped readback, not fiat/issuance writes",async()=>{
    const principals:string[]=[];
    const app=createGatewayApp({
      msnFunding:{
        authorizer:{async authorize({authorizationHeader}){
          if(authorizationHeader!=="Bearer sessionA")throw Error("denied");
          return {tenantId:"tenantA",userId:"userA"};
        }},
        reader:{async listStatus(tenant,user){
          principals.push(tenant,user);
          return [item];
        }},
      },
    });
    const no=await app.inject({method:"GET",url:"/v1/wallet/msn/funding"});
    expect(no.statusCode).toBe(401);
    const yes=await app.inject({
      method:"GET",url:"/v1/wallet/msn/funding?userId=userB",
      headers:{authorization:"Bearer sessionA"},
    });
    expect(yes.statusCode).toBe(200);
    expect(yes.json()).toEqual({items:[item]});
    expect(principals).toEqual(["tenantA","userA"]);
    for(const endpoint of ["/v1/wallet/msn/funding/verify",
      "/v1/wallet/msn/funding/create","/v1/wallet/msn/issue"]){
      const response=await app.inject({method:"POST",url:endpoint,payload:{}});
      expect(response.statusCode).toBe(404);
    }
    await app.close();
  });
});
