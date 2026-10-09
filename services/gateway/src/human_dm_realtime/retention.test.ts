import {describe,expect,it} from "vitest";
import {pruneHumanDmJournal,verifyHumanDmRetentionTarget} from "./retention.js";

describe("C03 bounded private-message retention operator",()=>{
  it("preflights actual database, selected tenant and invoker permission",async()=>{
    const sql: string[]=[];
    const pool={async query(statement:string,values?:unknown[]) {
      sql.push(statement);
      expect(values).toEqual(["tenant_a"]);
      return {rows:[{
        database_name:"masanawa_test",
        database_role:"maintenance_role",
        tenant_exists:true,
        can_trim:true,
      }],rowCount:1};
    }};
    await expect(verifyHumanDmRetentionTarget({
      pool,tenantId:"tenant_a",expectedDatabase:"masanawa_test",
    })).resolves.toEqual({
      database:"masanawa_test",role:"maintenance_role",
    });
    expect(sql[0]).toContain("current_database()");
    expect(sql[0]).toContain("has_function_privilege");
  });

  it("fails closed on wrong database, deleted tenant or missing SQL privilege",async()=>{
    let called=0;
    const rows=[
      {database_name:"production",database_role:"app",tenant_exists:true,can_trim:true},
      {database_name:"masanawa_test",database_role:"app",tenant_exists:false,can_trim:true},
      {database_name:"masanawa_test",database_role:"app",tenant_exists:true,can_trim:false},
    ];
    for(const row of rows) {
      await expect(verifyHumanDmRetentionTarget({
        pool:{async query(){called++;return {rows:[row],rowCount:1};}},
        tenantId:"tenant_a",expectedDatabase:"masanawa_test",
      })).rejects.toThrow("preflight failed");
    }
    expect(called).toBe(3);
  });

  it("rejects unsafe tenant, retention age, batch and maximum before SQL",async()=>{
    let calls=0;
    const pool={async query(){calls++;return {rows:[{deleted:0}],rowCount:1};}};
    for(const options of [
      {tenantId:"",retentionDays:30},
      {tenantId:"t",retentionDays:1},
      {tenantId:"t",retentionDays:366},
      {tenantId:"t",batchSize:1001},
      {tenantId:"t",maxBatches:0},
      {tenantId:"t",retentionDays:Number.NaN},
    ]) {
      await expect(pruneHumanDmJournal({pool,...options})).rejects.toThrow();
    }
    expect(calls).toBe(0);
  });
  it("binds tenant/age and never uses a client-controlled SQL fragment",async()=>{
    const requests:unknown[][]=[];
    const pool={async query(sql:string,values?:readonly unknown[]){
      expect(sql).toContain("talks.trim_human_dm_events");
      expect(sql).not.toContain("tenant; DROP");
      requests.push([...(values??[])]);
      return {rows:[{deleted:"4"}],rowCount:1};
    }};
    const result=await pruneHumanDmJournal({
      pool,tenantId:"tenant; DROP",retentionDays:30,batchSize:50,
    });
    expect(requests).toEqual([["tenant; DROP",30,50]]);
    expect(result).toEqual({deleted:4,batches:1,possiblyMore:false});
  });
  it("propagates database failure and never advances extra batches",async()=>{
    let calls=0;
    const pool={async query(){
      calls++;
      if(calls===2)throw new Error("test transaction unavailable");
      return {rows:[{deleted:2}],rowCount:1};
    }};
    await expect(pruneHumanDmJournal({
      pool,tenantId:"tenant_a",batchSize:2,maxBatches:4,
    })).rejects.toThrow("test transaction unavailable");
    expect(calls).toBe(2);
  });
  it("rejects NULL, absent and nondecimal database replies instead of logging zero",async()=>{
    for(const raw of [null,undefined,"",true,"01",1.5,-1,1001,"0.0"]) {
      const pool={async query(){return {
        rows:[{deleted:raw}],rowCount:1,
      };}};
      await expect(pruneHumanDmJournal({
        pool,tenantId:"tenant_a",batchSize:1000,
      })).rejects.toThrow("Invalid C03 prune result");
    }
  });
  it("caps runtime and reports possible remaining journal rows",async()=>{
    let calls=0;
    const result=await pruneHumanDmJournal({
      pool:{async query(){calls++;return {rows:[{deleted:2}],rowCount:1};}},
      tenantId:"t",batchSize:2,maxBatches:3,
    });
    expect(calls).toBe(3);
    expect(result).toEqual({deleted:6,batches:3,possiblyMore:true});
  });
  it("rejects fabricated/over-limit database counts",async()=>{
    await expect(pruneHumanDmJournal({
      pool:{async query(){return {rows:[{deleted:"NaN"}],rowCount:1};}},
      tenantId:"t",
    })).rejects.toThrow("Invalid C03 prune result");
  });
});
