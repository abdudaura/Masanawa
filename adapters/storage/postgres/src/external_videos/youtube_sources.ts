import type { Pool, PoolClient } from "@masanawa/postgres";
import { withTransaction } from "@masanawa/postgres";
/** Storage-only structural contract; gateway owns the public API DTO. */
interface AdminYouTubeSource {
  readonly id:string;readonly channelId:string;readonly channelName:string;
  readonly targetRegion:string;readonly enabled:boolean;
  readonly syncMode:"manual"|"authorized_api";
}
interface AdminYouTubeSourceStore {
  list(tenantId:string):Promise<readonly AdminYouTubeSource[]>;
  create(input:{tenantId:string;id:string;channelId:string;channelName:string;targetRegion:string;actorId:string}):Promise<AdminYouTubeSource>;
  pause(input:{tenantId:string;id:string;actorId:string}):Promise<boolean>;
}

/** AF00 injects the existing canonical events.audit_events writer. Audit
 * failure aborts the transaction; no separate audit log is introduced.
 */
export interface VideoSourceAudit {
  (client:PoolClient, entry:{
    tenantId:string;actorId:string;sourceId:string;action:"create_manual"|"pause";
  }):Promise<void>;
}
interface DbSource {
  source_id:string;provider_channel_id:string;channel_name:string;target_region:string;
  enabled:boolean;sync_mode:"manual"|"authorized_api";
}
function project(row:DbSource):AdminYouTubeSource {
  return {
    id:row.source_id,channelId:row.provider_channel_id,channelName:row.channel_name,
    targetRegion:row.target_region,enabled:row.enabled,syncMode:row.sync_mode,
  };
}
export function createPostgresYouTubeSourceAdminStore(pool:Pool,recordAudit:VideoSourceAudit):AdminYouTubeSourceStore {
  const cols="source_id,provider_channel_id,channel_name,target_region,enabled,sync_mode";
  return {
    async list(tenantId) {
      const q=await pool.query<DbSource>(
        `SELECT ${cols} FROM external_videos.sources
          WHERE tenant_id=$1 AND provider='youtube'
          ORDER BY channel_name,source_id LIMIT 200`,[tenantId]);
      return q.rows.map(project);
    },
    async create(item) {
      return withTransaction(pool,async(client)=>{
        const inserted=await client.query<DbSource>(
          `INSERT INTO external_videos.sources
             (tenant_id,source_id,provider,provider_channel_id,channel_name,target_region,
              sync_mode,enabled)
           VALUES ($1,$2,'youtube',$3,$4,$5,'manual',false)
           ON CONFLICT (tenant_id,provider,provider_channel_id) DO NOTHING
           RETURNING ${cols}`,
          [item.tenantId,item.id,item.channelId,item.channelName,item.targetRegion]);
        const row=inserted.rows[0];
        if(!row) throw new Error("video_source_conflict");
        await recordAudit(client,{tenantId:item.tenantId,actorId:item.actorId,sourceId:item.id,action:"create_manual"});
        return project(row);
      });
    },
    async pause(item) {
      return withTransaction(pool,async(client)=>{
        const stopped=await client.query<{source_id:string}>(
          `UPDATE external_videos.sources SET enabled=false,updated_at=clock_timestamp()
            WHERE tenant_id=$1 AND source_id=$2 AND provider='youtube'
            RETURNING source_id`,[item.tenantId,item.id]);
        if(!stopped.rows[0]) return false;
        await client.query(
          `UPDATE external_videos.youtube_subscriptions
             SET enabled=false,updated_at=clock_timestamp()
            WHERE tenant_id=$1 AND source_id=$2`,[item.tenantId,item.id]);
        await recordAudit(client,{tenantId:item.tenantId,actorId:item.actorId,sourceId:item.id,action:"pause"});
        return true;
      });
    },
  };
}
