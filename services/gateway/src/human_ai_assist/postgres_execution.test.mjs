import {PGlite} from "@electric-sql/pglite";
import {readFile} from "node:fs/promises";
import {describe,it,expect} from "vitest";
import {createPostgresHumanAiSource} from "./postgres_source.ts";
import {createPostgresHumanAiBudget} from "./postgres_budget.ts";
const conversationId="11111111-1111-4111-8111-111111111111";
const messageId="22222222-2222-4222-8222-222222222222";
// Synthetic minimum C01/C02 schema; this executes SQL, not production migrations.
async function setup(){
  const db=new PGlite();
  await db.exec(`
    CREATE SCHEMA identity; CREATE SCHEMA talks;
    CREATE TABLE identity.users(tenant_id text,user_id text,state text,PRIMARY KEY(tenant_id,user_id));
    INSERT INTO identity.users VALUES('t','alice','active'),('t','bob','active');
    CREATE TABLE talks.human_dm_conversations(tenant_id text,conversation_id uuid,first_user_id text,second_user_id text);
    CREATE TABLE talks.human_dm_messages(tenant_id text,conversation_id uuid,message_id uuid,sender_user_id text,body text,sequence bigint,edited_at timestamptz,deleted_at timestamptz);
    CREATE TABLE talks.human_dm_contact_requests(tenant_id text,first_user_id text,second_user_id text,status text,revoked_by text);
    CREATE TABLE talks.safety_preferences(tenant_id text,viewer_user_id text,subject_user_id text,blocked boolean);
    CREATE TABLE talks.public_profiles(tenant_id text,user_id text,handle text);
    CREATE TABLE talks.safety_enforcement(tenant_id text,target_kind text,target_id text,visibility text);
    INSERT INTO talks.human_dm_conversations VALUES('t','${conversationId}','alice','bob');
    INSERT INTO talks.human_dm_messages VALUES('t','${conversationId}','${messageId}','bob','Private selected text',1,NULL,NULL);
    INSERT INTO talks.human_dm_contact_requests VALUES('t','alice','bob','accepted',NULL);
    INSERT INTO talks.public_profiles VALUES('t','alice','alice'),('t','bob','bob');
  `);
  const migration=await readFile(new URL("./migrations/0001_human_ai_assist_quota_isolated.sql",import.meta.url),"utf8");
  await db.exec(migration); await db.exec(migration);
  const source=createPostgresHumanAiSource(db),budget=createPostgresHumanAiBudget(db);
  const read=(overrides={})=>source.read({tenantId:"t",userId:"alice",conversationId,messageIds:[messageId],...overrides});
  return {db,budget,read};
}
describe("U08 executed embedded PostgreSQL (synthetic schema)",()=>{
  it("reads only the selected persisted message and denies another tenant/member",async()=>{
    const d=await setup();try{
      expect(await d.read()).toMatchObject([{messageId,body:"Private selected text",peerUserId:"bob"}]);
      expect(await d.read({tenantId:"other"})).toBeNull();
      expect(await d.read({userId:"mallory"})).toBeNull();
      expect(await d.read({messageIds:[messageId,"33333333-3333-4333-8333-333333333333"]})).toBeNull();
    }finally{await d.db.close()}
  });
  it.each([
    "UPDATE talks.human_dm_contact_requests SET revoked_by='bob'",
    "UPDATE talks.human_dm_contact_requests SET status='declined'",
    "UPDATE identity.users SET state='deleted' WHERE user_id='bob'",
    "UPDATE talks.human_dm_messages SET deleted_at=clock_timestamp(),body=NULL",
    "INSERT INTO talks.safety_preferences VALUES('t','bob','alice',true)",
    "INSERT INTO talks.safety_enforcement VALUES('t','profile','bob','restricted')",
  ])("denies persisted privacy change: %s",async sql=>{
    const d=await setup();try{await d.db.exec(sql);expect(await d.read()).toBeNull()}finally{await d.db.close()}
  });
  it("bounds concurrent quota reservations, persists count and cascades erasure",async()=>{
    const d=await setup();try{
      const results=await Promise.all(Array.from({length:25},()=>d.budget.reserve({tenantId:"t",userId:"alice"})));
      expect(results.filter(Boolean)).toHaveLength(20);
      expect((await d.db.query("SELECT usage_count FROM talks.human_ai_assist_quota")).rows).toEqual([{usage_count:20}]);
      expect(await d.budget.reserve({tenantId:"wrong",userId:"alice"})).toBe(false);
      await d.db.exec("DELETE FROM identity.users WHERE user_id='alice'");
      expect((await d.db.query("SELECT * FROM talks.human_ai_assist_quota")).rows).toEqual([]);
    }finally{await d.db.close()}
  });
});
