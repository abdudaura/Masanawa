import type { Pool, PoolClient } from "pg";
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
  readonly clearanceReference: string;
  readonly alreadyRevoked: boolean;
}

/**
 * Mandatory transactional financial preflight. The implementation must
 * reconcile and lock every applicable spendable balance, outstanding payout,
 * charge, settlement and provider operation before returning clear=true.
 * No default or permissive implementation is provided in production.
 */
export interface AccountDeletionFinancialClearance {
  check(input: Readonly<{
    client: PoolClient;
    tenantId: string;
    userId: string;
    requestId: string;
    at: string;
  }>): Promise<Readonly<{
    clear: boolean;
    checkedAt: string;
    reference: string;
  }>>;
}

type RequestRow = {
  phase: string;
  revision: string;
  outstanding_obligations: unknown;
};
type ReceiptRow = { completed_at: Date | string; clearance_reference: string };

export function createPostgresAccountDeletionAccessRevoker(
  pool: Pool,
  financialClearance: AccountDeletionFinancialClearance,
) {
  if (!financialClearance || typeof financialClearance.check !== "function") {
    throw new Error("account_deletion.financial_clearance_required");
  }
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
          `SELECT completed_at,clearance_reference
             FROM identity.account_deletion_access_revocations
            WHERE request_id=$1::uuid AND tenant_id=$2 AND user_id=$3`,
          [input.requestId,input.tenantId,input.userId],
        );
        if (previous.rows[0]) {
          return Object.freeze({
            requestId: input.requestId,
            completedAt: new Date(previous.rows[0].completed_at).toISOString(),
            clearanceReference: previous.rows[0].clearance_reference,
            alreadyRevoked: true,
          });
        }

        if (row.phase !== "processing" ||
            Number(row.revision) !== input.expectedRevision ||
            !Array.isArray(row.outstanding_obligations) ||
            row.outstanding_obligations.length !== 0) {
          throw new Error("account_deletion.access_not_authorized");
        }

        // Guard is executed under the same DB transaction and request lock.
        // Any missing, stale or incomplete financial reconciliation fails closed
        // before identity, channel or device access is modified.
        const clearance = await financialClearance.check({
          client,
          tenantId: input.tenantId,
          userId: input.userId,
          requestId: input.requestId,
          at: input.now,
        });
        // Validate against database time, not the scheduler's earlier
        // timestamp: the reconciliation scan is written *during* this
        // transaction and may occur milliseconds after input.now.
        const current = await client.query<{ now: Date | string }>(
          "SELECT clock_timestamp() AS now",
        );
        const verifiedAt = Date.parse(clearance.checkedAt);
        const databaseNow = new Date(current.rows[0]!.now).getTime();
        if (!clearance.clear ||
            !Number.isFinite(verifiedAt) ||
            verifiedAt > databaseNow ||
            verifiedAt < databaseNow - 5 * 60_000 ||
            !/^[A-Za-z0-9:_-]{8,160}$/u.test(clearance.reference)) {
          throw new Error("account_deletion.financial_clearance_required");
        }

        const scope = [input.tenantId,input.userId];
        const scopeAtTime = [input.tenantId,input.userId,input.now];
        const receiptValues = [
          input.tenantId,input.userId,input.requestId,input.now,
          clearance.reference,clearance.checkedAt,
        ];

        // Disabling canonical identity is the authorization barrier for normal
        // access-token resolution and refresh rotation. It must commit with
        // actual token and channel revocation, never independently.
        await client.query(
          `UPDATE identity.users
              SET state='disabled',revision=revision+1,updated_at=GREATEST(updated_at,$3::timestamptz)
            WHERE tenant_id=$1 AND user_id=$2 AND state='active'`,
          scopeAtTime,
        );
        await client.query(
          `UPDATE security.platform_sessions
              SET revoked_at=COALESCE(revoked_at,$3::timestamptz),
                  updated_at=GREATEST(updated_at,$3::timestamptz)
            WHERE tenant_id=$1 AND user_id=$2 AND revoked_at IS NULL`,
          scopeAtTime,
        );
        // Unlink WhatsApp/Telegram to stop private channel routing. Historical
        // message retention requires separate policy-reviewed erasure.
        await client.query(
          `DELETE FROM security.customer_channel_links
            WHERE tenant_id=$1 AND user_id=$2`,
          scope,
        );
        await client.query(
          `DELETE FROM agents.mobile_push_registrations
            WHERE tenant_id=$1 AND user_id=$2`,
          scope,
        );
        await client.query(
          `DELETE FROM agents.mobile_presence
            WHERE tenant_id=$1 AND user_id=$2`,
          scope,
        );

        // Hide and disable owned Twins before any later data-erasure step.
        // The profile trigger requires a revision bump and strictly newer time.
        await client.query(
          `UPDATE identity.twin_profiles AS profile
              SET discoverable=false,revision=revision+1,
                  updated_at=GREATEST(profile.updated_at + interval '1 microsecond',
                                      $3::timestamptz)
            WHERE tenant_id=$1 AND owner_user_id=$2 AND discoverable=true`,
          scopeAtTime,
        );
        await client.query(
          `UPDATE identity.characters AS ch
              SET state='disabled',revision=ch.revision+1,
                  updated_at=GREATEST(ch.updated_at,$3::timestamptz)
             FROM identity.character_ownership AS ownership
            WHERE ch.tenant_id=$1
              AND ownership.tenant_id=ch.tenant_id
              AND ownership.character_id=ch.character_id
              AND ownership.owner_user_id=$2
              AND ownership.kind='personal-clone'
              AND ch.state='active'`,
          scopeAtTime,
        );
        await client.query(
          `DELETE FROM identity.account_deletion_challenges
            WHERE tenant_id=$1 AND user_id=$2`,
          scope,
        );

        // This receipt is a checkpoint for a *single revocation step*, not
        // a statement that financial, processor or private-data cleanup ended.
        await client.query(
          `INSERT INTO identity.account_deletion_access_revocations
             (request_id,tenant_id,user_id,completed_at,clearance_reference,clearance_checked_at)
           VALUES ($3::uuid,$1,$2,$4,$5,$6)`,
          receiptValues,
        );
        return Object.freeze({
          requestId: input.requestId,
          completedAt: new Date(input.now).toISOString(),
          clearanceReference: clearance.reference,
          alreadyRevoked: false,
        });
      });
    },
  });
}

