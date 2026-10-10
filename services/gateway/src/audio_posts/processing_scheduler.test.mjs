import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAudioPostTenantDispatcher, createPostgresPendingTenantScanner,
} from './processing_scheduler.ts';

function sweep(cursor = null, more = {}) {
  return { scanned: 1, published: 1, rejected: 0, changed: 0,
    leasedElsewhere: 0, retryableErrors: 0, nextCursor: cursor, ...more };
}

test('SQL discovers distinct pending tenants with C-collated, bounded keyset', async () => {
  const calls = [];
  const scanner = createPostgresPendingTenantScanner({
    async query(sql, params) {
      calls.push({ sql, params });
      assert.match(sql, /DISTINCT tenant_id COLLATE "C"/);
      assert.match(sql, /status='processing'/);
      assert.match(sql, /ORDER BY tenant_id ASC LIMIT \$2/);
      return { rows: [{tenant_id:'a'}, {tenant_id:'b'}, {tenant_id:'c'}] };
    },
  });
  assert.deepEqual(await scanner.listPendingTenants({afterTenantId:null,limit:2}),
    {tenantIds:['a','b'],nextCursor:'b'});
  assert.deepEqual(calls[0].params,[null,3]);
});

test('last tenant page wraps cursor and unknown tenant ID fails closed', async () => {
  const scanner = createPostgresPendingTenantScanner({
    async query() { return {rows:[{tenant_id:'z'}]}; },
  });
  assert.deepEqual(await scanner.listPendingTenants({afterTenantId:'a',limit:2}),
    {tenantIds:['z'],nextCursor:null});
  await assert.rejects(scanner.listPendingTenants({afterTenantId:'z!',limit:2}),/invalid_tenant_scan/);
  const bad = createPostgresPendingTenantScanner({ async query() {
    return {rows:[{tenant_id:'b'}, {tenant_id:'a'}]};
  }});
  await assert.rejects(bad.listPendingTenants({afterTenantId:null,limit:2}),/invalid_tenant_rows/);
});

test('dispatch consumes existing worker in bounded pages and carries tenant cursor', async () => {
  const invoked = [];
  const dispatcher = createAudioPostTenantDispatcher({
    scanner: { async listPendingTenants() { return {tenantIds:['a','b'],nextCursor:'b'}; } },
    worker: { async runOnce(args) {
      invoked.push(args);
      return args.tenantId === 'a' && !args.cursor ? sweep('next') : sweep();
    }},
    onTenantError() { assert.fail('unexpected tenant failure'); },
  });
  const result = await dispatcher.runOnce();
  assert.deepEqual(invoked,[
    {tenantId:'a',cursor:null},{tenantId:'a',cursor:'next'},{tenantId:'b',cursor:null},
  ]);
  assert.equal(result.processedTenants,2);
  assert.equal(result.scannedPosts,3);
  assert.equal(result.published,3);
  assert.equal(result.tenantCursor,'b');
});

test('one failed tenant does not suppress later tenants or report false success', async () => {
  const failures = [];
  const dispatcher = createAudioPostTenantDispatcher({
    scanner: {async listPendingTenants() {return {tenantIds:['a','b'],nextCursor:null};}},
    worker: {async runOnce({tenantId}) {if(tenantId==='a')throw Error('offline');return sweep();}},
    onTenantError(failure) { failures.push(failure.tenantId); },
  });
  const result = await dispatcher.runOnce();
  assert.equal(result.failedTenants,1);
  assert.equal(result.processedTenants,1);
  assert.equal(result.published,1);
  assert.deepEqual(failures,['a']);
});

test('malformed pages, repeated post cursors and invalid bounds reject', async () => {
  assert.throws(() => createAudioPostTenantDispatcher({
    scanner:{},worker:{},onTenantError(){},maxTenants:31,
  }),/invalid_dispatch_limit/);
  const dispatcher = createAudioPostTenantDispatcher({
    scanner:{ async listPendingTenants() {return {tenantIds:['b','b'],nextCursor:null};}},
    worker:{ async runOnce() {throw Error('should not be called');}},onTenantError(){},
  });
  await assert.rejects(dispatcher.runOnce(),/invalid_tenant_page/);
  const failures = [];
  const badWorker = createAudioPostTenantDispatcher({
    scanner:{ async listPendingTenants() {return {tenantIds:['b'],nextCursor:null};}},
    worker:{ async runOnce() {return sweep('repeat');}},
    maxPagesPerTenant:3,onTenantError(f){failures.push(f.tenantId);},
  });
  const result = await badWorker.runOnce();
  assert.equal(result.failedTenants,1);
  assert.deepEqual(failures,['b']);
});
