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
  it("terminates ongoing call admission after block, contact revoke or inactive user",async()=>{
    const x=setup("ringing");
    await processHumanCallSignals(x);
    const sql=x.sql.join("\n");
    expect(sql).toContain("contact.status='accepted'");
    expect(sql).toContain("contact.revoked_by IS NULL");
    expect(sql).toContain("s.blocked=true");
    expect(sql).toContain("s.visibility IN ('blocked','restricted')");
    expect(sql).toContain("a.state='active'");
    expect(sql).toContain("b.state='active'");
    expect(sql).toContain("FOR UPDATE OF c SKIP LOCKED LIMIT $1");
    expect(sql).toContain("WHEN c.state='ringing' THEN 'cancelled' ELSE 'ended'");
    expect(sql).toContain("FROM revoked x");
  });
  it("never permanently abandons a failed room-revocation signal",async()=>{
    const x=setup("ended");
    let failures=1;
    const revoker={async closeRoom(room:string) {
      if(failures-->0)throw Error("temporary provider outage");
      x.rooms.push(room);
    }};
    expect(await processHumanCallSignals({...x,revoker})).toEqual({
      handled:0,failed:1,
    });
    expect(x.sql.join("\n")).not.toContain("attempt_count < 10");
    expect(x.sql.join("\n")).toContain("interval '5 minutes'");
    expect(await processHumanCallSignals({...x,revoker})).toEqual({
      handled:1,failed:0,
    });
    expect(x.rooms).toEqual(["human-call_opaque-uuid"]);
    expect(x.push).toEqual(["42"]);
  });

});
