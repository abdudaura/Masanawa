import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verify } from './verify-evidence.mjs';

const sha = 'a'.repeat(40), now = new Date('2026-10-09T21:45:00Z');
function withFixture(fn) {
  const root = mkdtempSync(path.join(tmpdir(), 'af13-evidence-'));
  try {
    mkdirSync(path.join(root, 'proof'));
    writeFileSync(path.join(root,'proof','log.txt'),'Passed native smoke check\n');
    const digest = createHash('sha256').update('Passed native smoke check\n').digest('hex');
    const matrix={schemaVersion:1,gates:[{id:'UX-A03',description:'Five-tab shell'},{id:'WF-A06',description:'Escrow dispute'}]};
    const evidence={schemaVersion:1,sourceSha:sha,evidence:[{id:'UX-A03',status:'PASS_REAL',sourceSha:sha,command:'node --test',environment:'Android 12, handset',executedAt:now.toISOString(),proof:{path:'proof/log.txt',sha256:digest}},{id:'WF-A06',status:'PASS_REAL',sourceSha:sha,command:'pg smoke test',environment:'Disposable PostgreSQL',executedAt:now.toISOString(),proof:{path:'proof/log.txt',sha256:digest}}]};
    const verifyFixture=(changes=()=>{},mode='release')=>{ changes(evidence,matrix,root);writeFileSync(path.join(root,'matrix.json'),JSON.stringify(matrix));writeFileSync(path.join(root,'evidence.json'),JSON.stringify(evidence));return verify({root,manifest:path.join(root,'evidence.json'),matrix:path.join(root,'matrix.json'),mode,now}); };
    fn({root,evidence,matrix,verifyFixture});
  } finally { rmSync(root,{recursive:true,force:true}); }
}
test('complete exact-SHA-bound evidence is accepted',()=>withFixture(({verifyFixture})=>assert.equal(verifyFixture().ready,true)));
test('missing gate prevents release',()=>withFixture(({verifyFixture})=>{let x=verifyFixture(e=>e.evidence.pop());assert.deepEqual(x.missing,['WF-A06']);assert.equal(x.ready,false)}));
test('simulated passes only integration, not release',()=>withFixture(({verifyFixture})=>{assert.equal(verifyFixture(e=>e.evidence[1].status='PASS_SIMULATED').ready,false);assert.equal(verifyFixture(e=>e.evidence[1].status='PASS_SIMULATED','integration').ready,true)}));
test('duplicates do not override earlier evidence',()=>withFixture(({verifyFixture})=>{let x=verifyFixture(e=>e.evidence.push({...e.evidence[0]}));assert.deepEqual(x.invalid,['UX-A03']);assert.equal(x.ready,false)}));
test('forged PASS_REAL without checked proof fails',()=>withFixture(({verifyFixture})=>{let x=verifyFixture(e=>e.evidence[0].proof.sha256='b'.repeat(64));assert.deepEqual(x.invalid,['UX-A03'])}));
test('source SHA mismatch fails closed',()=>withFixture(({verifyFixture})=>{let x=verifyFixture(e=>e.evidence[1].sourceSha='b'.repeat(40));assert.equal(x.ready,false);assert.deepEqual(x.invalid,['WF-A06'])}));
test('path traversal fails closed',()=>withFixture(({verifyFixture})=>{let x=verifyFixture(e=>e.evidence[0].proof.path='../outside.txt');assert.deepEqual(x.invalid,['UX-A03'])}));
test('symlink escaping checkout fails closed',()=>withFixture(({verifyFixture,root})=>{symlinkSync('/etc/hosts',path.join(root,'proof','link'));let x=verifyFixture(e=>e.evidence[0].proof.path='proof/link');assert.deepEqual(x.invalid,['UX-A03'])}));
test('future evidence fails closed',()=>withFixture(({verifyFixture})=>{let x=verifyFixture(e=>e.evidence[0].executedAt='2027-10-09T21:45:00Z');assert.deepEqual(x.invalid,['UX-A03'])}));
test('no evidence passes release',()=>withFixture(({verifyFixture})=>{let x=verifyFixture(e=>e.evidence=[]);assert.equal(x.ready,false);assert.equal(x.missing.length,2)}));
test('failed gate blocks even integration',()=>withFixture(({verifyFixture})=>{let x=verifyFixture(e=>e.evidence[0].status='FAIL','integration');assert.equal(x.ready,false);assert.deepEqual(x.failed,['UX-A03'])}));
