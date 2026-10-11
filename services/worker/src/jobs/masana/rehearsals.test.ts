import {describe,it,expect} from 'vitest';
import {processMasanaRehearsal,type RehearsalPort,type DraftRun} from './rehearsals.js';
const run:DraftRun={tenantId:'tenant_one',runId:'run_one',characterId:'gwani',revision:3,mode:'post',prompt:'Write a test',attempt:1,leaseToken:'lease_one',draftProfile:{}};
describe('A04 worker does not publish or impersonate',()=>{
 it('stays disabled even if event exists',async()=>{
  let calls=0;
  const port:RehearsalPort={claim:async()=>{calls++;return run},complete:async()=>true,fail:async()=>{}};
  const result=await processMasanaRehearsal({tenantId:run.tenantId,runId:run.runId},port,
   {isVoiceQualified:async()=>true,run:async()=>({summary:'ok',previewText:'safe'})},false);
  expect(result).toBe('disabled');expect(calls).toBe(0);
 });
 it('passes a no-side-effects, draft-only contract into the runner',async()=>{
  let output:unknown;const port:RehearsalPort={claim:async()=>run,complete:async(_,preview)=>{output=preview;return true},fail:async()=>{}};
  await processMasanaRehearsal({tenantId:run.tenantId,runId:run.runId},port,
   {isVoiceQualified:async()=>true,run:async input=>{
    expect(input.approvedForPublic).toBe(false);expect(input.noSideEffects).toBe(true);
    expect(input.maxTokens).toBe(512);return {summary:'ok',previewText:'draft'}}},true);
  expect(output).toEqual({summary:'ok',previewText:'draft'});
 });
 it('fails closed when voice not qualified',async()=>{
  let error='';const port:RehearsalPort={claim:async()=>({...run,mode:'call'}),complete:async()=>{throw Error('must not complete')},fail:async(_,v)=>{error=v}};
  const s=await processMasanaRehearsal({tenantId:run.tenantId,runId:run.runId},port,
   {isVoiceQualified:async()=>false,run:async()=>{throw Error('must not run')}},true);
  expect(s).toBe('failed');expect(error).toBe('voice_not_qualified');
 });
});