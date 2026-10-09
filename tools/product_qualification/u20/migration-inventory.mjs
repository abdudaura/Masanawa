#!/usr/bin/env node
/** Read-only checkout migration inventory. Does NOT edit or apply schemas. */
import {readdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const roots=['packages','services','adapters','apps'];
const ignored=new Set(['node_modules','.git','.dart_tool','.pnpm-store','build','dist','coverage','.next']);
export function migrationInventory(repoRoot){
  const root=resolve(repoRoot);
  const migrations=[];
  const errors=[];
  let directories=0;
  const walk=(dir,depth)=>{
    if(depth>12||directories++>30000)throw new Error('migration inventory traversal limit exceeded');
    let items;
    try{items=readdirSync(dir,{withFileTypes:true});}catch(error){errors.push(relative(root,dir)+': '+error.code);return;}
    for(const item of items){
      if(ignored.has(item.name)||item.isSymbolicLink())continue;
      const full=join(dir,item.name);
      if(item.isDirectory()){walk(full,depth+1);continue;}
      if(!item.isFile()||!/\.sql$/i.test(item.name)||!/(migration|schema|sql)/i.test(full))continue;
      try{
        const bytes=readFileSync(full);
        const parent=relative(root,dir).replaceAll('\\','/');
        const n=item.name.match(/^(\d+)[_-]/);
        migrations.push({path:relative(root,full).replaceAll('\\','/'),root:parent,
          version:n?n[1]:null,bytes:bytes.length,
          sha256:createHash('sha256').update(bytes).digest('hex')});
      }catch(error){errors.push(relative(root,full)+': '+error.code);}
    }
  };
  for(const part of roots)walk(join(root,part),0);
  migrations.sort((a,b)=>a.path.localeCompare(b.path));
  // Same-number in the SAME migration directory is an unsafe ambiguity.
  // Across independent roots the same number is not itself a duplicate.
  const seen=new Map(),collisions=[];
  for(const m of migrations){
    if(!m.version)continue;
    const key=m.root+'/'+m.version;
    if(seen.has(key))collisions.push({version:m.version,paths:[seen.get(key),m.path]});
    else seen.set(key,m.path);
  }
  return {checkout:root,readonly:true,executedMigrations:false,
    files:migrations,collisions,scanErrors:errors,
    status:errors.length||collisions.length?'REVIEW_REQUIRED':'INVENTORIED_NOT_APPLIED'};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  if(process.argv.length!==4){
    console.error('Usage: node migration-inventory.mjs <repo-root> <new-output-json>');
    process.exitCode=2;
  }else{
    try{
      const r=migrationInventory(process.argv[2]);
      writeFileSync(resolve(process.argv[3]),JSON.stringify(r,null,2)+'\n',{flag:'wx'});
      console.log(r.status+': '+r.files.length+' files; '+r.collisions.length+' duplicate version warnings.');
      if(r.status!=='INVENTORIED_NOT_APPLIED')process.exitCode=1;
    }catch(error){console.error('U20 inventory error: '+error.message);process.exitCode=2;}
  }
}
