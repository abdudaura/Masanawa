import { createCanonicalId } from "@masanawa/contracts";
import { normalizeCryptoAmount, normalizeCryptoAsset, normalizeCryptoNetwork } from "@masanawa/commerce";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

export interface InternalTransferQuote {
  readonly quoteId: string;
  readonly quoteRequestId: string;
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
  readonly fee: "0";
  readonly policyRevision: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}
export interface InternalTransferReceipt {
  readonly transferId: string;
  readonly quoteId: string;
  readonly requestId: string;
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
  readonly fee: "0";
  readonly completedAt: string;
  readonly status: "completed";
  readonly kind: "internal-book-transfer";
}
export interface InternalCryptoTransferStore {
  quote(input: {
    tenantId: string; senderUserId: string; recipientUserId: string;
    quoteRequestId: string; asset: string; network: string | null;
    amount: string; policyRevision: string;
  }): Promise<InternalTransferQuote>;
  readQuote(input: { tenantId: string; senderUserId: string; quoteId: string }): Promise<InternalTransferQuote | null>;
  execute(input: {
    tenantId: string; senderUserId: string; requestId: string;
    quoteId: string; policyRevision: string;
  }): Promise<InternalTransferReceipt>;
  readByRequest(input: { tenantId: string; senderUserId: string; requestId: string }): Promise<InternalTransferReceipt | null>;
  read(input: { tenantId: string; userId: string; transferId: string }): Promise<InternalTransferReceipt | null>;
  history(input: { tenantId: string; userId: string; limit: number }): Promise<readonly InternalTransferReceipt[]>;
}
function nonempty(value: string, name: string, max = 128): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > max)
    throw new TypeError("crypto.internal." + name + ".invalid");
  return value.trim();
}
function quoteRow(row: Record<string, unknown>): InternalTransferQuote {
  return {
    quoteId: String(row.quote_id), quoteRequestId: String(row.quote_request_id),
    senderUserId: String(row.sender_user_id), recipientUserId: String(row.recipient_user_id),
    asset: String(row.asset), network: row.network === null ? null : String(row.network),
    amount: String(row.amount), fee: "0", policyRevision: String(row.policy_revision),
    createdAt: new Date(String(row.created_at)).toISOString(),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
  };
}
function receiptRow(row: Record<string, unknown>): InternalTransferReceipt {
  return {
    transferId: String(row.transfer_id), quoteId: String(row.quote_id),
    requestId: String(row.request_id), senderUserId: String(row.sender_user_id),
    recipientUserId: String(row.recipient_user_id), asset: String(row.asset),
    network: row.network === null ? null : String(row.network),
    amount: String(row.amount), fee: "0",
    completedAt: new Date(String(row.completed_at)).toISOString(),
    status: "completed", kind: "internal-book-transfer",
  };
}
async function lockCustodyBalance(client: PoolClient, input: {
  tenantId: string; userId: string; asset: string; network: string | null;
}): Promise<void> {
  // Exact key used by withdrawal/conversion reserve in crypto-repository.ts.
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    "crypto:balance:" + input.tenantId + ":" + input.userId + ":" +
    input.asset + ":" + (input.network ?? "-"),
  ]);
}
async function assertActiveParties(
  client: PoolClient, tenantId: string, senderUserId: string, recipientUserId: string,
): Promise<void> {
  // Lock current canonical identities alongside each financial quote/transfer.
  // Deactivation or tenant shutdown cannot race a committed transfer.
  const tenant = await client.query(
    "SELECT tenant_id FROM identity.tenants WHERE tenant_id=$1 AND state='active' FOR SHARE",
    [tenantId],
  );
  if (tenant.rowCount !== 1) throw new Error("crypto.internal.account_inactive");
  const users = await client.query<{ user_id: string }>(
    "SELECT user_id FROM identity.users " +
    "WHERE tenant_id=$1 AND user_id=ANY($2::text[]) AND state='active' " +
    "ORDER BY user_id FOR SHARE",
    [tenantId, [senderUserId, recipientUserId]],
  );
  if (new Set(users.rows.map(row => row.user_id)).size !== 2)
    throw new Error("crypto.internal.account_inactive");
}

