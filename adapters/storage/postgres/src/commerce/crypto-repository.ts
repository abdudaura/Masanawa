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
  normalizeCryptoNonNegativeAmount,
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

function nonNegativeDecimal(value: string): string {
  return normalizeCryptoNonNegativeAmount(value);
}

function sameWithdrawalTerms(left: CryptoIntent, right: CryptoIntent): boolean {
  return (
    left.operation === "withdraw" &&
    right.operation === "withdraw" &&
    left.asset === right.asset &&
    left.network === right.network &&
    left.amount === right.amount &&
    left.destinationAddress === right.destinationAddress &&
    (left.providerNetworkFee ?? null) === (right.providerNetworkFee ?? null) &&
    (left.withdrawalFeePayer ?? null) === (right.withdrawalFeePayer ?? null)
  );
}

function sameConversionTerms(left: CryptoIntent, right: CryptoIntent): boolean {
  return (
    left.operation === "convert" &&
    right.operation === "convert" &&
    left.asset === right.asset &&
    left.network === right.network &&
    left.amount === right.amount &&
    left.targetAsset === right.targetAsset &&
    (left.targetNetwork ?? null) === (right.targetNetwork ?? null)
  );
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
            target_asset=$8, target_network=$9, destination_address=$10, provider=$11,
            provider_payment_id=$12, provider_payout_id=$13, provider_invoice_id=$14,
            checkout_url=$15, provider_conversion_id=$16,
            provider_target_amount=$17::numeric,
            pay_address=$18, provider_pay_amount=$19::numeric,
            provider_network_fee=$20::numeric, withdrawal_fee_payer=$21,
            provider_dispatch_started_at=$22, status=$23,
            definition=$24::jsonb, updated_at=$25
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
      normalized.targetNetwork ?? null,
      normalized.destinationAddress,
      normalized.provider,
      normalized.providerPaymentId,
      normalized.providerPayoutId,
      normalized.providerInvoiceId ?? null,
      normalized.checkoutUrl ?? null,
      normalized.providerConversionId ?? null,
      normalized.providerTargetAmount ?? null,
      normalized.payAddress,
      normalized.providerPayAmount,
      normalized.providerNetworkFee ?? null,
      normalized.withdrawalFeePayer ?? null,
      normalized.providerDispatchStartedAt,
      normalized.status,
      canonicalJson(normalized),
      normalized.updatedAt,
    ],
  );
  return normalized;
}

async function insertIntentWithClient(
  client: PoolClient,
  intent: CryptoIntent,
): Promise<CryptoIntent> {
  const normalized = normalizeCryptoIntent(intent);
  await client.query(
    `INSERT INTO commerce.crypto_intents(
       tenant_id,user_id,request_id,operation,asset,network,amount,target_asset,target_network,
       destination_address,provider,provider_payment_id,provider_payout_id,provider_invoice_id,
       checkout_url,provider_conversion_id,provider_target_amount,pay_address,provider_pay_amount,
       provider_network_fee,withdrawal_fee_payer,provider_dispatch_started_at,status,definition,
       created_at,updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7::numeric,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::numeric,$18,$19::numeric,
       $20::numeric,$21,$22,$23,$24::jsonb,$25,$26
     )`,
    [
      normalized.tenantId, normalized.userId, normalized.requestId, normalized.operation,
      normalized.asset, normalized.network, normalized.amount, normalized.targetAsset,
      normalized.targetNetwork ?? null, normalized.destinationAddress, normalized.provider,
      normalized.providerPaymentId, normalized.providerPayoutId,
      normalized.providerInvoiceId ?? null, normalized.checkoutUrl ?? null,
      normalized.providerConversionId ?? null, normalized.providerTargetAmount ?? null,
      normalized.payAddress, normalized.providerPayAmount, normalized.providerNetworkFee ?? null,
      normalized.withdrawalFeePayer ?? null, normalized.providerDispatchStartedAt,
      normalized.status, canonicalJson(normalized), normalized.createdAt, normalized.updatedAt,
    ],
  );
  return normalized;
}

