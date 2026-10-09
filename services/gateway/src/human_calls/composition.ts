import type { PlatformCustomerSessionAuthorizer } from "../customer_auth.js";
import { createHumanCallService } from "./service.js";
import { createPostgresHumanCallRepository,type HumanCallSqlPool } from "./postgres_repository.js";
import { createHumanCallMediaIssuer,type HumanCallRoomRevoker } from "./livekit_media.js";

/**
 * Integration seam for C01/C02/F12/R14 owners. No shared app.ts/main.ts edit.
 *
 * Do NOT register routes until canonical C01/C02 migrations, this C09 schema,
 * real provider room revocation, background signal dispatch and device tests
 * are qualified. The same user/tenant session authorizer is reused.
 */
export function composeHumanCallService(input: {
  readonly pool:HumanCallSqlPool;
  readonly sessions:PlatformCustomerSessionAuthorizer;
  readonly serverUrl:string;
  readonly apiKey:string;
  readonly apiSecret:string;
  readonly roomRevoker:HumanCallRoomRevoker;
}) {
  return createHumanCallService({
    repository:createPostgresHumanCallRepository(input.pool),
    authorizer:input.sessions,
    media:createHumanCallMediaIssuer({
      serverUrl:input.serverUrl,apiKey:input.apiKey,
      apiSecret:input.apiSecret,revoker:input.roomRevoker,
    }),
    admission:{
      async permitted({tenantId,userId,conversationId}) {
        // Read-only same C01/C02 accepted pair + R15 reciprocal protection
        // as atomic Postgres start/accept. Fail closed on missing schema/DB.
        const result=await input.pool.query(`
          SELECT 1 FROM talks.human_dm_conversations c
          JOIN talks.human_dm_contact_requests cr
            ON cr.tenant_id=c.tenant_id AND cr.first_user_id=c.first_user_id
              AND cr.second_user_id=c.second_user_id
              AND cr.status='accepted' AND cr.revoked_by IS NULL
          JOIN identity.users a ON a.tenant_id=c.tenant_id AND a.user_id=c.first_user_id
            AND a.state='active'
          JOIN identity.users b ON b.tenant_id=c.tenant_id AND b.user_id=c.second_user_id
            AND b.state='active'
          WHERE c.tenant_id=$1 AND c.conversation_id=$2
            AND $3 IN (c.first_user_id,c.second_user_id)
            AND NOT EXISTS(SELECT 1 FROM talks.safety_preferences s
              WHERE s.tenant_id=$1 AND s.blocked=true
                AND ((s.viewer_user_id=c.first_user_id AND s.subject_user_id=c.second_user_id)
                  OR (s.viewer_user_id=c.second_user_id AND s.subject_user_id=c.first_user_id)))
            AND NOT EXISTS(SELECT 1 FROM talks.safety_enforcement s
              JOIN talks.public_profiles p
                ON p.tenant_id=s.tenant_id AND p.handle=s.target_id
              WHERE s.tenant_id=$1 AND s.target_kind='profile'
                AND s.visibility IN ('blocked','restricted')
                AND p.user_id IN (c.first_user_id,c.second_user_id))
          LIMIT 1`,[tenantId,conversationId,userId]);
        return result.rows.length===1;
      },
    },
  });
}