export function createPostgresInternalCryptoTransferStore(pool: Pool): InternalCryptoTransferStore {
  return Object.freeze<InternalCryptoTransferStore>({
    async quote(raw) {
      const input = {
        tenantId: nonempty(raw.tenantId, "tenant"),
        senderUserId: nonempty(raw.senderUserId, "sender"),
        recipientUserId: nonempty(raw.recipientUserId, "recipient"),
        quoteRequestId: nonempty(raw.quoteRequestId, "quote_request"),
        asset: normalizeCryptoAsset(raw.asset),
        network: normalizeCryptoNetwork(raw.network),
        amount: normalizeCryptoAmount(raw.amount),
        policyRevision: nonempty(raw.policyRevision, "policy"),
      };
      if (input.senderUserId === input.recipientUserId)
        throw new Error("crypto.internal.self_transfer");
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          "crypto:internal:quote:" + input.tenantId + ":" +
            input.senderUserId + ":" + input.quoteRequestId,
        ]);
        const previous = await client.query(
          "SELECT * FROM commerce.crypto_internal_transfer_quotes WHERE tenant_id=$1 AND sender_user_id=$2 AND quote_request_id=$3",
          [input.tenantId, input.senderUserId, input.quoteRequestId],
        );
        if (previous.rows[0]) {
          const quote = quoteRow(previous.rows[0]);
          const same = await client.query<{ equal: boolean }>(
            "SELECT $1::numeric=$2::numeric AS equal", [quote.amount, input.amount],
          );
          if (quote.recipientUserId !== input.recipientUserId ||
              quote.asset !== input.asset || quote.network !== input.network ||
              quote.policyRevision !== input.policyRevision || !same.rows[0]?.equal)
            throw new Error("crypto.internal.quote_replay_conflict");
          return quote;
        }
        const identities = await client.query<{ user_id: string }>(
          "SELECT user_id FROM security.platform_user_profiles WHERE tenant_id=$1 AND user_id=ANY($2::text[])",
          [input.tenantId, [input.senderUserId, input.recipientUserId]],
        );
        if (new Set(identities.rows.map(row => row.user_id)).size !== 2)
          throw new Error("crypto.internal.recipient_unavailable");
        // Quotes must reflect current spendability; the execution transaction
        // still rechecks after acquiring the shared custody advisory balance lock.
        const spendable = await client.query<{ sufficient: boolean }>(
          "SELECT COALESCE(SUM(CASE direction WHEN 'credit' THEN amount ELSE -amount END),0) >= $5::numeric AS sufficient " +
          "FROM commerce.crypto_all_ledger_entries WHERE tenant_id=$1 AND user_id=$2 AND asset=$3 " +
          "AND network IS NOT DISTINCT FROM $4",
          [input.tenantId, input.senderUserId, input.asset, input.network, input.amount],
        );
        if (!spendable.rows[0]?.sufficient) throw new Error("crypto.insufficient_balance");
        await assertActiveParties(
          client, input.tenantId, input.senderUserId, input.recipientUserId,
        );
        const quoteId = createCanonicalId("request");
        const posted = await client.query(
          "INSERT INTO commerce.crypto_internal_transfer_quotes " +
          "(tenant_id,quote_id,quote_request_id,sender_user_id,recipient_user_id," +
          " asset,network,amount,fee,policy_revision,created_at,expires_at) " +
          "VALUES($1,$2,$3,$4,$5,$6,$7,$8::numeric,0,$9,clock_timestamp()," +
          " clock_timestamp()+interval '120 seconds') RETURNING *",
          [input.tenantId, quoteId, input.quoteRequestId, input.senderUserId,
            input.recipientUserId, input.asset, input.network, input.amount, input.policyRevision],
        );
        return quoteRow(posted.rows[0]);
      });
    },

    async readQuote(input) {
      const rows = await pool.query(
        "SELECT * FROM commerce.crypto_internal_transfer_quotes WHERE tenant_id=$1 " +
        "AND sender_user_id=$2 AND quote_id=$3",
        [nonempty(input.tenantId, "tenant"), nonempty(input.senderUserId, "sender"),
          nonempty(input.quoteId, "quote")],
      );
      return rows.rows[0] ? quoteRow(rows.rows[0]) : null;
    },

    async execute(raw) {
      const tenantId = nonempty(raw.tenantId, "tenant");
      const senderUserId = nonempty(raw.senderUserId, "sender");
      const requestId = nonempty(raw.requestId, "request");
      const quoteId = nonempty(raw.quoteId, "quote");
      const policyRevision = nonempty(raw.policyRevision, "policy");
      return withTransaction(pool, async (client) => {
        const replaySql = "SELECT * FROM commerce.crypto_internal_transfers " +
          "WHERE tenant_id=$1 AND sender_user_id=$2 AND request_id=$3";
        const prior = await client.query(replaySql, [tenantId, senderUserId, requestId]);
        if (prior.rows[0]) {
          const receipt = receiptRow(prior.rows[0]);
          if (receipt.quoteId !== quoteId) throw new Error("crypto.internal.replay_conflict");
          return receipt;
        }
        const match = await client.query(
          "SELECT * FROM commerce.crypto_internal_transfer_quotes " +
          "WHERE tenant_id=$1 AND quote_id=$2 AND sender_user_id=$3 FOR UPDATE",
          [tenantId, quoteId, senderUserId],
        );
        if (!match.rows[0]) throw new Error("crypto.internal.quote_not_found");
        const quote = quoteRow(match.rows[0]);
        const duplicate = await client.query(replaySql, [tenantId, senderUserId, requestId]);
        if (duplicate.rows[0]) {
          const receipt = receiptRow(duplicate.rows[0]);
          if (receipt.quoteId !== quoteId) throw new Error("crypto.internal.replay_conflict");
          return receipt;
        }
        const consumed = await client.query(
          "SELECT transfer_id FROM commerce.crypto_internal_transfers WHERE tenant_id=$1 AND quote_id=$2",
          [tenantId, quoteId],
        );
        if (consumed.rowCount) throw new Error("crypto.internal.quote_already_used");
        const freshness = await client.query<{ fresh: boolean }>(
          "SELECT clock_timestamp() < $1::timestamptz AS fresh", [quote.expiresAt],
        );
        if (!freshness.rows[0]?.fresh) throw new Error("crypto.internal.quote_expired");
        if (quote.policyRevision !== policyRevision)
          throw new Error("crypto.internal.policy_changed");
        const participants = await client.query<{ user_id: string }>(
          "SELECT user_id FROM security.platform_user_profiles WHERE tenant_id=$1 AND user_id=ANY($2::text[])",
          [tenantId, [quote.senderUserId, quote.recipientUserId]],
        );
        if (new Set(participants.rows.map(row => row.user_id)).size !== 2)
          throw new Error("crypto.internal.recipient_unavailable");
        await assertActiveParties(
          client, tenantId, quote.senderUserId, quote.recipientUserId,
        );
        await lockCustodyBalance(client, {
          tenantId, userId: senderUserId, asset: quote.asset, network: quote.network,
        });
        const enough = await client.query<{ sufficient: boolean }>(
          "SELECT COALESCE(SUM(CASE direction WHEN 'credit' THEN amount ELSE -amount END),0) >= $5::numeric AS sufficient " +
          "FROM commerce.crypto_all_ledger_entries WHERE tenant_id=$1 AND user_id=$2 AND asset=$3 " +
          "AND network IS NOT DISTINCT FROM $4",
          [tenantId, senderUserId, quote.asset, quote.network, quote.amount],
        );
        if (!enough.rows[0]?.sufficient) throw new Error("crypto.insufficient_balance");
        const transferId = createCanonicalId("request");
        const result = await client.query(
          "INSERT INTO commerce.crypto_internal_transfers " +
          "(tenant_id,transfer_id,quote_id,request_id,sender_user_id,recipient_user_id,asset,network,amount,fee,policy_revision) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::numeric,0,$10) RETURNING *",
          [tenantId, transferId, quoteId, requestId, senderUserId, quote.recipientUserId,
            quote.asset, quote.network, quote.amount, quote.policyRevision],
        );
        await client.query(
          "INSERT INTO commerce.crypto_internal_transfer_entries " +
          "(tenant_id,transfer_id,side,user_id,asset,network,amount,created_at) " +
          "VALUES ($1,$2,'debit',$3,$5,$6,$7::numeric,$8),($1,$2,'credit',$4,$5,$6,$7::numeric,$8)",
          [tenantId, transferId, senderUserId, quote.recipientUserId, quote.asset,
            quote.network, quote.amount, result.rows[0].completed_at],
        );
        return receiptRow(result.rows[0]);
      });
    },

    async readByRequest(input) {
      const result = await pool.query(
        "SELECT * FROM commerce.crypto_internal_transfers " +
        "WHERE tenant_id=$1 AND sender_user_id=$2 AND request_id=$3",
        [nonempty(input.tenantId, "tenant"), nonempty(input.senderUserId, "sender"),
          nonempty(input.requestId, "request")],
      );
      return result.rows[0] ? receiptRow(result.rows[0]) : null;
    },

    async read(input) {
      const result = await pool.query(
        "SELECT * FROM commerce.crypto_internal_transfers WHERE tenant_id=$1 " +
        "AND transfer_id=$2 AND (sender_user_id=$3 OR recipient_user_id=$3)",
        [nonempty(input.tenantId, "tenant"), nonempty(input.transferId, "transfer"),
          nonempty(input.userId, "user")],
      );
      return result.rows[0] ? receiptRow(result.rows[0]) : null;
    },
    async history(input) {
      if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100)
        throw new TypeError("crypto.internal.limit.invalid");
      const rows = await pool.query(
        "SELECT * FROM commerce.crypto_internal_transfers WHERE tenant_id=$1 " +
        "AND (sender_user_id=$2 OR recipient_user_id=$2) " +
        "ORDER BY completed_at DESC,transfer_id DESC LIMIT $3",
        [nonempty(input.tenantId, "tenant"), nonempty(input.userId, "user"), input.limit],
      );
      return Object.freeze(rows.rows.map(receiptRow));
    },
  });
}
