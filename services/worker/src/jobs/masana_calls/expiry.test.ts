import {describe,it,expect,vi} from "vitest";
import {expireMasanaCalls} from "./expiry.js";
describe("J04 expired-call worker",()=>{
 it("does not touch providers when disabled",async()=>{
   const claimExpired=vi.fn(async()=>[]);
   expect(await expireMasanaCalls({enabled:false,claimExpired,stop:vi.fn(),retryStop:vi.fn()})).toBe(0);
   expect(claimExpired).not.toHaveBeenCalled();
 });
 it("deduplicates expiry in PG and enqueues retry on failed stop",async()=>{
   const retryStop=vi.fn(async()=>{});
   const count=await expireMasanaCalls({
     enabled:true,claimExpired:async()=>[{callId:"a",roomName:"r"}],
     stop:async()=>{throw new Error("offline");},retryStop,
   });
   expect(count).toBe(1);expect(retryStop).toHaveBeenCalledWith("r","a");
 });
});
