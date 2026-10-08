import {describe,expect,it} from "vitest";
import {createPostgresHumanMessageRepository,type HumanMessageSqlPool} from "./postgres_repository.js";

function result<Row extends Record<string,unknown>>(data: Record<string,unknown>[] = []) {
  return {rows:data as Row[],rowCount:data.length};
}
const message={
  conversation_id:"conversation-1",message_id:"message-1",sender_user_id:"person-a",
  body:"Hello",original_digest:"a".repeat(64),created_at:"2026-10-08T11:00:00.000Z",
  edited_at:null,deleted_at:null,revision:1,
};
describe("C02 Postgres canonical human message authority",()=>{
  it("starts a pair only through the current C01 consent+block gate in its INSERT",async()=>{
    const sql: string[]=[];
    const pool: HumanMessageSqlPool={
      async query<Row extends Record<string,unknown>>(text:string,values?:unknown[]) {
        sql.push(text);
        if(text.includes("INSERT INTO talks.human_dm_conversations")) {
          expect(values).toEqual(["tenant-1","person-a","person-b","conversation-1"]);
          return result<Row>([]);
        }
        return result<Row>([]);
      },
      async connect(){throw new Error("unexpected transaction");},
    };
    const db=createPostgresHumanMessageRepository(pool);
    expect(await db.start({tenantId:"tenant-1",userId:"person-a",
      recipientUserId:"person-b",proposedId:"conversation-1"})).toBeNull();
    expect(sql).toHaveLength(1);
    expect(sql[0]).toContain("WHERE EXISTS (");
    expect(sql[0]).toContain("talks.human_dm_contact_requests");
    expect(sql[0]).toContain("talks.safety_preferences");
    expect(sql[0]).toContain("sender.state='active'");
    expect(sql[0]).toContain("recipient.state='active'");
    expect(sql[0]).toContain("LEAST($2,$3)");
    expect(sql[0]).toContain("ON CONFLICT (tenant_id,first_user_id,second_user_id)");
  });
  it("serializes send, checks live admission and commits a single durable message",async()=>{
    const calls:Array<{sql:string;values?:unknown[]}>=[];let releases=0;
    const query=async<Row extends Record<string,unknown>>(sql:string,values?:unknown[])=>{
      calls.push({sql,values});
      if(sql.includes("FROM talks.human_dm_conversations t")) return result<Row>([{exists:1}]);
      if(sql.includes("SELECT count(*)::int AS n")) return result<Row>([{n:0}]);
      if(sql.includes("SELECT conversation_id,message_id")&&sql.includes("client_request_id")) return result<Row>([]);
      if(sql.includes("INSERT INTO talks.human_dm_messages")) return result<Row>([message]);
      return result<Row>([]);
    };
    const pool: HumanMessageSqlPool={
      query,
      async connect(){return {query,release(){releases++;}};},
    };
    const db=createPostgresHumanMessageRepository(pool);
    const receipt=await db.send({
      tenantId:"tenant-1",userId:"person-a",conversationId:"conversation-1",
      clientRequestId:"request-1",messageId:"message-1",text:"Hello",digest:"a".repeat(64),
    });
    expect(receipt).toMatchObject({text:"Hello",messageId:"message-1",senderUserId:"person-a"});
    expect(calls[0]?.sql).toBe("BEGIN ISOLATION LEVEL SERIALIZABLE");
    expect(calls.some(c=>c.sql.includes("pg_advisory_xact_lock"))).toBe(true);
    expect(calls.some(c=>c.sql.includes("talks.human_dm_contact_requests"))).toBe(true);
    expect(calls.some(c=>c.sql.includes("talks.safety_preferences"))).toBe(true);
    expect(calls.map(c=>c.sql.trim()).at(-1)).toBe("COMMIT");
    expect(releases).toBe(1);
  });
  it("replay with same sender/request key never INSERTs or charges a second write",async()=>{
    let inserts=0;
    const query=async<Row extends Record<string,unknown>>(sql:string)=>{
      if(sql.includes("FROM talks.human_dm_conversations t"))return result<Row>([{}]);
      if(sql.includes("client_request_id=$3"))return result<Row>([message]);
      if(sql.includes("INSERT INTO talks.human_dm_messages"))inserts++;
      return result<Row>([]);
    };
    const db=createPostgresHumanMessageRepository({
      query,async connect(){return {query,release(){}};},
    });
    const receipt=await db.send({tenantId:"tenant-1",userId:"person-a",
      conversationId:"conversation-1",clientRequestId:"request-1",messageId:"new-message",
      text:"Hello",digest:"a".repeat(64)});
    expect(receipt?.messageId).toBe("message-1");
    expect(inserts).toBe(0);
  });
  it("idempotency collision on a different conversation or text fails before INSERT",async()=>{
    const query=async<Row extends Record<string,unknown>>(sql:string)=>{
      if(sql.includes("FROM talks.human_dm_conversations t"))return result<Row>([{}]);
      if(sql.includes("client_request_id=$3"))return result<Row>([message]);
      return result<Row>([]);
    };
    const db=createPostgresHumanMessageRepository({
      query,async connect(){return {query,release(){}};},
    });
    await expect(db.send({tenantId:"tenant-1",userId:"person-a",
      conversationId:"conversation-1",clientRequestId:"request-1",messageId:"new-message",
      text:"Tampered",digest:"b".repeat(64)})).rejects.toThrow("messages.request_id_conflict");
  });
  it("history is tenant/member guarded by the DB statement and sorted for stable pagination",async()=>{
    const queries:string[]=[];
    const pool:HumanMessageSqlPool={
      async query<Row extends Record<string,unknown>>(sql:string){
        queries.push(sql);
        if(sql.trim().startsWith("SELECT 1"))return result<Row>([{}]);
        return result<Row>([message]);
      },
      async connect(){throw new Error("unused");},
    };
    const db=createPostgresHumanMessageRepository(pool);
    const page=await db.history({tenantId:"tenant-1",userId:"person-a",
      conversationId:"conversation-1",limit:1,before:null});
    expect(page?.messages[0]?.messageId).toBe("message-1");
    expect(page?.nextCursor).toBeNull();
    expect(queries.some(sql=>sql.includes("AND EXISTS (")&&sql.includes("ORDER BY created_at DESC,message_id DESC"))).toBe(true);
    expect(queries.every(sql=>sql.includes("talks.human_dm_conversations")||sql.includes("talks.human_dm_messages"))).toBe(true);
  });
  it("edit/delete enforce ownership, revision CAS, protection and tombstone",async()=>{
    const queries:string[]=[];
    const pool:HumanMessageSqlPool={
      async query<Row extends Record<string,unknown>>(sql:string){
        queries.push(sql);
        if(sql.trim().startsWith("SELECT 1"))return result<Row>([{}]);
        return result<Row>([{...message,body:"",deleted_at:"2026-10-08T11:01:00.000Z",revision:2}]);
      },
      async connect(){throw new Error("unused");},
    };
    const db=createPostgresHumanMessageRepository(pool);
    const deleted=await db.remove({tenantId:"tenant-1",userId:"person-a",
      conversationId:"conversation-1",messageId:"message-1",expectedRevision:1});
    expect(deleted).toMatchObject({deletedAt:"2026-10-08T11:01:00.000Z",text:"",revision:2});
    const q=queries.find(x=>x.includes("UPDATE talks.human_dm_messages"))!;
    expect(q).toContain("sender_user_id=$2");
    expect(q).toContain("deleted_at IS NULL AND revision=$5");
    expect(q).toContain("AND EXISTS (");
    expect(q).toContain("SET body='',deleted_at=clock_timestamp()");
  });
});
