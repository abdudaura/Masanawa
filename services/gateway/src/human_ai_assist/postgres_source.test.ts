import { describe, expect, it } from "vitest";
import { createPostgresHumanAiSource } from "./postgres_source.js";
const conversation="11111111-1111-4111-8111-111111111111";
const mid="22222222-2222-4222-8222-222222222222";
describe("U08 private C01/C02 SQL projection",()=>{
  it("queries exact IDs with tenant/user and accepted consent/block safety fences",async ()=>{
    const queries:{sql:string;values:unknown[]}[]=[];
    const db={query:async <T extends Record<string,unknown>>(sql:string,values:unknown[])=>{
      queries.push({sql,values});
      return {rows:[{message_id:mid,conversation_id:conversation,sender_user_id:"bob",
        body:"Hello",sequence:23,edited_at:null,peer_user_id:"bob"}] as unknown as T[]};
    }};
    const source=createPostgresHumanAiSource(db);
    const result=await source.read({tenantId:"tenant-1",userId:"alice",
      conversationId:conversation,messageIds:[mid]});
    expect(result?.[0]).toMatchObject({body:"Hello",sequence:"23",peerUserId:"bob"});
    expect(queries[0]!.values).toEqual(["tenant-1","alice",conversation,[mid]]);
    expect(queries[0]!.sql).toContain("contact.status='accepted'");
    expect(queries[0]!.sql).toContain("m.message_id=ANY($4::uuid[])");
    expect(queries[0]!.sql).toContain("m.deleted_at IS NULL");
    expect(queries[0]!.sql).toContain("blocked.blocked=true");
    expect(queries[0]!.sql).toContain("owner.state='active'");
  });
  it("does not accept partial selected message sets",async ()=>{
    const source=createPostgresHumanAiSource({
      query:async <T extends Record<string,unknown>>(_sql:string,_values:unknown[])=>({rows:[] as T[]}),
    });
    expect(await source.read({tenantId:"a",userId:"b",conversationId:conversation,messageIds:[mid]})).toBeNull();
  });
});
