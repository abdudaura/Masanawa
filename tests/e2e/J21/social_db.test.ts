import {readFileSync} from "node:fs";
import {describe,it,expect,beforeAll,afterAll} from "vitest";
import {createIsolatedPostgresTestDatabase} from "../../../adapters/storage/postgres/src/commerce/isolated-test-database.js";
import {createPostgresMasanaSocialStore} from "../../../adapters/storage/postgres/src/masana_social/repository.js";
import {createMasanaSocialService} from "../../../services/gateway/src/modules/masana_social/service.js";
import type {Pool} from "pg";

const connectionString=process.env.MASANAWA_TEST_DATABASE_URL;
const suite=connectionString?describe:describe.skip;
suite("J21 real PostgreSQL verify/link lifecycle and cross-tenant isolation",()=>{
  let db: Awaited<ReturnType<typeof createIsolatedPostgresTestDatabase>>;
  let pool:Pool;
  beforeAll(async()=>{
    db=await createIsolatedPostgresTestDatabase(connectionString!);
    pool=db.pool;
    for(const path of [
      "../../../packages/identity/migrations/0001_identity_foundation.sql",
      "../../../packages/identity/migrations/0002_character_ownership.sql",
      "../../../packages/masana_social/migrations/0001_social_links.sql",
    ]){
      await pool.query(readFileSync(new URL(path,import.meta.url),"utf8"));
    }
    for(const tenant of ["test-tenant-a","test-tenant-b"]){
      await pool.query(`INSERT INTO identity.tenants(tenant_id,created_at,updated_at)
        VALUES($1,now(),now())`,[tenant]);
      await pool.query(`INSERT INTO identity.characters(tenant_id,character_id,created_at,updated_at)
        VALUES($1,'masana-1',now(),now()),($1,'masana-2',now(),now())`,[tenant]);
      await pool.query(`INSERT INTO identity.character_ownership(tenant_id,character_id,kind,created_at)
        VALUES($1,'masana-1','platform',now()),($1,'masana-2','platform',now())`,[tenant]);
    }
  });
  afterAll(async()=>{if(db)await db.close();});
  it("keeps drafts private, denies unsupported verification and publishes only after evidence+staff",async()=>{
    const store=createPostgresMasanaSocialStore(pool);
    const verified=createMasanaSocialService(store,{verify:async(i)=>i.evidenceRef==="proof:device-confirmed"});
    const actor={tenantId:"test-tenant-a",userId:"ops-a",principalType:"staff" as const,
      roles:["ops_admin","content_editor"] as const};
    const created=await verified.create(actor,"masana-1",{
      provider:"whatsapp",providerAccountId:"2348012345678",handle:"+2348012345678",
      publicUrl:"https://wa.me/2348012345678",
    });
    expect(created.publishState).toBe("draft");
    expect((await verified.publicLinks(actor.tenantId,"masana-1")).links).toEqual([]);
    await expect(verified.transition(actor,"masana-1",created.identityId,"verify",{
      revision:1,evidenceRef:"fake"
    })).rejects.toMatchObject({code:"social_evidence_unverified"});
    const checked=await verified.transition(actor,"masana-1",created.identityId,"verify",{
      revision:1,evidenceRef:"proof:device-confirmed"
    });
    expect(checked.revision).toBe(2);
    await expect(verified.transition(actor,"masana-1",created.identityId,"publish",{revision:1}))
      .rejects.toMatchObject({code:"SOCIAL_REVISION_CONFLICT"});
    const pub=await verified.transition(actor,"masana-1",created.identityId,"publish",{revision:2});
    expect(pub.revision).toBe(3);
    expect((await verified.publicLinks(actor.tenantId,"masana-1")).links[0]?.publicUrl)
      .toBe("https://wa.me/2348012345678");
    expect((await verified.publicLinks("test-tenant-b","masana-1")).links).toEqual([]);
    expect((await verified.publicLinks(actor.tenantId,"masana-2")).links).toEqual([]);
    await verified.transition(actor,"masana-1",created.identityId,"revoke",{revision:3});
    expect((await verified.publicLinks(actor.tenantId,"masana-1")).links).toEqual([]);
    const audit=await pool.query<{action:string}>(`
      SELECT action FROM masana.social_connection_audit WHERE tenant_id=$1 AND identity_id=$2
      ORDER BY happened_at,action`,[actor.tenantId,created.identityId]);
    expect(audit.rows.map(x=>x.action)).toEqual(expect.arrayContaining(["create","verify","publish","revoke"]));
  });
  it("rejects character aliases, duplicate provider account and non-platform character",async()=>{
    const store=createPostgresMasanaSocialStore(pool);
    await expect(store.create({identityId:"duplicate-test",tenantId:"test-tenant-a",
      characterId:"masana-2",actorId:"ops-a",provider:"whatsapp",
      providerAccountId:"2348012345678",handle:"+2348012345678",
      publicUrl:"https://wa.me/2348012345678"})).rejects.toMatchObject({code:"23505"});
    await pool.query(`INSERT INTO identity.characters(tenant_id,character_id,created_at,updated_at)
      VALUES('test-tenant-a','fan-owned',now(),now())`);
    await pool.query(`INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at)
      VALUES('test-tenant-a','fan-1',now(),now())`);
    await pool.query(`INSERT INTO identity.character_ownership(tenant_id,character_id,kind,owner_user_id,created_at)
      VALUES('test-tenant-a','fan-owned','personal-clone','fan-1',now())`);
    await expect(store.create({identityId:"bad-role",tenantId:"test-tenant-a",
      characterId:"fan-owned",actorId:"ops-a",provider:"whatsapp",
      providerAccountId:"2347012345678",handle:"+2347012345678",
      publicUrl:"https://wa.me/2347012345678"})).rejects.toMatchObject({code:"SOCIAL_NOT_FOUND"});
  });
});
