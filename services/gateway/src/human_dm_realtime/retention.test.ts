import {describe,expect,it} from "vitest";
import {pruneHumanDmJournal} from "./retention.js";

describe("C03 bounded private-message retention operator",()=>{
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
      expect(sql).toContain("talks.prune_human_dm_events");
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
