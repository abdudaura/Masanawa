import { describe,it,expect } from "vitest";
import { createPostgresHumanDmRepository, type HumanDmPool } from "./postgres_repository.js";

const cid="11111111-1111-4111-8111-111111111111";
function harness(responder:(sql:string)=>Record<string,unknown>[]){
  const calls:Array<{sql:string;values:unknown[]}>=[],lifecycle:string[]=[];
  const query=async <R extends Record<string,unknown>>(sql:string,values:unknown[]=[])=>
    {calls.push({sql,values});if(["BEGIN","COMMIT","ROLLBACK"].includes(sql))lifecycle.push(sql);
      const rows=responder(sql) as R[];return{rows,rowCount:rows.length};};
  const pool:HumanDmPool={query,async connect(){return{query,release(){lifecycle.push("RELEASE");}};}};
  return{repo:createPostgresHumanDmRepository(pool),calls,lifecycle};
}
describe("C02 SQL authorization and transactional safety",()=>{
  it("denies nonmember before mutation and always releases a transaction",async()=>{
    const h=harness(()=>[]);
    expect(await h.repo.send({tenantId:"tenant_a",userId:"user_a",
      conversationId:cid,body:"hello",sha256:"a".repeat(64),clientRequestId:"request_0123456789"})).toBe("forbidden");
    expect(h.lifecycle).toEqual(["BEGIN","COMMIT","RELEASE"]);
    expect(h.calls.some(x=>x.sql.includes("INSERT INTO talks.human_dm_messages"))).toBe(false);
    expect(h.calls[1]?.values).toEqual(["tenant_a",cid,"user_a"]);
  });
  it("inbox checks cross-user blocks, active accounts and platform restrictions",async()=>{
    const h=harness(()=>[]);
    await h.repo.inbox({tenantId:"tenant_a",userId:"user_a",limit:40});
    const {sql,values}=h.calls[0]!;
    expect(sql).toContain("talks.safety_preferences");
    expect(sql).toContain("revoked.status=\u0027declined\u0027");
    expect(sql).toContain("talks.safety_enforcement");
    expect(sql).toContain("a.state='active'");
    expect(sql).toContain("b.state='active'");
    expect(values).toEqual(["tenant_a","user_a",null,40]);
    expect(sql).toContain("other_profile.display_name");
  });
  it("open checks current accepted-or-anyone consent and unordered unique pair",async()=>{
    const h=harness((sql)=>sql.includes("SELECT 1 FROM identity.users me")?[]:[]);
    expect(await h.repo.open({tenantId:"tenant_a",userId:"user_a",otherUserId:"user_b"})).toBeNull();
    expect(h.calls.some(x=>x.sql.includes("admission_policy"))).toBe(true);
    expect(h.calls.some(x=>x.sql.includes("LEAST($2,$3)"))).toBe(true);
    expect(h.calls.some(x=>x.sql.includes("INSERT INTO talks.human_dm_conversations"))).toBe(false);
  });
  it("read receipt authorizes the SAME statement as the upsert and clamps the cursor",async()=>{
    const h=harness((sql)=>sql.includes("INSERT INTO talks.human_dm_reads")?
      [{last_read_sequence:"99"}]:[]);
    expect(await h.repo.read({tenantId:"tenant_a",userId:"user_a",
      conversationId:cid,throughSequence:"999"})).toBe("99");
    // No authorization preflight statement (nor a separate BEGIN/COMMIT).
    expect(h.calls).toHaveLength(1);
    expect(h.lifecycle).toEqual([]);
    const {sql,values}=h.calls[0]!;
    expect(sql).toContain("INSERT INTO talks.human_dm_reads");
    expect(sql).toContain("LEAST(c.last_sequence,$4::bigint)");
    expect(sql).toContain("GREATEST(");
    expect(sql).toContain("talks.human_dm_reads.last_read_sequence");
    expect(sql).toContain("c.tenant_id=$1 AND c.conversation_id=$3");
    expect(sql).toContain("$2 IN (c.first_user_id,c.second_user_id)");
    expect(sql).toContain("a.state='active'");
    expect(sql).toContain("b.state='active'");
    expect(sql).toContain("revoked.status='declined'");
    expect(sql).toContain("talks.safety_preferences");
    expect(sql).toContain("sp.blocked=true");
    expect(sql).toContain("talks.safety_enforcement");
    expect(sql).toContain("se.visibility IN ('restricted','blocked')");
    expect(values).toEqual(["tenant_a","user_a",cid,"999"]);
  });
  it("read receipt returns unavailable without a second statement or unauthorised write",async()=>{
    const h=harness(()=>[]); // SQL CTE/WHERE vetoes absent, blocked or revoked member
    expect(await h.repo.read({tenantId:"tenant_a",userId:"outsider",
      conversationId:cid,throughSequence:"15"})).toBeNull();
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.sql).toContain("WHERE");
    expect(h.calls[0]!.sql).toContain("NOT EXISTS");
  });
  it("read receipt preserves database failures and never reports a successful ack",async()=>{
    const h=harness(sql=>{if(sql.includes("INSERT INTO talks.human_dm_reads"))throw new Error("db down");return[];});
    await expect(h.repo.read({tenantId:"tenant_a",userId:"user_a",
      conversationId:cid,throughSequence:"3"})).rejects.toThrow("db down");
    expect(h.calls).toHaveLength(1);
  });
  it("rolls back and releases the client on SQL failure",async()=>{
    const h=harness(sql=>{if(sql.includes("SELECT user_id FROM identity.users"))throw new Error("db down");return[];});
    await expect(h.repo.open({tenantId:"tenant_a",userId:"user_a",otherUserId:"user_b"})).rejects.toThrow("db down");
    expect(h.lifecycle).toEqual(["BEGIN","ROLLBACK","RELEASE"]);
  });
});
