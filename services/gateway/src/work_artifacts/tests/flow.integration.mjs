import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import Fastify from 'fastify';
import {PGlite} from '@electric-sql/pglite';
import {composeWorkArtifacts} from '../composition.ts';
import {createArtifactRepository} from '../postgres.ts';
import {registerArtifactRoutes} from '../routes.ts';
const id=(kind,n)=>`${kind}_019a0000-0000-7000-8000-${String(n).padStart(12,'0')}`;
const owner={tenantId:id('tenant',1),userId:id('user',1)},recipient={...owner,userId:id('user',2)};
test('HTTP -> exact SQL journal -> actual file -> two-account share/revoke -> fenced physical erasure',async t=>{
  const root=await mkdtemp(join(tmpdir(),'masanawa-artifact-http-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const db=new PGlite();t.after(()=>db.close());
  await db.exec('CREATE SCHEMA security; CREATE TABLE security.platform_user_profiles(tenant_id text,user_id text,PRIMARY KEY(tenant_id,user_id))');
  for(const user of [owner,recipient])await db.query('INSERT INTO security.platform_user_profiles VALUES ($1,$2)',[user.tenantId,user.userId]);
  await db.exec(await readFile(new URL('../schema.sql',import.meta.url),'utf8'));
  const objects={async put(key,bytes){const path=join(root,key);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);},
    async get(key,max){const bytes=await readFile(join(root,key));assert.ok(bytes.length<=max);return bytes;},
    async delete(key){await rm(join(root,key),{force:true});}};
  const repository=createArtifactRepository(db);let contactAllowed=true,sessionActive=true;
  const domain=composeWorkArtifacts({db,objects,ticketSecret:Buffer.alloc(32,3),
    canShare:async(o,user)=>contactAllowed&&o.userId===owner.userId&&user===recipient.userId,authorizeTask:async()=>false,admitCreation:async()=>true});
  const artifacts=domain.artifacts;
  const app=Fastify({ajv:{customOptions:{removeAdditional:false}}});t.after(()=>app.close());
  registerArtifactRoutes(app,{artifacts,authorizer:{async authorize({authorizationHeader}) {
    if(!sessionActive)throw {statusCode:401};
    if(authorizationHeader==='Bearer owner')return owner;
    if(authorizationHeader==='Bearer recipient')return recipient;
    throw {statusCode:401};
  }}});
  const call=(actor,method,url,payload)=>app.inject({method,url,headers:{authorization:`Bearer ${actor}`},...(payload===undefined?{}:{payload})});
  const request={requestId:id('request',1),filename:'Darasi.txt',text:'Sannu! A real saved lesson.\nمرحبا',ttlSeconds:3600};
  const created=await call('owner','POST','/work-artifacts/text',request);assert.equal(created.statusCode,200);
  let file=created.json();assert.equal(file.state,'ready');assert.equal((await call('owner','POST','/work-artifacts/text',request)).json().id,file.id);
  const path=`/work-artifacts/${file.id}`;
  assert.equal((await call('recipient','GET',path)).statusCode,404);
  file=(await call('owner','POST',path+'/share',{revision:file.revision,recipientUserId:recipient.userId,ttlSeconds:3600})).json();
  const metadata=(await call('recipient','GET',path)).json();assert.equal(metadata.owned,false);assert.deepEqual(metadata.sharedWith,[]);
  const ticket=(await call('recipient','POST',path+'/ticket',{})).json();
  const downloaded=await call('recipient','POST',path+'/download',{ticket:ticket.ticket});assert.equal(downloaded.statusCode,200);
  assert.equal(downloaded.body,request.text);assert.equal(downloaded.headers['x-artifact-sha256'],file.sha256);assert.equal(downloaded.headers['content-length'],String(Buffer.byteLength(request.text)));
  contactAllowed=false;assert.equal((await call('recipient','POST',path+'/download',{ticket:ticket.ticket})).statusCode,404);contactAllowed=true;
  const revoked=await call('owner','POST',path+'/revoke',{revision:file.revision});assert.equal(revoked.statusCode,200);
  assert.equal((await call('recipient','POST',path+'/download',{ticket:ticket.ticket})).statusCode,404);
  sessionActive=false;assert.equal((await call('owner','GET',path)).statusCode,401);
  const erasure=domain.accountErasure({isQuiesced:async()=>!sessionActive,
    verifyErasure:async key=>{try {await access(join(root,key));return false;}catch(error){if(error.code==='ENOENT')return true;throw error;}}});
  assert.deepEqual(await erasure(owner),{verified:1,next:null});
  const persisted=await repository.find(owner.tenantId,file.id);assert.equal(persisted.state,'deleted');assert.deepEqual(persisted.grants,[]);
  await assert.rejects(readFile(join(root,persisted.objectKey)),e=>e.code==='ENOENT');
});
