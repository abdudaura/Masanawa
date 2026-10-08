import {randomUUID} from "node:crypto";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {createPostgresPool,platformProductMigrationRoots,runMigrations} from "@masanawa/postgres";
import {createPostgresHumanDmRepository} from "./postgres_repository.js";

const url=process.env.MASANAWA_TEST_DATABASE_URL;
const database=url?describe:describe.skip;
database("C02 human DMs against real temporary PostgreSQL",()=>{
  const pool=createPostgresPool({connectionString:url??"postgres://disabled/disabled",applicationName:"c02-integration",max:2});
  const tenant="tenant_dm_"+randomUUID().replace(/-/gu,"");
  const alice="user_dm_alice_"+randomUUID().replace(/-/gu,"");
  const bob="user_dm_bob_"+randomUUID().replace(/-/gu,"");
  const eve="user_dm_eve_"+randomUUID().replace(/-/gu,"");
  const a={tenantId:tenant,userId:alice};
  const b={tenantId:tenant,userId:bob};
  const e={tenantId:tenant,userId:eve};
  const repo=createPostgresHumanDmRepository(pool);
  const id=randomUUID();
  let conversationId:string;
  beforeAll(async()=>{
    // MUST ONLY RUN against a disposable test database, never production.
    if(!url) return;
    await runMigrations(pool,platformProductMigrationRoots());
    await pool.query(`
      INSERT INTO identity.tenants(tenant_id,created_at,updated_at) VALUES ($1,now(),now())
    `,[tenant]);
    for(const [user,handle] of [[alice,"a"+randomUUID().replace(/-/gu,"")],[bob,"b"+randomUUID().replace(/-/gu,"")],[eve,"e"+randomUUID().replace(/-/gu,"")]]){
      await pool.query("INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at) VALUES ($1,$2,now(),now())",[tenant,user]);
      await pool.query("INSERT INTO talks.public_profiles(tenant_id,user_id,handle,display_name) VALUES ($1,$2,$3,$4)",[tenant,user,handle,user]);
    }
  },120000);
  afterAll(async()=>{
    if(!url)return;
    await pool.query("DELETE FROM identity.tenants WHERE tenant_id=$1",[tenant]);
    await pool.end();
  });
  it("cannot open without C01 accepted contact consent, then can open idempotently",async()=>{
    expect(await repo.open({...a,otherUserId:bob})).toBeNull();
    await pool.query(`
      INSERT INTO talks.human_dm_contact_requests(tenant_id,first_user_id,second_user_id,requested_by,status)
      VALUES ($1,LEAST($2,$3),GREATEST($2,$3),$2,'accepted')
    `,[tenant,alice,bob]);
    const created=await repo.open({...a,otherUserId:bob});
    expect(created).toMatch(/^[0-9a-f-]{36}$/u);
    expect(await repo.open({...b,otherUserId:alice})).toBe(created);
    conversationId=created!;
  });
  it("commits a message exactly once under concurrent and repeated retry",async()=>{
    const send=()=>repo.send({...a,conversationId,clientMessageId:id,text:"Hello from Alice"});
    const receipts=await Promise.all([send(),send(),send()]);
    expect(receipts[0]).toMatchObject({clientMessageId:id,sequence:1,text:"Hello from Alice"});
    expect(receipts[1]).toEqual(receipts[0]);
    expect(receipts[2]).toEqual(receipts[0]);
    expect(await repo.send({...a,conversationId,clientMessageId:id,text:"Forged reuse"})).toBe("conflict");
    const page=await repo.history({...b,conversationId,limit:40});
    expect(page).toHaveLength(1);
    expect(page![0]!.senderUserId).toBe(alice);
    expect(await repo.history({...e,conversationId,limit:40})).toBeNull();
  });
  it("bounds edit/read/delete to sender, account and nondecreasing cursor",async()=>{
    const records=(await repo.history({...a,conversationId,limit:10}))!;
    const id=records[0]!.messageId;
    expect(await repo.edit({...b,conversationId,messageId:id,text:"Impersonation"})).toBeNull();
    expect(await repo.edit({...a,conversationId,messageId:id,text:"Corrected"}))
      .toMatchObject({text:"Corrected"});
    expect(await repo.read({...b,conversationId,upToSequence:1})).toBe(1);
    expect(await repo.read({...b,conversationId,upToSequence:0})).toBe(1);
    expect(await repo.read({...e,conversationId,upToSequence:1})).toBeNull();
    expect(await repo.remove({...b,conversationId,messageId:id})).toBeNull();
    expect((await repo.remove({...a,conversationId,messageId:id}))?.text).toBeNull();
  });
  it("revocation after a thread exists blocks fresh deliveries but retains authorized history",async()=>{
    await pool.query(`
      UPDATE talks.human_dm_contact_requests SET status='declined'
      WHERE tenant_id=$1 AND first_user_id=LEAST($2,$3) AND second_user_id=GREATEST($2,$3)
    `,[tenant,alice,bob]);
    expect(await repo.send({...a,conversationId,clientMessageId:randomUUID(),text:"After revoke"})).toBe("unavailable");
    expect(await repo.history({...b,conversationId,limit:5})).toHaveLength(1);
    expect(await repo.open({...a,otherUserId:bob})).toBeNull();
  });
});
