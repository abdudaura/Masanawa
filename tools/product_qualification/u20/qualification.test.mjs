import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyManifest,GATES,inspectEvidence,qualify,requiredKinds} from './qualification.mjs';
import {safeEnv,parseCount,runSuite} from './suite-runner.mjs';
const SHA='a'.repeat(40), HASH='b'.repeat(64);
const T1='2026-10-08T14:00:00.000Z', T2='2026-10-08T14:01:00.000Z';
function record(kind,overrides={}){
  return {kind,sourceSha:SHA,startedAt:T1,finishedAt:T2,environment:'sandbox',
    executed:true,testDoubles:false,exitCode:0,passed:2,failed:0,skipped:0,
    command:'disposable verification test',proofRef:'artifact:test-run-1',
    outputSha256:HASH,executor:'local test runner',deviceId:'android-test-device',
    providerRef:'sandbox-receipt',databaseRef:'disposable-db',
    authScenario:'A allowed, B denied',privacyScenario:'blocked contacts get no data',...overrides};
}
test('every required foundation and golden journey is present exactly once',()=>{
  assert.equal(GATES.length,58);assert.equal(new Set(GATES).size,58);
  for(const g of ['R01','R19','C01','C08','J01','J11','K01','K20'])assert.ok(GATES.includes(g));
});
test('manifest template is explicitly unexecuted and release blocked',()=>{
  const result=qualify(emptyManifest(SHA));
  assert.equal(result.summary.NOT_RUN,58);
  assert.equal(result.candidate,false);assert.equal(result.release,'BLOCKED');
});
test('invalid and unknown source SHA and schema are rejected',()=>{
  const m=emptyManifest(SHA);m.targetSha='short';m.schemaVersion=5;
  m.gates.UNKNOWN={state:'PASS',evidence:[]};
  assert.equal(qualify(m).errors.length,3);
});
test('declared PASS without evidence is INVALID',()=>{
  const m=emptyManifest(SHA);m.gates.R01={state:'PASS',evidence:[]};
  const result=qualify(m).gates[0];
  assert.equal(result.status,'INVALID');assert.match(result.reasons.join(' '),/without execution/);
});
test('skipped mocked failed or unexecuted assertions cannot count',()=>{
  for(const changed of [{skipped:1},{testDoubles:true},{exitCode:1},
    {executed:false},{passed:0},{failed:1}])
    assert.ok(inspectEvidence(record('integration',changed),SHA).length,JSON.stringify(changed));
});
test('stale SHA, forged future date and missing output hash fail',()=>{
  for(const changed of [{sourceSha:'c'.repeat(40)},
    {finishedAt:'2099-01-01T00:00:00Z'},{outputSha256:''},
    {startedAt:T2,finishedAt:T1}])
    assert.ok(inspectEvidence(record('unit',changed),SHA).length);
});
test('missing negative privacy and auth evidence prevents pass',()=>{
  const m=emptyManifest(SHA);
  m.gates.C02={state:'PASS',evidence:[record('integration'),
    record('database',{outputSha256:'c'.repeat(64)})]};
  const g=qualify(m).gates.find(x=>x.gate==='C02');
  assert.equal(g.status,'INVALID');
  assert.match(g.reasons.join(' '),/missing required auth evidence/);
  assert.match(g.reasons.join(' '),/missing required privacy evidence/);
});
test('real device and provider references enforced with safe typed kinds',()=>{
  assert.ok(inspectEvidence(record('device',{deviceId:''}),SHA).length);
  assert.ok(inspectEvidence(record('provider',{providerRef:''}),SHA).length);
  assert.ok(inspectEvidence(record('database',{databaseRef:''}),SHA).length);
  assert.ok(inspectEvidence(record('unknown'),SHA).length);
});
test('duplicate evidence checksum is not two independent tests',()=>{
  const m=emptyManifest(SHA);
  m.gates.R01={state:'PASS',evidence:[record('integration'),record('unit')]};
  assert.match(qualify(m).gates[0].reasons.join(' '),/duplicate output checksum/);
});
test('even fully populated PASS candidates do not authorize release',()=>{
  const m=emptyManifest(SHA);
  for(const gate of GATES)m.gates[gate]={
    state:'PASS',evidence:requiredKinds(gate).map((kind,i)=>record(kind,{
      outputSha256:i.toString(16).padStart(64,'0')
    }))
  };
  const r=qualify(m);
  assert.equal(r.candidate,true);assert.equal(r.release,'BLOCKED');
  assert.equal(r.summary.EVIDENCE_CANDIDATE,58);
});
test('contradictory and unexplained statuses are invalid',()=>{
  const m=emptyManifest(SHA);
  m.gates.R01={state:'FAIL',evidence:[]};
  m.gates.R02={state:'BLOCKED',evidence:[]};
  m.gates.R03={state:'NOT_RUN',evidence:[record('unit')]};
  assert.deepEqual(qualify(m).gates.slice(0,3).map(g=>g.status),
    ['INVALID','INVALID','INVALID']);
});
test('untrusted input cannot execute commands; non-object manifest fails closed',()=>{
  assert.equal(qualify(null).release,'BLOCKED');
  assert.equal(qualify([]).candidate,false);
  assert.equal(qualify({gates:{}}).candidate,false);
});
test('suite runner strips provider credentials and forces test mode',()=>{
  const env=safeEnv({PATH:'/bin',FLUTTERWAVE_SECRET_KEY:'danger',
    DATABASE_URL:'realdb',JWT_TOKEN:'x',HOME:'/home/test'});
  assert.equal(env.PATH,'/bin');assert.equal(env.FLUTTERWAVE_SECRET_KEY,undefined);
  assert.equal(env.DATABASE_URL,undefined);assert.equal(env.JWT_TOKEN,undefined);
  assert.equal(env.NODE_ENV,'test');
});
test('missing test counts cannot turn into invented success',()=>{
  assert.deepEqual(parseCount('All done'),{passed:null,failed:null,skipped:null});
  assert.deepEqual(parseCount('Tests  12 passed | 2 failed | 1 skipped'),
    {passed:12,failed:2,skipped:1});
});
test('arbitrary command IDs never run',()=>{
  assert.throws(()=>runSuite('rm -rf /','/'),/unrecognized suite/);
});
