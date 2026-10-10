import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createArtifactAccountErasure} from '../account_erasure.ts';
import {createArtifactS3} from '../private_store.ts';
const owner={tenantId:'tenant_a',userId:'user_a'};
function setup(count=1) {
  const rows=Array.from({length:count},(_,i)=>({...owner,id:`artifact_${String(i).padStart(3,'0')}`,objectKey:`key_${i}`,state:i%2?'deleted':'ready',revision:1,grants:[{userId:'user_b'}]}));
  const keys=new Set(rows.map(r=>r.objectKey)); let quiesced=true;
  const repository={async list(o,after,limit){return rows.filter(r=>r.tenantId===o.tenantId&&r.userId===o.userId&&(!after||r.id>after)).slice(0,limit).map(r=>structuredClone(r));},
    async change(o,id,revision,patch){const r=rows.find(r=>r.id===id&&r.tenantId===o.tenantId&&r.userId===o.userId&&r.revision===revision);if(!r)return null;Object.assign(r,patch,{revision:revision+1});return structuredClone(r);}};
  const objects={async delete(key){keys.delete(key);}};
  const input={repository,objects,verifyErasure:async key=>!keys.has(key),isQuiesced:async()=>quiesced,assertId:(_kind,id)=>assert.equal(typeof id,'string')};
  return {rows,keys,input,unfence:()=>{quiesced=false;},run:(...args)=>createArtifactAccountErasure(input)(...args)};
}
test('account erasure refuses unfenced writes before journal or provider access',async()=>{
  const f=setup();f.unfence();await assert.rejects(f.run(owner),e=>e.code==='account_erasure_not_fenced');
  assert.equal(f.keys.size,1);assert.equal(f.rows[0].state,'ready');
});
test('bounded erasure re-deletes old tombstones, clears grants and retains metadata',async()=>{
  const f=setup(53),first=await f.run(owner);assert.deepEqual(first,{verified:50,next:'artifact_049'});
  assert.equal(f.keys.size,3);assert.equal(f.rows.length,53);
  const second=await f.run(owner,first.next);assert.deepEqual(second,{verified:3,next:null});assert.equal(f.keys.size,0);
  assert.ok(f.rows.every(r=>r.state==='deleted'));
  assert.ok(f.rows.every(r=>r.grants.length===0));
});
test('provider failure leaves deleting journal and entire batch safely retries',async()=>{
  const f=setup(2),erase=f.input.objects.delete;let fail=true;
  f.input.objects.delete=async key=>{if(fail)throw Error('provider offline');await erase(key);};
  await assert.rejects(f.run(owner),/provider offline/);assert.equal(f.rows[0].state,'deleting');assert.equal(f.keys.size,2);
  fail=false;assert.deepEqual(await f.run(owner),{verified:2,next:null});assert.equal(f.keys.size,0);
});
test('DELETE acknowledgement without absence never advances to deleted',async()=>{
  const f=setup();f.input.objects.delete=async()=>{};
  await assert.rejects(f.run(owner),e=>e.code==='artifact_erasure_unverified');assert.equal(f.rows[0].state,'deleting');
});
test('lost fence during provider I/O prevents success and preserves retry evidence',async()=>{
  const f=setup(),erase=f.input.objects.delete;f.input.objects.delete=async key=>{await erase(key);f.unfence();};
  await assert.rejects(f.run(owner),e=>e.code==='account_erasure_not_fenced');assert.equal(f.rows[0].state,'deleting');
});
test('repository scope mismatch cannot delete another owner object',async()=>{
  const f=setup();f.input.repository.list=async()=>[{...f.rows[0],userId:'user_other'}];
  await assert.rejects(f.run(owner),e=>e.code==='account_erasure_scope_mismatch');assert.equal(f.keys.size,1);
});
test('S3 HEAD absence accepts only 404, never access denied or provider failure',async()=>{
  const key='work-artifacts/'+'a'.repeat(64)+'/media-artifact_019a0000-0000-7000-8000-000000000001.txt';
  for(const status of [200,404,403,500]) {
    let request;const store=createArtifactS3({endpoint:'https://storage.example.com',bucket:'private-files',region:'eu-west-1',accessKey:'key',secretKey:'x'.repeat(32),
      fetchImpl:async(_url,options)=>{request=options;return new Response(null,{status});}});
    if(status===200)assert.equal(await store.isAbsent(key),false);
    else if(status===404)assert.equal(await store.isAbsent(key),true);
    else await assert.rejects(store.isAbsent(key),/erasure_unverified/);
    assert.equal(request.method,'HEAD');assert.equal(request.redirect,'error');assert.match(request.headers.authorization,/AWS4-HMAC-SHA256/);
  }
});
