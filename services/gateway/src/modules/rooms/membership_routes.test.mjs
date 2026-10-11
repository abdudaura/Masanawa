import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
registerHooks({resolve(specifier,context,next){
 if(specifier==='@masanawa/rooms')return {url:new URL('../../../../../packages/rooms/src/index.ts',import.meta.url).href,shortCircuit:true};
 if(specifier.endsWith('.js')&&specifier.startsWith('.')){
  const url=new URL(specifier.slice(0,-3)+'.ts',context.parentURL);
  if(existsSync(url))return {url:url.href,shortCircuit:true};
 }
 return next(specifier,context);
}});
const {registerRoomMembershipRoutes}=await import('./membership_routes.ts');
const {RoomError}=await import('../../../../../packages/rooms/src/index.ts');
const actor={tenantId:'verified-tenant',userId:'verified-user',roles:[]};
function setup({enabled=true,authError=null,repoError=null,verifiedActor=actor}={}){
 const routes=new Map(),calls=[];
 const repo={};for(const method of ['members','setRole','moderate','invites','issue','revoke','accept'])repo[method]=async(...args)=>{
  calls.push({method,args});if(repoError)throw repoError;
  return method==='accept'?{joined:true}:method==='issue'?{token:'test-only-secret'}:[];
 };
 const app={get:(p,h)=>routes.set('get '+p,h),post:(p,h)=>routes.set('post '+p,h)};
 registerRoomMembershipRoutes(app,{repository:repo,enabled:()=>enabled,authorize:async(header,cap)=>{
  calls.push({auth:header,cap});if(authError)throw authError;return verifiedActor;
 }});
 return {calls,async run(method,path,body){
  const headers={};let status=200;
  const reply={header(k,v){headers[k]=v;return this;},code(n){status=n;return this;},send(v){return v;}};
  const data=await routes.get(method+' '+path)({headers:{authorization:'Bearer verified'},params:{id:'room_example',userId:'target',inviteId:'invite'},body},reply);
  return {data,status,headers};
 }};
}
test('disabled feature and failed authentication never call repository',async()=>{
 for(const opts of [{enabled:false},{authError:new RoomError(401,'authentication_required')}]){
  const s=setup(opts),r=await s.run('post','/v1/rooms/:id/invites/accept',{token:'secret'});
  assert(r.status===410||r.status===401);assert(!s.calls.some(x=>x.method));assert.equal(r.headers['Cache-Control'],'no-store');
 }
});
test('client actor/roles ignored; verified actor and staff capability used for role assignment',async()=>{
 const staffActor={...actor,roles:['rooms_moderator']};
 const s=setup({verifiedActor:staffActor});const r=await s.run('post','/v1/admin/rooms/:id/members/:userId/role',{role:'moderator',tenantId:'forged',userId:'forged',roles:['platform_admin']});
 assert.equal(r.status,200);assert.equal(s.calls[0].cap,'rooms.staff');
 assert.deepEqual(s.calls[1],{method:'setRole',args:[staffActor,'room_example','target','moderator']});
});
test('forged staff body and anonymous actors cannot reach role or membership operations',async()=>{
 const s=setup();const denied=await s.run('post','/v1/admin/rooms/:id/members/:userId/role',{role:'moderator',roles:['platform_admin']});
 assert.equal(denied.status,403);assert(!s.calls.some(x=>x.method));
 const anon=setup({verifiedActor:{...actor,userId:null}});
 assert.equal((await anon.run('get','/v1/rooms/:id/members')).status,401);
 assert(!anon.calls.some(x=>x.method));
});
test('token stays in POST body and denial response does not reveal repository error',async()=>{
 const s=setup({repoError:new Error('secret-token database failure')});const r=await s.run('post','/v1/rooms/:id/invites/accept',{token:'secret-token'});
 assert.equal(r.status,503);assert.deepEqual(r.data,{code:'rooms_unavailable'});
 assert.deepEqual(s.calls[1].args,[actor,'room_example','secret-token']);
});
test('membership denial keeps exact typed error and cannot claim joined',async()=>{
 const s=setup({repoError:new RoomError(403,'room_banned')});const r=await s.run('post','/v1/rooms/:id/invites/accept',{token:'test-only'});
 assert.equal(r.status,403);assert.deepEqual(r.data,{code:'room_banned'});
});
test('non-object input denied without invoking repository',async()=>{
 for(const body of [null,[],true,'raw']){
  const s=setup();const r=await s.run('post','/v1/rooms/:id/invites/accept',body);
  assert.equal(r.status,422);assert(!s.calls.some(x=>x.method));
 }
});
test('all consumer feature routes delegate through verified authorization',async()=>{
 for(const [method,path,op] of [
  ['get','/v1/rooms/:id/members','members'],['post','/v1/rooms/:id/members/:userId/moderate','moderate'],
  ['get','/v1/rooms/:id/invites','invites'],['post','/v1/rooms/:id/invites','issue'],
  ['post','/v1/rooms/:id/invites/:inviteId/revoke','revoke'],['post','/v1/rooms/:id/invites/accept','accept']]){
  const s=setup();const r=await s.run(method,path,{action:'ban',token:'test-only'});
  assert.equal(r.status,200);assert.equal(s.calls[1].method,op);assert.deepEqual(s.calls[1].args[0],actor);
 }
});
