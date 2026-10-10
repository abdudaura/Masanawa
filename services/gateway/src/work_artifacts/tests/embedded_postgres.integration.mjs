import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createArtifactRepository,createArtifactCreationLimiter} from '../postgres.ts';
import {createArtifactAccountErasure} from '../account_erasure.ts';
// Embedded PostgreSQL WASM engine, no server/production credentials. Does not prove multi-client locking.
test('exact artifact DDL, CAS, quotas, cleanup and account erasure on embedded PostgreSQL',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec('CREATE SCHEMA security; CREATE TABLE security.platform_user_profiles(tenant_id text,user_id text,PRIMARY KEY(tenant_id,user_id))');
  await db.exec("INSERT INTO security.platform_user_profiles VALUES ('tenant_a','user_a'),('tenant_a','user_b'),('tenant_b','user_a')");
  await db.exec(await readFile(new URL('../schema.sql',import.meta.url),'utf8'));
  const repo=createArtifactRepository(db),owner={tenantId:'tenant_a',userId:'user_a'};
  const now=new Date(),expiry=new Date(now.getTime()+3600000);
  const artifact={...owner,id:'artifact_a',requestId:'request_a',filename:'file.txt',mimeType:'text/plain; charset=utf-8',sizeBytes:1,
    sha256:'a'.repeat(64),objectKey:'key_a',provenance:{kind:'user-text'},state:'generating',revision:1,grants:[],createdAt:now.toISOString(),expiresAt:expiry.toISOString()};
  const first=await repo.reserve(artifact);assert.equal(first.state,'generating');
  assert.equal((await repo.reserve({...artifact,id:'artifact_b',objectKey:'key_b'})).id,first.id);
  assert.equal(await repo.find('tenant_b',first.id),null);
  assert.equal(await repo.change({...owner,userId:'user_b'},first.id,1,{state:'ready',grants:[]}),null);
  assert.equal((await repo.change(owner,first.id,1,{state:'ready',grants:[{userId:'user_b',expiresAt:expiry.toISOString()}]})).revision,2);
  assert.equal(await repo.change(owner,first.id,1,{state:'revoked',grants:[]}),null);
  const limiter=createArtifactCreationLimiter(db);
  const outcomes=await Promise.all(Array.from({length:25},()=>limiter(owner)));assert.equal(outcomes.filter(Boolean).length,20);
  assert.equal(await limiter({...owner,userId:'user_b'}),true);
  await db.query("UPDATE work_artifacts.creation_budgets SET day=day-1 WHERE tenant_id=$1 AND user_id=$2",[owner.tenantId,owner.userId]);
  assert.equal(await limiter(owner),true);
  await db.query("UPDATE work_artifacts.files SET state='revoked' WHERE id=$1",[first.id]);
  assert.equal((await repo.cleanupCandidates(50)).length,1);
  assert.equal((await repo.cleanupCandidates(50)).length,0,'recently checked rows do not starve queue');
  const keys=new Set(['key_a']);
  const erase=createArtifactAccountErasure({repository:repo,objects:{async delete(key){keys.delete(key);}},
    verifyErasure:async key=>!keys.has(key),isQuiesced:async()=>true,assertId:()=>{}});
  assert.deepEqual(await erase(owner),{verified:1,next:null});
  const tombstone=await repo.find(owner.tenantId,first.id);assert.equal(tombstone.state,'deleted');assert.deepEqual(tombstone.grants,[]);
  assert.equal((await repo.list(owner,undefined,51)).length,1,'metadata retained for coordinated F08 removal');
  await assert.rejects(db.query('DELETE FROM security.platform_user_profiles WHERE tenant_id=$1 AND user_id=$2',[owner.tenantId,owner.userId]),/foreign key/);
  await assert.rejects(repo.reserve({...artifact,id:'invalid',requestId:'invalid',objectKey:'invalid',sizeBytes:262145}),/check constraint/);
});
