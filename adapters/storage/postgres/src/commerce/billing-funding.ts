import type { Pool, PoolClient } from "pg";
import { parseCanonicalId } from "@masanawa/contracts";
import {
  parseNgnKobo,
  type BillingQuote,
  type BillingQuoteRepository,
  type BillingQuoteState,
} from "@masanawa/commerce";
import { withTransaction } from "../transaction.js";

interface BillingQuoteRow {
  tenant_id: string;
  user_id: string;
  quote_id: string;
  revision: string | number;
  state: BillingQuoteState;
  category_code: string | null;
  biller_code: string;
  item_code: string;
  item_name: string;
  customer_id: string;
  service_amount_kobo: string | number;
  fee_amount_kobo: string | number;
  total_amount_kobo: string | number;
  currency: "NGN";
  confirmed_at: Date | string | null;
  expires_at: Date | string;
  checkout_tx_ref: string | null;
  checkout_url: string | null;
  provider_transaction_id: string | null;
  provider_reference: string | null;
  bill_provider_reference: string | null;
  payment_verified_at: Date | string | null;
  fulfillment_reference: string | null;
  settlement_state: "succeeded" | "failed" | "reversed" | null;
  refund_reference: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function integer(value: string | number, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`financial.billing.${label}_invalid`);
  return parsed;
}

function quote(row: BillingQuoteRow): BillingQuote {
  return Object.freeze({
    schemaVersion: 1 as const,
    tenantId: parseCanonicalId("tenant", row.tenant_id),
    userId: parseCanonicalId("user", row.user_id),
    quoteId: parseCanonicalId("quote", row.quote_id),
    revision: integer(row.revision, "revision"),
    categoryCode: row.category_code,
    billerCode: row.biller_code,
    itemCode: row.item_code,
    itemName: row.item_name,
    customerId: row.customer_id,
    serviceAmountKobo: integer(row.service_amount_kobo, "service_amount"),
    feeAmountKobo: integer(row.fee_amount_kobo, "fee_amount"),
    totalAmountKobo: integer(row.total_amount_kobo, "total_amount"),
    currency: "NGN" as const,
    state: row.state,
    confirmedAt: iso(row.confirmed_at),
    expiresAt: iso(row.expires_at)!,
    checkoutTxRef: row.checkout_tx_ref,
    checkoutUrl: row.checkout_url,
    providerTransactionId: row.provider_transaction_id,
    providerReference: row.provider_reference,
    billProviderReference: row.bill_provider_reference,
    paymentVerifiedAt: iso(row.payment_verified_at),
    fulfillmentReference: row.fulfillment_reference,
    settlementState: row.settlement_state,
    refundReference: row.refund_reference,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  });
}

async function locked(
  client: PoolClient,
  input: Readonly<{ tenantId: string; userId: string; quoteId: string }>,
): Promise<BillingQuoteRow> {
  const result = await client.query<BillingQuoteRow>(
    `SELECT * FROM commerce.billing_quotes
      WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3 FOR UPDATE`,
    [input.tenantId, input.userId, input.quoteId],
  );
  if (!result.rows[0]) throw new Error("financial.billing.quote_not_found");
  return result.rows[0];
}

function assertRevision(row: BillingQuoteRow, revision: number): void {
  if (!Number.isSafeInteger(revision) || integer(row.revision, "revision") !== revision) {
    throw new Error("financial.billing.quote_revision_conflict");
  }
}

function assertNotExpired(row: BillingQuoteRow, at: string): void {
  if (Date.parse(iso(row.expires_at)!) <= Date.parse(at)) {
    throw new Error("financial.billing.quote_expired");
  }
}

