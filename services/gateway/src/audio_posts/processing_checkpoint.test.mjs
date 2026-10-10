import test from "node:test";
import assert from "node:assert/strict";
import {
  createPostgresProcessingCheckpointStore, createPublishedAudioProcessingTick,
} from "./processing_checkpoint.ts";

const sweep = (cursor = null, values = {}) => ({
  tenantCursor: cursor, processedTenants: 2, failedTenants: 0,
  scannedPosts: 3, published: 3, rejected: 0, changed: 0,
  leasedElsewhere: 0, retryableErrors: 0, ...values,
});

test("Postgres checkpoint inserts singleton, reads durable cursor and CAS-advances", async () => {
  const calls = [];
  const store = createPostgresProcessingCheckpointStore({
    async query(sql, params) {
      calls.push({sql, params});
      if (sql.startsWith("INSERT")) return {rows:[]};
      if (sql.startsWith("SELECT")) return {rows:[{tenant_cursor:"tenant-A",revision:"4"}]};
      assert.match(sql,/WHERE job_key='published-audio' AND revision=\$2/);
      return {rows:[{tenant_cursor:"tenant-B",revision:"5"}]};
    },
  });
  assert.deepEqual(await store.load(), {tenantCursor:"tenant-A",revision:4});
  assert.equal(await store.advance({expectedRevision:4,nextCursor:"tenant-B"}),true);
  assert.deepEqual(calls[2].params,["tenant-B",4]);
});

test("stale concurrent CAS refuses to replace newer checkpoint", async () => {
  const store = createPostgresProcessingCheckpointStore({
    async query(sql) {
      if (sql.startsWith("UPDATE")) return {rows:[]};
      return {rows:[{tenant_cursor:null,revision:"0"}]};
    },
  });
  assert.equal(await store.advance({expectedRevision:0,nextCursor:"a"}),false);
});

test("malformed checkpoint, unsafe input, impossible update fail closed", async () => {
  const malformed = createPostgresProcessingCheckpointStore({
    async query(sql) {
      if (sql.startsWith("SELECT")) return {rows:[{tenant_cursor:"bad/tenant",revision:"9"}]};
      return {rows:[]};
    },
  });
  await assert.rejects(malformed.load(),/invalid_processing_checkpoint/);
  await assert.rejects(malformed.advance({expectedRevision:0,nextCursor:"a/b"}),/invalid_processing_checkpoint/);
  const corruptUpdate = createPostgresProcessingCheckpointStore({
    async query() {return {rows:[{tenant_cursor:"wrong",revision:7}]};},
  });
  await assert.rejects(corruptUpdate.advance({expectedRevision:0,nextCursor:"ok"}),/invalid_processing_checkpoint/);
});

test("one tick resumes exact durable cursor, preserves sweep counts and writes next page", async () => {
  const operations = [];
  const tick = createPublishedAudioProcessingTick({
    store: {
      async load() {return {tenantCursor:"a",revision:11};},
      async advance(input) {operations.push(input);return true;},
    },
    dispatcher: {async runOnce(cursor) {
      assert.equal(cursor,"a");
      return sweep("c");
    }},
  });
  const result = await tick();
  assert.deepEqual(result.before,{tenantCursor:"a",revision:11});
  assert.equal(result.committed,true);
  assert.equal(result.sweep.published,3);
  assert.deepEqual(operations,[{expectedRevision:11,nextCursor:"c"}]);
});

test("end-of-scan wraps to beginning without dropping durable pending work", async () => {
  let cursor = "last", revision = 3;
  const tick = createPublishedAudioProcessingTick({
    store:{
      async load(){return {tenantCursor:cursor,revision};},
      async advance({expectedRevision,nextCursor}){
        assert.equal(expectedRevision,revision);
        cursor = nextCursor;revision++;return true;
      },
    },
    dispatcher:{async runOnce(after){return sweep(after === "last" ? null : "last");}},
  });
  assert.equal((await tick()).nextCursor,null);
  assert.equal((await tick()).before.tenantCursor,null);
  assert.equal(cursor,"last");
});

test("worker or scanner error never advances cursor; CAS conflict is truthful", async () => {
  let advanced = 0, shouldThrow = true;
  const tick = createPublishedAudioProcessingTick({
    store: {
      async load(){return {tenantCursor:"a",revision:1};},
      async advance(){advanced++;return false;},
    },
    dispatcher: {async runOnce(){
      if(shouldThrow) throw new Error("database unavailable");
      return sweep("b",{failedTenants:1,retryableErrors:2});
    }},
  });
  await assert.rejects(tick(),/database unavailable/);
  assert.equal(advanced,0);
  shouldThrow = false;
  const result = await tick();
  assert.equal(result.committed,false);
  assert.equal(result.sweep.failedTenants,1);
  assert.equal(advanced,1);
});

test("invalid dispatch cursor and corrupt restored revision cannot commit", async () => {
  let advanced = false;
  const badTick = createPublishedAudioProcessingTick({
    store:{async load(){return {tenantCursor:null,revision:0};},
      async advance(){advanced=true;return true;}},
    dispatcher:{async runOnce(){return sweep("../../escape");}},
  });
  await assert.rejects(badTick(),/invalid_processing_sweep/);
  assert.equal(advanced,false);
  const badRevisionTick = createPublishedAudioProcessingTick({
    store:{async load(){return {tenantCursor:null,revision:Number.MAX_SAFE_INTEGER};},
      async advance(){advanced=true;return true;}},
    dispatcher:{async runOnce(){assert.fail("must not run");}},
  });
  await assert.rejects(badRevisionTick(),/invalid_processing_checkpoint/);
  assert.equal(advanced,false);
});
