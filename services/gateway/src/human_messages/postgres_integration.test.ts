import {createHash, randomUUID} from "node:crypto";
import {createPostgresPool,platformProductMigrationRoots,runMigrations,type Pool} from "@masanawa/postgres";
import {beforeAll,afterAll,describe,expect,it} from "vitest";
import {createPostgresHumanMessageRepository} from "./postgres_repository.js";

const databaseUrl=process.env.MASANAWA_C02_TEST_DATABASE_URL;
/** Never execute destructive integration fixtures against remote/production DB. */
function safeDatabase(url: string | undefined): boolean {
  if(!url||process.env.MASANAWA_C02_ENABLE_DB_TESTS!=="yes")return false;
  try {
    const parsed=new URL(url);
    return ["postgresql:","postgres:"].includes(parsed.protocol)
      && ["localhost","127.0.0.1","[::1]"].includes(parsed.hostname)
      && decodeURIComponent(parsed.pathname).endsWith("_test");
  }catch{return false;}
}
const run=safeDatabase(databaseUrl)?describe:describe.skip;
run("C02 real PostgreSQL person DM, C01 consent and concurrency",()=>{
  let pool:Pool;
  const suffix=randomUUID().replaceAll("-","").slice(0,10);
  const tenant=`c02_t_${suffix}`,otherTenant=`c02_o_${suffix}`;
  const alice=`c02_a_${suffix}`,bob=`c02_b_${suffix}`,eve=`c02_e_${suffix}`;
  const db=()=>createPostgresHumanMessageRepository(pool);
  const send=(requestId:string,conversationId:string,text="Hello")=>db().send({
    tenantId:tenant,userId:alice,conversationId,clientRequestId:requestId,
    messageId:randomUUID(),text,digest:createHash("sha256").update(text).digest("hex"),
  });
  beforeAll(async()=>{
    pool=createPostgresPool({connectionString:databaseUrl!,max:6,
      applicationName:"masanawa-c02-disposable-postgres-integration"});
    // Requires C01 0016 and C02 0017 in the SAME migration manifest.
    await runMigrations(pool,platformProductMigrationRoots());
    for(const tenantId of [tenant,otherTenant]){
      await pool.query(`INSERT INTO identity.tenants(tenant_id,created_at,updated_at)
        VALUES ($1,clock_timestamp(),clock_timestamp())`,[tenantId]);
    }
    for(const who of [alice,bob,eve]){
      await pool.query(`INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at)
        VALUES ($1,$2,clock_timestamp(),clock_timestamp())`,[tenant,who]);
    }
    for(const [who,handle] of [[alice,`alice_${suffix}`],[bob,`bob_${suffix}`],[eve,`eve_${suffix}`]]){
      await pool.query(`INSERT INTO talks.public_profiles(tenant_id,user_id,handle,display_name)
        VALUES ($1,$2,$3,$3)`,[tenant,who,handle]);
    }
    // Same C01 accepted-pair authority as real contact-accept endpoint.
    await pool.query(`INSERT INTO talks.human_dm_contact_requests
      (tenant_id,first_user_id,second_user_id,requested_by,status)
      VALUES ($1,$2,$3,$2,'accepted')`,[tenant,alice,bob]);
  },120000);
  afterAll(async()=>{
    if(!pool)return;
    try {
      for(const tenantId of [tenant,otherTenant]){
        await pool.query(`DELETE FROM talks.safety_preferences WHERE tenant_id=$1`,[tenantId]);
        await pool.query(`DELETE FROM talks.human_dm_messages WHERE tenant_id=$1`,[tenantId]);
        await pool.query(`DELETE FROM talks.human_dm_conversations WHERE tenant_id=$1`,[tenantId]);
        await pool.query(`DELETE FROM talks.human_dm_contact_requests WHERE tenant_id=$1`,[tenantId]);
        await pool.query(`DELETE FROM talks.human_dm_preferences WHERE tenant_id=$1`,[tenantId]);
        await pool.query(`DELETE FROM talks.public_profiles WHERE tenant_id=$1`,[tenantId]);
        await pool.query(`DELETE FROM identity.users WHERE tenant_id=$1`,[tenantId]);
        await pool.query(`DELETE FROM identity.tenants WHERE tenant_id=$1`,[tenantId]);
      }
    }finally{await pool.end();}
  });
  it("only an accepted pair can create one durable thread; outsiders and cross-tenant cannot read",async()=>{
    const repository=db();
    const first=await repository.start({tenantId:tenant,userId:alice,recipientUserId:bob,proposedId:randomUUID()});
    expect(first).not.toBeNull();
    const second=await repository.start({tenantId:tenant,userId:bob,recipientUserId:alice,proposedId:randomUUID()});
    expect(second?.conversationId).toBe(first?.conversationId);
    expect(await repository.start({tenantId:tenant,userId:alice,recipientUserId:eve,proposedId:randomUUID()})).toBeNull();
    expect(await repository.read({tenantId:tenant,userId:eve,conversationId:first!.conversationId})).toBeNull();
    expect(await repository.read({tenantId:otherTenant,userId:alice,conversationId:first!.conversationId})).toBeNull();
    expect((await repository.list({tenantId:tenant,userId:alice,limit:50}))).toHaveLength(1);
  });
  it("two simultaneous replay requests settle exactly one message and survive retry",async()=>{
    const conv=(await db().start({tenantId:tenant,userId:alice,recipientUserId:bob,proposedId:randomUUID()}))!;
    const requestId=`dm-${randomUUID()}`;
    const [a,b]=await Promise.all([send(requestId,conv.conversationId),send(requestId,conv.conversationId)]);
    expect(a?.messageId).toBe(b?.messageId);
    const count=await pool.query<{n:string}>(`SELECT count(*)::text AS n FROM talks.human_dm_messages
      WHERE tenant_id=$1 AND sender_user_id=$2 AND client_request_id=$3`,
      [tenant,alice,requestId]);
    expect(Number(count.rows[0]?.n)).toBe(1);
    const history=await db().history({tenantId:tenant,userId:bob,conversationId:conv.conversationId,limit:10,before:null});
    expect(history?.messages.some(m=>m.messageId===a?.messageId)).toBe(true);
    await expect(send(requestId,conv.conversationId,"Different")).rejects.toThrow("messages.request_id_conflict");
  });
  it("revoked consent and either side's safety block prevent new sends",async()=>{
    const repository=db();
    const conv=(await repository.start({tenantId:tenant,userId:alice,recipientUserId:bob,proposedId:randomUUID()}))!;
    await pool.query(`UPDATE talks.human_dm_contact_requests SET status='declined'
      WHERE tenant_id=$1 AND first_user_id=$2 AND second_user_id=$3`,[tenant,alice,bob]);
    expect(await send(randomUUID(),conv.conversationId)).toBeNull();
    await pool.query(`UPDATE talks.human_dm_contact_requests SET status='accepted'
      WHERE tenant_id=$1 AND first_user_id=$2 AND second_user_id=$3`,[tenant,alice,bob]);
    await pool.query(`INSERT INTO talks.safety_preferences
      (tenant_id,viewer_user_id,subject_user_id,blocked,updated_at)
      VALUES ($1,$2,$3,true,clock_timestamp())`,[tenant,bob,alice]);
    expect(await send(randomUUID(),conv.conversationId)).toBeNull();
    expect(await repository.history({tenantId:tenant,userId:alice,conversationId:conv.conversationId,limit:10,before:null})).toBeNull();
    await pool.query(`DELETE FROM talks.safety_preferences
      WHERE tenant_id=$1 AND viewer_user_id=$2 AND subject_user_id=$3`,[tenant,bob,alice]);
  });
  it("sender-only editing uses revision CAS, deletes tombstone, preserves ordering",async()=>{
    const conv=(await db().start({tenantId:tenant,userId:alice,recipientUserId:bob,proposedId:randomUUID()}))!;
    const sent=(await send(randomUUID(),conv.conversationId))!;
    expect(await db().edit({tenantId:tenant,userId:bob,conversationId:conv.conversationId,
      messageId:sent.messageId,text:"Forged",expectedRevision:1})).toBeNull();
    const edited=await db().edit({tenantId:tenant,userId:alice,conversationId:conv.conversationId,
      messageId:sent.messageId,text:"Edited",expectedRevision:1});
    expect(edited?.revision).toBe(2);
    expect(await db().edit({tenantId:tenant,userId:alice,conversationId:conv.conversationId,
      messageId:sent.messageId,text:"Stale",expectedRevision:1})).toBeNull();
    const deleted=await db().remove({tenantId:tenant,userId:alice,conversationId:conv.conversationId,
      messageId:sent.messageId,expectedRevision:2});
    expect(deleted).toMatchObject({text:"",revision:3});
    expect(deleted?.deletedAt).toBeTruthy();
  });
});