async function accountBalance(
  client: PoolClient,
  input: { tenantId: TenantId; userId: UserId; asset: string; network: string | null },
): Promise<string> {
  const result = await client.query<{ balance: string }>(
    `SELECT trim_scale(COALESCE(SUM(
         CASE direction WHEN 'credit' THEN amount ELSE -amount END
       ),0))::text AS balance
       FROM commerce.crypto_ledger_entries
      WHERE tenant_id=$1 AND user_id=$2 AND asset=$3
        AND network IS NOT DISTINCT FROM $4`,
    [input.tenantId, input.userId, input.asset, input.network],
  );
  return nonNegativeDecimal(result.rows[0]?.balance ?? "0");
}

async function aggregateLiability(
  client: PoolClient,
  input: { tenantId: TenantId; asset: string; network: string | null },
): Promise<string> {
  const result = await client.query<{ liability: string }>(
    `SELECT trim_scale(COALESCE(SUM(GREATEST(user_balance, 0)), 0))::text AS liability
       FROM (
         SELECT user_id,
                COALESCE(SUM(
                  CASE direction WHEN 'credit' THEN amount ELSE -amount END
                ), 0) AS user_balance
           FROM commerce.crypto_ledger_entries
          WHERE tenant_id=$1 AND asset=$2
            AND network IS NOT DISTINCT FROM $3
          GROUP BY user_id
       ) AS user_balances`,
    [input.tenantId, input.asset, input.network],
  );
  return nonNegativeDecimal(result.rows[0]?.liability ?? "0");
}

async function platformAggregateLiability(
  client: PoolClient,
  input: { asset: string; network: string | null },
): Promise<string> {
  const result = await client.query<{ liability: string }>(
    `SELECT trim_scale(COALESCE(SUM(GREATEST(user_balance, 0)), 0))::text AS liability
       FROM (
         SELECT tenant_id, user_id,
                COALESCE(SUM(
                  CASE direction WHEN 'credit' THEN amount ELSE -amount END
                ), 0) AS user_balance
           FROM commerce.crypto_ledger_entries
          WHERE asset=$1
            AND network IS NOT DISTINCT FROM $2
          GROUP BY tenant_id, user_id
       ) AS user_balances`,
    [input.asset, input.network],
  );
  return nonNegativeDecimal(result.rows[0]?.liability ?? "0");
}

async function lockBalance(
  client: PoolClient,
  input: { tenantId: TenantId; userId: UserId; asset: string; network: string | null },
): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `crypto:balance:${input.tenantId}:${input.userId}:${input.asset}:${input.network ?? "-"}`,
  ]);
}

