import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issuePrivateMediaUrl, MediaAccessError } from './private_access.ts';
const now=2000000000000;
const good={allowed:true,tenantId:'tenant1',mediaId:'media1',objectKey:'private/tenant1/media1.opus',accessRevision:'rev3'};
function fixture(overrides={}) {
 const calls=[];
 const authority={
   principal:async()=>{calls.push('principal');return {userId:'user1',tenantId:'tenant1'}},
   authorize:async()=>{calls.push('auth');return {...good}},
   sign:async(k,ttl)=>{calls.push(['sign',k,ttl]);return 'https://storage.example.com/private/tenant1/media1.opus?sig=test'},
   ...overrides,
 };
 const run=(opts={})=>issuePrivateMediaUrl({mediaId:'media1',objectPrefix:'private/tenant1/',signerHost:'storage.example.com',clockMs:()=>now,...opts},authority);
 return {run,calls};
}
async function code(p, expected) {await assert.rejects(p,(e)=>e instanceof MediaAccessError&&e.code===expected)}
test('authorized URL is short-lived, no-store and permission rechecked after signing',async()=>{
 const h=fixture(); const r=await h.run();
 assert.equal(r.cacheControl,'private, no-store'); assert.equal(r.expiresAtMs,now+30000);
 assert.deepEqual(h.calls,['principal','auth',['sign',good.objectKey,30],'principal','auth']);
});
test('reject unauthenticated before authorization or signing',async()=>{
 const h=fixture({principal:async()=>null});await code(h.run(),'unauthenticated');assert.deepEqual(h.calls,[]);
});
test('denied content does not invoke signer',async()=>{
 const h=fixture({authorize:async()=>({allowed:false})});await code(h.run(),'not_found'); assert.ok(!h.calls.some(Array.isArray));
});
test('cross-tenant or arbitrary object key denied',async()=>{
 for (const objectKey of ['private/tenant2/x','private/tenant1/../x','private/tenant1/%2e%2e/x','private/tenant1/']) {
  const h=fixture({authorize:async()=>({...good,objectKey})});await code(h.run(),'not_found');assert.ok(!h.calls.some(Array.isArray));
 }
});
test('authoritative revision change during signing prevents URL return',async()=>{
 let n=0;const h=fixture({authorize:async()=>({...good,accessRevision:++n===1?'rev1':'rev2'})});await code(h.run(),'not_found');
 assert.equal(h.calls.filter(x=>Array.isArray(x)).length,1);
});
test('member revocation between sign and readback fails closed',async()=>{
 let n=0;const h=fixture({authorize:async()=>++n===1?good:{allowed:false}});await code(h.run(),'not_found');
});
test('reject signed http, wrong host, hash and credentials',async()=>{
 for (const url of ['http://storage.example.com/k','https://other.example.com/k','https://u:p@storage.example.com/k','https://storage.example.com/k#bad']){
  const h=fixture({sign:async()=>url});await code(h.run(),'temporarily_unavailable');
 }
});
test('sign or permission outage does not reveal backend errors',async()=>{
 for (const change of [{sign:async()=>{throw Error('token secret')}},{authorize:async()=>{throw Error('DB secret')}}]){
  const h=fixture(change);await code(h.run(),'temporarily_unavailable');
 }
});
test('TTL and namespace cannot be client widened',async()=>{
 for (const opts of [{ttlSeconds:61},{ttlSeconds:0},{objectPrefix:'private/'},{objectPrefix:'private/../'},{mediaId:'../id'},{signerHost:'evil.com/path'}]){
  const h=fixture();await code(h.run(opts),'invalid_request');assert.deepEqual(h.calls,[]);
 }
});
test('shorter bounded TTL is passed to signer',async()=>{
 const h=fixture();const r=await h.run({ttlSeconds:5});assert.equal(r.expiresAtMs,now+5000);assert.deepEqual(h.calls[2],['sign',good.objectKey,5]);
});

test('mutable cached permission cannot hide a revision change during signing',async()=>{
 const grant={...good};
 const h=fixture({authorize:async()=>grant,sign:async()=>{grant.accessRevision='rev4';return 'https://storage.example.com/key?sig=ok'}});
 await code(h.run(),'not_found');
});
test('logout or account switch while signing blocks return of already-signed URL',async()=>{
 let n=0;
 const h=fixture({principal:async()=>++n===1?{userId:'user1',tenantId:'tenant1'}:{userId:'user2',tenantId:'tenant1'}});
 await code(h.run(),'unauthenticated');
});
