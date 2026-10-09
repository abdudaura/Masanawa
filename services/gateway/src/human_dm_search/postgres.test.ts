import {describe,it,expect} from "vitest";
import {createPostgresHumanDmSearch} from "./postgres.js";

const input={tenantId:"t",userId:"actor",text:"%_financial",conversationId:null,before:null,limit:21};
describe("U11 read-only SQL authorizer",()=>{
  it.each(["conversations-472","threads-475"] as const)(
    "binds every user value and checks current consent, reciprocal blocks and tombstones in %s",
    async dialect=>{
      const sql:string[]=[];
      const params:unknown[][]=[];
      let releases=0;
      const pool={connect:async()=>({
        query:async(query:string,args?:unknown[])=>{
          sql.push(query); if(args)params.push(args); return {rows:[]};
        },release:()=>{releases++;}
      })};
      const repo=createPostgresHumanDmSearch(pool,dialect);
      expect(await repo.search(input)).toEqual([]);
      expect(sql[0]).toContain("READ ONLY");
      expect(sql[1]).toContain("statement_timeout");
      expect(sql[2]).toContain("edge.status='accepted'");
      expect(sql[2]).toContain("block.blocked=true");
      expect(sql[2]).toContain("m.deleted_at IS NULL");
      expect(sql[2]).toContain("strpos(lower(m.body),lower($4::text))>0");
      expect(sql[2]).not.toContain("%_financial");
      expect(params[0]).toEqual(["t","actor",null,"%_financial",null,null,21]);
      expect(sql[3]).toBe("COMMIT");
      expect(releases).toBe(1);
    });
  it("rolls back and releases a timed-out private query without retaining results",async()=>{
    const statements:string[]=[];let releases=0;
    const pool={connect:async()=>({
      query:async(query:string)=>{
        statements.push(query);
        if(query.startsWith("SELECT")) throw Error("timeout");
        return {rows:[]};
      },release:()=>{releases++;}
    })};
    const repo=createPostgresHumanDmSearch(pool,"conversations-472");
    await expect(repo.search(input)).rejects.toThrow("timeout");
    expect(statements.at(-1)).toBe("ROLLBACK");
    expect(releases).toBe(1);
  });
  it("does not allow unreviewed schema names or dynamic table SQL",()=>{
    expect(()=>createPostgresHumanDmSearch({connect:async()=>{throw Error("not connected");}},
      "unsafe" as never)).toThrow();
  });
});
