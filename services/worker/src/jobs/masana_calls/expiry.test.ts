import {describe,it,expect,vi} from "vitest";
import {expireMasanaCalls,reconcileMasanaCallStops} from "./expiry.js";
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
 it("retries unacknowledged remote room stop after provider outage",async()=>{
   const claimPendingStops=vi.fn(async()=>[
     {tenantId:"tenant-a",callId:"call-a",roomName:"masana-a"},
   ]);
   const ackStop=vi.fn(async()=>{});
   const down=await reconcileMasanaCallStops({enabled:true,claimPendingStops,
     stop:async()=>{throw new Error("disconnected");},ackStop});
   expect(down).toEqual({attempted:1,confirmed:0});
   expect(ackStop).not.toHaveBeenCalled();
   const good=await reconcileMasanaCallStops({enabled:true,claimPendingStops,
     stop:async()=>{},ackStop});
   expect(good).toEqual({attempted:1,confirmed:1});
   expect(ackStop).toHaveBeenCalledWith({tenantId:"tenant-a",callId:"call-a"});
 });

});
