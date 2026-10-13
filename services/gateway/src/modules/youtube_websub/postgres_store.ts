import { createHash } from "node:crypto";
import { createCanonicalId, nowInstant, parseCanonicalId } from "@masanawa/contracts";
import { admitInboxEvent, enqueueOutbox, withTransaction, type Pool } from "@masanawa/postgres";
import { YOUTUBE_OUTBOX_DESTINATION, type YouTubeWebSubStore } from "./service.js";

/**
 * Adapter to the EXISTING events.inbox + events.outbox, in one PG transaction.
 * Depends on the single J15 external_videos package adding youtube_subscriptions
 * (not a competing schema/migration root). Never stores provider secrets in logs.
 */
export function createPostgresYouTubeWebSubStore(deps: {
  readonly pool: Pool;
  /** Server-side secret manager (not a client/API request field). */
  readonly resolveSignatureSecret: (credentialRef: string) => Promise<string>;
}): YouTubeWebSubStore {
  return {
    async findByCallbackToken(token) {
      const callbackHash = createHash("sha256").update(token).digest("hex");
      const query = await deps.pool.query<{
        tenant_id:string;source_id:string;channel_id:string;credential_ref:string;
        enabled:boolean;authorized:boolean;
      }>(`SELECT tenant_id,source_id,channel_id,signature_secret_ref AS credential_ref,
                    enabled,(authorized_api AND permission_expires_at>clock_timestamp()) AS authorized
             FROM external_videos.youtube_subscriptions
             WHERE callback_token_sha256=$1`,[callbackHash]);
      const row=query.rows[0];
      if (!row) return null;
      // Fail closed without handing secret resolution failures to the client.
      const signatureSecret = await deps.resolveSignatureSecret(row.credential_ref);
      return {
        tenantId:row.tenant_id,sourceId:row.source_id,channelId:row.channel_id,
        signatureSecret,enabled:row.enabled,authorized:row.authorized,
      };
    },
    async confirmVerifiedLease(input) {
      const callbackHash=createHash("sha256").update(input.callbackToken).digest("hex");
      const row=await deps.pool.query(
        `UPDATE external_videos.youtube_subscriptions
           SET lease_expires_at=clock_timestamp()+($4::bigint*interval '1 second'),
               lease_requested_at=NULL,updated_at=clock_timestamp()
         WHERE callback_token_sha256=$1 AND tenant_id=$2 AND source_id=$3
           AND enabled AND authorized_api
           AND permission_expires_at>clock_timestamp()
           AND lease_requested_at IS NOT NULL`,
        [callbackHash,input.tenantId,input.sourceId,input.leaseSeconds],
      );
      return row.rowCount===1;
    },
    async enqueueReconciliation(input) {
      const tenantId=parseCanonicalId("tenant",input.tenantId);
      return withTransaction(deps.pool, async client => {
        const admitted=await admitInboxEvent(client,{
          tenantId,namespace:"youtube_websub",eventId:input.operationKey,
          provider:"youtube",accountRef:input.sourceId,
          payloadHash:input.eventBodySha256,
          tombstoneUntil:new Date(Date.now()+90*86400_000).toISOString() as ReturnType<typeof nowInstant>,
        });
        if(admitted.reused) return false;
        await enqueueOutbox(client,{
          tenantId,eventId:createCanonicalId("event"),
          eventType:"youtube.reconcile.requested",schemaVersion:1,
          aggregateType:"external_video_source",aggregateId:input.sourceId,
          correlationId:createCanonicalId("correlation"),causationId:null,
          destination:YOUTUBE_OUTBOX_DESTINATION,availableAt:nowInstant(),
          payload:{tenantId:input.tenantId,sourceId:input.sourceId,bodySha256:input.eventBodySha256},
        });
        return true;
      });
    },
  };
}