async function assertSufficientBalance(
  client: PoolClient,
  balance: string,
  principal: string,
  extra = "0",
): Promise<void> {
  const sufficient = await client.query<{ ok: boolean }>(
    "SELECT $1::numeric >= ($2::numeric + $3::numeric) AS ok",
    [balance, principal, extra],
  );
  if (!sufficient.rows[0]?.ok) throw new Error("crypto.insufficient_balance");
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
      | "withdrawal-fee-reserve"
      | "withdrawal-fee-release"
      | "conversion-debit"
      | "conversion-credit"
      | "conversion-release"
      | "fiat-purchase-credit"
      | "fiat-purchase-refund"
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
        return insertIntentWithClient(client, intent);
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

    async readIntentByProviderPayoutId(input) {
      const providerPayoutId = String(input.providerPayoutId).trim();
      if (!/^[A-Za-z0-9_-]{1,128}$/u.test(providerPayoutId)) {
        throw new Error("crypto.provider_payout.invalid");
      }
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{ definition: unknown }>(
            `SELECT definition
               FROM commerce.crypto_intents
              WHERE provider_payout_id=$1
              LIMIT 2`,
            [providerPayoutId],
          );
          if (result.rows.length > 1) {
            throw new Error("crypto.provider_payout.identity_ambiguous");
          }
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

    async failProviderDispatch(input) {
      return withTransaction(pool, async (client) => {
        const key = {
          tenantId: parseCanonicalId("tenant", input.tenantId),
          userId: parseCanonicalId("user", input.userId),
          requestId: parseCanonicalId("request", input.requestId),
        };
        const current = await readIntentWithClient(client, key, true);
        if (!current || current.operation !== input.operation) {
          throw new Error("crypto.intent.unavailable");
        }
        if (current.status === "failed") return current;
        if (
          current.providerPaymentId !== null ||
          current.providerPayoutId !== null ||
          (current.providerInvoiceId ?? null) !== null ||
          (current.providerConversionId ?? null) !== null
        ) {
          throw new Error("crypto.provider_dispatch.outcome_unknown");
        }
        return updateIntentWithClient(client, {
          ...current,
          status: "failed",
          updatedAt: input.updatedAt,
        });
      });
    },

    async bindProviderInvoice(input) {
      return withTransaction(pool, async (client) => {
        const key = {
          tenantId: parseCanonicalId("tenant", input.tenantId),
          userId: parseCanonicalId("user", input.userId),
          requestId: parseCanonicalId("request", input.requestId),
        };
        const current = await readIntentWithClient(client, key, true);
        if (!current || current.operation !== "buy") {
          throw new Error("crypto.buy.intent_unavailable");
        }
        const providerInvoiceId = String(input.providerInvoiceId).trim();
        if (!/^[A-Za-z0-9_-]{1,128}$/u.test(providerInvoiceId)) {
          throw new Error("crypto.provider_invoice.invalid");
        }
        let checkout: URL;
        try {
          checkout = new URL(input.checkoutUrl);
        } catch {
          throw new Error("crypto.checkout_url.invalid");
        }
        if (checkout.protocol !== "https:") {
          throw new Error("crypto.checkout_url.insecure");
        }
        if (
          current.providerInvoiceId &&
          current.providerInvoiceId !== providerInvoiceId
        ) {
          throw new Error("crypto.provider_invoice.replay_conflict");
        }
        if (current.checkoutUrl && current.checkoutUrl !== checkout.toString()) {
          throw new Error("crypto.checkout_url.replay_conflict");
        }
        return updateIntentWithClient(client, {
          ...current,
          providerInvoiceId,
          checkoutUrl: checkout.toString(),
          status: "awaiting_payment",
          updatedAt: input.updatedAt,
        });
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
        const current = await readIntentWithClient(
          client,
          { tenantId, userId, requestId },
          true,
        );
        if (
          !current ||
          (current.operation !== "deposit" && current.operation !== "buy")
        ) {
          throw new Error("crypto.intent.unavailable");
        }

        const existingEvent = await client.query(
          `SELECT 1 FROM commerce.crypto_provider_events
            WHERE tenant_id=$1 AND payload_hash=$2`,
          [tenantId, event.payloadHash],
        );
        if (existingEvent.rows[0]) return current;

        if (current.operation === "deposit") {
          if (current.providerPaymentId !== event.paymentId) {
            throw new Error("crypto.provider_payment.intent_mismatch");
          }

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
          if (!currencyMatches && event.status === "finished") {
            nextStatus = "manual_review";
          }

          if (event.status === "finished" && currencyMatches) {
            await postLedger(client, {
              tenantId,userId,requestId,asset:current.asset,network:current.network,
              amount:decimal(event.actuallyPaid),direction:"credit",reason:"provider-deposit",
              providerReference:event.paymentId,createdAt:event.observedAt,
            });
          }

          if (event.status === "refunded") {
            const creditedReference = event.paymentId;
            const credited = await client.query<{ amount: string }>(
              `SELECT amount::text AS amount FROM commerce.crypto_ledger_entries
                WHERE tenant_id=$1 AND user_id=$2 AND provider_reference=$3
                  AND reason='provider-deposit' LIMIT 1`,
              [tenantId,userId,creditedReference],
            );
            if (credited.rows[0]) {
              await postLedger(client, {
                tenantId,userId,requestId,asset:current.asset,network:current.network,
                amount:credited.rows[0].amount,direction:"debit",reason:"provider-refund",
                providerReference:`refund:${creditedReference}`,createdAt:event.observedAt,
              });
            }
          }

          const nextIntentStatus =
            current.status === "refunded"
              ? "refunded"
              : current.status === "succeeded" && nextStatus !== "refunded"
                ? "succeeded"
                : nextStatus;
          return updateIntentWithClient(client, {
            ...current,
            status: nextIntentStatus,
            updatedAt: event.observedAt,
          });
        }

        if (
          current.providerInvoiceId === null ||
          current.providerInvoiceId === undefined ||
          current.checkoutUrl === null ||
          current.checkoutUrl === undefined ||
          current.targetAsset === null
        ) {
          throw new Error("crypto.buy.intent_unavailable");
        }

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

        const invoiceMatches =
          event.invoiceId !== undefined &&
          event.invoiceId !== null &&
          event.invoiceId === current.providerInvoiceId;
        const priceMatches =
          normalizeCryptoAsset(event.priceCurrency) === current.asset &&
          decimal(event.priceAmount) === current.amount;
        const samePayment =
          current.providerPaymentId === null ||
          current.providerPaymentId === event.paymentId;

        if (!invoiceMatches || !priceMatches || !samePayment) {
          return updateIntentWithClient(client, {
            ...current,
            status:
              current.status === "succeeded" || current.status === "refunded"
                ? current.status
                : "manual_review",
            updatedAt: event.observedAt,
          });
        }

        let nextStatus = mappedStatus(event.status);
        let targetAmount = current.providerTargetAmount ?? null;
        const targetCurrency =
          event.outcomeCurrency === undefined || event.outcomeCurrency === null
            ? null
            : normalizeCryptoAsset(event.outcomeCurrency);
        const exactOutcome =
          event.outcomeAmount === undefined || event.outcomeAmount === null
            ? null
            : decimal(event.outcomeAmount);

        if (event.status === "finished") {
          if (targetCurrency !== current.targetAsset || exactOutcome === null) {
            nextStatus = "manual_review";
          } else {
            if (
              current.status === "succeeded" &&
              (current.providerTargetAmount ?? null) !== exactOutcome
            ) {
              throw new Error("crypto.buy.terminal_conflict");
            }
            await postLedger(client, {
              tenantId,
              userId,
              requestId,
              asset: current.targetAsset,
              network: current.targetNetwork ?? null,
              amount: exactOutcome,
              direction: "credit",
              reason: "fiat-purchase-credit",
              providerReference: event.paymentId,
              createdAt: event.observedAt,
            });
            targetAmount = exactOutcome;
          }
        }

        if (event.status === "refunded") {
          const credited = await client.query<{ amount: string }>(
            `SELECT amount::text AS amount
               FROM commerce.crypto_ledger_entries
              WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3
                AND reason='fiat-purchase-credit'
              LIMIT 1`,
            [tenantId, userId, requestId],
          );
          if (credited.rows[0]) {
            await postLedger(client, {
              tenantId,
              userId,
              requestId,
              asset: current.targetAsset,
              network: current.targetNetwork ?? null,
              amount: credited.rows[0].amount,
              direction: "debit",
              reason: "fiat-purchase-refund",
              providerReference: `refund:${event.paymentId}`,
              createdAt: event.observedAt,
            });
          }
          targetAmount = null;
        }

        const nextIntentStatus =
          current.status === "refunded"
            ? "refunded"
            : current.status === "succeeded" && nextStatus !== "refunded"
              ? "succeeded"
              : nextStatus;
        return updateIntentWithClient(client, {
          ...current,
          providerPaymentId: current.providerPaymentId ?? event.paymentId,
          providerTargetAmount:
            nextIntentStatus === "succeeded" ? targetAmount : null,
          status: nextIntentStatus,
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
      const expected = normalizeCryptoIntent({
        ...intent,
        providerNetworkFee: null,
        withdrawalFeePayer: null,
        status: "processing",
      });
      return withTransaction(pool, async (client) => {
        await lockBalance(client, expected);
        const existing = await readIntentWithClient(client, expected, true);
        if (existing) {
          if (!sameWithdrawalTerms(existing, expected)) {
            throw new Error("crypto.withdraw.replay_conflict");
          }
          return existing;
        }
        const balance = await accountBalance(client, expected);
        await assertSufficientBalance(client, balance, expected.amount);
        const admitted = await insertIntentWithClient(client, expected);
        await postLedger(client, {
          tenantId: admitted.tenantId, userId: admitted.userId, requestId: admitted.requestId,
          asset: admitted.asset, network: admitted.network, amount: admitted.amount, direction: "debit",
          reason: "withdrawal-reserve", providerReference: null, createdAt: admitted.createdAt,
        });
        return admitted;
      });
    },

    async reserveWithdrawalWithFee(input) {
      const fee = nonNegativeDecimal(input.networkFee);
      if (fee === "0") return this.reserveWithdrawal(input.intent);
      if (input.feePayer !== "user" && input.feePayer !== "platform") {
        throw new Error("crypto.withdraw.fee_payer_invalid");
      }
      const intent = normalizeCryptoIntent({
        ...input.intent,
        providerNetworkFee: fee,
        withdrawalFeePayer: input.feePayer,
        status: "processing",
      });
      if (intent.operation !== "withdraw") throw new Error("crypto.withdraw.intent_required");

      return withTransaction(pool, async (client) => {
        await lockBalance(client, intent);
        const existing = await readIntentWithClient(client, intent, true);
        if (existing) {
          if (!sameWithdrawalTerms(existing, intent)) {
            throw new Error("crypto.withdraw.replay_conflict");
          }
          return existing;
        }
        const balance = await accountBalance(client, intent);
        await assertSufficientBalance(
          client,
          balance,
          intent.amount,
          input.feePayer === "user" ? fee : "0",
        );
        const admitted = await insertIntentWithClient(client, intent);
        await postLedger(client, {
          tenantId: admitted.tenantId, userId: admitted.userId, requestId: admitted.requestId,
          asset: admitted.asset, network: admitted.network, amount: admitted.amount, direction: "debit",
          reason: "withdrawal-reserve", providerReference: null, createdAt: admitted.createdAt,
        });
        if (input.feePayer === "user") {
          await postLedger(client, {
            tenantId: admitted.tenantId, userId: admitted.userId, requestId: admitted.requestId,
            asset: admitted.asset, network: admitted.network, amount: fee, direction: "debit",
            reason: "withdrawal-fee-reserve", providerReference: null, createdAt: admitted.createdAt,
          });
        }
        return admitted;
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
        if (current.status === "succeeded" || current.status === "failed") {
          if (
            (current.status === "succeeded" && !input.succeeded) ||
            (current.status === "failed" && input.succeeded)
          ) {
            throw new Error("crypto.withdraw.terminal_conflict");
          }
          return current;
        }
        if (!input.succeeded) {
          await postLedger(client, {
            tenantId: current.tenantId, userId: current.userId, requestId: current.requestId,
            asset: current.asset, network: current.network, amount: current.amount, direction: "credit",
            reason: "withdrawal-release", providerReference: input.providerReference, createdAt: input.updatedAt,
          });
          if (
            current.withdrawalFeePayer === "user" &&
            current.providerNetworkFee !== undefined &&
            current.providerNetworkFee !== null &&
            current.providerNetworkFee !== "0"
          ) {
            await postLedger(client, {
              tenantId: current.tenantId, userId: current.userId, requestId: current.requestId,
              asset: current.asset, network: current.network, amount: current.providerNetworkFee,
              direction: "credit", reason: "withdrawal-fee-release",
              providerReference: input.providerReference, createdAt: input.updatedAt,
            });
          }
        }
        return updateIntentWithClient(client, {
          ...current,
          status: input.succeeded ? "succeeded" : "failed",
          updatedAt: input.updatedAt,
        });
      });
    },

    async reserveConversion(input) {
      const intent = normalizeCryptoIntent({ ...input, status: "processing" });
      if (intent.operation !== "convert" || intent.targetAsset === null) {
        throw new Error("crypto.convert.intent_required");
      }
      return withTransaction(pool, async (client) => {
        await lockBalance(client, intent);
        const existing = await readIntentWithClient(client, intent, true);
        if (existing) {
          if (!sameConversionTerms(existing, intent)) {
            throw new Error("crypto.convert.replay_conflict");
          }
          return existing;
        }
        const balance = await accountBalance(client, intent);
        await assertSufficientBalance(client, balance, intent.amount);
        const admitted = await insertIntentWithClient(client, intent);
        await postLedger(client, {
          tenantId: admitted.tenantId, userId: admitted.userId, requestId: admitted.requestId,
          asset: admitted.asset, network: admitted.network, amount: admitted.amount,
          direction: "debit", reason: "conversion-debit", providerReference: null,
          createdAt: admitted.createdAt,
        });
        return admitted;
      });
    },

    async bindProviderConversion(input) {
      return withTransaction(pool, async (client) => {
        const key = {
          tenantId: parseCanonicalId("tenant", input.tenantId),
          userId: parseCanonicalId("user", input.userId),
          requestId: parseCanonicalId("request", input.requestId),
        };
        const current = await readIntentWithClient(client, key, true);
        if (!current || current.operation !== "convert") {
          throw new Error("crypto.convert.intent_unavailable");
        }
        const providerConversionId = String(input.providerConversionId).trim();
        if (!/^[A-Za-z0-9_-]{1,128}$/u.test(providerConversionId)) {
          throw new Error("crypto.provider_conversion.invalid");
        }
        if (
          current.providerConversionId &&
          current.providerConversionId !== providerConversionId
        ) {
          throw new Error("crypto.provider_conversion.replay_conflict");
        }
        return updateIntentWithClient(client, {
          ...current,
          providerConversionId,
          updatedAt: input.updatedAt,
        });
      });
    },

    async settleConversion(input) {
      return withTransaction(pool, async (client) => {
        const key = {
          tenantId: parseCanonicalId("tenant", input.tenantId),
          userId: parseCanonicalId("user", input.userId),
          requestId: parseCanonicalId("request", input.requestId),
        };
        const current = await readIntentWithClient(client, key, true);
        if (!current || current.operation !== "convert" || current.targetAsset === null) {
          throw new Error("crypto.convert.intent_unavailable");
        }

        const boundProviderReference = current.providerConversionId ?? null;
        if (boundProviderReference !== input.providerReference) {
          throw new Error("crypto.provider_conversion.intent_mismatch");
        }

        if (input.succeeded) {
          if (input.targetAmount === null) {
            throw new Error("crypto.convert.target_amount_required");
          }
          if (boundProviderReference === null) {
            throw new Error("crypto.provider_conversion.unbound");
          }
          const targetAmount = decimal(input.targetAmount);

          if (current.status === "succeeded" || current.status === "failed") {
            if (
              current.status !== "succeeded" ||
              (current.providerTargetAmount ?? null) !== targetAmount
            ) {
              throw new Error("crypto.convert.terminal_conflict");
            }
            return current;
          }

          await postLedger(client, {
            tenantId: current.tenantId,
            userId: current.userId,
            requestId: current.requestId,
            asset: current.targetAsset,
            network: current.targetNetwork ?? null,
            amount: targetAmount,
            direction: "credit",
            reason: "conversion-credit",
            providerReference: input.providerReference,
            createdAt: input.updatedAt,
          });
          return updateIntentWithClient(client, {
            ...current,
            providerTargetAmount: targetAmount,
            status: "succeeded",
            updatedAt: input.updatedAt,
          });
        }

        if (input.targetAmount !== null) {
          throw new Error("crypto.convert.target_amount_unexpected");
        }
        if (current.status === "succeeded" || current.status === "failed") {
          if (current.status !== "failed") {
            throw new Error("crypto.convert.terminal_conflict");
          }
          return current;
        }

        await postLedger(client, {
          tenantId: current.tenantId,
          userId: current.userId,
          requestId: current.requestId,
          asset: current.asset,
          network: current.network,
          amount: current.amount,
          direction: "credit",
          reason: "conversion-release",
          providerReference: input.providerReference,
          createdAt: input.updatedAt,
        });
        return updateIntentWithClient(client, {
          ...current,
          providerTargetAmount: null,
          status: "failed",
          updatedAt: input.updatedAt,
        });
      });
    },

    async readAggregateLiability(input) {
      const normalized = {
        tenantId: parseCanonicalId("tenant", input.tenantId),
        asset: normalizeCryptoAsset(input.asset),
        network: normalizeCryptoNetwork(input.network),
      };
      return withTransaction(
        pool,
        (client) => aggregateLiability(client, normalized),
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async readPlatformAggregateLiability(input) {
      const normalized = {
        asset: normalizeCryptoAsset(input.asset),
        network: normalizeCryptoNetwork(input.network),
      };
      return withTransaction(
        pool,
        (client) => platformAggregateLiability(client, normalized),
        { isolation: "repeatable read", readOnly: true },
      );
    },
  });
}
