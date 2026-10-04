import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  type BillingFulfillmentRecord,
  type BillingFulfillmentStore,
} from "@masanawa/providers";
import {
  normalizeCommerceLedgerTransfer,
  type CommerceLedgerTransfer,
} from "@masanawa/commerce";
import {
  parseCanonicalId,
  type LedgerEntryId,
  type QuoteId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import { canonicalJson } from "@masanawa/security";
import { withTransaction } from "../transaction.js";

export interface ProviderWebhookAdmission {
  readonly duplicate: boolean;
}

export interface ProviderWebhookRepository {
  admitProviderWebhook(input: Readonly<{
    provider: string;
    fingerprint: string;
    eventKey: string;
    receivedAt: string;
    payload: Readonly<Record<string, unknown>>;
  }>): Promise<ProviderWebhookAdmission>;
}

function bounded(value: string, label: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${label} is invalid`);
  const result = value.trim();
  if (result.length < 1 || result.length > max) {
    throw new TypeError(`${label} is invalid`);
  }
  return result;
}

function instant(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError("timestamp is invalid");
  return new Date(timestamp).toISOString();
}

function normalizeBillingRecord(
  record: BillingFulfillmentRecord,
): BillingFulfillmentRecord {
  const reference = bounded(
    record.fulfillmentReference,
    "fulfillmentReference",
    128,
  );
  if (!Number.isSafeInteger(record.revision) || record.revision < 1) {
    throw new Error("financial.billing_revision_invalid");
  }
  return Object.freeze({ ...record, fulfillmentReference: reference });
}

export function createPostgresProviderWebhookRepository(
  pool: Pool,
): ProviderWebhookRepository {
  return Object.freeze({
    async admitProviderWebhook(input: Parameters<ProviderWebhookRepository["admitProviderWebhook"]>[0]) {
      const provider = bounded(input.provider, "provider", 64);
      const fingerprint = bounded(input.fingerprint, "fingerprint", 160);
      const eventKey = bounded(input.eventKey, "eventKey", 256);
      const receivedAt = instant(input.receivedAt);
      return withTransaction(pool, async (client) => {
        const result = await client.query(
          `INSERT INTO commerce.provider_webhook_events(
             provider,fingerprint,event_key,received_at,payload
           ) VALUES ($1,$2,$3,$4,$5::jsonb)
           ON CONFLICT (provider,fingerprint) DO NOTHING`,
          [
            provider,
            fingerprint,
            eventKey,
            receivedAt,
            canonicalJson(input.payload),
          ],
        );
        return Object.freeze({ duplicate: result.rowCount === 0 });
      });
    },
  });
}

export function createPostgresBillingFulfillmentStore(
  pool: Pool,
  owner: Readonly<{ tenantId: string; userId: string }>,
): BillingFulfillmentStore {
  const tenantId = bounded(owner.tenantId, "tenantId", 160);
  const userId = bounded(owner.userId, "userId", 160);

  return Object.freeze({
    async createIfAbsent(input: BillingFulfillmentRecord) {
      const record = normalizeBillingRecord(input);
      const now = record.lastEvidenceAt ?? new Date().toISOString();
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `financial:billing:${record.fulfillmentReference}`,
        ]);
        const existing = await client.query<{
          definition: BillingFulfillmentRecord;
          tenant_id: string;
          user_id: string;
        }>(
          `SELECT definition,tenant_id,user_id
             FROM commerce.billing_fulfillments
            WHERE fulfillment_reference=$1`,
          [record.fulfillmentReference],
        );
        if (existing.rows[0]) {
          if (
            existing.rows[0].tenant_id !== tenantId ||
            existing.rows[0].user_id !== userId
          ) {
            throw new Error("financial.billing_reference_scope_conflict");
          }
          return Object.freeze({
            record: normalizeBillingRecord(existing.rows[0].definition),
            created: false,
          });
        }
        await client.query(
          `INSERT INTO commerce.billing_fulfillments(
             fulfillment_reference,tenant_id,user_id,revision,state,
             definition,created_at,updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)`,
          [
            record.fulfillmentReference,
            tenantId,
            userId,
            record.revision,
            record.state,
            canonicalJson(record),
            now,
          ],
        );
        return Object.freeze({ record, created: true });
      });
    },

    async read(reference: string) {
      return withTransaction(
        pool,
        async (client) => {
          const result = await client.query<{
            definition: BillingFulfillmentRecord;
          }>(
            `SELECT definition
               FROM commerce.billing_fulfillments
              WHERE fulfillment_reference=$1
                AND tenant_id=$2
                AND user_id=$3`,
            [bounded(reference, "fulfillmentReference", 128), tenantId, userId],
          );
          return result.rows[0]
            ? normalizeBillingRecord(result.rows[0].definition)
            : null;
        },
        { isolation: "repeatable read", readOnly: true },
      );
    },

    async compareAndSet(expectedRevision: number, input: BillingFulfillmentRecord) {
      const record = normalizeBillingRecord(input);
      if (record.revision !== expectedRevision + 1) {
        throw new Error("financial.billing_revision_invalid");
      }
      const updatedAt = record.lastEvidenceAt ?? new Date().toISOString();
      return withTransaction(pool, async (client) => {
        const result = await client.query<{
          definition: BillingFulfillmentRecord;
        }>(
          `UPDATE commerce.billing_fulfillments
              SET revision=$4,state=$5,definition=$6::jsonb,updated_at=$7
            WHERE fulfillment_reference=$1
              AND tenant_id=$2
              AND user_id=$3
              AND revision=$8
            RETURNING definition`,
          [
            record.fulfillmentReference,
            tenantId,
            userId,
            record.revision,
            record.state,
            canonicalJson(record),
            updatedAt,
            expectedRevision,
          ],
        );
        if (!result.rows[0]) {
          throw new Error("financial.billing_revision_conflict");
        }
        return normalizeBillingRecord(result.rows[0].definition);
      });
    },
  });
}


export type BillingFundingOutcome = "succeeded" | "refunded";

export interface BillingFundingTerms {
  readonly reference: string;
  readonly providerAmountNgn: string;
  readonly customerPriceCredits: number;
  readonly providerReserveCredits: number;
  readonly platformMarginCredits: number;
  readonly observedAt: string;
}

export interface BillingFundingReceipt extends BillingFundingTerms {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly quoteId: QuoteId;
  readonly state: "reserved" | "settled" | "refunded";
}

export interface BillingFundingRepository {
  reserve(input: BillingFundingTerms): Promise<BillingFundingReceipt>;
  settle(
    input: BillingFundingTerms & Readonly<{ outcome: BillingFundingOutcome }>,
  ): Promise<BillingFundingReceipt>;
}

const BILLING_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;

function credits(value: number, label: string, allowZero = false): number {
  if (
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1)
  ) {
    throw new RangeError(`${label} is invalid`);
  }
  return value;
}

export function normalizeBillingFundingTerms(
  input: BillingFundingTerms,
): BillingFundingTerms {
  const reference = parseCanonicalId("request", input.reference);
  const providerAmountNgn = bounded(input.providerAmountNgn, "providerAmountNgn", 80);
  if (
    !BILLING_DECIMAL.test(providerAmountNgn) ||
    /^0(?:\.0+)?$/u.test(providerAmountNgn)
  ) {
    throw new TypeError("providerAmountNgn is invalid");
  }
  const providerReserveCredits = credits(
    input.providerReserveCredits,
    "providerReserveCredits",
  );
  const platformMarginCredits = credits(
    input.platformMarginCredits,
    "platformMarginCredits",
    true,
  );
  const customerPriceCredits = credits(
    input.customerPriceCredits,
    "customerPriceCredits",
  );
  if (providerReserveCredits + platformMarginCredits !== customerPriceCredits) {
    throw new RangeError("billing funding economics do not sum");
  }
  return Object.freeze({
    reference,
    providerAmountNgn,
    customerPriceCredits,
    providerReserveCredits,
    platformMarginCredits,
    observedAt: instant(input.observedAt),
  });
}

function requestUuid(reference: string): string {
  return parseCanonicalId("request", reference).slice("request_".length);
}

function deterministicUuidV7(reference: string, purpose: string): string {
  const source = requestUuid(reference).replaceAll("-", "");
  const digest = createHash("sha256")
    .update(`${reference}:${purpose}`, "utf8")
    .digest("hex");
  const variant = ["8", "9", "a", "b"][Number.parseInt(digest[0]!, 16) % 4]!;
  const hex =
    source.slice(0, 12) +
    "7" +
    digest.slice(1, 4) +
    variant +
    digest.slice(4, 19);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

export function deriveBillingFundingIdentity(reference: string): Readonly<{
  quoteId: QuoteId;
  reserveLedgerEntryId: LedgerEntryId;
  providerLedgerEntryId: LedgerEntryId;
  marginLedgerEntryId: LedgerEntryId;
  refundLedgerEntryId: LedgerEntryId;
}> {
  const requestId = parseCanonicalId("request", reference);
  const quoteId = parseCanonicalId(
    "quote",
    `quote_${requestId.slice("request_".length)}`,
  );
  const ledger = (purpose: string) =>
    parseCanonicalId(
      "ledger-entry",
      `ledger-entry_${deterministicUuidV7(requestId, purpose)}`,
    );
  return Object.freeze({
    quoteId,
    reserveLedgerEntryId: ledger("billing-reserve"),
    providerLedgerEntryId: ledger("billing-provider-reserve"),
    marginLedgerEntryId: ledger("billing-platform-margin"),
    refundLedgerEntryId: ledger("billing-refund"),
  });
}

async function readLedgerTransfer(
  client: PoolClient,
  tenantId: TenantId,
  ledgerEntryId: LedgerEntryId,
): Promise<CommerceLedgerTransfer | null> {
  const result = await client.query<{ definition: CommerceLedgerTransfer }>(
    `SELECT definition
       FROM commerce.ledger_entries
      WHERE tenant_id=$1 AND ledger_entry_id=$2`,
    [tenantId, ledgerEntryId],
  );
  return result.rows[0]
    ? normalizeCommerceLedgerTransfer(result.rows[0].definition)
    : null;
}

async function readAccountBalance(
  client: PoolClient,
  input: Readonly<{
    tenantId: TenantId;
    kind: string;
    userId: UserId | null;
    characterId: string | null;
  }>,
): Promise<number> {
  const result = await client.query<{ balance: string }>(
    `SELECT COALESCE(SUM(
       CASE
         WHEN credit_kind=$2
          AND credit_user_id IS NOT DISTINCT FROM $3
          AND credit_character_id IS NOT DISTINCT FROM $4
         THEN amount_credits
         WHEN debit_kind=$2
          AND debit_user_id IS NOT DISTINCT FROM $3
          AND debit_character_id IS NOT DISTINCT FROM $4
         THEN -amount_credits
         ELSE 0
       END
     ),0)::text AS balance
       FROM commerce.ledger_entries
      WHERE tenant_id=$1`,
    [input.tenantId, input.kind, input.userId, input.characterId],
  );
  const balance = Number(result.rows[0]?.balance ?? "0");
  if (!Number.isSafeInteger(balance)) {
    throw new Error("financial.billing_balance_invalid");
  }
  return balance;
}

async function insertLedgerTransfer(
  client: PoolClient,
  transferInput: CommerceLedgerTransfer,
): Promise<CommerceLedgerTransfer> {
  const transfer = normalizeCommerceLedgerTransfer(transferInput);
  const existing = await readLedgerTransfer(
    client,
    transfer.tenantId,
    transfer.ledgerEntryId,
  );
  if (existing) {
    if (canonicalJson(existing) !== canonicalJson(transfer)) {
      throw new Error("financial.billing_funding_replay_conflict");
    }
    return existing;
  }
  const inserted = await client.query<{ definition: CommerceLedgerTransfer }>(
    `INSERT INTO commerce.ledger_entries(
       tenant_id, ledger_entry_id,
       debit_kind, debit_user_id, debit_character_id,
       credit_kind, credit_user_id, credit_character_id,
       amount_credits, reason, quote_id, fulfillment_id, created_at, definition
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
     RETURNING definition`,
    [
      transfer.tenantId,
      transfer.ledgerEntryId,
      transfer.debit.kind,
      transfer.debit.userId,
      transfer.debit.characterId,
      transfer.credit.kind,
      transfer.credit.userId,
      transfer.credit.characterId,
      transfer.amountCredits,
      transfer.reason,
      transfer.quoteId,
      transfer.fulfillmentId,
      transfer.createdAt,
      canonicalJson(transfer),
    ],
  );
  return normalizeCommerceLedgerTransfer(inserted.rows[0]!.definition);
}

function fundingTransfer(input: Readonly<{
  tenantId: TenantId;
  userId: UserId;
  ledgerEntryId: LedgerEntryId;
  quoteId: QuoteId;
  amountCredits: number;
  direction:
    | "customer-to-clearing"
    | "clearing-to-platform-float"
    | "clearing-to-platform-revenue"
    | "clearing-to-customer";
  createdAt: string;
}>): CommerceLedgerTransfer {
  const platform = { tenantId: input.tenantId, userId: null, characterId: null };
  const customer = {
    tenantId: input.tenantId,
    kind: "customer-credit" as const,
    userId: input.userId,
    characterId: null,
  };
  const clearing = {
    ...platform,
    kind: "external-clearing" as const,
  };
  const platformFloat = {
    ...platform,
    kind: "platform-float" as const,
  };
  const platformRevenue = {
    ...platform,
    kind: "platform-revenue" as const,
  };
  const debit =
    input.direction === "customer-to-clearing"
      ? customer
      : clearing;
  const credit =
    input.direction === "customer-to-clearing"
      ? clearing
      : input.direction === "clearing-to-platform-float"
        ? platformFloat
        : input.direction === "clearing-to-platform-revenue"
          ? platformRevenue
          : customer;
  const reason =
    input.direction === "customer-to-clearing"
      ? ("customer-payment" as const)
      : input.direction === "clearing-to-platform-revenue"
        ? ("platform-margin" as const)
        : input.direction === "clearing-to-customer"
          ? ("refund" as const)
          : ("adjustment" as const);
  return normalizeCommerceLedgerTransfer({
    schemaVersion: 1,
    tenantId: input.tenantId,
    ledgerEntryId: input.ledgerEntryId,
    debit,
    credit,
    amountCredits: input.amountCredits,
    reason,
    quoteId: input.quoteId,
    fulfillmentId: null,
    createdAt: input.createdAt,
  });
}

export function createPostgresBillingFundingRepository(
  pool: Pool,
  owner: Readonly<{ tenantId: string; userId: string }>,
): BillingFundingRepository {
  const tenantId = parseCanonicalId("tenant", owner.tenantId);
  const userId = parseCanonicalId("user", owner.userId);

  const receipt = (
    terms: BillingFundingTerms,
    state: BillingFundingReceipt["state"],
  ): BillingFundingReceipt => Object.freeze({
    ...terms,
    tenantId,
    userId,
    quoteId: deriveBillingFundingIdentity(terms.reference).quoteId,
    state,
  });

  return Object.freeze({
    async reserve(input) {
      const terms = normalizeBillingFundingTerms(input);
      const identity = deriveBillingFundingIdentity(terms.reference);
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `billing-funding:${tenantId}:${userId}:${terms.reference}`,
        ]);
        const refund = await readLedgerTransfer(
          client,
          tenantId,
          identity.refundLedgerEntryId,
        );
        if (refund) throw new Error("financial.billing_funding_already_refunded");

        const expected = fundingTransfer({
          tenantId,
          userId,
          ledgerEntryId: identity.reserveLedgerEntryId,
          quoteId: identity.quoteId,
          amountCredits: terms.customerPriceCredits,
          direction: "customer-to-clearing",
          createdAt: terms.observedAt,
        });
        const existing = await readLedgerTransfer(
          client,
          tenantId,
          identity.reserveLedgerEntryId,
        );
        if (existing) {
          if (canonicalJson(existing) !== canonicalJson(expected)) {
            throw new Error("financial.billing_funding_replay_conflict");
          }
          const provider = await readLedgerTransfer(
            client,
            tenantId,
            identity.providerLedgerEntryId,
          );
          return receipt(terms, provider ? "settled" : "reserved");
        }

        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `commerce:account:${tenantId}:customer-credit:${userId}:-`,
        ]);
        const balance = await readAccountBalance(client, {
          tenantId,
          kind: "customer-credit",
          userId,
          characterId: null,
        });
        if (balance < terms.customerPriceCredits) {
          throw new Error("commerce.insufficient_balance");
        }
        await insertLedgerTransfer(client, expected);
        return receipt(terms, "reserved");
      });
    },

    async settle(input) {
      const terms = normalizeBillingFundingTerms(input);
      const identity = deriveBillingFundingIdentity(terms.reference);
      return withTransaction(pool, async (client) => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `billing-funding:${tenantId}:${userId}:${terms.reference}`,
        ]);

        const reserveExpected = fundingTransfer({
          tenantId,
          userId,
          ledgerEntryId: identity.reserveLedgerEntryId,
          quoteId: identity.quoteId,
          amountCredits: terms.customerPriceCredits,
          direction: "customer-to-clearing",
          createdAt: terms.observedAt,
        });
        const reserve = await readLedgerTransfer(
          client,
          tenantId,
          identity.reserveLedgerEntryId,
        );
        if (!reserve) throw new Error("financial.billing_funding_not_reserved");
        if (
          reserve.amountCredits !== reserveExpected.amountCredits ||
          reserve.debit.kind !== "customer-credit" ||
          reserve.debit.userId !== userId ||
          reserve.credit.kind !== "external-clearing" ||
          reserve.quoteId !== identity.quoteId
        ) {
          throw new Error("financial.billing_funding_replay_conflict");
        }

        const refund = await readLedgerTransfer(
          client,
          tenantId,
          identity.refundLedgerEntryId,
        );
        const provider = await readLedgerTransfer(
          client,
          tenantId,
          identity.providerLedgerEntryId,
        );

        if (input.outcome === "refunded") {
          if (provider) {
            throw new Error("financial.billing_funding_already_settled");
          }
          if (!refund) {
            await insertLedgerTransfer(
              client,
              fundingTransfer({
                tenantId,
                userId,
                ledgerEntryId: identity.refundLedgerEntryId,
                quoteId: identity.quoteId,
                amountCredits: terms.customerPriceCredits,
                direction: "clearing-to-customer",
                createdAt: terms.observedAt,
              }),
            );
          }
          return receipt(terms, "refunded");
        }

        if (refund) {
          throw new Error("financial.billing_funding_already_refunded");
        }
        if (!provider) {
          await insertLedgerTransfer(
            client,
            fundingTransfer({
              tenantId,
              userId,
              ledgerEntryId: identity.providerLedgerEntryId,
              quoteId: identity.quoteId,
              amountCredits: terms.providerReserveCredits,
              direction: "clearing-to-platform-float",
              createdAt: terms.observedAt,
            }),
          );
        }
        if (terms.platformMarginCredits > 0) {
          await insertLedgerTransfer(
            client,
            fundingTransfer({
              tenantId,
              userId,
              ledgerEntryId: identity.marginLedgerEntryId,
              quoteId: identity.quoteId,
              amountCredits: terms.platformMarginCredits,
              direction: "clearing-to-platform-revenue",
              createdAt: terms.observedAt,
            }),
          );
        }
        return receipt(terms, "settled");
      });
    },
  });
}
