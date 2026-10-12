// Executable source unit/SQL-contract regressions, not PostgreSQL or device E2E.
// Node 24: node --experimental-transform-types tests/e2e/J06/status_authorization.test.mjs
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
// Workspace TS uses emitted .js import specifiers. Resolve their original
// source when running without the emitted build; never rewrite implementation.
registerHooks({resolve(specifier,context,next){
 if(specifier.startsWith('./')&&specifier.endsWith('.js')&&context.parentURL?.endsWith('.ts')){
  const source=new URL(specifier.slice(0,-3)+'.ts',context.parentURL);
  if(existsSync(fileURLToPath(source)))return next(source.href,context);
 }
 return next(specifier,context);
}});
const {FeedService,EditorialReviewService}=await import('../../../packages/feed/src/index.ts');
const {PgHomeFeedRepository}=await import('../../../adapters/storage/postgres/src/home_feed/repository.ts');
const {PgEditorialReviewRepository}=await import('../../../adapters/storage/postgres/src/home_feed/review_repository.ts');
const id='381026c2-9d56-47b1-b73d-1784e24e41e2';
const input={authorMasanaId:'masana',kind:'text',body:' Status ',idempotencyKey:'status-request-001'};
const masana={kind:'masana',tenantId:'tenant',id:'masana',approved:true};
const fan={kind:'fan',tenantId:'tenant',id:'fan'};
function store(){
 const calls=[];
 return {calls,publish:async(...args)=>{calls.push(args);return {id};},
 find:async()=>null,list:async()=>[],setLike:async()=>{throw Error('unexpected write');},
 setSave:async()=>{throw Error('unexpected write');}};
}
test('humans, editorial staff, spoofed and unapproved Masana cannot publish',async()=>{
 const repo=store(),service=new FeedService(repo,async()=>true);
 for(const actor of [fan,{kind:'staff',tenantId:'tenant',id:'staff',permissions:['content_editor']},
  {...masana,id:'other'},{...masana,approved:false},{...masana,approved:'true'}]){
  await assert.rejects(service.publish(actor,input),{status:403,code:'masana_only_publish'});
 }
 assert.equal(repo.calls.length,0);
});
test('revoked approval denies; restored canonical approval permits original identity once per call',async()=>{
 const repo=store();let approved=false;
 const service=new FeedService(repo,async(tenant,author)=>approved&&tenant==='tenant'&&author==='masana');
 await assert.rejects(service.publish(masana,input),{code:'masana_not_approved'});
 approved=true;
 await service.publish(masana,input);
 assert.deepEqual(repo.calls,[['tenant','masana',{...input,body:'Status',media:[],transcript:null}]]);
});
test('foreign media and malformed text are denied without storage writes',async()=>{
 const repo=store(),service=new FeedService(repo,async()=>true);
 await assert.rejects(service.publish(masana,{...input,kind:'image',media:['media_abcdefgh']}),{code:'media_not_approved'});
 await assert.rejects(service.publish(masana,{...input,body:null}),{code:'invalid_post_text'});
 await assert.rejects(service.publish(masana,{...input,transcript:{}}),{code:'invalid_post_text'});
 assert.equal(repo.calls.length,0);
});
test('staff still use existing draft/review authority; self approval remains denied',async()=>{
 let created=0,changed=0;
 const repo={create:async()=>{created++;return {id,state:'draft'};},
  get:async()=>({id,createdBy:'editor',authorMasanaId:'masana',media:[]}),
  change:async()=>{changed++;}};
 const editor={kind:'staff',tenantId:'tenant',id:'editor',permissions:['content_editor']};
 const service=new EditorialReviewService(repo,async()=>true,async()=>true);
 await service.create(editor,input);
 await assert.rejects(service.change(editor,id,'approve',0,'review-request-001'),{code:'separate_reviewer_required'});
 assert.equal(created,1);assert.equal(changed,0);
});
test('tenant-foreign or withdrawn post rejects reactions before repository writes',async()=>{
 const service=new FeedService(store(),async()=>true);
 await assert.rejects(service.like(fan,id,true),{status:404});
 await assert.rejects(service.save({...fan,tenantId:'foreign'},id,true),{status:404});
});
function eligible(sql){
 for(const required of ["m.state='approved'","a.state='active'","o.kind='platform'",
  'a.tenant_id=m.tenant_id','o.tenant_id=a.tenant_id',
  'm.tenant_id=p.tenant_id','m.character_id=p.author_masana_id']){
  assert.ok(sql.includes(required),required);
 }
}
test('feed/detail/comment reads use current approved active platform author and tenant binds',async()=>{
 const calls=[],repo=new PgHomeFeedRepository({query:async(sql,args)=>{calls.push([sql,args]);return {rows:[]};}});
 await repo.list('tenant','fan','following',null,21);
 assert.deepEqual(calls.at(-1)[1],['tenant','fan','following',null,null,21]);
 assert.ok(calls.at(-1)[0].includes('FROM masana.follows'));
 await repo.find('tenant','fan',id);
 await repo.comments('tenant',id,'fan',null,30);
 for(const [sql] of calls)eligible(sql);
});
test('revocation between service read and reaction insert returns 404; duplicate authorized retry succeeds',async()=>{
 let admitted=false;const calls=[];
 const repo=new PgHomeFeedRepository({query:async(sql,args)=>{calls.push([sql,args]);return {rows:[{admitted}]};}});
 for(const method of ['setLike','setSave']){
  await assert.rejects(repo[method]('tenant','fan',id,true),{status:404,code:'post_not_found'});
  eligible(calls.at(-1)[0]);assert.deepEqual(calls.at(-1)[1],['tenant','fan',id]);
  admitted=true;assert.equal(await repo[method]('tenant','fan',id,true),true);admitted=false;
 }
});
test('comment admission cannot enqueue a withdrawn or foreign-author post',async()=>{
 let sql;const repo=new PgHomeFeedRepository({query:async(q)=>{sql=q;return {rows:[]};}});
 await assert.rejects(repo.comment('tenant','fan',id,'question','comment-request-001',true),{status:409});
 eligible(sql);assert.ok(sql.includes('FROM inserted i'));
 assert.ok(sql.includes("WHERE i.state='pending'"));
});
test('repository direct publication requires canonical author identity and refuses denied insert',async()=>{
 const calls=[],repo=new PgHomeFeedRepository({query:async(sql,args)=>{calls.push([sql,args]);return {rows:[]};}});
 await assert.rejects(repo.publish('tenant','staff',{...input,body:'Status',media:[],transcript:null}),{status:403});
 const sql=calls[0][0];
 for(const clause of ['a.tenant_id=$1','a.character_id=$3','$2=$3',"a.state='active'","o.kind='platform'","m.state='approved'"]){
  assert.ok(sql.includes(clause),clause);
 }
});

