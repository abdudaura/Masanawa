import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrationInventory} from './migration-inventory.mjs';
function fixture(f){
 const root=mkdtempSync(join(tmpdir(),'masanawa-u20-'));
 try{
   for(const dir of ['packages/a/migrations','packages/b/migrations',
     'services/c/migrations','adapters','apps'])
     mkdirSync(join(root,dir),{recursive:true});
   f(root);
 }finally{rmSync(root,{recursive:true,force:true});}
}
test('inventories real SQL files without applying migrations or cross-root false alarms',()=>fixture(root=>{
 writeFileSync(join(root,'packages/a/migrations/0017_one.sql'),'CREATE TABLE ONE (id INT);');
 writeFileSync(join(root,'packages/b/migrations/0017_two.sql'),'CREATE TABLE TWO (id INT);');
 const r=migrationInventory(root);
 assert.equal(r.files.length,2);assert.equal(r.collisions.length,0);
 assert.equal(r.executedMigrations,false);assert.equal(r.status,'INVENTORIED_NOT_APPLIED');
}));
test('flags collisions in same migration directory',()=>fixture(root=>{
 writeFileSync(join(root,'packages/a/migrations/0017_a.sql'),'a');
 writeFileSync(join(root,'packages/a/migrations/0017_b.sql'),'b');
 const r=migrationInventory(root);
 assert.equal(r.collisions.length,1);assert.equal(r.status,'REVIEW_REQUIRED');
}));
test('skips symlinks and dependency directories',()=>fixture(root=>{
 mkdirSync(join(root,'packages/a/node_modules/migrations'),{recursive:true});
 writeFileSync(join(root,'packages/a/node_modules/migrations/0001_wrong.sql'),'wrong');
 writeFileSync(join(root,'packages/a/migrations/0002_ok.sql'),'ok');
 symlinkSync(join(root,'packages/a/migrations'),join(root,'packages/a/link'));
 assert.deepEqual(migrationInventory(root).files.map(f=>f.version),['0002']);
}));
