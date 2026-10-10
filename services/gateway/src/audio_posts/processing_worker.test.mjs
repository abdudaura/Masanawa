import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioPostProcessingWorker } from './processing_worker.ts';
import { createPostgresAudioPostProcessingQueue } from '../../../../adapters/storage/postgres/src/audio_posts/processing_queue.ts';

const row = (postId, revision = 0) => ({
  tenantId: 'tenantA', postId, revision, createdAt: '2026-10-10T00:00:00.000Z',
});
function setup(outcomes = ['published']) {
  const calls = [], errors = [];
  let ix = 0, leased = true;
  const queue = {
    async listPending(input) { calls.push(['list', input]); return {items: [row('first')], nextCursor: null}; },
    async withLease(input, work) { calls.push(['lease', input]); return leased ? work() : null; },
  };
  const settler = { async settle(input) {
    calls.push(['settle', input]);
    const value = outcomes[ix++];
    if (value instanceof Error) throw value;
    return {status: value};
  }};
  const worker = createAudioPostProcessingWorker({queue, settler, onError: error => errors.push(error)});
  return {worker, queue, calls, errors, denyLock: () => leased = false};
}

test('processing publishes one verified pending post with tenant and exact revision', async () => {
  const f = setup();
  assert.deepEqual(await f.worker.runOnce({tenantId:'tenantA'}), {
    scanned:1, published:1, rejected:0, changed:0,
    leasedElsewhere:0, retryableErrors:0, nextCursor:null,
  });
  assert.deepEqual(f.calls[2], ['settle', {tenantId:'tenantA',postId:'first',expectedRevision:0}]);
});
test('moderation rejection becomes failed, not published', async () => {
  const f = setup(['failed']);
  const result = await f.worker.runOnce({tenantId:'tenantA'});
  assert.equal(result.rejected, 1); assert.equal(result.published, 0);
});
test('concurrent worker lease never double-settles same post', async () => {
  const f = setup(); f.denyLock();
  const result = await f.worker.runOnce({tenantId:'tenantA'});
  assert.equal(result.leasedElsewhere, 1);
  assert.equal(f.calls.filter(([name]) => name==='settle').length,0);
});
test('revision conflict is stale work, never retries with a different revision', async () => {
  const err = Object.assign(new Error('post changed'), {code:'CONFLICT'});
  const f = setup([err]);
  const result = await f.worker.runOnce({tenantId:'tenantA'});
  assert.equal(result.changed, 1); assert.equal(result.retryableErrors, 0);
});
test('transient moderation failure leaves durable processing row available for future sweep', async () => {
  const f = setup([new Error('provider down')]);
  const result = await f.worker.runOnce({tenantId:'tenantA'});
  assert.equal(result.retryableErrors,1); assert.equal(result.published,0);
  assert.equal(f.errors.length,1); assert.equal(f.errors[0].stage,'settle');
});
test('invalid tenant, page, duplicate rows and batch size fail closed', async () => {
  const f = setup();
  await assert.rejects(() => f.worker.runOnce({tenantId:'../other'}),/invalid_worker_scope/);
  assert.throws(() => createAudioPostProcessingWorker({queue:f.queue,settler:{settle(){}},onError(){},batchSize:100}), /invalid_worker_batch_size/);
  f.queue.listPending = async () => ({items:[row('first'),row('first')],nextCursor:null});
  await assert.rejects(() => f.worker.runOnce({tenantId:'tenantA'}),/invalid_pending_row/);
});
test('one page and continuation cursor are preserved without extra scanning', async () => {
  const f = setup();
  f.queue.listPending = async ({cursor}) => ({items:[row('second')],nextCursor:cursor?'next':'more'});
  const result = await f.worker.runOnce({tenantId:'tenantA',cursor:'previous'});
  assert.equal(result.nextCursor,'next'); assert.equal(result.scanned,1);
});

