
import {randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {RoomError,validatePrice} from "@masanawa/rooms";
import type {RoomSubscriptionsRepository} from "@masanawa/rooms/ports";
const uuid=(prefix:string)=>prefix+randomUUID();
async function transaction<T>(pool:Pool,fn:(q:PoolClient)=>Promise<T>):Promise<T>{
 const q=await pool.connect();try{await q.query("BEGIN");const v=await fn(q);await q.query("COMMIT");return v;}
 catch(e){await q.query("ROLLBACK");throw e;}finally{q.release();}
}
const price=(x:any)=>({planId:x.plan_id,version:Number(x.version),amountMinor:String(x.amount_minor),
 currency:x.currency,storeProductId:x.store_product_id,effectiveAt:new Date(x.effective_at).toISOString()});
const entitlement=(x:any)=>({roomId:x.room_id,planId:x.plan_id,priceVersion:Number(x.price_version),
 state:x.state,periodEnd:new Date(x.period_end).toISOString()});
export function createPgRoomSubscriptions(pool:Pool):RoomSubscriptionsRepository {
 return {
  async listPlans(tenantId,roomId){
   const r=await pool.query(`SELECT p.* FROM rooms.price_versions p
    JOIN rooms.plans l ON l.tenant_id=p.tenant_id AND l.plan_id=p.plan_id
    JOIN rooms.rooms room ON room.tenant_id=l.tenant_id AND room.room_id=l.room_id
    WHERE l.tenant_id=$1 AND l.room_id=$2 AND l.state='active'
    AND p.effective_at<=now() AND room.state='published'
    ORDER BY l.period,p.version DESC`,[tenantId,roomId]);
   const seen=new Set<string>();
   return r.rows.filter(x=>!seen.has(x.plan_id)&&Boolean(seen.add(x.plan_id))).map(price);
  },
  async myEntitlements(tenantId,userId){
   const r=await pool.query(`SELECT * FROM rooms.entitlements WHERE tenant_id=$1 AND user_id=$2
    ORDER BY updated_at DESC LIMIT 100`,[tenantId,userId]);
   return r.rows.map(entitlement);
  },
  async createPlan(tenantId,roomId,period){
   if(!/^room_[a-zA-Z0-9_-]{3,100}$/u.test(roomId)||!["month","year"].includes(period))
    throw new RoomError(422,"invalid_plan");
   const newId=uuid("room-plan_");
   const r=await pool.query(`INSERT INTO rooms.plans(tenant_id,plan_id,room_id,period)
    SELECT $1,$2,$3,$4 FROM rooms.rooms WHERE tenant_id=$1 AND room_id=$3
    ON CONFLICT (tenant_id,room_id,period) DO NOTHING RETURNING plan_id`,
    [tenantId,newId,roomId,period]);
   if(!r.rows.length)throw new RoomError(409,"room_or_plan_conflict");
   return newId;
  },
  async addPrice(tenantId,planId,input){
   validatePrice(input);
   return transaction(pool,async q=>{
    const plan=await q.query("SELECT state FROM rooms.plans WHERE tenant_id=$1 AND plan_id=$2 FOR UPDATE",[tenantId,planId]);
    if(!plan.rows.length||plan.rows[0].state==="retired")throw new RoomError(404,"plan_not_found");
    const next=await q.query("SELECT coalesce(max(version),0)::int+1 AS v FROM rooms.price_versions WHERE tenant_id=$1 AND plan_id=$2",[tenantId,planId]);
    const r=await q.query(`INSERT INTO rooms.price_versions
     (tenant_id,plan_id,version,amount_minor,currency,store_product_id,effective_at)
     VALUES ($1,$2,$3,$4::bigint,$5,$6,$7::timestamptz) RETURNING *`,
     [tenantId,planId,Number(next.rows[0].v),input.amountMinor,input.currency,input.storeProductId,input.effectiveAt]);
    await q.query("UPDATE rooms.plans SET state='active',updated_at=now() WHERE tenant_id=$1 AND plan_id=$2",[tenantId,planId]);
    return price(r.rows[0]);
   });
  },
  async activatePaid(tenantId,roomId){
   const r=await pool.query(`UPDATE rooms.rooms room SET plan_mode='paid',updated_at=now()
    WHERE tenant_id=$1 AND room_id=$2 AND state='published'
    AND EXISTS (SELECT 1 FROM rooms.plans l JOIN rooms.price_versions p
     ON p.tenant_id=l.tenant_id AND p.plan_id=l.plan_id
     WHERE l.tenant_id=$1 AND l.room_id=$2 AND l.state='active' AND p.effective_at<=now())
    RETURNING room_id`,[tenantId,roomId]);
   if(!r.rows.length)throw new RoomError(409,"paid_plan_not_eligible");
  },
  async persistVerified(v){
   if(!/^[0-9a-f]{64}$/u.test(v.tokenHash)||!Number.isFinite(Date.parse(v.periodEnd)))
    throw new RoomError(422,"invalid_verified_purchase");
   return transaction(pool,async q=>{
    const found=await q.query(`SELECT 1 FROM rooms.plans l
     JOIN rooms.price_versions p ON p.tenant_id=l.tenant_id AND p.plan_id=l.plan_id
     JOIN rooms.rooms r ON r.tenant_id=l.tenant_id AND r.room_id=l.room_id
     WHERE l.tenant_id=$1 AND l.plan_id=$2 AND p.version=$3 AND l.room_id=$4
      AND p.store_product_id=$5 AND l.state='active' AND r.state='published'
      AND r.plan_mode='paid' AND p.effective_at<=now()`,
     [v.tenantId,v.planId,v.priceVersion,v.roomId,v.storeProductId]);
    if(!found.rows.length)throw new RoomError(409,"purchase_price_mismatch");
    const r=await q.query(`INSERT INTO rooms.entitlements
      (tenant_id,user_id,room_id,plan_id,price_version,state,period_end,store_purchase_token_hash,store_order_ref)
      VALUES($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9)
      ON CONFLICT(tenant_id,user_id,room_id) DO UPDATE SET
      plan_id=EXCLUDED.plan_id,price_version=EXCLUDED.price_version,state=EXCLUDED.state,
      period_end=EXCLUDED.period_end,store_purchase_token_hash=EXCLUDED.store_purchase_token_hash,
      store_order_ref=EXCLUDED.store_order_ref,last_verified_at=now(),updated_at=now()
      RETURNING *`,[v.tenantId,v.userId,v.roomId,v.planId,v.priceVersion,v.state,v.periodEnd,v.tokenHash,v.orderId]);
    return entitlement(r.rows[0]);
   });
  },
  async ownerForToken(tokenHash){
   const r=await pool.query("SELECT tenant_id FROM rooms.entitlements WHERE store_purchase_token_hash=$1",[tokenHash]);
   return r.rows[0]?.tenant_id??null;
  },
  async applyNotification(v){
   return transaction(pool,async q=>{
    const dedup=await q.query(`INSERT INTO rooms.store_notifications
      (tenant_id,notification_id,token_hash,event_type,result)
      VALUES($1,$2,$3,$4,'unlinked')
      ON CONFLICT(tenant_id,notification_id) DO NOTHING RETURNING notification_id`,
      [v.tenantId,v.id,v.tokenHash,v.eventType]);
    if(!dedup.rows.length)return "duplicate";
    const found=await q.query("SELECT * FROM rooms.entitlements WHERE tenant_id=$1 AND store_purchase_token_hash=$2 FOR UPDATE",
      [v.tenantId,v.tokenHash]);
    if(!found.rows.length)return "unlinked";
    await q.query(`UPDATE rooms.entitlements SET state=$3,period_end=$4::timestamptz,
      store_order_ref=$5,last_verified_at=now(),updated_at=now()
      WHERE tenant_id=$1 AND store_purchase_token_hash=$2`,
      [v.tenantId,v.tokenHash,v.state,v.periodEnd,v.orderId]);
    await q.query("UPDATE rooms.store_notifications SET result='linked' WHERE tenant_id=$1 AND notification_id=$2",
      [v.tenantId,v.id]);
    return "linked";
   });
  }
 };
}
