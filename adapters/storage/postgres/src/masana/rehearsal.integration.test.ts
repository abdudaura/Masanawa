import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {describe,it,expect} from 'vitest';
import {Pool} from 'pg';

/** Real PostgreSQL 18 smoke: a localhost-only *disposable* _test database.
 * One outer transaction always rolls back, including schema bootstrap and fixtures.
 */
const url=process.env.MASANAWA_TEST_DATABASE_URL;
function disposable(v:string|undefined):boolean {
 if(!v)return false;
 try{const u=new URL(v);return (u.protocol==='postgres:'||u.protocol==='postgresql:')
  && (u.hostname==='localhost'||u.hostname==='127.0.0.1')
  && u.pathname.replace(/^\//,'').endsWith('_test');}
 catch{return false}
}
const pgTest=disposable(url)?it:it.skip;
const root=fileURLToPath(new URL('../../../../../',import.meta.url));
describe('A04 draft-only rehearsal on disposable PG18',()=>{
 pgTest('FK, lease, idempotency, role-scoped rows and rollback',async()=>{
  const pool=new Pool({connectionString:url});
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const v=Number((await c.query<{server_version_num:string}>('SHOW server_version_num')).rows[0]?.server_version_num);
   expect(v).toBeGreaterThanOrEqual(180000);expect(v).toBeLessThan(190000);
   for(const [relation,migration] of [
    ['identity.characters','packages/identity/migrations/0001_identity_foundation.sql'],
    ['identity.character_ownership','packages/identity/migrations/0002_character_ownership.sql'],
    ['events.outbox','packages/events/migrations/0001_event_foundation.sql'],
    ['masana.character_revisions','packages/masana/migrations/0001_masana_profiles.sql'],
    ['masana.rehearsal_runs','packages/masana/migrations/0004_rehearsals.sql'],
   ]){
    const present=(await c.query<{r:string|null}>('SELECT to_regclass($1)::text AS r',[relation])).rows[0]?.r;
    if(!present)await c.query(await readFile(root+migration,'utf8'));
   }
   const tag=randomUUID().replace(/-/g,'').slice(0,16);
   const tenant='tenant_a04_test_'+tag,staff='staff_a04_'+tag,other='other_a04_'+tag,
    character='masana_a04_'+tag,run='rehearsal_'+tag;
   await c.query('INSERT INTO identity.tenants(tenant_id,created_at,updated_at) VALUES($1,now(),now())',[tenant]);
   await c.query('INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at) VALUES($1,$2,now(),now()),($1,$3,now(),now())',[tenant,staff,other]);
   await c.query('INSERT INTO identity.characters(tenant_id,character_id,created_at,updated_at) VALUES($1,$2,now(),now())',[tenant,character]);
   await c.query("INSERT INTO identity.character_ownership(tenant_id,character_id,kind,created_at) VALUES($1,$2,'platform',now())",[tenant,character]);
   const profile={handle:'a04-'+tag,displayName:'Draft Test',profession:'Teacher',biography:'Fictional bio',
    lifeStory:'Fictional life',languages:['en'],talents:['math'],goals:['teach'],
    roomId:null,portraitMediaId:null,bannerMediaId:null};
   await c.query("INSERT INTO masana.character_revisions(tenant_id,character_id,revision,state,profile) VALUES($1,$2,1,'draft',$3::jsonb)",[tenant,character,JSON.stringify(profile)]);
   await c.query("INSERT INTO masana.rehearsal_runs(tenant_id,run_id,character_id,revision,staff_id,mode,prompt,idempotency_key) VALUES($1,$2,$3,1,$4,'chat','Draft a reply','request_test_"+'00000000'+"')",[tenant,run,character,staff]);
   const scoped=await c.query('SELECT staff_id FROM masana.rehearsal_runs WHERE tenant_id=$1 AND staff_id=$2 AND run_id=$3',[tenant,other,run]);
   expect(scoped.rowCount).toBe(0);
   await c.query('SAVEPOINT conflict');
   await expect(c.query("INSERT INTO masana.rehearsal_runs(tenant_id,run_id,character_id,revision,staff_id,mode,prompt,idempotency_key) VALUES($1,$2,$3,1,$4,'post','duplicate','request_test_00000000')",[tenant,'rehearsal_duplicate_'+tag,character,staff])).rejects.toMatchObject({code:'23505'});
   await c.query('ROLLBACK TO SAVEPOINT conflict');await c.query('RELEASE SAVEPOINT conflict');
   const lease='lease_'+tag;
   const running=await c.query("UPDATE masana.rehearsal_runs SET state='running',attempt=1,lease_token=$3,lease_until=now()+interval '90 seconds' WHERE tenant_id=$1 AND run_id=$2 RETURNING attempt,state",[tenant,run,lease]);
   expect(running.rows[0]).toMatchObject({state:'running',attempt:1});
   const wrongLease=await c.query("UPDATE masana.rehearsal_runs SET state='succeeded' WHERE tenant_id=$1 AND run_id=$2 AND lease_token='forged' RETURNING run_id",[tenant,run]);
   expect(wrongLease.rowCount).toBe(0);
   const failed=await c.query("UPDATE masana.rehearsal_runs SET state='failed',error_code='voice_not_qualified',lease_token=NULL,lease_until=NULL WHERE tenant_id=$1 AND run_id=$2 AND lease_token=$3 RETURNING state",[tenant,run,lease]);
   expect(failed.rows[0]?.state).toBe('failed');
  }finally{try{await c.query('ROLLBACK')}finally{c.release();await pool.end()}}
 },30000);
});