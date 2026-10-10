import {describe,expect,it} from "vitest";
import {createPostgresHumanAiBudget} from "./postgres_budget.js";
describe("U08 bounded inference cost",()=>{
  it("scopes hourly budget to verified active identity and atomic conflict counter",async ()=>{
    const queries:{sql:string;params:readonly unknown[]}[]=[];
    const budget=createPostgresHumanAiBudget({query:async <R extends Record<string,unknown>>(sql:string,params:readonly unknown[])=>{
      queries.push({sql,params});return {rows:[{usage_count:1}] as unknown as R[]};
    }});
    expect(await budget.reserve({tenantId:"t-1",userId:"u-1"})).toBe(true);
    expect(queries[0]!.params).toEqual(["t-1","u-1"]);
    expect(queries[0]!.sql).toContain("u.state='active'");
    expect(queries[0]!.sql).toContain("ON CONFLICT");
    expect(queries[0]!.sql).toContain("quota.usage_count < 20");
  });
  it("refuses a depleted budget rather than inferring without a reservation",async ()=>{
    const budget=createPostgresHumanAiBudget({query:async <R extends Record<string,unknown>>()=>({rows:[] as R[]})});
    expect(await budget.reserve({tenantId:"t",userId:"u"})).toBe(false);
  });
  it("propagates missing DB/migration error (never allow by default)",async ()=>{
    const budget=createPostgresHumanAiBudget({query:async <R extends Record<string,unknown>>():Promise<{rows:R[]}>=>{
      throw Error("relation talks.human_ai_assist_quota does not exist");
    }});
    await expect(budget.reserve({tenantId:"t",userId:"u"})).rejects.toThrow(/does not exist/);
  });
});
