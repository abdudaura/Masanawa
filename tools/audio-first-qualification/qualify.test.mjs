import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {checkMatrix,checkRecord,assess,verifyProofs} from './qualify.mjs';
const sha='f381f077c485c04261459b77a42c215d3ce3a14b';
const mat={schemaVersion:1,contract:'AF-v1',journeys:[{id:'WF-A01',boundaries:['auth','database','provider'],tier:'release'}]};
const rec=(patch={})=>({journeyId:'WF-A01',result:'NOT_RUN',codeSha:sha,executedAt:new Date().toISOString(),boundaries:[],environment:{mode:'not_run'},...patch});
test('matrix checks IDs and duplicate entries',()=>{
 assert.deepEqual(checkMatrix(mat),[]);
 assert.ok(checkMatrix({...mat,journeys:[...mat.journeys,...mat.journeys]}).length>0);
});
test('no evidence stays BLOCKED, never verified',()=>{
 const q=assess(mat,[],sha);assert.equal(q.valid,true);assert.equal(q.readiness,'BLOCKED');
});
test('spoofed PASS_REAL without actual boundaries, proof or provider fails',()=>{
 const q=assess(mat,[rec({result:'PASS_REAL',boundaries:['database'],environment:{mode:'simulated'}})],sha);
 assert.equal(q.valid,false);assert.equal(q.readiness,'INVALID');
});
test('simulation cannot be mislabeled real',()=>{
 assert.ok(checkRecord(rec({result:'PASS_SIMULATED',environment:{mode:'real'}}),mat.journeys[0],sha).length);
});
test('failures and blocked evidence carry reasons',()=>{
 assert.ok(checkRecord(rec({result:'BLOCKED'}),mat.journeys[0],sha).length);
 assert.deepEqual(checkRecord(rec({result:'BLOCKED',reason:'No database credential available'}),mat.journeys[0],sha),[]);
});
test('SHA fencing and duplicate evidence',()=>{
 assert.equal(assess(mat,[rec({codeSha:'0'.repeat(40)})],sha).valid,false);
 assert.equal(assess(mat,[rec(),rec()],sha).valid,false);
});
test('secrets and identifying email rejected',()=>{
 assert.ok(checkRecord(rec({observation:'Bearer abcdefghijklmnopqrs'}),mat.journeys[0],sha).length);
 assert.ok(checkRecord(rec({observation:'person@example.com'}),mat.journeys[0],sha).length);
});
test('real proof requires verified checksum AND review remains necessary',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'af13-proof-'));
 try{
  const content='redacted DB/provider result';await writeFile(path.join(dir,'proof.txt'),content);
  const digest=createHash('sha256').update(content).digest('hex');
  const real=rec({result:'PASS_REAL',environment:{mode:'real',databaseRef:'disposable-db',providerRef:'provider-staging'},boundaries:['auth','database','provider'],proofs:[{path:'proof.txt',sha256:digest}],review:{reviewer:'Independent QA',reference:'approved-evidence-001'}});
  const v=await verifyProofs([real],dir);
  assert.deepEqual(v.errors,[]);
  const q=assess(mat,[real],sha,v.verified);assert.equal(q.valid,true);assert.equal(q.readiness,'REVIEW_REQUIRED');
  assert.equal(assess(mat,[real],sha).valid,false);
  const changed=rec({...real,proofs:[{path:'proof.txt',sha256:'0'.repeat(64)}]});
  const x=await verifyProofs([changed],dir);assert.ok(x.errors.length>0);
  const traversal=rec({...real,proofs:[{path:'../outside.txt',sha256:digest}]});
  assert.ok((await verifyProofs([traversal],dir)).errors.length);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('malformed proof object is rejected without exceptions',()=>{
 const real=rec({result:'PASS_REAL',environment:{mode:'real',databaseRef:'db',providerRef:'provider'},boundaries:mat.journeys[0].boundaries,proofs:'malformed',review:{reviewer:'QA',reference:'QA-1234'}});
 assert.doesNotThrow(()=>checkRecord(real,mat.journeys[0],sha));
 assert.ok(checkRecord(real,mat.journeys[0],sha).length>0);
});
test('device evidence needs a hashed APK proof, not just a user supplied APK string',()=>{
 const device={id:'UX-A05',boundaries:['device'],tier:'release'};
 const clip=rec({journeyId:'UX-A05',result:'PASS_REAL',environment:{mode:'real',physicalDevice:true,deviceOS:'Android 12'},apkSha256:'a'.repeat(64),boundaries:['device'],proofs:[{path:'run.log',sha256:'b'.repeat(64)}],review:{reviewer:'QA',reference:'QA-1234'}});
 assert.ok(checkRecord(clip,device,sha).some(x=>x.includes('APK')));
});
