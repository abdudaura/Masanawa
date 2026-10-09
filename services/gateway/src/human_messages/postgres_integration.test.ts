import { randomUUID,createHash } from "node:crypto";
import { beforeAll,afterAll,describe,it,expect } from "vitest";
import { createPostgresPool, runMigrations, platformProductMigrationRoots } from "@masanawa/postgres";
import { createPostgresHumanDmRepository } from "./postgres_repository.js";

/**
 * Real DB test, gated by MASANAWA_TEST_DATABASE_URL.
 * Requires C01 migration 0016 installed before C02 migration 0017; both
 * intentionally live in separate draft PRs. Run only on disposable TEST database.
 */
const connectionString=process.env.MASANAWA_TEST_DATABASE_URL;
const describeDb=connectionString?describe:describe.skip;
describeDb("C02 human DM real PostgreSQL concurrency/privacy",()=>{
  let pool:ReturnType<typeof createPostgresPool>;
  const nonce=randomUUID().replaceAll("-","");
  const tenant="tenant_c02_"+nonce;
  const a="user_c02_a_"+nonce,b="user_c02_b_"+nonce,c="user_c02_c_"+nonce;
  let conversationId:string;
  const id="request_"+nonce;
  beforeAll(async()=>{
    pool=createPostgresPool({connectionString:connectionString!,
      applicationName:"masanawa-human-dm-c02-integration",max:5});
    await runMigrations(pool,platformProductMigrationRoots());
    const now=new Date().toISOString();
    await pool.query(`INSERT INTO identity.tenants(tenant_id,created_at,updated_at)
      VALUES ($1,$2,$2)`,[tenant,now]);
    for(const user of [a,b,c]){
      await pool.query(`INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at)
        VALUES($1,$2,$3,$3)`,[tenant,user,now]);
      await pool.query(`INSERT INTO talks.public_profiles(tenant_id,user_id,handle,display_name)
        VALUES($1,$2,$3,$4)`,[tenant,user,user.replace(/[^a-z0-9]/g,"").slice(0,38),user]);
    }
    await pool.query(`INSERT INTO talks.human_dm_preferences(tenant_id,user_id,admission_policy)
      VALUES($1,$2,'anyone')`,[tenant,b]);
  },30000);
  afterAll(async()=>{if(pool)await pool.end();});
  it("opens only eligible human pair once (including concurrent opens)",async()=>{
    const repo=createPostgresHumanDmRepository(pool);
    const [one,two]=await Promise.all([
      repo.open({tenantId:tenant,userId:a,otherUserId:b}),
      repo.open({tenantId:tenant,userId:a,otherUserId:b}),
    ]);
    expect(one).toBeTruthy();expect(two).toBe(one);conversationId=one!;
    expect(await repo.open({tenantId:tenant,userId:a,otherUserId:a})).toBeNull();
    expect(await repo.open({tenantId:tenant,userId:a,otherUserId:c})).toBeNull();
  });
  it("deduplicates concurrent and restarted sends to a single persisted row",async()=>{
    const repo=createPostgresHumanDmRepository(pool);
    const body="hello Bob",sha256=createHash("sha256").update(body).digest("hex");
    const params={tenantId:tenant,userId:a,conversationId,clientRequestId:id,body,sha256};
    const [one,two]=await Promise.all([repo.send(params),repo.send(params)]);
    expect(typeof one).toBe("object");
    expect(two).toEqual(one);
    const afterRestart=createPostgresHumanDmRepository(pool);
    expect(await afterRestart.send(params)).toEqual(one);
    const conflict=await repo.send({...params,body:"different",sha256:createHash("sha256").update("different").digest("hex")});
    expect(conflict).toBe("conflict");
    const rows=await pool.query<{count:string}>(`
      SELECT count(*)::text AS count FROM talks.human_dm_messages
      WHERE tenant_id=$1 AND conversation_id=$2 AND client_request_id=$3`,[tenant,conversationId,id]);
    expect(rows.rows[0]?.count).toBe("1");
  });
  it("scopes history and inbox to active members, supports message cursor and unread",async()=>{
    const repo=createPostgresHumanDmRepository(pool);
    const history=await repo.history({tenantId:tenant,userId:b,conversationId,limit:30});
    expect(history?.length).toBe(1);
    expect(history?.[0]?.body).toBe("hello Bob");
    expect(await repo.history({tenantId:tenant,userId:c,conversationId,limit:30})).toBeNull();
    const inbox=await repo.inbox({tenantId:tenant,userId:b,limit:30});
    expect(inbox[0]).toMatchObject({conversationId,otherUserId:a,unreadCount:1});
    expect(await repo.read({tenantId:tenant,userId:b,conversationId,throughSequence:"9223372036854775807"})).toBe(history?.[0]?.sequence);
    const unread=await repo.inbox({tenantId:tenant,userId:b,limit:30});
    expect(unread[0]?.unreadCount).toBe(0);
    const empty=await repo.history({tenantId:tenant,userId:b,conversationId,
      limit:30,before:history![0]!.sequence});
    expect(empty).toEqual([]);
  });
  it("edits and deletes once under live C01 consent; repeat delete returns only a tombstone",async()=>{
    const repo=createPostgresHumanDmRepository(pool);
    const original="before correction";
    const sent=await repo.send({tenantId:tenant,userId:a,conversationId,
      clientRequestId:"request_"+randomUUID().replaceAll("-",""),body:original,
      sha256:createHash("sha256").update(original).digest("hex")});
    expect(typeof sent).toBe("object");
    if(typeof sent!=="object") throw new Error("disposable DB send did not persist");
    const changed=await repo.edit({tenantId:tenant,userId:a,
      messageId:sent.messageId,body:"corrected"});
    expect(changed?.body).toBe("corrected");
    // Only the authenticated sender may edit or tombstone the message.
    expect(await repo.edit({tenantId:tenant,userId:b,
      messageId:sent.messageId,body:"peer spoof"})).toBeNull();
    expect(await repo.remove({tenantId:tenant,userId:b,
      messageId:sent.messageId})).toBeNull();
    const deleted=await repo.remove({tenantId:tenant,userId:a,messageId:sent.messageId});
    expect(deleted?.body).toBeNull();
    expect(deleted?.deletedAt).not.toBeNull();
    expect(await repo.remove({tenantId:tenant,userId:a,messageId:sent.messageId}))
      .toEqual(deleted);
    expect(await repo.edit({tenantId:tenant,userId:a,
      messageId:sent.messageId,body:"restore"})).toBeNull();
  });
  it("immediately blocks send AND historical reads upon reciprocal block",async()=>{
    const now=new Date().toISOString();
    await pool.query(`INSERT INTO talks.safety_preferences
      (tenant_id,viewer_user_id,subject_user_id,blocked,updated_at)
      VALUES ($1,$2,$3,true,$4)`,[tenant,b,a,now]);
    const repo=createPostgresHumanDmRepository(pool);
    const p={tenantId:tenant,userId:a,conversationId,clientRequestId:"request_"+randomUUID().replaceAll("-",""),
      body:"should fail",sha256:createHash("sha256").update("should fail").digest("hex")};
    expect(await repo.send(p)).toBe("forbidden");
    const historical=await pool.query<{message_id:string;body:string|null}>(`
      SELECT message_id,body FROM talks.human_dm_messages
      WHERE tenant_id=$1 AND conversation_id=$2 AND sender_user_id=$3
        AND client_request_id=$4
    `,[tenant,conversationId,a,id]);
    const saved=historical.rows[0]!;
    expect(saved.body).toBe("hello Bob");
    expect(await repo.edit({tenantId:tenant,userId:a,
      messageId:saved.message_id,body:"must not edit when blocked"})).toBeNull();
    expect(await repo.remove({tenantId:tenant,userId:a,
      messageId:saved.message_id})).toBeNull();
    const unchanged=await pool.query<{body:string|null;deleted_at:Date|null}>(`
      SELECT body,deleted_at FROM talks.human_dm_messages
      WHERE tenant_id=$1 AND message_id=$2
    `,[tenant,saved.message_id]);
    expect(unchanged.rows[0]?.body).toBe("hello Bob");
    expect(unchanged.rows[0]?.deleted_at).toBeNull();

    expect(await repo.history({tenantId:tenant,userId:a,conversationId,limit:30})).toBeNull();
    expect(await repo.inbox({tenantId:tenant,userId:a,limit:30})).toEqual([]);
    // A revoked actor cannot create a read receipt even if the thread UUID
    // and a formerly valid monotonically increasing cursor are known.
    expect(await repo.read({tenantId:tenant,userId:a,conversationId,
      throughSequence:"9223372036854775807"})).toBeNull();
    const denied=await pool.query<{count:string}>(`
      SELECT count(*)::text AS count FROM talks.human_dm_reads
      WHERE tenant_id=$1 AND conversation_id=$2 AND user_id=$3`,[tenant,conversationId,a]);
    expect(denied.rows[0]?.count).toBe("0");
  });
  it("contact revocation revokes old message history and unauthorized retries",async()=>{
    await pool.query(`DELETE FROM talks.safety_preferences
      WHERE tenant_id=$1 AND viewer_user_id=$2 AND subject_user_id=$3`,[tenant,b,a]);
    await pool.query(`INSERT INTO talks.human_dm_contact_requests
      (tenant_id,first_user_id,second_user_id,requested_by,status)
      VALUES ($1,LEAST($2,$3),GREATEST($2,$3),$2,'declined')`,[tenant,a,b]);
    const repo=createPostgresHumanDmRepository(pool);
    const older=await pool.query<{message_id:string}>(`
      SELECT message_id FROM talks.human_dm_messages
      WHERE tenant_id=$1 AND conversation_id=$2 AND sender_user_id=$3
        AND client_request_id=$4
    `,[tenant,conversationId,a,id]);
    expect(await repo.edit({tenantId:tenant,userId:a,
      messageId:older.rows[0]!.message_id,body:"declined edit"})).toBeNull();
    expect(await repo.remove({tenantId:tenant,userId:a,
      messageId:older.rows[0]!.message_id})).toBeNull();
    expect(await repo.history({tenantId:tenant,userId:a,conversationId,limit:40})).toBeNull();
    expect(await repo.inbox({tenantId:tenant,userId:a,limit:40})).toEqual([]);
    expect(await repo.read({tenantId:tenant,userId:a,conversationId,
      throughSequence:"9223372036854775807"})).toBeNull();
    const body="revoked send";
    expect(await repo.send({tenantId:tenant,userId:a,conversationId,
      clientRequestId:"request_"+randomUUID().replaceAll("-",""),body,
      sha256:createHash("sha256").update(body).digest("hex")})).toBe("forbidden");
  });
});
