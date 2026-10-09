import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { parseJourneyIds, validateManifest } from './evidence-gate.mjs';

const doc = 'Acceptance UX-A01, UX-A02; WF-A01 WF-A06; PF-A04 and DB-A01.';
const sha = 'a'.repeat(40);
const base = () => ({ schemaVersion: 1, targetSha: sha, observations: [] });
const proof = (journeyId, kind='real') => ({
  journeyId,
  status: kind === 'real' ? 'PASS_REAL' : 'PASS_SIMULATED',
  sourceSha: sha,
  observedAt: '2026-10-09T21:10:00Z',
  execution: {
    kind, steps: 3, assertions: ['status_readback'], evidenceRefs: ['sha-proof-abcdef'],
    dependencies: ['postgresql'], environment: 'disposable_staging', actorRoles: 'user_operator'
  }
});

test('expands explicit UX acceptance ranges rather than silently omitting journeys', () => {
  const ids = parseJourneyIds('UX-A01–UX-A12 and WF-A01-WF-A03');
  assert.equal(ids.length, 15);
  assert.ok(ids.includes('UX-A07'));
  assert.ok(ids.includes('WF-A02'));
});
test('acceptance IDs are unique and sorted without inventing missing IDs', () => {
  assert.deepEqual(parseJourneyIds(doc), ['DB-A01', 'PF-A04', 'UX-A01', 'UX-A02', 'WF-A01', 'WF-A06']);
});
test('empty manifest is valid as a NOT_RUN baseline but cannot release', () => {
  const r = validateManifest(base(), doc);
  assert.equal(r.valid, true);
  assert.equal(r.expectedCount, 6);
  assert.equal(r.missing.length, 6);
  assert.equal(r.verifiedE2E, false);
  assert.equal(r.releaseAuthorized, false);
  assert.equal(r.allRealClaimed, false);
});
test('require-all-real rejects untested baseline', () => {
  assert.equal(validateManifest(base(), doc, {requireAllReal:true}).preflightPassed, false);
});
test('mock cannot impersonate PASS_REAL', () => {
  const m = base(); m.observations.push({...proof('WF-A01', 'simulated'), status:'PASS_REAL'});
  const r=validateManifest(m,doc); assert.equal(r.valid,false); assert.match(r.errors.join(' '),/PASS_REAL/);
});
test('source mismatch cannot claim evidence for another revision', () => {
  const m=base(); m.observations.push({...proof('WF-A01'),sourceSha:'b'.repeat(40)});
  assert.match(validateManifest(m,doc).errors.join(' '),/sourceSha/);
});
test('zero-step and empty evidence are rejected', () => {
  const m=base(); const p=proof('UX-A01'); p.execution.steps=0; p.execution.evidenceRefs=[]; m.observations.push(p);
  assert.equal(validateManifest(m,doc).valid,false);
});
test('duplicated and unknown journeys fail closed', () => {
  const m=base(); m.observations=[proof('WF-A01'),proof('WF-A01'),proof('WF-A99')];
  const r=validateManifest(m,doc);
  assert.equal(r.valid,false);
  assert.match(r.errors.join(' '),/duplicate observation/);
  assert.match(r.errors.join(' '),/unknown journey/);
});
test('blocked and failure states require explanatory reasons', () => {
  const m=base(); m.observations=[{journeyId:'WF-A01',status:'BLOCKED',reason:'no'}];
  assert.equal(validateManifest(m,doc).valid,false);
  m.observations[0].reason='Real database not provisioned';
  assert.equal(validateManifest(m,doc).valid,true);
});
test('even complete self-reported real evidence requires human verification', () => {
  const m=base(); m.observations=parseJourneyIds(doc).map(id=>proof(id));
  const r=validateManifest(m,doc,{requireAllReal:true});
  assert.equal(r.preflightPassed,true);
  assert.equal(r.allRealClaimed,true);
  assert.equal(r.reviewRequired,true);
  assert.equal(r.verifiedE2E,false);
  assert.equal(r.releaseAuthorized,false);
});
test('unsafe evidence references are rejected without echo', () => {
  const m=base(); const p=proof('PF-A04'); p.execution.evidenceRefs=['../../secrets']; m.observations.push(p);
  const r=validateManifest(m,doc);
  assert.equal(r.valid,false);
  assert.ok(!JSON.stringify(r).includes('../../secrets'));
});
test('manifest types and artifact hashes are bounded', () => {
  assert.equal(validateManifest([],doc).valid,false);
  const m=base(); m.targetArtifact={sha256:'BAD',packageId:'com.example.app',version:'1.0'};
  assert.equal(validateManifest(m,doc).valid,false);
});
test('CLI produces structured safe report and distinct incomplete exit code', () => {
  const dir=mkdtempSync(join(tmpdir(),'af13-'));
  try {
    const manifest=join(dir,'m.json'); const journeys=join(dir,'journeys.md');
    writeFileSync(manifest, JSON.stringify(base())); writeFileSync(journeys,doc);
    const cli=join(dirname(fileURLToPath(import.meta.url)),'evidence-gate.mjs');
    const result=spawnSync(process.execPath,[cli,'--manifest',manifest,'--journeys',journeys,'--require-all-real'],{encoding:'utf8'});
    assert.equal(result.status,2);
    const report=JSON.parse(result.stdout); assert.equal(report.releaseAuthorized,false);
    assert.equal(report.missing.length,6);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
