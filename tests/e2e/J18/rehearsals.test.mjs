import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../../../',import.meta.url);
test('A04 adds no destructive SQL',async()=>{
 const sql=await readFile(new URL('packages/masana/migrations/0004_rehearsals.sql',root),'utf8');
 assert.ok(sql.includes('CREATE TABLE masana.rehearsal_runs'));
 assert.ok(!/\b(DROP TABLE|TRUNCATE|DELETE FROM)\b/i.test(sql));
});
test('A04 code requires injected disabled-by-default capability',async()=>{
 const route=await readFile(new URL('services/gateway/src/modules/masana/rehearsal_routes.ts',root),'utf8');
 const worker=await readFile(new URL('services/worker/src/jobs/masana/rehearsals.ts',root),'utf8');
 assert.ok(route.includes('deps.enabled()'));assert.ok(worker.includes('noSideEffects:true'));
});