export function createPostgresBillingQuoteRepository(pool: Pool): BillingQuoteRepository {
  return Object.freeze<BillingQuoteRepository>({
    async createQuote(input) {
      return withTransaction(pool, async (client) => {
        const inserted = await client.query<BillingQuoteRow>(
          `INSERT INTO commerce.billing_quotes(
             tenant_id,user_id,quote_id,revision,state,category_code,biller_code,item_code,
             item_name,customer_id,service_amount_kobo,fee_amount_kobo,total_amount_kobo,
             currency,confirmed_at,expires_at,checkout_tx_ref,checkout_url,
             provider_transaction_id,provider_reference,bill_provider_reference,payment_verified_at,
             fulfillment_reference,settlement_state,refund_reference,created_at,updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                     $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
           ON CONFLICT (tenant_id,user_id,quote_id) DO NOTHING
           RETURNING *`,
          [
            input.tenantId,input.userId,input.quoteId,input.revision,input.state,input.categoryCode,
            input.billerCode,input.itemCode,input.itemName,input.customerId,input.serviceAmountKobo,
            input.feeAmountKobo,input.totalAmountKobo,input.currency,input.confirmedAt,input.expiresAt,
            input.checkoutTxRef,input.checkoutUrl,input.providerTransactionId,input.providerReference,
            input.billProviderReference,input.paymentVerifiedAt,input.fulfillmentReference,input.settlementState,
            input.refundReference,input.createdAt,input.updatedAt,
          ],
        );
        if (inserted.rows[0]) return quote(inserted.rows[0]);
        const existing = quote(await locked(client, input));
        const same =
          existing.revision === input.revision &&
          existing.categoryCode === input.categoryCode &&
          existing.billerCode === input.billerCode &&
          existing.itemCode === input.itemCode &&
          existing.itemName === input.itemName &&
          existing.customerId === input.customerId &&
          existing.serviceAmountKobo === input.serviceAmountKobo &&
          existing.feeAmountKobo === input.feeAmountKobo &&
          existing.totalAmountKobo === input.totalAmountKobo &&
          existing.expiresAt === input.expiresAt;
        if (!same) throw new Error("financial.billing.quote_replay_conflict");
        return existing;
      });
    },

    async readQuote(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<BillingQuoteRow>(
          `SELECT * FROM commerce.billing_quotes
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3`,
          [input.tenantId,input.userId,input.quoteId],
        );
        return result.rows[0] ? quote(result.rows[0]) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async readByFulfillmentReference(input) {
      const reference = input.fulfillmentReference.trim();
      if (!reference || reference.length > 128) {
        throw new TypeError("financial.billing.fulfillment_reference_invalid");
      }
      return withTransaction(pool, async (client) => {
        const result = await client.query<BillingQuoteRow>(
          `SELECT * FROM commerce.billing_quotes
            WHERE fulfillment_reference=$1`,
          [reference],
        );
        return result.rows[0] ? quote(result.rows[0]) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async listQuotes(input) {
      if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) {
        throw new TypeError("financial.billing.history_limit_invalid");
      }
      return withTransaction(pool, async (client) => {
        const result = await client.query<BillingQuoteRow>(
          `SELECT * FROM commerce.billing_quotes
            WHERE tenant_id=$1 AND user_id=$2
            ORDER BY created_at DESC,quote_id DESC LIMIT $3`,
          [input.tenantId,input.userId,input.limit],
        );
        return Object.freeze(result.rows.map(quote));
      }, { isolation: "repeatable read", readOnly: true });
    },

    async confirmQuote(input) {
      return withTransaction(pool, async (client) => {
        const row = await locked(client, input);
        assertRevision(row, input.quoteRevision);
        assertNotExpired(row, input.confirmedAt);
        if (!["quoted","confirmed","checkout-created","funded","reserved"].includes(row.state)) {
          throw new Error("financial.billing.quote_not_confirmable");
        }
        if (row.confirmed_at) return quote(row);
        const result = await client.query<BillingQuoteRow>(
          `UPDATE commerce.billing_quotes
              SET confirmed_at=$4,state='confirmed',updated_at=$4
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3 RETURNING *`,
          [input.tenantId,input.userId,input.quoteId,input.confirmedAt],
        );
        return quote(result.rows[0]!);
      });
    },

    async bindCheckout(input) {
      return withTransaction(pool, async (client) => {
        const row = await locked(client, input);
        assertRevision(row, input.quoteRevision);
        assertNotExpired(row, input.boundAt);
        if (!row.confirmed_at) throw new Error("financial.billing.quote_not_confirmed");
        if (row.checkout_tx_ref) {
          if (row.checkout_tx_ref !== input.txRef || row.checkout_url !== input.checkoutUrl) {
            throw new Error("financial.billing.checkout_replay_conflict");
          }
          return quote(row);
        }
        if (row.state !== "confirmed") throw new Error("financial.billing.checkout_not_allowed");
        const result = await client.query<BillingQuoteRow>(
          `UPDATE commerce.billing_quotes
              SET checkout_tx_ref=$4,checkout_url=$5,state='checkout-created',updated_at=$6
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3 RETURNING *`,
          [input.tenantId,input.userId,input.quoteId,input.txRef,input.checkoutUrl,input.boundAt],
        );
        return quote(result.rows[0]!);
      });
    },

    async recordVerifiedPayment(input) {
      return withTransaction(pool, async (client) => {
        const row = await locked(client, input);
        assertRevision(row, input.quoteRevision);
        if (row.checkout_tx_ref !== input.txRef) throw new Error("financial.billing.payment_reference_mismatch");
        if (input.currency !== "NGN" || input.amountKobo !== integer(row.total_amount_kobo, "total_amount")) {
          throw new Error("financial.billing.payment_amount_mismatch");
        }
        if (row.provider_transaction_id) {
          if (row.provider_transaction_id !== input.providerTransactionId ||
              row.provider_reference !== input.providerReference) {
            throw new Error("financial.billing.payment_replay_conflict");
          }
          return quote(row);
        }
        if (row.state !== "checkout-created") throw new Error("financial.billing.payment_not_admissible");
        try {
          const result = await client.query<BillingQuoteRow>(
            `UPDATE commerce.billing_quotes
                SET provider_transaction_id=$4,provider_reference=$5,payment_verified_at=$6,
                    state='funded',updated_at=$6
              WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3 RETURNING *`,
            [input.tenantId,input.userId,input.quoteId,input.providerTransactionId,
             input.providerReference,input.verifiedAt],
          );
          return quote(result.rows[0]!);
        } catch (error) {
          if ((error as { code?: string }).code === "23505") {
            throw new Error("financial.billing.payment_evidence_already_used");
          }
          throw error;
        }
      });
    },

    async requestFundedRefund(input) {
      return withTransaction(pool, async (client) => {
        const row = await locked(client,input);
        assertRevision(row,input.quoteRevision);
        if (
          row.state === "refund-pending" ||
          row.state === "refund-dispatching" ||
          row.state === "refund-submitted" ||
          row.state === "refunded"
        ) {
          return quote(row);
        }
        if (row.state !== "funded" || row.fulfillment_reference !== null) {
          throw new Error("financial.billing.funded_refund_not_allowed");
        }
        const result = await client.query<BillingQuoteRow>(
          `UPDATE commerce.billing_quotes
              SET state='refund-pending',settlement_state='failed',updated_at=$4
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3 RETURNING *`,
          [input.tenantId,input.userId,input.quoteId,input.requestedAt],
        );
        return quote(result.rows[0]!);
      });
    },

    async reserveConfirmedBill(input) {
      const tenantId = parseCanonicalId("tenant", input.tenantId);
      const userId = parseCanonicalId("user", input.userId);
      const quoteId = parseCanonicalId("quote", input.quoteId);
      const amountKobo = parseNgnKobo(input.amount);
      await withTransaction(pool, async (client) => {
        const row = await locked(client, { tenantId,userId,quoteId });
        assertRevision(row, input.quoteRevision);
        assertNotExpired(row, new Date().toISOString());
        if (!row.confirmed_at || !row.payment_verified_at || !row.provider_transaction_id) {
          throw new Error("financial.billing.funds_unverified");
        }
        if (row.biller_code !== input.billerCode || row.item_code !== input.itemCode ||
            row.customer_id !== input.customerId ||
            amountKobo !== integer(row.service_amount_kobo, "service_amount") ||
            input.currency !== "NGN") {
          throw new Error("financial.billing.quote_terms_mismatch");
        }
        if (row.fulfillment_reference) {
          if (row.fulfillment_reference !== input.fulfillmentReference) {
            throw new Error("financial.billing.reserve_replay_conflict");
          }
          if (!["reserved","succeeded","refund-pending","refunded"].includes(row.state)) {
            throw new Error("financial.billing.reserve_state_invalid");
          }
          return;
        }
        if (row.state !== "funded") throw new Error("financial.billing.funds_not_available");
        await client.query(
          `UPDATE commerce.billing_quotes
              SET fulfillment_reference=$4,state='reserved',updated_at=clock_timestamp()
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3`,
          [tenantId,userId,quoteId,input.fulfillmentReference],
        );
      });
    },

    async settleBill(input) {
      await withTransaction(pool, async (client) => {
        const result = await client.query<BillingQuoteRow>(
          `SELECT * FROM commerce.billing_quotes
            WHERE tenant_id=$1 AND user_id=$2 AND fulfillment_reference=$3 FOR UPDATE`,
          [input.tenantId,input.userId,input.fulfillmentReference],
        );
        const row = result.rows[0];
        if (!row) throw new Error("financial.billing.reserve_not_found");
        if (row.settlement_state === input.state &&
            (row.bill_provider_reference ?? null) === input.providerReference) return;
        if (row.state === "refunded" || row.state === "refund-submitted" || row.state === "refund-dispatching") return;
        if (row.state === "succeeded" && input.state !== "reversed") {
          throw new Error("financial.billing.settlement_conflict");
        }
        const nextState: BillingQuoteState =
          input.state === "succeeded" ? "succeeded" : "refund-pending";
        await client.query(
          `UPDATE commerce.billing_quotes
              SET state=$4,settlement_state=$5,
                  bill_provider_reference=COALESCE($6,bill_provider_reference),
                  updated_at=clock_timestamp()
            WHERE tenant_id=$1 AND user_id=$2 AND fulfillment_reference=$3`,
          [input.tenantId,input.userId,input.fulfillmentReference,nextState,input.state,input.providerReference],
        );
      });
    },

    async claimRefundDispatch(input) {
      return withTransaction(pool, async (client) => {
        const row = await locked(client, input);
        if (row.provider_transaction_id !== input.providerTransactionId) {
          throw new Error("financial.billing.refund_transaction_mismatch");
        }
        if (row.state === "refund-dispatching" || row.state === "refund-submitted" || row.state === "refunded") {
          return quote(row);
        }
        if (row.state !== "refund-pending") {
          throw new Error("financial.billing.refund_not_allowed");
        }
        const result = await client.query<BillingQuoteRow>(
          `UPDATE commerce.billing_quotes
              SET state='refund-dispatching',updated_at=$4
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3 RETURNING *`,
          [input.tenantId,input.userId,input.quoteId,input.claimedAt],
        );
        return quote(result.rows[0]!);
      });
    },

    async recordRefundInitiated(input) {
      return withTransaction(pool, async (client) => {
        const row = await locked(client, input);
        if (row.provider_transaction_id !== input.providerTransactionId) {
          throw new Error("financial.billing.refund_transaction_mismatch");
        }
        if (row.state === "refund-submitted" || row.state === "refunded") {
          if (row.refund_reference !== input.refundReference) {
            throw new Error("financial.billing.refund_replay_conflict");
          }
          return quote(row);
        }
        if (row.state !== "refund-dispatching") throw new Error("financial.billing.refund_not_dispatching");
        const result = await client.query<BillingQuoteRow>(
          `UPDATE commerce.billing_quotes
              SET state='refund-submitted',refund_reference=$4,updated_at=$5
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3 RETURNING *`,
          [input.tenantId,input.userId,input.quoteId,input.refundReference,input.initiatedAt],
        );
        return quote(result.rows[0]!);
      });
    },

    async markRefunded(input) {
      return withTransaction(pool, async (client) => {
        const row = await locked(client, input);
        if (row.provider_transaction_id !== input.providerTransactionId) {
          throw new Error("financial.billing.refund_transaction_mismatch");
        }
        if (row.state === "refunded") {
          if (row.refund_reference !== input.refundReference) {
            throw new Error("financial.billing.refund_replay_conflict");
          }
          return quote(row);
        }
        if (row.state !== "refund-submitted") throw new Error("financial.billing.refund_not_complete");
        const result = await client.query<BillingQuoteRow>(
          `UPDATE commerce.billing_quotes
              SET state='refunded',refund_reference=$4,updated_at=$5
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3 RETURNING *`,
          [input.tenantId,input.userId,input.quoteId,input.refundReference,input.refundedAt],
        );
        return quote(result.rows[0]!);
      });
    },
  });
}
