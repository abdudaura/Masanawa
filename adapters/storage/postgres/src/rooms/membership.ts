import {createHash, randomBytes, randomUUID} from 'node:crypto';
import type {Pool, PoolClient} from 'pg';
import {RoomError, requireFan, requireRoomStaff} from '@masanawa/rooms';
import type {RoomActor} from '@masanawa/rooms';
import {assertRoom, lookupRoom, requireMember, requirePublishedEligible} from './repository.js';

export interface MembershipView {userId:string; state:'active'|'left'|'banned'; role:'member'|'moderator';}
export interface InviteView {inviteId:string; expiresAt:string; revoked:boolean; accepted:boolean;}
export interface RoomMembershipRepository {
 members(a:RoomActor,id:string):Promise<MembershipView[]>;
 setRole(a:RoomActor,id:string,userId:string,role:unknown):Promise<void>;
 moderate(a:RoomActor,id:string,userId:string,action:unknown):Promise<void>;
 invites(a:RoomActor,id:string):Promise<InviteView[]>;
 issue(a:RoomActor,id:string):Promise<InviteView & {token:string}>;
 revoke(a:RoomActor,id:string,inviteId:string):Promise<void>;
 accept(a:RoomActor,id:string,token:unknown):Promise<{joined:true}>;
}
const staff=(a:RoomActor)=>a.roles.some(r=>['platform_admin','rooms_editor','rooms_moderator'].includes(r));
function user(raw:string):string {
 if(typeof raw!=='string'||!raw.trim()||raw.length>160)throw new RoomError(422,'invalid_member');
 return raw;
}
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const inviteView=(r:any):InviteView=>({inviteId:r.invite_id,expiresAt:new Date(r.expires_at).toISOString(),revoked:!!r.revoked_at,accepted:!!r.accepted_by});
/** Lock room first everywhere: serialize role changes, bans and invite acceptance with canonical join. */
export function createPgRoomMembershipRepository(pool:Pool):RoomMembershipRepository {
 async function tx<T>(a:RoomActor,id:string,fn:(q:PoolClient,row:any)=>Promise<T>):Promise<T>{
  assertRoom(id);requireFan(a.userId);
  const q=await pool.connect();
  try {await q.query('BEGIN');const row=await lookupRoom(q,a.tenantId,id,true);
   const result=await fn(q,row);await q.query('COMMIT');return result;
  } catch(e){await q.query('ROLLBACK');throw e;}finally{q.release();}
 }
 async function manager(q:PoolClient,a:RoomActor,row:any){
  if(staff(a)){requireRoomStaff(a.roles);return;}
  await requirePublishedEligible(q,a,row);await requireMember(q,a,row.room_id,true);
  const r=await q.query('SELECT role FROM rooms.memberships WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3',[a.tenantId,row.room_id,a.userId]);
  if(r.rows[0]?.role!=='moderator')throw new RoomError(403,'room_moderator_required');
 }
 async function audit(q:PoolClient,a:RoomActor,id:string,event:string,payload:object){
  await q.query(`INSERT INTO events.audit_events
   (audit_event_id,tenant_id,event_type,schema_version,aggregate_type,aggregate_id,occurred_at,actor,correlation_id,sensitivity,payload)
   VALUES($1,$2,$3,1,'room',$4,now(),jsonb_build_object('userId',$5::text),$6,'internal',$7::jsonb)`,
   ['audit-event_'+randomUUID(),a.tenantId,event,id,a.userId,'correlation_'+randomUUID(),JSON.stringify(payload)]);
 }
 return {
  members(a,id){return tx(a,id,async(q,row)=>{await manager(q,a,row);
   const r=await q.query('SELECT user_id,state,role FROM rooms.memberships WHERE tenant_id=$1 AND room_id=$2 ORDER BY user_id LIMIT 100',[a.tenantId,id]);
   return r.rows.map(r=>({userId:r.user_id,state:r.state,role:r.role}));});},
  async setRole(a,id,target,role){
   requireRoomStaff(a.roles);user(target);
   if(role!=='member'&&role!=='moderator')throw new RoomError(422,'invalid_room_role');
   return tx(a,id,async(q)=>{
    const r=await q.query(`UPDATE rooms.memberships SET role=$4,updated_at=now()
     WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3 AND state='active' RETURNING user_id`,[a.tenantId,id,target,role]);
    if(!r.rows.length)throw new RoomError(409,'active_membership_required');
    await audit(q,a,id,'rooms.membership.role_changed',{userId:target,role});
   });
  },
  async moderate(a,id,target,action){
   user(target);if(action!=='ban'&&action!=='unban')throw new RoomError(422,'invalid_member_action');
   if(target===a.userId)throw new RoomError(409,'cannot_moderate_self');
   return tx(a,id,async(q,row)=>{await manager(q,a,row);
    const r=await q.query('SELECT state,role FROM rooms.memberships WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3 FOR UPDATE',[a.tenantId,id,target]);
    if(!r.rows.length)throw new RoomError(404,'member_not_found');
    if(r.rows[0].role==='moderator'&&!staff(a))throw new RoomError(403,'staff_role_required');
    if(action==='unban'&&r.rows[0].state!=='banned')throw new RoomError(409,'member_not_banned');
    // Unban only permits a later join; never silently enroll or restore a moderator.
    await q.query("UPDATE rooms.memberships SET state=$4,role='member',updated_at=now() WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3",[a.tenantId,id,target,action==='ban'?'banned':'left']);
    await audit(q,a,id,'rooms.membership.'+action,{userId:target});
   });
  },
  invites(a,id){return tx(a,id,async(q,row)=>{await manager(q,a,row);
   const r=await q.query('SELECT invite_id,expires_at,revoked_at,accepted_by FROM rooms.membership_invites WHERE tenant_id=$1 AND room_id=$2 ORDER BY created_at DESC,invite_id LIMIT 100',[a.tenantId,id]);
   return r.rows.map(inviteView);});},
  issue(a,id){return tx(a,id,async(q,row)=>{await manager(q,a,row);
   if(row.state!=='published')throw new RoomError(409,'room_not_published');
   const count=await q.query(`SELECT count(*)::int AS n FROM rooms.membership_invites WHERE tenant_id=$1 AND room_id=$2
    AND revoked_at IS NULL AND accepted_by IS NULL AND expires_at>now()`,[a.tenantId,id]);
   if(Number(count.rows[0]?.n)>=20)throw new RoomError(429,'room_invite_limit');
   const token=randomBytes(32).toString('base64url'),inviteId='room-invite_'+randomUUID();
   const r=await q.query(`INSERT INTO rooms.membership_invites(tenant_id,room_id,invite_id,token_hash,created_by,expires_at)
    VALUES($1,$2,$3,$4,$5,now()+interval '24 hours') RETURNING invite_id,expires_at,revoked_at,accepted_by`,[a.tenantId,id,inviteId,digest(token),a.userId]);
   await audit(q,a,id,'rooms.invite.issued',{inviteId});
   return {...inviteView(r.rows[0]),token};
  });},
  revoke(a,id,inviteId){return tx(a,id,async(q,row)=>{await manager(q,a,row);
   const r=await q.query(`UPDATE rooms.membership_invites SET revoked_at=COALESCE(revoked_at,now())
    WHERE tenant_id=$1 AND room_id=$2 AND invite_id=$3 RETURNING invite_id`,[a.tenantId,id,inviteId]);
   if(!r.rows.length)throw new RoomError(404,'invite_not_found');
   await audit(q,a,id,'rooms.invite.revoked',{inviteId});
  });},
  async accept(a,id,raw){
   if(typeof raw!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(raw))throw new RoomError(422,'invalid_invite');
   return tx(a,id,async(q,row)=>{
    await requirePublishedEligible(q,a,row);
    const membership=await q.query('SELECT state FROM rooms.memberships WHERE tenant_id=$1 AND room_id=$2 AND user_id=$3 FOR UPDATE',[a.tenantId,id,a.userId]);
    if(membership.rows[0]?.state==='banned')throw new RoomError(403,'room_banned');
    const r=await q.query(`SELECT *,expires_at>now() AS unexpired FROM rooms.membership_invites
     WHERE tenant_id=$1 AND room_id=$2 AND token_hash=$3 FOR UPDATE`,[a.tenantId,id,digest(raw)]);
    const invite=r.rows[0];
    if(!invite||invite.revoked_at)throw new RoomError(404,'invite_unavailable');
    // Lost-response retry succeeds only for the same still-active account; no replay re-enrollment.
    if(invite.accepted_by){
     if(invite.accepted_by===a.userId&&membership.rows[0]?.state==='active')return {joined:true as const};
     throw new RoomError(409,'invite_already_used');
    }
    if(!invite.unexpired)throw new RoomError(410,'invite_expired');
    await q.query(`INSERT INTO rooms.memberships AS current_member(tenant_id,room_id,user_id,role)
     VALUES($1,$2,$3,'member')
     ON CONFLICT(tenant_id,room_id,user_id) DO UPDATE
       SET state='active',
           role=CASE WHEN current_member.state='active' THEN current_member.role ELSE 'member' END,
           updated_at=now()`,[a.tenantId,id,a.userId]);
    await q.query('UPDATE rooms.membership_invites SET accepted_by=$4,accepted_at=now() WHERE tenant_id=$1 AND room_id=$2 AND invite_id=$3',[a.tenantId,id,invite.invite_id,a.userId]);
    await audit(q,a,id,'rooms.invite.accepted',{inviteId:invite.invite_id});
    return {joined:true as const};
   });
  }
 };
}
