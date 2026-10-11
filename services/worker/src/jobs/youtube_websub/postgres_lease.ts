import type { Pool } from "@masanawa/postgres";
import { YouTubeLeaseError } from "./subscribe.js";

/**
 * Records a pending lease request on the canonical video source table before
 * contacting Google's hub, so the later challenge can be confirmed atomically.
 * Does not grant automation eligibility or set an active lease itself.
 */
export function createPostgresLeaseRequestRecorder(pool: Pool) {
  return async (tenantId:string,sourceId:string):Promise<void> => {
    if(!tenantId || !sourceId) throw new YouTubeLeaseError("invalid_source");
    const query=await pool.query(
      `UPDATE external_videos.youtube_subscriptions
           SET lease_requested_at=clock_timestamp(),updated_at=clock_timestamp()
         WHERE tenant_id=$1 AND source_id=$2 AND enabled AND authorized_api
           AND permission_expires_at>clock_timestamp()`,
      [tenantId,sourceId],
    );
    if(query.rowCount!==1) throw new YouTubeLeaseError("not_authorized");
  };
}
