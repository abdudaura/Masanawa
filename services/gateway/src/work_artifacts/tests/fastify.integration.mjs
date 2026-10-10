import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerArtifactRoutes } from '../routes.ts';

test('real Fastify rejects unauthorized requests, extra identity/provenance and serves private attachment',async t=>{
  const app=Fastify({ajv:{customOptions:{removeAdditional:false}}});t.after(()=>app.close());let saves=0;
  registerArtifactRoutes(app,{authorizer:{async authorize({authorizationHeader}) {
    if(authorizationHeader!=='Bearer test')throw {statusCode:401};return {tenantId:'t',userId:'u'};
  }},artifacts:{async saveText(){saves++;return {state:'ready'};},
    async download(){return {bytes:Buffer.from('lesson'),mimeType:'text/plain; charset=utf-8',filename:'lesson.txt',sha256:'a'.repeat(64)};}}});
  const body={requestId:'request',filename:'lesson.txt',text:'lesson',ttlSeconds:3600};
  assert.equal((await app.inject({method:'POST',url:'/work-artifacts/text',payload:body})).statusCode,401);
  const forged=await app.inject({method:'POST',url:'/work-artifacts/text',headers:{authorization:'Bearer test'},payload:{...body,userId:'another-user',provenance:{kind:'operator'}}});
  assert.equal(forged.statusCode,400);
  const file=await app.inject({method:'POST',url:'/work-artifacts/item/download',headers:{authorization:'Bearer test'},payload:{ticket:'signed'}});
  assert.equal(file.statusCode,200);assert.equal(file.body,'lesson');
  assert.match(file.headers['cache-control'],/no-store/);assert.match(file.headers['content-disposition'],/^attachment;/);
  assert.equal(file.headers['x-content-type-options'],'nosniff');assert.equal(saves,0);
});
