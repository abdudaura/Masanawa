import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createArtifactService, textBytes } from '../service.ts';
import { createArtifactS3 } from '../private_store.ts';
import { createArtifactRepository, sweepArtifacts } from '../postgres.ts';
import { createArtifactTaskAdapter } from '../task_adapter.ts';

const uid=(kind,n)=>`${kind}_019a0000-0000-7000-8000-${String(n).padStart(12,'0')}`;
const a={tenantId:uid('tenant',1),userId:uid('user',1)}, b={...a,userId:uid('user',2)}, c={...a,userId:uid('user',3)};
const copy=x=>structuredClone(x);
function repository() {
  const rows=new Map();
  return {rows,
    async reserve(row) {const existing=[...rows.values()].find(x=>x.tenantId===row.tenantId&&x.userId===row.userId&&x.requestId===row.requestId);
      if(existing)return copy(existing); rows.set(row.id,copy(row));return copy(row);},
    async find(tenant,id) {const row=rows.get(id);return row?.tenantId===tenant?copy(row):null;},
    async findRequest(owner,requestId) {const row=[...rows.values()].find(r=>r.tenantId===owner.tenantId&&r.userId===owner.userId&&r.requestId===requestId);return row?copy(row):null;},
    async change(owner,id,rev,patch) {const row=rows.get(id);if(!row||row.tenantId!==owner.tenantId||row.userId!==owner.userId||row.revision!==rev)return null;
      const updated={...row,...copy(patch),revision:rev+1};rows.set(id,updated);return copy(updated);},
    async list(owner,after,limit) {return [...rows.values()].filter(x=>x.tenantId===owner.tenantId&&x.userId===owner.userId&&(!after||x.id>after)).sort((x,y)=>x.id.localeCompare(y.id)).slice(0,limit).map(copy);},
    async cleanupCandidates(limit) {return [...rows.values()].filter(x=>['deleting','revoked','deleted'].includes(x.state)).slice(0,limit).map(copy);},
  };
}
async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'masanawa-u07-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const repo=repository();let clock=Date.parse('2026-10-09T00:00:00Z'),sequence=0,allowed=true;
  const objects={async put(key,bytes){const p=join(root,key);await mkdir(dirname(p),{recursive:true});await writeFile(p,bytes);},
    async get(key,max){const bytes=await readFile(join(root,key));if(bytes.length>max)throw Error('oversize');return bytes;},
    async delete(key){await rm(join(root,key),{force:true});}};
  const deps={repository:repo,objects,ticketSecret:Buffer.alloc(32,1),
    createId:()=>uid('media-artifact',++sequence),
    assertId:(kind,value)=>assert.match(value,new RegExp(`^${kind}_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)),
    canShare:async(_o,u)=>allowed&&u===b.userId,authorizeTask:async()=>false,admitCreation:async()=>true,now:()=>new Date(clock)};
  const service=createArtifactService(deps);
  const request={requestId:uid('request',1),filename:'Hausa lesson.txt',text:'Sannu! مرحبا 👋\nA real lesson.',ttlSeconds:3600};
  return {repo,objects,deps,service,request,root,advance:ms=>{clock+=ms;},block:()=>{allowed=false;}};
}
const errorCode=code=>e=>e.code===code;
test('real UTF-8 file -> storage readback -> signed authenticated bytes; metadata hides key',async t=>{
  const f=await fixture(t), artifact=await f.service.saveText(a,f.request);
  assert.equal(artifact.state,'ready');assert.equal('objectKey' in artifact,false);
  const ticket=await f.service.ticket(a,artifact.id);
  const file=await f.service.download(a,artifact.id,ticket.ticket);
  assert.equal(file.bytes.toString('utf8'),f.request.text);assert.equal(file.bytes.length,artifact.sizeBytes);
  assert.equal((await createArtifactService(f.deps).get(a,artifact.id)).id,artifact.id);
});
test('retry same request is one file, different bytes/filename/lifetime conflicts',async t=>{
  const f=await fixture(t), one=await f.service.saveText(a,f.request), two=await f.service.saveText(a,f.request);
  assert.equal(one.id,two.id);assert.equal(f.repo.rows.size,1);
  for(const patch of [{text:'different'},{filename:'other.txt'},{ttlSeconds:4000}])
    await assert.rejects(f.service.saveText(a,{...f.request,...patch}),errorCode('idempotency_conflict'));
});
test('missing or corrupt stored object never becomes ready',async t=>{
  const f=await fixture(t);f.objects.get=async()=>Buffer.from('invented file');
  const result=await f.service.saveText(a,f.request);assert.equal(result.state,'failed');
  await assert.rejects(f.service.ticket(a,result.id),errorCode('artifact_unavailable'));
});
test('lost PUT response recovers existing bytes without rerunning generation',async t=>{
  const f=await fixture(t),put=f.objects.put;let calls=0;
  f.objects.put=async(...args)=>{calls++;await put(...args);throw Error('lost response');};
  const row=await f.service.saveText(a,f.request);assert.equal(row.state,'failed');
  assert.equal((await f.service.recover(a,row.id)).state,'ready');assert.equal(calls,1);
});
test('process loss after reserve is pending; recovery cannot invent missing bytes',async t=>{
  const f=await fixture(t);let release;
  const barrier=new Promise(r=>{release=r;}),put=f.objects.put;
  f.objects.put=async(...args)=>{await barrier;return put(...args);};
  const pending=f.service.saveText(a,f.request);
  while(f.repo.rows.size===0)await new Promise(r=>setImmediate(r));
  const existing=await f.service.saveText(a,f.request);assert.equal(existing.state,'generating');
  assert.equal((await f.service.recover(a,existing.id)).state,'generating');
  release();assert.equal((await pending).state,'ready');assert.equal(f.repo.rows.size,1);
});
test('cross-account and cross-tenant reads, delete and ticket are denied',async t=>{
  const f=await fixture(t),row=await f.service.saveText(a,f.request);
  for(const actor of [b,{...a,tenantId:uid('tenant',2)}]) {
    await assert.rejects(f.service.get(actor,row.id),errorCode('not_found'));
    await assert.rejects(f.service.remove(actor,row.id),errorCode('not_found'));
    await assert.rejects(f.service.ticket(actor,row.id),errorCode('not_found'));
  }
});
test('explicit recipient grant permits only recipient; no transitive sharing',async t=>{
  const f=await fixture(t),row=await f.service.saveText(a,f.request);
  await f.service.share(a,row.id,row.revision,b.userId,600);
  const view=await f.service.get(b,row.id);assert.equal(view.owned,false);assert.deepEqual(view.sharedWith,[]);
  const ticket=await f.service.ticket(b,row.id);assert.equal((await f.service.download(b,row.id,ticket.ticket)).bytes.toString(),f.request.text);
  await assert.rejects(f.service.download(c,row.id,ticket.ticket),errorCode('invalid_ticket'));
  await assert.rejects(f.service.share(b,row.id,view.revision,c.userId,600),errorCode('not_found'));
});
test('current contact block and revoked artifact invalidate issued ticket',async t=>{
  const f=await fixture(t),row=await f.service.saveText(a,f.request);
  const shared=await f.service.share(a,row.id,row.revision,b.userId,60),ticket=await f.service.ticket(b,row.id);
  f.block();await assert.rejects(f.service.download(b,row.id,ticket.ticket),errorCode('not_found'));
  const ownTicket=await f.service.ticket(a,row.id);await f.service.revoke(a,row.id,shared.revision);
  await assert.rejects(f.service.download(a,row.id,ownTicket.ticket),errorCode('artifact_unavailable'));
});
test('expired grant and file cannot obtain fresh download authority',async t=>{
  const f=await fixture(t),row=await f.service.saveText(a,f.request);
  await f.service.share(a,row.id,row.revision,b.userId,60);f.advance(61000);
  await assert.rejects(f.service.ticket(b,row.id),errorCode('not_found'));
  f.advance(3600000);await assert.rejects(f.service.ticket(a,row.id),errorCode('artifact_unavailable'));
});
test('task cancellation during upload prevents ready state and later recovery',async t=>{
  const f=await fixture(t);let admitted=true;const put=f.objects.put;
  const service=createArtifactService({...f.deps,authorizeTask:async()=>admitted});
  f.objects.put=async(...args)=>{await put(...args);admitted=false;};
  await assert.rejects(service.generatedText(a,f.request,uid('task',1),uid('operation',1)),errorCode('task_not_admitted'));
  const row=[...f.repo.rows.values()][0];assert.equal(row.state,'revoked');
  assert.equal((await service.recover(a,row.id)).state,'revoked');
});
test('ticket expiry, tampering and changed sharing revision are rejected',async t=>{
  const f=await fixture(t),row=await f.service.saveText(a,f.request),ticket=await f.service.ticket(a,row.id);
  await assert.rejects(f.service.download(a,row.id,ticket.ticket+'x'),errorCode('invalid_ticket'));
  const [payload]=ticket.ticket.split('.');
  await assert.rejects(f.service.download(a,row.id,payload+'.'+'é'.repeat(43)),errorCode('invalid_ticket'));
  await f.service.share(a,row.id,row.revision,b.userId,60);
  await assert.rejects(f.service.download(a,row.id,ticket.ticket),errorCode('invalid_ticket'));
  const fresh=await f.service.ticket(a,row.id);f.advance(61000);
  await assert.rejects(f.service.download(a,row.id,fresh.ticket),errorCode('invalid_ticket'));
});
test('malformed canonical request, recipient and cursor are non-retryable validation errors',async t=>{
  const f=await fixture(t);
  await assert.rejects(f.service.saveText(a,{...f.request,requestId:'invalid'}),e=>e.code==='invalid_reference'&&e.statusCode===400);
  assert.equal(f.repo.rows.size,0);
  const row=await f.service.saveText(a,f.request);
  await assert.rejects(f.service.share(a,row.id,row.revision,'invalid',60),e=>e.code==='invalid_reference'&&e.statusCode===400);
  await assert.rejects(f.service.list(a,'invalid'),e=>e.code==='invalid_reference'&&e.statusCode===400);
});
test('revocation while object read is pending prevents returned bytes',async t=>{
  const f=await fixture(t),row=await f.service.saveText(a,f.request),ticket=await f.service.ticket(a,row.id),get=f.objects.get;
  f.objects.get=async(...args)=>{const bytes=await get(...args);await f.service.revoke(a,row.id,row.revision);return bytes;};
  await assert.rejects(f.service.download(a,row.id,ticket.ticket),errorCode('artifact_unavailable'));
});
test('checksum drift after generation is detected before download',async t=>{
  const f=await fixture(t),row=await f.service.saveText(a,f.request),ticket=await f.service.ticket(a,row.id);
  await f.objects.put(f.repo.rows.get(row.id).objectKey,Buffer.from('changed'));
  await assert.rejects(f.service.download(a,row.id,ticket.ticket),errorCode('integrity_failed'));
});
test('deletion failure remains durable and inaccessible until retry succeeds',async t=>{
  const f=await fixture(t),row=await f.service.saveText(a,f.request),del=f.objects.delete;
  f.objects.delete=async()=>{throw Error('offline');};await assert.rejects(f.service.remove(a,row.id));
  assert.equal((await f.service.get(a,row.id)).state,'deleting');
  await assert.rejects(f.service.ticket(a,row.id),errorCode('artifact_unavailable'));
  f.objects.delete=del;assert.equal((await f.service.remove(a,row.id)).state,'deleted');
  assert.equal((await f.service.remove(a,row.id)).state,'deleted');
});
test('stale revisions cannot regrant revoked file and operator origin is authorized',async t=>{
  const f=await fixture(t),row=await f.service.saveText(a,f.request);await f.service.revoke(a,row.id,row.revision);
  await assert.rejects(f.service.share(a,row.id,row.revision,b.userId,60),errorCode('revision_conflict'));
  await assert.rejects(f.service.generatedText(a,{...f.request,requestId:uid('request',2)},uid('task',1),uid('operation',1)),errorCode('not_found'));
});
test('bounded plain text rejects malformed UTF-8, control characters, filename injection and size',async t=>{
  for(const value of ['',null,'a\0b','\ud800','x'.repeat(262145),'👋'.repeat(70000)])assert.throws(()=>textBytes(value));
  const f=await fixture(t);
  for(const filename of ['../file.txt','a.html','a\r\n.txt'])await assert.rejects(f.service.saveText(a,{...f.request,filename}));
  assert.equal(textBytes('<script>alert(1)</script>').toString(),'<script>alert(1)</script>'); // inert plain text only
});
test('pagination is owner-scoped and bounded; quota denial creates no rows',async t=>{
  const f=await fixture(t);
  for(let i=1;i<=32;i++)await f.service.saveText(a,{...f.request,requestId:uid('request',i)});
  const page=await f.service.list(a);assert.equal(page.items.length,30);assert.ok(page.next);
  assert.equal((await f.service.list(a,page.next)).items.length,2);assert.equal((await f.service.list(b)).items.length,0);
  const limited=createArtifactService({...f.deps,admitCreation:async()=>false});
  await assert.rejects(limited.saveText(a,{...f.request,requestId:uid('request',90)}),errorCode('rate_limited'));assert.equal(f.repo.rows.size,32);
});
test('sweeper retries failed deletion and erases late objects behind tombstones',async t=>{
  const f=await fixture(t),row=await f.service.saveText(a,f.request),key=f.repo.rows.get(row.id).objectKey;
  await f.service.remove(a,row.id);await f.objects.put(key,Buffer.from('late PUT'));
  assert.deepEqual(await sweepArtifacts(f.repo,f.service.remove,f.objects.delete),{deleted:1,failed:0});
  await assert.rejects(f.objects.get(key,262144));
});
test('private S3 adapter signs text/SSE, refuses redirects and bounds streamed data',async()=>{
  const key='work-artifacts/'+'a'.repeat(64)+'/'+uid('media-artifact',1)+'.txt',seen=[];
  const store=createArtifactS3({endpoint:'https://objects.example',bucket:'private-artifacts',region:'eu-west-1',accessKey:'key',secretKey:'secret'.repeat(8),
    fetchImpl:async(url,init)=>{seen.push({url,init});return new Response(init.method==='GET'?new Uint8Array(20):null,{status:200});}});
  await store.put(key,Buffer.from('real text'));
  assert.equal(seen[0].init.headers['x-amz-server-side-encryption'],'AES256');assert.equal(seen[0].init.redirect,'error');
  assert.match(seen[0].init.headers.authorization,/SignedHeaders=cache-control;content-type;host/);
  await assert.rejects(store.get(key,10),/artifact_too_large/);await assert.rejects(store.get('../secret',10));
  await store.delete(key);
});
test('Postgres reservation gets fresh snapshot after conflict; CAS carries tenant and owner',async()=>{
  const calls=[],db={async query(sql,values){calls.push({sql,values});return {rows:[]};}},repo=createArtifactRepository(db);
  await assert.rejects(repo.reserve({...a,id:'id',requestId:'request',provenance:{kind:'user-text'}}),/reservation_unavailable/);
  assert.equal(calls.length,2);assert.match(calls[0].sql,/DO NOTHING/);assert.match(calls[1].sql,/tenant_id=\$1 AND user_id=\$2/);
  assert.equal(await repo.change(a,'id',2,{state:'revoked',grants:[]}),null);
  assert.deepEqual(calls[2].values.slice(0,4),[a.tenantId,a.userId,'id',2]);
});
test('U02 task adapter persists once, confirms only file readback and rejects cancelled/forged scope',async t=>{
  const f=await fixture(t),actor={...a,sessionDigest:'a'.repeat(64)};
  let task={...a,taskId:uid('task',1),operationId:uid('operation',1),capabilityId:'files.create',capabilityVersion:1,scope:'private-assistant',phase:'running'};
  const service=createArtifactService({...f.deps,authorizeTask:async()=>true});
  const adapter=createArtifactTaskAdapter({service,repository:f.repo,readTask:async()=>task});
  assert.deepEqual(await adapter.reconcile(actor,task.taskId),{status:'unknown'});
  const doc={filename:f.request.filename,text:f.request.text,ttlSeconds:3600};
  const file=await adapter.persist(actor,task.taskId,doc);
  assert.equal('sessionDigest' in file,false);assert.equal('sessionDigest' in f.repo.rows.get(file.id),false);
  assert.equal((await adapter.persist(actor,task.taskId,doc)).id,file.id);
  assert.deepEqual(await adapter.reconcile(actor,task.taskId),{status:'confirmed',receiptRef:file.id});
  await f.objects.delete(f.repo.rows.get(file.id).objectKey);
  assert.deepEqual(await adapter.reconcile(actor,task.taskId),{status:'unknown'});
  task={...task,phase:'cancelled'};await assert.rejects(adapter.persist(actor,task.taskId,doc),errorCode('task_not_admitted'));
  task={...task,phase:'running',scope:'human-dm'};await assert.rejects(adapter.reconcile(actor,task.taskId),errorCode('task_not_admitted'));
});
