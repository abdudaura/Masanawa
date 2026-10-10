import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {checkMatrix,checkCanonicalMatrix,checkRecord,assess,verifyProofs} from './qualify.mjs';
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


test('real evidence rejects symlinked internal file and symlinked parent even with correct hash',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'af13-internal-link-'));
 try{
  await mkdir(path.join(dir,'actual'));
  await writeFile(path.join(dir,'actual','proof.txt'),'evidence');
  await symlink(path.join(dir,'actual','proof.txt'),path.join(dir,'file-link.txt'));
  await symlink(path.join(dir,'actual'),path.join(dir,'dir-link'));
  const digest=createHash('sha256').update('evidence').digest('hex');
  const record=(proofPath)=>rec({result:'PASS_REAL',environment:{mode:'real',databaseRef:'db-staging',providerRef:'provider-test'},boundaries:mat.journeys[0].boundaries,proofs:[{path:proofPath,sha256:digest}],review:{reviewer:'QA reviewer',reference:'qa-case-0001'}});
  assert.deepEqual((await verifyProofs([record('actual/proof.txt')],dir)).errors,[]);
  for(const link of ['file-link.txt','dir-link/proof.txt']){
    const v=await verifyProofs([record(link)],dir);
    assert.equal(v.verified.size,0);
    assert.ok(v.errors.length>0);
    assert.equal(v.errors.join(' ').includes(link),false,'must not print untrusted proof paths');
    assert.equal(assess(mat,[record(link)],sha,v.verified).readiness,'INVALID');
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('uppercase digest compatibility and empty proof fail-closed',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'af13-proof-case-'));
 try{
  await writeFile(path.join(dir,'proof.txt'),'reviewed-redacted-data');
  await writeFile(path.join(dir,'empty.txt'),'');
  const digest=createHash('sha256').update('reviewed-redacted-data').digest('hex').toUpperCase();
  const fixture=(proofPath,hash)=>rec({result:'PASS_REAL',environment:{mode:'real',databaseRef:'db-staging',providerRef:'provider-test'},boundaries:mat.journeys[0].boundaries,proofs:[{path:proofPath,sha256:hash}],review:{reviewer:'QA reviewer',reference:'qa-case-0002'}});
  assert.deepEqual((await verifyProofs([fixture('proof.txt',digest)],dir)).errors,[]);
  const empty=await verifyProofs([fixture('empty.txt',createHash('sha256').update('').digest('hex'))],dir);
  assert.equal(empty.verified.size,0);assert.ok(empty.errors.length>0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

// Regression: a 43-ID matrix is not authoritative merely because IDs match.
// Release tiers and all mandatory real-world boundaries must be pinned too.
test('canonical matrix is immutable across CLI-supplied acceptance input',()=>{
 const canonical=JSON.parse(readFileSync(new URL('./journeys.json',import.meta.url),'utf8'));
 const copy=()=>JSON.parse(JSON.stringify(canonical));
 assert.deepEqual(checkCanonicalMatrix(copy(),canonical),[]);
 const downgraded=copy();
 const release=downgraded.journeys.find(j=>j.tier==='release');
 assert.ok(release,'canonical release-tier journey exists');
 release.tier='feature';
 assert.ok(checkCanonicalMatrix(downgraded,canonical).length>0,'cannot bypass a release requirement');
 const weakened=copy();
 const multi=weakened.journeys.find(j=>j.boundaries.length>1);
 assert.ok(multi,'canonical multi-boundary journey exists');
 multi.boundaries.pop();
 assert.ok(checkCanonicalMatrix(weakened,canonical).length>0,'cannot remove a real provider/DB/device boundary');
 const renamed=copy();
 renamed.journeys[0].id='UX-A99';
 assert.ok(checkCanonicalMatrix(renamed,canonical).length>0);
 assert.ok(checkCanonicalMatrix([],canonical).length>0);
 const badCanonical=copy();badCanonical.schemaVersion=2;
 assert.ok(checkCanonicalMatrix(copy(),badCanonical).length>0);
});

test('all eight DB restore and operations gates are mandatory to review release',()=>{
 const canonical=JSON.parse(readFileSync(new URL('./journeys.json',import.meta.url),'utf8'));
 const databaseGates=canonical.journeys.filter(j=>/^DB-A0[1-8]$/.test(j.id));
 assert.equal(databaseGates.length,8);
 assert.ok(databaseGates.every(j=>j.tier==='release'),'DB failures or missing restore cannot be feature-only');
 const report=assess(canonical,[],sha);
 assert.equal(report.valid,true);
 assert.equal(report.readiness,'BLOCKED');
 assert.equal(report.summary.release,35);
 assert.equal(report.journeys.filter(j=>j.id.startsWith('DB-')&&j.result==='NOT_RUN').length,8);
});