test('Postgres queue uses tenant-fenced parameterized keyset query and bounded pagination', async () => {
  const queries=[];
  const pool={query: async (sql,params)=>{
    queries.push([sql,params]);
    return {rows:[
      {tenant_id:'tenantA',post_id:'b',revision:0,created_at:new Date('2026-10-10T00:00:00Z')},
      {tenant_id:'tenantA',post_id:'a',revision:1,created_at:new Date('2026-10-09T00:00:00Z')},
    ]};
  }};
  const queue=createPostgresAudioPostProcessingQueue(pool);
  const one=await queue.listPending({tenantId:'tenantA',cursor:null,limit:1});
  assert.equal(one.items.length,1);assert.equal(one.items[0].postId,'b');
  assert.ok(one.nextCursor);assert.match(queries[0][0],/tenant_id=\$1 AND status='processing'/);
  assert.deepEqual(queries[0][1],['tenantA',null,'',2]);
  await queue.listPending({tenantId:'tenantA',cursor:one.nextCursor,limit:1});
  assert.ok(queries[1][1][1]?.startsWith('2026-10-10'));
  await assert.rejects(queue.listPending({tenantId:'tenantA',cursor:'!!!',limit:1}),/invalid_processing_cursor/);
});
test('keyset retains six-digit PG timestamps so pending posts in one millisecond are not skipped', async () => {
  const calls = [];
  const first = {tenant_id:'tenantA',post_id:'newer',revision:0,
    created_at:'2026-10-10T00:00:00.123456Z'};
  const second = {tenant_id:'tenantA',post_id:'older',revision:0,
    created_at:'2026-10-10T00:00:00.123455Z'};
  const pool = {query: async (sql, params) => {
    calls.push([sql,params]);
    return {rows: params[1] === null ? [first,second] : [second]};
  }};
  const queue = createPostgresAudioPostProcessingQueue(pool);
  const one = await queue.listPending({tenantId:'tenantA',cursor:null,limit:1});
  assert.equal(one.items[0].createdAt,first.created_at);
  assert.ok(one.nextCursor);
  const decoded = JSON.parse(Buffer.from(one.nextCursor,'base64url').toString('utf8'));
  assert.deepEqual(decoded,[first.created_at,'newer']);
  const two = await queue.listPending({tenantId:'tenantA',cursor:one.nextCursor,limit:1});
  assert.equal(two.items[0].postId,'older');
  assert.equal(calls[1][1][1],first.created_at);
  assert.match(calls[0][0],/created_at AT TIME ZONE 'UTC'/);
  assert.match(calls[0][0],/HH24:MI:SS.US/);
  assert.match(calls[0][0],/created_at,post_id\) < \(\$2::timestamptz,\$3\)/);
});

test('queue rejects rounded or corrupted cursor times instead of skipping unpublished posts', async () => {
  const queue = createPostgresAudioPostProcessingQueue({query: async () => ({rows:[]})});
  const invalid = Buffer.from(JSON.stringify(['2026-10-10T00:00:00.123Z','newer']))
    .toString('base64url');
  await assert.rejects(queue.listPending({tenantId:'tenantA',cursor:invalid,limit:1}),
    /invalid_processing_cursor/);
  const badPool = {query: async () => ({rows:[{
    tenant_id:'tenantA',post_id:'newer',revision:0,
    created_at:'2026-10-10T00:00:00.123Z',
  }]})};
  await assert.rejects(
    createPostgresAudioPostProcessingQueue(badPool)
      .listPending({tenantId:'tenantA',cursor:null,limit:1}),
    /invalid_pending_time/);
});

test('Postgres session advisory lock releases on success and failure', async () => {
  let unlocked=0, releaseArgs=[], workCount=0;
  const client={async query(sql,args){
    if(sql.includes('pg_try_advisory_lock')) return {rows:[{acquired:true}]};
    if(sql.includes('pg_advisory_unlock')){unlocked++;return {rows:[{released:true}]};}
    throw Error('unexpected SQL '+sql);
  },release(arg){releaseArgs.push(arg)}};
  const queue=createPostgresAudioPostProcessingQueue({connect:async()=>client});
  assert.equal(await queue.withLease({tenantId:'tenantA',postId:'b'},async()=>++workCount),1);
  await assert.rejects(queue.withLease({tenantId:'tenantA',postId:'b'},async()=>{throw Error('moderation down')}),/moderation down/);
  assert.equal(unlocked,2);assert.deepEqual(releaseArgs,[undefined,undefined]);
});
test('Postgres skips busy lock; unsafe unlock failure discards connection', async () => {
  let released;
  const client={async query(sql){return {rows:[sql.includes('pg_try')?{acquired:false}:{released:false}]}},release(arg){released=arg}};
  const queue=createPostgresAudioPostProcessingQueue({connect:async()=>client});
  assert.equal(await queue.withLease({tenantId:'tenantA',postId:'b'}, async()=>true),null);
  assert.equal(released,undefined);
  const locked={async query(sql){return {rows:[sql.includes('pg_try')?{acquired:true}:{released:false}]}},release(arg){released=arg}};
  const second=createPostgresAudioPostProcessingQueue({connect:async()=>locked});
  assert.equal(await second.withLease({tenantId:'tenantA',postId:'b'}, async()=>true),true);
  assert.ok(released instanceof Error);
});
