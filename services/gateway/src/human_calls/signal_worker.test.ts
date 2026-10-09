import {describe,it,expect} from "vitest";
import {processHumanCallSignals} from "./signal_worker.js";

function setup(eventType="ended",failPush=false) {
  const sql:string[]=[];
  const push:string[]=[];
  const rooms:string[]=[];
  const pool={
    async query(statement:string,values?:unknown[]) {
      sql.push(statement);
      if(statement.includes("RETURNING s.signal_id"))return {
        rows:[{
          signal_id:"42",tenant_id:"tenant_x",call_id:"opaque-uuid",
          recipient_user_id:"user_b",event_type:eventType,
          lease_token:"lease-id",
        }],rowCount:1,
      };
      return {rows:[],rowCount:1};
    },
    async connect(){throw Error("not used");},
  };
  const sender={async notify(request:{idempotencyKey:string}) {
    if(failPush)throw Error("provider secret must be redacted");
    push.push(request.idempotencyKey);
  }};
  const revoker={async closeRoom(room:string){rooms.push(room);}};
  return {pool,sender,revoker,sql,push,rooms};
}
describe("C09 private call signal processing",()=>{
  it("leases, revokes media before private terminal hint, acknowledges on success",async()=>{
    const x=setup();
    const result=await processHumanCallSignals(x);
    expect(result).toEqual({handled:1,failed:0});
    expect(x.rooms).toEqual(["human-call_opaque-uuid"]);
    expect(x.push).toEqual(["42"]);
    expect(x.sql.join(" ")).toContain("lease_token=$2");
    expect(x.sql.join(" ")).toContain("FOR UPDATE SKIP LOCKED");
  });
  it("ringing delivers no media cleanup action",async()=>{
    const x=setup("ringing");
    expect(await processHumanCallSignals(x)).toEqual({handled:1,failed:0});
    expect(x.rooms).toEqual([]);
    expect(x.push).toEqual(["42"]);
  });
  it("provider failure retries by lease token without persisting sensitive errors",async()=>{
    const x=setup("ended",true);
    expect(await processHumanCallSignals(x)).toEqual({handled:0,failed:1});
    expect(x.sql.join(" ")).toContain("last_error_code='delivery_unavailable'");
    expect(x.sql.join(" ")).not.toContain("provider secret");
  });
  it("rejects unbounded worker batches",async()=>{
    const x=setup();
    await expect(processHumanCallSignals({...x,maxBatch:51})).rejects.toThrow();
    expect(x.sql).toEqual([]);
  });
});
