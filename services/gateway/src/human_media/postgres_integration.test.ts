import { randomUUID, createHash } from "node:crypto";
import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { createPostgresPool,platformProductMigrationRoots,runMigrations } from "@masanawa/postgres";
import { createPostgresVoiceNoteRepository } from "./postgres_repository.js";

/**
 * DO NOT point at production! Only a disposable localhost *_test DB and a
 * second explicit opt-in are eligible. Requires C01, C02, C04 migration sequence.
 */
const uri=process.env.MASANAWA_C04_TEST_DATABASE_URL;
function approved(value:string|undefined) {
 if(!value||process.env.MASANAWA_C04_ENABLE_DB_TESTS!=="yes")return false;
 try{
  const u=new URL(value);
  return ["postgresql:","postgres:"].includes(u.protocol)&&
   ["localhost","127.0.0.1","[::1]"].includes(u.hostname)&&
   decodeURIComponent(u.pathname).endsWith("_test");
 }catch{return false}
}
(approved(uri)?describe:describe.skip)("C04 real tenant-scoped PostgreSQL voice-note transactions",()=>{
 const nonce=randomUUID().replaceAll("-","").slice(0,16);
 const tenantId="tenant_c04_"+nonce,userId="user_a_"+nonce,peerId="user_b_"+nonce;
 const outsider="user_c_"+nonce;
 const digest=createHash("sha256").update("test-opus-payload").digest("hex");
 let pool:ReturnType<typeof createPostgresPool>,conversationId:string;
 const requestId="request_"+nonce;
 const key="dm-voice/"+digest.slice(0,32)+"/"+
   "00000000-0000-4000-8000-000000000001/"+digest.slice(0,32)+"/"+
   "00000000-0000-4000-8000-000000000002.ogg";
 beforeAll(async()=>{
  pool=createPostgresPool({connectionString:uri!,
   applicationName:"masanawa-c04-disposable-db-only",max:5});
  await runMigrations(pool,platformProductMigrationRoots());
  await pool.query(`INSERT INTO identity.tenants(tenant_id,created_at,updated_at)
    VALUES($1,clock_timestamp(),clock_timestamp())`,[tenantId]);
  for(const user of [userId,peerId,outsider]){
   await pool.query(`INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at)
    VALUES($1,$2,clock_timestamp(),clock_timestamp())`,[tenantId,user]);
  }
  await pool.query(`INSERT INTO talks.human_dm_preferences(tenant_id,user_id,admission_policy)
    VALUES($1,$2,'anyone')`,[tenantId,peerId]);
  const conv=await pool.query<{conversation_id:string}>(`
    INSERT INTO talks.human_dm_conversations(tenant_id,first_user_id,second_user_id)
    VALUES($1,LEAST($2,$3),GREATEST($2,$3)) RETURNING conversation_id`,
    [tenantId,userId,peerId]);
  conversationId=conv.rows[0]!.conversation_id;
 },120000);
 afterAll(async()=>{
  if(!pool)return;
  try{
   // These disposable repository-only fixtures never PUT to external S3. If a
   // prior assertion failed before the success-path cleanup, acknowledge the
   // absent *fixture* objects through the SAME guarded repository path instead
   // of disabling the production BEFORE DELETE trigger for teardown.
   try {
     await pool.query(`UPDATE talks.human_dm_voice_objects SET state='orphaned'
       WHERE tenant_id=$1`,[tenantId]);
     const repo=createPostgresVoiceNoteRepository(pool);
     for(let iteration=0;iteration<10;iteration++){
       const pending=await repo.stale(100);
       if(pending.length===0)break;
       for(const row of pending)await repo.deleted(row.objectKey,true);
     }
   }catch{/* A prior schema/setup failure may leave this table absent. */}
   // Identity tenancy has RESTRICT FKs. Explicitly delete ONLY the nonce tenant rows.
   // Cleanup is best effort if a failed migration prevented table creation.
   for(const sql of [
     "DELETE FROM talks.human_dm_voice_objects WHERE tenant_id=$1",
     "DELETE FROM talks.human_dm_reads WHERE tenant_id=$1",
     "DELETE FROM talks.human_dm_messages WHERE tenant_id=$1",
     "DELETE FROM talks.human_dm_conversations WHERE tenant_id=$1",
     "DELETE FROM talks.human_dm_contact_requests WHERE tenant_id=$1",
     "DELETE FROM talks.human_dm_preferences WHERE tenant_id=$1",
     "DELETE FROM talks.safety_preferences WHERE tenant_id=$1",
     "DELETE FROM talks.public_profiles WHERE tenant_id=$1",
     "DELETE FROM identity.users WHERE tenant_id=$1",
     "DELETE FROM identity.tenants WHERE tenant_id=$1",
   ]){await pool.query(sql,[tenantId]);}
  }finally{await pool.end()}
 });
 it("enforces admission and exactly-once voice sequence through concurrent retries",async()=>{
  const repo=createPostgresVoiceNoteRepository(pool);
  const params={owner:{tenantId,userId},conversationId,clientRequestId:requestId,
   objectKey:key,sha256:digest,sizeBytes:500,durationMs:1000};
  const [a,b]=await Promise.all([repo.stage(params),repo.stage(params)]);
  expect(typeof a).toBe("object");expect(b).toEqual(a);
  const [receipt,duplicate]=await Promise.all([repo.attach(params),repo.attach(params)]);
  expect(receipt).toEqual(duplicate);
  expect(receipt).toMatchObject({conversationId,senderUserId:userId,sequence:expect.any(String)});
  const rows=await pool.query<{count:string}>(`
    SELECT count(*)::text AS count FROM talks.human_dm_messages
    WHERE tenant_id=$1 AND conversation_id=$2`,[tenantId,conversationId]);
  expect(rows.rows[0]?.count).toBe("1");
  expect(await repo.stage({...params,sha256:"a".repeat(64)})).toBe("conflict");
  expect(await repo.find({tenantId,userId:outsider,messageId:(receipt as {messageId:string}).messageId})).toBeNull();
 });
 it("honors reader revocation instantly, including already uploaded objects",async()=>{
  const repo=createPostgresVoiceNoteRepository(pool);
  const page=await repo.list({tenantId,userId:peerId,conversationId,limit:30});
  expect(page).toHaveLength(1);
  const item=page![0]!;
  expect((await repo.find({tenantId,userId:peerId,messageId:item.messageId}))?.objectKey).toBe(key);
  await pool.query(`INSERT INTO talks.safety_preferences
    (tenant_id,viewer_user_id,subject_user_id,blocked,updated_at)
    VALUES($1,$2,$3,true,clock_timestamp())`,[tenantId,peerId,userId]);
  expect(await repo.find({tenantId,userId,messageId:item.messageId})).toBeNull();
  expect(await repo.list({tenantId,userId:peerId,conversationId,limit:30})).toBeNull();
  expect(await repo.stage({owner:{tenantId,userId},conversationId,
    clientRequestId:"new-request_"+nonce,objectKey:key.replace(".ogg","3.ogg"),
    sha256:digest,sizeBytes:500,durationMs:1000})).toBe("forbidden");
  await pool.query(`DELETE FROM talks.safety_preferences WHERE tenant_id=$1`,[tenantId]);
 });
 it("revoked contacts lose permission for private voice playback despite retained DB objects",async()=>{
  const repo=createPostgresVoiceNoteRepository(pool);
  const available=await repo.list({tenantId,userId:peerId,conversationId,limit:30});
  expect(available).toHaveLength(1);
  await pool.query(`INSERT INTO talks.human_dm_contact_requests
    (tenant_id,first_user_id,second_user_id,requested_by,status)
    VALUES($1,LEAST($2,$3),GREATEST($2,$3),$2,'declined')`,
    [tenantId,userId,peerId]);
  expect(await repo.find({tenantId,userId,messageId:available![0]!.messageId})).toBeNull();
  expect(await repo.list({tenantId,userId:peerId,conversationId,limit:30})).toBeNull();
  await pool.query(`DELETE FROM talks.human_dm_contact_requests WHERE tenant_id=$1`,
    [tenantId]);
 });
 it("tombstones deleted audio, denies playback and durably collects its S3 key",async()=>{
  const repo=createPostgresVoiceNoteRepository(pool);
  const page=await repo.list({tenantId,userId,conversationId,limit:30});
  const id=page![0]!.messageId;
  expect(await repo.remove({tenantId,userId:peerId,messageId:id})).toBe(false);
  expect(await repo.remove({tenantId,userId,messageId:id})).toBe(true);
  expect(await repo.find({tenantId,userId:peerId,messageId:id})).toBeNull();
  // Deleting an account/conversation must never cascade away the ONLY S3
  // object reference before the provider has confirmed remote erasure.
  await expect(pool.query(
    `DELETE FROM talks.human_dm_voice_objects WHERE tenant_id=$1 AND object_key=$2`,
    [tenantId,key],
  )).rejects.toThrow("private voice storage erasure required");
  await expect(pool.query(
    `DELETE FROM talks.human_dm_conversations
      WHERE tenant_id=$1 AND conversation_id=$2`,
    [tenantId,conversationId],
  )).rejects.toThrow("private voice storage erasure required");
  const prior=await pool.query<{storage_erased_at:Date|null}>(
    `SELECT storage_erased_at FROM talks.human_dm_voice_objects
      WHERE tenant_id=$1 AND object_key=$2`,[tenantId,key]);
  expect(prior.rows[0]?.storage_erased_at).toBeNull();
  const garbage=await repo.stale(10);
  expect(garbage).toContainEqual({objectKey:key});
  await repo.deleted(key,true);
  expect(await repo.list({tenantId,userId,conversationId,limit:30})).toEqual([]);
  const erased=await pool.query<{count:string}>(
    `SELECT count(*)::text AS count FROM talks.human_dm_voice_objects
     WHERE tenant_id=$1 AND object_key=$2`,[tenantId,key]);
  expect(erased.rows[0]?.count).toBe("0");
 });
});
