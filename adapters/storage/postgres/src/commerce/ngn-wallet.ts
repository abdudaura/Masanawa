import type { Pool, PoolClient } from "pg";
import type {
  NgnFundingIntent,
  NgnWalletRepository,
} from "@masanawa/commerce";
import { withTransaction } from "../transaction.js";

interface FundingRow {
  tenant_id: string;
  user_id: string;
  funding_reference: string;
  tx_ref: string;
  amount_kobo: string | number;
  quote_id: string | null;
  originating_character_id: string | null;
  state: NgnFundingIntent["state"];
  account_number: string | null;
  bank_name: string | null;
  provider_order_ref: string | null;
  provider_reference: string | null;
  provider_transaction_id: string | null;
  expires_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function integer(value: string | number, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`financial.wallet.${label}_invalid`);
  }
  return parsed;
}

function intent(row: FundingRow): NgnFundingIntent {
  return Object.freeze({
    tenantId: row.tenant_id,
    userId: row.user_id,
    fundingReference: row.funding_reference,
    txRef: row.tx_ref,
    amountKobo: integer(row.amount_kobo, "amount"),
    quoteId: row.quote_id,
    originatingCharacterId: row.originating_character_id,
    state: row.state,
    accountNumber: row.account_number,
    bankName: row.bank_name,
    providerOrderRef: row.provider_order_ref,
    providerReference: row.provider_reference,
    providerTransactionId: row.provider_transaction_id,
    expiresAt: iso(row.expires_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

async function lockWallet(
  client: PoolClient,
  tenantId: string,
  userId: string,
): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `ngn-wallet:${tenantId}:${userId}`,
  ]);
}

async function balance(
  client: PoolClient,
  tenantId: string,
  userId: string,
): Promise<number> {
  const result = await client.query<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_kobo ELSE -amount_kobo END),0)::text AS balance
       FROM commerce.ngn_wallet_entries
      WHERE tenant_id=$1 AND user_id=$2`,
    [tenantId, userId],
  );
  return integer(result.rows[0]?.balance ?? "0", "balance");
}

export function createPostgresNgnWalletRepository(pool: Pool): NgnWalletRepository {
  return Object.freeze<NgnWalletRepository>({
    async readBalance(input) {
      return withTransaction(
        pool,
        (client) => balance(client, input.tenantId, input.userId),
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async createFundingIntent(input) {
      if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo < 1) {
        throw new Error("financial.wallet.amount_invalid");
      }
      return withTransaction(pool, async (client) => {
        await lockWallet(client, input.tenantId, input.userId);
        if (input.quoteId) {
          // The owner-scoped advisory lock serializes concurrent confirmations
          // across gateway processes. A second request must reuse the exact
          // active intent instead of minting another bank account / txRef.
          const active = await client.query<FundingRow>(
            `SELECT * FROM commerce.ngn_funding_intents
              WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3
                AND state IN ('creating','awaiting') AND expires_at > statement_timestamp()
              ORDER BY created_at DESC, funding_reference DESC
              LIMIT 1 FOR UPDATE`,
            [input.tenantId,input.userId,input.quoteId],
          );
          const existing = active.rows[0];
          if (existing) {
            if (integer(existing.amount_kobo, "amount") !== input.amountKobo) {
              throw new Error("financial.wallet.funding_quote_shortfall_changed");
            }
            return intent(existing);
          }
        }
        const inserted = await client.query<FundingRow>(
          `INSERT INTO commerce.ngn_funding_intents(
             tenant_id,user_id,funding_reference,tx_ref,amount_kobo,quote_id,
             originating_character_id,state,expires_at,created_at,updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,'creating',$8,$9,$9)
           ON CONFLICT (tenant_id,user_id,funding_reference) DO NOTHING
           RETURNING *`,
          [
            input.tenantId,
            input.userId,
            input.fundingReference,
            input.txRef,
            input.amountKobo,
            input.quoteId ?? null,
            input.originatingCharacterId ?? null,
            input.expiresAt,
            input.createdAt,
          ],
        );
        if (inserted.rows[0]) return intent(inserted.rows[0]);
        const existing = await client.query<FundingRow>(
          `SELECT * FROM commerce.ngn_funding_intents
            WHERE tenant_id=$1 AND user_id=$2 AND funding_reference=$3 FOR UPDATE`,
          [input.tenantId,input.userId,input.fundingReference],
        );
        const row = existing.rows[0];
        if (
          !row ||
          row.tx_ref !== input.txRef ||
          integer(row.amount_kobo,"amount") !== input.amountKobo ||
          row.quote_id !== (input.quoteId ?? null) ||
          row.originating_character_id !== (input.originatingCharacterId ?? null)
        ) {
          throw new Error("financial.wallet.funding_replay_conflict");
        }
        return intent(row);
      });
    },

    async bindFundingAccount(input) {
      return withTransaction(pool, async (client) => {
        const current = await client.query<FundingRow>(
          `SELECT * FROM commerce.ngn_funding_intents
            WHERE tenant_id=$1 AND user_id=$2 AND funding_reference=$3 FOR UPDATE`,
          [input.tenantId,input.userId,input.fundingReference],
        );
        const row = current.rows[0];
        if (!row) throw new Error("financial.wallet.funding_not_found");
        if (row.state !== "creating") {
          if (
            row.account_number === input.accountNumber &&
            row.bank_name === input.bankName
          ) return intent(row);
          throw new Error("financial.wallet.funding_bind_conflict");
        }
        const expiry =
          Date.parse(input.providerExpiry) < Date.parse(iso(row.expires_at))
            ? input.providerExpiry
            : iso(row.expires_at);
        const updated = await client.query<FundingRow>(
          `UPDATE commerce.ngn_funding_intents
              SET state='awaiting',account_number=$4,bank_name=$5,
                  provider_order_ref=$6,provider_reference=$7,
                  expires_at=$8,updated_at=$9
            WHERE tenant_id=$1 AND user_id=$2 AND funding_reference=$3
            RETURNING *`,
          [
            input.tenantId,input.userId,input.fundingReference,
            input.accountNumber,input.bankName,input.providerOrderRef,
            input.providerReference,expiry,input.boundAt,
          ],
        );
        return intent(updated.rows[0]!);
      });
    },

    async readLatestQuoteFunding(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<FundingRow>(
          `SELECT * FROM commerce.ngn_funding_intents
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3
            ORDER BY created_at DESC, funding_reference DESC LIMIT 1`,
          [input.tenantId, input.userId, input.quoteId],
        );
        return result.rows[0] ? intent(result.rows[0]) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async readFundingIntent(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<FundingRow>(
          `SELECT * FROM commerce.ngn_funding_intents
            WHERE tenant_id=$1 AND user_id=$2 AND funding_reference=$3`,
          [input.tenantId,input.userId,input.fundingReference],
        );
        return result.rows[0] ? intent(result.rows[0]) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async readFundingIntentByTxRef(input) {
      return withTransaction(pool, async (client) => {
        const result = await client.query<FundingRow>(
          "SELECT * FROM commerce.ngn_funding_intents WHERE tx_ref=$1",
          [input.txRef],
        );
        return result.rows[0] ? intent(result.rows[0]) : null;
      }, { isolation: "repeatable read", readOnly: true });
    },

    async creditFunding(input) {
      if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo < 1) {
        throw new Error("financial.wallet.amount_invalid");
      }
      return withTransaction(pool, async (client) => {
        const result = await client.query<FundingRow>(
          "SELECT * FROM commerce.ngn_funding_intents WHERE tx_ref=$1 FOR UPDATE",
          [input.txRef],
        );
        const row = result.rows[0];
        if (!row || row.funding_reference !== input.fundingReference) {
          throw new Error("financial.wallet.funding_not_found");
        }
        await lockWallet(client,row.tenant_id,row.user_id);
        if (integer(row.amount_kobo,"amount") !== input.amountKobo) {
          throw new Error("financial.wallet.funding_amount_mismatch");
        }
        if (row.state === "credited") {
          if (row.provider_transaction_id !== input.providerTransactionId) {
            throw new Error("financial.wallet.funding_provider_replay_conflict");
          }
          return intent(row);
        }
        if (row.state !== "awaiting") {
          throw new Error("financial.wallet.funding_not_creditable");
        }
        await client.query(
          `INSERT INTO commerce.ngn_wallet_entries(
             tenant_id,user_id,entry_id,direction,amount_kobo,reason,reference,
             provider_transaction_id,created_at
           ) VALUES ($1,$2,$3,'credit',$4,'funding',$5,$6,$7)
           ON CONFLICT (tenant_id,user_id,reason,reference) DO NOTHING`,
          [
            row.tenant_id,row.user_id,`fund:${input.txRef}`,input.amountKobo,
            input.fundingReference,input.providerTransactionId,input.creditedAt,
          ],
        );
        const updated = await client.query<FundingRow>(
          `UPDATE commerce.ngn_funding_intents
              SET state='credited',provider_transaction_id=$2,
                  provider_reference=$3,updated_at=$4
            WHERE tx_ref=$1 RETURNING *`,
          [input.txRef,input.providerTransactionId,input.providerReference,input.creditedAt],
        );
        return intent(updated.rows[0]!);
      });
    },

    async reserveBill(input) {
      if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo < 1) {
        throw new Error("financial.wallet.amount_invalid");
      }
      return withTransaction(pool, async (client) => {
        await lockWallet(client,input.tenantId,input.userId);
        const existing = await client.query<{ state: string; amount_kobo: string | number }>(
          `SELECT state,amount_kobo FROM commerce.ngn_bill_reservations
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3 FOR UPDATE`,
          [input.tenantId,input.userId,input.quoteId],
        );
        if (existing.rows[0]) {
          if (integer(existing.rows[0].amount_kobo,"reservation_amount") !== input.amountKobo) {
            throw new Error("financial.wallet.bill_reserve_conflict");
          }
          return Object.freeze({
            reserved: false,
            balanceKobo: await balance(client,input.tenantId,input.userId),
          });
        }
        const available = await balance(client,input.tenantId,input.userId);
        if (available < input.amountKobo) {
          throw new Error("financial.wallet.insufficient_balance");
        }
        await client.query(
          `INSERT INTO commerce.ngn_bill_reservations(
             tenant_id,user_id,quote_id,amount_kobo,state,reserved_at
           ) VALUES ($1,$2,$3,$4,'reserved',$5)`,
          [input.tenantId,input.userId,input.quoteId,input.amountKobo,input.reservedAt],
        );
        await client.query(
          `INSERT INTO commerce.ngn_wallet_entries(
             tenant_id,user_id,entry_id,direction,amount_kobo,reason,reference,created_at
           ) VALUES ($1,$2,$3,'debit',$4,'bill-reserve',$5,$6)`,
          [
            input.tenantId,input.userId,`bill-reserve:${input.quoteId}`,
            input.amountKobo,input.quoteId,input.reservedAt,
          ],
        );
        return Object.freeze({
          reserved: true,
          balanceKobo: available - input.amountKobo,
        });
      });
    },

    async settleBill(input) {
      return withTransaction(pool, async (client) => {
        await lockWallet(client,input.tenantId,input.userId);
        const result = await client.query<{ state: "reserved" | "succeeded" | "refunded"; amount_kobo: string | number }>(
          `SELECT state,amount_kobo FROM commerce.ngn_bill_reservations
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3 FOR UPDATE`,
          [input.tenantId,input.userId,input.quoteId],
        );
        const row = result.rows[0];
        if (!row) throw new Error("financial.wallet.bill_reserve_not_found");
        if (input.state === "succeeded") {
          if (row.state === "reserved") {
            await client.query(
              `UPDATE commerce.ngn_bill_reservations
                  SET state='succeeded',settled_at=$4
                WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3`,
              [input.tenantId,input.userId,input.quoteId,input.settledAt],
            );
          }
          return Object.freeze({
            refunded: false,
            balanceKobo: await balance(client,input.tenantId,input.userId),
          });
        }
        if (row.state === "refunded") {
          return Object.freeze({
            refunded: false,
            balanceKobo: await balance(client,input.tenantId,input.userId),
          });
        }
        if (row.state === "succeeded") {
          throw new Error("financial.wallet.bill_already_succeeded");
        }
        const amountKobo = integer(row.amount_kobo,"reservation_amount");
        await client.query(
          `INSERT INTO commerce.ngn_wallet_entries(
             tenant_id,user_id,entry_id,direction,amount_kobo,reason,reference,created_at
           ) VALUES ($1,$2,$3,'credit',$4,'bill-refund',$5,$6)
           ON CONFLICT (tenant_id,user_id,reason,reference) DO NOTHING`,
          [
            input.tenantId,input.userId,`bill-refund:${input.quoteId}`,
            amountKobo,input.quoteId,input.settledAt,
          ],
        );
        await client.query(
          `UPDATE commerce.ngn_bill_reservations
              SET state='refunded',settled_at=$4
            WHERE tenant_id=$1 AND user_id=$2 AND quote_id=$3`,
          [input.tenantId,input.userId,input.quoteId,input.settledAt],
        );
        return Object.freeze({
          refunded: true,
          balanceKobo: await balance(client,input.tenantId,input.userId),
        });
      });
    },
  });
}