function editorialEligibility(sql){
 for(const clause of ["cr.state='approved'","c.state='active'","o.kind='platform'",
  'cr.tenant_id=feed.posts.tenant_id','cr.character_id=feed.posts.author_masana_id'])assert.ok(sql.includes(clause),clause);
}
test('immediate editorial approval checks author eligibility in final SQL CAS and rolls back denied publication',async()=>{
 const calls=[];
 const query=async(sql,args)=>{
  calls.push([sql,args]);
  if(sql.includes('FOR UPDATE'))return {rowCount:1,rows:[{id,tenant_id:'tenant',author_masana_id:'masana',
   state:'in_review',review_revision:1,published_by:'author'}]};
  return {rowCount:0,rows:[]};
 };
 const repo=new PgEditorialReviewRepository({connect:async()=>({query,release(){}})});
 await assert.rejects(repo.change('tenant',id,'reviewer',1,'approve','approve-request-002',null),{status:409});
 editorialEligibility(calls.find(([sql])=>sql.startsWith('UPDATE feed.posts'))[0]);
 assert.ok(calls.some(([sql])=>sql==='ROLLBACK'));
 assert.ok(!calls.some(([sql])=>sql.startsWith('INSERT INTO feed.editorial_events')));
});
test('scheduled release retains queued post and emits no publication audit on live author denial',async()=>{
 const calls=[],repo=new PgEditorialReviewRepository({connect:async()=>({
  query:async(sql,args)=>{calls.push([sql,args]);return {rowCount:0,rows:[]};},release(){}})});
 assert.equal(await repo.releaseScheduled('tenant',id,1,new Date('2026-10-12T10:00:00Z')),false);
 editorialEligibility(calls.find(([sql])=>sql.startsWith('UPDATE feed.posts'))[0]);
 assert.ok(!calls.some(([sql])=>sql.startsWith('INSERT INTO feed.editorial_events')));
});
