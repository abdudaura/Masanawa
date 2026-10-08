import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { AccountDeletionFinancialClearance } from "./account-deletion-access.js";
import { withTransaction } from "../transaction.js";

/**
 * This registry is intentionally pessimistic: ANY money-related footprint
 * requires individual reconciliation before account access may be revoked.
 * A finished payment is still history, not evidence of a zero-liability account.
 * Missing tables, new unlisted domains and query failures MUST NOT clear.
 */
const exposureQueries = [
  ["ngn-wallet", "commerce.ngn_wallet_entries", "user_id"],
  ["ngn-funding", "commerce.ngn_funding_intents", "user_id"],
  ["ngn-bill-reservation", "commerce.ngn_bill_reservations", "user_id"],
  ["billing-quote", "commerce.billing_quotes", "user_id"],
  ["billing-fulfillment", "commerce.billing_fulfillments", "user_id"],
  ["crypto-intent", "commerce.crypto_intents", "user_id"],
  ["crypto-ledger", "commerce.crypto_ledger_entries", "user_id"],
  ["crypto-chat-action", "commerce.crypto_chat_actions", "user_id"],
  ["twin-credit-transfer", "commerce.twin_credit_operations", "sender_user_id"],
  ["twin-credit-receipt", "commerce.twin_credit_operations", "recipient_user_id"],
  ["twin-attribution-owner", "commerce.twin_attributions", "owner_user_id"],
  ["twin-attribution-customer", "commerce.twin_attributions", "customer_user_id"],
  ["twin-commission", "commerce.twin_commission_settlements", "owner_user_id"],
  ["twin-voice-user", "commerce.twin_voice_admissions", "user_id"],
  ["twin-voice-owner", "commerce.twin_voice_admissions", "owner_user_id"],
  ["owner-access-requester", "commerce.owner_access_requests", "requester_user_id"],
  ["owner-access-owner", "commerce.owner_access_requests", "owner_user_id"],
  ["trial-consumption", "commerce.paid_feature_trial_consumptions", "user_id"],
] as const;

const exceptionalQueries = [
  ["credit-debit", `SELECT 1 FROM commerce.ledger_entries WHERE tenant_id=$1 AND debit_user_id=$2 LIMIT 1`],
  ["credit-receipt", `SELECT 1 FROM commerce.ledger_entries WHERE tenant_id=$1 AND credit_user_id=$2 LIMIT 1`],
  ["owned-twin-ledger", `SELECT 1
     FROM commerce.ledger_entries l
     JOIN identity.character_ownership o
       ON o.tenant_id=l.tenant_id
      AND (o.character_id=l.debit_character_id
           OR o.character_id=l.credit_character_id)
    WHERE l.tenant_id=$1 AND o.owner_user_id=$2
    LIMIT 1`],
  ["talk-ai-seat", `SELECT 1 FROM commerce.talk_ai_seat_quotes
    WHERE tenant_id=$1 AND (definition->>'payerUserId'=$2 OR definition->>'userId'=$2) LIMIT 1`],
  ["historic-quote", `SELECT 1 FROM commerce.quotes
    WHERE tenant_id=$1 AND (definition->>'userId'=$2 OR definition->>'payerUserId'=$2) LIMIT 1`],
  ["owner-access-quote", `SELECT 1 FROM commerce.owner_access_quotes
    WHERE tenant_id=$1 AND (requester_user_id=$2 OR owner_user_id=$2) LIMIT 1`],
  ["twin-voice-quote", `SELECT 1 FROM commerce.twin_voice_quotes
    WHERE tenant_id=$1 AND (user_id=$2 OR owner_user_id=$2) LIMIT 1`],
] as const;

export interface AccountDeletionFinancialScreen {
  readonly scanId: string;
  readonly checkedAt: string;
  readonly findingCodes: readonly string[];
  readonly admissionFenced: boolean;
  readonly clear: boolean;
}

export interface FinancialAdmissionFence {
  /**
   * Valid only when ALL financial entry paths (including asynchronous provider
   * webhook and settlement replay) are prevented from writing for this user
   * once deletion processing begins, under a lock respected by writers.
   * Returning true without enforcing that invariant is unsafe.
   */
  assertLocked(input: Readonly<{
    client: PoolClient; tenantId: string; userId: string; requestId: string;
  }>): Promise<boolean>;
}

export function createPostgresDeletionFinancialPreflight(
  pool: Pool,
  admissionFence?: FinancialAdmissionFence,
) {
  async function scanInTransaction(input: Readonly<{
    client: PoolClient; tenantId: string; userId: string; requestId: string;
    now: string;
  }>): Promise<AccountDeletionFinancialScreen> {
    if (!Number.isFinite(Date.parse(input.now))) {
      throw new Error("account_deletion.financial_invalid_time");
    }
    const { client,tenantId,userId,requestId } = input;
    // Shared lock order with deletion access revocation: request then user.
    // We do not trust a balance cache or a single provider status.
    const request = await client.query(
      `SELECT request_id FROM identity.account_deletion_requests
       WHERE request_id=$1::uuid AND tenant_id=$2 AND user_id=$3 FOR UPDATE`,
      [requestId,tenantId,userId],
    );
    if (request.rowCount !== 1) throw new Error("account_deletion.not_found");
    const user = await client.query<{ state: string }>(
      `SELECT state FROM identity.users WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`,
      [tenantId,userId],
    );
    if (!user.rows[0]) throw new Error("account_deletion.user_not_found");

    const findings: string[] = [];
    for (const [code,table,column] of exposureQueries) {
      const evidence = await client.query(
        `SELECT 1 FROM ${table} WHERE tenant_id=$1 AND ${column}=$2 LIMIT 1`,
        [tenantId,userId],
      );
      if (evidence.rowCount) findings.push(code);
    }
    for (const [code,sql] of exceptionalQueries) {
      const evidence = await client.query(sql,[tenantId,userId]);
      if (evidence.rowCount) findings.push(code);
    }

    // No admission fence is wired by default. A mere absence of visible
    // history cannot prove that in-flight finance/provider work is stopped.
    const fenced = findings.length === 0 &&
      admissionFence !== undefined &&
      await admissionFence.assertLocked({client,tenantId,userId,requestId}) === true;
    const checked = await client.query<{ now: Date | string }>(
      "SELECT clock_timestamp() AS now",
    );
    const checkedAt = new Date(checked.rows[0]!.now).toISOString();
    const scanId = randomUUID();
    await client.query(
      `INSERT INTO identity.account_deletion_financial_scans
         (scan_id,request_id,checked_at,finding_codes,admission_fenced,cleared)
       VALUES ($1::uuid,$2::uuid,$3,$4::jsonb,$5,$6)`,
      [scanId,requestId,checkedAt,JSON.stringify(findings),fenced,fenced],
    );
    return Object.freeze({
      scanId,checkedAt,findingCodes:Object.freeze(findings),
      admissionFenced:fenced,clear:fenced,
    });
  }
  return Object.freeze({
    scan(input: Readonly<{tenantId:string;userId:string;requestId:string;now:string}>) {
      return withTransaction(pool, client=>scanInTransaction({...input,client}));
    },
    scanInTransaction,
    financialClearance: Object.freeze<AccountDeletionFinancialClearance>({
      async check(input) {
        const scan = await scanInTransaction({...input,now:input.at});
        return Object.freeze({
          clear: scan.clear,
          checkedAt: scan.checkedAt,
          reference: "scan_"+scan.scanId,
        });
      },
    }),
  });
}
