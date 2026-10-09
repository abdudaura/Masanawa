import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerMsnBalanceRoutes } from "./routes.js";

describe("MSN owner-scoped, read-only routes", () => {
  it("rejects anonymous reads without leaking another user balance", async () => {
    const app=Fastify();
    let called=0;
    registerMsnBalanceRoutes(app, {
      authorizer: { async authorize() { throw new Error("expired"); } },
      ledger: { async readBalance() { called++; return {asset:"MSN",spendableMicro:"1000000"}; } },
    });
    const result=await app.inject({method:"GET",url:"/v1/wallet/msn"});
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toEqual({error:"msn.auth_required"});
    expect(called).toBe(0);
    await app.close();
  });

  it("reads only the authenticated tenant/user and preserves exact micro values", async () => {
    const app=Fastify();
    const observed:string[]=[];
    registerMsnBalanceRoutes(app,{
      authorizer: { async authorize({authorizationHeader}) {
        expect(authorizationHeader).toBe("Bearer session-A");
        return {tenantId:"tenant-a",userId:"user-a"};
      }},
      ledger:{ async readBalance(tenant,user) {
        observed.push(tenant,user);
        return {asset:"MSN",spendableMicro:"12345678901234567890"};
      }},
    });
    const response=await app.inject({
      method:"GET",url:"/v1/wallet/msn",headers:{authorization:"Bearer session-A"},
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      asset:"MSN",spendableMicro:"12345678901234567890",
    });
    expect(observed).toEqual(["tenant-a","user-a"]);
    await app.close();
  });

  it("returns 503 instead of a fictitious zero for unavailable balances", async () => {
    const app=Fastify();
    registerMsnBalanceRoutes(app,{
      authorizer:{async authorize(){return {tenantId:"t",userId:"u"};}},
      ledger:{async readBalance(){throw new Error("PostgreSQL unavailable");}},
    });
    const response=await app.inject({method:"GET",url:"/v1/wallet/msn"});
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({error:"msn.balance_unavailable"});
    expect(response.body).not.toContain("PostgreSQL");
    await app.close();
  });
});
