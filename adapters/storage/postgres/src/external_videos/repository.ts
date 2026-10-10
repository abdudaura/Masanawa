import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
type Item = {
  id: string; tenantId: string; provider: "youtube"|"tiktok"|"facebook";
  providerVideoId: string; sourceUrl: string; title: string; channelName: string;
  reviewState: "pending"|"approved"|"hidden"|"unavailable";
  verifiedAt: string|null; createdAt: string;
};
const projection = "item_id AS id, tenant_id AS \"tenantId\", provider, provider_video_id AS \"providerVideoId\", source_url AS \"sourceUrl\", title, channel_name AS \"channelName\", review_state AS \"reviewState\", verified_at AS \"verifiedAt\", created_at AS \"createdAt\"";
async function transaction<T>(pool: Pool, handler: (db: PoolClient) => Promise<T>): Promise<T> {
  const db=await pool.connect();
  try {
    await db.query("BEGIN"); const result=await handler(db); await db.query("COMMIT"); return result;
  } catch (err) { await db.query("ROLLBACK"); throw err; }
  finally { db.release(); }
}
export function createPostgresVideoStore(pool: Pool) {
  return {
    async submit(item: Item, actorId: string): Promise<Item> {
      return transaction(pool, async db => {
        const saved=await db.query<Item>(
          "INSERT INTO external_videos.items(tenant_id,item_id,provider,provider_video_id,source_url,title,channel_name) "+
          "VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tenant_id,provider,provider_video_id) DO NOTHING RETURNING "+projection,
          [item.tenantId,item.id,item.provider,item.providerVideoId,item.sourceUrl,item.title,item.channelName]
        );
        if (!saved.rows[0]) {
          const prior=await db.query<Item>("SELECT "+projection+" FROM external_videos.items WHERE tenant_id=$1 AND provider=$2 AND provider_video_id=$3",[item.tenantId,item.provider,item.providerVideoId]);
          if (!prior.rows[0]) throw new Error("Video submission race");
          return prior.rows[0];
        }
        await db.query("INSERT INTO external_videos.review_audit(tenant_id,event_id,item_id,actor_id,action) VALUES($1,$2,$3,$4,'submit')",
          [item.tenantId,randomUUID(),item.id,actorId]);
        return saved.rows[0];
      });
    },
    async review(input: {
      tenantId:string; id:string; actorId:string; expectedState:"pending"|"approved";
      state:"approved"|"hidden"|"unavailable"; verificationReference:string|null;
    }): Promise<Item|null> {
      return transaction(pool, async db => {
        const changed=await db.query<Item>(
          "UPDATE external_videos.items SET review_state=$4, verified_at=CASE WHEN $4='approved' THEN clock_timestamp() ELSE NULL END,"+
          " verification_reference=$5, reviewed_by=$6, updated_at=clock_timestamp() "+
          "WHERE tenant_id=$1 AND item_id=$2::uuid AND review_state=$3 RETURNING "+projection,
          [input.tenantId,input.id,input.expectedState,input.state,input.verificationReference,input.actorId]);
        if (!changed.rows[0]) return null;
        await db.query(
          "INSERT INTO external_videos.review_audit(tenant_id,event_id,item_id,actor_id,action,verification_reference) VALUES($1,$2,$3,$4,$5,$6)",
          [input.tenantId,randomUUID(),input.id,input.actorId,input.state==="approved"?"approve":input.state==="hidden"?"hide":"unavailable",input.verificationReference]);
        return changed.rows[0];
      });
    },
    async list(input: { tenantId:string; provider?:"youtube"|"tiktok"|"facebook"; publicOnly:boolean;limit:number; before?:string }): Promise<readonly Item[]> {
      const result=await pool.query<Item>(
        "SELECT "+projection+" FROM external_videos.items WHERE tenant_id=$1 "+
        "AND ($2::text IS NULL OR provider=$2) AND (NOT $3::boolean OR review_state='approved') "+
        "AND ($4::uuid IS NULL OR (created_at,item_id) < (SELECT created_at,item_id FROM external_videos.items WHERE tenant_id=$1 AND item_id=$4::uuid)) "+
        "ORDER BY created_at DESC,item_id DESC LIMIT $5",
        [input.tenantId,input.provider??null,input.publicOnly,input.before??null,input.limit]);
      return result.rows;
    },
  };
}
