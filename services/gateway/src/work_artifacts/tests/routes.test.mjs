import './register.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerArtifactRoutes } from '../routes.ts';
import { ArtifactError } from '../model.ts';

// Handler contract tests. This does NOT claim Fastify schema/HTTP integration.
function harness(authorize,artifacts) {
  const routes=[];registerArtifactRoutes({route:r=>routes.push(r)},{authorizer:{authorize},artifacts});
  return async(method,url,body={})=>{
    const route=routes.find(r=>r.method===method&&r.url===url),headers={};
    const reply={status:200,header(k,v){headers[k]=v;return this;},type(v){headers['Content-Type']=v;return this;},
      code(v){this.status=v;return this;},send(v){return v;}};
    const result=await route.handler({headers:{authorization:'Bearer test'},params:{id:'test'},query:{},body},reply);
    return {result,status:reply.status,headers,route};
  };
}
test('anonymous handler calls no service and returns safe 401',async()=>{
  let touched=false;const run=harness(async()=>{throw {statusCode:401};},{get(){touched=true;}});
  const result=await run('GET','/work-artifacts/:id');assert.equal(result.status,401);assert.equal(touched,false);
});
test('revoked session after storage I/O prevents returned download bytes',async()=>{
  let calls=0;const run=harness(async()=>{if(++calls===2)throw {statusCode:401};return {tenantId:'t',userId:'u'};},
    {download:async()=>({bytes:Buffer.from('secret'),mimeType:'text/plain',filename:'safe.txt',sha256:'hash'})});
  const result=await run('POST','/work-artifacts/:id/download',{ticket:'opaque'});
  assert.equal(result.status,401);assert.equal(Buffer.isBuffer(result.result),false);
  assert.equal(result.headers['Content-Disposition'],undefined);assert.equal(result.headers['X-Artifact-SHA256'],undefined);
  assert.equal(result.headers['Cache-Control'],'no-store, private');
});
test('text create schema forbids forged provenance; server endpoint selects user text',async()=>{
  let value;const run=harness(async()=>({tenantId:'t',userId:'u'}),{saveText:async(a,b)=>{value={a,b};return {state:'ready'};}});
  const result=await run('POST','/work-artifacts/text',{text:'hello'});
  assert.equal(result.route.schema.body.additionalProperties,false);
  assert.equal('provenance' in result.route.schema.body.properties,false);
  assert.equal(value.a.userId,'u');
});
test('provider failures do not expose credentials, keys or exception text',async()=>{
  const run=harness(async()=>({tenantId:'t',userId:'u'}),{get:async()=>{throw Error('secret-key-value');}});
  const result=await run('GET','/work-artifacts/:id');assert.equal(result.status,503);
  assert.deepEqual(result.result,{code:'artifact_service_unavailable'});
});
test('revision conflicts remain distinct from retryable service errors',async()=>{
  const run=harness(async()=>({tenantId:'t',userId:'u'}),{revoke:async()=>{throw new ArtifactError('revision_conflict',409);}});
  const result=await run('POST','/work-artifacts/:id/revoke',{revision:1});assert.equal(result.status,409);
});
