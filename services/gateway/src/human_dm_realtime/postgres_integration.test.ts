import { randomUUID,createHash } from "node:crypto";
import { afterAll,beforeAll,describe,expect,it } from "vitest";
import {
  createPostgresPool,platformProductMigrationRoots,runMigrations,type Pool,
} from "@masanawa/postgres";
import { createPostgresHumanDmRealtimeRepository } from "./postgres_repository.js";

/** Opt-in only against an explicitly named LOOPBACK, disposable *_test DB.
 * Requires C01 migration 0016, C02 migration 0017 and this C03 0019.
 * Never reuse a production DB URL or apply these to a live schema.
 */
const url=process.env.MASANAWA_C03_TEST_DATABASE_URL;
function allowed(input:string|undefined) {
  if(!input || process.env.MASANAWA_C03_ENABLE_DB_TESTS!=="yes")return false;
  try {
    const parsed=new URL(input);
    return ["postgres:","postgresql:"].includes(parsed.protocol)
      && ["localhost","127.0.0.1","[::1]"].includes(parsed.hostname)
      && decodeURIComponent(parsed.pathname).endsWith("_test");
  } catch { return false; }
}
const run=allowed(url)?describe:describe.skip;
run("C03 durable PostgreSQL metadata event stream",()=>{
  let pool:Pool;
  const suffix=randomUUID().replaceAll("-","").slice(0,10);
  const tenant=`c03_tenant_${suffix}`;
  const alice=`c03_alice_${suffix}`;
  const bob=`c03_bob_${suffix}`;
  const outsider=`c03_other_${suffix}`;
  let thread:string;

  beforeAll(async()=>{
    pool=createPostgresPool({
      connectionString:url!,
      applicationName:"c03-disposable-postgres-journal-test",
      max:4,
    });
    await runMigrations(pool,platformProductMigrationRoots());
    await pool.query(`INSERT INTO identity.tenants (tenant_id,created_at,updated_at)
      VALUES($1,clock_timestamp(),clock_timestamp())`,[tenant]);
    for(const id of [alice,bob,outsider]){
      await pool.query(`INSERT INTO identity.users
        (tenant_id,user_id,created_at,updated_at)
        VALUES($1,$2,clock_timestamp(),clock_timestamp())`,[tenant,id]);
    }
    for(const [id,handle] of [[alice,`a_${suffix}`],[bob,`b_${suffix}`]]){
      await pool.query(`INSERT INTO talks.public_profiles
        (tenant_id,user_id,handle,display_name)
        VALUES($1,$2,$3,$3)`,[tenant,id,handle]);
    }
    const result=await pool.query<{conversation_id:string}>(`
      INSERT INTO talks.human_dm_conversations(
        tenant_id,first_user_id,second_user_id)
      VALUES($1,LEAST($2,$3),GREATEST($2,$3))
      RETURNING conversation_id`,[tenant,alice,bob]);
    thread=result.rows[0]!.conversation_id;
    await pool.query(`INSERT INTO talks.human_dm_contact_requests
      (tenant_id,first_user_id,second_user_id,requested_by,status)
      VALUES($1,LEAST($2,$3),GREATEST($2,$3),$2,'accepted')`,
      [tenant,alice,bob]);
  },120_000);

  afterAll(async()=>{
    if(!pool)return;
    try {
      // Foreign keys cascade within this random disposable tenant.
      await pool.query(`DELETE FROM talks.human_dm_conversations WHERE tenant_id=$1`,[tenant]);
      await pool.query(`DELETE FROM talks.human_dm_contact_requests WHERE tenant_id=$1`,[tenant]);
      await pool.query(`DELETE FROM talks.safety_preferences WHERE tenant_id=$1`,[tenant]);
      await pool.query(`DELETE FROM talks.public_profiles WHERE tenant_id=$1`,[tenant]);
      await pool.query(`DELETE FROM identity.users WHERE tenant_id=$1`,[tenant]);
      await pool.query(`DELETE FROM identity.tenants WHERE tenant_id=$1`,[tenant]);
    } finally {
      await pool.end();
    }
  });

  it("journals real message changes and hides bodies from event projections",async()=>{
    const senderId=`send_${suffix}000000`;
    const content="Private user text must never appear in an event";
    await pool.query(`INSERT INTO talks.human_dm_messages
      (tenant_id,conversation_id,sender_user_id,client_request_id,original_sha256,body)
      VALUES($1,$2,$3,$4,$5,$6)`,
      [tenant,thread,alice,senderId,createHash("sha256").update(content).digest("hex"),content]);
    const repo=createPostgresHumanDmRealtimeRepository(pool);
    const page=await repo.sync({tenantId:tenant,userId:bob,after:"0",limit:50});
    expect(page.events.some(e=>e.kind==="message_added")).toBe(true);
    expect(JSON.stringify(page)).not.toContain(content);
    expect(page.events.every(e=>e.conversationId===thread)).toBe(true);
    const illegal=await repo.sync({tenantId:tenant,userId:outsider,after:"0",limit:50});
    expect(illegal.events).toHaveLength(0);
  });

  it("revokes message visibility on block, but sends access invalidation",async()=>{
    const before=await pool.query<{n:string}>(`
      SELECT max(event_id)::text AS n FROM talks.human_dm_events
      WHERE tenant_id=$1`,[tenant]);
    await pool.query(`INSERT INTO talks.safety_preferences(
      tenant_id,viewer_user_id,subject_user_id,blocked,updated_at)
      VALUES($1,$2,$3,true,clock_timestamp())`,[tenant,bob,alice]);
    const repo=createPostgresHumanDmRealtimeRepository(pool);
    const result=await repo.sync({
      tenantId:tenant,userId:alice,after:before.rows[0]?.n??"0",limit:50,
    });
    expect(result.events.map(e=>e.kind)).toContain("access_changed");
    expect(result.events.every(e=>e.kind==="access_changed")).toBe(true);
    const other=await repo.sync({
      tenantId:tenant,userId:outsider,after:before.rows[0]?.n??"0",limit:50,
    });
    expect(other.events).toHaveLength(0);
  });

  it("account deactivation invalidates the other member's cached view",async()=>{
    const cursor=await pool.query<{n:string}>(`
      SELECT max(event_id)::text AS n FROM talks.human_dm_events
      WHERE tenant_id=$1`,[tenant]);
    await pool.query(`UPDATE identity.users SET state='disabled'
      WHERE tenant_id=$1 AND user_id=$2`,[tenant,bob]);
    const repo=createPostgresHumanDmRealtimeRepository(pool);
    const result=await repo.sync({
      tenantId:tenant,userId:alice,after:cursor.rows[0]?.n??"0",limit:50,
    });
    expect(result.events.some(e=>e.kind==="access_changed")).toBe(true);
    expect((await repo.sync({tenantId:tenant,userId:bob,after:"0",limit:50})).events).toEqual([]);
  });
  it("prunes with member-specific watermark, resnapshots offline device and resumes later events",async()=>{
    // Re-enable the existing member after the previous revocation regression.
    await pool.query(`UPDATE identity.users SET state='active'
      WHERE tenant_id=$1 AND user_id=$2`,[tenant,bob]);
    await pool.query(`DELETE FROM talks.safety_preferences
      WHERE tenant_id=$1 AND viewer_user_id=$2 AND subject_user_id=$3`,
      [tenant,bob,alice]);

    await pool.query(`UPDATE talks.human_dm_events
      SET created_at=clock_timestamp()-interval '3 days'
      WHERE tenant_id=$1`,[tenant]);
    const trimmed=await pool.query<{n:number}>(`
      SELECT talks.trim_human_dm_events(
        $1,clock_timestamp()-interval '2 days',10000) AS n
    `,[tenant]);
    expect(trimmed.rows[0]!.n).toBeGreaterThan(0);

    const repo=createPostgresHumanDmRealtimeRepository(pool);
    const expired=await repo.sync({
      tenantId:tenant,userId:bob,after:"0",limit:50,
    });
    expect(expired.resetRequired).toBe(true);
    expect(expired.events).toEqual([]);
    expect(BigInt(expired.nextCursor)).toBeGreaterThan(0n);

    const content="This body must remain outside metadata";
    await pool.query(`INSERT INTO talks.human_dm_messages
      (tenant_id,conversation_id,sender_user_id,client_request_id,original_sha256,body)
      VALUES($1,$2,$3,$4,$5,$6)`,
      [tenant,thread,alice,`recover_${suffix}000`,
        createHash("sha256").update(content).digest("hex"),content]);
    const resumed=await repo.sync({
      tenantId:tenant,userId:bob,after:expired.nextCursor,limit:50,
    });
    expect(resumed.resetRequired).toBe(false);
    expect(resumed.events.some(e=>e.kind==="message_added")).toBe(true);
    expect(JSON.stringify(resumed)).not.toContain(content);
  });

});
