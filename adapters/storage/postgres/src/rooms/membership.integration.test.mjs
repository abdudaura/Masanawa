import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {registerHooks, createRequire} from 'node:module';
import {existsSync, readFileSync} from 'node:fs';
registerHooks({resolve(specifier,context,next){
 if(specifier==='@masanawa/rooms')return {url:new URL('../../../../../packages/rooms/src/index.ts',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('.')&&specifier.endsWith('.js')){
  const url=new URL(specifier.slice(0,-3)+'.ts',context.parentURL);
  if(existsSync(url))return {url:url.href,shortCircuit:true};
 }
 return next(specifier,context);
}});
const {Pool}=createRequire(import.meta.url)('pg');
const {createPgRoomMembershipRepository}=await import('./membership.ts');
const connection=process.env.MASANAWA_TEST_DATABASE_URL;
// Explicit local-only guard: never apply qualification schemas to a supplied live database.
if(!connection)throw new Error('Set MASANAWA_TEST_DATABASE_URL for the disposable local Rooms PostgreSQL instance');
const supplied=new URL(connection);
if(supplied.hostname!=='127.0.0.1'||!([
 ['55469','/masanawa_rooms_test'],['5432','/masanawa_test']
].some(([port,pathname])=>supplied.port===port&&supplied.pathname===pathname)))
 throw new Error('Qualification only accepts disposable local PostgreSQL test endpoints');
const database='rooms_membership_'+randomBytes(8).toString('hex')+'_test';
const control=new Pool({connectionString:connection});
let pool,repository,created=false;
const actor=(userId,tenantId='tenant_test',roles=[])=>({tenantId,userId,roles});
const staff=actor('staff_actor','tenant_test',['rooms_moderator']);
before(async()=>{
 await control.query('CREATE DATABASE "'+database+'"');created=true;
 const url=new URL(connection);url.pathname='/'+database;
 pool=new Pool({connectionString:url.href,max:8});
 for(const path of ['packages/identity/migrations/0001_identity_foundation.sql',
  'packages/events/migrations/0001_event_foundation.sql','packages/rooms/migrations/0001_rooms_free.sql',
  'packages/rooms/migrations/0002_room_subscriptions.sql','packages/rooms/migrations/0003_discussion_threads.sql',
  'packages/rooms/migrations/0004_saved_lessons.sql',
  'packages/rooms/migrations/0005_short_questions.sql',
  'packages/rooms/migrations/0006_membership_invites.sql']){
  await pool.query(readFileSync(new URL('../../../../../'+path,import.meta.url),'utf8'));
 }
 for(const tenant of ['tenant_test','tenant_other']){
  await pool.query("INSERT INTO identity.tenants(tenant_id,created_at,updated_at) VALUES($1,now(),now())",[tenant]);
  for(const user of ['fan_one','fan_two','staff_actor','moderator_user'])
   await pool.query('INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at) VALUES($1,$2,now(),now())',[tenant,user]);
  await pool.query("INSERT INTO identity.characters(tenant_id,character_id,created_at,updated_at) VALUES($1,'character_teacher',now(),now())",[tenant]);
 }
 repository=createPgRoomMembershipRepository(pool);
});
after(async()=>{
 if(pool)await pool.end();
 if(created)await control.query('DROP DATABASE "'+database+'"');
 await control.end();
});
async function room(tenant='tenant_test',existingId=null,mode='free'){
 const suffix=randomBytes(8).toString('hex'),id=existingId??'room_'+suffix;
 await pool.query(`INSERT INTO rooms.rooms(tenant_id,room_id,slug,profession_title,teacher_character_id,state,plan_mode)
  VALUES($1,$2,$3,'Mathematics','character_teacher','published',$4)`,[tenant,id,'math-'+suffix,mode]);return id;
}
async function member(id,user,role='member'){
 await pool.query('INSERT INTO rooms.memberships(tenant_id,room_id,user_id,role) VALUES($1,$2,$3,$4)',['tenant_test',id,user,role]);
}
const denied=(work,code)=>assert.rejects(work,e=>e.code===code);
test('concurrent redemption consumes one token for exactly one account',async()=>{
 const id=await room(),invite=await repository.issue(staff,id);
 const outcomes=await Promise.allSettled([repository.accept(actor('fan_one'),id,invite.token),repository.accept(actor('fan_two'),id,invite.token)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.find(x=>x.status==='rejected').reason.code,'invite_already_used');
 const winner=(await pool.query('SELECT accepted_by FROM rooms.membership_invites WHERE invite_id=$1',[invite.inviteId])).rows[0].accepted_by;
 assert.deepEqual(await repository.accept(actor(winner),id,invite.token),{joined:true});
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM rooms.memberships WHERE room_id=$1 AND state='active'",[id])).rows[0].n,1);
 await pool.query("UPDATE rooms.memberships SET state='left' WHERE room_id=$1 AND user_id=$2",[id,winner]);
 await denied(repository.accept(actor(winner),id,invite.token),'invite_already_used');
});
test('tenant crossover, revocation and expiry deny without creating membership',async()=>{
 const id=await room();await room('tenant_other',id);
 const invite=await repository.issue(staff,id);
 await denied(repository.accept(actor('fan_one','tenant_other'),id,invite.token),'invite_unavailable');
 await repository.revoke(staff,id,invite.inviteId);
 await denied(repository.accept(actor('fan_one'),id,invite.token),'invite_unavailable');
 const expired=await repository.issue(staff,id);
 await pool.query("UPDATE rooms.membership_invites SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE invite_id=$1",[expired.inviteId]);
 await denied(repository.accept(actor('fan_one'),id,expired.token),'invite_expired');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM rooms.memberships WHERE room_id=$1',[id])).rows[0].n,0);
});
test('role authority and ban-versus-accept concurrency retain server-enforced denial',async()=>{
 const id=await room();await member(id,'moderator_user','moderator');await member(id,'fan_one');
 await denied(repository.setRole(actor('moderator_user'),id,'fan_one','moderator'),'staff_role_required');
 await repository.setRole(staff,id,'fan_one','moderator');
 await denied(repository.moderate(actor('moderator_user'),id,'fan_one','ban'),'staff_role_required');
 await repository.setRole(staff,id,'fan_one','member');
 const invite=await repository.issue(staff,id);
 await Promise.allSettled([repository.accept(actor('fan_one'),id,invite.token),repository.moderate(staff,id,'fan_one','ban')]);
 assert.equal((await pool.query('SELECT state FROM rooms.memberships WHERE room_id=$1 AND user_id=$2',[id,'fan_one'])).rows[0].state,'banned');
 await denied(repository.accept(actor('fan_one'),id,invite.token),'room_banned');
 await repository.moderate(staff,id,'fan_one','unban');
 assert.equal((await pool.query('SELECT state FROM rooms.memberships WHERE room_id=$1 AND user_id=$2',[id,'fan_one'])).rows[0].state,'left');
});
test('failed canonical audit rolls back membership and redemption; retry succeeds',async()=>{
 const id=await room(),invite=await repository.issue(staff,id);
 await pool.query(`CREATE FUNCTION events.reject_test_accept() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN IF NEW.event_type='rooms.invite.accepted' THEN RAISE EXCEPTION 'qualification audit unavailable'; END IF; RETURN NEW; END $$;
  CREATE TRIGGER reject_test_accept BEFORE INSERT ON events.audit_events FOR EACH ROW EXECUTE FUNCTION events.reject_test_accept();`);
 try{
  await assert.rejects(repository.accept(actor('fan_one'),id,invite.token),/qualification audit unavailable/);
  assert.equal((await pool.query('SELECT accepted_by FROM rooms.membership_invites WHERE invite_id=$1',[invite.inviteId])).rows[0].accepted_by,null);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM rooms.memberships WHERE room_id=$1',[id])).rows[0].n,0);
 }finally{await pool.query('DROP TRIGGER reject_test_accept ON events.audit_events; DROP FUNCTION events.reject_test_accept();');}
 assert.deepEqual(await repository.accept(actor('fan_one'),id,invite.token),{joined:true});
});
test('paid invite acceptance rechecks current entitlement without consuming token on denial',async()=>{
 const id=await room('tenant_test',null,'paid'),invite=await repository.issue(staff,id);
 await denied(repository.accept(actor('fan_one'),id,invite.token),'subscription_not_verified');
 const plan='room-plan_'+randomBytes(8).toString('hex');
 await pool.query("INSERT INTO rooms.plans(tenant_id,plan_id,room_id,period) VALUES('tenant_test',$1,$2,'month')",[plan,id]);
 await pool.query("INSERT INTO rooms.price_versions(tenant_id,plan_id,version,amount_minor,currency,store_product_id,effective_at) VALUES('tenant_test',$1,1,100,'NGN','test_monthly',now())",[plan]);
 await pool.query(`INSERT INTO rooms.entitlements(tenant_id,user_id,room_id,plan_id,price_version,state,period_end,store_purchase_token_hash)
  VALUES('tenant_test','fan_one',$1,$2,1,'active',now()-interval '1 hour',$3)`,[id,plan,'a'.repeat(64)]);
 await denied(repository.accept(actor('fan_one'),id,invite.token),'subscription_not_verified');
 await pool.query("UPDATE rooms.entitlements SET period_end=now()+interval '1 day' WHERE tenant_id='tenant_test' AND room_id=$1",[id]);
 assert.deepEqual(await repository.accept(actor('fan_one'),id,invite.token),{joined:true});
});
