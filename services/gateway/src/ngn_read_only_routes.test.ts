import {afterEach,describe,expect,it,vi} from "vitest";
import {createGatewayApp} from "./app.js";
const apps: Array<ReturnType<typeof createGatewayApp>>=[];
afterEach(async()=>{await Promise.all(apps.splice(0).map(x=>x.close()));});
describe("authenticated NGN readback independent of checkout activation",()=>{
 it("serves verified balance with billing disabled, without exposing funding writes",async()=>{
  const read=vi.fn(async (header:string|undefined)=>{
   if(header!=="Bearer customer-one")throw new Error("financial.auth.unauthorized");
   return 175025;
  });
  const app=createGatewayApp({ngnReadOnlyBalance:read});apps.push(app);
  const authorized=await app.inject({method:"GET",url:"/v1/wallet/ngn",
   headers:{authorization:"Bearer customer-one"}});
  expect(authorized.statusCode).toBe(200);
  expect(authorized.json()).toEqual({balanceKobo:175025,balance:"1750.25"});
  expect(read).toHaveBeenCalledTimes(1);
  const outsider=await app.inject({method:"GET",url:"/v1/wallet/ngn"});
  expect(outsider.statusCode).toBe(401);
  expect(outsider.json()).toEqual({error:"wallet_unavailable"});
  const forbiddenWrite=await app.inject({method:"POST",url:"/v1/wallet/ngn/funding",
   payload:{amount:"100.00"}});
  expect(forbiddenWrite.statusCode).toBe(404);
 });
 it("rejects invented, fractional and negative balances",async()=>{
  const app=createGatewayApp({ngnReadOnlyBalance:async()=>-1});apps.push(app);
  const result=await app.inject({method:"GET",url:"/v1/wallet/ngn"});
  expect(result.statusCode).toBe(503);
  expect(result.json()).toEqual({error:"wallet_unavailable"});
 });
});
