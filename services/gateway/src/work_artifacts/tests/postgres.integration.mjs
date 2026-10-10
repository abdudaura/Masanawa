import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { createArtifactRepository, createArtifactCreationLimiter } from '../postgres.ts';

// Intentionally fails when no explicitly disposable database is supplied; never silently skips.
const url=process.env.MASANAWA_ARTIFACT_TEST_DATABASE_URL;
if(!url || process.env.MASANAWA_ARTIFACT_DISPOSABLE!=='yes' || !/^\/masanawa_test_[a-z0-9_]+$/.test(new URL(url).pathname)) {
  throw Error('Requires MASANAWA_ARTIFACT_DISPOSABLE=yes and a dedicated empty masanawa_test_* database');
}
test('exact proposed SQL, tenant uniqueness, CAS and durable rate cap on disposable Postgres',async()=>{
  const db=new pg.Client({connectionString:url});await db.connect();
  try {
    const existing=await db.query("SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p') LIMIT 1");
    assert.equal(existing.rows.length,0,'Refuse nonempty database');
    await db.query('BEGIN');
    await db.query('CREATE SCHEMA security; CREATE TABLE security.platform_user_profiles(tenant_id text,user_id text,PRIMARY KEY(tenant_id,user_id))');
    await db.query("INSERT INTO security.platform_user_profiles VALUES ('tenant_a','user_a'),('tenant_a','user_b')");
    await db.query(await readFile(new URL('../schema.sql',import.meta.url),'utf8'));
    const repo=createArtifactRepository(db),owner={tenantId:'tenant_a',userId:'user_a'};
    const artifact={...owner,id:'artifact_a',requestId:'request_a',filename:'file.txt',mimeType:'text/plain; charset=utf-8',sizeBytes:1,
      sha256:'a'.repeat(64),objectKey:'key_a',provenance:{kind:'user-text'},state:'generating',revision:1,grants:[],
      createdAt:'2026-10-09T00:00:00Z',expiresAt:'2026-10-10T00:00:00Z'};
    const first=await repo.reserve(artifact);assert.equal(first.state,'generating');
    assert.equal((await repo.reserve({...artifact,id:'artifact_b',objectKey:'key_b'})).id,first.id);
    assert.equal(await repo.find('tenant_b',first.id),null);
    assert.equal(await repo.change({...owner,userId:'user_b'},first.id,1,{state:'ready',grants:[]}),null);
    assert.equal((await repo.change(owner,first.id,1,{state:'ready',grants:[]})).revision,2);
    assert.equal(await repo.change(owner,first.id,1,{state:'revoked',grants:[]}),null);
    const limiter=createArtifactCreationLimiter(db);
    for(let i=0;i<20;i++)assert.equal(await limiter(owner),true);
    assert.equal(await limiter(owner),false);
    assert.equal(await limiter({...owner,userId:'user_b'}),true);
  } finally {await db.query('ROLLBACK');await db.end();}
});
