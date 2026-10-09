import {describe,expect,it,vi} from "vitest";
import {pruneHumanDmJournal,verifyHumanDmRetentionTarget} from "./retention.js";

// All mutation-success test doubles must exercise the same one-use preflight
// as the CLI. The mock only proves orchestration, never real PostgreSQL safety.
async function preflightedPool(tenantId:string,mutationQuery:(sql:string,values?:unknown[])=>Promise<{
  rows:Record<string,unknown>[];rowCount:number|null;
}>) {
  const pool={async query(sql:string,values?:unknown[]){
    if(sql.includes("current_database()")) return {rows:[{
      database_name:"masanawa_test",database_role:"maintenance_role",
      tenant_exists:true,can_trim:true,
    }],rowCount:1};
    return mutationQuery(sql,values);
  }};
  await verifyHumanDmRetentionTarget({pool,tenantId,expectedDatabase:"masanawa_test"});
  return pool;
}

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
    const pool=await preflightedPool("tenant; DROP",async (sql,values)=>{
      expect(sql).toContain("talks.trim_human_dm_events");
      expect(sql).not.toContain("tenant; DROP");
      requests.push([...(values??[])]);
      return {rows:[{deleted:"4"}],rowCount:1};
    });
    const result=await pruneHumanDmJournal({
      pool,tenantId:"tenant; DROP",retentionDays:30,batchSize:50,
    });
    expect(requests).toEqual([["tenant; DROP",30,50]]);
    expect(result).toEqual({deleted:4,batches:1,possiblyMore:false});
  });
  it("propagates database failure and never advances extra batches",async()=>{
    let calls=0;
    const pool=await preflightedPool("tenant_a",async()=>{
      calls++;
      if(calls===2)throw new Error("test transaction unavailable");
      return {rows:[{deleted:2}],rowCount:1};
    });
    await expect(pruneHumanDmJournal({
      pool,tenantId:"tenant_a",batchSize:2,maxBatches:4,
    })).rejects.toThrow("test transaction unavailable");
    expect(calls).toBe(2);
  });
  it("rejects NULL, absent and nondecimal database replies instead of logging zero",async()=>{
    for(const raw of [null,undefined,"",true,"01",1.5,-1,1001,"0.0"]) {
      const pool=await preflightedPool("tenant_a",async()=>({
        rows:[{deleted:raw}],rowCount:1,
      }));
      await expect(pruneHumanDmJournal({
        pool,tenantId:"tenant_a",batchSize:1000,
      })).rejects.toThrow("Invalid C03 prune result");
    }
  });
  it("caps runtime and reports possible remaining journal rows",async()=>{
    let calls=0;
    const pool=await preflightedPool("t",async()=>{
      calls++;return {rows:[{deleted:2}],rowCount:1};
    });
    const result=await pruneHumanDmJournal({
      pool,
      tenantId:"t",batchSize:2,maxBatches:3,
    });
    expect(calls).toBe(3);
    expect(result).toEqual({deleted:6,batches:3,possiblyMore:true});
  });
  it("rejects pruning before a target preflight without contacting the database",async()=>{
    let calls=0;
    const pool={async query(){calls++;return {rows:[{deleted:0}],rowCount:1};}};
    await expect(pruneHumanDmJournal({pool,tenantId:"t"}))
      .rejects.toThrow("fresh matching target preflight");
    expect(calls).toBe(0);
  });
  it("consumes one preflight, refuses replay and mismatched tenant",async()=>{
    let mutations=0;
    const pool=await preflightedPool("tenant_a",async()=>{
      mutations++;return {rows:[{deleted:0}],rowCount:1};
    });
    await expect(pruneHumanDmJournal({pool,tenantId:"tenant_b"}))
      .rejects.toThrow("fresh matching target preflight");
    await expect(pruneHumanDmJournal({pool,tenantId:"tenant_a"}))
      .rejects.toThrow("fresh matching target preflight");
    expect(mutations).toBe(0);
    await verifyHumanDmRetentionTarget({pool,tenantId:"tenant_a",expectedDatabase:"masanawa_test"});
    await expect(pruneHumanDmJournal({pool,tenantId:"tenant_a"}))
      .resolves.toEqual({deleted:0,batches:1,possiblyMore:false});
    await expect(pruneHumanDmJournal({pool,tenantId:"tenant_a"}))
      .rejects.toThrow("fresh matching target preflight");
    expect(mutations).toBe(1);
  });
  it("invalidates previous authorization before a failed recheck",async()=>{
    const pool=await preflightedPool("tenant_a",async()=>({rows:[{deleted:1}],rowCount:1}));
    await expect(verifyHumanDmRetentionTarget({
      pool,tenantId:"tenant_a",expectedDatabase:"wrong_database",
    })).rejects.toThrow("preflight failed");
    await expect(pruneHumanDmJournal({pool,tenantId:"tenant_a"}))
      .rejects.toThrow("fresh matching target preflight");
  });
  it("invalid preflight input revokes a previously valid target without another SQL call",async()=>{
    let mutations=0;
    const pool=await preflightedPool("tenant_a",async()=>{
      mutations++;return {rows:[{deleted:0}],rowCount:1};
    });
    await expect(verifyHumanDmRetentionTarget({
      pool,tenantId:"",expectedDatabase:"masanawa_test",
    })).rejects.toThrow("Incomplete C03 retention target");
    await expect(pruneHumanDmJournal({pool,tenantId:"tenant_a"}))
      .rejects.toThrow("fresh matching target preflight");
    expect(mutations).toBe(0);
  });
  it("expires a matching preflight after five minutes before SQL mutation",async()=>{
    const now=Date.now();
    const dateNow=vi.spyOn(Date,"now");
    try {
      dateNow.mockReturnValue(now);
      let mutations=0;
      const pool=await preflightedPool("tenant_a",async()=>{
        mutations++;return {rows:[{deleted:0}],rowCount:1};
      });
      dateNow.mockReturnValue(now+300001);
      await expect(pruneHumanDmJournal({pool,tenantId:"tenant_a"}))
        .rejects.toThrow("fresh matching target preflight");
      expect(mutations).toBe(0);
    } finally {
      dateNow.mockRestore();
    }
  });
  it("rejects inconsistent preflight row counts without authorization",async()=>{
    let mutations=0;
    const pool={async query(sql:string){
      if(sql.includes("current_database()"))return {rows:[{
        database_name:"masanawa_test",database_role:"maintenance_role",
        tenant_exists:true,can_trim:true,
      }],rowCount:0};
      mutations++;return {rows:[{deleted:0}],rowCount:1};
    }};
    await expect(verifyHumanDmRetentionTarget({
      pool,tenantId:"t",expectedDatabase:"masanawa_test",
    })).rejects.toThrow("preflight failed");
    await expect(pruneHumanDmJournal({pool,tenantId:"t"}))
      .rejects.toThrow("fresh matching target preflight");
    expect(mutations).toBe(0);
  });
  it("rejects fabricated/over-limit database counts",async()=>{
    const pool=await preflightedPool("t",async()=>({
      rows:[{deleted:"NaN"}],rowCount:1,
    }));
    await expect(pruneHumanDmJournal({pool,tenantId:"t"}))
      .rejects.toThrow("Invalid C03 prune result");
  });
});
