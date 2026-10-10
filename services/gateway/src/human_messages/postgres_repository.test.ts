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
  it("edits only with same-statement sender, tenant, active-member and C01 safety grants",async()=>{
    const h=harness(sql=>sql.includes("UPDATE talks.human_dm_messages m")?
      [{conversation_id:cid,message_id:cid,sequence:"9",sender_user_id:"user_a",
        client_request_id:"request_0123456789",body:"corrected",created_at:"2026-10-08T10:00:00Z",
        edited_at:"2026-10-08T10:01:00Z",deleted_at:null}]:[]);
    const result=await h.repo.edit({tenantId:"tenant_a",userId:"user_a",messageId:cid,body:"corrected"});
    expect(result?.body).toBe("corrected");
    expect(h.calls).toHaveLength(1);
    expect(h.lifecycle).toEqual([]);
    const {sql,values}=h.calls[0]!;
    expect(sql).toContain("UPDATE talks.human_dm_messages m");
    expect(sql).toContain("FROM talks.human_dm_conversations c");
    expect(sql).toContain("m.tenant_id=$1 AND m.message_id=$3 AND m.sender_user_id=$2");
    expect(sql).toContain("c.tenant_id=m.tenant_id AND c.conversation_id=m.conversation_id");
    expect(sql).toContain("$2 IN (c.first_user_id,c.second_user_id)");
    expect(sql).toContain("a.state='active'");
    expect(sql).toContain("b.state='active'");
    expect(sql).toContain("revoked.status='declined'");
    expect(sql).toContain("sp.blocked=true");
    expect(sql).toContain("se.visibility IN ('restricted','blocked')");
    expect(sql).toContain("m.created_at>clock_timestamp()-interval '15 minutes'");
    expect(values).toEqual(["tenant_a","user_a",cid,"corrected"]);
  });
  it("refuses unauthorized edit with no preliminary grant or mutation fallback",async()=>{
    const h=harness(()=>[]);
    expect(await h.repo.edit({tenantId:"tenant_a",userId:"outsider",messageId:cid,body:"bad"})).toBeNull();
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.sql).toContain("UPDATE talks.human_dm_messages m");
    expect(h.calls[0]!.sql).toContain("$2 IN (c.first_user_id,c.second_user_id)");
    expect(h.calls[0]!.sql).toContain("talks.safety_enforcement");
  });
  it("tombstones with same-statement authorization; repeat-delete lookup remains guarded",async()=>{
    const now="2026-10-08T10:00:00Z";
    const tombstone={conversation_id:cid,message_id:cid,sequence:"9",sender_user_id:"user_a",
      client_request_id:"request_0123456789",body:null,created_at:now,edited_at:null,deleted_at:now};
    const h=harness(sql=>sql.includes("UPDATE talks.human_dm_messages m")?[tombstone]:[]);
    const deleted=await h.repo.remove({tenantId:"tenant_a",userId:"user_a",messageId:cid});
    expect(deleted?.deletedAt).toBe(now.replace("Z",".000Z"));
    expect(deleted?.body).toBeNull();
    expect(h.calls).toHaveLength(1);
    const {sql,values}=h.calls[0]!;
    expect(sql).toContain("UPDATE talks.human_dm_messages m");
    expect(sql).toContain("FROM talks.human_dm_conversations c");
    expect(sql).toContain("$2 IN (c.first_user_id,c.second_user_id)");
    expect(sql).toContain("revoked.status='declined'");
    expect(sql).toContain("sp.blocked=true");
    expect(sql).toContain("m.deleted_at IS NULL");
    expect(values).toEqual(["tenant_a","user_a",cid]);

    const retry=harness(sql=>sql.includes("m.deleted_at IS NOT NULL")?[tombstone]:[]);
    expect((await retry.repo.remove({tenantId:"tenant_a",userId:"user_a",messageId:cid}))?.body).toBeNull();
    expect(retry.calls).toHaveLength(2);
    expect(retry.calls[1]!.sql).toContain("JOIN talks.human_dm_conversations c");
    expect(retry.calls[1]!.sql).toContain("sp.blocked=true");
    expect(retry.calls[1]!.sql).toContain("a.state='active'");
  });
  it("hides unauthorized or erroring delete rather than revealing a prior tombstone",async()=>{
    const h=harness(()=>[]);
    expect(await h.repo.remove({tenantId:"tenant_a",userId:"blocked",messageId:cid})).toBeNull();
    expect(h.calls).toHaveLength(2);
    for(const call of h.calls){
      expect(call.sql).toContain("$2 IN (c.first_user_id,c.second_user_id)");
      expect(call.sql).toContain("talks.safety_preferences");
      expect(call.values).toEqual(["tenant_a","blocked",cid]);
    }
    const failing=harness(sql=>{if(sql.includes("UPDATE talks.human_dm_messages m"))throw new Error("db down");return[];});
    await expect(failing.repo.remove({tenantId:"tenant_a",userId:"user_a",messageId:cid})).rejects.toThrow("db down");
    expect(failing.calls).toHaveLength(1);
  });
  it("rolls back and releases the client on SQL failure",async()=>{
    const h=harness(sql=>{if(sql.includes("SELECT user_id FROM identity.users"))throw new Error("db down");return[];});
    await expect(h.repo.open({tenantId:"tenant_a",userId:"user_a",otherUserId:"user_b"})).rejects.toThrow("db down");
    expect(h.lifecycle).toEqual(["BEGIN","ROLLBACK","RELEASE"]);
  });
});
