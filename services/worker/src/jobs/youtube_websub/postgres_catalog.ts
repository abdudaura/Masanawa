import { randomUUID } from "node:crypto";
import type { Pool } from "@masanawa/postgres";
import type { YouTubeSyncSource, YouTubeCatalogSink } from "./reconcile.js";

/**
 * The canonical source record is owned by external_videos. This adapter does
 * not maintain an alternate source or job store, and rechecks authorization
 * at execution time rather than trusting outbox payload flags.
 */
export function createPostgresYouTubeSourceLoader(pool: Pool) {
  return async (tenantId: string, sourceId: string): Promise<YouTubeSyncSource | null> => {
    if (!tenantId || !sourceId) return null;
    const found = await pool.query<{
      tenant_id: string; source_id: string; provider_channel_id: string;
      channel_name: string; target_region: string; enabled: boolean;
      mode: "authorized_api" | "manual"; api_qualified: boolean;
    }>(`SELECT s.tenant_id, s.source_id, s.provider_channel_id,
               s.channel_name, s.target_region, (s.enabled AND y.enabled) AS enabled,
               s.sync_mode AS mode,
               (y.authorized_api AND s.authorization_ref IS NOT NULL
                 AND s.permission_expires_at > clock_timestamp()
                 AND y.permission_expires_at > clock_timestamp()) AS api_qualified
          FROM external_videos.sources AS s
          JOIN external_videos.youtube_subscriptions AS y
            ON y.tenant_id=s.tenant_id AND y.source_id=s.source_id
           AND y.channel_id=s.provider_channel_id
         WHERE s.tenant_id=$1 AND s.source_id=$2 AND s.provider='youtube'`,
    [tenantId, sourceId]);
    const item = found.rows[0];
    if (!item) return null;
    return {
      tenantId: item.tenant_id, sourceId: item.source_id,
      channelId: item.provider_channel_id, channelName: item.channel_name,
      targetRegion: item.target_region, enabled: item.enabled,
      mode: item.mode, apiQualified: item.api_qualified,
    };
  };
}

/** Persist only metadata in J15's existing video catalog.
 * Published/approved items cannot be changed by an automatic import.
 * Rows are linked to the originating source, so a different source's
 * reconciliation cannot take them down.
 */
export function createPostgresYouTubeCatalogSink(pool: Pool): YouTubeCatalogSink {
  return {
    async stagePending(item) {
      if (!item.tenantId || !item.sourceId || item.provider !== "youtube" ||
        !/^[A-Za-z0-9_-]{11}$/u.test(item.providerVideoId) ||
        item.sourceUrl !== `https://www.youtube.com/watch?v=${item.providerVideoId}` ||
        !item.title.trim() || !item.channelName.trim()) {
        throw new TypeError("youtube_invalid_video");
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Lock current source+credential authority through commit, not only at
        // the earlier job-claim boundary. Stale permission may never publish.
        const eligible = await client.query(
          `SELECT 1 FROM external_videos.sources s
             JOIN external_videos.youtube_subscriptions y
               ON y.tenant_id=s.tenant_id AND y.source_id=s.source_id
              AND y.channel_id=s.provider_channel_id
            WHERE s.tenant_id=$1 AND s.source_id=$2
              AND s.provider='youtube' AND s.enabled AND y.enabled
              AND s.sync_mode='authorized_api' AND y.authorized_api
              AND s.permission_expires_at > clock_timestamp()
              AND y.permission_expires_at > clock_timestamp()
            FOR SHARE OF s,y`,
          [item.tenantId,item.sourceId]);
        if (eligible.rowCount!==1) throw new Error("youtube_source_not_authorized");
        const id=randomUUID();
        const saved = await client.query<{item_id: string}>(
          `INSERT INTO external_videos.items
              (tenant_id,item_id,provider,provider_video_id,source_url,title,channel_name)
            VALUES ($1,$2,'youtube',$3,$4,$5,$6)
            ON CONFLICT (tenant_id,provider,provider_video_id) DO NOTHING
            RETURNING item_id`,
          [item.tenantId,id,item.providerVideoId,item.sourceUrl,
           item.title.slice(0,180),item.channelName.slice(0,100)]);
        // Crucial: an existing staff/manual item is NOT silently linked to an
        // automated source, otherwise a later sync could hide staff content.
        if (saved.rows[0]) {
          await client.query(
            `INSERT INTO external_videos.item_sources(tenant_id,item_id,source_id)
             VALUES ($1,$2,$3)`,
            [item.tenantId,id,item.sourceId]);
          await client.query(
            `INSERT INTO external_videos.review_audit
               (tenant_id,event_id,item_id,actor_id,action)
             VALUES ($1,$2,$3,'youtube-sync','submit')`,
            [item.tenantId,randomUUID(),id]);
        }
        await client.query("COMMIT");
      } catch(error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },
    async markUnavailable(item) {
      if (!item.tenantId || !item.sourceId ||
        !/^[A-Za-z0-9_-]{11}$/u.test(item.providerVideoId)) {
        throw new TypeError("youtube_invalid_video");
      }
      const client=await pool.connect();
      try {
        await client.query("BEGIN");
        const result=await client.query<{item_id:string}>(
          `UPDATE external_videos.items AS v SET review_state='unavailable',
             updated_at=clock_timestamp()
            WHERE v.tenant_id=$1 AND v.provider='youtube'
              AND v.provider_video_id=$2 AND v.review_state <> 'unavailable'
              AND EXISTS (
                SELECT 1 FROM external_videos.item_sources AS origin
                 JOIN external_videos.sources AS authority
                   ON authority.tenant_id=origin.tenant_id
                  AND authority.source_id=origin.source_id
                 JOIN external_videos.youtube_subscriptions AS subscription
                   ON subscription.tenant_id=authority.tenant_id
                  AND subscription.source_id=authority.source_id
                  AND subscription.channel_id=authority.provider_channel_id
                 WHERE origin.tenant_id=v.tenant_id AND origin.item_id=v.item_id
                   AND origin.source_id=$3 AND authority.provider='youtube'
                   AND authority.enabled AND subscription.enabled
                   AND authority.sync_mode='authorized_api' AND subscription.authorized_api
                   AND authority.permission_expires_at>clock_timestamp()
                   AND subscription.permission_expires_at>clock_timestamp())
            RETURNING item_id`,
          [item.tenantId,item.providerVideoId,item.sourceId]);
        if (result.rows[0]) {
          await client.query(
            `INSERT INTO external_videos.review_audit
             (tenant_id,event_id,item_id,actor_id,action)
             VALUES ($1,$2,$3,'youtube-sync','unavailable')`,
            [item.tenantId,randomUUID(),result.rows[0].item_id]);
        }
        await client.query("COMMIT");
      } catch(error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },
  };
}
