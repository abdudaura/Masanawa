import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";

/**
 * Trusted identity-privacy integration step only, never a public endpoint.
 * This revokes product access after a financial/retention-aware worker has
 * authorized processing. It does NOT erase personal or financial data and
 * does NOT mark the deletion request completed.
 */
export interface AccountDeletionAccessRevocationInput {
  readonly tenantId: string;
  readonly userId: string;
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly now: string;
}

export interface AccountDeletionAccessRevocationReceipt {
  readonly requestId: string;
  readonly completedAt: string;
  readonly alreadyRevoked: boolean;
}

type RequestRow = {
  phase: string;
  revision: string;
  outstanding_obligations: unknown;
};
type ReceiptRow = { completed_at: Date | string };

export function createPostgresAccountDeletionAccessRevoker(pool: Pool) {
  return Object.freeze({
    async revoke(input: AccountDeletionAccessRevocationInput): Promise<AccountDeletionAccessRevocationReceipt> {
      if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 ||
          !Number.isFinite(Date.parse(input.now))) {
        throw new Error("account_deletion.access_invalid_input");
      }
      return withTransaction(pool, async (client) => {
        // Fixed lock order with deletion request transitions/OTP verification.
        // Prevents revocation before the immutable request has been admitted.
        const selected = await client.query<RequestRow>(
          `SELECT phase,revision::text,outstanding_obligations
             FROM identity.account_deletion_requests
            WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3::uuid
            FOR UPDATE`,
          [input.tenantId,input.userId,input.requestId],
        );
        const row = selected.rows[0];
        if (!row) throw new Error("account_deletion.not_found");

        const previous = await client.query<ReceiptRow>(
          `SELECT completed_at
             FROM identity.account_deletion_access_revocations
            WHERE request_id=$1::uuid AND tenant_id=$2 AND user_id=$3`,
          [input.requestId,input.tenantId,input.userId],
        );
        if (previous.rows[0]) {
          return Object.freeze({
            requestId: input.requestId,
            completedAt: new Date(previous.rows[0].completed_at).toISOString(),
            alreadyRevoked: true,
          });
        }

        if (row.phase !== "processing" ||
            Number(row.revision) !== input.expectedRevision ||
            !Array.isArray(row.outstanding_obligations) ||
            row.outstanding_obligations.length !== 0) {
          throw new Error("account_deletion.access_not_authorized");
        }

        const keys = [input.tenantId,input.userId,input.requestId,input.now];

        // Disabling canonical identity is the authorization barrier for normal
        // access-token resolution and refresh rotation. It must commit with
        // actual token and channel revocation, never independently.
        await client.query(
          `UPDATE identity.users
              SET state='disabled',revision=revision+1,updated_at=GREATEST(updated_at,$4::timestamptz)
            WHERE tenant_id=$1 AND user_id=$2 AND state='active'`,
          keys,
        );
        await client.query(
          `UPDATE security.platform_sessions
              SET revoked_at=COALESCE(revoked_at,$4::timestamptz),
                  updated_at=GREATEST(updated_at,$4::timestamptz)
            WHERE tenant_id=$1 AND user_id=$2 AND revoked_at IS NULL`,
          keys,
        );
        // Unlink WhatsApp/Telegram to stop private channel routing. Historical
        // message retention requires separate policy-reviewed erasure.
        await client.query(
          `DELETE FROM security.customer_channel_links
            WHERE tenant_id=$1 AND user_id=$2`,
          keys,
        );
        await client.query(
          `DELETE FROM agents.mobile_push_registrations
            WHERE tenant_id=$1 AND user_id=$2`,
          keys,
        );
        await client.query(
          `DELETE FROM agents.mobile_presence
            WHERE tenant_id=$1 AND user_id=$2`,
          keys,
        );

        // Hide and disable owned Twins before any later data-erasure step.
        // The profile trigger requires a revision bump and strictly newer time.
        await client.query(
          `UPDATE identity.twin_profiles AS profile
              SET discoverable=false,revision=revision+1,
                  updated_at=GREATEST(profile.updated_at + interval '1 microsecond',
                                      $4::timestamptz)
            WHERE tenant_id=$1 AND owner_user_id=$2 AND discoverable=true`,
          keys,
        );
        await client.query(
          `UPDATE identity.characters AS character
              SET state='disabled',revision=character.revision+1,
                  updated_at=GREATEST(character.updated_at,$4::timestamptz)
             FROM identity.character_ownership AS ownership
            WHERE character.tenant_id=$1
              AND ownership.tenant_id=character.tenant_id
              AND ownership.character_id=character.character_id
              AND ownership.owner_user_id=$2
              AND ownership.kind='personal-clone'
              AND character.state='active'`,
          keys,
        );
        await client.query(
          `DELETE FROM identity.account_deletion_challenges
            WHERE tenant_id=$1 AND user_id=$2`,
          keys,
        );

        // This receipt is a checkpoint for a *single revocation step*, not
        // a statement that financial, processor or private-data cleanup ended.
        await client.query(
          `INSERT INTO identity.account_deletion_access_revocations
             (request_id,tenant_id,user_id,completed_at)
           VALUES ($3::uuid,$1,$2,$4)`,
          keys,
        );
        return Object.freeze({
          requestId: input.requestId,
          completedAt: new Date(input.now).toISOString(),
          alreadyRevoked: false,
        });
      });
    },
  });
}
