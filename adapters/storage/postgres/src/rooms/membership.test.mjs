import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
// Resolve the original canonical TS sources without installing or rewriting dependencies.
registerHooks({resolve(specifier,context,next){
 if(specifier==='@masanawa/rooms')return {url:new URL('../../../../../packages/rooms/src/index.ts',import.meta.url).href,shortCircuit:true};
 if(specifier.endsWith('.js')&&specifier.startsWith('.')){
  const url=new URL(specifier.slice(0,-3)+'.ts',context.parentURL);
  if(existsSync(url))return {url:url.href,shortCircuit:true};
 }
 return next(specifier,context);
}});
const {createPgRoomMembershipRepository}=await import('./membership.ts');
const {RoomError}=await import('../../../../../packages/rooms/src/index.ts');
const fan={tenantId:'tenant-a',userId:'fan-a',roles:[]};
const mod={...fan,roles:[]};
const admin={...fan,roles:['rooms_moderator']};
const roomId='room_example';
const token='a'.repeat(43);
// Query-port fake exercises the real repository and canonical admission functions.
// These are unit tests, not PostgreSQL concurrency/migration evidence.
function setup({state='published',plan='free',membership='active',role='moderator',targetRole='member',targetState='active',invite={invite_id:'invite-one',unexpired:true},entitled=true,failAudit=false}={}){
 const calls=[];let committed=false;let released=false;
 const q={async query(sql,args=[]){
  calls.push({sql,args});
  if(sql==='COMMIT')committed=true;
  if(sql.includes('FROM rooms.rooms'))return {rows:[{room_id:roomId,state,plan_mode:plan}]};
  if(sql.includes('FROM rooms.entitlements'))return {rows:entitled?[{}]:[]};
  if(sql.startsWith('SELECT state,role'))return {rows:targetState?[{state:targetState,role:targetRole}]:[]};
  if(sql.startsWith('SELECT state FROM rooms.memberships'))return {rows:membership?[{state:membership}]:[]};
  if(sql.startsWith('SELECT role'))return {rows:[{role}]};
  if(sql.startsWith('SELECT *,expires_at'))return {rows:invite?[invite]:[]};
  if(sql.startsWith('SELECT count'))return {rows:[{n:0}]};
  if(sql.includes('INSERT INTO rooms.membership_invites'))return {rows:[{invite_id:args[2],expires_at:new Date(Date.now()+86400000)}]};
  if(sql.startsWith('UPDATE rooms.memberships SET role='))return {rows:membership==='active'?[{}]:[]};
  if(sql.startsWith('UPDATE rooms.membership_invites SET revoked_at'))return {rows:invite?[{}]:[]};
  if(sql.includes('INSERT INTO events.audit_events')&&failAudit)throw new Error('database unavailable');
  return {rows:[]};
 },release(){released=true;}};
 return {repo:createPgRoomMembershipRepository({connect:async()=>q}),calls,committed:()=>committed,released:()=>released};
}
async function denied(promise,code){await assert.rejects(promise,e=>e instanceof RoomError&&e.code===code);}
test('ordinary member cannot inspect roster or issue invites',async()=>{
 const s=setup({role:'member'});await denied(s.repo.members(fan,roomId),'room_moderator_required');
 await denied(s.repo.issue(fan,roomId),'room_moderator_required');
 assert(!s.calls.some(c=>c.sql.includes('INSERT INTO rooms.membership_invites')));
});
test('moderator cannot grant roles or ban another moderator',async()=>{
 const s=setup({targetRole:'moderator'});
 await denied(s.repo.setRole(mod,roomId,'other','moderator'),'staff_role_required');
 await denied(s.repo.moderate(mod,roomId,'other','ban'),'staff_role_required');
 assert(!s.calls.some(c=>c.sql.startsWith('UPDATE rooms.memberships')));
});
test('staff role assignment requires active membership and rejects arbitrary roles',async()=>{
 await denied(setup().repo.setRole(admin,roomId,'other','owner'),'invalid_room_role');
 await denied(setup({membership:'left'}).repo.setRole(admin,roomId,'other','moderator'),'active_membership_required');
 const s=setup();await s.repo.setRole(admin,roomId,'other','moderator');assert(s.committed());
 assert(s.calls.some(c=>c.sql.includes('rooms.membership.role_changed')||c.args.includes('rooms.membership.role_changed')));
});
test('unban leaves membership inactive and resets role',async()=>{
 const s=setup({targetState:'banned'});await s.repo.moderate(mod,roomId,'other','unban');
 const update=s.calls.find(c=>c.sql.startsWith('UPDATE rooms.memberships'));
 assert.equal(update.args[3],'left');assert.match(update.sql,/role='member'/);
 await denied(setup().repo.moderate(mod,roomId,mod.userId,'ban'),'cannot_moderate_self');
});
test('invite issuance returns secret once; database and audit contain only hash/id',async()=>{
 const s=setup();const result=await s.repo.issue(mod,roomId);
 assert.match(result.token,/^[A-Za-z0-9_-]{43}$/);assert(s.committed());
 const insert=s.calls.find(c=>c.sql.includes('INSERT INTO rooms.membership_invites'));
 assert.match(insert.args[3],/^[a-f0-9]{64}$/);
 assert(!JSON.stringify(s.calls).includes(result.token));
});
test('accept denies banned, paused and unpaid memberships before any write',async()=>{
 for(const [options,code] of [[{membership:'banned'},'room_banned'],[{state:'paused'},'room_not_found'],[{plan:'paid',entitled:false},'subscription_not_verified']]){
  const s=setup(options);await denied(s.repo.accept(fan,roomId,token),code);
  assert(!s.calls.some(c=>c.sql.startsWith('INSERT')));assert(!s.committed());assert(s.released());
 }
});
test('invalid, expired, revoked and already-used invitations deny access',async()=>{
 await denied(setup().repo.accept(fan,roomId,'bad'),'invalid_invite');
 for(const [invite,code] of [[null,'invite_unavailable'],[{revoked_at:new Date()},'invite_unavailable'],[{unexpired:false},'invite_expired'],[{accepted_by:'other'},'invite_already_used']]){
  const s=setup({invite});await denied(s.repo.accept(fan,roomId,token),code);assert(!s.committed());
 }
});
test('lost-response retry succeeds only for same active member; left/banned retry denies',async()=>{
 const invite={accepted_by:fan.userId,unexpired:false};
 const s=setup({invite});assert.deepEqual(await s.repo.accept(fan,roomId,token),{joined:true});
 assert(!s.calls.some(c=>c.sql.startsWith('INSERT')));
 await denied(setup({invite,membership:'left'}).repo.accept(fan,roomId,token),'invite_already_used');
 await denied(setup({invite,membership:'banned'}).repo.accept(fan,roomId,token),'room_banned');
});
test('accept atomically consumes invitation, preserves existing role, scopes every write',async()=>{
 const s=setup({membership:'left'});await s.repo.accept(fan,roomId,token);assert(s.committed());
 const lock=s.calls.findIndex(c=>c.sql.includes('FROM rooms.rooms'));
 const member=s.calls.findIndex(c=>c.sql.startsWith('SELECT state FROM rooms.memberships'));
 assert(lock<member);assert.match(s.calls[lock].sql,/FOR UPDATE/);
 const insert=s.calls.find(c=>c.sql.startsWith('INSERT INTO rooms.memberships'));
 assert.deepEqual(insert.args,[fan.tenantId,roomId,fan.userId]);
 assert(!insert.sql.split('DO UPDATE')[1].includes('role='));
 const consume=s.calls.find(c=>c.sql.startsWith('UPDATE rooms.membership_invites SET accepted_by'));
 assert.deepEqual(consume.args,[fan.tenantId,roomId,'invite-one',fan.userId]);
});
test('audit failure rolls back membership+invite and releases connection for safe retry',async()=>{
 const s=setup({failAudit:true});await assert.rejects(s.repo.accept(fan,roomId,token),/database unavailable/);
 assert(!s.committed());assert(s.calls.some(c=>c.sql==='ROLLBACK'));assert(s.released());
 assert.deepEqual(await setup().repo.accept(fan,roomId,token),{joined:true});
});
test('revocation is tenant/room scoped and unavailable token cannot be redeemed',async()=>{
 const s=setup();await s.repo.revoke(mod,roomId,'invite-one');
 const write=s.calls.find(c=>c.sql.startsWith('UPDATE rooms.membership_invites'));
 assert.deepEqual(write.args,[mod.tenantId,roomId,'invite-one']);
 await denied(setup({invite:{revoked_at:new Date()}}).repo.accept(fan,roomId,token),'invite_unavailable');
});
