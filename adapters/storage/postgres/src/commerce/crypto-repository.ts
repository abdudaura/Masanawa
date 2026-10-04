import {
  createCanonicalId,
  parseCanonicalId,
  type Instant,
  type RequestId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  normalizeCryptoAmount,
  normalizeCryptoAsset,
  normalizeCryptoIntent,
  normalizeCryptoLedgerEntry,
  normalizeCryptoNetwork,
  type CryptoIntent,
  type CryptoIntentStatus,
  type CryptoProviderPaymentEvent,
  type CryptoRepository,
} from "@masanawa/commerce";
import { canonicalJson } from "@masanawa/security";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

function intentFrom(value: unknown): CryptoIntent {
  return normalizeCryptoIntent(value as CryptoIntent);
}

function mappedStatus(status: CryptoProviderPaymentEvent["status"]): CryptoIntentStatus {
  switch (status) {
    case "waiting":
      return "awaiting_payment";
    case "confirming":
    case "confirmed":
    case "sending":
      return "processing";
    case "partially_paid":
      return "partial";
    case "finished":
      return "succeeded";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    case "expired":
      return "expired";
  }
}

function decimal(value: string): string {
  return normalizeCryptoAmount(value);
}

async function readIntentWithClient(
  client: PoolClient,
  input: { tenantId: TenantId; userId: UserId; requestId: RequestId },
  forUpdate = false,
): Promise<CryptoIntent | null> {
  const result = await client.query<{ definition: unknown }>(
    `SELECT definition
       FROM commerce.crypto_intents
      WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [input.tenantId, input.userId, input.requestId],
  );
  return result.rows[0] ? intentFrom(result.rows[0].definition) : null;
}

async function updateIntentWithClient(
  client: PoolClient,
  intent: CryptoIntent,
): Promise<CryptoIntent> {
  const normalized = normalizeCryptoIntent(intent);
  await client.query(
    `UPDATE commerce.crypto_intents
        SET operation=$4, asset=$5, network=$6, amount=$7::numeric,
            target_asset=$8, destination_address=$9, provider=$10,
            provider_payment_id=$11, provider_payout_id=$12, pay_address=$13,
            provider_pay_amount=$14::numeric, provider_dispatch_started_at=$15,
            status=$16, definition=$17::jsonb, updated_at=$18
      WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3`,
    [
      normalized.tenantId,
      normalized.userId,
      normalized.requestId,
      normalized.operation,
      normalized.asset,
      normalized.network,
      normalized.amount,
      normalized.targetAsset,
      normalized.destinationAddress,
      normalized.provider,
      normalized.providerPaymentId,
      normalized.providerPayoutId,
      normalized.payAddress,
      normalized.providerPayAmount,
      normalized.providerDispatchStartedAt,
      normalized.status,
      canonicalJson(normalized),
      normalized.updatedAt,
    ],
  );
  return normalized;
}

async function accountBalance(
  client: PoolClient,
  input: { tenantId: TenantId; userId: UserId; asset: string; network: string | null },
): Promise<string> {
  const result = await client.query<{ balance: string }>(
    `SELECT COALESCE(SUM(
         CASE direction WHEN 'credit' THEN amount ELSE -amount END
       ),0)::text AS balance
       FROM commerce.crypto_ledger_entries
      WHERE tenant_id=$1 AND user_id=$2 AND asset=$3
        AND network IS NOT DISTINCT FROM $4`,
    [input.tenantId, input.userId, input.asset, input.network],
  );
  return result.rows[0]?.balance ?? "0";
}

async function postLedger(
  client: PoolClient,
  input: {
    tenantId: TenantId;
    userId: UserId;
    requestId: RequestId;
    asset: string;
    network: string | null;
    amount: string;
    direction: "credit" | "debit";
    reason:
      | "provider-deposit"
      | "provider-refund"
      | "withdrawal-reserve"
      | "withdrawal-release"
      | "conversion-debit"
      | "conversion-credit"
      | "adjustment";
    providerReference: string | null;
    createdAt: Instant;
  },
): Promise<void> {
  const entry = normalizeCryptoLedgerEntry({
    schemaVersion: 1,
    tenantId: input.tenantId,
    ledgerEntryId: createCanonicalId("ledger-entry"),
    userId: input.userId,
    asset: input.asset,
    network: input.network,
    amount: input.amount,
    direction: input.direction,
    reason: input.reason,
    requestId: input.requestId,
    providerReference: input.providerReference,
    createdAt: input.createdAt,
  });
  await client.query(
    `INSERT INTO commerce.crypto_ledger_entries(
       tenant_id, ledger_entry_id, user_id, asset, network, amount, direction,
       reason, request_id, provider_reference, definition, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6::numeric,$7,$8,$9,$10,$11::jsonb,$12)
     ON CONFLICT DO NOTHING`,
    [
      entry.tenantId,
      entry.ledgerEntryId,
      entry.userId,
      entry.asset,
      entry.network,
      entry.amount,
      entry.direction,
      entry.reason,
      entry.requestId,
      entry.providerReference,
      canonicalJson(entry),
      entry.createdAt,
    ],
  );
}

export function createPostgresCryptoRepository(pool: Pool): CryptoRepository {
  return Object.freeze<CryptoRepository>({
    async createIntent(input) {
      const intent = normalizeCryptoIntent(input);
      return withTransaction(pool, async (client) => {
        const existing = await readIntentWithClient(client, intent, true);
        if (existing) {
          if (canonicalJson(existing) !== canonicalJson(intent)) {
            throw new Error("crypto.intent.replay_conflict");
          }
          return existing;
        }
        await client.query(
          `INSERT INTO commerce.crypto_intents(
             tenant_id,user_id,request_id,operation,asset,network,amount,target_asset,
             destination_address,provider,provider_payment_id,provider_payout_id,
             pay_address,provider_pay_amount,provider_dispatch_started_at,status,definition,created_at,updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,$8,$9,$10,$11,$12,$13,$14::numeric,$15,$16,$17::jsonb,$18,$19)`,
          [
            intent.tenantId,intent.userId,intent.requestId,intent.operation,intent.asset,
            intent.network,intent.amount,intent.targetAsset,intent.destinationAddress,
            intent.provider,intent.providerPaymentId,intent.providerPayoutId,intent.payAddress,
            intent.providerPayAmount,intent.providerDispatchStartedAt,intent.status,canonicalJson(intent),intent.createdAt,intent.updatedAt,
          ],
        );
        return intent;
      });
    },

    async readIntent(input) {
      return withTransaction(
        pool,
        (client) =>
          readIntentWithClient(client, {
            tenantId: parseCanonicalId("tenant", input.tenantId),
            userId: parseCanonicalId("user", input.userId),
            requestId: parseCanonicalId("request", input.requestId),
          }),
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async readIntentByRequestId(input) {
      const tenantId = parseCanonicalId("tenant", input.tenantId);
      const requestId = parseCanonicalId("request", input.requestId);
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: unknown }>(
            `SELECT definition FROM commerce.crypto_intents
              WHERE tenant_id=$1 AND request_id=$2 LIMIT 2`,
            [tenantId, requestId],
          );
          if (result.rows.length > 1) throw new Error("crypto.intent.identity_ambiguous");
          return result.rows[0] ? intentFrom(result.rows[0].definition) : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async listIntents(input) {
      const tenantId = parseCanonicalId("tenant", input.tenantId);
      const userId = parseCanonicalId("user", input.userId);
      const limit = input.limit ?? 50;
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        throw new RangeError("crypto.history.limit.invalid");
      }
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: unknown }>(
            `SELECT definition FROM commerce.crypto_intents
              WHERE tenant_id=$1 AND user_id=$2
              ORDER BY created_at DESC, request_id DESC LIMIT $3`,
            [tenantId, userId, limit],
          );
          return Object.freeze(result.rows.map((row) => intentFrom(row.definition)));
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async beginProviderDispatch(input) {
      return withTransaction(pool, async (client) => {
        const key = {
          tenantId: parseCanonicalId("tenant", input.tenantId),
          userId: parseCanonicalId("user", input.userId),
          requestId: parseCanonicalId("request", input.requestId),
        };
        const current = await readIntentWithClient(client, key, true);
        if (!current) throw new Error("crypto.intent.unavailable");
        if (current.providerDispatchStartedAt !== null) {
          return Object.freeze({ intent: current, shouldDispatch: false });
        }
        const next = await updateIntentWithClient(client, {
          ...current,
          providerDispatchStartedAt: input.updatedAt,
          status: current.status === "quoted" ? "processing" : current.status,
          updatedAt: input.updatedAt,
        });
        return Object.freeze({ intent: next, shouldDispatch: true });
      });
    },

    async bindProviderPayment(input) {
      return withTransaction(pool, async (client) => {
        const key = {
          tenantId: parseCanonicalId("tenant", input.tenantId),
          userId: parseCanonicalId("user", input.userId),
          requestId: parseCanonicalId("request", input.requestId),
        };
        const current = await readIntentWithClient(client, key, true);
        if (!current || current.operation !== "deposit") throw new Error("crypto.intent.unavailable");
        if (current.providerPaymentId && current.providerPaymentId !== input.providerPaymentId) {
          throw new Error("crypto.provider_payment.replay_conflict");
        }
        return updateIntentWithClient(client, {
          ...current,
          providerPaymentId: input.providerPaymentId,
          payAddress: input.payAddress,
          providerPayAmount: decimal(input.providerPayAmount),
          status: current.status === "quoted" ? "awaiting_payment" : current.status,
          updatedAt: input.updatedAt,
        });
      });
    },

    async applyProviderPaymentEvent(input) {
      return withTransaction(pool, async (client) => {
        const event = input.event;
        const tenantId = parseCanonicalId("tenant", input.tenantId);
        const userId = parseCanonicalId("user", input.userId);
        const requestId = parseCanonicalId("request", event.orderId);
        const current = await readIntentWithClient(client, { tenantId, userId, requestId }, true);
        if (!current || current.operation !== "deposit") throw new Error("crypto.intent.unavailable");

        const belongs =
          current.providerPaymentId === event.paymentId ||
          (event.parentPaymentId !== null && current.providerPaymentId === event.parentPaymentId);
        if (!belongs) throw new Error("crypto.provider_payment.intent_mismatch");

        const existingEvent = await client.query(
          `SELECT 1 FROM commerce.crypto_provider_events
            WHERE tenant_id=$1 AND payload_hash=$2`,
          [tenantId, event.payloadHash],
        );
        if (existingEvent.rows[0]) return current;

        await client.query(
          `INSERT INTO commerce.crypto_provider_events(
             tenant_id,payload_hash,user_id,request_id,provider_payment_id,
             parent_payment_id,status,observed_at,definition
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
          [
            tenantId,event.payloadHash,userId,requestId,event.paymentId,event.parentPaymentId,
            event.status,event.observedAt,canonicalJson(event),
          ],
        );

        const payCurrency = normalizeCryptoAsset(event.payCurrency);
        const currencyMatches = payCurrency === current.asset;
        let nextStatus = mappedStatus(event.status);
        if (!currencyMatches && event.status === "finished") nextStatus = "manual_review";

        if (event.status === "finished" && currencyMatches) {
          await postLedger(client, {
            tenantId,userId,requestId,asset:current.asset,network:current.network,
            amount: decimal(event.actuallyPaid),direction:"credit",reason:"provider-deposit",
            providerReference:event.paymentId,createdAt:event.observedAt,
          });
        }

        if (event.status === "refunded") {
          const credited = await client.query<{ amount: string }>(
            `SELECT amount::text AS amount FROM commerce.crypto_ledger_entries
              WHERE tenant_id=$1 AND user_id=$2 AND provider_reference=$3
                AND reason='provider-deposit' LIMIT 1`,
            [tenantId,userId,event.paymentId],
          );
          if (credited.rows[0]) {
            await postLedger(client, {
              tenantId,userId,requestId,asset:current.asset,network:current.network,
              amount:credited.rows[0].amount,direction:"debit",reason:"provider-refund",
              providerReference:`refund:${event.paymentId}`,createdAt:event.observedAt,
            });
          }
        }

        const terminal = ["succeeded","refunded"].includes(current.status);
        return updateIntentWithClient(client, {
          ...current,
          status: terminal && nextStatus !== current.status ? current.status : nextStatus,
          updatedAt: event.observedAt,
        });
      });
    },

    async readBalance(input) {
      const normalized = {
        tenantId: parseCanonicalId("tenant", input.tenantId),
        userId: parseCanonicalId("user", input.userId),
        asset: normalizeCryptoAsset(input.asset),
        network: normalizeCryptoNetwork(input.network),
      };
      return withTransaction(
        pool,
        (client) => accountBalance(client, normalized),
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async reserveWithdrawal(input) {
      const intent = normalizeCryptoIntent(input);
      if (intent.operation !== "withdraw") throw new Error("crypto.withdraw.intent_required");
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `crypto:balance:${intent.tenantId}:${intent.userId}:${intent.asset}:${intent.network ?? "-"}`,
        ]);
        const existing = await readIntentWithClient(client, intent, true);
        if (existing) return existing;
        const balance = await accountBalance(client, intent);
        const sufficient = await client.query<{ ok: boolean }>(
          "SELECT $1::numeric >= $2::numeric AS ok",
          [balance, intent.amount],
        );
        if (!sufficient.rows[0]?.ok) throw new Error("crypto.insufficient_balance");

        await client.query(
          `INSERT INTO commerce.crypto_intents(
             tenant_id,user_id,request_id,operation,asset,network,amount,target_asset,
             destination_address,provider,provider_dispatch_started_at,status,definition,created_at,updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,$8,$9,$10,$11,$12,$13::jsonb,$14,$15)`,
          [
            intent.tenantId,intent.userId,intent.requestId,intent.operation,intent.asset,
            intent.network,intent.amount,intent.targetAsset,intent.destinationAddress,
            intent.provider,intent.providerDispatchStartedAt,"processing",canonicalJson({...intent,status:"processing"}),intent.createdAt,intent.updatedAt,
          ],
        );
        await postLedger(client, {
          tenantId:intent.tenantId,userId:intent.userId,requestId:intent.requestId,
          asset:intent.asset,network:intent.network,amount:intent.amount,direction:"debit",
          reason:"withdrawal-reserve",providerReference:null,createdAt:intent.createdAt,
        });
        return normalizeCryptoIntent({...intent,status:"processing"});
      });
    },

    async bindProviderPayout(input) {
      return withTransaction(pool, async (client) => {
        const key = {
          tenantId: parseCanonicalId("tenant", input.tenantId),
          userId: parseCanonicalId("user", input.userId),
          requestId: parseCanonicalId("request", input.requestId),
        };
        const current = await readIntentWithClient(client, key, true);
        if (!current || current.operation !== "withdraw") throw new Error("crypto.withdraw.intent_unavailable");
        if (current.providerPayoutId && current.providerPayoutId !== input.providerPayoutId) {
          throw new Error("crypto.provider_payout.replay_conflict");
        }
        return updateIntentWithClient(client, {
          ...current,
          providerPayoutId: input.providerPayoutId,
          updatedAt: input.updatedAt,
        });
      });
    },

    async settleWithdrawal(input) {
      return withTransaction(pool, async (client) => {
        const key = {
          tenantId: parseCanonicalId("tenant", input.tenantId),
          userId: parseCanonicalId("user", input.userId),
          requestId: parseCanonicalId("request", input.requestId),
        };
        const current = await readIntentWithClient(client, key, true);
        if (!current || current.operation !== "withdraw") throw new Error("crypto.withdraw.intent_unavailable");
        if (current.status === "succeeded" || current.status === "failed") return current;
        if (!input.succeeded) {
          await postLedger(client, {
            tenantId:current.tenantId,userId:current.userId,requestId:current.requestId,
            asset:current.asset,network:current.network,amount:current.amount,direction:"credit",
            reason:"withdrawal-release",providerReference:input.providerReference,createdAt:input.updatedAt,
          });
        }
        return updateIntentWithClient(client, {
          ...current,
          status: input.succeeded ? "succeeded" : "failed",
          updatedAt: input.updatedAt,
        });
      });
    },
  });
}
