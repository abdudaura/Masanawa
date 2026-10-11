import { createHash } from "node:crypto";
import type { Pool } from "@masanawa/postgres";
import { createPostgresLeaseRequestRecorder } from "./postgres_lease.js";
import { createYouTubeHubSubscriber, type YouTubeLeaseRequest } from "./subscribe.js";

/** API-free, explicit lease renewal entry point; the existing worker invokes
 * renewDue when its scheduler runs. Secrets stay in the configured vault.
 * Pending leases are not considered active until Google's GET challenge is
 * validated by the gateway and recorded in the canonical subscription row.
 */
export function createYouTubeLeaseManager(input: {
  readonly pool: Pool;
  readonly callbackBaseUrl: string;
  readonly allowedCallbackHost: string;
  readonly resolveCredential: (ref: string) => Promise<string>;
  readonly fetchImpl?: typeof fetch;
}) {
  const subscriber=createYouTubeHubSubscriber({
    callbackBaseUrl:input.callbackBaseUrl,
    allowedCallbackHost:input.allowedCallbackHost,
    ...(input.fetchImpl?{fetchImpl:input.fetchImpl}:{}),
    markLeaseRequested:createPostgresLeaseRequestRecorder(input.pool),
  });
  return {
    async renewDue(limit=10): Promise<{requested:number;failed:number}> {
      if(!Number.isInteger(limit)||limit<1||limit>20) throw new RangeError("youtube_renew_limit");
      const rows=await input.pool.query<{
        tenant_id:string;source_id:string;channel_id:string;callback_token_sha256:string;
        callback_token_ref:string;signature_secret_ref:string;
      }>(`SELECT y.tenant_id,y.source_id,y.channel_id,
                  y.callback_token_sha256,y.callback_token_ref,y.signature_secret_ref
            FROM external_videos.youtube_subscriptions AS y
            JOIN external_videos.sources AS s
              ON s.tenant_id=y.tenant_id AND s.source_id=y.source_id
             AND s.provider='youtube' AND s.provider_channel_id=y.channel_id
           WHERE y.enabled AND y.authorized_api AND s.enabled
             AND s.sync_mode='authorized_api'
             AND y.permission_expires_at>clock_timestamp()
             AND s.permission_expires_at>clock_timestamp()
             AND (y.lease_expires_at IS NULL
                  OR y.lease_expires_at < clock_timestamp()+interval '24 hours')
             AND (y.lease_requested_at IS NULL
                  OR y.lease_requested_at < clock_timestamp()-interval '10 minutes')
           ORDER BY y.lease_expires_at NULLS FIRST,y.tenant_id,y.source_id
           LIMIT $1`,[limit]);
      let requested=0,failed=0;
      for(const row of rows.rows) {
        try {
          const [callbackToken,signatureSecret]=await Promise.all([
            input.resolveCredential(row.callback_token_ref),
            input.resolveCredential(row.signature_secret_ref),
          ]);
          const actualHash=createHash("sha256").update(callbackToken).digest("hex");
          if(actualHash!==row.callback_token_sha256) throw new Error("youtube_callback_token_mismatch");
          const source:YouTubeLeaseRequest={
            tenantId:row.tenant_id,sourceId:row.source_id,
            channelId:row.channel_id,callbackToken,signatureSecret,
            enabled:true,apiQualified:true,mode:"authorized_api",
          };
          await subscriber.requestLease(source);
          requested++;
        } catch { failed++; }
      }
      return {requested,failed};
    },
  };
}
